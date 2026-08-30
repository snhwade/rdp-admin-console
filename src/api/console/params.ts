import { apiClient } from '../client';
import type { EnableStatus } from './types';

/**
 * 参数管理（Parameter Management）中性 API：事件、字段库、事件字段、验证策略。
 * 路径对应 admin-bff 的 /bff/api/v1 聚合接口（apiClient.baseURL 已含 /bff/api/v1）。
 *
 * 命名中性化（Requirement 1.2/1.5）：导出标识全部中性，供本期改造页面 import，
 * 不再直接引用旧版共享 API 模块。
 *
 * 覆盖需求：R2（事件管理）、R3（字段库）、R4（事件字段）、R5（验证策略）。
 */

/* =====================================================================================
 * 事件用途与类型分型枚举（R2.3/R2.4）
 * ===================================================================================== */

/** 事件用途：计算 / 决策（可多选，至少一个）。 */
export type EventPurpose = 'COMPUTE' | 'DECISION' | (string & {});
/** 事件类型分型：维度表 / 事实表（二选一）。 */
export type EventKind = 'DIMENSION' | 'FACT' | (string & {});

/* =====================================================================================
 * 业务场景 → 事件 树（R2.1）
 * ===================================================================================== */

/** 业务场景树节点下的事件摘要。 */
export interface ScenarioTreeEvent {
  id: number | string;
  code: string;
  name: string;
}

/** 业务场景树节点（场景 → 下属事件）。 */
export interface ScenarioTreeNode {
  id: number | string;
  code: string;
  name: string;
  events: ScenarioTreeEvent[];
}

/** 获取"业务场景 → 事件"树。 */
export async function listScenarioTree(): Promise<ScenarioTreeNode[]> {
  const { data } = await apiClient.get<ScenarioTreeNode[]>('/scenarios/tree');
  return data ?? [];
}

/** 业务场景视图（与后端 ScenarioView 对齐）。 */
export interface ScenarioView {
  id: number | string;
  code: string;
  name: string;
  status?: string;
  eventTypeCodes?: string[];
}

/** 创建业务场景请求。 */
export interface CreateScenarioBody {
  code: string;
  name: string;
}

/** 创建业务场景（R2.1：先有场景才能在其下新建事件）。 */
export async function createScenario(body: CreateScenarioBody): Promise<ScenarioView> {
  const { data } = await apiClient.post<ScenarioView>('/scenarios', {
    code: body.code,
    name: body.name,
    eventTypeCodes: [],
  });
  return data;
}

/* =====================================================================================
 * 事件 Event（R2）
 * ===================================================================================== */

/** 事件视图。 */
export interface EventView {
  id: number | string;
  code: string;
  name: string;
  /** 所属业务场景。 */
  scenarioId: number | string | null;
  /** 事件用途（多选）。 */
  purposes: EventPurpose[];
  /** 事件类型分型。 */
  eventKind: EventKind | null;
  status: EnableStatus;
}

/** 创建事件请求。 */
export interface CreateEventBody {
  code: string;
  name: string;
  scenarioId: number | string;
  purposes: EventPurpose[];
  eventKind: EventKind;
}

/** 编辑事件请求（code 不可改）。 */
export type UpdateEventBody = Omit<CreateEventBody, 'code'>;

/** 引擎可执行状态枚举（与后端 EventEngineStatusQuery.Status 对齐，R2.11）。 */
export type EngineStatus = 'EXECUTABLE' | 'NOT_EXECUTABLE' | 'UNKNOWN' | (string & {});

/** 事件引擎可执行状态（R2.11，与后端 EngineStatusView 对齐）。 */
export interface EventEngineStatusView {
  eventId: number | string;
  /** 引擎可执行状态。 */
  engineStatus: EngineStatus;
}

/** 单条导入失败明细（与后端 ImportFailureView 对齐，R2.10）。 */
export interface ImportFailureView {
  index: number;
  code: string;
  reason: string;
}

/** 批量导入结果（与后端 ImportResultView 对齐，R2.10）。 */
export interface ImportEventsResult {
  successCount: number;
  failureCount: number;
  succeeded: EventView[];
  failures: ImportFailureView[];
}

/** 列出某业务场景下的事件（R2.1）。 */
export async function listEvents(scenarioId?: number | string): Promise<EventView[]> {
  const { data } = await apiClient.get<EventView[]>('/events', {
    params: scenarioId != null ? { scenarioId } : undefined,
  });
  return data ?? [];
}

/** 事件详情。 */
export async function getEvent(id: number | string): Promise<EventView> {
  const { data } = await apiClient.get<EventView>(`/events/${id}`);
  return data;
}

/** 创建事件（R2.2–2.6）。 */
export async function createEvent(body: CreateEventBody): Promise<EventView> {
  const { data } = await apiClient.post<EventView>('/events', body);
  return data;
}

/** 编辑事件（R2.7）。 */
export async function updateEvent(
  id: number | string,
  body: UpdateEventBody,
): Promise<EventView> {
  const { data } = await apiClient.put<EventView>(`/events/${id}`, body);
  return data;
}

/** 删除事件（无关联依赖时，R2.8/2.9）。 */
export async function deleteEvent(id: number | string): Promise<void> {
  await apiClient.delete(`/events/${id}`);
}

/** 批量导入事件（逐条校验，返回成功数与每条失败原因，R2.10）。 */
export async function importEvents(items: CreateEventBody[]): Promise<ImportEventsResult> {
  const { data } = await apiClient.post<ImportEventsResult>('/events/import', items);
  return data;
}

/** 查询事件引擎可执行状态（R2.11）。 */
export async function getEventEngineStatus(
  id: number | string,
): Promise<EventEngineStatusView> {
  const { data } = await apiClient.get<EventEngineStatusView>(`/events/${id}/engine-status`);
  return data;
}

/* =====================================================================================
 * 字段库 Field（R3）
 * ===================================================================================== */

/** 受支持的字段数据类型（至少 String/Double/Integer/Boolean/Date，R3.3）。 */
export type FieldDataType =
  | 'String'
  | 'Double'
  | 'Integer'
  | 'Boolean'
  | 'Date'
  | (string & {});

/** 全局字段视图（与后端 FieldDefinition 对齐）。 */
export interface FieldView {
  id: number | string;
  /** 字段英文 code。 */
  code: string;
  /** 字段名称。 */
  name: string;
  dataType: FieldDataType;
  /** 字段含义说明。 */
  label?: string | null;
  enabled?: boolean;
}

/** 创建字段请求。 */
export interface CreateFieldBody {
  code: string;
  name: string;
  dataType: FieldDataType;
  /** 含义说明（可选）。 */
  label?: string;
}

/** 编辑字段请求（与后端 FieldRequest 对齐；后端按 id 更新，code 透传即可）。 */
export interface UpdateFieldBody {
  code: string;
  name: string;
  dataType: FieldDataType;
  label?: string;
  enabled?: boolean;
}

/** 单条字段导入失败明细（与后端 FieldImportResult.Failure 对齐，R3.6）。 */
export interface FieldImportFailure {
  index: number;
  code: string;
  reason: string;
}

/** 字段批量导入结果（与后端 FieldImportResult 对齐，R3.6）。 */
export interface ImportFieldsResult {
  /** 校验通过并已持久化的字段。 */
  imported: FieldView[];
  /** 校验未通过的记录及其原因。 */
  failures: FieldImportFailure[];
}

/** 字段关联关系中的枚举值引用（与后端 FieldRelations.EnumValueRef 对齐）。 */
export interface FieldEnumValueRef {
  enumLibId: number | string;
  value: string;
  label: string;
}

/** 字段关联关系中的衍生字段引用（与后端 DerivedField 对齐，按需取用）。 */
export interface FieldDerivedFieldRef {
  id: number | string;
  name: string;
  eventTypeCode?: string;
  expression?: string;
}

/** 字段关联关系视图（引用该字段的事件、枚举值与衍生字段，R3.7；与后端 FieldRelations 对齐）。 */
export interface FieldRelationView {
  fieldId: number | string;
  fieldCode: string;
  fieldName: string;
  /** 引用该字段的事件 code 列表。 */
  events: string[];
  /** 引用该字段的枚举值列表。 */
  enumValues: FieldEnumValueRef[];
  /** 引用该字段的衍生字段列表。 */
  derivedFields: FieldDerivedFieldRef[];
  /** 会阻断删除/改 code 的引用类型（事件字段/规则包/决策流/指标）。 */
  blockingReferences?: string[];
}

/** 列出全局字段（R3.1）。 */
export async function listFields(): Promise<FieldView[]> {
  const { data } = await apiClient.get<FieldView[]>('/fields');
  return data ?? [];
}

/** 字段详情。 */
export async function getField(id: number | string): Promise<FieldView> {
  const { data } = await apiClient.get<FieldView>(`/fields/${id}`);
  return data;
}

/** 创建字段（R3.2–3.5）。 */
export async function createField(body: CreateFieldBody): Promise<FieldView> {
  const { data } = await apiClient.post<FieldView>('/fields', body);
  return data;
}

/** 编辑字段。 */
export async function updateField(
  id: number | string,
  body: UpdateFieldBody,
): Promise<FieldView> {
  const { data } = await apiClient.put<FieldView>(`/fields/${id}`, body);
  return data;
}

/** 删除全局字段；若仍被引用则后端返回 FIELD.IN_USE。 */
export async function deleteField(id: number | string): Promise<void> {
  await apiClient.delete(`/fields/${id}`);
}

/** 批量导入字段（逐条校验，返回成功与逐条失败原因，R3.6）。 */
export async function importFields(items: CreateFieldBody[]): Promise<ImportFieldsResult> {
  const { data } = await apiClient.post<ImportFieldsResult>('/fields/import', {
    records: items,
  });
  return data;
}

/** 查询字段关联关系（R3.7）。 */
export async function getFieldRelations(id: number | string): Promise<FieldRelationView> {
  const { data } = await apiClient.get<FieldRelationView>(`/fields/${id}/relations`);
  return data;
}

/* =====================================================================================
 * 事件字段 Event Field（R4）
 * ===================================================================================== */

/** 事件字段视图（"事件—全局字段"关联，与后端 EventFieldAppService.EventFieldView 对齐）。 */
export interface EventFieldView {
  id: number | string;
  /** 所属事件 code（后端字段名 eventTypeCode）。 */
  eventTypeCode: string;
  fieldId: number | string;
  /** 字段 code（冗余展示）。 */
  fieldCode?: string;
  /** 字段名称（冗余展示）。 */
  fieldName?: string;
  /** 字段类型（冗余展示）。 */
  dataType?: FieldDataType;
  /** 用途（COMPUTE/DECISION，至少一个）。 */
  purposes: EventPurpose[];
  /** 是否衍生字段。 */
  derived: boolean;
}

/** 从字段库添加事件字段请求（R4.2）。 */
export interface AddEventFieldBody {
  fieldId: number | string;
  purposes: EventPurpose[];
  derived?: boolean;
}

/** 列出某事件下的字段（R4.1）。 */
export async function listEventFields(eventCode: string): Promise<EventFieldView[]> {
  const { data } = await apiClient.get<EventFieldView[]>(`/events/${eventCode}/fields`);
  return data ?? [];
}

/** 从字段库添加全局字段到事件（重复关联拒绝，R4.2/4.4）。 */
export async function addEventField(
  eventCode: string,
  body: AddEventFieldBody,
): Promise<EventFieldView> {
  const { data } = await apiClient.post<EventFieldView>(
    `/events/${eventCode}/fields`,
    body,
  );
  return data;
}

/** 标记/取消标记事件字段为衍生字段（R4.5）。 */
export async function markEventFieldDerived(
  eventCode: string,
  eventFieldId: number | string,
  derived: boolean,
): Promise<EventFieldView> {
  const { data } = await apiClient.put<EventFieldView>(
    `/events/${eventCode}/fields/${eventFieldId}/derived`,
    { derived },
  );
  return data;
}

/** 从事件下移除事件字段（被引用时拒绝，R4.6/4.7）。 */
export async function removeEventField(
  eventCode: string,
  eventFieldId: number | string,
): Promise<void> {
  await apiClient.delete(`/events/${eventCode}/fields/${eventFieldId}`);
}

/* =====================================================================================
 * 验证策略 Verify Strategy（R5）
 * ===================================================================================== */

/** 验证策略视图（全局通用，不绑定业务场景）。 */
export interface VerifyStrategyView {
  id: number | string;
  code: string;
  name: string;
  /** 优先级 1..9999，数值越大优先级越高。 */
  priority: number;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

/** 后端验证策略响应原始结构（字段名 anyScope，与 VerifyStrategyController.VerifyStrategyView 对齐）。 */
interface VerifyStrategyRaw {
  id: number | string;
  code: string;
  name: string;
  priority: number;
  anyScope: boolean;
  scopeScenarioId: number | string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

/** 将后端响应（anyScope）映射为前端视图（anyScenario）。 */
function toVerifyStrategyView(raw: VerifyStrategyRaw): VerifyStrategyView {
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    priority: raw.priority,
    updatedBy: raw.updatedBy ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

/** 创建验证策略请求（全局通用，不绑定业务场景）。 */
export interface CreateVerifyStrategyBody {
  code: string;
  name: string;
  priority: number;
}

/** 后端创建/编辑请求体（字段名 anyScope，与 VerifyStrategyController 请求记录对齐）。 */
interface VerifyStrategyRequestPayload {
  code?: string;
  name: string;
  priority: number;
  anyScope: boolean;
  scopeScenarioId: number | string | null;
}

/** 编辑验证策略请求（code 不可改）。 */
export type UpdateVerifyStrategyBody = Omit<CreateVerifyStrategyBody, 'code'>;

/** 验证策略关联关系视图（引用该策略的规则与评分区间绑定，R5.8）。 */
export interface VerifyStrategyRelationView {
  strategyId: number | string;
  /** 引用该策略的规则标识列表。 */
  ruleRefs: (number | string)[];
  /** 引用该策略的评分区间绑定标识列表。 */
  scoreBandRefs: (number | string)[];
}

/** 列出验证策略（仅 category=VERIFY，R5.1/5.2）。 */
export async function listVerifyStrategies(): Promise<VerifyStrategyView[]> {
  const { data } = await apiClient.get<VerifyStrategyRaw[]>('/verify-strategies');
  return (data ?? []).map(toVerifyStrategyView);
}

/** 验证策略详情。 */
export async function getVerifyStrategy(
  id: number | string,
): Promise<VerifyStrategyView> {
  const { data } = await apiClient.get<VerifyStrategyRaw>(`/verify-strategies/${id}`);
  return toVerifyStrategyView(data);
}

/** 创建验证策略（优先级范围与 code 唯一校验，R5.3/5.6/5.7）。 */
export async function createVerifyStrategy(
  body: CreateVerifyStrategyBody,
): Promise<VerifyStrategyView> {
  const payload: VerifyStrategyRequestPayload = {
    code: body.code,
    name: body.name,
    priority: body.priority,
    anyScope: true,
    scopeScenarioId: null,
  };
  const { data } = await apiClient.post<VerifyStrategyRaw>('/verify-strategies', payload);
  return toVerifyStrategyView(data);
}

/** 编辑验证策略。 */
export async function updateVerifyStrategy(
  id: number | string,
  body: UpdateVerifyStrategyBody,
): Promise<VerifyStrategyView> {
  const payload: VerifyStrategyRequestPayload = {
    name: body.name,
    priority: body.priority,
    anyScope: true,
    scopeScenarioId: null,
  };
  const { data } = await apiClient.put<VerifyStrategyRaw>(`/verify-strategies/${id}`, payload);
  return toVerifyStrategyView(data);
}

/** 查询验证策略关联关系（R5.8）。 */
export async function getVerifyStrategyRelations(
  id: number | string,
): Promise<VerifyStrategyRelationView> {
  const { data } = await apiClient.get<VerifyStrategyRelationView>(
    `/verify-strategies/${id}/relations`,
  );
  return data;
}
