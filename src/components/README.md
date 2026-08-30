# components（通用组件）

由任务 21.2 实现的三个关键前端公共组件，供配置类与查询类页面（任务 22+）复用。

## RuleExpressionEditor（规则 / 累计脚本表达式编辑器）

- 基于 CodeMirror（`@uiw/react-codemirror` + `@codemirror/*`）。
- Aviator 表达式语法高亮：见 `RuleExpressionEditor/aviator.ts`（StreamLanguage 词法高亮器）。
- 字段自动补全：从指标定义引用名 / 事件上下文声明（`fields` 入参）拉取，叠加 Aviator 关键字与内建函数。
- 错误回显（R3.12 / R7.8）：通过 `error` 入参以 lint 下划线标注 + 下方 Alert 汇总，支持
  - 语法错误位置（字符偏移 `position` 或行列 `line`/`column`）与描述；
  - 未声明字段名（`undeclaredFields`）逐处高亮。
- 受控组件（`value` / `onChange`），拒绝保存时由页面保留 `value` 即可保留用户已编辑内容。
- _Requirements: 3.10, 3.12, 7.7, 7.8_

## DecisionTraceView（决策 / 执行链路可视化）

- 以纵向 Steps 分三阶段展示完整链路：选择器匹配（R4）→ 规则执行（R5）→ 决策聚合（R6）。
- 规则执行表展示规则标识、版本、命中结果、短路与失败原因（R5.5 / R5.6 / R5.3）。
- 决策聚合区展示最终决策、最小优先级、参与聚合的命中规则及各自决策与优先级、耗时、超时原因与规则组状态（R6.6 / R6.8）。
- _Requirements: 6.8, 15.4_

## IndicatorRefPicker（指标引用关系展示与更新确认）

- 展示引用某指标定义的全部启用规则列表（规则标识 / 名称 / 版本 / 事件类型 / 状态）。
- `confirmIndicatorUpdate(...)`：更新被引用指标前弹出引用规则列表并要求确认后再提交；未被引用时直接提交。
- _Requirements: 7.9_

> 组件共享领域类型集中定义于 `components/types.ts`，字段与后端 BFF 返回结构对齐。
> 统一从 `components/index.ts` 导出。组件测试见任务 21.3（Vitest + RTL）。
