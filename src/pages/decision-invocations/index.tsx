import { Alert, Button, Card, Col, DatePicker, Drawer, Empty, Form, Input, Row, Space, Statistic, Switch, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import InvocationDetailPanel, { decisionColor, fmtTs } from '@/components/InvocationDetailPanel';
import {
  getInvocationDetail,
  queryAiDecisionStats,
  queryDecisionRecords,
  queryEngineDecisionStats,
  type InvocationDetail,
  type PagedData,
  type UnifiedDecisionRecord,
} from '@/api/tools';
import type { ApiError } from '@/api/client';

const PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = ['20', '50', '100', '200'];

interface Filter {
  eventId?: string;
  correlationId?: string;
  businessOrderId?: string;
  merchantId?: string;
  eventTypeCode?: string;
  startTimeMs?: number;
  endTimeMs?: number;
  divergenceOnly?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: 'green',
  PENDING: 'blue',
  FAILED: 'red',
};

/** 调用维度查询：每次风控检查一条记录，详情展示引擎命中与 AI 推理。 */
export default function DecisionInvocationsPage() {
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [data, setData] = useState<PagedData<UnifiedDecisionRecord>>({
    data: [],
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
  });
  const [filter, setFilter] = useState<Filter>({});
  const [searched, setSearched] = useState(false);
  const [invalidHint, setInvalidHint] = useState<string | null>(null);
  const [detail, setDetail] = useState<InvocationDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const statsQuery = useQuery({
    queryKey: ['ai-decision-stats', filter.startTimeMs, filter.endTimeMs, filter.eventTypeCode],
    queryFn: () =>
      queryAiDecisionStats({
        startTimeMs: filter.startTimeMs,
        endTimeMs: filter.endTimeMs,
        eventTypeCode: filter.eventTypeCode,
      }),
  });

  const engineStatsQuery = useQuery({
    queryKey: ['engine-decision-stats', filter.startTimeMs, filter.endTimeMs, filter.eventTypeCode],
    queryFn: () =>
      queryEngineDecisionStats({
        startTimeMs: filter.startTimeMs,
        endTimeMs: filter.endTimeMs,
        eventTypeCode: filter.eventTypeCode,
      }),
  });

  const queryMutation = useMutation({
    mutationFn: queryDecisionRecords,
    onSuccess: (paged) => {
      setData(paged);
      setSearched(true);
    },
    onError: (err: ApiError) => message.error(err.message ?? '查询失败'),
  });

  const validate = (values: Record<string, unknown>): { error: string } | { filter: Filter } => {
    const eventId = (values.eventId as string)?.trim() || undefined;
    const correlationId = (values.correlationId as string)?.trim() || undefined;
    const businessOrderId = (values.businessOrderId as string)?.trim() || undefined;
    const merchantId = (values.merchantId as string)?.trim() || undefined;
    const eventTypeCode = (values.eventTypeCode as string)?.trim() || undefined;
    const divergenceOnly = Boolean(values.divergenceOnly);
    const range = values.range as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
    const startTimeMs = range?.[0]?.valueOf();
    const endTimeMs = range?.[1]?.valueOf();

    if (startTimeMs && endTimeMs && startTimeMs > endTimeMs) {
      return { error: '起始时间不得晚于结束时间' };
    }
    return {
      filter: {
        eventId,
        correlationId,
        businessOrderId,
        merchantId,
        eventTypeCode,
        startTimeMs,
        endTimeMs,
        divergenceOnly: divergenceOnly || undefined,
      },
    };
  };

  const runQuery = (f: Filter, page = 1, pageSize = data.pageSize) => {
    setFilter(f);
    queryMutation.mutate({ ...f, page, pageSize });
  };

  const onFinish = (values: Record<string, unknown>) => {
    const result = validate(values);
    if ('error' in result) {
      setInvalidHint(result.error);
      return;
    }
    setInvalidHint(null);
    runQuery(result.filter, 1, data.pageSize);
  };

  const onReset = () => {
    form.resetFields();
    setInvalidHint(null);
    runQuery({}, 1, PAGE_SIZE);
  };

  useEffect(() => {
    const eventId = searchParams.get('eventId');
    const correlationId = searchParams.get('correlationId');
    const businessOrderId = searchParams.get('businessOrderId');
    if (eventId || correlationId || businessOrderId) {
      form.setFieldsValue({ eventId, correlationId, businessOrderId });
      runQuery(
        {
          eventId: eventId || undefined,
          correlationId: correlationId || undefined,
          businessOrderId: businessOrderId || undefined,
        },
        1,
        PAGE_SIZE,
      );
      if (eventId) {
        openDetail(eventId);
      }
    } else {
      runQuery({}, 1, PAGE_SIZE);
    }
  }, [searchParams]);

  const openDetail = async (eventId: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    setDetail(null);
    try {
      const result = await getInvocationDetail(eventId);
      if (!result) {
        message.warning('未找到记录');
        setDetailOpen(false);
        return;
      }
      setDetail(result);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetail(null);
  };

  const stats = statsQuery.data;
  const engineStats = engineStatsQuery.data;
  const divergencePct = stats ? `${(stats.divergenceRate * 100).toFixed(1)}%` : '—';
  const decisionDistText = engineStats
    ? Object.entries(engineStats.decisionDistribution ?? {})
        .map(([k, v]) => `${k}:${v}`)
        .join(' · ') || '—'
    : '—';

  const columns: ColumnsType<UnifiedDecisionRecord> = [
    { title: '事件标识', dataIndex: 'eventId', key: 'eventId', ellipsis: true, width: 200 },
    { title: '业务订单号', dataIndex: 'businessOrderId', key: 'businessOrderId', ellipsis: true, width: 160 },
    { title: '商户', dataIndex: 'merchantId', key: 'merchantId', render: (v) => v || '—', width: 100 },
    { title: '事件类型', dataIndex: 'eventTypeCode', key: 'eventTypeCode', width: 110 },
    {
      title: '引擎决策',
      dataIndex: 'engineDecision',
      key: 'engineDecision',
      width: 90,
      render: (d: string) => <Tag color={decisionColor(d)}>{d}</Tag>,
    },
    {
      title: '对外决策',
      dataIndex: 'finalDecision',
      key: 'finalDecision',
      width: 90,
      render: (d: string) => <Tag color={decisionColor(d)}>{d}</Tag>,
    },
    {
      title: 'AI',
      dataIndex: 'aiStatus',
      key: 'aiStatus',
      width: 80,
      render: (s?: string) => (s ? <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag> : '—'),
    },
    {
      title: '分歧',
      dataIndex: 'divergence',
      key: 'divergence',
      width: 70,
      render: (v?: boolean) => (v ? <Tag color="orange">是</Tag> : '—'),
    },
    {
      title: '事件时间',
      dataIndex: 'eventTimeMs',
      key: 'eventTimeMs',
      width: 170,
      render: (ts: number) => fmtTs(ts),
    },
    {
      title: '操作',
      key: 'actions',
      width: 70,
      fixed: 'right',
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => openDetail(row.eventId)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <Card title="调用查询">
      <p style={{ marginBottom: 16, color: 'rgba(0,0,0,0.45)' }}>
        调用维度：每次风控检查（eventId）一条记录。列表展示摘要，详情含引擎决策、命中规则与 AI 推理过程。同一业务订单可能多次进入。
      </p>

      <Row gutter={16} style={{ marginBottom: 8 }}>
        <Col span={4}><Statistic title="AI 记录" value={stats?.total ?? 0} loading={statsQuery.isFetching} /></Col>
        <Col span={4}><Statistic title="成功" value={stats?.success ?? 0} loading={statsQuery.isFetching} /></Col>
        <Col span={4}><Statistic title="失败" value={stats?.failed ?? 0} loading={statsQuery.isFetching} /></Col>
        <Col span={4}><Statistic title="待完成" value={stats?.pending ?? 0} loading={statsQuery.isFetching} /></Col>
        <Col span={4}><Statistic title="分歧数" value={stats?.divergenceCount ?? 0} loading={statsQuery.isFetching} /></Col>
        <Col span={4}><Statistic title="分歧率" value={divergencePct} loading={statsQuery.isFetching} /></Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Statistic title="引擎样本量" value={engineStats?.total ?? 0} loading={engineStatsQuery.isFetching} />
        </Col>
        <Col span={4}>
          <Statistic
            title="平均耗时"
            value={engineStats ? `${engineStats.avgElapsedMs.toFixed(1)} ms` : '—'}
            loading={engineStatsQuery.isFetching}
          />
        </Col>
        <Col span={4}>
          <Statistic
            title="P99 耗时"
            value={engineStats ? `${engineStats.p99ElapsedMs} ms` : '—'}
            loading={engineStatsQuery.isFetching}
          />
        </Col>
        <Col span={12}>
          <Statistic title="决策分布（XS1）" value={decisionDistText} loading={engineStatsQuery.isFetching} />
        </Col>
      </Row>

      <Form form={form} layout="inline" onFinish={onFinish} style={{ marginBottom: 16, rowGap: 8 }}>
        <Form.Item name="eventId" label="事件标识">
          <Input placeholder="evt-..." allowClear style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name="businessOrderId" label="业务订单号">
          <Input allowClear style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="correlationId" label="关联 UUID">
          <Input allowClear style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="merchantId" label="商户">
          <Input allowClear style={{ width: 110 }} />
        </Form.Item>
        <Form.Item name="eventTypeCode" label="事件类型">
          <Input allowClear style={{ width: 110 }} />
        </Form.Item>
        <Form.Item name="range" label="时间范围">
          <DatePicker.RangePicker showTime />
        </Form.Item>
        <Form.Item name="divergenceOnly" label="仅分歧" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={queryMutation.isPending}>查询</Button>
            <Button onClick={onReset}>重置</Button>
          </Space>
        </Form.Item>
      </Form>

      {invalidHint && (
        <Alert type="warning" showIcon closable message={invalidHint} style={{ marginBottom: 16 }} onClose={() => setInvalidHint(null)} />
      )}

      <Table
        rowKey="eventId"
        columns={columns}
        dataSource={data.data}
        loading={queryMutation.isPending}
        scroll={{ x: 1200 }}
        pagination={{
          total: data.total,
          pageSize: data.pageSize,
          current: data.page,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => runQuery(filter, page, pageSize),
        }}
        locale={{ emptyText: <Empty description={searched ? '无符合条件记录' : '加载中…'} /> }}
      />

      <Drawer title="调用详情" width={760} open={detailOpen} onClose={closeDetail}>
        <InvocationDetailPanel detail={detail} loading={detailLoading} />
      </Drawer>
    </Card>
  );
}
