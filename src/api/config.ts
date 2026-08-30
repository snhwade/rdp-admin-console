import { apiClient } from './client';

/**
 * 配置类页面的 BFF 接口封装（事件类型/规则/规则组/选择器/指标定义/决策优先级）。
 * 路径对应 admin-bff 的 /bff/api/v1 聚合接口（baseURL 已含 /bff/api/v1）。
 */

/* -------------------- 登录（S10） -------------------- */

export interface LoginResult {
  token: string;
  username: string;
  roles: string[];
}

/** 用户名+密码登录，成功返回 JWT 令牌与角色（POST /bff/api/v1/auth/login）。 */
export async function login(username: string, password: string): Promise<LoginResult> {
  const { data } = await apiClient.post<LoginResult>('/auth/login', { username, password });
  return data;
}

/* -------------------- 事件类型（R1） -------------------- */

export type EventTypeStatus = 'ENABLED' | 'DISABLED' | (string & {});

export interface EventType {
  id: number | string;
  code: string;
  name: string;
  status: EventTypeStatus;
}

export async function listEventTypes(): Promise<EventType[]> {
  const { data } = await apiClient.get<EventType[]>('/event-types');
  return data ?? [];
}

export async function createEventType(body: { code: string; name: string }): Promise<EventType> {
  const { data } = await apiClient.post<EventType>('/event-types', body);
  return data;
}

export async function updateEventTypeStatus(
  id: number | string,
  status: EventTypeStatus,
): Promise<EventType> {
  const { data } = await apiClient.put<EventType>(`/event-types/${id}/status`, { status });
  return data;
}

/* -------------------- 指标定义（R7） -------------------- */

export type IndicatorStatus = 'ONLINE' | 'OFFLINE';

export interface IndicatorDefinitionView {
  id: number | string;
  groupId?: number | string | null;
  refName: string;
  name?: string | null;
  description?: string | null;
  eventTypeCodes: string[];
  dimensions: string[];
  windowDays: number;
  sliceGranularity: 'MINUTE' | 'HOUR' | 'DAY';
  accScript: string;
  defaultValueStrategy?: string | null;
  status: IndicatorStatus;
  templateType?: string | null;
  templateConfig?: Record<string, unknown> | null;
}

export interface CreateIndicatorBody {
  groupId?: number | string | null;
  refName: string;
  name?: string;
  description?: string;
  eventTypeCodes: string[];
  dimensions: string[];
  windowDays: number;
  sliceGranularity: 'MINUTE' | 'HOUR' | 'DAY';
  accScript: string;
  defaultValueStrategy: string;
  templateType?: string;
  templateConfig?: Record<string, unknown>;
}

export type UpdateIndicatorBody = Omit<CreateIndicatorBody, 'refName'>;

export async function listIndicatorDefinitions(params?: {
  groupId?: number | string;
  ungrouped?: boolean;
  eventTypeCode?: string;
  status?: IndicatorStatus;
}): Promise<IndicatorDefinitionView[]> {
  const { data } = await apiClient.get<IndicatorDefinitionView[]>('/indicator-definitions', {
    params,
  });
  return data ?? [];
}

export async function createIndicatorDefinition(body: CreateIndicatorBody): Promise<IndicatorDefinitionView> {
  const { data } = await apiClient.post<IndicatorDefinitionView>('/indicator-definitions', body);
  return data;
}

export async function updateIndicatorDefinition(
  id: number | string,
  body: UpdateIndicatorBody,
): Promise<IndicatorDefinitionView> {
  const { data } = await apiClient.put<IndicatorDefinitionView>(`/indicator-definitions/${id}`, body);
  return data;
}

export async function deleteIndicatorDefinition(id: number | string): Promise<void> {
  await apiClient.delete(`/indicator-definitions/${id}`);
}

export async function onlineIndicatorDefinition(id: number | string): Promise<IndicatorDefinitionView> {
  const { data } = await apiClient.put<IndicatorDefinitionView>(`/indicator-definitions/${id}/online`);
  return data;
}

export async function offlineIndicatorDefinition(id: number | string): Promise<IndicatorDefinitionView> {
  const { data } = await apiClient.put<IndicatorDefinitionView>(`/indicator-definitions/${id}/offline`);
  return data;
}

export interface IndicatorReferenceDto {
  ruleId: number | string;
  ruleName?: string;
  ruleVersion?: number;
  eventTypeCode?: string;
  status?: string;
}

export async function listIndicatorReferences(refName: string): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/indicator-definitions/references', {
    params: { refName },
  });
  return data ?? [];
}

export interface IndicatorRuntimeStatsView {
  refName: string;
  status?: string | null;
  lastAccumulateAt?: string | null;
  readMissCount: number;
  indicatorDefinitionId?: number | string | null;
}

export async function listIndicatorRuntimeStats(params: {
  groupId?: number | string;
  refName?: string;
}): Promise<IndicatorRuntimeStatsView[]> {
  const { data } = await apiClient.get<IndicatorRuntimeStatsView[]>('/indicator-definitions/runtime-stats', {
    params,
  });
  return data ?? [];
}

export interface IndicatorDefinitionSnapshotView {
  version: number;
  createdBy?: string | null;
  createdAt?: string | null;
}

export async function listIndicatorDefinitionSnapshots(
  id: number | string,
): Promise<IndicatorDefinitionSnapshotView[]> {
  const { data } = await apiClient.get<IndicatorDefinitionSnapshotView[]>(
    `/indicator-definitions/${id}/definition-snapshots`,
  );
  return data ?? [];
}

export async function rollbackIndicatorDefinition(id: number | string): Promise<IndicatorDefinitionView> {
  const { data } = await apiClient.post<IndicatorDefinitionView>(
    `/indicator-definitions/${id}/rollback-last-definition`,
  );
  return data;
}

/* -------------------- 逻辑指标（方案 C） -------------------- */

export type CombineMode = 'SUM' | 'EXPRESSION';

export interface LogicalIndicatorMemberView {
  memberRefName: string;
  eventTypeCode?: string | null;
  sortOrder: number;
}

export interface LogicalIndicatorView {
  id: number | string;
  groupId?: number | string | null;
  refName: string;
  name?: string | null;
  description?: string | null;
  combineMode: CombineMode;
  combineExpression?: string | null;
  dimensions: string[];
  windowDays: number;
  sliceGranularity: 'MINUTE' | 'HOUR' | 'DAY';
  defaultValueStrategy?: string | null;
  status: IndicatorStatus;
  members: LogicalIndicatorMemberView[];
  indicatorKind: 'LOGICAL';
}

export interface SaveLogicalIndicatorBody {
  groupId?: number | string | null;
  refName: string;
  name?: string;
  description?: string;
  combineMode: CombineMode;
  combineExpression?: string;
  dimensions: string[];
  windowDays: number;
  sliceGranularity: 'MINUTE' | 'HOUR' | 'DAY';
  defaultValueStrategy?: string;
  members: { memberRefName: string; eventTypeCode?: string }[];
}

export type UpdateLogicalIndicatorBody = Omit<SaveLogicalIndicatorBody, 'refName'>;

export async function listLogicalIndicators(params?: {
  groupId?: number | string;
  ungrouped?: boolean;
  status?: IndicatorStatus;
}): Promise<LogicalIndicatorView[]> {
  const { data } = await apiClient.get<LogicalIndicatorView[]>('/logical-indicators', { params });
  return data ?? [];
}

export async function createLogicalIndicator(body: SaveLogicalIndicatorBody): Promise<LogicalIndicatorView> {
  const { data } = await apiClient.post<LogicalIndicatorView>('/logical-indicators', body);
  return data;
}

export async function updateLogicalIndicator(
  id: number | string,
  body: UpdateLogicalIndicatorBody,
): Promise<LogicalIndicatorView> {
  const { data } = await apiClient.put<LogicalIndicatorView>(`/logical-indicators/${id}`, body);
  return data;
}

export async function deleteLogicalIndicator(id: number | string): Promise<void> {
  await apiClient.delete(`/logical-indicators/${id}`);
}

export async function onlineLogicalIndicator(id: number | string): Promise<LogicalIndicatorView> {
  const { data } = await apiClient.put<LogicalIndicatorView>(`/logical-indicators/${id}/online`);
  return data;
}

export async function offlineLogicalIndicator(id: number | string): Promise<LogicalIndicatorView> {
  const { data } = await apiClient.put<LogicalIndicatorView>(`/logical-indicators/${id}/offline`);
  return data;
}

/* -------------------- 指标分组 -------------------- */

export interface IndicatorGroupCardView {
  id: number | string | null;
  name: string;
  orgName: string;
  eventTypeCodes: string[];
  onlineCount: number;
  offlineCount: number;
}

export interface IndicatorGroupView extends Omit<IndicatorGroupCardView, 'onlineCount' | 'offlineCount'> {
  description?: string | null;
}

export interface SaveIndicatorGroupBody {
  name: string;
  orgName?: string;
  eventTypeCodes: string[];
  description?: string;
}

export async function listIndicatorGroups(): Promise<IndicatorGroupCardView[]> {
  const { data } = await apiClient.get<IndicatorGroupCardView[]>('/indicator-groups');
  return data ?? [];
}

export async function createIndicatorGroup(body: SaveIndicatorGroupBody): Promise<IndicatorGroupView> {
  const { data } = await apiClient.post<IndicatorGroupView>('/indicator-groups', body);
  return data;
}

export async function updateIndicatorGroup(
  id: number | string,
  body: SaveIndicatorGroupBody,
): Promise<IndicatorGroupView> {
  const { data } = await apiClient.put<IndicatorGroupView>(`/indicator-groups/${id}`, body);
  return data;
}

export async function deleteIndicatorGroup(id: number | string): Promise<void> {
  await apiClient.delete(`/indicator-groups/${id}`);
}

/* -------------------- AI Agent 策略 -------------------- */

export interface AgentStrategyView {
  id: number | string;
  code: string;
  name: string;
  description?: string | null;
  eventTypeCodes: string[];
  configJson: string;
  status: 'ENABLED' | 'DISABLED';
  adoptionMode: 'SHADOW' | 'ADVISORY' | 'STRICT' | 'OVERRIDE' | string;
}

export interface AgentAdoptionAuditView {
  id: number | string;
  strategyId: number | string;
  strategyCode: string;
  fromMode?: string | null;
  toMode: string;
  changedBy?: string | null;
  createdAt?: string;
}

export async function listAgentStrategies(): Promise<AgentStrategyView[]> {
  const { data } = await apiClient.get<AgentStrategyView[]>('/agent-strategies');
  return data ?? [];
}

export async function listAgentAdoptionAudits(
  strategyId: number | string,
  limit = 20,
): Promise<AgentAdoptionAuditView[]> {
  const { data } = await apiClient.get<AgentAdoptionAuditView[]>(
    `/agent-strategies/${strategyId}/adoption-audits`,
    { params: { limit } },
  );
  return Array.isArray(data) ? data : [];
}

export async function createAgentStrategy(body: {
  code: string;
  name: string;
  eventTypeCodes: string[];
  configJson: string;
  description?: string;
  adoptionMode?: string;
}): Promise<AgentStrategyView> {
  const { data } = await apiClient.post<AgentStrategyView>('/agent-strategies', body);
  return data;
}

export async function updateAgentStrategy(
  id: number | string,
  body: {
    name: string;
    eventTypeCodes: string[];
    configJson?: string;
    enabled?: boolean;
    description?: string;
    adoptionMode?: string;
  },
): Promise<AgentStrategyView> {
  const { data } = await apiClient.put<AgentStrategyView>(`/agent-strategies/${id}`, body);
  return data;
}

export interface AgentRuntimeView {
  llmProvider: string;
  llmBaseUrl: string;
  defaultModel: string;
  apiKeyEnv: string;
  apiKeyConfigured: boolean;
  defaultLlmMode: string;
  defaultMaxOrchestrationSteps: number;
  defaultAdoptionMode: string;
}

export async function getAgentRuntime(): Promise<AgentRuntimeView> {
  const { data } = await apiClient.get<AgentRuntimeView>('/agent/runtime');
  return data;
}
