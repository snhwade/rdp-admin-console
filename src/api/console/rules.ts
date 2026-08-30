import { apiClient } from '../client';
import type { BatchItemResult } from './types';

/**
 * 规则管理（Rule Management）中性 API 模块 —— 类型骨架。
 *
 * 本模块在任务 8.x（规则包卡片墙与规则列表）中完整填充。此处先建立中性命名的
 * 类型与函数签名骨架，确保命名中性化基线（Requirement 1.2/1.5）就位。
 *
 * 覆盖需求：R6（规则包卡片墙与规则列表）、R7（规则三态语义）。
 */

/** 规则包触发模式：命中 / 评分（创建后不可变，R6.3）。 */
export type RulePackageTriggerMode = 'HIT' | 'SCORE' | (string & {});

/** 规则三态：上线 / 试运行 / 下线（R7.1）。 */
export type RuleStatus = 'ONLINE' | 'TRIAL_RUN' | 'OFFLINE' | (string & {});

/** 规则包卡片墙子页签分类。 */
export type RulePackageCategory =
  | 'BASIC'
  | 'PRIORITY'
  | 'LIST'
  | (string & {});

/** 规则包三态计数（R6.6）。 */
export interface RuleStatusCounts {
  online: number;
  trialRun: number;
  offline: number;
}

/** 规则包卡片视图（含三态计数，R6.1）。 */
export interface RulePackageCardView {
  id: number | string;
  code?: string;
  name: string;
  /** 归属（机构/负责人等）。 */
  owner?: string | null;
  /** @deprecated 使用 eventTypeCodes + 场景树解析展示 */
  eventPath?: string | null;
  /** 关联的决策事件编码（可多个）。 */
  eventTypeCodes?: string[];
  category?: RulePackageCategory;
  triggerMode: RulePackageTriggerMode;
  /** 规则包启停：ENABLED / DISABLED */
  status?: string;
  counts: RuleStatusCounts;
}

/** 创建规则包请求（R6.3）。 */
export interface CreateRulePackageBody {
  code: string;
  name: string;
  triggerMode: RulePackageTriggerMode;
  eventTypeCodes: string[];
  category?: RulePackageCategory;
  /** @deprecated 请使用 eventTypeCodes */
  eventCode?: string;
}

/** 规则列表项视图（R6.4）。 */
export interface RuleListItemView {
  id: number | string;
  code: string;
  name: string;
  status: RuleStatus;
  decisionEventCode?: string | null;
  riskLevelCode?: string | null;
  riskScore?: number | null;
  /** 备注（人工说明）。 */
  remark?: string | null;
}

/** 规则批量操作类型（R6.5）。 */
export type RuleBatchOperation =
  | 'DELETE'
  | 'COPY'
  | 'MOVE'
  | 'ONLINE'
  | 'TRIAL_RUN'
  | 'OFFLINE'
  | 'EDIT_ORG'
  | 'DOWNLOAD'
  | (string & {});

/** 规则批量操作请求（R6.5）。 */
export interface RuleBatchOperationBody {
  operation: RuleBatchOperation;
  ruleIds: (number | string)[];
  /** 操作附加参数（如 MOVE 的目标规则包、EDIT_ORG 的机构）。 */
  params?: Record<string, unknown>;
}

/** 列出某事件下的规则包卡片（含三态计数，R6.1/6.6）。 */
export async function listRulePackages(eventCode?: string): Promise<RulePackageCardView[]> {
  const { data } = await apiClient.get<RulePackageCardView[]>('/rule-packages', {
    params: eventCode ? { eventCode } : undefined,
  });
  return data ?? [];
}

/** 创建规则包（R6.3）。 */
export async function createRulePackage(
  body: CreateRulePackageBody,
): Promise<RulePackageCardView> {
  const eventTypeCodes =
    body.eventTypeCodes?.length ? body.eventTypeCodes : body.eventCode ? [body.eventCode] : [];
  const { data } = await apiClient.post<RulePackageCardView>('/rule-packages', {
    code: body.code,
    name: body.name,
    triggerMode: body.triggerMode,
    eventTypeCodes,
  });
  return data;
}

/** 规则下拉选项（试运行等场景）。 */
export interface RuleOptionView {
  id: number | string;
  code: string;
  name: string;
}

/** 列出全部结构化规则（GET /rules-v2）。 */
export async function listAllRules(): Promise<RuleOptionView[]> {
  const { data } = await apiClient.get<RuleOptionView[]>('/rules-v2');
  return data ?? [];
}

/** 列出规则包下的规则（R6.4）。 */
export async function listRules(rulePackageId: number | string): Promise<RuleListItemView[]> {
  const { data } = await apiClient.get<RuleListItemView[]>(
    `/rule-packages/${rulePackageId}/rules`,
  );
  return data ?? [];
}

/** 将规则状态规范为三态 API 取值。 */
export function normalizeRuleStatus(status: string): RuleStatus {
  const upper = status.trim().toUpperCase();
  if (upper === 'ENABLED' || upper === 'ONLINE') return 'ONLINE';
  if (upper === 'TRIAL_RUN') return 'TRIAL_RUN';
  return 'OFFLINE';
}

/** 对规则执行批量操作（逐条返回结果，R6.5）。 */
export async function batchOperateRules(
  rulePackageId: number | string,
  body: RuleBatchOperationBody,
): Promise<BatchItemResult[]> {
  const payload: Record<string, unknown> = {
    operation: body.operation,
    ruleIds: body.ruleIds.map((id) => Number(id)),
    ...(body.params ?? {}),
  };
  const { data } = await apiClient.post<BatchItemResult[]>(
    `/rule-packages/${rulePackageId}/rules:batch`,
    payload,
  );
  return data ?? [];
}

/** 切换规则三态（R7.2）。 */
export async function updateRuleStatus(
  ruleId: number | string,
  status: RuleStatus,
): Promise<RuleListItemView> {
  const { data } = await apiClient.put<RuleListItemView>(`/rules-v2/${ruleId}/status`, {
    status: normalizeRuleStatus(status),
  });
  return data;
}

/* =====================================================================================
 * 新增规则（结构化规则 rule_v2，R2/R6.4）
 * ===================================================================================== */

/** 规则类型：命中 / 评分（与规则包触发模式对应）。 */
export type RuleKind = 'HIT' | 'SCORE' | (string & {});

/** 叶子条件左变量数据类型（与后端 DataType 对齐）。 */
export type ConditionDataType = 'NUMBER' | 'STRING' | 'BOOLEAN' | 'DATE' | 'COLLECTION' | (string & {});

/** 叶子条件运算符（与后端 Operator 对齐）。 */
export type ConditionOperator =
  | 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | 'NEQ'
  | 'CONTAINS' | 'STARTS_WITH' | 'IN' | 'NOT_IN'
  | (string & {});

/** 左变量来源（与后端 VariableSource 对齐；新增规则默认引用事件字段 FIELD）。 */
export type VariableSource = 'FIELD' | 'INDICATOR' | 'MODEL' | 'ASSIGNMENT' | (string & {});

/** 结构化条件树节点（与后端 ConditionNode JSON 对齐，仅暴露最小可用形态）。 */
export interface ConditionNode {
  op: 'AND' | 'OR' | 'NOT' | 'LEAF' | (string & {});
  children?: ConditionNode[];
  left?: { source: VariableSource; ref: string; dataType: ConditionDataType };
  operator?: ConditionOperator;
  right?: { kind: 'CONST'; value: unknown };
}

/** 新增规则请求（最小可用：单叶子条件 + 常量右值）。 */
export interface CreateRuleBody {
  code: string;
  name: string;
  rulePackageId: number | string;
  ruleKind: RuleKind;
  eventTypeCode?: string | null;
  riskLevelCode?: string | null;
  riskTypeCode?: string | null;
  /** 评分规则基础分（仅 SCORE）。 */
  baseScore?: number | null;
  condition: ConditionNode;
  priority?: number;
  /** 备注（给人看）。 */
  remark?: string | null;
}

/** 规则详情（GET /rules-v2/{id}）。 */
export interface RuleDetailView {
  id: number | string;
  code: string;
  name: string;
  rulePackageId: number | string;
  ruleKind: RuleKind;
  eventTypeCode?: string | null;
  riskLevelCode?: string | null;
  riskTypeCode?: string | null;
  baseScore?: number | null;
  condition: ConditionNode;
  status?: RuleStatus;
  remark?: string | null;
}

/** 更新规则请求（不含 code / ruleKind）。 */
export interface UpdateRuleBody {
  name: string;
  eventTypeCode?: string | null;
  riskLevelCode?: string | null;
  riskTypeCode?: string | null;
  baseScore?: number | null;
  condition: ConditionNode;
  priority?: number;
  remark?: string | null;
}

/** 创建结构化规则（POST /rules-v2）。规则创建后默认下线（OFFLINE），需显式上线。 */
export async function createRule(body: CreateRuleBody): Promise<{ id: number | string }> {
  const { data } = await apiClient.post<{ id: number | string }>('/rules-v2', body);
  return data;
}

/** 规则详情（含条件树）。 */
export async function getRule(id: number | string): Promise<RuleDetailView> {
  const { data } = await apiClient.get<RuleDetailView>(`/rules-v2/${id}`);
  return data;
}

/** 更新规则（重新编译条件树）。 */
export async function updateRule(
  id: number | string,
  body: UpdateRuleBody,
): Promise<RuleDetailView> {
  const { data } = await apiClient.put<RuleDetailView>(`/rules-v2/${id}`, body);
  return data;
}

/** 启用/禁用规则包。 */
export async function setRulePackageStatus(
  id: number | string,
  enabled: boolean,
): Promise<unknown> {
  const { data } = await apiClient.put(`/rule-packages/${id}/status`, null, {
    params: { enabled },
  });
  return data;
}

export interface EnabledSnapshotView {
  version: number;
  createdBy?: string | null;
  createdAt?: string | null;
}

/** 规则包启用快照列表（P2）。 */
export async function listRulePackageEnabledSnapshots(
  id: number | string,
): Promise<EnabledSnapshotView[]> {
  const { data } = await apiClient.get<EnabledSnapshotView[]>(
    `/rule-packages/${id}/enabled-snapshots`,
  );
  return data ?? [];
}

/** 回退到上一启用快照（P2）。 */
export async function rollbackRulePackageLastEnabled(
  id: number | string,
): Promise<unknown> {
  const { data } = await apiClient.post(`/rule-packages/${id}/rollback-last-enabled`);
  return data;
}

