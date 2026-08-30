import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
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
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRatingModel,
  getRatingModel,
  listRatingModels,
  listScenarioTree,
  mergeRatingItemsForSave,
  saveRatingModel,
  inferGradingMode,
  updateRatingModelStatus,
  type CreateRatingModelBody,
  type DirectGradingItem,
  type GradeBand,
  type RatingExecutionMode,
  type RatingGradingMode,
  type RatingItem,
  type RatingModelCardView,
  type RatingModelStatus,
  type RatingModelVersionView,
  type RatingSubject,
  type ScenarioTreeNode,
} from '@/api/console';
import { toFieldErrors, type ApiError } from '@/api/client';
import { buildEventSelectOptions, resolveEventPath } from '@/utils/scenarioEventDisplay';
import GradeBandEditor, { validateGradeBands } from './GradeBandEditor';
import RatingItemConfigPanel from './RatingItemConfigPanel';

/**
 * 评级模型卡片墙、详情三页签与可视化等级区间编辑页
 * （risk-console-redesign R10.1 / R10.4 / R10.5 / R11.1）。
 *
 * 布局：
 * - 全宽评级模型卡片墙：卡片展示名称、事件路径、标签（商户·实时 / 对私客户·定时）、
 *   状态（已上线 / 已下线）。顶部提供搜索、执行方式筛选、评级主体筛选与「新建评级模型」入口（R10.1）。
 * - 进入详情 → 三页签：评级模型（配置：定级方式 / 等级区间 / 子项）、源码（当前版本
 *   配置 JSON）、版本历史（含上线 / 下线切换）（R10.4 / R10.5）。
 * - 评级模型页内嵌可视化等级区间滑条编辑器，保存经 saveRatingModel 落库（R11.1 / R11.5）。
 *
 * 命名中性化（R1）：本页仅从 `@/api/console` import 中性 API，不引用旧版共享 API 模块。
 */

const { Text, Paragraph } = Typography;

/** 评级模型状态展示元数据。 */
const MODEL_STATUS_META: Record<string, { label: string; color: string }> = {
  ONLINE: { label: '已上线', color: 'green' },
  OFFLINE: { label: '已下线', color: 'default' },
};

/** 执行方式展示文案（R10.1 标签）。 */
const EXECUTION_MODE_LABEL: Record<string, string> = {
  REALTIME: '实时',
  SCHEDULED: '定时',
};

/** 评级主体展示文案（R10.1 标签）。 */
const SUBJECT_LABEL: Record<string, string> = {
  MERCHANT: '商户',
  INDIVIDUAL: '对私客户',
};

/** 定级方式展示文案。 */
const GRADING_MODE_LABEL: Record<string, string> = {
  SCORE_BASED: '评分定级',
  DIRECT: '直接定级',
  MIXED: '评分+直接',
};

const EXECUTION_MODE_OPTIONS: { label: string; value: RatingExecutionMode }[] = [
  { label: '实时', value: 'REALTIME' },
  { label: '定时', value: 'SCHEDULED' },
];

const SUBJECT_OPTIONS: { label: string; value: RatingSubject }[] = [
  { label: '商户', value: 'MERCHANT' },
  { label: '对私客户', value: 'INDIVIDUAL' },
];

function modelStatusTag(status: RatingModelStatus) {
  const meta = MODEL_STATUS_META[String(status)] ?? { label: String(status), color: 'default' };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

/** 卡片标签：商户·实时 / 对私客户·定时。 */
function modelTagText(model: { subject: RatingSubject; executionMode: RatingExecutionMode }): string {
  const subject = SUBJECT_LABEL[String(model.subject)] ?? String(model.subject);
  const mode = EXECUTION_MODE_LABEL[String(model.executionMode)] ?? String(model.executionMode);
  return `${subject}·${mode}`;
}

interface CreateModelFormValues {
  name: string;
  eventCode: string;
  executionMode: RatingExecutionMode;
  subject: RatingSubject;
}

export default function RatingModelWallPage() {
  const queryClient = useQueryClient();
  const [createForm] = Form.useForm<CreateModelFormValues>();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [executionFilter, setExecutionFilter] = useState<'ALL' | RatingExecutionMode>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<'ALL' | RatingSubject>('ALL');
  const [keyword, setKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const [detailModel, setDetailModel] = useState<RatingModelCardView | null>(null);

  const { data: scenarioTree = [] } = useQuery({
    queryKey: ['scenario-tree'],
    queryFn: listScenarioTree,
  });

  const eventSelectOptions = useMemo(
    () => buildEventSelectOptions(scenarioTree as ScenarioTreeNode[]),
    [scenarioTree],
  );

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['rating-models', executionFilter, subjectFilter],
    queryFn: () =>
      listRatingModels({
        executionMode: executionFilter === 'ALL' ? undefined : executionFilter,
        subject: subjectFilter === 'ALL' ? undefined : subjectFilter,
      }),
  });

  const modelEventPath = (model: RatingModelCardView) =>
    resolveEventPath(model.eventPath, scenarioTree as ScenarioTreeNode[]);

  const filteredModels = useMemo(
    () => {
      const kw = keyword.trim().toLowerCase();
      if (kw === '') {
        return models;
      }
      return models.filter(
        (m) =>
          m.name.toLowerCase().includes(kw) || modelEventPath(m).toLowerCase().includes(kw),
      );
    },
    [models, keyword, scenarioTree],
  );

  useEffect(() => {
    if (createOpen) {
      createForm.resetFields();
      createForm.setFieldsValue({
        executionMode: 'REALTIME',
        subject: 'MERCHANT',
      });
    }
  }, [createOpen, createForm]);

  const invalidateModels = () => {
    queryClient.invalidateQueries({ queryKey: ['rating-models'] });
  };

  const echoFieldErrors = (err: ApiError, fallback: string) => {
    const fieldErrors = toFieldErrors(err);
    const formErrors = Object.entries(fieldErrors).map(([name, msg]) => ({
      name: name as keyof CreateModelFormValues,
      errors: [msg],
    }));
    if (formErrors.length > 0) {
      createForm.setFields(formErrors);
    } else {
      message.error(err.message ?? fallback);
    }
  };

  const createMutation = useMutation({
    mutationFn: (body: CreateRatingModelBody) => createRatingModel(body),
    onSuccess: () => {
      message.success('评级模型创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      invalidateModels();
    },
    onError: (err: ApiError) => echoFieldErrors(err, '创建失败'),
  });

  const handleCreateSubmit = (values: CreateModelFormValues) => {
    createMutation.mutate({
      name: values.name,
      eventCode: values.eventCode,
      executionMode: values.executionMode,
      subject: values.subject,
      gradingMode: 'MIXED',
    });
  };

  /** 卡片网格视图。 */
  const renderGrid = () => (
    <Row gutter={[16, 16]}>
      {filteredModels.map((model) => (
        <Col key={model.id} xs={24} sm={12} lg={8} xxl={6}>
          <Card
            hoverable
            size="small"
            onClick={() => setDetailModel(model)}
            title={<Text strong>{model.name}</Text>}
            extra={modelStatusTag(model.status)}
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text type="secondary">事件路径：{modelEventPath(model)}</Text>
              <Space size={4} wrap>
                <Tag color="blue">{modelTagText(model)}</Tag>
                <Tag>{GRADING_MODE_LABEL[String(model.gradingMode)] ?? model.gradingMode}</Tag>
              </Space>
              <Button
                type="link"
                size="small"
                style={{ padding: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailModel(model);
                }}
              >
                编辑配置
              </Button>
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  );

  /** 列表视图。 */
  const listColumns: ColumnsType<RatingModelCardView> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '事件路径',
      dataIndex: 'eventPath',
      key: 'eventPath',
      render: (_v, model) => modelEventPath(model),
    },
    {
      title: '标签',
      key: 'tag',
      render: (_, model) => <Tag color="blue">{modelTagText(model)}</Tag>,
    },
    {
      title: '定级方式',
      dataIndex: 'gradingMode',
      key: 'gradingMode',
      render: (m: RatingGradingMode) => <Tag>{GRADING_MODE_LABEL[String(m)] ?? m}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: RatingModelStatus) => modelStatusTag(s),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, model) => (
        <Button type="link" size="small" onClick={() => setDetailModel(model)}>
          编辑配置
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card
        title="评级模型"
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
              value={executionFilter}
              onChange={(v) => setExecutionFilter(v as 'ALL' | RatingExecutionMode)}
              options={[
                { label: '全部方式', value: 'ALL' },
                { label: '实时', value: 'REALTIME' },
                { label: '定时', value: 'SCHEDULED' },
              ]}
            />
            <Segmented
              value={subjectFilter}
              onChange={(v) => setSubjectFilter(v as 'ALL' | RatingSubject)}
              options={[
                { label: '全部主体', value: 'ALL' },
                { label: '商户', value: 'MERCHANT' },
                { label: '对私客户', value: 'INDIVIDUAL' },
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
              新建评级模型
            </Button>
          </Space>
        }
      >
        {modelsLoading ? (
          <Spin />
        ) : filteredModels.length === 0 ? (
          <Empty
            description={
              keyword || executionFilter !== 'ALL' || subjectFilter !== 'ALL'
                ? '无匹配的评级模型'
                : '暂无评级模型，点击右上角新建'
            }
          />
        ) : viewMode === 'grid' ? (
          renderGrid()
        ) : (
          <Table rowKey="id" columns={listColumns} dataSource={filteredModels} pagination={false} />
        )}
      </Card>

      <Modal
        title="新建评级模型"
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
            label="模型名称"
            name="name"
            rules={[
              { required: true, message: '请输入模型名称' },
              { max: 100, message: '名称长度不超过 100' },
            ]}
          >
            <Input placeholder="如 商户实时评级模型" />
          </Form.Item>
          <Form.Item
            label="执行方式"
            name="executionMode"
            rules={[{ required: true, message: '请选择执行方式' }]}
          >
            <Select options={EXECUTION_MODE_OPTIONS} placeholder="选择执行方式" />
          </Form.Item>
          <Form.Item
            label="评级主体"
            name="subject"
            rules={[{ required: true, message: '请选择评级主体' }]}
          >
            <Select options={SUBJECT_OPTIONS} placeholder="选择评级主体" />
          </Form.Item>
        </Form>
      </Modal>

      <RatingModelDetailDrawer
        model={detailModel}
        scenarioTree={scenarioTree as ScenarioTreeNode[]}
        onClose={() => setDetailModel(null)}
        onChanged={invalidateModels}
      />
    </>
  );
}

/* =====================================================================================
 * 评级模型详情抽屉：评级模型 / 源码 / 版本历史 三页签（R10.4 / R10.5）
 * ===================================================================================== */

interface DetailDrawerProps {
  model: RatingModelCardView | null;
  scenarioTree: ScenarioTreeNode[];
  onClose: () => void;
  onChanged: () => void;
}

function RatingModelDetailDrawer({ model, scenarioTree, onClose, onChanged }: DetailDrawerProps) {
  const queryClient = useQueryClient();
  const [bands, setBands] = useState<GradeBand[]>([]);
  const [scoreItems, setScoreItems] = useState<RatingItem[]>([]);
  const [directItems, setDirectItems] = useState<DirectGradingItem[]>([]);
  const [baseline, setBaseline] = useState('');

  // 详情数据（含等级区间与定级配置，R10.4）
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['rating-model-detail', model?.id],
    queryFn: () => getRatingModel(model!.id),
    enabled: model != null,
  });

  const versions = detail?.versions ?? [];

  const snapshotConfig = (
    nextBands: GradeBand[],
    nextScoreItems: RatingItem[],
    nextDirectItems: DirectGradingItem[],
  ) =>
    JSON.stringify({
      bands: nextBands,
      scoreItems: nextScoreItems,
      directItems: nextDirectItems,
    });

  // 详情加载后同步可编辑状态
  useEffect(() => {
    if (detail) {
      const loadedBands = detail.gradeBands ?? [];
      const loadedScoreItems = detail.items ?? [];
      const loadedDirectItems = detail.directItems ?? [];
      setBands(loadedBands);
      setScoreItems(loadedScoreItems);
      setDirectItems(loadedDirectItems);
      setBaseline(snapshotConfig(loadedBands, loadedScoreItems, loadedDirectItems));
    }
  }, [detail]);

  const configDirty = snapshotConfig(bands, scoreItems, directItems) !== baseline;

  const requestClose = () => {
    if (configDirty) {
      Modal.confirm({
        title: '有未保存的配置修改',
        content: '关闭后将丢失未保存的编辑内容，是否继续？',
        okText: '关闭',
        cancelText: '继续编辑',
        onOk: onClose,
      });
      return;
    }
    onClose();
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const gradingMode = inferGradingMode(scoreItems, directItems);
      return saveRatingModel(model!.id, {
        gradingMode,
        gradeBands: bands,
        items: mergeRatingItemsForSave(scoreItems, directItems),
      });
    },
    onSuccess: () => {
      message.success('配置已保存，已生成新版本');
      setBaseline(snapshotConfig(bands, scoreItems, directItems));
      queryClient.invalidateQueries({ queryKey: ['rating-model-detail', model?.id] });
      onChanged();
    },
    onError: (err: ApiError) => message.error(err.message ?? '保存失败'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number | string; status: RatingModelStatus }) =>
      updateRatingModelStatus(id, status),
    onSuccess: () => {
      message.success('状态已更新');
      queryClient.invalidateQueries({ queryKey: ['rating-model-detail', model?.id] });
      onChanged();
    },
    onError: (err: ApiError) => message.error(err.message ?? '状态更新失败'),
  });

  const handleSaveConfig = () => {
    const errors = validateGradeBands(bands, 0);
    if (errors.length > 0) {
      message.error('等级区间不合法，请先修正后再保存');
      return;
    }
    saveMutation.mutate();
  };

  const eventCode = detail?.eventPath ?? model?.eventPath ?? '';
  const displayEventPath = resolveEventPath(eventCode, scenarioTree);
  const gradingModeLabel =
    GRADING_MODE_LABEL[String(detail?.gradingMode ?? model?.gradingMode)] ??
    String(detail?.gradingMode ?? model?.gradingMode ?? 'MIXED');
  const currentStatus = (detail?.status ?? model?.status ?? 'OFFLINE') as RatingModelStatus;
  const sourceJson = useMemo(() => {
    if (detail?.sourceJson) {
      try {
        return JSON.stringify(JSON.parse(detail.sourceJson), null, 2);
      } catch {
        return detail.sourceJson;
      }
    }
    if (!detail) {
      return '';
    }
    const snapshot = {
      name: detail.name,
      eventPath: detail.eventPath,
      executionMode: detail.executionMode,
      subject: detail.subject,
      gradingMode: detail.gradingMode,
      status: detail.status,
      version: detail.version,
      gradeBands: bands,
      items: mergeRatingItemsForSave(scoreItems, directItems),
    };
    return JSON.stringify(snapshot, null, 2);
  }, [detail, bands, scoreItems, directItems]);

  const versionColumns: ColumnsType<RatingModelVersionView> = [
    { title: '版本号', dataIndex: 'version', key: 'version', render: (v: number) => `v${v}` },
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
  ];

  const tabItems = [
    {
      key: 'model',
      label: '评级模型',
      children: detailLoading ? (
        <Spin />
      ) : detail == null ? (
        <Empty />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space size="middle" wrap>
            <Tag color="blue">{modelTagText(detail)}</Tag>
            <Tag>{gradingModeLabel}</Tag>
            <Text type="secondary">事件路径：{displayEventPath}</Text>
            <Text type="secondary">当前版本：v{detail.version}</Text>
          </Space>

          <Card size="small" title="编辑配置">
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                message="等级区间用于将总分映射为最终等级；区间上界可随业务需要设置，不限制为 100 分。"
              />

              <div>
                <Text strong>等级区间</Text>
                <div style={{ marginTop: 8 }}>
                  <GradeBandEditor value={bands} onChange={setBands} rangeMin={0} />
                </div>
              </div>

              <div>
                <Text strong>评级子项配置</Text>
                <div style={{ marginTop: 8 }}>
                  <RatingItemConfigPanel
                    eventCode={eventCode}
                    gradeBands={bands}
                    scoreItems={scoreItems}
                    directItems={directItems}
                    onScoreItemsChange={setScoreItems}
                    onDirectItemsChange={setDirectItems}
                  />
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <Button
                  type="primary"
                  loading={saveMutation.isPending}
                  disabled={!configDirty}
                  onClick={handleSaveConfig}
                >
                  保存配置（生成新版本）
                </Button>
              </div>
            </Space>
          </Card>
        </Space>
      ),
    },
    {
      key: 'source',
      label: '源码',
      children: detailLoading ? (
        <Spin />
      ) : (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="当前版本配置源码（只读）"
            description="展示评级模型当前配置的 JSON 视图，含等级区间与定级配置。"
          />
          <Paragraph>
            <pre
              style={{
                background: '#0d1117',
                color: '#c9d1d9',
                padding: 16,
                borderRadius: 8,
                maxHeight: 480,
                overflow: 'auto',
                fontSize: 12,
              }}
            >
              {sourceJson}
            </pre>
          </Paragraph>
        </Space>
      ),
    },
    {
      key: 'versions',
      label: '版本历史',
      children: detailLoading ? (
        <Spin />
      ) : (
        <Table
          rowKey="version"
          columns={versionColumns}
          dataSource={versions}
          pagination={false}
          locale={{ emptyText: '暂无版本，保存评级模型配置后生成首个版本' }}
        />
      ),
    },
  ];

  return (
    <Drawer
      title={
        model ? (
          <Space>
            <span>编辑配置：{model.name}</span>
            {modelStatusTag(currentStatus)}
          </Space>
        ) : (
          '编辑配置'
        )
      }
      extra={
        model ? (
          String(currentStatus) === 'ONLINE' ? (
            <Popconfirm
              title="确认下线该评级模型？"
              okText="下线"
              cancelText="取消"
              onConfirm={() => statusMutation.mutate({ id: model.id, status: 'OFFLINE' })}
            >
              <Button danger loading={statusMutation.isPending}>
                下线
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="primary"
              loading={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ id: model.id, status: 'ONLINE' })}
            >
              上线
            </Button>
          )
        ) : null
      }
      open={model != null}
      width={960}
      onClose={requestClose}
      destroyOnClose
    >
      {model && <Tabs defaultActiveKey="model" items={tabItems} />}
    </Drawer>
  );
}
