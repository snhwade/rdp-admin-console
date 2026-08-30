import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDecisionFlow,
  listDecisionFlows,
  listDecisionFlowVersions,
  listScenarioTree,
  offlineDecisionFlow,
  onlineDecisionFlowVersion,
  rollbackDecisionFlowLastOnline,
  type CreateDecisionFlowBody,
  type DecisionFlowCardView,
  type DecisionFlowStatus,
  type DecisionFlowVersionView,
  type ScenarioTreeNode,
} from '@/api/console';
import { toFieldErrors, type ApiError } from '@/api/client';
import { buildEventSelectOptions, resolveEventPath } from '@/utils/scenarioEventDisplay';
import FlowCanvasEditor, { type FlowCanvasEditorHandle } from './FlowCanvasEditor';

/**
 * 决策流卡片墙与版本历史页（risk-console-redesign R8.1 / R8.3 / R8.5 / R8.8）。
 *
 * 布局：
 * - 全宽决策流卡片墙：卡片展示名称、归属、事件路径、状态（已上线 / 已下线，R8.1），
 *   顶部提供搜索、状态筛选、视图切换与「添加决策流」入口（R8.1）。
 * - 进入决策流详情 → 「运行区 / 编辑区」双页签（R8.3）：运行区只读展示当前上线版本流程图，
 *   编辑区提供可编辑画布占位（完整画布拖拽编排见任务 12.4）。
 * - 版本历史页：展示全部版本及版本号与状态，支持上线 / 下线切换（R8.5 / R8.6 / R8.7）。
 *
 * 命名中性化（R1）：本页仅从 `@/api/console` import 中性 API，不引用旧版共享 API 模块。
 */

const { Text } = Typography;

/** 决策流状态展示元数据。 */
const FLOW_STATUS_META: Record<string, { label: string; color: string }> = {
  ONLINE: { label: '已上线', color: 'green' },
  OFFLINE: { label: '已下线', color: 'default' },
};

function flowStatusTag(status: DecisionFlowStatus) {
  const meta = FLOW_STATUS_META[String(status)] ?? { label: String(status), color: 'default' };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

interface CreateFlowFormValues {
  name: string;
  eventCode: string;
  remark?: string;
}

export default function DecisionFlowWallPage() {
  const queryClient = useQueryClient();
  const [createForm] = Form.useForm<CreateFlowFormValues>();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DecisionFlowStatus>('ALL');
  const [keyword, setKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);

  // 决策流详情（运行区 / 编辑区 + 版本历史）抽屉
  const [detailFlow, setDetailFlow] = useState<DecisionFlowCardView | null>(null);

  const { data: scenarioTree = [] } = useQuery({
    queryKey: ['scenario-tree'],
    queryFn: listScenarioTree,
  });

  const eventSelectOptions = useMemo(
    () => buildEventSelectOptions(scenarioTree as ScenarioTreeNode[]),
    [scenarioTree],
  );

  const { data: flows = [], isLoading: flowsLoading } = useQuery({
    queryKey: ['decision-flows'],
    queryFn: () => listDecisionFlows(),
  });

  const flowEventPath = (flow: DecisionFlowCardView) =>
    flow.eventPath ?? resolveEventPath(flow.eventTypeCode, scenarioTree as ScenarioTreeNode[]);

  const filteredFlows = useMemo(
    () =>
      flows.filter((f) => {
        const matchStatus = statusFilter === 'ALL' || String(f.status) === String(statusFilter);
        const kw = keyword.trim().toLowerCase();
        const matchKeyword =
          kw === '' ||
          f.name.toLowerCase().includes(kw) ||
          flowEventPath(f).toLowerCase().includes(kw);
        return matchStatus && matchKeyword;
      }),
    [flows, statusFilter, keyword, scenarioTree],
  );

  // 创建表单重置
  useEffect(() => {
    if (createOpen) {
      createForm.resetFields();
    }
  }, [createOpen, createForm]);

  const invalidateFlows = () => {
    queryClient.invalidateQueries({ queryKey: ['decision-flows'] });
  };

  const echoFieldErrors = (err: ApiError, fallback: string) => {
    const fieldErrors = toFieldErrors(err);
    const formErrors = Object.entries(fieldErrors).map(([name, msg]) => ({
      name: name as keyof CreateFlowFormValues,
      errors: [msg],
    }));
    if (formErrors.length > 0) {
      createForm.setFields(formErrors);
    } else {
      message.error(err.message ?? fallback);
    }
  };

  const createMutation = useMutation({
    mutationFn: (body: CreateDecisionFlowBody) => createDecisionFlow(body),
    onSuccess: () => {
      message.success('决策流创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      invalidateFlows();
    },
    onError: (err: ApiError) => echoFieldErrors(err, '创建失败'),
  });

  const offlineMutation = useMutation({
    mutationFn: (id: number | string) => offlineDecisionFlow(id),
    onSuccess: () => {
      message.success('决策流已下线');
      invalidateFlows();
      queryClient.invalidateQueries({ queryKey: ['decision-flow-versions', detailFlow?.id] });
    },
    onError: (err: ApiError) => message.error(err.message ?? '下线失败'),
  });

  const handleCreateSubmit = (values: CreateFlowFormValues) => {
    createMutation.mutate({
      name: values.name,
      eventCode: values.eventCode,
      remark: values.remark?.trim() || null,
    });
  };

  /** 卡片网格视图。 */
  const renderGrid = () => (
    <Row gutter={[16, 16]}>
      {filteredFlows.map((flow) => (
        <Col key={flow.id} xs={24} sm={12} lg={8} xxl={6}>
          <Card
            hoverable
            size="small"
            onClick={() => setDetailFlow(flow)}
            title={<Text strong>{flow.name}</Text>}
            extra={flowStatusTag(flow.status)}
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text type="secondary">归属：{flow.owner ?? '-'}</Text>
              <Text type="secondary">事件路径：{flowEventPath(flow)}</Text>
              {flow.remark?.trim() ? (
                <Text type="secondary" ellipsis>
                  备注：{flow.remark}
                </Text>
              ) : null}
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  );

  /** 列表视图。 */
  const listColumns: ColumnsType<DecisionFlowCardView> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '归属', dataIndex: 'owner', key: 'owner', render: (v?: string | null) => v ?? '-' },
    {
      title: '事件路径',
      dataIndex: 'eventPath',
      key: 'eventPath',
      render: (_v, flow) => flowEventPath(flow),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: DecisionFlowStatus) => flowStatusTag(s),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      render: (v?: string | null) => v?.trim() || '—',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, flow) => (
        <Button type="link" size="small" onClick={() => setDetailFlow(flow)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card
        title="决策流"
        extra={
          <Space wrap>
            <Input.Search
              allowClear
              placeholder="按名称或事件路径筛选"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 220 }}
            />
            <Segmented
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as 'ALL' | DecisionFlowStatus)}
              options={[
                { label: '全部', value: 'ALL' },
                { label: '已上线', value: 'ONLINE' },
                { label: '已下线', value: 'OFFLINE' },
              ]}
            />
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as 'grid' | 'list')}
              options={[
                { label: '网格', value: 'grid' },
                { label: '列表', value: 'list' },
              ]}
            />
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              添加决策流
            </Button>
          </Space>
        }
      >
        {flowsLoading ? (
          <Spin />
        ) : filteredFlows.length === 0 ? (
          <Empty description={keyword || statusFilter !== 'ALL' ? '无匹配的决策流' : '暂无决策流，点击右上角添加'} />
        ) : viewMode === 'grid' ? (
          renderGrid()
        ) : (
          <Table rowKey="id" columns={listColumns} dataSource={filteredFlows} pagination={false} />
        )}
      </Card>

      <Modal
        title="添加决策流"
        open={createOpen}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        onCancel={() => setCreateOpen(false)}
        forceRender
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateSubmit}>
          <Form.Item
            label="所属决策事件"
            name="eventCode"
            rules={[{ required: true, message: '请选择决策事件' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={eventSelectOptions}
              placeholder="选择业务场景 / 决策事件"
            />
          </Form.Item>
          <Form.Item
            label="决策流名称"
            name="name"
            rules={[
              { required: true, message: '请输入决策流名称' },
              { max: 100, message: '名称长度不超过 100' },
            ]}
          >
            <Input placeholder="如 实时交易决策流" />
          </Form.Item>
          <Form.Item label="备注" name="remark" tooltip="人工填写意图/适用场景，供协作阅读">
            <Input.TextArea rows={2} maxLength={512} showCount placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      <DecisionFlowDetailDrawer
        flow={detailFlow}
        editorDirty={editorDirty}
        onEditorDirtyChange={setEditorDirty}
        onClose={() => {
          setDetailFlow(null);
          setEditorDirty(false);
        }}
        onOffline={(id) => offlineMutation.mutate(id)}
        offlineLoading={offlineMutation.isPending}
      />
    </>
  );
}

/* =====================================================================================
 * 决策流详情抽屉：运行区 / 编辑区双页签 + 版本历史（R8.3 / R8.5 / R8.6 / R8.7）
 * ===================================================================================== */

interface DetailDrawerProps {
  flow: DecisionFlowCardView | null;
  editorDirty: boolean;
  onEditorDirtyChange: (dirty: boolean) => void;
  onClose: () => void;
  onOffline: (id: number | string) => void;
  offlineLoading: boolean;
}

function DecisionFlowDetailDrawer({
  flow,
  editorDirty,
  onEditorDirtyChange,
  onClose,
  onOffline,
  offlineLoading,
}: DetailDrawerProps) {
  const queryClient = useQueryClient();
  const editorRef = useRef<FlowCanvasEditorHandle>(null);
  const [activeTab, setActiveTab] = useState('editor');

  useEffect(() => {
    if (flow == null) {
      return;
    }
    setActiveTab('editor');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [flow?.id]);

  // 版本历史（R8.5）
  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['decision-flow-versions', flow?.id],
    queryFn: () => listDecisionFlowVersions(flow!.id),
    enabled: flow != null,
  });

  const onlineVersion = useMemo(
    () => versions.find((v) => String(v.status) === 'ONLINE'),
    [versions],
  );

  const latestVersion = useMemo(
    () => (versions.length > 0 ? [...versions].sort((a, b) => b.version - a.version)[0] : undefined),
    [versions],
  );

  const onlineMutation = useMutation({
    mutationFn: (version: number) => onlineDecisionFlowVersion(flow!.id, version),
    onSuccess: () => {
      message.success('版本已上线');
      queryClient.invalidateQueries({ queryKey: ['decision-flow-versions', flow?.id] });
      queryClient.invalidateQueries({ queryKey: ['decision-flows'] });
    },
    onError: (err: ApiError) => {
      const fields = toFieldErrors(err);
      const reasons = Object.values(fields);
      if (reasons.length > 0) {
        message.error(`上线校验未通过：${reasons.slice(0, 5).join('；')}${reasons.length > 5 ? '…' : ''}`);
      } else {
        message.error(err.message ?? '上线失败');
      }
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: () => rollbackDecisionFlowLastOnline(flow!.id),
    onSuccess: () => {
      message.success('已回退到上一启用版本');
      queryClient.invalidateQueries({ queryKey: ['decision-flow-versions', flow?.id] });
      queryClient.invalidateQueries({ queryKey: ['decision-flows'] });
    },
    onError: (err: ApiError) => message.error(err.message ?? '回退失败'),
  });

  const versionColumns: ColumnsType<DecisionFlowVersionView> = [
    { title: '版本号', dataIndex: 'version', key: 'version', render: (v: number) => `v${v}` },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: DecisionFlowStatus) => flowStatusTag(s),
    },
    {
      title: '创建人',
      dataIndex: 'createdBy',
      key: 'createdBy',
      render: (v?: string | null) => v ?? '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v?: string | null) => v ?? '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, ver) =>
        String(ver.status) === 'ONLINE' ? (
          <Popconfirm
            title="确认下线该决策流？"
            okText="下线"
            cancelText="取消"
            onConfirm={() => flow && onOffline(flow.id)}
          >
            <Button type="link" size="small" danger loading={offlineLoading}>
              下线
            </Button>
          </Popconfirm>
        ) : (
          <Button
            type="link"
            size="small"
            loading={onlineMutation.isPending}
            onClick={() => onlineMutation.mutate(ver.version)}
          >
            上线
          </Button>
        ),
    },
  ];

  const requestClose = () => {
    if (editorDirty) {
      Modal.confirm({
        title: '有未保存的画布修改',
        content: '关闭后将丢失编辑区未保存的内容，是否继续？',
        okText: '关闭',
        cancelText: '继续编辑',
        onOk: onClose,
      });
      return;
    }
    onClose();
  };

  const handleSave = () => {
    editorRef.current?.save();
  };

  if (flow == null) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          height: 52,
          borderBottom: '1px solid #eceef2',
          background: '#fff',
        }}
      >
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={requestClose}>
          返回
        </Button>
        <Text strong style={{ fontSize: 15 }}>
          {flow.name}
        </Text>
        {flowStatusTag(flow.status)}
        {latestVersion ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            版本 {latestVersion.version}
            {editorDirty ? ' · 未保存' : ' · 已保存'}
          </Text>
        ) : null}
        <Segmented
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { label: '运行区', value: 'runtime' },
            { label: '编辑区', value: 'editor' },
            { label: '版本历史', value: 'versions' },
          ]}
        />
        <div style={{ flex: 1 }} />
        {activeTab === 'editor' ? (
          <Space>
            <Button onClick={() => editorRef.current?.reset()}>重置</Button>
            <Button type="primary" onClick={handleSave}>
              保存
            </Button>
          </Space>
        ) : null}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {activeTab === 'runtime' ? (
          onlineVersion ? (
            <FlowCanvasEditor
              flowId={flow.id}
              readonly
              version={onlineVersion.version}
              immersive
            />
          ) : (
            <div style={{ padding: 24 }}>
              <Empty description="暂无上线版本，请先在版本历史中将某个版本上线" />
            </div>
          )
        ) : null}

        {activeTab === 'editor' ? (
          <FlowCanvasEditor
            ref={editorRef}
            flowId={flow.id}
            immersive
            onDirtyChange={onEditorDirtyChange}
          />
        ) : null}

        {activeTab === 'versions' ? (
          <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
            <Space style={{ marginBottom: 12 }}>
              <Button
                loading={rollbackMutation.isPending}
                onClick={() =>
                  Modal.confirm({
                    title: '回退到上一启用版本？',
                    content:
                      '将把上一成功启用过的版本重新上线。至少需切换上线过一次才可回退。上线前会再次校验配置完整性。',
                    okText: '回退',
                    onOk: () => rollbackMutation.mutateAsync(),
                  })
                }
              >
                回退上一启用版本
              </Button>
              {flow.remark?.trim() ? (
                <Text type="secondary">备注：{flow.remark}</Text>
              ) : null}
            </Space>
            <Table
              rowKey="version"
              loading={versionsLoading}
              columns={versionColumns}
              dataSource={versions}
              pagination={false}
              locale={{ emptyText: '暂无版本，保存编辑区画布后生成首个版本' }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
