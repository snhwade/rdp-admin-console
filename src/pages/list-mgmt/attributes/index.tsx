import { useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createListAttrDef,
  deleteListAttrDefs,
  listAttrDefs,
  updateListAttrDef,
  type ListAttrDefView,
  type ListAttrInputType,
} from '@/api/listMgmt';
import { type ApiError } from '@/api/client';

const INPUT_TYPE_OPTIONS: { label: string; value: ListAttrInputType }[] = [
  { label: '文本', value: 'TEXT' },
  { label: '下拉选择', value: 'SELECT' },
  { label: '日期', value: 'DATE' },
  { label: '数字', value: 'NUMBER' },
];

const MASK_OPTIONS = [
  { label: '不脱敏', value: 'NONE' },
  { label: '部分脱敏', value: 'PARTIAL' },
  { label: '完全脱敏', value: 'FULL' },
];

export default function ListAttributesPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<(number | string)[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ListAttrDefView | null>(null);
  const [form] = Form.useForm();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['list-attr-defs', keyword],
    queryFn: () => listAttrDefs(keyword || undefined),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['list-attr-defs'] });

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const body = {
        name: values.name as string,
        inputType: values.inputType as ListAttrInputType,
        required: values.required as boolean,
        multiValue: values.multiValue as boolean,
        maskRule: values.maskRule as string,
      };
      if (editing) {
        return updateListAttrDef(editing.id, body);
      }
      return createListAttrDef({ code: values.code as string, ...body });
    },
    onSuccess: () => {
      message.success(editing ? '属性已更新' : '属性已创建');
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      invalidate();
    },
    onError: (err: ApiError) => message.error(err.message ?? '保存失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteListAttrDefs,
    onSuccess: () => {
      message.success('已删除');
      setSelectedRowKeys([]);
      invalidate();
    },
    onError: (err: ApiError) => message.error(err.message ?? '删除失败'),
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      inputType: 'TEXT',
      required: false,
      multiValue: false,
      maskRule: 'NONE',
    });
    setModalOpen(true);
  };

  const openEdit = (row: ListAttrDefView) => {
    setEditing(row);
    form.setFieldsValue(row);
    setModalOpen(true);
  };

  const columns: ColumnsType<ListAttrDefView> = [
    { title: '属性编码', dataIndex: 'code', key: 'code', width: 120 },
    { title: '属性名称', dataIndex: 'name', key: 'name', width: 140 },
    {
      title: '输入方式',
      dataIndex: 'inputType',
      key: 'inputType',
      width: 100,
      render: (v: ListAttrInputType) => INPUT_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v,
    },
    {
      title: '是否必填',
      dataIndex: 'required',
      key: 'required',
      width: 90,
      render: (v: boolean) => (v ? '是' : '否'),
    },
    {
      title: '是否多值',
      dataIndex: 'multiValue',
      key: 'multiValue',
      width: 90,
      render: (v: boolean) => (v ? '是' : '否'),
    },
    {
      title: '脱敏规则',
      dataIndex: 'maskRule',
      key: 'maskRule',
      width: 100,
      render: (v?: string) => MASK_OPTIONS.find((o) => o.value === v)?.label ?? v ?? '—',
    },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 180 },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, row) => (
        <Space>
          <Button type="link" size="small" onClick={() => openEdit(row)}>
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => deleteMutation.mutate([row.id])}>
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="名单附加属性"
      extra={
        <Space>
          <Input.Search
            allowClear
            placeholder="请输入关键词"
            style={{ width: 220 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Button type="primary" onClick={openCreate}>
            新建
          </Button>
        </Space>
      }
    >
      <Space style={{ marginBottom: 12 }}>
        <Popconfirm
          title="确认删除所选属性？"
          disabled={selectedRowKeys.length === 0}
          onConfirm={() => deleteMutation.mutate(selectedRowKeys)}
        >
          <Button danger disabled={selectedRowKeys.length === 0} loading={deleteMutation.isPending}>
            删除
          </Button>
        </Popconfirm>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={rows}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as (string | number)[]),
        }}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editing ? '编辑附加属性' : '基础附加属性'}
        open={modalOpen}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          <Form.Item
            label="属性编码"
            name="code"
            rules={[{ required: true, message: '请输入英文或数字' }]}
          >
            <Input placeholder="请输入英文或数字" disabled={editing != null} />
          </Form.Item>
          <Form.Item label="属性名称" name="name" rules={[{ required: true, message: '请输入' }]}>
            <Input placeholder="请输入" />
          </Form.Item>
          <Form.Item label="输入方式" name="inputType" rules={[{ required: true }]}>
            <Select options={INPUT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item label="是否必填" name="required" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item label="是否多值" name="multiValue" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item label="脱敏规则" name="maskRule">
            <Select options={MASK_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
