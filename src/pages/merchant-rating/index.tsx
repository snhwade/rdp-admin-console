import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import {
  computeMerchantRating,
  getMerchantRating,
  queryMerchantRatings,
  type MerchantRating,
  type PagedData,
} from '@/api/tools';
import type { ApiError } from '@/api/client';

const { RangePicker } = DatePicker;
const PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = ['20', '50', '100', '200'];

const LEVEL_TEXT: Record<string, string> = {
  LOW: '低',
  MID_LOW: '中低',
  MID: '中',
  MID_HIGH: '中高',
  HIGH: '高',
};

const levelColor = (lvl?: string) =>
  lvl === 'HIGH' ? 'red' : lvl === 'MID_HIGH' ? 'orange' : lvl === 'MID' ? 'gold' : 'green';

interface Filter {
  merchantId?: string;
  status?: string;
  level?: string;
  startTimeMs?: number;
  endTimeMs?: number;
}

function fmt(iso?: string): string {
  return iso ? dayjs(iso).format('YYYY-MM-DD HH:mm:ss') : '—';
}

/**
 * 商户评级页（R12.6–12.8）：列表默认按更新时间降序；支持筛选、分页与单户查询/触发评级。
 */
export default function MerchantRatingPage() {
  const [filterForm] = Form.useForm();
  const [data, setData] = useState<PagedData<MerchantRating>>({
    data: [],
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
  });
  const [filter, setFilter] = useState<Filter>({});
  const [searched, setSearched] = useState(false);
  const [invalidHint, setInvalidHint] = useState<string | null>(null);
  const [detail, setDetail] = useState<MerchantRating | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const queryMutation = useMutation({
    mutationFn: queryMerchantRatings,
    onSuccess: (paged) => {
      setData(paged);
      setSearched(true);
    },
    onError: (err: ApiError) => message.error(err.message ?? '查询失败'),
  });

  const validateFilter = (values: Record<string, unknown>): { error: string } | { filter: Filter } => {
    const merchantId = (values.merchantId as string)?.trim() || undefined;
    const status = (values.status as string) || undefined;
    const level = (values.level as string) || undefined;
    const range = values.range as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
    const startTimeMs = range?.[0]?.valueOf();
    const endTimeMs = range?.[1]?.valueOf();
    if (startTimeMs && endTimeMs && startTimeMs > endTimeMs) {
      return { error: '起始时间不得晚于结束时间' };
    }
    return { filter: { merchantId, status, level, startTimeMs, endTimeMs } };
  };

  const runQuery = (f: Filter, page = 1, pageSize = data.pageSize) => {
    setFilter(f);
    queryMutation.mutate({ ...f, page, pageSize });
  };

  const onFilterFinish = (values: Record<string, unknown>) => {
    const result = validateFilter(values);
    if ('error' in result) {
      setInvalidHint(result.error);
      return;
    }
    setInvalidHint(null);
    runQuery(result.filter, 1, data.pageSize);
  };

  const onFilterReset = () => {
    filterForm.resetFields();
    setInvalidHint(null);
    runQuery({}, 1, PAGE_SIZE);
  };

  useEffect(() => {
    runQuery({}, 1, PAGE_SIZE);
  }, []);

  const openDetail = async (merchantId: string) => {
    setActionLoading(true);
    try {
      const r = await getMerchantRating(merchantId);
      setDetail(r);
      setDetailOpen(true);
    } catch (err) {
      message.error((err as ApiError).message ?? '查询失败');
    } finally {
      setActionLoading(false);
    }
  };

  const triggerCompute = async (merchantId: string) => {
    setActionLoading(true);
    try {
      const r = await computeMerchantRating(merchantId);
      message.success('评级计算完成');
      setDetail(r);
      setDetailOpen(true);
      runQuery(filter, data.page, data.pageSize);
    } catch (err) {
      message.error((err as ApiError).message ?? '评级失败');
    } finally {
      setActionLoading(false);
    }
  };

  const columns: ColumnsType<MerchantRating> = [
    { title: '商户标识', dataIndex: 'merchantId', key: 'merchantId', width: 160, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) =>
        s === 'RATED' ? <Tag color="blue">已评级</Tag> : <Tag>未评级</Tag>,
    },
    {
      title: '评分',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      render: (v?: number) => (v != null ? v : '—'),
    },
    {
      title: '风险等级',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (lvl?: string) =>
        lvl ? (
          <Tag color={levelColor(lvl)}>{LEVEL_TEXT[lvl] ?? lvl}</Tag>
        ) : (
          '—'
        ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      render: (v?: string) => fmt(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, row) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openDetail(row.merchantId)}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            loading={actionLoading}
            onClick={() => triggerCompute(row.merchantId)}
          >
            重新评级
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title="商户评级">
      <p style={{ marginBottom: 16, color: 'rgba(0,0,0,0.45)' }}>
        展示各商户最新评级结果，默认按更新时间降序。可按商户、状态、等级与时间范围筛选。
      </p>

      <Form form={filterForm} layout="inline" onFinish={onFilterFinish} style={{ marginBottom: 16, rowGap: 8 }}>
        <Form.Item name="merchantId" label="商户标识">
          <Input allowClear placeholder="部分匹配" style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select
            allowClear
            placeholder="全部"
            style={{ width: 120 }}
            options={[
              { value: 'RATED', label: '已评级' },
              { value: 'UNRATED', label: '未评级' },
            ]}
          />
        </Form.Item>
        <Form.Item name="level" label="风险等级">
          <Select
            allowClear
            placeholder="全部"
            style={{ width: 120 }}
            options={[
              { value: 'LOW', label: '低' },
              { value: 'MID_LOW', label: '中低' },
              { value: 'MID', label: '中' },
              { value: 'MID_HIGH', label: '中高' },
              { value: 'HIGH', label: '高' },
            ]}
          />
        </Form.Item>
        <Form.Item name="range" label="更新时间">
          <RangePicker showTime />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={queryMutation.isPending}>
              查询
            </Button>
            <Button onClick={onFilterReset}>重置</Button>
          </Space>
        </Form.Item>
      </Form>

      {invalidHint && (
        <Alert
          type="warning"
          showIcon
          closable
          message={invalidHint}
          style={{ marginBottom: 16 }}
          onClose={() => setInvalidHint(null)}
        />
      )}

      <Table
        rowKey={(r) => r.merchantId}
        loading={queryMutation.isPending}
        columns={columns}
        dataSource={data.data}
        scroll={{ x: 900 }}
        pagination={{
          total: data.total,
          pageSize: data.pageSize,
          current: data.page,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => runQuery(filter, page, pageSize),
        }}
        locale={{ emptyText: <Empty description={searched ? '暂无评级记录' : '加载中…'} /> }}
      />

      <Drawer
        title="商户评级详情"
        width={480}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
        }}
      >
        {detail && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="商户标识">{detail.merchantId}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {detail.status === 'RATED' ? <Tag color="blue">已评级</Tag> : <Tag>未评级</Tag>}
            </Descriptions.Item>
            {detail.status === 'RATED' && (
              <>
                <Descriptions.Item label="评分">{detail.score ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="风险等级">
                  <Tag color={levelColor(detail.level)}>
                    {LEVEL_TEXT[detail.level ?? ''] ?? detail.level ?? '—'}
                  </Tag>
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
        )}
      </Drawer>
    </Card>
  );
}
