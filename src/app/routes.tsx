import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import DecisionInvocationsPage from '@/pages/decision-invocations';
import BusinessOrdersPage from '@/pages/business-orders';
import IndicatorsPage from '@/pages/indicators';
import IndicatorQueryPage from '@/pages/indicators/query';
import ScreeningPage from '@/pages/screening';
import ListLibraryPage from '@/pages/list-mgmt/libraries';
import ListDimensionsPage from '@/pages/list-mgmt/dimensions';
import ListAttributesPage from '@/pages/list-mgmt/attributes';
import MerchantRatingPage from '@/pages/merchant-rating';
import AgentStrategiesPage from '@/pages/agent-strategies';
import AiTrainingPage from '@/pages/ai-training';
import ObservabilityPage from '@/pages/observability';
// 独立决策工具（不属于四大核心模块）
import DecisionTablesPage from '@/pages/decision-tables';
import DecisionTreesPage from '@/pages/decision-trees';
import DecisionMatricesPage from '@/pages/decision-matrices';
import ApprovalsPage from '@/pages/approvals';
import UsersPage from '@/pages/users';
// risk-console-redesign：参数管理 — 事件管理 / 字段库 / 事件字段 / 验证策略（中性命名页面）
import EventsPage from '@/pages/events';
import FieldLibraryPage from '@/pages/field-library';
import EventFieldsPage from '@/pages/event-fields';
import VerifyStrategiesPage from '@/pages/verify-strategies';
// risk-console-redesign：规则管理 — 规则包卡片墙与规则列表（中性命名页面）
import RulePackageWallPage from '@/pages/rule-package-wall';
// risk-console-redesign：决策流 — 卡片墙与版本历史（中性命名页面）
import DecisionFlowWallPage from '@/pages/decision-flow-wall';
// risk-console-redesign：评级模型 — 卡片墙与可视化等级区间（中性命名页面）
import DryRunPage from '@/pages/dry-run';
import RatingModelWallPage from '@/pages/rating-model-wall';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/auth';

/**
 * 导航分组与路由。
 *
 * 四大核心模块（参数管理 / 规则管理 / 决策流 / 评级模型）为本期 risk-console-redesign 的最新版本。
 * 与之功能重复的历史页面（事件类型管理、规则配置、规则组与选择器、字段库与衍生字段、评分卡、
 * 决策流编排）以及含厂商命名的「平台」分组已整组移除，仅保留各能力的最新一个版本。
 * 「配置管理 / 决策工具」分组仅保留不属于四大模块的独立能力（指标定义、
 * 决策表 / 决策树 / 决策矩阵）。验证策略优先级在「参数管理 → 验证策略」中配置。
 */
export const NAV_GROUPS = [
  {
    label: '参数管理',
    children: [
      { path: '/events', label: '事件管理' },
      { path: '/field-library', label: '字段库' },
      { path: '/event-fields', label: '事件字段' },
      { path: '/verify-strategies', label: '验证策略' },
    ],
  },
  {
    label: '规则管理',
    children: [
      { path: '/rule-package-wall', label: '规则包' },
      { path: '/dry-run', label: '试运行' },
    ],
  },
  {
    label: '决策流',
    children: [
      { path: '/decision-flow-wall', label: '决策流' },
    ],
  },
  {
    label: '评级模型',
    children: [
      { path: '/rating-model-wall', label: '评级模型' },
    ],
  },
  {
    label: '名单管理',
    children: [
      { path: '/list-libraries', label: '名单库' },
      { path: '/list-dimensions', label: '名单维度' },
      { path: '/list-attributes', label: '名单附加属性' },
    ],
  },
  {
    label: '配置管理',
    children: [
      { path: '/indicators', label: '指标配置' },
      { path: '/indicators/query', label: '指标查询' },
    ],
  },
  {
    label: '决策工具',
    children: [
      { path: '/decision-tables', label: '决策表' },
      { path: '/decision-trees', label: '决策树' },
      { path: '/decision-matrices', label: '决策矩阵' },
    ],
  },
  {
    label: '智能决策',
    children: [
      { path: '/agent-strategies', label: 'AI Agent 策略' },
      { path: '/ai-training', label: '模型训练' },
    ],
  },
  {
    label: '运营与治理',
    children: [
      { path: '/screening', label: '名称筛查' },
      { path: '/approvals', label: '复核审批中心' },
      { path: '/merchant-rating', label: '商户评级' },
      { path: '/users', label: '用户与权限' },
    ],
  },
  {
    label: '查询与监控',
    children: [
      { path: '/decision-invocations', label: '调用查询' },
      { path: '/business-orders', label: '订单查询' },
      { path: '/observability', label: '执行链路与监控' },
    ],
  },
];

/**
 * 路由守卫：未登录时重定向到登录页，并记录原访问路径以便登录后跳回。
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** 旧路由兼容。 */
function LegacyDecisionQueryRedirect() {
  const location = useLocation();
  return <Navigate to={`/decision-invocations${location.search}`} replace />;
}

function LegacyDecisionRecordsRedirect() {
  const location = useLocation();
  return <Navigate to={`/decision-invocations${location.search}`} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/events" replace />} />
      {/* 参数管理 */}
      <Route path="/events" element={<RequireAuth><EventsPage /></RequireAuth>} />
      <Route path="/field-library" element={<RequireAuth><FieldLibraryPage /></RequireAuth>} />
      <Route path="/event-fields" element={<RequireAuth><EventFieldsPage /></RequireAuth>} />
      <Route path="/verify-strategies" element={<RequireAuth><VerifyStrategiesPage /></RequireAuth>} />
      {/* 规则管理 / 决策流 / 评级模型 */}
      <Route path="/rule-package-wall" element={<RequireAuth><RulePackageWallPage /></RequireAuth>} />
      <Route path="/dry-run" element={<RequireAuth><DryRunPage /></RequireAuth>} />
      <Route path="/decision-flow-wall" element={<RequireAuth><DecisionFlowWallPage /></RequireAuth>} />
      <Route path="/rating-model-wall" element={<RequireAuth><RatingModelWallPage /></RequireAuth>} />
      <Route path="/rating-models" element={<Navigate to="/rating-model-wall" replace />} />
      {/* 名单管理 */}
      <Route path="/list-libraries" element={<RequireAuth><ListLibraryPage /></RequireAuth>} />
      <Route path="/list-dimensions" element={<RequireAuth><ListDimensionsPage /></RequireAuth>} />
      <Route path="/list-attributes" element={<RequireAuth><ListAttributesPage /></RequireAuth>} />
      {/* 配置管理（独立能力） */}
      <Route path="/indicators" element={<RequireAuth><IndicatorsPage /></RequireAuth>} />
      <Route path="/indicators/query" element={<RequireAuth><IndicatorQueryPage /></RequireAuth>} />
      <Route path="/decision-priority" element={<Navigate to="/verify-strategies" replace />} />
      {/* 决策工具（独立能力） */}
      <Route path="/decision-tables" element={<RequireAuth><DecisionTablesPage /></RequireAuth>} />
      <Route path="/decision-trees" element={<RequireAuth><DecisionTreesPage /></RequireAuth>} />
      <Route path="/decision-matrices" element={<RequireAuth><DecisionMatricesPage /></RequireAuth>} />
      {/* 智能决策 */}
      <Route path="/agent-strategies" element={<RequireAuth><AgentStrategiesPage /></RequireAuth>} />
      <Route path="/ai-training" element={<RequireAuth><AiTrainingPage /></RequireAuth>} />
      {/* 运营与治理 */}
      <Route path="/screening" element={<RequireAuth><ScreeningPage /></RequireAuth>} />
      <Route path="/approvals" element={<RequireAuth><ApprovalsPage /></RequireAuth>} />
      <Route path="/merchant-rating" element={<RequireAuth><MerchantRatingPage /></RequireAuth>} />
      <Route path="/users" element={<RequireAuth><UsersPage /></RequireAuth>} />
      {/* 查询与监控 */}
      <Route path="/decision-invocations" element={<RequireAuth><DecisionInvocationsPage /></RequireAuth>} />
      <Route path="/business-orders" element={<RequireAuth><BusinessOrdersPage /></RequireAuth>} />
      <Route path="/decision-records" element={<LegacyDecisionRecordsRedirect />} />
      <Route path="/engine-decision-records" element={<LegacyDecisionQueryRedirect />} />
      <Route path="/ai-decision-records" element={<LegacyDecisionQueryRedirect />} />
      <Route path="/decisions" element={<Navigate to="/decision-invocations" replace />} />
      <Route path="/orders" element={<Navigate to="/business-orders" replace />} />
      <Route path="/observability" element={<RequireAuth><ObservabilityPage /></RequireAuth>} />
    </Routes>
  );
}
