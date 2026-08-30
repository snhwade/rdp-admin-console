/**
 * 风控控制台（Risk Console）中性命名 API 聚合出口。
 *
 * 本期改造页面统一从 `@/api/console` import，不再直接引用旧版共享 API 模块
 * （Requirement 1.2/1.5）。按模块拆分：参数管理 params、规则管理 rules、
 * 决策流 flows、评级模型 rating。
 */

export * from './types';
export * from './params';
export * from './rules';
export * from './flows';
export * from './rating';
export * from './dryRun';
