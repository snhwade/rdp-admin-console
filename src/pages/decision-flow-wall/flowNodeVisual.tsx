import type { CSSProperties, ReactNode } from 'react';
import type { DecisionFlowNodeType } from '@/api/console';

export type FlowNodeShape =
  | 'start'
  | 'end'
  | 'diamond'
  | 'parallel'
  | 'model'
  | 'rule'
  | 'tool'
  | 'subflow';

export interface FlowNodeVisualMeta {
  type: DecisionFlowNodeType;
  label: string;
  color: string;
  shape: FlowNodeShape;
}

/** 节点面板与画布共用的视觉定义（R9.1）。 */
export const FLOW_NODE_VISUALS: FlowNodeVisualMeta[] = [
  { type: 'START', label: '开始', color: '#389e0d', shape: 'start' },
  { type: 'END', label: '结束', color: '#531dab', shape: 'end' },
  { type: 'CONDITION_GATEWAY', label: '条件', color: '#d46b08', shape: 'diamond' },
  { type: 'PARALLEL_GATEWAY', label: '并行', color: '#08979c', shape: 'parallel' },
  { type: 'MODEL', label: '模型', color: '#0958d9', shape: 'model' },
  { type: 'RULE_PACKAGE', label: '规则', color: '#1d39c4', shape: 'rule' },
  { type: 'DECISION_TOOL', label: '决策工具', color: '#c41d7f', shape: 'tool' },
  { type: 'SUB_FLOW', label: '子流程', color: '#434343', shape: 'subflow' },
];

export const FLOW_NODE_META = Object.fromEntries(
  FLOW_NODE_VISUALS.map((item) => [String(item.type), item]),
) as Record<string, FlowNodeVisualMeta>;

export function flowNodeLabel(type: DecisionFlowNodeType): string {
  return FLOW_NODE_META[String(type)]?.label ?? String(type);
}

export function flowNodeColor(type: DecisionFlowNodeType): string {
  return FLOW_NODE_META[String(type)]?.color ?? '#1677ff';
}

export function flowNodeShape(type: DecisionFlowNodeType): FlowNodeShape {
  return FLOW_NODE_META[String(type)]?.shape ?? 'model';
}

const NODE_WIDTH = 136;
const NODE_HEIGHT = 56;

export function flowNodeSize(_type: DecisionFlowNodeType): { width: number; height: number } {
  return { width: NODE_WIDTH, height: NODE_HEIGHT };
}

function tint(color: string, alpha = 0.08): string {
  return `${color}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

interface ShapeIconProps {
  shape: FlowNodeShape;
  color: string;
  size?: number;
}

/** 面板与画布共用的节点形状图标（SVG，边缘更干净）。 */
export function FlowNodeShapeIcon({ shape, color, size = 24 }: ShapeIconProps) {
  const svgProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true as const,
  };

  switch (shape) {
    case 'start':
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="9" fill={color} fillOpacity={0.18} stroke={color} strokeWidth="1.6" />
          <polygon points="10,8 16,12 10,16" fill={color} />
        </svg>
      );
    case 'end':
      return (
        <svg {...svgProps}>
          <rect x="4.5" y="4.5" width="15" height="15" rx="3" fill={color} fillOpacity={0.12} stroke={color} strokeWidth="1.6" />
          <rect x="8.5" y="8.5" width="7" height="7" rx="1.5" fill={color} />
        </svg>
      );
    case 'diamond':
      return (
        <svg {...svgProps}>
          <path
            d="M12 3 L21 12 L12 21 L3 12 Z"
            fill={color}
            fillOpacity={0.12}
            stroke={color}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'parallel':
      return (
        <svg {...svgProps}>
          <rect x="5" y="5" width="14" height="14" rx="2" fill={color} fillOpacity={0.1} stroke={color} strokeWidth="1.4" />
          <line x1="9.5" y1="6" x2="9.5" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <line x1="14.5" y1="6" x2="14.5" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'model':
      return (
        <svg {...svgProps}>
          <rect x="4" y="6" width="16" height="12" rx="4" fill={color} fillOpacity={0.16} stroke={color} strokeWidth="1.6" />
        </svg>
      );
    case 'rule':
      return (
        <svg {...svgProps}>
          <path
            d="M5 6 H16 L19 9 V18 H5 Z"
            fill={color}
            fillOpacity={0.14}
            stroke={color}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'tool':
      return (
        <svg {...svgProps}>
          <path
            d="M12 3 L20 12 L12 21 L4 12 Z"
            fill={color}
            fillOpacity={0.12}
            stroke={color}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'subflow':
      return (
        <svg {...svgProps}>
          <rect
            x="4.5"
            y="6"
            width="15"
            height="12"
            rx="3"
            fill="#fafafa"
            stroke={color}
            strokeWidth="1.6"
            strokeDasharray="3 2"
          />
        </svg>
      );
    default:
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="8" fill={color} fillOpacity={0.2} />
        </svg>
      );
  }
}

interface CanvasShellOptions {
  type: DecisionFlowNodeType;
  pending: boolean;
  connectMode: boolean;
}

/** 画布节点外框：统一卡片 + 左侧色条，避免 clip-path 裁切内容。 */
export function flowCanvasNodeShellStyle({
  type,
  pending,
  connectMode,
}: CanvasShellOptions): CSSProperties {
  const color = flowNodeColor(type);
  const shape = flowNodeShape(type);
  const { width, height } = flowNodeSize(type);
  const isTerminal = shape === 'start' || shape === 'end';

  return {
    width,
    minHeight: height,
    borderRadius: isTerminal ? 999 : 10,
    border: pending
      ? `1.5px solid ${color}`
      : `1px solid ${connectMode ? '#91caff' : `${color}33`}`,
    background: isTerminal ? tint(color, 0.1) : '#fff',
    boxShadow: pending
      ? `0 0 0 3px ${tint(color, 0.22)}, 0 4px 14px rgba(15,23,42,0.1)`
      : '0 2px 8px rgba(15,23,42,0.06)',
    padding: '8px 10px 8px 12px',
    zIndex: pending ? 3 : 2,
    transition: 'box-shadow 0.18s ease, border-color 0.18s ease, transform 0.18s ease',
    borderLeft: isTerminal ? undefined : `4px solid ${color}`,
  };
}

export function flowCanvasHint(connectMode: boolean, pendingSource: boolean): ReactNode {
  if (!connectMode) {
    return '拖拽移动节点，点击打开配置';
  }
  if (pendingSource) {
    return '已选源节点，点击目标完成连线 · Esc 取消';
  }
  return '依次点击源节点与目标节点 · Esc 退出连线';
}

/** 贝塞尔连线路径（比直线更自然）。 */
export function flowEdgePath(
  source: { cx: number; cy: number },
  target: { cx: number; cy: number },
): string {
  const dx = target.cx - source.cx;
  const bend = Math.max(48, Math.abs(dx) * 0.42);
  const c1x = source.cx + bend;
  const c1y = source.cy;
  const c2x = target.cx - bend;
  const c2y = target.cy;
  return `M ${source.cx} ${source.cy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${target.cx} ${target.cy}`;
}

/** 连线标签锚点（贝塞尔 t=0.5 近似）。 */
export function flowEdgeLabelPoint(
  source: { cx: number; cy: number },
  target: { cx: number; cy: number },
): { x: number; y: number } {
  const dx = target.cx - source.cx;
  const bend = Math.max(48, Math.abs(dx) * 0.42);
  const c1x = source.cx + bend;
  const c1y = source.cy;
  const c2x = target.cx - bend;
  const c2y = target.cy;
  const t = 0.5;
  const mt = 1 - t;
  return {
    x: mt ** 3 * source.cx + 3 * mt ** 2 * t * c1x + 3 * mt * t ** 2 * c2x + t ** 3 * target.cx,
    y: mt ** 3 * source.cy + 3 * mt ** 2 * t * c1y + 3 * mt * t ** 2 * c2y + t ** 3 * target.cy,
  };
}

export const flowCanvasSurfaceStyle = (connectMode: boolean): CSSProperties => ({
  position: 'relative',
  flex: 1,
  minHeight: 0,
  height: '100%',
  borderRadius: 0,
  overflow: 'auto',
  border: connectMode ? '1px solid #91caff' : 'none',
  backgroundColor: connectMode ? '#f7fbff' : '#fbfbfc',
  backgroundImage: connectMode
    ? 'radial-gradient(circle, rgba(22,119,255,0.14) 1px, transparent 1px)'
    : 'radial-gradient(circle, #dfe3ea 1px, transparent 1px)',
  backgroundSize: '18px 18px',
  boxShadow: connectMode ? 'inset 0 0 0 1px rgba(22,119,255,0.12)' : 'none',
  transition: 'border-color 0.2s ease, background-color 0.2s ease',
});

export const flowPaletteItemStyle = (color: string, hovering: boolean): CSSProperties => ({
  cursor: 'grab',
  border: `1px solid ${hovering ? `${color}55` : '#eceef2'}`,
  borderRadius: 10,
  padding: '8px 10px',
  background: hovering ? tint(color, 0.06) : '#fff',
  userSelect: 'none',
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  boxShadow: hovering ? '0 4px 12px rgba(15,23,42,0.08)' : '0 1px 2px rgba(15,23,42,0.04)',
  transform: hovering ? 'translateY(-1px)' : 'none',
  transition: 'all 0.16s ease',
});

export const flowCanvasToolbarStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  left: 12,
  zIndex: 5,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 10px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid #eceef2',
  boxShadow: '0 4px 16px rgba(15,23,42,0.06)',
  backdropFilter: 'blur(6px)',
};

export function flowNodeTypeLabelStyle(color: string): CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 600,
    color,
    lineHeight: 1.2,
  };
}

export function flowNodeTitleStyle(): CSSProperties {
  return {
    fontSize: 12,
    color: '#595959',
    marginTop: 4,
    lineHeight: 1.35,
    wordBreak: 'break-all',
  };
}
