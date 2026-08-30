/**
 * 公共组件共享类型定义。
 *
 * 这里集中定义三个关键前端组件（RuleExpressionEditor / DecisionTraceView /
 * IndicatorRefPicker）所使用的领域类型，类型字段与后端 BFF 返回结构对齐
 * （参见设计文档 Data Models 与关键 REST 端点）。
 */

/** 决策取值（与后端 Decision 一致）：拦截 / 人工复核 / 放行。 */
export type Decision = 'REJECT' | 'REVIEW' | 'PASS';

/** 规则组执行状态（含致命中断 INTERRUPTED，R5.4）。 */
export type GroupStatus = 'COMPLETED' | 'INTERRUPTED' | 'NO_MATCH' | (string & {});

/** 决策中文名映射。 */
export const DECISION_LABELS: Record<string, string> = {
  REJECT: '拦截',
  REVIEW: '人工复核',
  PASS: '放行',
};

/** 决策对应的 Ant Design Tag 颜色（严格性由高到低：红 / 橙 / 绿）。 */
export const DECISION_COLORS: Record<string, string> = {
  REJECT: 'red',
  REVIEW: 'orange',
  PASS: 'green',
};

/** 返回决策的中文展示名（未知值原样返回）。 */
export function decisionLabel(decision?: string): string {
  if (!decision) return '-';
  return DECISION_LABELS[decision] ?? decision;
}

/** 返回决策对应的 Tag 颜色（未知值返回 default）。 */
export function decisionColor(decision?: string): string {
  if (!decision) return 'default';
  return DECISION_COLORS[decision] ?? 'default';
}

/* -------------------------------------------------------------------------- */
/* RuleExpressionEditor 相关类型                                              */
/* -------------------------------------------------------------------------- */

/** 字段来源类别：指标定义引用名或事件上下文字段。 */
export type FieldSource = 'indicator' | 'context' | (string & {});

/** 可补全的字段（来自指标定义引用名 / 事件上下文声明）。 */
export interface EditorField {
  /** 字段标识（用于补全插入与高亮匹配）。 */
  name: string;
  /** 字段来源类别，用于补全列表分组与提示。 */
  source?: FieldSource;
  /** 补全项右侧的简要说明（如数据类型）。 */
  detail?: string;
  /** 补全项的详细说明（鼠标悬浮展示）。 */
  info?: string;
}

/**
 * 后端返回的表达式错误回显信息。
 * 既支持语法错误（位置 + 描述），也支持未声明字段（字段名列表）。
 */
export interface ExpressionError {
  /** 错误描述（语法错误描述或整体错误信息）。 */
  message?: string;
  /** 语法错误的字符偏移（0 基）。与 line/column 二选一。 */
  position?: number;
  /** 语法错误所在行（1 基）。 */
  line?: number;
  /** 语法错误所在列（1 基）。 */
  column?: number;
  /** 未声明字段名列表（R3.6 / R7.x）。 */
  undeclaredFields?: string[];
}

/* -------------------------------------------------------------------------- */
/* DecisionTraceView 相关类型                                                 */
/* -------------------------------------------------------------------------- */

/** 规则执行阶段单条记录（R5.5）。 */
export interface RuleExecutionTrace {
  ruleId: string | number;
  /** 规则版本（R5.5）。 */
  ruleVersion?: number;
  /** 规则决策优先级。 */
  priority?: number;
  /** 规则表达式（可选展示）。 */
  expression?: string;
  /** 是否命中。 */
  hit: boolean;
  /** 命中后的规则决策。 */
  decision?: Decision | string;
  /** 是否短路规则（命中后停止更低优先级规则，R5.6）。 */
  shortCircuited?: boolean;
  /** 求值是否失败（R5.3）。 */
  failed?: boolean;
  /** 失败 / 异常原因。 */
  failureReason?: string;
}

/** 参与聚合的命中规则及其决策与优先级（R6.6 / R6.8）。 */
export interface AggregatedHitRule {
  ruleId: string | number;
  decision: Decision | string;
  priority: number;
}

/** 决策聚合阶段链路（R6）。 */
export interface DecisionAggregationTrace {
  /** 最终决策。 */
  finalDecision: Decision | string;
  /** 生效决策优先级（R6.2，数值越大越高）。 */
  maxPriority?: number;
  /** 参与聚合的命中规则。 */
  hitRules?: AggregatedHitRule[];
  /** 处理耗时（毫秒，R15.1）。 */
  elapsedMs?: number;
  /** 超时原因（若有，R6.7）。 */
  timeoutReason?: string;
  /** 规则组执行状态（R5.4）。 */
  groupStatus?: GroupStatus;
}

/** 决策流节点链路（XT1）。 */
export interface FlowTraceStepView {
  nodeId?: string;
  nodeType?: string;
  refType?: string;
  refId?: number | string | null;
  hits?: AggregatedHitRule[];
  assignments?: Record<string, unknown>;
}

/** 完整决策执行链路（选择器 → 规则/决策流 → 决策聚合）。 */
export interface DecisionTrace {
  eventId: string;
  /** 选择器匹配结果（XT1）。 */
  selectorMatch?: Record<string, unknown>;
  ruleExecutions?: RuleExecutionTrace[];
  /** 决策流节点路径（XT1）。 */
  flowPath?: string[];
  flowTrace?: FlowTraceStepView[];
  aggregation?: DecisionAggregationTrace;
}

/* -------------------------------------------------------------------------- */
/* IndicatorRefPicker 相关类型                                                */
/* -------------------------------------------------------------------------- */

/** 引用某指标定义的规则/决策流（R7.6 / IR1）。 */
export interface IndicatorReference {
  ruleId?: string | number;
  /** 可读引用描述（IR1），如「规则包:PKG/R001」。 */
  label?: string;
  /** 规则名称（可选）。 */
  ruleName?: string;
  /** 规则版本（可选）。 */
  ruleVersion?: number;
  /** 规则关联的事件类型 code（可选）。 */
  eventTypeCode?: string;
  /** 规则状态（如 ENABLED）。 */
  status?: string;
}
