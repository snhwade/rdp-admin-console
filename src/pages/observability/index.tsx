import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Row,
  Space,
  Statistic,
  Typography,
  message,
} from 'antd';
import { DecisionTraceView, type DecisionTrace } from '@/components';
import { getTrace } from '@/api/tools';
import { apiClient, type ApiError } from '@/api/client';

const { Text, Paragraph } = Typography;

interface BackendHitDecision {
  ruleId: number | string;
  priority: number;
  decision: string;
  trialRun?: boolean;
}

interface BackendRuleExecution {
  ruleId: number | string;
  version?: number;
  hit: boolean;
  failed?: boolean;
  failReason?: string | null;
}

interface BackendFlowTraceStep {
  nodeId?: string;
  nodeType?: string;
  refType?: string;
  refId?: number | string | null;
  hits?: BackendHitDecision[];
  assignments?: Record<string, unknown>;
}

/** 网关 InvocationTraceView（XT1） */
interface BackendTraceView {
  eventId: string;
  traceId?: string;
  finalDecision: string;
  hitDecisions?: BackendHitDecision[];
  elapsedMs?: number;
  timeoutReason?: string | null;
  groupStatus?: string;
  selectorMatch?: Record<string, unknown>;
  ruleExecutions?: BackendRuleExecution[];
  flowPath?: string[];
  flowTrace?: BackendFlowTraceStep[];
}

function mapToDecisionTrace(raw: BackendTraceView): DecisionTrace {
  const hits = raw.hitDecisions ?? [];
  const executions = raw.ruleExecutions?.length
    ? raw.ruleExecutions.map((r) => {
        const hitDetail = hits.find((h) => String(h.ruleId) === String(r.ruleId));
        return {
          ruleId: r.ruleId,
          ruleVersion: r.version,
          priority: hitDetail?.priority,
          hit: r.hit,
          failed: r.failed,
          failureReason: r.failReason ?? undefined,
          decision: hitDetail?.decision,
        };
      })
    : hits.map((h) => ({
        ruleId: h.ruleId,
        priority: h.priority,
        hit: true,
        decision: h.decision,
      }));

  return {
    eventId: raw.eventId,
    selectorMatch: raw.selectorMatch,
    ruleExecutions: executions,
    flowPath: raw.flowPath,
    flowTrace: raw.flowTrace?.map((s) => ({
      nodeId: s.nodeId,
      nodeType: s.nodeType,
      refType: s.refType,
      refId: s.refId,
      hits: s.hits?.map((h) => ({
        ruleId: h.ruleId,
        decision: h.decision,
        priority: h.priority,
      })),
      assignments: s.assignments,
    })),
    aggregation: {
      finalDecision: raw.finalDecision,
      maxPriority: hits.length > 0 ? Math.max(...hits.map((h) => h.priority ?? 0)) : undefined,
      hitRules: hits.map((h) => ({
        ruleId: h.ruleId,
        decision: h.decision,
        priority: h.priority,
      })),
      elapsedMs: raw.elapsedMs,
      timeoutReason: raw.timeoutReason ?? undefined,
      groupStatus: raw.groupStatus,
    },
  };
}

interface DecisionMetricsSnapshot {
  eventsTotal?: number;
  decisionDurationP50Ms?: number;
  decisionDurationP99Ms?: number;
  ruleHitRate?: number;
}

async function fetchMetricsSnapshot(): Promise<DecisionMetricsSnapshot | null> {
  try {
    const { data } = await apiClient.get<DecisionMetricsSnapshot>('/observability/metrics');
    return data ?? null;
  } catch {
    return null;
  }
}

const fmt = (v: number | undefined, suffix = ''): string =>
  v == null || Number.isNaN(v) ? '—' : `${v}${suffix}`;

const fmtRate = (v: number | undefined): string =>
  v == null || Number.isNaN(v) ? '—' : `${(v * 100).toFixed(2)}%`;

export default function ObservabilityPage() {
  const [searchParams] = useSearchParams();
  const [metrics, setMetrics] = useState<DecisionMetricsSnapshot | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsLoaded, setMetricsLoaded] = useState(false);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      setMetrics(await fetchMetricsSnapshot());
    } finally {
      setMetricsLoading(false);
      setMetricsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const [eventId, setEventId] = useState('');
  const [trace, setTrace] = useState<BackendTraceView | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runQuery = async (id: string) => {
    if (!id.trim()) {
      message.warning('请输入事件标识');
      return;
    }
    setTraceLoading(true);
    setSearched(true);
    try {
      const data = (await getTrace(id.trim())) as BackendTraceView;
      setTrace(data);
    } catch (err) {
      setTrace(null);
      message.error((err as ApiError).message ?? '查询失败');
    } finally {
      setTraceLoading(false);
    }
  };

  useEffect(() => {
    const fromUrl = searchParams.get('eventId');
    if (fromUrl) {
      setEventId(fromUrl);
      void runQuery(fromUrl);
    }
  }, [searchParams]);

  const metricsUnavailable = metricsLoaded && !metricsLoading && !metrics;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card
        title="监控指标"
        extra={
          <Button loading={metricsLoading} onClick={() => void loadMetrics()}>
            刷新
          </Button>
        }
      >
        {metricsUnavailable && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="监控指标数据源接入中"
            description="决策监控指标当前经 Micrometer 暴露于 /actuator/prometheus（供 Grafana 抓取）。面向前端的 JSON 聚合端点就绪后，本页将自动展示实时数值。"
          />
        )}
        <Row gutter={16}>
          <Col xs={12} sm={6}>
            <Statistic title="事件处理量" value={fmt(metrics?.eventsTotal)} loading={metricsLoading} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="决策耗时 P50"
              value={fmt(metrics?.decisionDurationP50Ms, ' ms')}
              loading={metricsLoading}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="决策耗时 P99"
              value={fmt(metrics?.decisionDurationP99Ms, ' ms')}
              loading={metricsLoading}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="规则命中率" value={fmtRate(metrics?.ruleHitRate)} loading={metricsLoading} />
          </Col>
        </Row>
      </Card>

      <Card title="执行链路查询">
        <Space.Compact style={{ width: 480, marginBottom: 16 }}>
          <Input
            placeholder="输入事件标识 eventId"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            onPressEnter={() => void runQuery(eventId)}
            allowClear
          />
          <Button type="primary" loading={traceLoading} onClick={() => void runQuery(eventId)}>
            查询链路
          </Button>
        </Space.Compact>

        {trace ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space wrap>
              <Descriptions size="small" column={2} bordered style={{ flex: 1 }}>
                <Descriptions.Item label="事件标识">{trace.eventId}</Descriptions.Item>
                <Descriptions.Item label="链路追踪标识">
                  <Text>{trace.traceId ?? trace.eventId}</Text>
                </Descriptions.Item>
              </Descriptions>
              <Link to={`/decision-invocations?eventId=${encodeURIComponent(trace.eventId)}`}>
                <Button type="link">返回调用详情</Button>
              </Link>
            </Space>
            <DecisionTraceView trace={mapToDecisionTrace(trace)} />
          </Space>
        ) : (
          searched && !traceLoading && <Empty description="未找到该事件的执行链路" />
        )}
        {!trace && !searched ? (
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            支持从调用查询 / 订单详情通过「查看执行链路」深链进入（XL1）。
          </Paragraph>
        ) : null}
      </Card>
    </Space>
  );
}
