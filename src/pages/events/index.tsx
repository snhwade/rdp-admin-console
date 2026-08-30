import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Layout,
  Modal,
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
import {
  createEvent,
  createScenario,
  deleteEvent,
  getEventEngineStatus,
  importEvents,
  listEvents,
  listScenarioTree,
  updateEvent,
  type CreateEventBody,
  type EventKind,
  type EventPurpose,
  type EventView,
  type ImportEventsResult,
  type ScenarioTreeNode,
} from '@/api/console';
import ScenarioEventTreePanel from '@/components/ScenarioEventTreePanel';
import { codeHintSelectOption } from '@/components/CodeHintLabel';
import { toFieldErrors, type ApiError } from '@/api/client';

/**
 * 事件管理页（risk-console-redesign R2.1 / R2.11）。
 *
 * 布局：左侧「业务场景 → 事件」树（listScenarioTree），右侧所选场景下事件表格
 * （业务场景 / 事件代码 / 事件名称 / 事件用途 / 事件类型分型 / 操作）。
 *
 * 能力：
 * - 创建 / 编辑事件（code、name、所属场景、用途多选 COMPUTE/DECISION、分型二选一 DIMENSION/FACT）。
 * - 删除事件（存在关联依赖时后端拒绝，错误提示透传）。
 * - 批量导入事件（JSON 数组，逐条校验，展示成功/失败明细）。
 * - 引擎可执行状态展示（getEventEngineStatus，R2.11）。
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

/** 事件类型分型选项。 */
const EVENT_KIND_OPTIONS: { label: string; value: EventKind }[] = [
  { label: '维度表（DIMENSION）', value: 'DIMENSION' },
  { label: '事实表（FACT）', value: 'FACT' },
];

/** 用途中文展示。 */
function purposeLabel(p: EventPurpose): string {
  if (p === 'COMPUTE') return '计算';
  if (p === 'DECISION') return '决策';
  return String(p);
}

/** 事件类型分型中文展示。 */
function eventKindLabel(k: EventKind | null): string {
  if (k === 'DIMENSION') return '维度表';
  if (k === 'FACT') return '事实表';
  return k ? String(k) : '-';
}

/** 引擎状态中文与颜色映射（R2.11）。 */
function engineStatusMeta(status: string): { label: string; color: string } {
  if (status === 'EXECUTABLE') return { label: '可执行', color: 'green' };
  if (status === 'NOT_EXECUTABLE') return { label: '不可执行', color: 'orange' };
  return { label: '未知 / 引擎不可达', color: 'default' };
}

interface EventFormValues {
  code: string;
  name: string;
  scenarioId: number | string;
  purposes: EventPurpose[];
  eventKind: EventKind;
}

export default function EventsPage() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm<EventFormValues>();

  const [selectedScenarioId, setSelectedScenarioId] = useState<number | string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EventView | null>(null);

  // 批量导入弹窗
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<ImportEventsResult | null>(null);

  // 引擎状态弹窗
  const [engineOpen, setEngineOpen] = useState(false);
  const [engineTarget, setEngineTarget] = useState<EventView | null>(null);

  // 新建场景弹窗
  const [scenarioModalOpen, setScenarioModalOpen] = useState(false);
  const [scenarioForm] = Form.useForm<{ code: string; name: string }>();

  // 场景 → 事件 树
  const { data: scenarioTree = [], isLoading: treeLoading } = useQuery({
    queryKey: ['scenario-tree'],
    queryFn: listScenarioTree,
  });

  // 默认选中第一个场景
  useEffect(() => {
    if (selectedScenarioId == null && scenarioTree.length > 0) {
      setSelectedScenarioId(scenarioTree[0].id);
    }
  }, [scenarioTree, selectedScenarioId]);

  // 所选场景下的事件列表
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events', selectedScenarioId],
    queryFn: () => listEvents(selectedScenarioId ?? undefined),
    enabled: selectedScenarioId != null,
  });

  // 场景下拉选项（表单用）
  const scenarioOptions = useMemo(
    () => scenarioTree.map((s: ScenarioTreeNode) => codeHintSelectOption(s.id, s.name, s.code)),
    [scenarioTree],
  );

  const scenarioNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of scenarioTree) {
      map.set(String(s.id), s.name);
    }
    return map;
  }, [scenarioTree]);

  // 表单回填 / 重置
  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    if (editing) {
      form.setFieldsValue({
        code: editing.code,
        name: editing.name,
        scenarioId: editing.scenarioId ?? undefined,
        purposes: editing.purposes ?? [],
        eventKind: (editing.eventKind ?? undefined) as EventKind,
      });
    } else {
      form.resetFields();
      if (selectedScenarioId != null) {
        form.setFieldsValue({ scenarioId: selectedScenarioId });
      }
    }
  }, [modalOpen, editing, form, selectedScenarioId]);

  /** 字段级错误回显到表单项并保留用户输入。 */
  const echoFieldErrors = (err: ApiError, fallback: string) => {
    const fields = toFieldErrors(err);
    const formErrors = Object.entries(fields).map(([name, msg]) => ({
      name: name as keyof EventFormValues,
      errors: [msg],
    }));
    if (formErrors.length > 0) {
      form.setFields(formErrors);
    } else {
      message.error(err.message ?? fallback);
    }
  };

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      message.success('事件创建成功');
      closeModal();
      invalidate();
    },
    onError: (err: ApiError) => echoFieldErrors(err, '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number | string; body: Omit<CreateEventBody, 'code'> }) =>
      updateEvent(id, body),
    onSuccess: () => {
      message.success('事件已更新');
      closeModal();
      invalidate();
    },
    onError: (err: ApiError) => echoFieldErrors(err, '更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number | string) => deleteEvent(id),
    onSuccess: () => {
      message.success('事件已删除');
      invalidate();
    },
    onError: (err: ApiError) => message.error(err.message ?? '删除失败'),
  });

  const importMutation = useMutation({
    mutationFn: (items: CreateEventBody[]) => importEvents(items),
    onSuccess: (result) => {
      setImportResult(result);
      message.success(`导入完成：成功 ${result.successCount} 条，失败 ${result.failureCount} 条`);
      invalidate();
    },
    onError: (err: ApiError) => message.error(err.message ?? '导入失败'),
  });

  const createScenarioMutation = useMutation({
    mutationFn: (body: { code: string; name: string }) => createScenario(body),
    onSuccess: (created) => {
      message.success('业务场景创建成功');
      setScenarioModalOpen(false);
      scenarioForm.resetFields();
      // 新建场景后刷新场景树，并选中新场景便于直接新建事件
      queryClient.invalidateQueries({ queryKey: ['scenario-tree'] }).then(() => {
        if (created?.id != null) {
          setSelectedScenarioId(created.id);
        }
      });
    },
    onError: (err: ApiError) => {
      const fields = toFieldErrors(err);
      const formErrors = Object.entries(fields).map(([name, msg]) => ({
        name: name as 'code' | 'name',
        errors: [msg],
      }));
      if (formErrors.length > 0) {
        scenarioForm.setFields(formErrors);
      } else {
        message.error(err.message ?? '场景创建失败');
      }
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['scenario-tree'] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (row: EventView) => {
    setEditing(row);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const handleSubmit = (values: EventFormValues) => {
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        body: {
          name: values.name,
          scenarioId: values.scenarioId,
          purposes: values.purposes,
          eventKind: values.eventKind,
        },
      });
    } else {
      createMutation.mutate({
        code: values.code,
        name: values.name,
        scenarioId: values.scenarioId,
        purposes: values.purposes,
        eventKind: values.eventKind,
      });
    }
  };

  const handleDelete = (row: EventView) => {
    Modal.confirm({
      title: `删除事件「${row.name}」？`,
      content: '若该事件下存在关联的事件字段、规则包、决策流或评级模型，删除将被拒绝。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => deleteMutation.mutateAsync(row.id),
    });
  };

  // 引擎状态查询（按需触发）
  const { data: engineStatus, isFetching: engineLoading } = useQuery({
    queryKey: ['event-engine-status', engineTarget?.id],
    queryFn: () => getEventEngineStatus(engineTarget!.id),
    enabled: engineOpen && engineTarget != null,
  });

  const openEngineStatus = (row: EventView) => {
    setEngineTarget(row);
    setEngineOpen(true);
  };

  const runImport = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      message.error('导入内容不是合法 JSON');
      return;
    }
    if (!Array.isArray(parsed)) {
      message.error('导入内容应为事件数组');
      return;
    }
    setImportResult(null);
    importMutation.mutate(parsed as CreateEventBody[]);
  };

  const downloadImportTemplate = () => {
    const template = JSON.stringify(
      [
        {
          code: 'PAY_ORDER',
          name: '支付下单',
          scenarioId: selectedScenarioId ?? 1,
          purposes: ['COMPUTE', 'DECISION'],
          eventKind: 'FACT',
        },
      ],
      null,
      2,
    );
    const blob = new Blob([template], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'events-import-template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnsType<EventView> = [
    { title: '事件代码', dataIndex: 'code', key: 'code' },
    { title: '事件名称', dataIndex: 'name', key: 'name' },
    {
      title: '业务场景',
      key: 'scenario',
      render: (_, row) => scenarioNameById.get(String(row.scenarioId)) ?? '-',
    },
    {
      title: '事件用途',
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
      title: '事件类型分型',
      dataIndex: 'eventKind',
      key: 'eventKind',
      render: (kind: EventKind | null) => <Tag>{eventKindLabel(kind)}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      render: (_, row) => (
        <Space size="middle">
          <Button type="link" size="small" onClick={() => openEdit(row)}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => openEngineStatus(row)}>
            引擎状态
          </Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(row)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const isEdit = editing !== null;

  return (
    <Layout style={{ background: 'transparent' }}>
      <Sider width={300} theme="light" style={{ background: '#fff', marginRight: 16, padding: 12 }}>
        <ScenarioEventTreePanel
          tree={scenarioTree}
          loading={treeLoading}
          scenarioSelectable
          selectedScenarioKey={
            selectedScenarioId != null ? `scenario:${selectedScenarioId}` : null
          }
          onSelectScenario={(id) => setSelectedScenarioId(id)}
          onSelectEvent={(scenarioId) => setSelectedScenarioId(scenarioId)}
        />
      </Sider>
      <Content>
        <Card
          title="事件管理"
          extra={
            <Space>
              <Button onClick={() => { scenarioForm.resetFields(); setScenarioModalOpen(true); }}>
                新建场景
              </Button>
              <Button onClick={() => { setImportResult(null); setImportText(''); setImportOpen(true); }}>
                批量导入
              </Button>
              <Button type="primary" onClick={openCreate} disabled={scenarioOptions.length === 0}>
                新建事件
              </Button>
            </Space>
          }
        >
          <Table
            rowKey="id"
            loading={eventsLoading}
            columns={columns}
            dataSource={events}
            locale={{ emptyText: selectedScenarioId == null ? '请选择左侧业务场景' : '该场景下暂无事件' }}
          />
        </Card>
      </Content>

      {/* 创建 / 编辑事件 */}
      <Modal
        title={isEdit ? '编辑事件' : '新建事件'}
        open={modalOpen}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        onCancel={closeModal}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="事件代码"
            name="code"
            tooltip={isEdit ? '事件代码为唯一业务主键，创建后不可修改' : '同一范围内不可重复'}
            rules={[
              { required: true, message: '请输入事件代码' },
              { max: 64, message: '事件代码长度不超过 64' },
              { pattern: /^[A-Za-z0-9_]+$/, message: '事件代码仅允许字母数字下划线' },
            ]}
          >
            <Input placeholder="如 PAY_ORDER" disabled={isEdit} />
          </Form.Item>
          <Form.Item
            label="事件名称"
            name="name"
            rules={[
              { required: true, message: '请输入事件名称' },
              { max: 100, message: '事件名称长度不超过 100' },
            ]}
          >
            <Input placeholder="如 支付下单" />
          </Form.Item>
          <Form.Item
            label="所属业务场景"
            name="scenarioId"
            rules={[{ required: true, message: '请选择所属业务场景' }]}
          >
            <Select
              placeholder="选择业务场景"
              options={scenarioOptions}
              optionFilterProp="label"
              showSearch
            />
          </Form.Item>
          <Form.Item
            label="事件用途"
            name="purposes"
            tooltip="可多选，至少选择一个"
            rules={[{ required: true, message: '请至少选择一个事件用途' }]}
          >
            <Select mode="multiple" placeholder="选择事件用途" options={PURPOSE_OPTIONS} />
          </Form.Item>
          <Form.Item
            label="事件类型分型"
            name="eventKind"
            rules={[{ required: true, message: '请选择事件类型分型' }]}
          >
            <Select placeholder="维度表 / 事实表" options={EVENT_KIND_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新建业务场景 */}
      <Modal
        title="新建业务场景"
        open={scenarioModalOpen}
        onOk={() => scenarioForm.submit()}
        confirmLoading={createScenarioMutation.isPending}
        onCancel={() => setScenarioModalOpen(false)}
        forceRender
      >
        <Form
          form={scenarioForm}
          layout="vertical"
          onFinish={(values) => createScenarioMutation.mutate(values)}
        >
          <Form.Item
            label="场景代码"
            name="code"
            rules={[
              { required: true, message: '请输入场景代码' },
              { max: 64, message: '场景代码长度不超过 64' },
              { pattern: /^[A-Za-z0-9_]+$/, message: '场景代码仅允许字母数字下划线' },
            ]}
          >
            <Input placeholder="如 SCN_PAYMENT" />
          </Form.Item>
          <Form.Item
            label="场景名称"
            name="name"
            rules={[
              { required: true, message: '请输入场景名称' },
              { max: 100, message: '场景名称长度不超过 100' },
            ]}
          >
            <Input placeholder="如 支付收单" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量导入 */}
      <Modal
        title="批量导入事件"
        open={importOpen}
        width={680}
        onOk={runImport}
        okText="开始导入"
        confirmLoading={importMutation.isPending}
        onCancel={() => setImportOpen(false)}
      >
        <Text type="secondary">
          粘贴事件 JSON 数组，逐条校验后导入。字段：code、name、scenarioId、purposes（数组）、eventKind。
        </Text>
        <div style={{ marginTop: 8 }}>
          <Button size="small" onClick={downloadImportTemplate}>下载导入模板</Button>
        </div>
        <Input.TextArea
          rows={8}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder={
            '[\n  {"code":"PAY_ORDER","name":"支付下单","scenarioId":1,"purposes":["COMPUTE","DECISION"],"eventKind":"FACT"}\n]'
          }
          style={{ marginTop: 12, fontFamily: 'monospace' }}
        />
        {importResult && (
          <div style={{ marginTop: 16 }}>
            <Space style={{ marginBottom: 8 }}>
              <Tag color="green">成功 {importResult.successCount}</Tag>
              <Tag color="red">失败 {importResult.failureCount}</Tag>
            </Space>
            {importResult.failures.length > 0 && (
              <Table
                size="small"
                rowKey={(r) => `${r.index}-${r.code}`}
                pagination={false}
                dataSource={importResult.failures}
                columns={[
                  { title: '序号', dataIndex: 'index', key: 'index', width: 64 },
                  { title: '事件代码', dataIndex: 'code', key: 'code' },
                  { title: '失败原因', dataIndex: 'reason', key: 'reason' },
                ]}
              />
            )}
          </div>
        )}
      </Modal>

      {/* 引擎状态 */}
      <Modal
        title={engineTarget ? `引擎可执行状态：${engineTarget.name}` : '引擎可执行状态'}
        open={engineOpen}
        footer={<Button onClick={() => setEngineOpen(false)}>关闭</Button>}
        onCancel={() => setEngineOpen(false)}
      >
        {engineLoading ? (
          <Spin />
        ) : engineStatus ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="事件代码">{engineTarget?.code}</Descriptions.Item>
            <Descriptions.Item label="引擎状态">
              {(() => {
                const meta = engineStatusMeta(engineStatus.engineStatus);
                return <Tag color={meta.color}>{meta.label}</Tag>;
              })()}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description="暂无引擎状态" />
        )}
      </Modal>
    </Layout>
  );
}
