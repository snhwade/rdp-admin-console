import { apiClient } from '../client';
import {
  canvasFromBackend,
  canvasToBackendPayload,
  type BackendFlowEdge,
  type BackendFlowNode,
} from '@/utils/flowCanvasMapper';

/**
 * 决策流（Decision Flow）中性 API 模块。
 *
 * 与 rule-config-service {@code /api/v1/decision-flows} 对齐。
 */

/** 决策流状态：已上线 / 已下线（卡片墙展示）。 */
export type DecisionFlowStatus = 'ONLINE' | 'OFFLINE' | (string & {});

/** 决策流节点类型（9 类，R9.1）。 */
export type DecisionFlowNodeType =
  | 'START'
  | 'END'
  | 'RULE_PACKAGE'
  | 'MODEL'
  | 'DECISION_TOOL'
  | 'LIST_CHECK'
  | 'CONDITION_GATEWAY'
  | 'PARALLEL_GATEWAY'
  | 'CHAMPION_CHALLENGER'
  | 'SUB_FLOW'
  | (string & {});

/** 结束节点决策结果（R9.6）。 */
export type EndDecision =
  | 'REFUND'
  | 'MANUAL_REVIEW'
  | 'AUTO_PASS'
  | 'AUTO_REJECT'
  | (string & {});

/** 决策流卡片视图（R8.1）。 */
export interface DecisionFlowCardView {
  id: number | string;
  name: string;
  owner?: string | null;
  eventPath?: string | null;
  status: DecisionFlowStatus;
  eventTypeCode?: string;
  /** 备注（人工说明）。 */
  remark?: string | null;
}

/** 决策流详情（含画布）。 */
export interface DecisionFlowDetailView {
  id: number | string;
  name: string;
  eventTypeCode: string;
  startNodeId: string;
  status?: string;
  /** 列表接口附加：ONLINE / OFFLINE */
  cardStatus?: DecisionFlowStatus;
  remark?: string | null;
  nodes: BackendFlowNode[];
  edges: BackendFlowEdge[];
}

/** 创建决策流请求（R8.2）。 */
export interface CreateDecisionFlowBody {
  name: string;
  eventCode: string;
  remark?: string | null;
}

/** 画布节点（R9.2/9.4）。 */
export interface FlowNode {
  id: string;
  type: DecisionFlowNodeType;
  x?: number;
  y?: number;
  config?: Record<string, unknown>;
}

/** 画布连线（R9.3）。 */
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string | null;
}

/** 画布内容（节点 + 连线，R9.8）。 */
export interface FlowCanvas {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** 决策流版本摘要（R8.5）。 */
export interface DecisionFlowVersionView {
  version: number;
  status: DecisionFlowStatus;
  createdBy?: string | null;
  createdAt?: string | null;
}

/** 版本对比结果（用于读取上线版本快照）。 */
export interface DecisionFlowCompareResult {
  decisionFlowId: number | string;
  fromSnapshot: {
    version: number;
    snapshot: Record<string, unknown>;
  };
  toSnapshot: {
    version: number;
    snapshot: Record<string, unknown>;
  };
}

/** 列出某事件下的决策流卡片（R8.1）。 */
export async function listDecisionFlows(
  eventCode?: string,
): Promise<DecisionFlowCardView[]> {
  const { data } = await apiClient.get<DecisionFlowDetailView[]>('/decision-flows', {
    params: eventCode ? { eventTypeCode: eventCode } : undefined,
  });
  return (data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    eventTypeCode: f.eventTypeCode,
    status: f.cardStatus === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
    owner: null,
    eventPath: null,
    remark: f.remark ?? null,
  }));
}

/** 决策流详情（含当前画布）。 */
export async function getDecisionFlow(id: number | string): Promise<DecisionFlowDetailView> {
  const { data } = await apiClient.get<DecisionFlowDetailView>(`/decision-flows/${id}`);
  return data;
}

/** 读取指定版本快照并转为画布。 */
export async function getDecisionFlowCanvasByVersion(
  flowId: number | string,
  version: number,
): Promise<FlowCanvas> {
  const { data } = await apiClient.get<DecisionFlowCompareResult>(
    `/decision-flows/${flowId}/versions/compare`,
    { params: { from: version, to: version } },
  );
  const snap = data.fromSnapshot?.snapshot ?? data.toSnapshot?.snapshot ?? {};
  return canvasFromBackend(
    snap.nodes as BackendFlowNode[] | undefined,
    snap.edges as BackendFlowEdge[] | undefined,
  );
}

/** 创建决策流（R8.2）。 */
export async function createDecisionFlow(
  body: CreateDecisionFlowBody,
): Promise<DecisionFlowCardView> {
  const { data } = await apiClient.post<DecisionFlowDetailView>('/decision-flows', {
    name: body.name,
    eventTypeCode: body.eventCode,
    remark: body.remark ?? null,
  });
  return {
    id: data.id,
    name: data.name,
    eventTypeCode: data.eventTypeCode,
    status: 'OFFLINE',
    remark: data.remark ?? body.remark ?? null,
  };
}

/** 保存决策流画布 → 新建版本（R8.4/9.8）。 */
export async function saveDecisionFlowCanvas(
  id: number | string,
  flowName: string,
  eventTypeCode: string,
  canvas: FlowCanvas,
): Promise<DecisionFlowVersionView> {
  const payload = canvasToBackendPayload(canvas, flowName, eventTypeCode);
  await apiClient.put<DecisionFlowDetailView>(`/decision-flows/${id}`, {
    name: payload.name,
    nodes: payload.nodes,
    edges: payload.edges,
    startNodeId: payload.startNodeId,
    status: 'ENABLED',
  });
  const versions = await listDecisionFlowVersions(id);
  const latest = versions[0];
  return latest ?? {
    version: versions.length,
    status: 'OFFLINE',
  };
}

/** 查询决策流版本历史（R8.5）。 */
export async function listDecisionFlowVersions(
  id: number | string,
): Promise<DecisionFlowVersionView[]> {
  const { data } = await apiClient.get<DecisionFlowVersionView[]>(
    `/decision-flows/${id}/versions`,
  );
  return (data ?? []).sort((a, b) => b.version - a.version);
}

/** 上线某决策流版本（R8.6）。 */
export async function onlineDecisionFlowVersion(
  id: number | string,
  version: number,
): Promise<DecisionFlowVersionView[]> {
  const { data } = await apiClient.post<DecisionFlowVersionView[]>(
    `/decision-flows/${id}/versions/${version}:online`,
    {},
  );
  return data ?? [];
}

/** 回退到上一启用版本（R1）。 */
export async function rollbackDecisionFlowLastOnline(
  id: number | string,
): Promise<DecisionFlowVersionView[]> {
  const { data } = await apiClient.post<DecisionFlowVersionView[]>(
    `/decision-flows/${id}:rollback-last-online`,
    {},
  );
  return data ?? [];
}

/** 下线决策流（R8.7）。 */
export async function offlineDecisionFlow(id: number | string): Promise<DecisionFlowCardView> {
  await apiClient.post(`/decision-flows/${id}:offline`, {});
  return {
    id,
    name: '',
    status: 'OFFLINE',
  };
}
