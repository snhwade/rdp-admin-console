import { useEffect, useMemo, useState, type Key } from 'react';
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import ConditionTreeEditor, { defaultConditionTree } from '@/components/ConditionTreeEditor';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  batchOperateRules,
  createRule,
  createRulePackage,
  getRule,
  listRulePackages,
  listRules,
  listScenarioTree,
  rollbackRulePackageLastEnabled,
  setRulePackageStatus,
  updateRule,
  updateRuleStatus,
  normalizeRuleStatus,
  type ConditionNode,
  type CreateRuleBody,
  type UpdateRuleBody,
  type CreateRulePackageBody,
  type RuleBatchOperation,
  type RuleKind,
  type RuleListItemView,
  type RulePackageCardView,
  type RulePackageCategory,
  type RulePackageTriggerMode,
  type RuleStatus,
  type ScenarioTreeNode,
} from '@/api/console';
import { toFieldErrors, type ApiError } from '@/api/client';
import { buildEventSelectOptions, resolveEventPath } from '@/utils/scenarioEventDisplay';

/**
 * 规则包卡片墙与规则列表页（risk-console-redesign R6.1 / R6.2 / R6.4）。
 *
 * 布局：
 * - 全宽规则包列表（可按事件筛选），支持卡片/列表视图。
 * - 点击某一规则包进入下一层：全页展示该规则包内的规则列表（非抽屉）。
 * - 规则包可关联多个决策事件，不再依赖左侧场景树导航。
 *
 * 命名中性化（R1）：本页仅从 `@/api/console` import 中性 API，不引用旧版共享 API 模块。
 */

const { Text } = Typography;

function packageEventCodes(pkg: RulePackageCardView): string[] {
  return pkg.eventTypeCodes ?? [];
}

function formatEventCodes(codes: string[], tree: ScenarioTreeNode[]): string {
  if (codes.length === 0) {
    return '—';
  }
  return codes.map((c) => resolveEventPath(c, tree)).join('；');
}

/** 子页签分类选项（R6.2）。 */
const CATEGORY_TABS: { label: string; value: RulePackageCategory }[] = [
  { label: '基础规则', value: 'BASIC' },
  { label: '优先规则', value: 'PRIORITY' },
  { label: '名单规则', value: 'LIST' },
];

/** 触发模式选项（R6.3）。 */
const TRIGGER_MODE_OPTIONS: { label: string; value: RulePackageTriggerMode }[] = [
  { label: '命中（HIT）', value: 'HIT' },
  { label: '评分（SCORE）', value: 'SCORE' },
];

function categoryLabel(category?: RulePackageCategory): string {
  const found = CATEGORY_TABS.find((c) => c.value === category);
  return found ? found.label : String(category ?? '');
}

interface CreatePackageFormValues {
  code: string;
  name: string;
  triggerMode: RulePackageTriggerMode;
  eventTypeCodes: string[];
}

/** 新增/编辑规则表单值。 */
interface RuleFormValues {
  code: string;
  name: string;
  ruleKind: RuleKind;
  riskLevelCode?: string;
  baseScore?: number;
  remark?: string;
}

/** 规则三态选项（行内切换）。 */
const RULE_STATUS_OPTIONS: { label: string; value: RuleStatus }[] = [
  { label: '上线', value: 'ONLINE' },
  { label: '试运行', value: 'TRIAL_RUN' },
  { label: '下线', value: 'OFFLINE' },
];

/** 批量操作菜单项（R6.5）。 */
const BATCH_OPERATIONS: { label: string; value: RuleBatchOperation; danger?: boolean }[] = [
  { label: '上线', value: 'ONLINE' },
  { label: '试运行', value: 'TRIAL_RUN' },
  { label: '下线', value: 'OFFLINE' },
  { label: '复制', value: 'COPY' },
  { label: '移动', value: 'MOVE' },
  { label: '编辑机构', value: 'EDIT_ORG' },
  { label: '下载', value: 'DOWNLOAD' },
  { label: '删除', value: 'DELETE', danger: true },
];

export default function RulePackageWallPage() {
  const queryClient = useQueryClient();
  const [createForm] = Form.useForm<CreatePackageFormValues>();
  const [ruleForm] = Form.useForm<RuleFormValues>();

  const [eventFilter, setEventFilter] = useState<string | undefined>(undefined);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<RulePackageCategory>('BASIC');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [createOpen, setCreateOpen] = useState(false);

  // 当前进入的规则包（null = 规则包列表层）
  const [detailPackage, setDetailPackage] = useState<RulePackageCardView | null>(null);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Key[]>([]);
  // 新增规则弹窗
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleListItemView | null>(null);
  const [conditionTree, setConditionTree] = useState<ConditionNode>(defaultConditionTree());

  // 移动 / 编辑机构 操作弹窗
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<number | string | undefined>(undefined);
  const [editOrgOpen, setEditOrgOpen] = useState(false);
  const [orgValue, setOrgValue] = useState('');

  const { data: scenarioTree = [] } = useQuery({
    queryKey: ['scenario-tree'],
    queryFn: listScenarioTree,
  });

  const eventSelectOptions = useMemo(
    () => buildEventSelectOptions(scenarioTree as ScenarioTreeNode[]),
    [scenarioTree],
  );

  const { data: rulePackages = [], isLoading: packagesLoading } = useQuery({
    queryKey: ['rule-packages', eventFilter ?? 'ALL'],
    queryFn: () => listRulePackages(eventFilter),
  });

  const filteredPackages = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return rulePackages.filter((p) => {
      const c = p.category ?? 'BASIC';
      if (c !== category) {
        return false;
      }
      if (!kw) {
        return true;
      }
      return (
        p.name.toLowerCase().includes(kw) ||
        String(p.code ?? '').toLowerCase().includes(kw) ||
        packageEventCodes(p).some((e) => e.toLowerCase().includes(kw))
      );
    });
  }, [rulePackages, category, keyword]);

  // 各分类计数（用于子页签徽标）
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { BASIC: 0, PRIORITY: 0, LIST: 0 };
    for (const p of rulePackages) {
      const c = String(p.category ?? 'BASIC');
      counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  }, [rulePackages]);

  // 规则包详情：规则列表
  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['rule-package-rules', detailPackage?.id],
    queryFn: () => listRules(detailPackage!.id),
    enabled: detailPackage != null,
  });

  // 创建表单重置
  useEffect(() => {
    if (createOpen) {
      createForm.resetFields();
      createForm.setFieldsValue({
        triggerMode: 'HIT',
        eventTypeCodes: eventFilter ? [eventFilter] : [],
      });
    }
  }, [createOpen, createForm, eventFilter]);

  const invalidatePackages = () => {
    queryClient.invalidateQueries({ queryKey: ['rule-packages'] });
  };

  const invalidateRules = () => {
    queryClient.invalidateQueries({ queryKey: ['rule-package-rules', detailPackage?.id] });
  };

  const echoFieldErrors = (err: ApiError, fallback: string) => {
    const fieldErrors = toFieldErrors(err);
    const formErrors = Object.entries(fieldErrors).map(([name, msg]) => ({
      name: name as keyof CreatePackageFormValues,
      errors: [msg],
    }));
    if (formErrors.length > 0) {
      createForm.setFields(formErrors);
    } else {
      message.error(err.message ?? fallback);
    }
  };

  const createMutation = useMutation({
    mutationFn: (body: CreateRulePackageBody) => createRulePackage(body),
    onSuccess: () => {
      message.success('规则包创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      invalidatePackages();
    },
    onError: (err: ApiError) => echoFieldErrors(err, '创建失败'),
  });

  const batchMutation = useMutation({
    mutationFn: ({
      rulePackageId,
      operation,
      ruleIds,
      params,
    }: {
      rulePackageId: number | string;
      operation: RuleBatchOperation;
      ruleIds: (number | string)[];
      params?: Record<string, unknown>;
    }) => batchOperateRules(rulePackageId, { operation, ruleIds, params }),
    onSuccess: (results, variables) => {
      const failed = results.filter((r) => !r.success);
      if (failed.length === 0) {
        message.success(`批量操作完成：成功 ${results.length} 条`);
      } else {
        message.warning(
          `批量操作完成：成功 ${results.length - failed.length} 条，失败 ${failed.length} 条`,
        );
      }
      // 复制 / 移动 / 删除 / 状态切换均可能改变规则集合或三态计数
      invalidateRules();
      invalidatePackages();
      if (variables.operation === 'DELETE' || variables.operation === 'MOVE') {
        setSelectedRuleIds([]);
      }
    },
    onError: (err: ApiError) => message.error(err.message ?? '批量操作失败'),
  });

  // 新增规则：组装单叶子条件树提交到 POST /rules-v2（创建后默认下线）
  const createRuleMutation = useMutation({
    mutationFn: (values: RuleFormValues) => {
      if (!detailPackage) {
        return Promise.reject<{ id: number | string }>(new Error('未选择规则包'));
      }
      const body: CreateRuleBody = {
        code: values.code,
        name: values.name,
        rulePackageId: detailPackage.id,
        ruleKind: values.ruleKind,
        eventTypeCode: detailPackage ? packageEventCodes(detailPackage)[0] ?? null : null,
        riskLevelCode: values.riskLevelCode || null,
        baseScore: values.ruleKind === 'SCORE' ? values.baseScore ?? 0 : null,
        condition: conditionTree,
        remark: values.remark?.trim() || null,
      };
      return createRule(body);
    },
    onSuccess: () => {
      message.success('规则创建成功（默认下线，可在规则列表上线/试运行）');
      setRuleModalOpen(false);
      setEditingRule(null);
      ruleForm.resetFields();
      setConditionTree(defaultConditionTree());
      invalidateRules();
      invalidatePackages();
    },
    onError: (err: ApiError) => {
      const fieldErrors = toFieldErrors(err);
      const formErrors = Object.entries(fieldErrors)
        .map(([name, msg]) => ({ name: name as keyof RuleFormValues, errors: [msg] }))
        .filter((e) =>
          ['code', 'name', 'ruleKind', 'riskLevelCode', 'baseScore'].includes(e.name as string),
        );
      if (formErrors.length > 0) {
        ruleForm.setFields(formErrors);
      } else {
        message.error(err.message ?? '规则创建失败');
      }
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: (values: RuleFormValues) => {
      if (!editingRule) {
        return Promise.reject(new Error('未选择规则'));
      }
      const body: UpdateRuleBody = {
        name: values.name,
        eventTypeCode: detailPackage ? packageEventCodes(detailPackage)[0] ?? null : null,
        riskLevelCode: values.riskLevelCode || null,
        baseScore: values.ruleKind === 'SCORE' ? values.baseScore ?? 0 : null,
        condition: conditionTree,
        remark: values.remark?.trim() || null,
      };
      return updateRule(editingRule.id, body);
    },
    onSuccess: () => {
      message.success('规则已更新');
      setRuleModalOpen(false);
      setEditingRule(null);
      ruleForm.resetFields();
      setConditionTree(defaultConditionTree());
      invalidateRules();
    },
    onError: (err: ApiError) => {
      const fieldErrors = toFieldErrors(err);
      const formErrors = Object.entries(fieldErrors)
        .map(([name, msg]) => ({ name: name as keyof RuleFormValues, errors: [msg] }))
        .filter((e) =>
          ['code', 'name', 'ruleKind', 'riskLevelCode', 'baseScore'].includes(e.name as string),
        );
      if (formErrors.length > 0) {
        ruleForm.setFields(formErrors);
      } else {
        message.error(err.message ?? '规则更新失败');
      }
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ ruleId, status }: { ruleId: number | string; status: RuleStatus }) =>
      updateRuleStatus(ruleId, status),
    onSuccess: () => {
      message.success('规则状态已更新');
      invalidateRules();
      invalidatePackages();
    },
    onError: (err: ApiError) => {
      const fields = toFieldErrors(err);
      const statusMsg = fields.status;
      message.error(statusMsg ?? err.message ?? '状态更新失败');
    },
  });

  const packageStatusMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number | string; enabled: boolean }) =>
      setRulePackageStatus(id, enabled),
    onSuccess: (_d, vars) => {
      message.success(vars.enabled ? '规则包已启用（已写入启用快照）' : '规则包已禁用');
      invalidatePackages();
      if (detailPackage && String(detailPackage.id) === String(vars.id)) {
        setDetailPackage({
          ...detailPackage,
          status: vars.enabled ? 'ENABLED' : 'DISABLED',
        });
      }
    },
    onError: (err: ApiError) => message.error(err.message ?? '规则包状态更新失败'),
  });

  const rollbackMutation = useMutation({
    mutationFn: (id: number | string) => rollbackRulePackageLastEnabled(id),
    onSuccess: () => {
      message.success('已回退到上一启用快照');
      invalidatePackages();
      invalidateRules();
    },
    onError: (err: ApiError) => message.error(err.message ?? '回退失败'),
  });

  const handleCreateSubmit = (values: CreatePackageFormValues) => {
    createMutation.mutate({
      code: values.code,
      name: values.name,
      triggerMode: values.triggerMode,
      eventTypeCodes: values.eventTypeCodes,
      category,
    });
  };

  const openCreateRule = () => {
    setEditingRule(null);
    ruleForm.resetFields();
    ruleForm.setFieldsValue({
      ruleKind: detailPackage?.triggerMode === 'SCORE' ? 'SCORE' : 'HIT',
    });
    setConditionTree(defaultConditionTree());
    setRuleModalOpen(true);
  };

  const openEditRule = async (row: RuleListItemView) => {
    try {
      const detail = await getRule(row.id);
      setEditingRule(row);
      ruleForm.setFieldsValue({
        code: detail.code,
        name: detail.name,
        ruleKind: detail.ruleKind,
        riskLevelCode: detail.riskLevelCode ?? undefined,
        baseScore: detail.baseScore ?? undefined,
        remark: detail.remark ?? undefined,
      });
      setConditionTree(detail.condition ?? defaultConditionTree());
      setRuleModalOpen(true);
    } catch (err) {
      message.error((err as ApiError).message ?? '加载规则详情失败');
    }
  };

  const openDetail = (pkg: RulePackageCardView) => {
    setDetailPackage(pkg);
    setSelectedRuleIds([]);
  };

  const backToPackageList = () => {
    setDetailPackage(null);
    setSelectedRuleIds([]);
    setRuleModalOpen(false);
    setEditingRule(null);
  };

  const runBatch = (operation: RuleBatchOperation, params?: Record<string, unknown>) => {
    if (!detailPackage || selectedRuleIds.length === 0) {
      return;
    }
    const ruleIds = selectedRuleIds.map((k) => k as number | string);
    if (operation === 'DELETE') {
      Modal.confirm({
        title: `删除选中的 ${ruleIds.length} 条规则？`,
        content: '删除后不可恢复。',
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () =>
          batchMutation.mutateAsync({
            rulePackageId: detailPackage.id,
            operation,
            ruleIds,
          }),
      });
      return;
    }
    batchMutation.mutate({ rulePackageId: detailPackage.id, operation, ruleIds, params });
  };

  const onBatchOperation = (operation: RuleBatchOperation) => {
    if (operation === 'MOVE') {
      setMoveTargetId(undefined);
      setMoveOpen(true);
      return;
    }
    if (operation === 'EDIT_ORG') {
      setOrgValue('');
      setEditOrgOpen(true);
      return;
    }
    runBatch(operation);
  };

  const confirmMove = () => {
    if (moveTargetId == null) {
      message.warning('请选择目标规则包');
      return;
    }
    runBatch('MOVE', { targetRulePackageId: moveTargetId });
    setMoveOpen(false);
  };

  const confirmEditOrg = () => {
    if (!orgValue.trim()) {
      message.warning('请输入机构标识');
      return;
    }
    runBatch('EDIT_ORG', { org: orgValue.trim() });
    setEditOrgOpen(false);
  };

  // 移动目标候选（同事件下的其它规则包）
  const moveTargets = useMemo(
    () =>
      rulePackages
        .filter((p) => String(p.id) !== String(detailPackage?.id))
        .map((p) => ({ label: p.name, value: p.id })),
    [rulePackages, detailPackage],
  );

  const detailEventLabel = detailPackage
    ? formatEventCodes(packageEventCodes(detailPackage), scenarioTree as ScenarioTreeNode[])
    : '—';

  const ruleColumns: ColumnsType<RuleListItemView> = [
    { title: '规则编码', dataIndex: 'code', key: 'code', width: 140 },
    { title: '规则名称', dataIndex: 'name', key: 'name' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: RuleStatus, row) => (
        <Select
          size="small"
          value={normalizeRuleStatus(String(s))}
          options={RULE_STATUS_OPTIONS}
          loading={
            statusMutation.isPending &&
            String(statusMutation.variables?.ruleId) === String(row.id)
          }
          onChange={(v) =>
            statusMutation.mutate({ ruleId: row.id, status: v as RuleStatus })
          }
          style={{ width: 108 }}
        />
      ),
    },
    {
      title: '决策事件',
      dataIndex: 'decisionEventCode',
      key: 'decisionEventCode',
      render: (v?: string | null) => v ?? '-',
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevelCode',
      key: 'riskLevelCode',
      render: (v?: string | null) => (v ? <Tag color="volcano">{v}</Tag> : '-'),
    },
    {
      title: '风险分值',
      dataIndex: 'riskScore',
      key: 'riskScore',
      width: 90,
      render: (v?: number | null) => (v != null ? v : '-'),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      render: (v?: string | null) => v?.trim() || '—',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => openEditRule(row)}>
          编辑
        </Button>
      ),
    },
  ];

  /** 三态计数底栏。 */
  const renderCounts = (pkg: RulePackageCardView) => (
    <Space size="middle">
      <Tooltip title="上线规则数">
        <span>
          <Badge color="green" /> 上线 {pkg.counts?.online ?? 0}
        </span>
      </Tooltip>
      <Tooltip title="试运行规则数">
        <span>
          <Badge color="gold" /> 试运行 {pkg.counts?.trialRun ?? 0}
        </span>
      </Tooltip>
      <Tooltip title="下线规则数">
        <span>
          <Badge color="#d9d9d9" /> 下线 {pkg.counts?.offline ?? 0}
        </span>
      </Tooltip>
    </Space>
  );

  /** 卡片网格视图。 */
  const renderGrid = () => (
    <Row gutter={[16, 16]}>
      {filteredPackages.map((pkg) => (
        <Col key={pkg.id} xs={24} sm={12} lg={8} xxl={6}>
          <Card
            hoverable
            size="small"
            onClick={() => openDetail(pkg)}
            title={
              <Space>
                <Text strong>{pkg.name}</Text>
                <Tag color="blue">{pkg.triggerMode}</Tag>
              </Space>
            }
            extra={pkg.category ? <Tag>{categoryLabel(pkg.category)}</Tag> : null}
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text type="secondary">归属：{pkg.owner ?? '-'}</Text>
              <Text type="secondary">
                关联事件：{formatEventCodes(packageEventCodes(pkg), scenarioTree as ScenarioTreeNode[])}
              </Text>
              <div style={{ marginTop: 8 }}>{renderCounts(pkg)}</div>
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  );

  /** 列表视图。 */
  const listColumns: ColumnsType<RulePackageCardView> = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 140 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '触发模式',
      dataIndex: 'triggerMode',
      key: 'triggerMode',
      width: 100,
      render: (m: RulePackageTriggerMode) => <Tag color="blue">{m}</Tag>,
    },
    {
      title: '关联事件',
      key: 'eventTypeCodes',
      render: (_, pkg) =>
        formatEventCodes(packageEventCodes(pkg), scenarioTree as ScenarioTreeNode[]),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (c?: RulePackageCategory) => (c ? <Tag>{categoryLabel(c)}</Tag> : '-'),
    },
    {
      title: '三态计数',
      key: 'counts',
      render: (_, pkg) => renderCounts(pkg),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, pkg) => (
        <Button type="link" size="small" onClick={() => openDetail(pkg)}>
          进入
        </Button>
      ),
    },
  ];

  const breadcrumbItems = [
    {
      title: detailPackage ? (
        <a onClick={backToPackageList}>规则包列表</a>
      ) : (
        '规则包列表'
      ),
    },
    ...(detailPackage ? [{ title: detailPackage.name }] : []),
  ];

  const packageListContent = (
    <>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="搜索名称 / Code / 事件"
          style={{ width: 260 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Select
          allowClear
          showSearch
          placeholder="筛选关联事件"
          style={{ width: 240 }}
          value={eventFilter}
          options={eventSelectOptions}
          onChange={(value) => setEventFilter(value || undefined)}
        />
      </Space>
      <Radio.Group
        value={category}
        onChange={(e) => setCategory(e.target.value as RulePackageCategory)}
        style={{ marginBottom: 16 }}
        optionType="button"
        buttonStyle="solid"
      >
        {CATEGORY_TABS.map((t) => (
          <Radio.Button key={t.value} value={t.value}>
            {t.label}
            {categoryCounts[String(t.value)] ? `（${categoryCounts[String(t.value)]}）` : ''}
          </Radio.Button>
        ))}
      </Radio.Group>

      {packagesLoading ? (
        <Spin />
      ) : filteredPackages.length === 0 ? (
        <Empty description={`暂无「${categoryLabel(category)}」规则包`} />
      ) : viewMode === 'grid' ? (
        renderGrid()
      ) : (
        <Table
          rowKey="id"
          columns={listColumns}
          dataSource={filteredPackages}
          pagination={false}
          onRow={(record) => ({
            onClick: () => openDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      )}
    </>
  );

  const ruleListContent = detailPackage ? (
    <>
      <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
        <Space wrap size="middle">
          <Tag color="blue">{detailPackage.triggerMode}</Tag>
          {detailPackage.category ? <Tag>{categoryLabel(detailPackage.category)}</Tag> : null}
          <Tag color={detailPackage.status === 'ENABLED' ? 'green' : 'default'}>
            {detailPackage.status === 'ENABLED' ? '已启用' : '已禁用'}
          </Tag>
          <Text type="secondary">归属：{detailPackage.owner ?? '-'}</Text>
          <Text type="secondary">关联事件：{detailEventLabel}</Text>
          {renderCounts(detailPackage)}
          <Button
            size="small"
            type={detailPackage.status === 'ENABLED' ? 'default' : 'primary'}
            loading={packageStatusMutation.isPending}
            onClick={() =>
              packageStatusMutation.mutate({
                id: detailPackage.id,
                enabled: detailPackage.status !== 'ENABLED',
              })
            }
          >
            {detailPackage.status === 'ENABLED' ? '禁用规则包' : '启用规则包'}
          </Button>
          <Button
            size="small"
            loading={rollbackMutation.isPending}
            onClick={() =>
              Modal.confirm({
                title: '回退到上一启用快照？',
                content:
                  '将恢复上一启用时刻的规则包配置、分值区间与规则内容/状态。至少成功启用过两次才可回退。',
                okText: '回退',
                onOk: () => rollbackMutation.mutateAsync(detailPackage.id),
              })
            }
          >
            回退上一启用快照
          </Button>
        </Space>
      </Card>
      <Space style={{ marginBottom: 12 }} wrap>
        <Button type="primary" onClick={openCreateRule}>
          新增规则
        </Button>
        <Text type="secondary">已选 {selectedRuleIds.length} 条</Text>
        {BATCH_OPERATIONS.map((op) => (
          <Button
            key={op.value}
            size="small"
            danger={op.danger}
            disabled={selectedRuleIds.length === 0}
            loading={batchMutation.isPending}
            onClick={() => onBatchOperation(op.value)}
          >
            {op.label}
          </Button>
        ))}
      </Space>
      <Table
        rowKey="id"
        loading={rulesLoading}
        columns={ruleColumns}
        dataSource={rules}
        scroll={{ x: 1100 }}
        rowSelection={{
          selectedRowKeys: selectedRuleIds,
          onChange: (keys) => setSelectedRuleIds(keys),
        }}
        locale={{ emptyText: '该规则包下暂无规则，可点击「新增规则」创建' }}
      />
    </>
  ) : null;

  return (
    <div>
      <Breadcrumb items={breadcrumbItems} style={{ marginBottom: 12 }} />
      <Card
        title={detailPackage ? `规则列表：${detailPackage.name}` : '规则包列表'}
        extra={
          <Space>
            {detailPackage ? (
              <Button onClick={backToPackageList}>返回规则包列表</Button>
            ) : (
              <>
                <Segmented
                  value={viewMode}
                  onChange={(v) => setViewMode(v as 'grid' | 'list')}
                  options={[
                    { label: '列表', value: 'list' },
                    { label: '卡片', value: 'grid' },
                  ]}
                />
                <Button type="primary" onClick={() => setCreateOpen(true)}>
                  新建规则包
                </Button>
              </>
            )}
          </Space>
        }
      >
        {detailPackage ? ruleListContent : packageListContent}
      </Card>

      {/* 新建规则包（R6.3） */}
      <Modal
        title="新建规则包"
        open={createOpen}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        onCancel={() => setCreateOpen(false)}
        forceRender
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateSubmit}>
          <Form.Item label="分类">
            <Input value={categoryLabel(category)} disabled />
          </Form.Item>
          <Form.Item
            label="规则包 Code"
            name="code"
            rules={[
              { required: true, message: '请输入规则包 Code' },
              { pattern: /^[A-Za-z0-9_]+$/, message: '仅允许字母数字下划线' },
            ]}
          >
            <Input placeholder="如 PKG_PAY_HIT" />
          </Form.Item>
          <Form.Item
            label="规则包名称"
            name="name"
            rules={[
              { required: true, message: '请输入规则包名称' },
              { max: 100, message: '名称长度不超过 100' },
            ]}
          >
            <Input placeholder="如 高风险交易拦截包" />
          </Form.Item>
          <Form.Item
            label="关联事件"
            name="eventTypeCodes"
            rules={[{ required: true, message: '请至少选择一个关联事件' }]}
            tooltip="规则包可关联多个决策事件"
          >
            <Select
              mode="multiple"
              showSearch
              placeholder="选择关联的决策事件"
              options={eventSelectOptions}
            />
          </Form.Item>
          <Form.Item
            label="触发模式"
            name="triggerMode"
            tooltip="命中（HIT）或评分（SCORE），创建后不可修改"
            rules={[{ required: true, message: '请选择触发模式' }]}
          >
            <Select options={TRIGGER_MODE_OPTIONS} placeholder="选择触发模式" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新增 / 编辑规则 */}
      <Modal
        title={
          editingRule
            ? `编辑规则：${editingRule.name}`
            : detailPackage
              ? `新增规则：${detailPackage.name}`
              : '新增规则'
        }
        open={ruleModalOpen}
        onOk={() => ruleForm.submit()}
        confirmLoading={createRuleMutation.isPending || updateRuleMutation.isPending}
        onCancel={() => {
          setRuleModalOpen(false);
          setEditingRule(null);
        }}
        width={720}
        forceRender
      >
        <Form
          form={ruleForm}
          layout="vertical"
          onFinish={(values) => {
            if (editingRule) {
              updateRuleMutation.mutate(values);
            } else {
              createRuleMutation.mutate(values);
            }
          }}
        >
          <Form.Item
            label="规则编码"
            name="code"
            rules={editingRule ? [] : [
              { required: true, message: '请输入规则编码' },
              { pattern: /^[A-Za-z0-9_]+$/, message: '仅允许字母数字下划线' },
            ]}
          >
            <Input placeholder="如 RULE_BIG_AMOUNT" disabled={editingRule != null} />
          </Form.Item>
          <Form.Item
            label="规则名称"
            name="name"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="如 大额交易拦截" />
          </Form.Item>
          <Form.Item
            label="规则类型"
            name="ruleKind"
            tooltip="命中（HIT）或评分（SCORE），通常与规则包触发模式一致"
            rules={[{ required: true, message: '请选择规则类型' }]}
          >
            <Select
              options={[
                { label: '命中（HIT）', value: 'HIT' },
                { label: '评分（SCORE）', value: 'SCORE' },
              ]}
            />
          </Form.Item>

          <Form.Item label="条件树" required>
            <ConditionTreeEditor value={conditionTree} onChange={setConditionTree} />
          </Form.Item>

          <Form.Item label="风险等级" name="riskLevelCode">
            <Input placeholder="如 HIGH / MID / LOW（可选）" />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.ruleKind !== cur.ruleKind}
          >
            {({ getFieldValue }) =>
              getFieldValue('ruleKind') === 'SCORE' ? (
                <Form.Item label="基础分" name="baseScore" tooltip="评分规则命中时计入的基础分">
                  <InputNumber style={{ width: '100%' }} placeholder="如 30" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item label="备注" name="remark" tooltip="人工填写规则意图/适用场景，供协作阅读">
            <Input.TextArea rows={2} maxLength={512} showCount placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 移动到目标规则包 */}
      <Modal
        title="移动规则到目标规则包"
        open={moveOpen}
        onOk={confirmMove}
        confirmLoading={batchMutation.isPending}
        onCancel={() => setMoveOpen(false)}
      >
        <Select
          style={{ width: '100%' }}
          placeholder="选择目标规则包"
          value={moveTargetId}
          onChange={(v) => setMoveTargetId(v)}
          options={moveTargets}
          notFoundContent={<Empty description="无其它规则包可移动" />}
        />
      </Modal>

      {/* 编辑机构 */}
      <Modal
        title="编辑机构"
        open={editOrgOpen}
        onOk={confirmEditOrg}
        confirmLoading={batchMutation.isPending}
        onCancel={() => setEditOrgOpen(false)}
      >
        <Input
          placeholder="输入机构标识"
          value={orgValue}
          onChange={(e) => setOrgValue(e.target.value)}
        />
      </Modal>
    </div>
  );
}
