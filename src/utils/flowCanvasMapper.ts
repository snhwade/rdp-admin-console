import type { FlowCanvas, FlowEdge, FlowNode } from '@/api/console';

/** 后端决策流节点（GET /decision-flows/{id} 或版本快照）。 */
export interface BackendFlowNode {
  nodeId: string;
  type: string;
  refType?: string | null;
  refId?: number | string | null;
  config?: string | Record<string, unknown> | null;
  x?: number;
  y?: number;
}

/** 后端决策流边。 */
export interface BackendFlowEdge {
  from: string;
  to: string;
  condition?: string | null;
  trafficPercent?: number | null;
  isDefault?: boolean;
}

export function parseNodeConfig(config: unknown): Record<string, unknown> | undefined {
  if (config == null) {
    return undefined;
  }
  if (typeof config === 'string') {
    try {
      return JSON.parse(config) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  return config as Record<string, unknown>;
}

/** 后端 nodes/edges → 前端画布（补默认坐标便于展示）。 */
export function canvasFromBackend(
  nodes: BackendFlowNode[] | undefined,
  edges: BackendFlowEdge[] | undefined,
): FlowCanvas {
  const flowNodes: FlowNode[] = (nodes ?? []).map((n, i) => {
    const parsed = parseNodeConfig(n.config);
    const config: Record<string, unknown> = { ...(parsed ?? {}) };
    if (n.refId != null) {
      config.refId = String(n.refId);
    }
    if (n.refType) {
      config.refType = n.refType;
    }
    return {
      id: n.nodeId,
      type: n.type as FlowNode['type'],
      x: n.x ?? 60 + (i % 3) * 180,
      y: n.y ?? 60 + Math.floor(i / 3) * 110,
      config,
    };
  });
  const flowEdges: FlowEdge[] = (edges ?? []).map((e, i) => ({
    id: `edge_${e.from}_${e.to}_${i}`,
    source: e.from,
    target: e.to,
    label: e.condition ?? undefined,
  }));
  return { nodes: flowNodes, edges: flowEdges };
}

/** 前端画布 → 后端 PUT 请求体片段。 */
export function canvasToBackendPayload(
  canvas: FlowCanvas,
  flowName: string,
  eventTypeCode: string,
): {
  name: string;
  eventTypeCode: string;
  nodes: BackendFlowNode[];
  edges: BackendFlowEdge[];
  startNodeId: string;
} {
  const start = canvas.nodes.find((n) => n.type === 'START');
  const startNodeId = start?.id ?? canvas.nodes[0]?.id ?? 'start';

  const nodes: BackendFlowNode[] = canvas.nodes.map((n) => {
    const cfg = { ...(n.config ?? {}) };
    const refIdRaw = cfg.refId;
    const refId =
      refIdRaw != null && String(refIdRaw).trim() !== '' ? Number(refIdRaw) : null;
    const refTypeFromConfig =
      typeof cfg.refType === 'string' && cfg.refType.trim() !== ''
        ? cfg.refType.trim().toUpperCase()
        : null;
    delete cfg.refId;
    delete cfg.refType;

    let configStr: string | null = null;
    if (n.type === 'END' && cfg.endDecision) {
      configStr = JSON.stringify({ endDecision: cfg.endDecision });
    } else if (cfg.label) {
      configStr = JSON.stringify({ label: cfg.label });
    } else if (Object.keys(cfg).length > 0) {
      configStr = JSON.stringify(cfg);
    }

    let refType: string | null = null;
    if (n.type === 'RULE_PACKAGE') {
      refType = 'RULE_PACKAGE';
    } else if (n.type === 'MODEL') {
      refType = 'MODEL';
    } else if (n.type === 'SUB_FLOW') {
      refType = 'SUB_FLOW';
    } else if (n.type === 'DECISION_TOOL') {
      refType = refTypeFromConfig ?? 'DECISION_TABLE';
    }

    return {
      nodeId: n.id,
      type: n.type,
      refType,
      refId: refType != null ? refId : null,
      config: configStr,
      x: n.x,
      y: n.y,
    };
  });

  const edges: BackendFlowEdge[] = canvas.edges.map((e) => ({
    from: e.source,
    to: e.target,
    condition: e.label ?? null,
    trafficPercent: null,
    isDefault: false,
  }));

  return { name: flowName, eventTypeCode, nodes, edges, startNodeId };
}

/** 深比较画布是否变更（用于未保存提示）。 */
export function canvasEquals(a: FlowCanvas, b: FlowCanvas): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
