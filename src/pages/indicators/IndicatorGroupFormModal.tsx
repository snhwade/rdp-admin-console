import { Form, Input, Modal, Select } from 'antd';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listScenarioTree } from '@/api/console';
import type { IndicatorGroupCardView, SaveIndicatorGroupBody } from '@/api/config';

interface Props {
  open: boolean;
  editing: IndicatorGroupCardView | null;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (values: SaveIndicatorGroupBody) => void;
}

export default function IndicatorGroupFormModal({ open, editing, loading, onCancel, onSubmit }: Props) {
  const [form] = Form.useForm<SaveIndicatorGroupBody>();
  const { data: scenarioTree = [] } = useQuery({
    queryKey: ['scenario-tree'],
    queryFn: listScenarioTree,
    enabled: open,
  });

  const eventOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (const scenario of scenarioTree) {
      for (const event of scenario.events ?? []) {
        opts.push({ value: event.code, label: `${scenario.name} / ${event.name}` });
      }
    }
    return opts;
  }, [scenarioTree]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editing && editing.id != null) {
      form.setFieldsValue({
        name: editing.name,
        orgName: editing.orgName ?? '总部',
        eventTypeCodes: editing.eventTypeCodes ?? [],
      });
    } else {
      form.setFieldsValue({ orgName: '总部', eventTypeCodes: [] });
    }
  }, [open, editing, form]);

  return (
    <Modal
      title={editing?.id != null ? '编辑指标分组' : '新建指标分组'}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnClose
      width={560}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item label="分组名称" name="name" rules={[{ required: true, message: '请输入分组名称' }]}>
          <Input placeholder="如 商户KYC筛查" maxLength={128} />
        </Form.Item>
        <Form.Item label="归属机构" name="orgName" initialValue="总部">
          <Input placeholder="总部" maxLength={64} />
        </Form.Item>
        <Form.Item
          label="绑定事件"
          name="eventTypeCodes"
          rules={[{ required: true, message: '请至少选择一个事件' }]}
        >
          <Select
            mode="multiple"
            placeholder="选择该分组关联的事件（可多选）"
            options={eventOptions}
            optionFilterProp="label"
            maxTagCount="responsive"
          />
        </Form.Item>
        <Form.Item label="描述" name="description">
          <Input.TextArea rows={2} placeholder="可选" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
