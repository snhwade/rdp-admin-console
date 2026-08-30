import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  activateAiModel,
  createTrainingSchedule,
  deleteTrainingSchedule,
  listAiModels,
  listTrainingSchedules,
  probeAiScore,
  queryAiDecisionStats,
  queryTrainingJobs,
  runTrainingScheduleNow,
  submitTrainingJob,
  updateAiModelMeta,
  updateTrainingSchedule,
  type ModelKindSummary,
  type ModelVersionRow,
  type PagedData,
  type TrainingJob,
  type TrainingSchedule,
} from '@/api/tools';
import { getAgentRuntime } from '@/api/config';
import type { ApiError } from '@/api/client';

const { RangePicker } = DatePicker;
const PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = ['20', '50', '100', '200'];

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: 'green',
  RUNNING: 'blue',
  FAILED: 'red',
  SKIPPED: 'orange',
};

type TabKey = 'plans' | 'jobs' | 'models';

interface Filter {
  jobId?: string;
  status?: string;
  startTimeMs?: number;
  endTimeMs?: number;
}

function fmt(iso?: string): string {
  return iso ? dayjs(iso).format('YYYY-MM-DD HH:mm:ss') : '—';
}

function fmtTs(ts?: number): string {
  return ts ? dayjs.unix(ts).format('YYYY-MM-DD HH:mm:ss') : '—';
}

function dataRangeText(job: TrainingJob): string {
  if (!job.dataFrom && !job.dataTo) return '—';
  return `${fmt(job.dataFrom)} ~ ${fmt(job.dataTo)}`;
}

function metricText(metrics: Record<string, unknown> | undefined, key: string): string {
  const v = metrics?.[key];
  return v != null ? String(v) : '—';
}

/**
 * 模型训练中心：训练计划（配置）/ 训练任务（运行历史）/ 模型管理（生效版本）。
 * 顶部串联在线评分可用性与 Agent 采纳模式入口。
 */
export default function AiTrainingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as TabKey) || 'jobs';
  const setTab = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

  const { data: agentRuntime } = useQuery({
    queryKey: ['agent-runtime'],
    queryFn: getAgentRuntime,
    staleTime: 60_000,
  });

  const modelsQuery = useQuery({
    queryKey: ['ai-models'],
    queryFn: listAiModels,
    refetchInterval: 30_000,
  });

  const statsQuery = useQuery({
    queryKey: ['ai-decision-stats'],
    queryFn: () => queryAiDecisionStats(),
    refetchInterval: 60_000,
  });

  const fraudStatus = useMemo(() => {
    const fraud = modelsQuery.data?.find((m) => m.modelKind === 'fraud');
    return fraud;
  }, [modelsQuery.data]);

  return (
    <Card title="模型训练">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="智能决策链路"
        description={
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Typography.Text>
              训练产出模型 → 在「模型管理」启用当前版本 → 决策流 MODEL 节点走在线评分；
              Agent 旁路采纳模式见「AI Agent 策略」。
            </Typography.Text>
            <Space wrap size="middle">
              <span>
                在线评分（fraud）：
                {modelsQuery.isLoading ? (
                  '加载中…'
                ) : fraudStatus?.scoringAvailable ? (
                  <Tag color="green">可用 · {fraudStatus.currentVersion ?? '—'}</Tag>
                ) : (
                  <Tag color="orange">{fraudStatus?.scoringReason ?? '不可用'}</Tag>
                )}
              </span>
              <span>
                Agent 采纳：
                <Tag>{agentRuntime?.defaultAdoptionMode ?? '—'}</Tag>
              </span>
              <Link to="/agent-strategies">配置 Agent 策略 / 采纳</Link>
              <Link to="/decision-invocations">查看调用与 AI 分歧</Link>
            </Space>
          </Space>
        }
      />

      <Card size="small" title="运行通用统计（IS）" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={4}>
            <Statistic title="AI 调用总数" value={statsQuery.data?.total ?? 0} loading={statsQuery.isFetching} />
          </Col>
          <Col span={4}>
            <Statistic
              title="失败率"
              value={((statsQuery.data?.failRate ?? 0) * 100).toFixed(1)}
              suffix="%"
              loading={statsQuery.isFetching}
            />
          </Col>
          <Col span={4}>
            <Statistic title="超时" value={statsQuery.data?.timedOut ?? 0} loading={statsQuery.isFetching} />
          </Col>
          <Col span={4}>
            <Statistic
              title="分歧率"
              value={((statsQuery.data?.divergenceRate ?? 0) * 100).toFixed(1)}
              suffix="%"
              loading={statsQuery.isFetching}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="评分 available 率"
              value={((statsQuery.data?.modelScoreAvailableRate ?? 0) * 100).toFixed(1)}
              suffix="%"
              loading={statsQuery.isFetching}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="评分调用"
              value={statsQuery.data?.modelScoreCalls ?? 0}
              loading={statsQuery.isFetching}
            />
          </Col>
        </Row>
        {(statsQuery.data?.byAdoptionMode?.length ?? 0) > 0 && (
          <Space wrap style={{ marginTop: 12 }}>
            <Typography.Text type="secondary">采纳模式分布：</Typography.Text>
            {statsQuery.data!.byAdoptionMode!.map((b) => (
              <Tag key={b.adoptionMode}>
                {b.adoptionMode} · {b.total}
              </Tag>
            ))}
          </Space>
        )}
      </Card>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'plans',
            label: '训练计划',
            children: (
              <PlansPanel
                onJobTriggered={() => {
                  setTab('jobs');
                  modelsQuery.refetch();
                }}
              />
            ),
          },
          {
            key: 'jobs',
            label: '训练任务',
            children: (
              <JobsPanel
                onGoModels={() => setTab('models')}
                onRefreshModels={() => modelsQuery.refetch()}
              />
            ),
          },
          {
            key: 'models',
            label: '模型管理',
            children: (
              <ModelsPanel
                models={modelsQuery.data ?? []}
                loading={modelsQuery.isFetching}
                onReload={() => modelsQuery.refetch()}
              />
            ),
          },
        ]}
      />
    </Card>
  );
}

function PlansPanel({ onJobTriggered }: { onJobTriggered: () => void }) {
  const [schedules, setSchedules] = useState<TrainingSchedule[]>([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TrainingSchedule | null>(null);
  const [scheduleForm] = Form.useForm();

  const loadSchedules = () => {
    listTrainingSchedules().then(setSchedules).catch((err: ApiError) => {
      message.error(err.message ?? '加载计划失败');
    });
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const openCreateSchedule = () => {
    setEditingSchedule(null);
    scheduleForm.setFieldsValue({
      name: '',
      cronExpression: '0 2 * * *',
      windowDays: 30,
      enabled: true,
    });
    setScheduleModalOpen(true);
  };

  const openEditSchedule = (row: TrainingSchedule) => {
    setEditingSchedule(row);
    scheduleForm.setFieldsValue({
      name: row.name,
      cronExpression: row.cronExpression,
      windowDays: row.windowDays,
      enabled: row.enabled,
    });
    setScheduleModalOpen(true);
  };

  const onScheduleSubmit = async (values: {
    name: string;
    cronExpression: string;
    windowDays: number;
    enabled: boolean;
  }) => {
    try {
      if (editingSchedule?.id != null) {
        await updateTrainingSchedule(editingSchedule.id, values);
        message.success('计划已更新');
      } else {
        await createTrainingSchedule(values);
        message.success('计划已创建');
      }
      setScheduleModalOpen(false);
      loadSchedules();
    } catch (err) {
      const apiErr = err as ApiError;
      message.error(apiErr.message ?? '保存失败');
    }
  };

  const onDeleteSchedule = async (id: number) => {
    try {
      await deleteTrainingSchedule(id);
      message.success('计划已删除');
      loadSchedules();
    } catch (err) {
      const apiErr = err as ApiError;
      message.error(apiErr.message ?? '删除失败');
    }
  };

  const onRunScheduleNow = async (id: number) => {
    try {
      const result = await runTrainingScheduleNow(id);
      if (result.outcome === 'SKIPPED') {
        message.warning(result.reason ?? '已跳过');
      } else {
        message.success('已触发训练');
        onJobTriggered();
      }
      loadSchedules();
    } catch (err) {
      const apiErr = err as ApiError;
      message.error(apiErr.message ?? '触发失败');
    }
  };

  const scheduleColumns: ColumnsType<TrainingSchedule> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: '名称', dataIndex: 'name', key: 'name', width: 140 },
    { title: 'Cron', dataIndex: 'cronExpression', key: 'cronExpression', width: 120 },
    { title: '数据窗口(天)', dataIndex: 'windowDays', key: 'windowDays', width: 110 },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v: boolean) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '上次结果',
      dataIndex: 'lastRunStatus',
      key: 'lastRunStatus',
      width: 100,
      render: (s?: string) => (s ? <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag> : '—'),
    },
    {
      title: '备注',
      dataIndex: 'lastFailReason',
      key: 'lastFailReason',
      ellipsis: true,
      render: (v?: string) => v ?? '—',
    },
    {
      title: '上次触发',
      dataIndex: 'lastTriggeredAt',
      key: 'lastTriggeredAt',
      width: 170,
      render: (v?: string) => fmt(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, row) =>
        row.id != null ? (
          <Space size="small">
            <Button type="link" size="small" onClick={() => openEditSchedule(row)}>
              编辑
            </Button>
            <Button type="link" size="small" onClick={() => onRunScheduleNow(row.id!)}>
              立即执行
            </Button>
            <Popconfirm title="确认删除该计划？" onConfirm={() => onDeleteSchedule(row.id!)}>
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ) : null,
    },
  ];

  return (
    <>
      <p style={{ marginBottom: 12, color: 'rgba(0,0,0,0.45)' }}>
        配置定时重训：Cron 五段式（如 <code>0 2 * * *</code> 每天 02:00）；数据窗口为「当前时刻往前 N 天」。
        若已有 RUNNING 任务则自动跳过。
      </p>
      <div style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={openCreateSchedule}>
          新建计划
        </Button>
      </div>
      <Table
        rowKey={(r) => String(r.id ?? r.name)}
        columns={scheduleColumns}
        dataSource={schedules}
        pagination={false}
        scroll={{ x: 1000 }}
        locale={{ emptyText: <Empty description="暂无定时计划" /> }}
      />
      <Modal
        title={editingSchedule ? '编辑定时计划' : '新建定时计划'}
        open={scheduleModalOpen}
        onCancel={() => setScheduleModalOpen(false)}
        onOk={() => scheduleForm.submit()}
        destroyOnClose
      >
        <Form form={scheduleForm} layout="vertical" onFinish={onScheduleSubmit}>
          <Form.Item name="name" label="计划名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：每日凌晨训练" />
          </Form.Item>
          <Form.Item
            name="cronExpression"
            label="Cron 表达式"
            rules={[{ required: true, message: '请输入 Cron' }]}
            extra="五段式，如 0 2 * * *（每天 02:00）"
          >
            <Input placeholder="0 2 * * *" />
          </Form.Item>
          <Form.Item
            name="windowDays"
            label="数据窗口（天）"
            rules={[{ required: true, message: '请输入窗口天数' }]}
          >
            <InputNumber min={1} max={365} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function JobsPanel({
  onGoModels,
  onRefreshModels,
}: {
  onGoModels: () => void;
  onRefreshModels: () => void;
}) {
  const [submitForm] = Form.useForm();
  const [filterForm] = Form.useForm();
  const [data, setData] = useState<PagedData<TrainingJob>>({
    data: [],
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
  });
  const [filter, setFilter] = useState<Filter>({});
  const [searched, setSearched] = useState(false);
  const [invalidHint, setInvalidHint] = useState<string | null>(null);
  const [detail, setDetail] = useState<TrainingJob | null>(null);
  const [failHint, setFailHint] = useState<string | null>(null);

  const queryMutation = useMutation({
    mutationFn: queryTrainingJobs,
    onSuccess: (paged) => {
      setData(paged);
      setSearched(true);
    },
    onError: (err: ApiError) => message.error(err.message ?? '查询失败'),
  });

  const submitMutation = useMutation({
    mutationFn: submitTrainingJob,
    onSuccess: (job) => {
      const j = job as TrainingJob;
      if (j?.status === 'FAILED') {
        setFailHint(`训练失败：${j.failReason ?? '未提供失败原因'}`);
      } else {
        setFailHint(null);
        message.success('训练任务已提交');
        onRefreshModels();
      }
      runQuery(filter, 1, data.pageSize);
    },
    onError: (err: ApiError) => {
      setFailHint(err?.message ?? '训练请求被拒绝');
    },
  });

  const validateFilter = (values: Record<string, unknown>): { error: string } | { filter: Filter } => {
    const jobId = (values.jobId as string)?.trim() || undefined;
    const status = (values.status as string) || undefined;
    const range = values.range as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
    const startTimeMs = range?.[0]?.valueOf();
    const endTimeMs = range?.[1]?.valueOf();
    if (startTimeMs && endTimeMs && startTimeMs > endTimeMs) {
      return { error: '起始时间不得晚于结束时间' };
    }
    return { filter: { jobId, status, startTimeMs, endTimeMs } };
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

  const onSubmit = (values: { range: [dayjs.Dayjs, dayjs.Dayjs] }) => {
    const [from, to] = values.range;
    setFailHint(null);
    submitMutation.mutate({ dataFrom: from.toISOString(), dataTo: to.toISOString() });
  };

  const columns: ColumnsType<TrainingJob> = [
    { title: '任务 ID', dataIndex: 'jobId', key: 'jobId', ellipsis: true, width: 180 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag>,
    },
    {
      title: '训练数据范围',
      key: 'dataRange',
      width: 280,
      render: (_, row) => dataRangeText(row),
    },
    {
      title: '模型版本',
      dataIndex: 'modelVersion',
      key: 'modelVersion',
      width: 140,
      render: (v?: string) => v ?? '—',
    },
    {
      title: 'AUC',
      key: 'auc',
      width: 90,
      render: (_, row) => (row.metrics?.auc != null ? String(row.metrics.auc) : '—'),
    },
    {
      title: '样本量',
      dataIndex: 'sampleCount',
      key: 'sampleCount',
      width: 90,
      render: (v?: number) => v ?? '—',
    },
    {
      title: '失败原因',
      dataIndex: 'failReason',
      key: 'failReason',
      ellipsis: true,
      width: 180,
      render: (reason?: string) =>
        reason ? <span style={{ color: '#cf1322' }}>{reason}</span> : '—',
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 170,
      render: (v?: string) => fmt(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => setDetail(row)}>
          详情
        </Button>
      ),
    },
  ];

  const metrics = detail?.metrics ?? {};
  const topFeatures = (metrics.topFeatures as string[] | undefined) ?? [];
  const featureImportances =
    (metrics.featureImportances as Record<string, number> | undefined) ?? {};

  return (
    <>
      <Card size="small" title="手动触发训练" style={{ marginBottom: 16 }}>
        <Form form={submitForm} layout="inline" onFinish={onSubmit}>
          <Form.Item
            name="range"
            label="训练数据时间范围"
            rules={[{ required: true, message: '请选择数据时间范围' }]}
          >
            <RangePicker showTime />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitMutation.isPending}>
              触发训练
            </Button>
          </Form.Item>
          <Form.Item>
            <Button type="link" onClick={onGoModels}>
              去模型管理启用版本
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {failHint && (
        <Alert
          type="error"
          showIcon
          closable
          message="训练未成功"
          description={failHint}
          style={{ marginBottom: 16 }}
          onClose={() => setFailHint(null)}
        />
      )}

      <Form
        form={filterForm}
        layout="inline"
        onFinish={onFilterFinish}
        style={{ marginBottom: 16, rowGap: 8 }}
      >
        <Form.Item name="jobId" label="任务 ID">
          <Input allowClear placeholder="部分匹配" style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select
            allowClear
            placeholder="全部"
            style={{ width: 120 }}
            options={[
              { value: 'SUCCESS', label: 'SUCCESS' },
              { value: 'RUNNING', label: 'RUNNING' },
              { value: 'FAILED', label: 'FAILED' },
            ]}
          />
        </Form.Item>
        <Form.Item name="range" label="任务开始时间">
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
        rowKey={(r) => r.jobId ?? Math.random().toString()}
        loading={queryMutation.isPending}
        columns={columns}
        dataSource={data.data}
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
        locale={{ emptyText: <Empty description={searched ? '暂无训练任务' : '加载中…'} /> }}
      />

      <Drawer title="训练任务详情" width={520} open={detail != null} onClose={() => setDetail(null)}>
        {detail && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="任务 ID">{detail.jobId ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{fmt(detail.startedAt)}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{fmt(detail.finishedAt)}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_COLOR[detail.status] ?? 'default'}>{detail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="训练数据范围">{dataRangeText(detail)}</Descriptions.Item>
              <Descriptions.Item label="模型版本">{detail.modelVersion ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="样本量">{detail.sampleCount ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="AUC">{String(metrics.auc ?? '—')}</Descriptions.Item>
              <Descriptions.Item label="KS">{String(metrics.ks ?? '—')}</Descriptions.Item>
              <Descriptions.Item label="准确率">{String(metrics.accuracy ?? '—')}</Descriptions.Item>
              <Descriptions.Item label="评估方式">{String(metrics.evalMethod ?? '—')}</Descriptions.Item>
              {detail.failReason && (
                <Descriptions.Item label="失败原因">
                  <span style={{ color: '#cf1322' }}>{detail.failReason}</span>
                </Descriptions.Item>
              )}
            </Descriptions>

            {topFeatures.length > 0 && (
              <Card size="small" title="Top 特征重要度（可解释）">
                {topFeatures.map((f) => (
                  <div key={f} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{f}</span>
                    <span>{featureImportances[f] != null ? featureImportances[f] : '—'}</span>
                  </div>
                ))}
              </Card>
            )}

            {detail.status === 'SUCCESS' && detail.modelVersion && (
              <Button type="primary" onClick={onGoModels}>
                在模型管理中启用 {detail.modelVersion}
              </Button>
            )}
          </Space>
        )}
      </Drawer>
    </>
  );
}

function ModelsPanel({
  models,
  loading,
  onReload,
}: {
  models: ModelKindSummary[];
  loading: boolean;
  onReload: () => void;
}) {
  const [selectedKind, setSelectedKind] = useState<string>('fraud');
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const [probeHint, setProbeHint] = useState<string | null>(null);
  const [kindDescDraft, setKindDescDraft] = useState('');
  const [versionDescModal, setVersionDescModal] = useState<ModelVersionRow | null>(null);
  const [versionDescDraft, setVersionDescDraft] = useState('');

  useEffect(() => {
    if (models.length && !models.find((m) => m.modelKind === selectedKind)) {
      setSelectedKind(models[0].modelKind);
    }
  }, [models, selectedKind]);

  const current = models.find((m) => m.modelKind === selectedKind);

  useEffect(() => {
    setKindDescDraft(current?.description ?? '');
  }, [current?.modelKind, current?.description]);

  const activateMutation = useMutation({
    mutationFn: ({ kind, version }: { kind: string; version: string }) =>
      activateAiModel(kind, version),
    onSuccess: () => {
      message.success('已设为当前生效版本');
      onReload();
    },
    onError: (err: ApiError) => message.error(err.message ?? '启用失败'),
  });

  const kindDescMutation = useMutation({
    mutationFn: () => updateAiModelMeta(selectedKind, { description: kindDescDraft }),
    onSuccess: () => {
      message.success('类别描述已保存');
      onReload();
    },
    onError: (err: ApiError) => message.error(err.message ?? '保存失败'),
  });

  const versionDescMutation = useMutation({
    mutationFn: () =>
      updateAiModelMeta(selectedKind, {
        version: versionDescModal!.version,
        versionDescription: versionDescDraft,
      }),
    onSuccess: () => {
      message.success('版本备注已保存');
      setVersionDescModal(null);
      onReload();
    },
    onError: (err: ApiError) => message.error(err.message ?? '保存失败'),
  });

  const onProbe = async () => {
    try {
      const res = await probeAiScore({ modelRef: selectedKind, features: {} });
      if (res.available) {
        setProbeHint(
          `在线评分可用：kind=${res.modelKind ?? selectedKind} version=${res.modelVersion ?? '—'} score=${res.score ?? '—'}`,
        );
      } else {
        setProbeHint(`在线评分不可用：${res.reason ?? '未知原因'}`);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setProbeHint(apiErr.message ?? '探测失败');
    }
  };

  const openVersionDesc = (row: ModelVersionRow) => {
    setVersionDescModal(row);
    setVersionDescDraft(row.description ?? '');
  };

  const versionColumns: ColumnsType<ModelVersionRow> = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 200,
      render: (v: string, row) => (
        <Space>
          <span>{v}</span>
          {row.current ? <Tag color="green">当前生效</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'AUC',
      key: 'auc',
      width: 90,
      render: (_, row) => metricText(row.metrics, 'auc'),
    },
    {
      title: 'KS',
      key: 'ks',
      width: 90,
      render: (_, row) => metricText(row.metrics, 'ks'),
    },
    {
      title: '准确率',
      key: 'accuracy',
      width: 90,
      render: (_, row) => metricText(row.metrics, 'accuracy'),
    },
    {
      title: '样本量',
      key: 'sampleCount',
      width: 90,
      render: (_, row) => metricText(row.metrics, 'sampleCount'),
    },
    {
      title: '备注',
      dataIndex: 'description',
      key: 'description',
      width: 220,
      ellipsis: true,
      render: (v?: string | null) => v || '—',
    },
    {
      title: '保存时间',
      dataIndex: 'createdAtTs',
      key: 'createdAtTs',
      width: 170,
      render: (ts: number) => fmtTs(ts),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, row) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openVersionDesc(row)}>
            备注
          </Button>
          {row.current ? (
            <Tag>已启用</Tag>
          ) : (
            <Popconfirm
              title="启用前请核对通用指标"
              description={
                <div>
                  <div>版本：{row.version}</div>
                  <div>AUC：{metricText(row.metrics, 'auc')}</div>
                  <div>KS：{metricText(row.metrics, 'ks')}</div>
                  <div style={{ marginTop: 4, color: 'rgba(0,0,0,0.45)' }}>
                    训练成功不会自动设为当前；需手动启用。
                  </div>
                </div>
              }
              onConfirm={() => activateMutation.mutate({ kind: selectedKind, version: row.version })}
            >
              <Button type="link" size="small" loading={activateMutation.isPending}>
                启用
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const compareRows = (current?.versions ?? []).filter((v) => compareKeys.includes(v.version));

  return (
    <>
      <p style={{ marginBottom: 12, color: 'rgba(0,0,0,0.45)' }}>
        管理已落盘模型版本：查看 AUC/KS 等通用指标、切换当前生效版本（在线评分默认加载当前版本）。
        训练成功默认<strong>不</strong>自动设为当前生效，需在此手动启用；启用前请核对指标。
        可为模型类别与各版本填写描述/备注，方便多人协作理解用途。
      </p>

      <Space wrap style={{ marginBottom: 16 }}>
        <span>模型类别</span>
        <Select
          value={selectedKind}
          style={{ width: 160 }}
          options={(models.length ? models : [{ modelKind: 'fraud' }]).map((m) => ({
            value: m.modelKind,
            label: m.modelKind,
          }))}
          onChange={setSelectedKind}
        />
        <Button onClick={onReload} loading={loading}>
          刷新
        </Button>
        <Button onClick={onProbe}>探测在线评分</Button>
        <Link to="/agent-strategies">Agent 采纳模式</Link>
      </Space>

      {current && (
        <Card size="small" title="类别说明" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input.TextArea
              rows={2}
              maxLength={512}
              showCount
              value={kindDescDraft}
              onChange={(e) => setKindDescDraft(e.target.value)}
              placeholder="如：欺诈评分模型，供决策流 MODEL 节点 /ai/score 使用"
            />
            <Button
              type="primary"
              loading={kindDescMutation.isPending}
              onClick={() => kindDescMutation.mutate()}
            >
              保存类别描述
            </Button>
          </Space>
          <Descriptions bordered size="small" column={2} style={{ marginTop: 12 }}>
            <Descriptions.Item label="当前生效">{current.currentVersion ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="在线评分">
              {current.scoringAvailable ? (
                <Tag color="green">可用</Tag>
              ) : (
                <Tag color="orange">{current.scoringReason ?? '不可用'}</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {probeHint && (
        <Alert
          type="info"
          showIcon
          closable
          message={probeHint}
          style={{ marginBottom: 16 }}
          onClose={() => setProbeHint(null)}
        />
      )}

      <Table
        rowKey="version"
        loading={loading}
        columns={versionColumns}
        dataSource={current?.versions ?? []}
        rowSelection={{
          selectedRowKeys: compareKeys,
          onChange: (keys) => setCompareKeys(keys as string[]),
        }}
        pagination={false}
        scroll={{ x: 1100 }}
        locale={{ emptyText: <Empty description="暂无已保存模型，请先在「训练任务」中完成一次训练" /> }}
      />

      {compareRows.length >= 2 && (
        <Card size="small" title="指标对比" style={{ marginTop: 16 }}>
          <Table
            size="small"
            pagination={false}
            rowKey="version"
            dataSource={compareRows}
            columns={[
              { title: '版本', dataIndex: 'version', key: 'version' },
              {
                title: 'AUC',
                key: 'auc',
                render: (_, row) => metricText(row.metrics, 'auc'),
              },
              {
                title: 'KS',
                key: 'ks',
                render: (_, row) => metricText(row.metrics, 'ks'),
              },
              {
                title: '准确率',
                key: 'accuracy',
                render: (_, row) => metricText(row.metrics, 'accuracy'),
              },
              {
                title: '样本量',
                key: 'sampleCount',
                render: (_, row) => metricText(row.metrics, 'sampleCount'),
              },
              {
                title: '状态',
                key: 'current',
                render: (_, row) => (row.current ? <Tag color="green">当前</Tag> : '—'),
              },
              {
                title: '备注',
                dataIndex: 'description',
                key: 'description',
                ellipsis: true,
                render: (v?: string | null) => v || '—',
              },
            ]}
          />
        </Card>
      )}

      <Modal
        title={versionDescModal ? `版本备注：${versionDescModal.version}` : '版本备注'}
        open={versionDescModal != null}
        onCancel={() => setVersionDescModal(null)}
        onOk={() => versionDescMutation.mutate()}
        confirmLoading={versionDescMutation.isPending}
        destroyOnClose
      >
        <Input.TextArea
          rows={3}
          maxLength={512}
          showCount
          value={versionDescDraft}
          onChange={(e) => setVersionDescDraft(e.target.value)}
          placeholder="如：2026-08 补训，针对大额误报下调"
        />
      </Modal>
    </>
  );
}
