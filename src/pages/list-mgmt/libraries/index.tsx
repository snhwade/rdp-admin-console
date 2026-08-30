import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Layout,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  batchSetListEntriesEnabled,
  createListEntry,
  createListLibrary,
  deleteListEntries,
  deleteListLibrary,
  listAttrDefs,
  listDimensions,
  listEntries,
  listLibraries,
  listLibraryImportAudits,
  listLibraryReferences,
  syncListLibrary,
  updateListEntry,
  updateListLibrary,
  type ListEntryView,
  type ListLibraryView,
} from '@/api/listMgmt';
import { type ApiError } from '@/api/client';

const { Sider, Content } = Layout;
const { Text } = Typography;

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: '人工添加',
  IMPORT: '批量导入',
  API: '接口同步',
};

export default function ListLibraryPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [libraryKeyword, setLibraryKeyword] = useState('');
  const [entryKeyword, setEntryKeyword] = useState('');
  const [selectedLibrary, setSelectedLibrary] = useState<ListLibraryView | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<(number | string)[]>([]);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null);
  const [libraryForm] = Form.useForm();
  const [entryForm] = Form.useForm();

  const { data: libraries = [], isLoading: librariesLoading } = useQuery({
    queryKey: ['list-libraries', libraryKeyword],
    queryFn: () => listLibraries(libraryKeyword || undefined),
  });

  const { data: dimensions = [] } = useQuery({
    queryKey: ['list-dimensions'],
    queryFn: () => listDimensions(),
  });

  const { data: attrDefs = [] } = useQuery({
    queryKey: ['list-attr-defs'],
    queryFn: () => listAttrDefs(),
  });

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['list-entries', selectedLibrary?.id, entryKeyword],
    queryFn: () =>
      listEntries({
        libraryId: selectedLibrary!.id,
        keyword: entryKeyword || undefined,
      }),
    enabled: selectedLibrary != null,
  });

  const { data: references = [] } = useQuery({
    queryKey: ['list-library-refs', selectedLibrary?.id],
    queryFn: () => listLibraryReferences(selectedLibrary!.id),
    enabled: selectedLibrary != null,
  });

  const { data: importAudits = [] } = useQuery({
    queryKey: ['list-import-audits', selectedLibrary?.id],
    queryFn: () => listLibraryImportAudits(selectedLibrary!.id, 10),
    enabled: selectedLibrary != null,
  });

  // Deep link: /list-libraries?libraryId=&highlightEntryId=
  useEffect(() => {
    const libId = searchParams.get('libraryId');
    const entryId = searchParams.get('highlightEntryId');
    if (!libId || libraries.length === 0) return;
    const lib = libraries.find((l) => String(l.id) === String(libId));
    if (lib) {
      setSelectedLibrary(lib);
      if (entryId) setHighlightEntryId(String(entryId));
    }
  }, [libraries, searchParams]);

  useEffect(() => {
    if (!highlightEntryId || entries.length === 0) return;
    const el = document.getElementById(`list-entry-row-${highlightEntryId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightEntryId, entries]);

  const dimensionOptions = useMemo(
    () => dimensions.map((d) => ({ value: d.code, label: `${d.name} (${d.code})` })),
    [dimensions],
  );

  const dimensionNameMap = useMemo(() => {
    const m = new Map<string, string>();
    dimensions.forEach((d) => m.set(d.code, d.name));
    return m;
  }, [dimensions]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['list-libraries'] });
    queryClient.invalidateQueries({ queryKey: ['list-entries'] });
    queryClient.invalidateQueries({ queryKey: ['list-library-refs'] });
    queryClient.invalidateQueries({ queryKey: ['list-import-audits'] });
  };

  const createLibraryMutation = useMutation({
    mutationFn: createListLibrary,
    onSuccess: () => {
      message.success('名单库已创建');
      setLibraryModalOpen(false);
      libraryForm.resetFields();
      invalidateAll();
    },
    onError: (err: ApiError) => message.error(err.message ?? '创建失败'),
  });

  const deleteLibraryMutation = useMutation({
    mutationFn: deleteListLibrary,
    onSuccess: () => {
      message.success('名单库已删除');
      setSelectedLibrary(null);
      setSearchParams({});
      invalidateAll();
    },
    onError: (err: ApiError) => message.error(err.message ?? '删除失败'),
  });

  const toggleLibraryMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number | string; enabled: boolean }) =>
      updateListLibrary(id, { enabled }),
    onSuccess: (lib) => {
      message.success(lib.enabled ? '名单库已启用' : '名单库已停用');
      setSelectedLibrary(lib);
      invalidateAll();
    },
    onError: (err: ApiError) => message.error(err.message ?? '更新失败'),
  });

  const syncMutation = useMutation({
    mutationFn: (id: number | string) => syncListLibrary(id, { source: 'EXTERNAL_STUB' }),
    onSuccess: (r) => {
      message.info(r.message || '已记录同步审计');
      queryClient.invalidateQueries({ queryKey: ['list-import-audits'] });
    },
    onError: (err: ApiError) => message.error(err.message ?? '同步失败'),
  });

  const createEntryMutation = useMutation({
    mutationFn: createListEntry,
    onSuccess: () => {
      message.success('名单记录已添加');
      setEntryModalOpen(false);
      entryForm.resetFields();
      invalidateAll();
    },
    onError: (err: ApiError) => message.error(err.message ?? '添加失败'),
  });

  const toggleEntryMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number | string; enabled: boolean }) =>
      updateListEntry(id, { enabled }),
    onSuccess: () => {
      message.success('状态已更新');
      invalidateAll();
    },
    onError: (err: ApiError) => message.error(err.message ?? '更新失败'),
  });

  const batchEnableMutation = useMutation({
    mutationFn: ({ ids, enabled }: { ids: (number | string)[]; enabled: boolean }) =>
      batchSetListEntriesEnabled(ids, enabled),
    onSuccess: () => {
      message.success('批量操作成功');
      setSelectedRowKeys([]);
      invalidateAll();
    },
    onError: (err: ApiError) => message.error(err.message ?? '操作失败'),
  });

  const deleteEntriesMutation = useMutation({
    mutationFn: deleteListEntries,
    onSuccess: () => {
      message.success('已删除');
      setSelectedRowKeys([]);
      invalidateAll();
    },
    onError: (err: ApiError) => message.error(err.message ?? '删除失败'),
  });

  const entryColumns: ColumnsType<ListEntryView> = [
    {
      title: '主维度值',
      dataIndex: 'dimensionValue',
      key: 'dimensionValue',
      ellipsis: true,
    },
    {
      title: '主维度',
      dataIndex: 'dimensionCode',
      key: 'dimensionCode',
      width: 120,
      render: (code: string) => dimensionNameMap.get(code) ?? code,
    },
    {
      title: '状态',
      key: 'enabled',
      width: 90,
      render: (_, row) => (
        <Tag color={row.enabled ? 'blue' : 'default'}>{row.enabled ? '启用' : '停用'}</Tag>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (s?: string) => SOURCE_LABEL[s ?? 'MANUAL'] ?? s,
    },
    {
      title: '生效时间',
      dataIndex: 'effectiveAt',
      key: 'effectiveAt',
      width: 160,
      render: (v?: string | null) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: '失效时间',
      dataIndex: 'expireAt',
      key: 'expireAt',
      width: 160,
      render: (v?: string | null) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '长期'),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 160,
      ellipsis: true,
      render: (v?: string | null) => v || '—',
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, row) => (
        <Switch
          checked={row.enabled}
          checkedChildren="启用"
          unCheckedChildren="停用"
          loading={toggleEntryMutation.isPending}
          onChange={(checked) => toggleEntryMutation.mutate({ id: row.id, enabled: checked })}
        />
      ),
    },
  ];

  const handleCreateEntry = (values: Record<string, unknown>) => {
    if (!selectedLibrary) return;
    const effectiveAt = values.effectiveAt
      ? (values.effectiveAt as dayjs.Dayjs).format('YYYY-MM-DDTHH:mm:ss')
      : null;
    const expireAt = values.expireAt
      ? (values.expireAt as dayjs.Dayjs).format('YYYY-MM-DDTHH:mm:ss')
      : null;
    const extraAttrs: Record<string, unknown> = {};
    attrDefs.forEach((attr) => {
      const v = values[`attr_${attr.code}`];
      if (v != null && v !== '') extraAttrs[attr.code] = v;
    });
    createEntryMutation.mutate({
      libraryId: selectedLibrary.id,
      dimensionCode: values.dimensionCode as string,
      dimensionValue: values.dimensionValue as string,
      effectiveAt,
      expireAt,
      remark: (values.remark as string)?.trim() || null,
      extraAttrs: Object.keys(extraAttrs).length > 0 ? extraAttrs : undefined,
    });
  };

  const selectLibrary = (lib: ListLibraryView) => {
    setSelectedLibrary(lib);
    setSelectedRowKeys([]);
    setHighlightEntryId(null);
    setSearchParams({ libraryId: String(lib.id) });
  };

  return (
    <Layout style={{ background: 'transparent', minHeight: 560 }}>
      <Sider
        width={280}
        theme="light"
        style={{ background: '#fff', marginRight: 16, padding: 12, borderRadius: 8 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text strong>名单库</Text>
            <Button type="text" icon={<PlusOutlined />} onClick={() => setLibraryModalOpen(true)} />
          </Space>
          <Input.Search
            allowClear
            placeholder="请输入名单名称"
            value={libraryKeyword}
            onChange={(e) => setLibraryKeyword(e.target.value)}
          />
          {librariesLoading ? (
            <Text type="secondary">加载中…</Text>
          ) : libraries.length === 0 ? (
            <Empty description="暂无名单库" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            libraries.map((lib) => (
              <Card
                key={lib.id}
                size="small"
                hoverable
                style={{
                  borderColor: selectedLibrary?.id === lib.id ? '#1677ff' : undefined,
                  cursor: 'pointer',
                }}
                onClick={() => selectLibrary(lib)}
              >
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Text strong ellipsis>
                      {lib.name}
                    </Text>
                    {!lib.enabled && <Tag>停用</Tag>}
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {lib.code} · 共 {lib.entryCount} / 启用 {lib.enabledCount ?? '—'}
                    {lib.expiringSoon != null && lib.expiringSoon > 0
                      ? ` · 将失效 ${lib.expiringSoon}`
                      : ''}
                  </Text>
                  {lib.remark ? (
                    <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                      {lib.remark}
                    </Text>
                  ) : null}
                </Space>
              </Card>
            ))
          )}
        </Space>
      </Sider>

      <Content>
        <Card
          title={selectedLibrary ? selectedLibrary.name : '名单库记录'}
          extra={
            selectedLibrary ? (
              <Space wrap>
                <Input.Search
                  allowClear
                  placeholder="请输入主/子维度值"
                  style={{ width: 200 }}
                  value={entryKeyword}
                  onChange={(e) => setEntryKeyword(e.target.value)}
                />
                <Button type="primary" onClick={() => setEntryModalOpen(true)}>
                  新增名单记录
                </Button>
                <Button
                  loading={syncMutation.isPending}
                  onClick={() => syncMutation.mutate(selectedLibrary.id)}
                >
                  同步占位
                </Button>
                <Switch
                  checked={selectedLibrary.enabled}
                  checkedChildren="库启用"
                  unCheckedChildren="库停用"
                  loading={toggleLibraryMutation.isPending}
                  onChange={(checked) =>
                    toggleLibraryMutation.mutate({ id: selectedLibrary.id, enabled: checked })
                  }
                />
                <Popconfirm
                  title="确认删除该名单库？库内记录将一并删除"
                  onConfirm={() => deleteLibraryMutation.mutate(selectedLibrary.id)}
                >
                  <Button danger loading={deleteLibraryMutation.isPending}>
                    删除名单库
                  </Button>
                </Popconfirm>
              </Space>
            ) : null
          }
        >
          {!selectedLibrary ? (
            <Empty description="请从左侧选择或新建名单库" />
          ) : (
            <>
              <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }} size={8}>
                <Text type="secondary">
                  统计：总 {selectedLibrary.entryCount} · 启用 {selectedLibrary.enabledCount ?? '—'} ·
                  {selectedLibrary.expiringSoonDays ?? 7} 日内将失效{' '}
                  {selectedLibrary.expiringSoon ?? 0}
                  {selectedLibrary.remark ? ` · 备注：${selectedLibrary.remark}` : ''}
                </Text>
                {references.length > 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="引用门禁"
                    description={`该库被引用：${references.join('、')}。删除或停用将被阻断。`}
                  />
                ) : (
                  <Alert type="info" showIcon message="当前无规则包/决策流引用该名单库编码" />
                )}
                {importAudits.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    最近同步审计：
                    {importAudits
                      .slice(0, 3)
                      .map(
                        (a) =>
                          `${a.source}/${a.batchId ?? '-'}(${a.status}, ${a.entryCount}条)`,
                      )
                      .join('；')}
                  </Text>
                )}
              </Space>
              <Space style={{ marginBottom: 12 }}>
                <Button
                  disabled={selectedRowKeys.length === 0}
                  loading={batchEnableMutation.isPending}
                  onClick={() => batchEnableMutation.mutate({ ids: selectedRowKeys, enabled: true })}
                >
                  启用
                </Button>
                <Button
                  disabled={selectedRowKeys.length === 0}
                  loading={batchEnableMutation.isPending}
                  onClick={() => batchEnableMutation.mutate({ ids: selectedRowKeys, enabled: false })}
                >
                  停用
                </Button>
                <Popconfirm
                  title="确认删除所选记录？"
                  disabled={selectedRowKeys.length === 0}
                  onConfirm={() => deleteEntriesMutation.mutate(selectedRowKeys)}
                >
                  <Button danger disabled={selectedRowKeys.length === 0}>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
              <Table
                rowKey="id"
                loading={entriesLoading}
                columns={entryColumns}
                dataSource={entries}
                rowSelection={{
                  selectedRowKeys,
                  onChange: (keys) => setSelectedRowKeys(keys as (string | number)[]),
                }}
                onRow={(row) => ({
                  id: `list-entry-row-${row.id}`,
                  style:
                    highlightEntryId != null && String(row.id) === highlightEntryId
                      ? { background: '#fff7e6' }
                      : undefined,
                })}
                pagination={{ pageSize: 20, showSizeChanger: true }}
                locale={{ emptyText: '该名单库暂无记录，点击右上角新增' }}
                scroll={{ x: 1100 }}
              />
            </>
          )}
        </Card>
      </Content>

      <Modal
        title="新建名单库"
        open={libraryModalOpen}
        onOk={() => libraryForm.submit()}
        confirmLoading={createLibraryMutation.isPending}
        onCancel={() => setLibraryModalOpen(false)}
        destroyOnClose
      >
        <Form
          form={libraryForm}
          layout="vertical"
          onFinish={(v) => createLibraryMutation.mutate(v)}
        >
          <Form.Item label="名单库编码" name="code" rules={[{ required: true, message: '请输入编码' }]}>
            <Input placeholder="如 service_trade_industry" />
          </Form.Item>
          <Form.Item label="名单库名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如 服贸行业名单" />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} placeholder="人工说明，列表靠右展示" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新增名单记录"
        open={entryModalOpen}
        onOk={() => entryForm.submit()}
        confirmLoading={createEntryMutation.isPending}
        onCancel={() => setEntryModalOpen(false)}
        destroyOnClose
        width={560}
      >
        <Form form={entryForm} layout="vertical" onFinish={handleCreateEntry}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="主维度"
                name="dimensionCode"
                rules={[{ required: true, message: '请选择维度' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={dimensionOptions}
                  placeholder="选择维度字段"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="主维度值"
                name="dimensionValue"
                rules={[{ required: true, message: '请输入维度值' }]}
              >
                <Input placeholder="维度对应的值" />
              </Form.Item>
            </Col>
          </Row>
          {attrDefs.map((attr) => (
            <Form.Item key={attr.code} label={attr.name} name={`attr_${attr.code}`}>
              <Input placeholder={`附加属性：${attr.code}`} />
            </Form.Item>
          ))}
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
