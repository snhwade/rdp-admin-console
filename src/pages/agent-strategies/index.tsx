import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
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
  createAgentStrategy,
  getAgentRuntime,
  listAgentAdoptionAudits,
  listAgentStrategies,
  updateAgentStrategy,
  type AgentAdoptionAuditView,
  type AgentStrategyView,
} from '@/api/config';
import type { ApiError } from '@/api/client';

const ADOPTION_OPTIONS = [
  {
    value: 'SHADOW',
    label: 'SHADOW — 异步影子，不参与同步对外决策',
  },
  {
    value: 'ADVISORY',
    label: 'ADVISORY — 同步参考，AI 更严时最多抬升到 REVIEW',
  },
  {
    value: 'STRICT',
    label: 'STRICT — 同步从严，strictest(引擎, AI)',
  },
  {
    value: 'OVERRIDE',
    label: 'OVERRIDE — 同步覆盖，AI 成功则用 AI 决策',
  },
];

const ADOPTION_COLOR: Record<string, string> = {
  SHADOW: 'default',
  ADVISORY: 'blue',
  STRICT: 'orange',
  OVERRIDE: 'purple',
};

const DEFAULT_CONFIG = `{
  "llmMode": "ORCHESTRATED",
  "maxOrchestrationSteps": 8,
  "featureFields": ["merchantId", "amount"],
  "llm": {
    "provider": "deepseek",
    "model": "deepseek-v4-pro",
    "apiKeyEnv": "DEEPSEEK_API_KEY",
    "systemPrompt": "你是风控 AI Agent，可自主选工具分析突发大额等风险。",
    "temperature": 0.2
  },
  "tools": [
    {"id": "read_context", "enabled": true},
    {"id": "list_check", "enabled": true},
    {"id": "analyze_amount_spike", "enabled": true, "spikeRatio": 3, "spikeAbsolute": 100000},
    {"id": "read_indicator", "enabled": true, "refs": [{"refName": "b2b_daily_amt", "windowDays": 1, "granularity": "DAY"}]},
    {"id": "compare_engine", "enabled": true}
  ],
  "rules": [
    {"when": "amount_spike", "decision": "REVIEW", "reason": "突发巨额交易", "confidence": 0.9},
    {"when": "blackHit", "decision": "REJECT", "reason": "黑名单命中", "confidence": 0.95}
  ],
  "defaultDecision": "PASS",
  "defaultConfidence": 0.75,
  "defaultReason": "未发现显著风险"
}`;

export default function AgentStrategiesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [editing, setEditing] = useState<AgentStrategyView | null>(null);
  const [form] = Form.useForm();

  const { data: strategies = [], isLoading } = useQuery({
    queryKey: ['agent-strategies'],
    queryFn: listAgentStrategies,
  });

  const { data: agentRuntime } = useQuery({
    queryKey: ['agent-runtime'],
    queryFn: getAgentRuntime,
  });

  const { data: audits = [], isLoading: auditsLoading } = useQuery({
    queryKey: ['agent-adoption-audits', editing?.id],
    queryFn: () => listAgentAdoptionAudits(editing!.id),
    enabled: auditOpen && editing != null,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const eventTypeCodes = String(values.eventTypeCodes ?? '*')
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const body = {
        name: values.name as string,
        eventTypeCodes,
        configJson: values.configJson as string,
        description: (values.description as string | undefined) ?? '',
        adoptionMode: values.adoptionMode as string,
        enabled: values.enabled as boolean | undefined,
      };
      if (editing) {
        return updateAgentStrategy(editing.id, body);
      }
      return createAgentStrategy({
        code: values.code as string,
        ...body,
      });
    },
    onSuccess: () => {
      message.success('已保存');
      setModalOpen(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['agent-strategies'] });
    },
    onError: (err: ApiError) => message.error(err.message ?? '保存失败'),
  });

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      code: '',
      name: '',
      description: '',
      eventTypeCodes: '*',
      configJson: DEFAULT_CONFIG,
      adoptionMode: 'SHADOW',
      enabled: true,
    });
    setModalOpen(true);
  };

  const openEdit = (row: AgentStrategyView) => {
    setEditing(row);
    form.setFieldsValue({
      code: row.code,
      name: row.name,
      description: row.description ?? '',
      eventTypeCodes: (row.eventTypeCodes ?? []).join(','),
      configJson: row.configJson,
      adoptionMode: row.adoptionMode ?? 'SHADOW',
      enabled: row.status === 'ENABLED',
    });
    setModalOpen(true);
  };

  const auditColumns: ColumnsType<AgentAdoptionAuditView> = [
    {
      title: '变更前',
      dataIndex: 'fromMode',
      key: 'fromMode',
      width: 100,
      render: (v?: string | null) => v ?? '—',
    },
    {
      title: '变更后',
      dataIndex: 'toMode',
      key: 'toMode',
      width: 100,
    },
    { title: '操作人', dataIndex: 'changedBy', key: 'changedBy', width: 120 },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  ];

  const columns: ColumnsType<AgentStrategyView> = [
    { title: '编码', dataIndex: 'code', key: 'code', width: 160 },
    { title: '名称', dataIndex: 'name', key: 'name', width: 160 },
    {
      title: '采纳模式',
      dataIndex: 'adoptionMode',
      key: 'adoptionMode',
      width: 120,
      render: (mode?: string) => (
        <Tag color={ADOPTION_COLOR[mode ?? 'SHADOW'] ?? 'default'}>{mode ?? 'SHADOW'}</Tag>
      ),
    },
    {
      title: '事件类型',
      dataIndex: 'eventTypeCodes',
      key: 'eventTypeCodes',
      width: 180,
      render: (codes: string[]) => (codes ?? []).join(', '),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => (
        <Tag color={s === 'ENABLED' ? 'green' : 'default'}>{s === 'ENABLED' ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '备注',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v?: string | null) => v || '—',
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, row) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openEdit(row)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setEditing(row);
              setAuditOpen(true);
            }}
          >
            变更留痕
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title="AI Agent 策略" extra={<Button type="primary" onClick={openCreate}>新建策略</Button>}>
      <p style={{ marginBottom: 16, color: 'rgba(0,0,0,0.45)' }}>
        配置异步 AI Agent 工具链与规则。<strong>采纳模式</strong>决定 AI 是否参与同步对外决策：
        SHADOW 仅旁路记录；ADVISORY/STRICT/OVERRIDE 会同步等待 AI 并合并决策。
        平台不提供「建议用哪档模式」文案，由运营自行选择。
      </p>
      {agentRuntime && (
        <Alert
          style={{ marginBottom: 16 }}
          type={agentRuntime.apiKeyConfigured ? 'success' : 'warning'}
          showIcon
          message={
            agentRuntime.apiKeyConfigured
              ? `LLM 已就绪：${agentRuntime.llmProvider} / ${agentRuntime.defaultModel}（${agentRuntime.apiKeyEnv}）`
              : `未检测到 ${agentRuntime.apiKeyEnv}，请在 decision-gateway 进程环境变量中配置 DeepSeek API Key`
          }
          description={`编排模式默认 ${agentRuntime.defaultLlmMode}，接口 ${agentRuntime.llmBaseUrl}；策略未配置采纳模式时回落网关默认 ${agentRuntime.defaultAdoptionMode}`}
        />
      )}
      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={strategies}
        pagination={false}
        scroll={{ x: 1100 }}
      />

      <Modal
        title={editing ? '编辑 Agent 策略' : '新建 Agent 策略'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          {!editing && (
            <Form.Item name="code" label="策略编码" rules={[{ required: true }]}>
              <Input placeholder="如 b2b_recv_agent" />
            </Form.Item>
          )}
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="adoptionMode"
            label="采纳模式"
            rules={[{ required: true, message: '请选择采纳模式' }]}
            extra="变更将写入审计留痕（操作人、时间）"
          >
            <Select options={ADOPTION_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="description"
            label="备注"
            extra="说明该策略的适用场景与作用，方便其他人理解"
          >
            <Input.TextArea rows={2} maxLength={512} showCount placeholder="如：B2B 收款突发大额审单，SHADOW 观察用" />
          </Form.Item>
          <Form.Item name="eventTypeCodes" label="适用事件类型" extra="逗号分隔，* 表示兜底">
            <Input placeholder="B2B_RECV,*" />
          </Form.Item>
          <Form.Item name="configJson" label="运行时配置 JSON" rules={[{ required: true }]}>
            <Input.TextArea rows={14} style={{ fontFamily: 'monospace', fontSize: 12 }} />
          </Form.Item>
          {editing && (
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Drawer
        title={editing ? `采纳模式变更留痕 · ${editing.name}` : '采纳模式变更留痕'}
        open={auditOpen}
        width={560}
        onClose={() => setAuditOpen(false)}
      >
        <Table
          rowKey="id"
          size="small"
          loading={auditsLoading}
          columns={auditColumns}
          dataSource={audits}
          pagination={false}
          locale={{ emptyText: '暂无变更记录' }}
        />
      </Drawer>
    </Card>
  );
}
