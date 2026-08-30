import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Layout,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import ScenarioEventTreePanel from '@/components/ScenarioEventTreePanel';
import { CodeHintLabel, codeHintSelectOption } from '@/components/CodeHintLabel';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addEventField,
  listEventFields,
  listFields,
  listScenarioTree,
  markEventFieldDerived,
  removeEventField,
  type AddEventFieldBody,
  type EventFieldView,
  type EventPurpose,
  type FieldDataType,
  type FieldView,
  type ScenarioTreeEvent,
} from '@/api/console';
import { toFieldErrors, type ApiError } from '@/api/client';

/**
 * 事件字段页（risk-console-redesign R4.1）。
 *
 * 布局：左侧「业务场景 → 事件」树（listScenarioTree），右侧所选事件下的事件字段表格
 * （字段 code / 字段名称 / 字段类型 / 用途 / 操作：衍生标记切换 / 移除）。
 *
 * 能力：
 * - 从字段库添加：选择全局字段（listFields）+ 用途多选（COMPUTE/DECISION）+ 衍生标记，addEventField。
 * - 衍生标记：行内开关切换 markEventFieldDerived。
 * - 移除：removeEventField；被规则或评级模型引用时后端返回 EVENT_FIELD.IN_USE，错误提示透传。
 *
 * 命名中性化（R1）：本页仅从 `@/api/console` import 中性 API，不引用旧版共享 API 模块。
 */

const { Sider, Content } = Layout;
const { Text } = Typography;

/** 事件用途选项。 */
const PURPOSE_OPTIONS: { label: string; value: EventPurpose }[] = [
  { label: '计算（COMPUTE）', value: 'COMPUTE' },
  { label: '决策（DECISION）', value: 'DECISION' },
];

/** 用途中文展示。 */
function purposeLabel(p: EventPurpose): string {
  if (p === 'COMPUTE') return '计算';
  if (p === 'DECISION') return '决策';
  return String(p);
}

/** 字段类型标签颜色映射。 */
function dataTypeColor(t?: FieldDataType): string {
  switch (t) {
    case 'String':
      return 'blue';
    case 'Double':
    case 'Integer':
      return 'geekblue';
    case 'Boolean':
      return 'purple';
    case 'Date':
      return 'cyan';
    default:
      return 'default';
  }
}

interface AddFieldFormValues {
  fieldId: number | string;
  purposes: EventPurpose[];
  derived: boolean;
}

interface SelectedEvent {
  scenarioId: number | string;
  code: string;
  name: string;
}

export default function EventFieldsPage() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm<AddFieldFormValues>();

  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // 场景 → 事件 树
  const { data: scenarioTree = [], isLoading: treeLoading } = useQuery({
    queryKey: ['scenario-tree'],
    queryFn: listScenarioTree,
  });

  // 默认选中第一个含事件的场景下的首个事件
  useEffect(() => {
    if (selectedEvent != null || scenarioTree.length === 0) {
      return;
    }
    for (const s of scenarioTree) {
      if (s.events.length > 0) {
        const e = s.events[0];
        setSelectedEvent({ scenarioId: s.id, code: e.code, name: e.name });
        return;
      }
    }
  }, [scenarioTree, selectedEvent]);

  // 所选事件下的事件字段列表
  const { data: eventFields = [], isLoading: fieldsLoading } = useQuery({
    queryKey: ['event-fields', selectedEvent?.code],
    queryFn: () => listEventFields(selectedEvent!.code),
    enabled: selectedEvent != null,
  });

  // 全局字段库（从字段库添加时选择）
  const { data: globalFields = [] } = useQuery({
    queryKey: ['fields'],
    queryFn: listFields,
    enabled: addOpen,
  });

  // 已关联字段 id 集合（避免重复添加）
  const linkedFieldIds = useMemo(
    () => new Set(eventFields.map((f) => String(f.fieldId))),
    [eventFields],
  );

  const fieldOptions = useMemo(
    () =>
      globalFields.map((f: FieldView) =>
        codeHintSelectOption(f.id, f.name, f.code),
      ).map((opt) => ({
        ...opt,
        disabled: linkedFieldIds.has(String(opt.value)),
      })),
    [globalFields, linkedFieldIds],
  );

  const eventNameByCode = useMemo(() => {
    const map = new Map<string, ScenarioTreeEvent>();
    for (const s of scenarioTree) {
      for (const e of s.events) {
        map.set(e.code, e);
      }
    }
    return map;
  }, [scenarioTree]);

  // 表单重置
  useEffect(() => {
    if (addOpen) {
      form.resetFields();
      form.setFieldsValue({ purposes: ['COMPUTE'], derived: false });
    }
  }, [addOpen, form]);

  /** 字段级错误回显到表单项并保留用户输入。 */
  const echoFieldErrors = (err: ApiError, fallback: string) => {
    const fieldErrors = toFieldErrors(err);
    const formErrors = Object.entries(fieldErrors).map(([name, msg]) => ({
      name: name as keyof AddFieldFormValues,
      errors: [msg],
    }));
    if (formErrors.length > 0) {
      form.setFields(formErrors);
    } else {
      message.error(err.message ?? fallback);
    }
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['event-fields', selectedEvent?.code] });
  };

  const addMutation = useMutation({
    mutationFn: ({ eventCode, body }: { eventCode: string; body: AddEventFieldBody }) =>
      addEventField(eventCode, body),
    onSuccess: () => {
      message.success('字段已添加到事件');
      setAddOpen(false);
      form.resetFields();
      invalidate();
    },
    onError: (err: ApiError) => echoFieldErrors(err, '添加失败'),
  });

  const derivedMutation = useMutation({
    mutationFn: ({
      eventCode,
      eventFieldId,
      derived,
    }: {
      eventCode: string;
      eventFieldId: number | string;
      derived: boolean;
    }) => markEventFieldDerived(eventCode, eventFieldId, derived),
    onSuccess: (view) => {
      message.success(view.derived ? '已标记为衍生字段' : '已取消衍生标记');
      invalidate();
    },
    onError: (err: ApiError) => message.error(err.message ?? '衍生标记更新失败'),
  });

  const removeMutation = useMutation({
    mutationFn: ({
      eventCode,
      eventFieldId,
    }: {
      eventCode: string;
      eventFieldId: number | string;
    }) => removeEventField(eventCode, eventFieldId),
    onSuccess: () => {
      message.success('已从事件移除该字段');
      invalidate();
    },
    // 被规则 / 评级模型引用时后端返回 EVENT_FIELD.IN_USE，透传错误说明。
    onError: (err: ApiError) =>
      message.error(err.message ?? '移除失败：该字段可能仍被规则或评级模型引用'),
  });

  const onTreeSelectEvent = (scenarioId: number | string, code: string) => {
    const e = eventNameByCode.get(code);
    setSelectedEvent({ scenarioId, code, name: e?.name ?? code });
  };

  const handleAddSubmit = (values: AddFieldFormValues) => {
    if (!selectedEvent) {
      return;
    }
    addMutation.mutate({
      eventCode: selectedEvent.code,
      body: {
        fieldId: values.fieldId,
        purposes: values.purposes,
        derived: values.derived,
      },
    });
  };

  const handleRemove = (row: EventFieldView) => {
    if (!selectedEvent) {
      return;
    }
    Modal.confirm({
      title: `从事件「${selectedEvent.name}」移除字段「${row.fieldName ?? row.fieldCode ?? row.fieldId}」？`,
      content: '若该事件字段仍被规则或评级模型引用，移除将被拒绝。',
      okText: '移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () =>
        removeMutation.mutateAsync({ eventCode: selectedEvent.code, eventFieldId: row.id }),
    });
  };

  const handleToggleDerived = (row: EventFieldView, derived: boolean) => {
    if (!selectedEvent) {
      return;
    }
    derivedMutation.mutate({
      eventCode: selectedEvent.code,
      eventFieldId: row.id,
      derived,
    });
  };

  const columns: ColumnsType<EventFieldView> = [
    { title: '字段', dataIndex: 'fieldCode', key: 'fieldCode', render: (c?: string) => c ?? '-' },
    {
      title: '字段名称',
      dataIndex: 'fieldName',
      key: 'fieldName',
      render: (n?: string) => n ?? '-',
    },
    {
      title: '字段类型',
      dataIndex: 'dataType',
      key: 'dataType',
      render: (t?: FieldDataType) => (t ? <Tag color={dataTypeColor(t)}>{t}</Tag> : '-'),
    },
    {
      title: '用途',
      dataIndex: 'purposes',
      key: 'purposes',
      render: (purposes: EventPurpose[]) =>
        purposes && purposes.length > 0 ? (
          <Space size={4} wrap>
            {purposes.map((p) => (
              <Tag color={p === 'COMPUTE' ? 'blue' : 'purple'} key={String(p)}>
                {purposeLabel(p)}
              </Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, row) => (
        <Space size="middle">
          <Space size={4}>
            <Text type="secondary">衍生</Text>
            <Switch
              size="small"
              checked={row.derived}
              loading={derivedMutation.isPending}
              onChange={(checked) => handleToggleDerived(row, checked)}
            />
          </Space>
          <Button type="link" size="small" danger onClick={() => handleRemove(row)}>
            移除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ background: 'transparent' }}>
      <Sider width={300} theme="light" style={{ background: '#fff', marginRight: 16, padding: 12 }}>
        <ScenarioEventTreePanel
          tree={scenarioTree}
          loading={treeLoading}
          selectedEventKey={
            selectedEvent != null
              ? `event:${selectedEvent.scenarioId}:${selectedEvent.code}`
              : null
          }
          onSelectEvent={onTreeSelectEvent}
        />
      </Sider>
      <Content>
        <Card
          title={
            selectedEvent ? (
              <CodeHintLabel prefix="事件字段：" name={selectedEvent.name} code={selectedEvent.code} />
            ) : (
              '事件字段'
            )
          }
          extra={
            <Button type="primary" onClick={() => setAddOpen(true)} disabled={selectedEvent == null}>
              从字段库添加
            </Button>
          }
        >
          <Table
            rowKey="id"
            loading={fieldsLoading}
            columns={columns}
            dataSource={eventFields}
            locale={{
              emptyText: selectedEvent == null ? '请选择左侧事件' : '该事件下暂无字段',
            }}
          />
        </Card>
      </Content>

      {/* 从字段库添加 */}
      <Modal
        title="从字段库添加字段"
        open={addOpen}
        onOk={() => form.submit()}
        confirmLoading={addMutation.isPending}
        onCancel={() => setAddOpen(false)}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={handleAddSubmit}>
          <Form.Item
            label="全局字段"
            name="fieldId"
            tooltip="从字段库选择，已关联到该事件的字段不可重复添加"
            rules={[{ required: true, message: '请选择全局字段' }]}
          >
            <Select
              placeholder="选择全局字段"
              options={fieldOptions}
              optionFilterProp="label"
              showSearch
            />
          </Form.Item>
          <Form.Item
            label="用途"
            name="purposes"
            tooltip="可多选，至少选择一个"
            rules={[{ required: true, message: '请至少选择一个用途' }]}
          >
            <Select mode="multiple" placeholder="选择用途" options={PURPOSE_OPTIONS} />
          </Form.Item>
          <Form.Item label="衍生字段" name="derived" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
