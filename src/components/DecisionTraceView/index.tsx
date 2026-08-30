import { Card, Descriptions, Empty, Space, Steps, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  decisionColor,
  decisionLabel,
  type AggregatedHitRule,
  type DecisionTrace,
  type FlowTraceStepView,
  type RuleExecutionTrace,
} from '../types';

const { Text } = Typography;

export interface DecisionTraceViewProps {
  /** 完整决策执行链路。 */
  trace?: DecisionTrace | null;
  /** 测试与可访问性标识。 */
  'data-testid'?: string;
}

/** 规则组状态中文映射。 */
const GROUP_STATUS_LABELS: Record<string, string> = {
  COMPLETED: '正常完成',
  INTERRUPTED: '致命中断',
  NO_MATCH: '未匹配规则组',
};

/** 规则执行明细表格列（R5.5：规则标识、版本、命中结果）。 */
const ruleExecutionColumns: ColumnsType<RuleExecutionTrace> = [
  { title: '规则', dataIndex: 'ruleId', key: 'ruleId' },
  {
    title: '版本',
    dataIndex: 'ruleVersion',
    key: 'ruleVersion',
    render: (v) => (v != null ? `v${v}` : '-'),
  },
  { title: '优先级', dataIndex: 'priority', key: 'priority', render: (v) => v ?? '-' },
  {
    title: '执行结果',
    key: 'result',
    render: (_, row) => {
      if (row.failed) {
        return <Tag color="volcano">求值失败</Tag>;
      }
      return row.hit ? <Tag color="blue">命中</Tag> : <Tag color="default">未命中</Tag>;
    },
  },
  {
    title: '规则决策',
    dataIndex: 'decision',
    key: 'decision',
    render: (decision: string | undefined, row) =>
      row.hit && decision ? (
        <Tag color={decisionColor(decision)}>{decisionLabel(decision)}</Tag>
      ) : (
        '-'
      ),
  },
  {
    title: '短路',
    dataIndex: 'shortCircuited',
    key: 'shortCircuited',
    render: (sc: boolean | undefined) => (sc ? <Tag color="gold">短路</Tag> : '-'),
  },
  {
    title: '失败原因',
    dataIndex: 'failureReason',
    key: 'failureReason',
    render: (v) => v ?? '-',
  },
];

/** 参与聚合的命中规则表格列（R6.8：命中规则及各自决策与优先级）。 */
const hitRuleColumns: ColumnsType<AggregatedHitRule> = [
  { title: '规则', dataIndex: 'ruleId', key: 'ruleId' },
  {
    title: '决策',
    dataIndex: 'decision',
    key: 'decision',
    render: (decision: string) => <Tag color={decisionColor(decision)}>{decisionLabel(decision)}</Tag>,
  },
  { title: '决策优先级', dataIndex: 'priority', key: 'priority' },
];

const flowStepColumns: ColumnsType<FlowTraceStepView> = [
  { title: '节点', dataIndex: 'nodeId', key: 'nodeId' },
  { title: '类型', dataIndex: 'nodeType', key: 'nodeType', render: (v) => v ?? '-' },
  {
    title: '引用',
    key: 'ref',
    render: (_, r) => (r.refType && r.refId != null ? `${r.refType}#${r.refId}` : '—'),
  },
  {
    title: '命中',
    key: 'hits',
    render: (_, r) => (r.hits?.length ? `${r.hits.length} 条` : '—'),
  },
];

function renderSelectorStep(trace: DecisionTrace) {
  const sel = trace.selectorMatch;
  if (!sel || Object.keys(sel).length === 0) {
    return <Text type="secondary">无选择器匹配信息</Text>;
  }
  return (
    <Descriptions size="small" column={2} bordered>
      {Object.entries(sel).map(([k, v]) => (
        <Descriptions.Item key={k} label={k}>
          {String(v ?? '—')}
        </Descriptions.Item>
      ))}
    </Descriptions>
  );
}

/**
 * 决策 / 执行链路可视化组件（R6.8、R15.4、XT1）。
 *
 * 分阶段展示：选择器匹配 → 规则执行 / 决策流路径 → 决策聚合。
 */
export default function DecisionTraceView({
  trace,
  'data-testid': testId = 'decision-trace-view',
}: DecisionTraceViewProps) {
  if (!trace) {
    return (
      <div data-testid={testId}>
        <Empty description="暂无链路数据，请按事件标识查询" />
      </div>
    );
  }

  const { ruleExecutions, aggregation, flowPath, flowTrace } = trace;
  const hasFlow = (flowPath?.length ?? 0) > 0 || (flowTrace?.length ?? 0) > 0;
  const missCount = ruleExecutions?.filter((r) => !r.hit && !r.failed).length ?? 0;

  const steps = [
    {
      title: '选择器匹配',
      description: (
        <Card size="small" style={{ marginBottom: 8 }} data-testid={`${testId}-selector`}>
          {renderSelectorStep(trace)}
        </Card>
      ),
    },
    ...(hasFlow
      ? [
          {
            title: '决策流路径',
            description: (
              <Card size="small" style={{ marginBottom: 8 }} data-testid={`${testId}-flow`}>
                {flowPath?.length ? (
                  <Text code style={{ display: 'block', marginBottom: 8 }}>
                    {flowPath.join(' → ')}
                  </Text>
                ) : null}
                {flowTrace && flowTrace.length > 0 ? (
                  <Table
                    size="small"
                    rowKey={(r) => r.nodeId ?? Math.random().toString()}
                    columns={flowStepColumns}
                    dataSource={flowTrace}
                    pagination={false}
                  />
                ) : (
                  <Text type="secondary">无节点明细</Text>
                )}
              </Card>
            ),
          },
        ]
      : [
          {
            title: '规则执行',
            description: (
              <Card size="small" style={{ marginBottom: 8 }} data-testid={`${testId}-rules`}>
                {ruleExecutions && ruleExecutions.length > 0 ? (
                  <>
                    {missCount > 0 ? (
                      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                        共 {ruleExecutions.length} 条，其中未命中 {missCount} 条
                      </Text>
                    ) : null}
                    <Table
                      size="small"
                      rowKey={(r) => String(r.ruleId)}
                      columns={ruleExecutionColumns}
                      dataSource={ruleExecutions}
                      pagination={false}
                    />
                  </>
                ) : (
                  <Text type="secondary">无规则执行记录</Text>
                )}
              </Card>
            ),
          },
        ]),
    {
      title: '决策聚合',
      description: (
        <Card size="small" data-testid={`${testId}-aggregation`}>
          {aggregation ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="最终决策">
                  <Tag color={decisionColor(aggregation.finalDecision)}>
                    {decisionLabel(aggregation.finalDecision)}
                  </Tag>
                </Descriptions.Item>
                {aggregation.maxPriority != null && (
                  <Descriptions.Item label="生效决策优先级">
                    {aggregation.maxPriority}
                  </Descriptions.Item>
                )}
                {aggregation.elapsedMs != null && (
                  <Descriptions.Item label="处理耗时">{aggregation.elapsedMs} ms</Descriptions.Item>
                )}
                {aggregation.groupStatus && (
                  <Descriptions.Item label="规则组状态">
                    <Tag color={aggregation.groupStatus === 'INTERRUPTED' ? 'volcano' : 'default'}>
                      {GROUP_STATUS_LABELS[aggregation.groupStatus] ?? aggregation.groupStatus}
                    </Tag>
                  </Descriptions.Item>
                )}
                {aggregation.timeoutReason && (
                  <Descriptions.Item label="超时原因">
                    <Text type="warning">{aggregation.timeoutReason}</Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
              {aggregation.hitRules && aggregation.hitRules.length > 0 ? (
                <Table
                  size="small"
                  rowKey={(r) => String(r.ruleId)}
                  columns={hitRuleColumns}
                  dataSource={aggregation.hitRules}
                  pagination={false}
                  data-testid={`${testId}-hit-rules`}
                />
              ) : (
                <Text type="secondary">无命中规则（默认放行）</Text>
              )}
            </Space>
          ) : (
            <Text type="secondary">无决策聚合记录</Text>
          )}
        </Card>
      ),
    },
  ];

  return (
    <div data-testid={testId}>
      <Steps direction="vertical" current={steps.length - 1} style={{ marginTop: 8 }} items={steps} />
    </div>
  );
}
