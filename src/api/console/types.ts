/**
 * 风控控制台（Risk Console）中性命名 API 模块 —— 共享类型。
 *
 * 命名中性化硬约束（Requirement 1）：本目录下所有文件名、类型名、导出标识
 * 一律使用中性的"风控/反欺诈平台"命名，不包含任何产品厂商专有名词。
 * 本期改造页面统一从 `@/api/console` import，不再直接引用旧版共享 API 模块。
 */

/** 通用启停状态。 */
export type EnableStatus = 'ENABLED' | 'DISABLED' | (string & {});

/** 字段级校验错误（与 admin-bff 约定的 { code, message, fields? } 对齐）。 */
export type FieldErrors = Record<string, string>;

/**
 * 批量操作中单条记录的处理结果。
 * 用于事件导入、字段导入与规则批量操作等"逐条处理 + 汇总结果"场景。
 */
export interface BatchItemResult {
  /** 记录在请求集合中的序号（从 0 开始）或业务标识。 */
  index?: number;
  id?: number | string;
  /** 是否处理成功。 */
  success: boolean;
  /** 失败原因（success=false 时给出）。 */
  reason?: string | null;
}
