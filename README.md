# risk-decision-admin-console

**风控实时决策平台 · 管理控制台前端**

本仓库是风控实时决策平台（Risk Decision Platform）的 **运营管理前端**，为风控运营、规则配置、审批复核人员提供统一的 Web 管理界面。通过 BFF 聚合后端 API，覆盖参数管理、规则管理、决策流编排、指标配置、名单管理、AI 策略、运营查询等全生命周期能力。

## 项目定位

| 项 | 说明 |
|---|---|
| 类型 | 单页应用（SPA） |
| 用户 | 风控运营、规则工程师、审批人员 |
| 后端 | [risk-decision-services](https://github.com/snhwade/risk-decision-services) 的 `admin-bff`（8080） |
| 开发端口 | 5173（Vite dev server） |

## 功能模块

### 参数管理

| 页面 | 路径 | 说明 |
|------|------|------|
| 事件管理 | `/events` | 事件类型定义与启停 |
| 字段库 | `/field-library` | 全局字段字典 |
| 事件字段 | `/event-fields` | 事件与字段绑定 |
| 验证策略 | `/verify-strategies` | 入参校验规则 |

### 规则管理

| 页面 | 路径 | 说明 |
|------|------|------|
| 规则包 | `/rule-package-wall` | 规则组与规则 CRUD |
| 试运行 | `/dry-run` | 规则沙箱调试 |

### 决策流

| 页面 | 路径 | 说明 |
|------|------|------|
| 决策流编排 | `/decision-flow-wall` | 可视化决策流编辑器、版本历史 |

### 评级模型

| 页面 | 路径 | 说明 |
|------|------|------|
| 评级模型 | `/rating-model-wall` | 等级区间、评级项配置 |

### 名单管理

| 页面 | 路径 | 说明 |
|------|------|------|
| 名单库 | `/list-libraries` | 观察/制裁等名单库 |
| 名单维度 | `/list-dimensions` | 匹配维度配置 |
| 名单属性 | `/list-attributes` | 条目字段定义 |

### 配置管理

| 页面 | 路径 | 说明 |
|------|------|------|
| 指标配置 | `/indicators` | 指标定义、累计脚本、窗口 |
| 指标查询 | `/indicators/query` | 在线查询指标当前值 |

### 决策工具

| 页面 | 路径 | 说明 |
|------|------|------|
| 决策表 | `/decision-tables` | 决策表配置 |
| 决策树 | `/decision-trees` | 决策树配置 |
| 决策矩阵 | `/decision-matrices` | 决策矩阵配置 |

### 智能决策

| 页面 | 路径 | 说明 |
|------|------|------|
| AI Agent 策略 | `/agent-strategies` | LLM Agent 决策节点配置 |
| 模型训练 | `/ai-training` | 对接 AI 训练服务，任务与模型管理 |

### 运营与治理

| 页面 | 路径 | 说明 |
|------|------|------|
| 名称筛查 | `/screening` | 筛查记录与阈值配置 |
| 复核审批 | `/approvals` | 人工复核工作流 |
| 商户评级 | `/merchant-rating` | 商户评级结果查询 |
| 用户与权限 | `/users` | 账号与角色管理 |

### 查询与监控

| 页面 | 路径 | 说明 |
|------|------|------|
| 调用查询 | `/decision-invocations` | 决策调用记录与 trace |
| 订单查询 | `/business-orders` | 业务订单与决策结果 |
| 执行链路 | `/observability` | 监控与链路追踪入口 |

## 技术栈

- **React 18** + **TypeScript 5**
- **Vite 5** 构建
- **Ant Design 5** UI 组件库
- **React Router 6** 路由
- **TanStack React Query** 服务端状态
- **Zustand** 客户端状态
- **Axios** HTTP 客户端
- **CodeMirror 6** — 规则/指标 Aviator 表达式编辑器
- **Vitest** + Testing Library 单元测试

## 开发环境

### 前置

1. Node.js 18+
2. 后端 `admin-bff` 已启动（`http://localhost:8080`）
3. 可选：`rule-config-service`（8082）用于部分直连 API

### 安装与启动

```powershell
git clone https://github.com/snhwade/risk-decision-admin-console.git
cd risk-decision-admin-console
npm install
npm run dev
```

浏览器访问：`http://localhost:5173`

### 代理配置

Vite 开发服务器将 API 请求代理到后端：

| 前端路径 | 代理目标 |
|----------|----------|
| `/bff/*` | `http://localhost:8080`（admin-bff） |
| 部分配置 API | `http://localhost:8082`（rule-config） |

### 登录

访问 `/login`，使用 `rule-config-service` 预置账号登录，获取 JWT 后访问各功能页。

## 构建与部署

```powershell
npm run build        # 产出 dist/
npm run preview      # 本地预览生产构建
npm run test         # 运行 Vitest
npm run scan:naming  # 命名规范扫描
```

生产部署：将 `dist/` 静态文件托管至 Nginx/CDN，配置 `/bff` 反向代理到 admin-bff。

## 目录结构

```
src/
├── app/           # 路由、布局、全局配置
├── pages/         # 各功能页面
├── components/    # 通用组件（含 CodeMirror 编辑器）
├── api/           # API 客户端封装
├── stores/        # Zustand 状态
└── utils/         # 工具函数
vite.config.ts
package.json
```

## 关联仓库

| 仓库 | 说明 |
|------|------|
| [risk-decision-services](https://github.com/snhwade/risk-decision-services) | Java 后端（admin-bff + 各微服务） |
| [risk-decision-ai-training](https://github.com/snhwade/risk-decision-ai-training) | AI 训练/评分（`/ai-training` 页面对接） |
| [risk-decision-commons](https://github.com/snhwade/risk-decision-commons) | 公共 Java 库 |
| [risk-decision-data-engine](https://github.com/snhwade/risk-decision-data-engine) | 数据引擎（旁路计算） |

## 设计原则

- **单一前端工程**：所有管理功能收敛于本仓库，不拆分多前端项目
- **BFF 聚合**：页面级 API 由 admin-bff 编排，前端不直接调用多个微服务
- **表达式可视化**：规则/指标脚本使用 CodeMirror 高亮编辑，降低配置门槛
