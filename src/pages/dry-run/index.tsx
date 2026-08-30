import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Empty,
  Form,
  InputNumber,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { codeHintSelectOption } from '@/components/CodeHintLabel';
import {
  getDryRun,
  startDryRun,
  type DryRunReportView,
  type DryRunSampleSource,
  type DryRunStatus,
  type DryRunTargetType,
  type StartDryRunBody,
} from '@/api/console/dryRun';
import { listAllRules, listRulePackages } from '@/api/console/rules';
import { toFieldErrors, type ApiError } from '@/api/client';

/**
 * 试运行页（影子模式，R5.1/R5.3/R5.4）。
 *
 * 功能：
 * - 发起试运行表单：目标类型（规则 / 规则包）联动目标选择、样本来源（订单 / 事件）、
 *   可选数据时间范围（RangePicker，转 ISO-8601 字符串）、可选样本上限（<=0 表示不限）。
 *   提交 startDryRun 拿到 jobId。
 * - 报告展示：getDryRun(jobId) 轮询（RUNNING 时每 2.5s 刷新，SUCCESS/FAILED 停止）；
 *   展示状态、总样本数、命中数、命中率、异常数；report 字段为 JSON 字符串，尝试解析后
 *   展示总分分布 / 区间命中等明细，解析失败则原文展示。
 * - 维护已发起任务列表（本地 state 记录 jobId），点选查看其报告。
 */

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

/** 发起试运行表单值。 */
interface DryRunFormValues {
  targetType: DryRunTargetType;
  targetId: number;
  sampleSource: DryRunSampleSource;
  range?: [dayjs.Dayjs, dayjs.Dayjs];
  sampleLimit?: number;
}

/** 已发起任务的本地记录。 */
interface DryRunJobItem {
  jobId: number;
  targetType: DryRunTargetType;
  targetLabel: string;
  sampleSource: DryRunSampleSource;
  createdAt: number;
}

/** 目标类型展示。 */
function targetTypeLabel(type: DryRunTargetType): string {
  if (type === 'RULE') return '规则';
  if (type === 'RULE_PACKAGE') return '规则包';
  return String(type);
}

/** 样本来源展示。 */
function sampleSourceLabel(source: DryRunSampleSource): string {
  if (source === 'ORDER') return '订单';
  if (source === 'EVENT') return '事件';
  return String(source);
}

/** 状态 → 标签颜色映射。 */
function statusTag(status: DryRunStatus) {
  if (status === 'RUNNING') return <Tag color="processing">运行中</Tag>;
  if (status === 'SUCCESS') return <Tag color="green">成功</Tag>;
  if (status === 'FAILED') return <Tag color="red">失败</Tag>;
  return <Tag>{String(status)}</Tag>;
}

/** 命中率展示（report.hitRate 为 0~1 小数或 null）。 */
function formatRate(rate: number | null): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return '-';
  return `${(rate * 100).toFixed(2)}%`;
}

/** 时间范围转 ISO-8601 字符串（YYYY-MM-DDTHH:mm:ss）。 */
function toIso(d?: dayjs.Dayjs): string | undefined {
  return d ? d.format('YYYY-MM-DDTHH:mm:ss') : undefined;
}

/** 报告 JSON 中可能存在的总分分布 / 区间命中明细的宽松结构。 */
interface ParsedReport {
  raw: string;
  parsed: Record<string, unknown> | null;
}

/** 尝试解析报告 JSON；失败时 parsed 为 null，保留原文。 */
function parseReport(report: string | null): ParsedReport | null {
  if (!report) return null;
  try {
    const obj = JSON.parse(report);
    if (obj && typeof obj === 'object') {
      return { raw: report, parsed: obj as Record<string, unknown> };
    }
    return { raw: report, parsed: null };
  } catch {
    return { raw: report, parsed: null };
  }
}

/** 将分布对象规整为表格行，并按数量降序；limit>0 时截断为 TopN。 */
function toDistRows(value: unknown, limit = 0): { key: string; count: number }[] {
  let rows: { key: string; count: number }[] = [];
  if (!value) return [];
  if (Array.isArray(value)) {
    rows = value.map((item, idx) => {
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const label =
          (rec.label as string) ??
          (rec.name as string) ??
          (rec.band as string) ??
          (rec.riskLevelCode as string) ??
          (rec.range as string) ??
          `区间 ${idx + 1}`;
        const raw = rec.count ?? rec.hitCount ?? rec.value ?? rec.num ?? 0;
        return { key: String(label), count: Number(raw) || 0 };
      }
      return { key: `项 ${idx + 1}`, count: Number(item) || 0 };
    });
  } else if (typeof value === 'object') {
    rows = Object.entries(value as Record<string, unknown>).map(([k, v]) => ({
      key: k,
      count: Number(v) || 0,
    }));
  } else {
    rows = [{ key: '值', count: Number(value) || 0 }];
  }
  rows.sort((a, b) => b.count - a.count);
  if (limit > 0) return rows.slice(0, limit);
  return rows;
}

const DECISION_ORDER = ['PASS', 'REVIEW', 'REJECT'];

function decisionDistRows(value: unknown): { key: string; count: number }[] {
  const rows = toDistRows(value);
  const byKey = new Map(rows.map((r) => [r.key.toUpperCase(), r.count]));
  const ordered = DECISION_ORDER.map((k) => ({ key: k, count: byKey.get(k) ?? 0 }));
  for (const r of rows) {
    if (!DECISION_ORDER.includes(r.key.toUpperCase())) {
      ordered.push(r);
    }
  }
  return ordered;
}

export default function DryRunPage() {
  const [form] = Form.useForm<DryRunFormValues>();
  // 目标类型联动（决定加载规则还是规则包作为目标选项）
  const [targetType, setTargetType] = useState<DryRunTargetType>('RULE_PACKAGE');
  // 已发起任务列表（本地维护）
  const [jobs, setJobs] = useState<DryRunJobItem[]>([]);
  // 当前查看报告的 jobId
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  // 目标选项数据源
  const { data: rulePackages = [] } = useQuery({
    queryKey: ['rule-packages'],
    queryFn: () => listRulePackages(),
  });
  const { data: rulesV2 = [] } = useQuery({ queryKey: ['rules-v2'], queryFn: listAllRules });

  const targetOptions = useMemo(() => {
    if (targetType === 'RULE') {
      return rulesV2.map((r) => codeHintSelectOption(r.id, r.name, r.code));
    }
    return rulePackages.map((p) => codeHintSelectOption(p.id, p.name, p.code));
  }, [targetType, rulesV2, rulePackages]);

  // 当前目标的展示名（用于任务列表记录）
  const resolveTargetLabel = (type: DryRunTargetType, id: number): string => {
    if (type === 'RULE') {
      const r = rulesV2.find((x) => x.id === id);
      return r ? r.name : `规则 #${id}`;
    }
    const p = rulePackages.find((x) => x.id === id);
    return p ? p.name : `规则包 #${id}`;
  };

  // 报告轮询：RUNNING 时每 2.5s 刷新，SUCCESS/FAILED 停止
  const reportQuery = useQuery<DryRunReportView>({
    queryKey: ['dry-run', activeJobId],
    queryFn: () => getDryRun(activeJobId as number),
    enabled: activeJobId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'RUNNING' ? 2500 : false;
    },
  });

  const report = reportQuery.data;
  const parsedReport = useMemo(() => parseReport(report?.report ?? null), [report?.report]);

  // 字段级错误回显
  const echoFieldErrors = (err: ApiError, fallback: string) => {
    const fields = toFieldErrors(err);
    const formErrors = Object.entries(fields).map(([name, msg]) => ({
      name: name as keyof DryRunFormValues,
      errors: [msg],
    }));
    if (formErrors.length > 0) {
      form.setFields(formErrors);
    } else {
      message.error(err.message ?? fallback);
    }
  };

  const startMutation = useMutation({
    mutationFn: (body: StartDryRunBody) => startDryRun(body),
    onSuccess: (res, body) => {
      message.success(`试运行已发起（任务 #${res.jobId}）`);
      const item: DryRunJobItem = {
        jobId: res.jobId,
        targetType: body.targetType,
        targetLabel: resolveTargetLabel(body.targetType, body.targetId),
        sampleSource: body.sampleSource,
        createdAt: Date.now(),
      };
      setJobs((prev) => [item, ...prev.filter((j) => j.jobId !== res.jobId)]);
      setActiveJobId(res.jobId);
    },
    onError: (err: ApiError) => echoFieldErrors(err, '发起试运行失败'),
  });

  const handleSubmit = (values: DryRunFormValues) => {
    const body: StartDryRunBody = {
      targetType: values.targetType,
      targetId: values.targetId,
      sampleSource: values.sampleSource,
      dataFrom: toIso(values.range?.[0]),
      dataTo: toIso(values.range?.[1]),
      sampleLimit: values.sampleLimit,
    };
    startMutation.mutate(body);
  };

  // 当前目标是否为评分规则包（用于额外展示总分分布）
  const isScorePackage = useMemo(() => {
    if (!report || report.targetType !== 'RULE_PACKAGE') return false;
    const pkg = rulePackages.find((p) => p.id === report.targetId);
    return pkg?.triggerMode === 'SCORE';
  }, [report, rulePackages]);

  const jobColumns: ColumnsType<DryRunJobItem> = [
    { title: '任务号', dataIndex: 'jobId', key: 'jobId', width: 90 },
    {
      title: '目标',
      key: 'target',
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Tag color={row.targetType === 'RULE_PACKAGE' ? 'purple' : 'blue'}>
            {targetTypeLabel(row.targetType)}
          </Tag>
          <Text>{row.targetLabel}</Text>
        </Space>
      ),
    },
    {
      title: '样本来源',
      dataIndex: 'sampleSource',
      key: 'sampleSource',
      render: (s: DryRunSampleSource) => <Tag>{sampleSourceLabel(s)}</Tag>,
    },
    {
      title: '发起时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (ts: number) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, row) => (
        <Button
          type="link"
          size="small"
          disabled={row.jobId === activeJobId}
          onClick={() => setActiveJobId(row.jobId)}
        >
          查看报告
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ display: 'flex' }}>
      <Card title="发起试运行（影子模式）">
        <Alert
          type="info"
          message="试运行使用历史样本空跑评估命中率，不产生真实决策、不写决策日志、不影响线上指标。"
          style={{ marginBottom: 16 }}
        />
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ targetType: 'RULE_PACKAGE', sampleSource: 'ORDER' }}
          onValuesChange={(changed) => {
            if (changed.targetType !== undefined) {
              setTargetType(changed.targetType);
              // 切换目标类型后清空已选目标，避免 id 跨类型错配
              form.setFieldValue('targetId', undefined);
            }
          }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="目标类型"
                name="targetType"
                rules={[{ required: true, message: '请选择目标类型' }]}
              >
                <Select
                  options={[
                    { label: '规则包', value: 'RULE_PACKAGE' },
                    { label: '规则', value: 'RULE' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                label={targetType === 'RULE' ? '目标规则' : '目标规则包'}
                name="targetId"
                rules={[{ required: true, message: '请选择目标' }]}
              >
                <Select
                  placeholder={targetType === 'RULE' ? '选择结构化规则' : '选择规则包'}
                  options={targetOptions}
                  optionFilterProp="label"
                  showSearch
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="样本来源"
                name="sampleSource"
                rules={[{ required: true, message: '请选择样本来源' }]}
              >
                <Select
                  options={[
                    { label: '订单', value: 'ORDER' },
                    { label: '事件', value: 'EVENT' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                label="数据时间范围"
                name="range"
                tooltip="可选；不选则使用全部历史样本"
              >
                <RangePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="样本上限"
                name="sampleLimit"
                tooltip="可选；<=0 或留空表示不限"
              >
                <InputNumber placeholder="不限" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={startMutation.isPending}>
              发起试运行
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="已发起任务">
        <Table
          rowKey="jobId"
          columns={jobColumns}
          dataSource={jobs}
          pagination={false}
          locale={{ emptyText: '暂无试运行任务' }}
          rowClassName={(row) => (row.jobId === activeJobId ? 'ant-table-row-selected' : '')}
        />
      </Card>

      <Card
        title={activeJobId !== null ? `试运行报告（任务 #${activeJobId}）` : '试运行报告'}
        loading={reportQuery.isLoading}
        extra={
          report && report.status === 'RUNNING' ? (
            <Tag color="processing">轮询中（每 2.5s 刷新）</Tag>
          ) : null
        }
      >
        {activeJobId === null && <Empty description="发起或选择一个任务以查看报告" />}

        {activeJobId !== null && reportQuery.isError && (
          <Alert type="error" message="报告加载失败，请稍后重试" />
        )}

        {report && (
          <>
            <Descriptions bordered size="small" column={3} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="状态">{statusTag(report.status)}</Descriptions.Item>
              <Descriptions.Item label="目标类型">
                {targetTypeLabel(report.targetType)}
              </Descriptions.Item>
              <Descriptions.Item label="样本来源">
                {sampleSourceLabel(report.sampleSource)}
              </Descriptions.Item>
            </Descriptions>

            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Statistic title="总样本数" value={report.totalCount} />
              </Col>
              <Col span={6}>
                <Statistic title="命中数" value={report.hitCount} />
              </Col>
              <Col span={6}>
                <Statistic title="命中率" value={formatRate(report.hitRate)} />
              </Col>
              <Col span={6}>
                <Statistic
                  title="异常样本数"
                  value={report.errorCount}
                  valueStyle={report.errorCount > 0 ? { color: '#cf1322' } : undefined}
                />
              </Col>
            </Row>

            {report.status === 'RUNNING' && (
              <Alert
                type="info"
                message="任务运行中，报告将自动刷新。"
                style={{ marginBottom: 16 }}
              />
            )}

            {/* 报告明细：通用统计 + 分布 */}
            {parsedReport && parsedReport.parsed && (
              <>
                <Divider orientation="left">决策分布</Divider>
                <Table
                  rowKey="key"
                  size="small"
                  pagination={false}
                  dataSource={decisionDistRows(
                    parsedReport.parsed.decisionDistribution ??
                      parsedReport.parsed.decisionDist,
                  )}
                  columns={[
                    { title: '决策', dataIndex: 'key', key: 'key', width: 120 },
                    {
                      title: '样本数',
                      dataIndex: 'count',
                      key: 'count',
                      render: (v: number) => String(v),
                    },
                  ]}
                  locale={{ emptyText: '无决策分布数据' }}
                />

                <Divider orientation="left">命中规则 Top10</Divider>
                <Table
                  rowKey="key"
                  size="small"
                  pagination={false}
                  dataSource={toDistRows(
                    parsedReport.parsed.ruleHitDistribution ??
                      parsedReport.parsed.ruleHits ??
                      parsedReport.parsed.hitDistribution,
                    10,
                  )}
                  columns={[
                    { title: '规则 ID', dataIndex: 'key', key: 'key' },
                    {
                      title: '命中次数',
                      dataIndex: 'count',
                      key: 'count',
                      render: (v: number) => String(v),
                    },
                  ]}
                  locale={{ emptyText: '无规则命中分布' }}
                />

                {isScorePackage && (
                  <>
                    <Divider orientation="left">总分分布</Divider>
                    <Table
                      rowKey="key"
                      size="small"
                      pagination={false}
                      dataSource={toDistRows(
                        parsedReport.parsed.scoreDistribution ??
                          parsedReport.parsed.totalScoreDistribution ??
                          parsedReport.parsed.scoreDist,
                      )}
                      columns={[
                        { title: '分值/区间', dataIndex: 'key', key: 'key' },
                        {
                          title: '数量',
                          dataIndex: 'count',
                          key: 'count',
                          render: (v: number) => String(v),
                        },
                      ]}
                      locale={{ emptyText: '无总分分布数据' }}
                    />

                    <Divider orientation="left">分值区间命中</Divider>
                    <Table
                      rowKey="key"
                      size="small"
                      pagination={false}
                      dataSource={toDistRows(
                        parsedReport.parsed.bandHitDistribution ??
                          parsedReport.parsed.bandHits,
                      )}
                      columns={[
                        { title: '风险等级', dataIndex: 'key', key: 'key' },
                        {
                          title: '命中数',
                          dataIndex: 'count',
                          key: 'count',
                          render: (v: number) => String(v),
                        },
                      ]}
                      locale={{ emptyText: '无区间命中数据' }}
                    />
                  </>
                )}

                <Divider orientation="left">报告原文</Divider>
                <Paragraph>
                  <pre
                    style={{
                      maxHeight: 320,
                      overflow: 'auto',
                      background: '#f5f5f5',
                      padding: 12,
                      borderRadius: 4,
                    }}
                  >
                    {JSON.stringify(parsedReport.parsed, null, 2)}
                  </pre>
                </Paragraph>
              </>
            )}

            {/* 解析失败：原文展示 */}
            {parsedReport && !parsedReport.parsed && (
              <>
                <Divider orientation="left">报告原文（无法解析为 JSON）</Divider>
                <Paragraph>
                  <pre
                    style={{
                      maxHeight: 320,
                      overflow: 'auto',
                      background: '#f5f5f5',
                      padding: 12,
                      borderRadius: 4,
                    }}
                  >
                    {parsedReport.raw}
                  </pre>
                </Paragraph>
              </>
            )}

            {!parsedReport && report.status !== 'RUNNING' && (
              <Text type="secondary">本次试运行无报告明细。</Text>
            )}
          </>
        )}
      </Card>
    </Space>
  );
}
