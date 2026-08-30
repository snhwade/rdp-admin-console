import { Descriptions, Empty, Tag, Button } from 'antd';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import type { AiDecisionRecord, EngineDecisionRecord, InvocationDetail } from '@/api/tools';

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: 'green',
  PENDING: 'blue',
  FAILED: 'red',
};

export function decisionColor(d?: string) {
  if (!d) return 'default';
  const u = d.toUpperCase();
  if (u === 'REJECT' || u === 'AUTO_REJECT') return 'red';
  if (u === 'REVIEW' || u === 'MANUAL_REVIEW') return 'orange';
  if (u === 'PASS' || u === 'AUTO_PASS') return 'green';
  return 'default';
}

export function fmtTs(ms?: number) {
  return ms ? dayjs(ms).format('YYYY-MM-DD HH:mm:ss') : '—';
}

function extractUnknownFindings(trace?: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  if (!trace?.length) return [];
  for (let i = trace.length - 1; i >= 0; i--) {
    const step = trace[i];
    const out = step.output as Record<string, unknown> | undefined;
    if (out?.unknownFindings && Array.isArray(out.unknownFindings)) {
      return out.unknownFindings as Array<Record<string, unknown>>;
    }
    if (step.tool === 'orchestrator_finish' && step.output) {
      const finish = step.output as Record<string, unknown>;
      if (Array.isArray(finish.unknownFindings)) {
        return finish.unknownFindings as Array<Record<string, unknown>>;
      }
    }
  }
  return [];
}

interface Props {
  detail: InvocationDetail | null;
  loading?: boolean;
}

/** 单次调用详情：引擎决策、命中规则、AI 推理过程。 */
export default function InvocationDetailPanel({ detail, loading }: Props) {
  if (loading) {
    return <Empty description="加载中…" />;
  }
  if (!detail) {
    return <Empty description="暂无详情" />;
  }

  const engine = detail.engine;
  const ai = detail.ai;
  const hits = detail.engineHits ?? [];

  return (
    <>
      <Descriptions bordered column={1} size="small" title="调用概要">
        <Descriptions.Item label="事件标识">{detail.eventId}</Descriptions.Item>
        <Descriptions.Item label="业务订单号">{detail.businessOrderId ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="关联 UUID"><code>{detail.correlationId}</code></Descriptions.Item>
        <Descriptions.Item label="商户">{detail.merchantId ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="事件类型">{detail.eventTypeCode ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="事件时间">{fmtTs(detail.eventTimeMs)}</Descriptions.Item>
        <Descriptions.Item label="排障">
          <Link to={`/observability?eventId=${encodeURIComponent(detail.eventId)}`}>
            <Button type="link" size="small" style={{ padding: 0 }}>
              查看执行链路
            </Button>
          </Link>
        </Descriptions.Item>
      </Descriptions>

      {engine && (
        <>
          <Descriptions bordered column={1} size="small" title="引擎同步轨" style={{ marginTop: 24 }}>
            <Descriptions.Item label="引擎决策">
              <Tag color={decisionColor(engine.engineDecision)}>{engine.engineDecision}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="对外决策">
              <Tag color={decisionColor(engine.finalDecision)}>{engine.finalDecision}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="调用模式">{engine.invokeMode ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="规则包 ID">{engine.rulePackageId ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="决策流 ID">{engine.decisionFlowId ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="耗时(ms)">{engine.elapsedMs ?? '—'}</Descriptions.Item>
          </Descriptions>

          {hits.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <strong>命中规则</strong>
              <table style={{ width: '100%', marginTop: 8, fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px', border: '1px solid #f0f0f0' }}>规则 ID</th>
                    <th style={{ padding: '6px 8px', border: '1px solid #f0f0f0' }}>优先级</th>
                    <th style={{ padding: '6px 8px', border: '1px solid #f0f0f0' }}>决策</th>
                    <th style={{ padding: '6px 8px', border: '1px solid #f0f0f0' }}>试运行</th>
                  </tr>
                </thead>
                <tbody>
                  {hits.map((h, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '6px 8px', border: '1px solid #f0f0f0' }}>{String(h.ruleId ?? '—')}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #f0f0f0' }}>{String(h.priority ?? '—')}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #f0f0f0' }}>
                        <Tag color={decisionColor(String(h.decision ?? ''))}>{String(h.decision ?? '—')}</Tag>
                      </td>
                      <td style={{ padding: '6px 8px', border: '1px solid #f0f0f0' }}>
                        {h.trialRun ? '是' : '否'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {engine.detail && Object.keys(engine.detail).length > 0 && (
            <pre style={{ marginTop: 12, fontSize: 12, background: '#f5f5f5', padding: 12, overflow: 'auto' }}>
              {JSON.stringify(engine.detail, null, 2)}
            </pre>
          )}
        </>
      )}

      {ai && (
        <>
          <Descriptions bordered column={1} size="small" title="AI Agent 旁路" style={{ marginTop: 24 }}>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_COLOR[ai.status]}>{ai.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Agent 决策">
              {ai.agentDecision
                ? <Tag color={decisionColor(ai.agentDecision)}>{ai.agentDecision}</Tag>
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="置信度">
              {ai.confidence != null ? ai.confidence.toFixed(3) : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="推理说明">{ai.reason ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="与引擎不一致">{ai.divergence ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="失败原因">{ai.failReason ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="完成时间">{fmtTs(ai.completedAtMs)}</Descriptions.Item>
          </Descriptions>
          {extractUnknownFindings(ai.trace).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong>未知风险假设</strong>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                {extractUnknownFindings(ai.trace).map((u, idx) => (
                  <li key={idx} style={{ marginBottom: 8 }}>
                    <Tag color="orange">severity {String(u.severity ?? '?')}</Tag>
                    {String(u.hypothesis ?? u.name ?? '—')}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ai.trace && ai.trace.length > 0 && (
            <pre style={{ marginTop: 12, fontSize: 12, background: '#f5f5f5', padding: 12, overflow: 'auto' }}>
              {JSON.stringify(ai.trace, null, 2)}
            </pre>
          )}
        </>
      )}

      {!engine && !ai && <Empty description="暂无引擎或 AI 记录" style={{ marginTop: 24 }} />}
    </>
  );
}

export type { EngineDecisionRecord, AiDecisionRecord };
