import { apiClient } from './client';

/**
 * S1–S12 增量功能的 BFF 接口封装：名单管理、决策工具（决策表/评分卡/决策流/决策树/决策矩阵）、
 * 复核审批、资产版本、字段库、用户权限、AI 训练。
 * 路径对应 admin-bff 的 /bff/api/v1 聚合接口（baseURL 已含 /bff/api/v1）。
 */

async function getList<T>(url: string, params?: Record<string, unknown>): Promise<T[]> {
  const { data } = await apiClient.get<T[]>(url, { params });
  return Array.isArray(data) ? data : [];
}

/* ==================== S1 名单管理 ==================== */

export type ListType = 'BLACK' | 'WHITE' | 'WATCH';

export interface ListRecord {
  id: number | string;
  listType: ListType;
  dimension: string;
  dimensionValue: string;
  reason?: string;
  immuneRuleId?: number | string | null;
  expireAt?: string | null;
  enabled: boolean;
}

export const listLists = (listType?: string) =>
  getList<ListRecord>('/lists', listType ? { type: listType } : undefined);

export async function createListRecord(body: {
  listType: ListType;
  dimension: string;
  dimensionValue: string;
  reason?: string;
  immuneRuleId?: number | null;
  expireAt?: string | null;
}) {
  const { data } = await apiClient.post('/lists', body);
  return data;
}

export async function updateListRecord(
  id: number | string,
  body: { dimensionValue?: string; reason?: string; immuneRuleId?: number | null; expireAt?: string | null; enabled?: boolean },
) {
  const { data } = await apiClient.put(`/lists/${id}`, body);
  return data;
}

export async function deleteListRecord(id: number | string) {
  await apiClient.delete(`/lists/${id}`);
}

export interface ListCheckResult {
  blackHit: boolean;
  watchHit: boolean;
  whiteHit: boolean;
  blackRecords?: ListRecord[];
  watchRecords?: ListRecord[];
  whiteRecords?: ListRecord[];
}

/* ==================== S2 决策表 ==================== */

export type DecisionTableHitPolicy = 'FIRST' | 'COLLECT';

export interface DecisionTableColumn {
  var: string;
  source?: string;
}

export interface DecisionTableCondition {
  var: string;
  op: 'GT' | 'GE' | 'LT' | 'LE' | 'EQ' | 'NE' | 'BETWEEN' | 'IN';
  value?: number | null;
  value2?: number | null;
  values?: string[] | null;
}

export interface DecisionTableRow {
  conditions: DecisionTableCondition[];
  decision: string;
  priority?: number;
}

export interface DecisionTable {
  id?: number | string;
  name: string;
  eventTypeCode: string;
  hitPolicy: DecisionTableHitPolicy;
  columns: DecisionTableColumn[];
  rows: DecisionTableRow[];
  status?: string;
  [k: string]: unknown;
}

export const listDecisionTables = (eventTypeCode?: string) =>
  getList<DecisionTable>('/decision-tables', eventTypeCode ? { eventTypeCode } : undefined);

export async function getDecisionTable(id: number | string): Promise<DecisionTable> {
  const { data } = await apiClient.get<DecisionTable>(`/decision-tables/${id}`);
  return data;
}

export async function createDecisionTable(body: Record<string, unknown>) {
  const { data } = await apiClient.post('/decision-tables', body);
  return data as DecisionTable;
}

export async function updateDecisionTable(id: number | string, body: Record<string, unknown>) {
  const { data } = await apiClient.put(`/decision-tables/${id}`, body);
  return data as DecisionTable;
}

export async function deleteDecisionTable(id: number | string) {
  await apiClient.delete(`/decision-tables/${id}`);
}

/* ==================== S8 决策树 ==================== */

export interface DecisionTreeBranch {
  condition: string;
  childNodeId: string;
}

export interface DecisionTreeNode {
  nodeId: string;
  leaf: boolean;
  decision?: string;
  priority?: number;
  children?: DecisionTreeBranch[];
}

export interface DecisionTree {
  id?: number | string;
  name: string;
  eventTypeCode: string;
  rootNodeId: string;
  nodes: DecisionTreeNode[];
  status?: string;
  [k: string]: unknown;
}

export const listDecisionTrees = (eventTypeCode?: string) =>
  getList<DecisionTree>('/decision-trees', eventTypeCode ? { eventTypeCode } : undefined);

export async function getDecisionTree(id: number | string): Promise<DecisionTree> {
  const { data } = await apiClient.get<DecisionTree>(`/decision-trees/${id}`);
  return data;
}

export async function createDecisionTree(body: Record<string, unknown>) {
  const { data } = await apiClient.post('/decision-trees', body);
  return data as DecisionTree;
}

export async function updateDecisionTree(id: number | string, body: Record<string, unknown>) {
  const { data } = await apiClient.put(`/decision-trees/${id}`, body);
  return data as DecisionTree;
}

export async function deleteDecisionTree(id: number | string) {
  await apiClient.delete(`/decision-trees/${id}`);
}

/* ==================== S9 决策矩阵 ==================== */

export interface DecisionMatrixBin {
  min: number;
  max: number;
}

export interface DecisionMatrixCell {
  row: number;
  col: number;
  decision: string;
  priority?: number;
}

export interface DecisionMatrix {
  id?: number | string;
  name: string;
  eventTypeCode: string;
  rowVar: string;
  rowBins: DecisionMatrixBin[];
  colVar: string;
  colBins: DecisionMatrixBin[];
  cells: DecisionMatrixCell[];
  status?: string;
  [k: string]: unknown;
}

export const listDecisionMatrices = (eventTypeCode?: string) =>
  getList<DecisionMatrix>('/decision-matrices', eventTypeCode ? { eventTypeCode } : undefined);

export async function getDecisionMatrix(id: number | string): Promise<DecisionMatrix> {
  const { data } = await apiClient.get<DecisionMatrix>(`/decision-matrices/${id}`);
  return data;
}

export async function createDecisionMatrix(body: Record<string, unknown>) {
  const { data } = await apiClient.post('/decision-matrices', body);
  return data as DecisionMatrix;
}

export async function updateDecisionMatrix(id: number | string, body: Record<string, unknown>) {
  const { data } = await apiClient.put(`/decision-matrices/${id}`, body);
  return data as DecisionMatrix;
}

export async function deleteDecisionMatrix(id: number | string) {
  await apiClient.delete(`/decision-matrices/${id}`);
}

/* ==================== S5 复核审批 ==================== */

export interface ApprovalRequest {
  id: number | string;
  assetType: string;
  assetId?: string;
  changeType?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | (string & {});
  applicant?: string;
  approver?: string;
  reason?: string;
  createdAt?: string;
}

export const listApprovals = (params?: { status?: string; applicant?: string }) =>
  getList<ApprovalRequest>('/approvals', params);

export async function approveRequest(id: number | string, approver: string) {
  const { data } = await apiClient.put(`/approvals/${id}/approve`, { approver });
  return data;
}

export async function rejectRequest(id: number | string, approver: string, reason: string) {
  const { data } = await apiClient.put(`/approvals/${id}/reject`, { approver, reason });
  return data;
}

/* ==================== S6 资产版本 ==================== */

export interface AssetVersion {
  id: number | string;
  assetType: string;
  assetId: string;
  version: number;
  status: string;
  snapshot?: string;
  createdAt?: string;
}

export const listAssetVersions = (assetType: string, assetId: string) =>
  getList<AssetVersion>('/asset-versions', { assetType, assetId });

/* ==================== S10 用户权限 ==================== */

export interface SysUser {
  id?: number | string;
  username: string;
  roles: string[];
  enabled?: boolean;
}

export const listUsers = () => getList<SysUser>('/users');

export async function createUser(body: { username: string; password: string; roles: string[] }) {
  const { data } = await apiClient.post('/users', body);
  return data;
}

export async function setUserEnabled(id: number | string, enabled: boolean): Promise<SysUser> {
  const { data } = await apiClient.put<SysUser>(`/users/${id}/enabled`, { enabled });
  return data;
}

export async function updateUserRoles(id: number | string, roles: string[]): Promise<SysUser> {
  const { data } = await apiClient.put<SysUser>(`/users/${id}/roles`, { roles });
  return data;
}

export async function resetUserPassword(id: number | string, password: string): Promise<SysUser> {
  const { data } = await apiClient.put<SysUser>(`/users/${id}/reset-password`, { password });
  return data;
}

/* ==================== R13 AI 训练任务 ==================== */

export interface TrainingJob {
  jobId?: string;
  status: string;
  dataFrom?: string;
  dataTo?: string;
  modelVersion?: string;
  metrics?: Record<string, unknown>;
  failReason?: string;
  sampleCount?: number;
  startedAt?: string;
  finishedAt?: string;
}

export interface TrainingJobQueryParams {
  jobId?: string;
  status?: string;
  startTimeMs?: number;
  endTimeMs?: number;
  page?: number;
  pageSize?: number;
}

export async function queryTrainingJobs(
  params: TrainingJobQueryParams = {},
): Promise<PagedData<TrainingJob>> {
  const { data } = await apiClient.get<PagedData<TrainingJob>>('/ai/training-jobs', { params });
  if (data && Array.isArray(data.data)) {
    return data;
  }
  const legacy = data as unknown as { items?: TrainingJob[] };
  if (legacy?.items) {
    return { data: legacy.items, page: 1, pageSize: legacy.items.length, total: legacy.items.length };
  }
  return { data: [], page: 1, pageSize: 20, total: 0 };
}

/** @deprecated 使用 queryTrainingJobs */
export const listTrainingJobs = () =>
  queryTrainingJobs({ page: 1, pageSize: 200 }).then((p) => p.data);

export async function submitTrainingJob(body: { dataFrom: string; dataTo: string }) {
  const { data } = await apiClient.post('/ai/training-jobs', body);
  return data;
}

export interface TrainingSchedule {
  id?: number;
  name: string;
  enabled: boolean;
  cronExpression: string;
  windowDays: number;
  lastTriggeredAt?: string;
  lastJobId?: string;
  lastRunStatus?: string;
  lastFailReason?: string;
}

export async function listTrainingSchedules(): Promise<TrainingSchedule[]> {
  const { data } = await apiClient.get<{ data?: TrainingSchedule[] }>('/ai/training-schedules');
  return data?.data ?? [];
}

export async function createTrainingSchedule(body: {
  name: string;
  cronExpression: string;
  windowDays: number;
  enabled?: boolean;
}) {
  const { data } = await apiClient.post('/ai/training-schedules', body);
  return data as TrainingSchedule;
}

export async function updateTrainingSchedule(
  id: number,
  body: Partial<{
    name: string;
    cronExpression: string;
    windowDays: number;
    enabled: boolean;
  }>,
) {
  const { data } = await apiClient.put(`/ai/training-schedules/${id}`, body);
  return data as TrainingSchedule;
}

export async function deleteTrainingSchedule(id: number) {
  const { data } = await apiClient.delete(`/ai/training-schedules/${id}`);
  return data;
}

export async function runTrainingScheduleNow(id: number) {
  const { data } = await apiClient.post(`/ai/training-schedules/${id}/run-now`, {});
  return data as { outcome: string; job?: TrainingJob; reason?: string };
}

/* ==================== AI 模型管理 ==================== */

export interface ModelVersionRow {
  version: string;
  createdAtTs: number;
  metrics?: Record<string, unknown>;
  description?: string | null;
  current?: boolean;
}

export interface ModelKindSummary {
  modelKind: string;
  currentVersion?: string | null;
  scoringAvailable: boolean;
  scoringReason?: string | null;
  description?: string | null;
  versions: ModelVersionRow[];
}

export async function listAiModels(): Promise<ModelKindSummary[]> {
  const { data } = await apiClient.get<{ data?: ModelKindSummary[] }>('/ai/models');
  return data?.data ?? [];
}

export async function activateAiModel(kind: string, version: string): Promise<ModelKindSummary> {
  const { data } = await apiClient.put<ModelKindSummary>(`/ai/models/${kind}/current`, { version });
  return data;
}

export async function updateAiModelMeta(
  kind: string,
  body: {
    description?: string | null;
    version?: string;
    versionDescription?: string | null;
  },
): Promise<ModelKindSummary> {
  const { data } = await apiClient.put<ModelKindSummary>(`/ai/models/${kind}`, body);
  return data;
}

export async function probeAiScore(body: {
  modelRef?: string;
  features?: Record<string, unknown>;
}): Promise<{
  available: boolean;
  score?: number | null;
  reason?: string | null;
  modelKind?: string | null;
  modelVersion?: string | null;
}> {
  const { data } = await apiClient.post('/ai/score', body);
  return data;
}

/* ==================== R11 筛查 ==================== */

export interface ScreenResult {
  outcome: string;
  listType?: 'BLACK' | 'WATCH' | string;
  source?: string;
  matchedEntry?: string;
  matchedEntryId?: number | string | null;
  libraryId?: number | string | null;
  similarity?: number;
  reason?: string;
}

export async function screen(subjectName: string): Promise<ScreenResult> {
  const { data } = await apiClient.post<ScreenResult>('/screening', { subjectName });
  return data;
}

export async function setScreeningThreshold(value: number) {
  const { data } = await apiClient.put('/screening/threshold', { value });
  return data;
}

/* ==================== R12 商户评级 ==================== */

export interface MerchantRating {
  merchantId: string;
  score?: number;
  level?: string;
  status: string;
  updatedAt?: string;
}

export interface MerchantRatingQueryParams {
  merchantId?: string;
  status?: string;
  level?: string;
  startTimeMs?: number;
  endTimeMs?: number;
  page?: number;
  pageSize?: number;
}

export async function queryMerchantRatings(
  params: MerchantRatingQueryParams = {},
): Promise<PagedData<MerchantRating>> {
  const { data } = await apiClient.get<PagedData<MerchantRating>>('/merchant-ratings', { params });
  if (data && Array.isArray(data.data)) {
    return data;
  }
  return { data: [], page: 1, pageSize: 20, total: 0 };
}

export async function getMerchantRating(merchantId: string): Promise<MerchantRating> {
  const { data } = await apiClient.get<MerchantRating>(`/merchants/${merchantId}/rating`);
  return data;
}

export async function computeMerchantRating(
  merchantId: string,
  factors?: { industry?: number; region?: number; history?: number },
): Promise<MerchantRating> {
  const { data } = await apiClient.post<MerchantRating>(`/merchants/${merchantId}/rating`, {
    factors: factors ?? { industry: 0.5, region: 0.4, history: 0.3 },
  });
  return data;
}

/* ==================== R15 执行链路 ==================== */

export async function getTrace(eventId: string): Promise<unknown> {
  const { data } = await apiClient.get(`/trace/${eventId}`);
  return data;
}

export interface EngineDecisionStats {
  total: number;
  decisionDistribution: Record<string, number>;
  avgElapsedMs: number;
  p99ElapsedMs: number;
  byEventType?: Array<{ eventTypeCode: string; total: number }>;
}

export async function queryEngineDecisionStats(params?: {
  startTimeMs?: number;
  endTimeMs?: number;
  eventTypeCode?: string;
}): Promise<EngineDecisionStats> {
  const { data } = await apiClient.get<EngineDecisionStats>('/engine-decision-records/stats', { params });
  return data;
}

/* ==================== 决策调用 / 订单查询 ==================== */

export interface PagedData<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface EngineDecisionRecord {
  eventId: string;
  correlationId: string;
  merchantId?: string;
  eventTypeCode: string;
  eventTimeMs: number;
  engineDecision: string;
  finalDecision: string;
  invokeMode?: string;
  rulePackageId?: number;
  decisionFlowId?: number;
  detail?: Record<string, unknown>;
  elapsedMs?: number;
  createdAtMs: number;
}

export interface AiDecisionRecord {
  eventId: string;
  correlationId: string;
  merchantId?: string;
  eventTypeCode?: string;
  eventTimeMs: number;
  status: string;
  agentDecision?: string;
  confidence?: number;
  reason?: string;
  engineDecision?: string;
  divergence?: boolean;
  trace?: Array<Record<string, unknown>>;
  failReason?: string;
  createdAtMs: number;
  completedAtMs?: number;
}

export interface DecisionRecordQueryParams {
  eventId?: string;
  correlationId?: string;
  businessOrderId?: string;
  merchantId?: string;
  eventTypeCode?: string;
  startTimeMs?: number;
  endTimeMs?: number;
  divergenceOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AiDecisionStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  timedOut?: number;
  divergenceCount: number;
  divergenceRate: number;
  failRate?: number;
  byEventType: Array<{ eventTypeCode: string; total: number; divergenceCount: number }>;
  byAdoptionMode?: Array<{ adoptionMode: string; total: number }>;
  modelScoreCalls?: number;
  modelScoreAvailable?: number;
  modelScoreAvailableRate?: number;
}

export async function queryAiDecisionStats(params?: {
  startTimeMs?: number;
  endTimeMs?: number;
  eventTypeCode?: string;
}): Promise<AiDecisionStats> {
  const { data } = await apiClient.get<AiDecisionStats>('/ai-decision-records/stats', { params });
  return (
    data ?? {
      total: 0,
      success: 0,
      failed: 0,
      pending: 0,
      timedOut: 0,
      divergenceCount: 0,
      divergenceRate: 0,
      failRate: 0,
      byEventType: [],
      byAdoptionMode: [],
      modelScoreCalls: 0,
      modelScoreAvailable: 0,
      modelScoreAvailableRate: 0,
    }
  );
}

/** 统一决策查询列表项（引擎 + AI 摘要，调用维度）。 */
export interface UnifiedDecisionRecord {
  eventId: string;
  businessOrderId?: string;
  correlationId: string;
  merchantId?: string;
  eventTypeCode: string;
  eventTimeMs: number;
  engineDecision: string;
  finalDecision: string;
  invokeMode?: string;
  rulePackageId?: number;
  decisionFlowId?: number;
  elapsedMs?: number;
  aiStatus?: string;
  agentDecision?: string;
  confidence?: number;
  divergence?: boolean;
  aiCompletedAtMs?: number;
}

export async function queryDecisionRecords(
  params: DecisionRecordQueryParams,
): Promise<PagedData<UnifiedDecisionRecord>> {
  const { data } = await apiClient.get<PagedData<UnifiedDecisionRecord>>('/decision-records', { params });
  return data ?? { data: [], page: 1, pageSize: 20, total: 0 };
}

/** 单次调用详情（引擎 + AI + 命中规则）。 */
export interface InvocationDetail {
  eventId: string;
  businessOrderId?: string;
  correlationId: string;
  merchantId?: string;
  eventTypeCode?: string;
  eventTimeMs: number;
  engine?: EngineDecisionRecord | null;
  ai?: AiDecisionRecord | null;
  engineHits?: Array<Record<string, unknown>>;
}

export async function getInvocationDetail(eventId: string): Promise<InvocationDetail | null> {
  try {
    const { data } = await apiClient.get<InvocationDetail>(`/decision-records/${eventId}`);
    return data ?? null;
  } catch {
    return null;
  }
}

/** 订单维度聚合摘要。 */
export interface BusinessOrderSummary {
  businessOrderId: string;
  merchantId?: string;
  eventTypeCode?: string;
  invocationCount: number;
  lastEventTimeMs: number;
  latestFinalDecision?: string;
}

export interface BusinessOrderQueryParams {
  businessOrderId?: string;
  merchantId?: string;
  eventTypeCode?: string;
  startTimeMs?: number;
  endTimeMs?: number;
  page?: number;
  pageSize?: number;
}

export async function queryBusinessOrders(
  params: BusinessOrderQueryParams,
): Promise<PagedData<BusinessOrderSummary>> {
  const { data } = await apiClient.get<PagedData<BusinessOrderSummary>>('/business-orders', { params });
  return data ?? { data: [], page: 1, pageSize: 20, total: 0 };
}

export interface OrderInvocationView {
  eventId: string;
  businessOrderId?: string;
  eventTypeCode?: string;
  merchantId?: string;
  eventTimeMs: number;
  finalDecision?: string;
}

export async function listBusinessOrderInvocations(
  businessOrderId: string,
  page = 1,
  pageSize = 20,
): Promise<PagedData<OrderInvocationView>> {
  const { data } = await apiClient.get<PagedData<OrderInvocationView>>(
    `/business-orders/${encodeURIComponent(businessOrderId)}/invocations`,
    { params: { page, pageSize } },
  );
  return data ?? { data: [], page: 1, pageSize: 20, total: 0 };
}
