/**
 * 通用组件统一导出（任务 21.2）。
 *
 * - RuleExpressionEditor：规则 / 累计脚本表达式编辑器（CodeMirror + Aviator）。
 * - DecisionTraceView：决策 / 执行链路可视化。
 * - IndicatorRefPicker：指标引用关系展示与更新确认。
 */
export { default as RuleExpressionEditor } from './RuleExpressionEditor';
export type { RuleExpressionEditorProps } from './RuleExpressionEditor';
export { aviator } from './RuleExpressionEditor/aviator';

export { default as DecisionTraceView } from './DecisionTraceView';
export type { DecisionTraceViewProps } from './DecisionTraceView';

export { default as IndicatorRefPicker, confirmIndicatorUpdate } from './IndicatorRefPicker';
export type { IndicatorRefPickerProps, ConfirmIndicatorUpdateOptions } from './IndicatorRefPicker';

export * from './types';
