import { Alert, Button, Card, DatePicker, Descriptions, Drawer, Empty, Form, Input, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import InvocationDetailPanel, { decisionColor, fmtTs } from '@/components/InvocationDetailPanel';
import {
  getInvocationDetail,
  listBusinessOrderInvocations,
  queryBusinessOrders,
  type BusinessOrderSummary,
  type InvocationDetail,
  type OrderInvocationView,
  type PagedData,
} from '@/api/tools';
import type { ApiError } from '@/api/client';

const PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = ['20', '50', '100', '200'];

interface Filter {
  businessOrderId?: string;
  merchantId?: string;
  eventTypeCode?: string;
  startTimeMs?: number;
  endTimeMs?: number;
}

/** 订单维度查询：按业务订单号聚合，详情展示该订单下每次调用。 */
export default function BusinessOrdersPage() {
  const [form] = Form.useForm();
  const [data, setData] = useState<PagedData<BusinessOrderSummary>>({
    data: [],
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
  });
  const [filter, setFilter] = useState<Filter>({});
  const [searched, setSearched] = useState(false);
  const [invalidHint, setInvalidHint] = useState<string | null>(null);

  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<BusinessOrderSummary | null>(null);
  const [invocations, setInvocations] = useState<PagedData<OrderInvocationView>>({
    data: [],
    page: 1,
    pageSize: 10,
    total: 0,
  });
  const [invocationsLoading, setInvocationsLoading] = useState(false);

  const [invocationDetailOpen, setInvocationDetailOpen] = useState(false);
  const [invocationDetail, setInvocationDetail] = useState<InvocationDetail | null>(null);
  const [invocationDetailLoading, setInvocationDetailLoading] = useState(false);

  const queryMutation = useMutation({
    mutationFn: queryBusinessOrders,
    onSuccess: (paged) => {
      setData(paged);
      setSearched(true);
    },
    onError: (err: ApiError) => message.error(err.message ?? '查询失败'),
  });

  const validate = (values: Record<string, unknown>): { error: string } | { filter: Filter } => {
    const businessOrderId = (values.businessOrderId as string)?.trim() || undefined;
    const merchantId = (values.merchantId as string)?.trim() || undefined;
    const eventTypeCode = (values.eventTypeCode as string)?.trim() || undefined;
    const range = values.range as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
    const startTimeMs = range?.[0]?.valueOf();
    const endTimeMs = range?.[1]?.valueOf();

    if (startTimeMs && endTimeMs && startTimeMs > endTimeMs) {
      return { error: '起始时间不得晚于结束时间' };
    }
    return { filter: { businessOrderId, merchantId, eventTypeCode, startTimeMs, endTimeMs } };
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
    runQuery({}, 1, PAGE_SIZE);
  }, []);

  const loadInvocations = async (order: BusinessOrderSummary, page = 1, pageSize = 10) => {
    setInvocationsLoading(true);
    try {
      const paged = await listBusinessOrderInvocations(order.businessOrderId, page, pageSize);
      setInvocations(paged);
    } catch (err) {
      message.error((err as ApiError).message ?? '加载调用列表失败');
    } finally {
      setInvocationsLoading(false);
    }
  };

  const openOrderDetail = async (order: BusinessOrderSummary) => {
    setSelectedOrder(order);
    setOrderDetailOpen(true);
    await loadInvocations(order, 1, 10);
  };

  const openInvocationDetail = async (eventId: string) => {
    setInvocationDetailLoading(true);
    setInvocationDetailOpen(true);
    setInvocationDetail(null);
    try {
      const result = await getInvocationDetail(eventId);
      setInvocationDetail(result);
    } catch {
      message.warning('未找到调用详情');
      setInvocationDetailOpen(false);
    } finally {
      setInvocationDetailLoading(false);
    }
  };

  const columns: ColumnsType<BusinessOrderSummary> = [
    { title: '业务订单号', dataIndex: 'businessOrderId', key: 'businessOrderId', ellipsis: true },
    { title: '商户', dataIndex: 'merchantId', key: 'merchantId', render: (v) => v || '—', width: 120 },
    { title: '事件类型', dataIndex: 'eventTypeCode', key: 'eventTypeCode', width: 120 },
    { title: '调用次数', dataIndex: 'invocationCount', key: 'invocationCount', width: 90 },
    {
      title: '最新决策',
      dataIndex: 'latestFinalDecision',
      key: 'latestFinalDecision',
      width: 100,
      render: (d?: string) => (d ? <Tag color={decisionColor(d)}>{d}</Tag> : '—'),
    },
    {
      title: '最近调用时间',
      dataIndex: 'lastEventTimeMs',
      key: 'lastEventTimeMs',
      width: 170,
      render: (ts: number) => fmtTs(ts),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => openOrderDetail(row)}>
          详情
        </Button>
      ),
    },
  ];

  const invocationColumns: ColumnsType<OrderInvocationView> = [
    { title: '事件标识', dataIndex: 'eventId', key: 'eventId', ellipsis: true },
    {
      title: '最终决策',
      dataIndex: 'finalDecision',
      key: 'finalDecision',
      width: 100,
      render: (d?: string) => (d ? <Tag color={decisionColor(d)}>{d}</Tag> : '—'),
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
      width: 140,
      fixed: 'right',
      render: (_, row) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openInvocationDetail(row.eventId)}>
            调用详情
          </Button>
          <Link to={`/decision-invocations?eventId=${encodeURIComponent(row.eventId)}`}>跳转</Link>
          <Link to={`/observability?eventId=${encodeURIComponent(row.eventId)}`}>执行链路</Link>
        </Space>
      ),
    },
  ];

  return (
    <Card title="订单查询">
      <p style={{ marginBottom: 16, color: 'rgba(0,0,0,0.45)' }}>
        订单维度：按业务订单号聚合多次风控调用。进入详情可查看该订单下每次检查的时间与决策，并可展开单次调用的引擎与 AI 明细。
      </p>
      <Form form={form} layout="inline" onFinish={onFinish} style={{ marginBottom: 16, rowGap: 8 }}>
        <Form.Item name="businessOrderId" label="业务订单号">
          <Input allowClear style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name="merchantId" label="商户">
          <Input allowClear style={{ width: 140 }} />
        </Form.Item>
        <Form.Item name="eventTypeCode" label="事件类型">
          <Input allowClear style={{ width: 140 }} />
        </Form.Item>
        <Form.Item name="range" label="时间范围">
          <DatePicker.RangePicker showTime />
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
        rowKey="businessOrderId"
        columns={columns}
        dataSource={data.data}
        loading={queryMutation.isPending}
        pagination={{
          total: data.total,
          pageSize: data.pageSize,
          current: data.page,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => runQuery(filter, page, pageSize),
        }}
        locale={{ emptyText: <Empty description={searched ? '无符合条件订单' : '加载中…'} /> }}
      />

      <Drawer
        title="订单详情"
        width={720}
        open={orderDetailOpen}
        onClose={() => setOrderDetailOpen(false)}
      >
        {selectedOrder && (
          <>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="业务订单号">{selectedOrder.businessOrderId}</Descriptions.Item>
              <Descriptions.Item label="商户">{selectedOrder.merchantId ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="事件类型">{selectedOrder.eventTypeCode ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="调用次数">{selectedOrder.invocationCount}</Descriptions.Item>
              <Descriptions.Item label="最近调用">{fmtTs(selectedOrder.lastEventTimeMs)}</Descriptions.Item>
              <Descriptions.Item label="最新决策">
                {selectedOrder.latestFinalDecision
                  ? <Tag color={decisionColor(selectedOrder.latestFinalDecision)}>{selectedOrder.latestFinalDecision}</Tag>
                  : '—'}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <strong>各次调用</strong>
              <Table
                rowKey="eventId"
                style={{ marginTop: 12 }}
                size="small"
                columns={invocationColumns}
                dataSource={invocations.data}
                loading={invocationsLoading}
                pagination={{
                  total: invocations.total,
                  pageSize: invocations.pageSize,
                  current: invocations.page,
                  showTotal: (total) => `共 ${total} 次调用`,
                  onChange: (page, pageSize) => {
                    if (selectedOrder) {
                      loadInvocations(selectedOrder, page, pageSize);
                    }
                  },
                }}
              />
            </div>
          </>
        )}
      </Drawer>

      <Drawer
        title="调用详情"
        width={760}
        open={invocationDetailOpen}
        onClose={() => setInvocationDetailOpen(false)}
      >
        <InvocationDetailPanel detail={invocationDetail} loading={invocationDetailLoading} />
      </Drawer>
    </Card>
  );
}
