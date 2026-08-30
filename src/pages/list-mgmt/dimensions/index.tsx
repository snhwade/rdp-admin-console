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
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createListDimension,
  deleteListDimensions,
  listDimensions,
  updateListDimension,
  type ListDimensionView,
} from '@/api/listMgmt';
import { type ApiError } from '@/api/client';

const MASK_OPTIONS = [
  { label: '不脱敏', value: 'NONE' },
  { label: '部分脱敏', value: 'PARTIAL' },
  { label: '完全脱敏', value: 'FULL' },
];

export default function ListDimensionsPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<(number | string)[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ListDimensionView | null>(null);
  const [form] = Form.useForm();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['list-dimensions', keyword],
    queryFn: () => listDimensions(keyword || undefined),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['list-dimensions'] });

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      if (editing) {
        return updateListDimension(editing.id, {
          name: values.name as string,
          maskRule: values.maskRule as string,
          fuzzyEnabled: values.fuzzyEnabled as boolean,
          updatedBy: 'admin',
        });
      }
      return createListDimension({
        code: values.code as string,
        name: values.name as string,
        maskRule: values.maskRule as string,
        fuzzyEnabled: values.fuzzyEnabled as boolean,
        updatedBy: 'admin',
      });
    },
    onSuccess: () => {
      message.success(editing ? '维度已更新' : '维度已创建');
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      invalidate();
    },
    onError: (err: ApiError) => message.error(err.message ?? '保存失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteListDimensions,
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
    form.setFieldsValue({ maskRule: 'NONE', fuzzyEnabled: false });
    setModalOpen(true);
  };

  const openEdit = (row: ListDimensionView) => {
    setEditing(row);
    form.setFieldsValue({
      code: row.code,
      name: row.name,
      maskRule: row.maskRule ?? 'NONE',
      fuzzyEnabled: row.fuzzyEnabled,
    });
    setModalOpen(true);
  };

  const columns: ColumnsType<ListDimensionView> = [
    { title: '维度编码', dataIndex: 'code', key: 'code', width: 140 },
    { title: '维度名称', dataIndex: 'name', key: 'name', width: 140 },
    {
      title: '脱敏规则',
      dataIndex: 'maskRule',
      key: 'maskRule',
      width: 100,
      render: (v?: string) => MASK_OPTIONS.find((o) => o.value === v)?.label ?? v ?? '—',
    },
    {
      title: '模糊匹配',
      dataIndex: 'fuzzyEnabled',
      key: 'fuzzyEnabled',
      width: 90,
      render: (v: boolean) => (v ? <Tag color="blue">支持</Tag> : <Tag>精确</Tag>),
    },
    { title: '更新人', dataIndex: 'updatedBy', key: 'updatedBy', width: 100, render: (v) => v ?? '—' },
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
      title="名单维度"
      extra={
        <Space>
          <Input.Search
            allowClear
            placeholder="请输入维度名称"
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
          title="确认删除所选维度？"
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
        title={editing ? '编辑维度' : '新建维度'}
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
            label="维度编码"
            name="code"
            rules={[{ required: true, message: '请输入英文或数字编码' }]}
          >
            <Input placeholder="如 MechID、phone" disabled={editing != null} />
          </Form.Item>
          <Form.Item label="维度名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如 商户编号" />
          </Form.Item>
          <Form.Item label="脱敏规则" name="maskRule">
            <Select options={MASK_OPTIONS} />
          </Form.Item>
          <Form.Item label="支持模糊匹配" name="fuzzyEnabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
