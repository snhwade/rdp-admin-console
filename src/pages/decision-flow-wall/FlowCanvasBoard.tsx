import {
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { EditOutlined, LinkOutlined } from '@ant-design/icons';
import {
  type DecisionFlowNodeType,
  type EndDecision,
  type FlowCanvas,
  type FlowEdge,
  type FlowNode,
} from '@/api/console';
import {
  FLOW_NODE_VISUALS,
  FlowNodeShapeIcon,
  flowCanvasHint,
  flowCanvasNodeShellStyle,
  flowCanvasSurfaceStyle,
  flowCanvasToolbarStyle,
  flowEdgeLabelPoint,
  flowEdgePath,
  flowNodeColor,
  flowNodeLabel,
  flowNodeShape,
  flowNodeSize,
  flowNodeTitleStyle,
  flowNodeTypeLabelStyle,
  flowPaletteItemStyle,
} from './flowNodeVisual';

const { Text } = Typography;

/** 结束节点决策结果选项（R9.4 / R9.6）。 */
const END_DECISION_OPTIONS: { value: EndDecision; label: string }[] = [
  { value: 'REFUND', label: '退款（REFUND）' },
  { value: 'MANUAL_REVIEW', label: '人工审核（MANUAL_REVIEW）' },
  { value: 'AUTO_PASS', label: '自动通过（AUTO_PASS）' },
  { value: 'AUTO_REJECT', label: '自动拒绝（AUTO_REJECT）' },
];

const DRAG_MIME = 'application/x-flow-node-type';

interface NodeConfigFormValues {
  label?: string;
  endDecision?: EndDecision;
  /** 引用对象标识（规则包 / 模型 / 决策工具 / 子流程）。 */
  refId?: string;
  /** 决策工具类型（仅 DECISION_TOOL 节点）。 */
  refType?: string;
  /** 条件 / 并行网关说明。 */
  expression?: string;
}

export interface FlowCanvasBoardProps {
  /** 受控画布内容。 */
  value: FlowCanvas;
  /** 画布内容变更回调（节点拖拽 / 连线 / 配置变更）。 */
  onChange: (next: FlowCanvas) => void;
  /** 只读展示模式（运行区）。 */
  readonly?: boolean;
  /** 占满父容器高度（全屏编辑模式）。 */
  fillHeight?: boolean;
}

let idSeq = 0;
function nextNodeId(type: DecisionFlowNodeType): string {
  idSeq += 1;
  return `${String(type).toLowerCase()}_${Date.now().toString(36)}_${idSeq}`;
}

function nodeCenter(node: FlowNode): { cx: number; cy: number } {
  const { width, height } = flowNodeSize(node.type);
  return {
    cx: (node.x ?? 0) + width / 2,
    cy: (node.y ?? 0) + height / 2,
  };
}

export default function FlowCanvasBoard({ value, onChange, readonly, fillHeight }: FlowCanvasBoardProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);

  // 连线模式：开启后点击源节点 → 点击目标节点创建连线（R9.3）。
  const [connectMode, setConnectMode] = useState(false);
  const [pendingSource, setPendingSource] = useState<string | null>(null);

  // 节点配置抽屉（R9.4）。
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);
  const [configForm] = Form.useForm<NodeConfigFormValues>();

  // 连线分支标签编辑（R9.3）。
  const [labelEdgeId, setLabelEdgeId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [hoverPalette, setHoverPalette] = useState<string | null>(null);

  // 节点拖拽（重定位）状态。
  const dragState = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [, forceTick] = useState(0);

  const nodes = value.nodes;
  const edges = value.edges;

  const configNode = nodes.find((n) => n.id === configNodeId) ?? null;

  useEffect(() => {
    if (readonly) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConnectMode(false);
        setPendingSource(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readonly]);

  // 同步配置表单初值
  useEffect(() => {
    if (configNode) {
      const cfg = (configNode.config ?? {}) as Record<string, unknown>;
      configForm.setFieldsValue({
        label: (cfg.label as string) ?? '',
        endDecision: (cfg.endDecision as EndDecision) ?? undefined,
        refId: (cfg.refId as string) ?? '',
        refType: (cfg.refType as string) ?? 'DECISION_TABLE',
        expression: (cfg.expression as string) ?? '',
      });
    }
  }, [configNode, configForm]);

  /* ---------------- 节点创建：从面板拖拽落到画布（R9.2） ---------------- */

  const onPaletteDragStart = (type: DecisionFlowNodeType) => (e: ReactDragEvent<HTMLDivElement>) => {
    if (readonly) {
      return;
    }
    e.dataTransfer.setData(DRAG_MIME, String(type));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const onCanvasDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const onCanvasDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    if (readonly) {
      return;
    }
    const type = e.dataTransfer.getData(DRAG_MIME) as DecisionFlowNodeType;
    if (!type) {
      return;
    }
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    const scrollLeft = canvasRef.current?.scrollLeft ?? 0;
    const scrollTop = canvasRef.current?.scrollTop ?? 0;
    const { width, height } = flowNodeSize(type);
    const x = Math.max(0, e.clientX - (rect?.left ?? 0) + scrollLeft - width / 2);
    const y = Math.max(0, e.clientY - (rect?.top ?? 0) + scrollTop - height / 2);
    const node: FlowNode = {
      id: nextNodeId(type),
      type,
      x: Math.round(x),
      y: Math.round(y),
      config: { label: flowNodeLabel(type) },
    };
    onChange({ nodes: [...nodes, node], edges });
  };

  /* ---------------- 节点重定位（指针拖拽） ---------------- */

  const onNodePointerDown = (id: string) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (readonly || connectMode) {
      return;
    }
    const node = nodes.find((n) => n.id === id);
    if (!node) {
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    const scrollLeft = canvasRef.current?.scrollLeft ?? 0;
    const scrollTop = canvasRef.current?.scrollTop ?? 0;
    const pointerX = e.clientX - (rect?.left ?? 0) + scrollLeft;
    const pointerY = e.clientY - (rect?.top ?? 0) + scrollTop;
    dragState.current = {
      id,
      offsetX: pointerX - (node.x ?? 0),
      offsetY: pointerY - (node.y ?? 0),
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onNodePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const ds = dragState.current;
    if (!ds) {
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    const scrollLeft = canvasRef.current?.scrollLeft ?? 0;
    const scrollTop = canvasRef.current?.scrollTop ?? 0;
    const x = Math.max(0, e.clientX - (rect?.left ?? 0) + scrollLeft - ds.offsetX);
    const y = Math.max(0, e.clientY - (rect?.top ?? 0) + scrollTop - ds.offsetY);
    const idx = nodes.findIndex((n) => n.id === ds.id);
    if (idx < 0) {
      return;
    }
    const updated = [...nodes];
    updated[idx] = { ...updated[idx], x: Math.round(x), y: Math.round(y) };
    onChange({ nodes: updated, edges });
    forceTick((t) => t + 1);
  };

  const endNodeDrag = () => {
    dragState.current = null;
  };

  /* ---------------- 节点点击：连线 or 打开配置抽屉 ---------------- */

  const onNodeClick = (id: string) => () => {
    if (readonly) {
      return;
    }
    if (connectMode) {
      if (pendingSource == null) {
        setPendingSource(id);
        return;
      }
      if (pendingSource === id) {
        // 取消选择
        setPendingSource(null);
        return;
      }
      // 完成连线
      const exists = edges.some((e) => e.source === pendingSource && e.target === id);
      if (exists) {
        message.warning('两节点间已存在连线');
      } else {
        const edge: FlowEdge = {
          id: `e_${Date.now().toString(36)}_${pendingSource}_${id}`,
          source: pendingSource,
          target: id,
          label: null,
        };
        onChange({ nodes, edges: [...edges, edge] });
      }
      setPendingSource(null);
      return;
    }
    setConfigNodeId(id);
  };

  const deleteNode = (id: string) => {
    onChange({
      nodes: nodes.filter((n) => n.id !== id),
      edges: edges.filter((e) => e.source !== id && e.target !== id),
    });
    if (configNodeId === id) {
      setConfigNodeId(null);
    }
  };

  /* ---------------- 连线：设置分支标签（R9.3） ---------------- */

  const openEdgeLabel = (edgeId: string) => {
    if (readonly) {
      return;
    }
    const edge = edges.find((e) => e.id === edgeId);
    setLabelEdgeId(edgeId);
    setLabelDraft(edge?.label ?? '');
  };

  const saveEdgeLabel = () => {
    if (labelEdgeId == null) {
      return;
    }
    onChange({
      nodes,
      edges: edges.map((e) =>
        e.id === labelEdgeId ? { ...e, label: labelDraft.trim() === '' ? null : labelDraft.trim() } : e,
      ),
    });
    setLabelEdgeId(null);
    setLabelDraft('');
  };

  const deleteEdge = (edgeId: string) => {
    onChange({ nodes, edges: edges.filter((e) => e.id !== edgeId) });
  };

  /* ---------------- 节点配置保存（R9.4） ---------------- */

  const submitNodeConfig = (values: NodeConfigFormValues) => {
    if (!configNode) {
      return;
    }
    const config: Record<string, unknown> = { ...(configNode.config ?? {}) };
    config.label = values.label?.trim() || flowNodeLabel(configNode.type);
    if (configNode.type === 'END') {
      config.endDecision = values.endDecision;
    } else {
      delete config.endDecision;
    }
    if (['RULE_PACKAGE', 'MODEL', 'DECISION_TOOL', 'SUB_FLOW'].includes(String(configNode.type))) {
      config.refId = values.refId?.trim() || undefined;
    }
    if (configNode.type === 'DECISION_TOOL') {
      config.refType = values.refType?.trim() || 'DECISION_TABLE';
    } else {
      delete config.refType;
    }
    if (['CONDITION_GATEWAY', 'PARALLEL_GATEWAY'].includes(String(configNode.type))) {
      config.expression = values.expression?.trim() || undefined;
    }
    onChange({
      nodes: nodes.map((n) => (n.id === configNode.id ? { ...n, config } : n)),
      edges,
    });
    message.success('节点配置已更新');
    setConfigNodeId(null);
  };

  /* ---------------- 渲染 ---------------- */

  const refLabelMap: Record<string, string> = {
    RULE_PACKAGE: '规则包标识',
    MODEL: '评级模型标识',
    DECISION_TOOL: '决策工具标识',
    SUB_FLOW: '子流程决策流标识',
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: fillHeight ? 0 : 12,
        width: '100%',
        height: fillHeight ? '100%' : undefined,
        minHeight: fillHeight ? 0 : undefined,
      }}
    >
      {!readonly ? (
      <div
        style={{
          width: 168,
          flex: '0 0 168px',
          border: fillHeight ? 'none' : '1px solid #eceef2',
          borderRight: fillHeight ? '1px solid #eceef2' : undefined,
          borderRadius: fillHeight ? 0 : 12,
          padding: 10,
          background: '#fff',
          boxShadow: fillHeight ? 'none' : '0 2px 8px rgba(15,23,42,0.04)',
          overflowY: 'auto',
        }}
      >
        <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>
          节点面板
        </Text>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
          拖拽到画布
        </Text>
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          {FLOW_NODE_VISUALS.map((item) => (
            <div
              key={String(item.type)}
              draggable
              onDragStart={onPaletteDragStart(item.type)}
              onMouseEnter={() => setHoverPalette(String(item.type))}
              onMouseLeave={() => setHoverPalette(null)}
              style={flowPaletteItemStyle(item.color, hoverPalette === String(item.type))}
            >
              <FlowNodeShapeIcon shape={item.shape} color={item.color} size={22} />
              <span style={{ flex: 1, lineHeight: 1.35, color: '#262626' }}>{item.label}</span>
            </div>
          ))}
        </Space>
      </div>
      ) : null}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: fillHeight ? 0 : undefined,
          height: fillHeight ? '100%' : undefined,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          ref={canvasRef}
          onDragOver={onCanvasDragOver}
          onDrop={onCanvasDrop}
          onPointerMove={onNodePointerMove}
          onPointerUp={endNodeDrag}
          style={flowCanvasSurfaceStyle(Boolean(connectMode))}
        >
          {!readonly ? (
            <div style={flowCanvasToolbarStyle}>
              <Segmented
                size="small"
                value={connectMode ? 'connect' : 'edit'}
                onChange={(value) => {
                  setConnectMode(value === 'connect');
                  setPendingSource(null);
                }}
                options={[
                  {
                    label: (
                      <Space size={4}>
                        <EditOutlined />
                        <span>编辑</span>
                      </Space>
                    ),
                    value: 'edit',
                  },
                  {
                    label: (
                      <Space size={4}>
                        <LinkOutlined />
                        <span>连线</span>
                      </Space>
                    ),
                    value: 'connect',
                  },
                ]}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {flowCanvasHint(connectMode, pendingSource != null)}
              </Text>
            </div>
          ) : null}
          {nodes.length === 0 ? (
            <div style={{ position: 'absolute', top: '40%', left: 0, right: 0 }}>
              <Empty description="从左侧拖拽节点到画布开始编排" />
            </div>
          ) : null}

          {/* 连线层（SVG） */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            <defs>
              <marker
                id="flow-arrow"
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L8,3 L0,6 Z" fill="#94a3b8" />
              </marker>
            </defs>
            {edges.map((edge) => {
              const source = nodes.find((n) => n.id === edge.source);
              const target = nodes.find((n) => n.id === edge.target);
              if (!source || !target) {
                return null;
              }
              const s = nodeCenter(source);
              const t = nodeCenter(target);
              const path = flowEdgePath(s, t);
              const labelPoint = flowEdgeLabelPoint(s, t);
              return (
                <g key={edge.id}>
                  <path
                    d={path}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    markerEnd="url(#flow-arrow)"
                  />
                  <g style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={() => openEdgeLabel(edge.id)}>
                    <rect
                      x={labelPoint.x - 34}
                      y={labelPoint.y - 11}
                      width={68}
                      height={22}
                      rx={11}
                      fill={edge.label ? '#eff6ff' : '#ffffff'}
                      stroke={edge.label ? '#93c5fd' : '#dbeafe'}
                    />
                    <text
                      x={labelPoint.x}
                      y={labelPoint.y + 4}
                      textAnchor="middle"
                      fontSize={11}
                      fill="#2563eb"
                    >
                      {edge.label ? edge.label : '设标签'}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* 节点层 */}
          {nodes.map((node) => {
            const pending = pendingSource === node.id;
            const isEnd = node.type === 'END';
            const cfg = (node.config ?? {}) as Record<string, unknown>;
            const color = flowNodeColor(node.type);
            const shape = flowNodeShape(node.type);
            return (
              <div
                key={node.id}
                onPointerDown={onNodePointerDown(node.id)}
                onClick={onNodeClick(node.id)}
                style={{
                  position: 'absolute',
                  left: node.x ?? 0,
                  top: node.y ?? 0,
                  ...flowCanvasNodeShellStyle({
                    type: node.type,
                    pending,
                    connectMode: Boolean(connectMode),
                  }),
                  cursor: readonly ? 'default' : connectMode ? 'crosshair' : 'move',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FlowNodeShapeIcon shape={shape} color={color} size={18} />
                  <span style={{ ...flowNodeTypeLabelStyle(color), flex: 1 }}>
                    {flowNodeLabel(node.type)}
                  </span>
                  {!readonly ? (
                    <Tooltip title="删除">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNode(node.id);
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#bfbfbf',
                          cursor: 'pointer',
                          fontSize: 14,
                          lineHeight: 1,
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </Tooltip>
                  ) : null}
                </div>
                <div style={flowNodeTitleStyle()}>
                  {(cfg.label as string) || flowNodeLabel(node.type)}
                </div>
                {isEnd && cfg.endDecision ? (
                  <Tag
                    bordered={false}
                    color="purple"
                    style={{ marginTop: 6, fontSize: 11, lineHeight: '18px' }}
                  >
                    {String(cfg.endDecision)}
                  </Tag>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* 节点配置抽屉（R9.4） */}
      {!readonly ? (
      <>
      <Drawer
        title={configNode ? `配置节点：${flowNodeLabel(configNode.type)}` : '节点配置'}
        open={configNode != null}
        width={420}
        onClose={() => setConfigNodeId(null)}
        destroyOnClose
        extra={
          configNode ? (
            <Button danger onClick={() => deleteNode(configNode.id)}>
              删除节点
            </Button>
          ) : null
        }
      >
        {configNode && (
          <Form form={configForm} layout="vertical" onFinish={submitNodeConfig}>
            <Form.Item label="节点ID">
              <Input value={configNode.id} disabled />
            </Form.Item>
            <Form.Item label="节点名称" name="label">
              <Input placeholder="节点显示名称" maxLength={64} />
            </Form.Item>

            {configNode.type === 'END' ? (
              <Form.Item
                label="决策结果"
                name="endDecision"
                rules={[{ required: true, message: '结束节点必须配置决策结果' }]}
                tooltip="结束节点产出的决策流结果（R9.4 / R9.6）"
              >
                <Select placeholder="请选择决策结果" options={END_DECISION_OPTIONS} />
              </Form.Item>
            ) : null}

            {configNode.type === 'DECISION_TOOL' ? (
              <Form.Item
                label="决策工具类型"
                name="refType"
                rules={[{ required: true, message: '请选择决策工具类型' }]}
              >
                <Select
                  options={[
                    { value: 'DECISION_TABLE', label: '决策表' },
                    { value: 'SCORECARD', label: '评分卡' },
                    { value: 'DECISION_TREE', label: '决策树' },
                    { value: 'DECISION_MATRIX', label: '决策矩阵' },
                  ]}
                />
              </Form.Item>
            ) : null}

            {['RULE_PACKAGE', 'MODEL', 'DECISION_TOOL', 'SUB_FLOW'].includes(
              String(configNode.type),
            ) ? (
              <Form.Item
                label={refLabelMap[String(configNode.type)] ?? '引用标识'}
                name="refId"
                rules={
                  configNode.type === 'DECISION_TOOL'
                    ? [{ required: true, message: '请填写决策表/树/矩阵/评分卡的 ID' }]
                    : undefined
                }
                tooltip="引用的配置对象 ID（数字）"
              >
                <Input placeholder="如决策表 ID：12" />
              </Form.Item>
            ) : null}

            {['CONDITION_GATEWAY', 'PARALLEL_GATEWAY'].includes(String(configNode.type)) ? (
              <Form.Item
                label={configNode.type === 'CONDITION_GATEWAY' ? '条件表达式' : '并行说明'}
                name="expression"
              >
                <Input.TextArea
                  rows={3}
                  placeholder={
                    configNode.type === 'CONDITION_GATEWAY'
                      ? '如 amount > 1000'
                      : '并行分支说明'
                  }
                />
              </Form.Item>
            ) : null}

            <Button type="primary" htmlType="submit" block>
              保存节点配置
            </Button>
          </Form>
        )}
      </Drawer>

      <Modal
        title="设置分支标签"
        open={labelEdgeId != null}
        onOk={saveEdgeLabel}
        onCancel={() => setLabelEdgeId(null)}
        okText="保存"
        cancelText="取消"
        footer={[
          <Button
            key="delete"
            danger
            onClick={() => {
              if (labelEdgeId) {
                deleteEdge(labelEdgeId);
              }
              setLabelEdgeId(null);
            }}
          >
            删除连线
          </Button>,
          <Button key="cancel" onClick={() => setLabelEdgeId(null)}>
            取消
          </Button>,
          <Button key="ok" type="primary" onClick={saveEdgeLabel}>
            保存
          </Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="分支标签" tooltip="如 Y / N、通过 / 不通过">
            <Input
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              placeholder="输入分支标签，留空表示无标签"
              maxLength={32}
              onPressEnter={saveEdgeLabel}
            />
          </Form.Item>
        </Form>
      </Modal>
      </>
      ) : null}
    </div>
  );
}
