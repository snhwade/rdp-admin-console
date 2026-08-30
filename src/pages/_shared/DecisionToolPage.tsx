import { useMemo, useState } from 'react';
import {
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { codeHintSelectOption } from '@/components/CodeHintLabel';
import { listEventTypes } from '@/api/config';
import { toFieldErrors, type ApiError } from '@/api/client';

const { Text, Paragraph } = Typography;

export interface DecisionToolItem {
  id?: number | string;
  name: string;
  eventTypeCode: string;
  status?: string;
  [k: string]: unknown;
}

interface ExtraField {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'select';
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  /** 编辑时隐藏（如 eventTypeCode 创建后不可改）。 */
  editHidden?: boolean;
}

interface Props {
  title: string;
  queryKey: string;
  list: (eventTypeCode?: string) => Promise<DecisionToolItem[]>;
  create: (body: Record<string, unknown>) => Promise<DecisionToolItem>;
  get?: (id: number | string) => Promise<DecisionToolItem>;
  update?: (id: number | string, body: Record<string, unknown>) => Promise<DecisionToolItem>;
  remove?: (id: number | string) => Promise<void>;
  extraFields?: ExtraField[];
  extraColumns?: ColumnsType<DecisionToolItem>;
  hint?: string;
}

function statusTag(status?: string) {
  const enabled = !status || status === 'ENABLED' || status === 'ONLINE';
  return <Tag color={enabled ? 'green' : 'default'}>{status ?? 'ENABLED'}</Tag>;
}

function parseJsonFields(
  values: Record<string, unknown>,
  extraFields: ExtraField[],
  form: ReturnType<typeof Form.useForm>[0],
): Record<string, unknown> | null {
  const body: Record<string, unknown> = { ...values };
  for (const f of extraFields) {
    if (!f.name.endsWith('Json')) {
      continue;
    }
    const raw = values[f.name];
    const key = f.name.replace(/Json$/, '');
    if (raw == null || raw === '') {
      delete body[f.name];
      continue;
    }
    if (typeof raw !== 'string') {
      continue;
    }
    try {
      body[key] = JSON.parse(raw);
      delete body[f.name];
    } catch {
      form.setFields([{ name: f.name, errors: ['JSON 格式非法'] }]);
      return null;
    }
  }
  return body;
}

function itemToFormValues(item: DecisionToolItem, extraFields: ExtraField[]) {
  const values: Record<string, unknown> = { ...item };
  for (const f of extraFields) {
    if (!f.name.endsWith('Json')) {
      continue;
    }
    const key = f.name.replace(/Json$/, '');
    if (values[key] != null) {
      values[f.name] = JSON.stringify(values[key], null, 2);
    }
  }
  return values;
}

/**
 * 决策工具配置页通用组件（S2/S8/S9）。
 * 全宽列表 + 顶部筛选 + CRUD 抽屉/弹窗（与决策流墙/规则包列表一致，无左侧场景树）。
 */
export default function DecisionToolPage({
  title,
  queryKey,
  list,
  create,
  get,
  update,
  remove,
  extraFields = [],
  extraColumns = [],
  hint,
}: Props) {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailItem, setDetailItem] = useState<DecisionToolItem | null>(null);
  const [eventFilter, setEventFilter] = useState<string | undefined>(undefined);

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: () => list(),
  });

  const { data: eventTypes = [] } = useQuery({
    queryKey: ['event-types'],
    queryFn: listEventTypes,
  });

  const eventFilterOptions = useMemo(
    () => [
      { value: '', label: '全部事件' },
      ...eventTypes.map((e) => codeHintSelectOption(e.code, e.name, e.code)),
    ],
    [eventTypes],
  );

  const filteredItems = useMemo(() => {
    if (!eventFilter) {
      return items;
    }
    return items.filter((item) => item.eventTypeCode === eventFilter);
  }, [eventFilter, items]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [queryKey] });
  };

  const echoErrors = (err: ApiError, fallback: string) => {
    const fields = toFieldErrors(err);
    const formErrors = Object.entries(fields).map(([name, msg]) => ({ name, errors: [msg] }));
    if (formErrors.length > 0) {
      form.setFields(formErrors);
    } else {
      message.error(err.message ?? fallback);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const body = parseJsonFields(values, extraFields, form);
      if (body == null) {
        throw new Error('JSON 校验失败');
      }
      if (editingId != null && update) {
        return update(editingId, body);
      }
      return create(body);
    },
    onSuccess: () => {
      message.success(editingId != null ? `${title}已更新` : `${title}已创建`);
      setModalOpen(false);
      setEditingId(null);
      form.resetFields();
      invalidate();
    },
    onError: (err: ApiError) => echoErrors(err, editingId != null ? '更新失败' : '创建失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number | string) => remove!(id),
    onSuccess: () => {
      message.success('已删除');
      setDetailOpen(false);
      setDetailItem(null);
      invalidate();
    },
    onError: (err: ApiError) => message.error(err.message ?? '删除失败'),
  });

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    if (eventFilter) {
      form.setFieldValue('eventTypeCode', eventFilter);
    }
    setModalOpen(true);
  };

  const openEdit = async (record: DecisionToolItem) => {
    if (!get || record.id == null) {
      return;
    }
    setEditingId(record.id);
    setModalOpen(true);
    form.resetFields();
    try {
      const detail = await get(record.id);
      form.setFieldsValue(itemToFormValues(detail, extraFields));
    } catch (err) {
      const apiErr = err as ApiError;
      message.error(apiErr.message ?? '加载详情失败');
      setModalOpen(false);
      setEditingId(null);
    }
  };

  const openDetail = async (record: DecisionToolItem) => {
    if (!get || record.id == null) {
      return;
    }
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailItem(null);
    try {
      setDetailItem(await get(record.id));
    } catch (err) {
      const apiErr = err as ApiError;
      message.error(apiErr.message ?? '加载详情失败');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ColumnsType<DecisionToolItem> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 72 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '事件类型', dataIndex: 'eventTypeCode', key: 'eventTypeCode', width: 140 },
    ...extraColumns,
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s?: string) => statusTag(s),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size={0}>
          {get ? (
            <Button type="link" size="small" onClick={() => openDetail(record)}>
              详情
            </Button>
          ) : null}
          {update ? (
            <Button type="link" size="small" onClick={() => openEdit(record)}>
              编辑
            </Button>
          ) : null}
          {remove && record.id != null ? (
            <Popconfirm title={`确认删除该${title}？`} onConfirm={() => deleteMutation.mutate(record.id!)}>
              <Button type="link" size="small" danger loading={deleteMutation.isPending}>
                删除
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  const modalFields = extraFields.filter((f) => !(editingId != null && f.editHidden));

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 12,
          gap: 12,
        }}
      >
        <Text strong style={{ fontSize: 16 }}>
          {title}
        </Text>
        <div style={{ flex: 1 }} />
        <Select
          allowClear
          showSearch
          placeholder="筛选事件类型"
          style={{ width: 220 }}
          value={eventFilter ?? ''}
          options={eventFilterOptions}
          onChange={(value) => setEventFilter(value || undefined)}
        />
        <Button type="primary" onClick={openCreate}>
          新建{title}
        </Button>
      </div>
      {hint ? (
        <Paragraph type="secondary" style={{ marginTop: -4, marginBottom: 12 }}>
          {hint}
        </Paragraph>
      ) : null}
      <Table
        rowKey={(r) => String(r.id ?? r.name)}
        loading={isLoading}
        columns={columns}
        dataSource={filteredItems}
        locale={{ emptyText: `暂无${title}` }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />

        <Modal
          title={editingId != null ? `编辑${title}` : `新建${title}`}
          open={modalOpen}
          onOk={() => form.submit()}
          confirmLoading={saveMutation.isPending}
          onCancel={() => {
            setModalOpen(false);
            setEditingId(null);
          }}
          width={720}
          destroyOnClose
        >
          <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
            <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
              <Input placeholder={`${title}名称`} />
            </Form.Item>
            {editingId == null ? (
              <Form.Item
                label="关联事件类型"
                name="eventTypeCode"
                rules={[{ required: true, message: '请选择事件类型' }]}
              >
                <Select
                  showSearch
                  placeholder="选择事件类型"
                  options={eventTypes.map((e) => codeHintSelectOption(e.code, e.name, e.code))}
                />
              </Form.Item>
            ) : (
              <Form.Item name="eventTypeCode" hidden>
                <Input />
              </Form.Item>
            )}
            {editingId != null ? (
              <Form.Item label="状态" name="status">
                <Select
                  options={[
                    { value: 'ENABLED', label: '启用（ENABLED）' },
                    { value: 'DISABLED', label: '停用（DISABLED）' },
                  ]}
                />
              </Form.Item>
            ) : null}
            {modalFields.map((f) => (
              <Form.Item
                key={f.name}
                label={f.label}
                name={f.name}
                rules={f.required ? [{ required: true, message: `请填写${f.label}` }] : []}
              >
                {f.type === 'select' ? (
                  <Select options={f.options} placeholder={f.placeholder} />
                ) : f.type === 'textarea' ? (
                  <Input.TextArea rows={8} placeholder={f.placeholder} style={{ fontFamily: 'monospace' }} />
                ) : (
                  <Input placeholder={f.placeholder} />
                )}
              </Form.Item>
            ))}
          </Form>
        </Modal>

        <Drawer
          title={detailItem?.name ?? `${title}详情`}
          open={detailOpen}
          width={640}
          onClose={() => setDetailOpen(false)}
          extra={
            detailItem && update ? (
              <Space>
                <Button onClick={() => openEdit(detailItem)}>编辑</Button>
                {remove && detailItem.id != null ? (
                  <Popconfirm title={`确认删除该${title}？`} onConfirm={() => deleteMutation.mutate(detailItem.id!)}>
                    <Button danger loading={deleteMutation.isPending}>
                      删除
                    </Button>
                  </Popconfirm>
                ) : null}
              </Space>
            ) : null
          }
        >
          {detailLoading ? (
            <Spin />
          ) : detailItem ? (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div>
                <Text type="secondary">事件类型：</Text>
                <Text>{detailItem.eventTypeCode}</Text>
              </div>
              <div>
                <Text type="secondary">状态：</Text>
                {statusTag(detailItem.status)}
              </div>
              <Input.TextArea
                readOnly
                rows={22}
                value={JSON.stringify(detailItem, null, 2)}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            </Space>
          ) : null}
        </Drawer>
    </div>
  );
}
