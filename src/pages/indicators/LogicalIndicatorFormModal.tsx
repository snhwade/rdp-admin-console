import { useEffect, useMemo } from 'react';

import { Alert, Button, Form, Input, InputNumber, Modal, Select, Space, Typography, message } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';

import {
  createLogicalIndicator,
  updateLogicalIndicator,
  type CombineMode,
  type IndicatorDefinitionView,
  type LogicalIndicatorView,
  type SaveLogicalIndicatorBody,
} from '@/api/config';
import { toFieldErrors, type ApiError } from '@/api/client';

const { Text } = Typography;

const GRANULARITY_OPTIONS = [
  { value: 'MINUTE', label: '分钟' },
  { value: 'HOUR', label: '小时' },
  { value: 'DAY', label: '天' },
];

const COMBINE_MODE_OPTIONS = [
  { value: 'SUM', label: '求和' },
  { value: 'EXPRESSION', label: '自定义表达式' },
];

interface FormValues {
  refName: string;
  name?: string;
  description?: string;
  combineMode: CombineMode;
  combineExpression?: string;
  dimensions: string[];
  windowDays: number;
  sliceGranularity: 'MINUTE' | 'HOUR' | 'DAY';
  defaultValueStrategy?: string;
  members: { memberRefName: string }[];
}

interface Props {
  open: boolean;
  editing: LogicalIndicatorView | null;
  groupId?: number | string | null;
  physicalIndicators: IndicatorDefinitionView[];
  onCancel: () => void;
  onSaved: () => void;
  onManageSources?: () => void;
}

export default function LogicalIndicatorFormModal({
  open,
  editing,
  groupId,
  physicalIndicators,
  onCancel,
  onSaved,
  onManageSources,
}: Props) {
  const [form] = Form.useForm<FormValues>();
  const combineMode = Form.useWatch('combineMode', form);

  const memberOptions = useMemo(
    () =>
      physicalIndicators.map((p) => ({
        value: p.refName,
        label: `${p.refName}${p.name ? `（${p.name}）` : ''}`,
        physical: p,
      })),
    [physicalIndicators],
  );

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        refName: editing.refName,
        name: editing.name ?? undefined,
        description: editing.description ?? undefined,
        combineMode: editing.combineMode,
        combineExpression: editing.combineExpression ?? undefined,
        dimensions: editing.dimensions ?? [],
        windowDays: editing.windowDays,
        sliceGranularity: editing.sliceGranularity,
        defaultValueStrategy: editing.defaultValueStrategy ?? 'ZERO',
        members: (editing.members ?? []).map((m) => ({ memberRefName: m.memberRefName })),
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        combineMode: 'SUM',
        windowDays: 1,
        sliceGranularity: 'DAY',
        defaultValueStrategy: 'ZERO',
        dimensions: [],
        members: [{ memberRefName: '' }],
      });
    }
  }, [open, editing, form]);

  const syncFromPhysical = (refName: string) => {
    const physical = physicalIndicators.find((p) => p.refName === refName);
    if (!physical) return;
    form.setFieldsValue({
      dimensions: physical.dimensions ?? [],
      windowDays: physical.windowDays,
      sliceGranularity: physical.sliceGranularity,
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const members = (values.members ?? [])
        .filter((m) => m.memberRefName)
        .map((m) => {
          const physical = physicalIndicators.find((p) => p.refName === m.memberRefName);
          return {
            memberRefName: m.memberRefName,
            eventTypeCode: physical?.eventTypeCodes?.[0],
          };
        });
      const body: SaveLogicalIndicatorBody = {
        groupId: groupId ?? undefined,
        refName: values.refName.trim(),
        name: values.name?.trim() || undefined,
        description: values.description?.trim() || undefined,
        combineMode: values.combineMode,
        combineExpression:
          values.combineMode === 'EXPRESSION' ? values.combineExpression?.trim() : undefined,
        dimensions: values.dimensions ?? [],
        windowDays: values.windowDays,
        sliceGranularity: values.sliceGranularity,
        defaultValueStrategy: values.defaultValueStrategy ?? 'ZERO',
        members,
      };
      if (editing) {
        const { refName: _ref, ...updateBody } = body;
        return updateLogicalIndicator(editing.id, updateBody);
      }
      return createLogicalIndicator(body);
    },
    onSuccess: () => {
      message.success(editing ? '指标已更新' : '指标已创建');
      onSaved();
      onCancel();
    },
    onError: (err: ApiError) => {
      const fieldErrors = toFieldErrors(err);
      const entries = Object.entries(fieldErrors);
      if (entries.length > 0) {
        form.setFields(
          entries.map(([name, messageText]) => ({
            name: name as keyof FormValues,
            errors: [messageText],
          })),
        );
      }
      message.error(err.message ?? '保存失败');
    },
  });

  return (
    <Modal
      open={open}
      title={editing ? '编辑指标' : '新建指标'}
      width={640}
      okText="保存"
      confirmLoading={saveMutation.isPending}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okButtonProps={{ disabled: !editing && physicalIndicators.length === 0 }}
      destroyOnClose
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        指标编码供规则引用；底层按事件分别累计，读取时自动聚合所选统计源。
      </Text>
      {physicalIndicators.length === 0 ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="尚无统计源"
          description="请先为各事件配置统计源，再创建指标并选择要聚合的数据来源。"
          action={
            onManageSources ? (
              <Button size="small" type="primary" onClick={onManageSources}>
                去配置统计源
              </Button>
            ) : undefined
          }
        />
      ) : null}
      <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
        <Form.Item
          name="refName"
          label="指标编码"
          rules={[
            { required: true, message: '请输入 refName' },
            { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '字母开头，仅含字母数字下划线' },
          ]}
        >
          <Input placeholder="如 usd_total" disabled={!!editing} />
        </Form.Item>
        <Form.Item name="name" label="指标名称">
          <Input placeholder="可选" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="可选" />
        </Form.Item>
        <Form.Item
          name="combineMode"
          label="组合方式"
          rules={[{ required: true, message: '请选择组合方式' }]}
        >
          <Select options={COMBINE_MODE_OPTIONS} />
        </Form.Item>
        {combineMode === 'EXPRESSION' ? (
          <Form.Item
            name="combineExpression"
            label="组合表达式"
            extra="变量名为统计源编码，如 b2b_amt + b2c_amt"
            rules={[{ required: true, message: '请输入组合表达式' }]}
          >
            <Input placeholder="b2b_amt + b2c_amt" />
          </Form.Item>
        ) : null}
        <Form.List
          name="members"
          rules={[
            {
              validator: async (_, members) => {
                const valid = (members ?? []).filter(
                  (m: { memberRefName?: string }) => m?.memberRefName,
                );
                if (valid.length < 1) {
                  throw new Error('至少选择一个统计源');
                }
              },
            },
          ]}
        >
          {(fields, { add, remove }, { errors }) => (
            <>
              <Text strong>统计源</Text>
              {fields.map(({ key, name, ...rest }) => (
                <Space key={key} align="baseline" style={{ display: 'flex', marginTop: 8 }}>
                  <Form.Item
                    {...rest}
                    name={[name, 'memberRefName']}
                    rules={[{ required: true, message: '请选择统计源' }]}
                    style={{ marginBottom: 0, flex: 1, minWidth: 280 }}
                  >
                    <Select
                      placeholder="选择统计源"
                      options={memberOptions}
                      showSearch
                      optionFilterProp="label"
                      onChange={syncFromPhysical}
                    />
                  </Form.Item>
                  {fields.length > 1 ? (
                    <MinusCircleOutlined onClick={() => remove(name)} />
                  ) : null}
                </Space>
              ))}
              <Form.ErrorList errors={errors} />
              <Form.Item style={{ marginTop: 8 }}>
                <a onClick={() => add({ memberRefName: '' })}>
                  <PlusOutlined /> 添加统计源
                </a>
              </Form.Item>
            </>
          )}
        </Form.List>
        <Form.Item
          name="dimensions"
          label="统计维度"
          rules={[{ required: true, message: '请选择或同步维度' }]}
        >
          <Select mode="tags" placeholder="与统计源保持一致" />
        </Form.Item>
        <Space wrap>
          <Form.Item
            name="windowDays"
            label="时间窗口（天）"
            rules={[{ required: true, message: '请输入窗口' }]}
          >
            <InputNumber min={1} max={365} />
          </Form.Item>
          <Form.Item
            name="sliceGranularity"
            label="切片粒度"
            rules={[{ required: true, message: '请选择粒度' }]}
          >
            <Select options={GRANULARITY_OPTIONS} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="defaultValueStrategy" label="缺省值策略">
            <Select
              style={{ width: 120 }}
              options={[
                { value: 'ZERO', label: 'ZERO' },
                { value: 'MISSING', label: 'MISSING' },
              ]}
            />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  );
}
