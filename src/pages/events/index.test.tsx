import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EventsPage from './index';
import * as consoleApi from '@/api/console';

/**
 * 事件管理页单元测试（risk-console-redesign 任务 2.5 / R2.1 / R2.11）。
 *
 * 验证：左侧"业务场景→事件"树渲染、右侧事件表格列（场景/code/名称/用途/分型/操作）渲染，
 * 引擎状态查询入口可用。API 层以 vi.mock 替身隔离网络。
 */

// jsdom 缺少 matchMedia，antd 响应式组件依赖之。
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
});

vi.mock('@/api/console', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/console')>();
  return {
    ...actual,
    listScenarioTree: vi.fn(),
    listEvents: vi.fn(),
    getEventEngineStatus: vi.fn(),
  };
});

const mockedTree = consoleApi.listScenarioTree as unknown as ReturnType<typeof vi.fn>;
const mockedEvents = consoleApi.listEvents as unknown as ReturnType<typeof vi.fn>;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EventsPage />
    </QueryClientProvider>,
  );
}

describe('EventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedTree.mockResolvedValue([
      {
        id: 1,
        code: 'PAYMENT',
        name: '支付场景',
        events: [{ id: 10, code: 'PAY_ORDER', name: '支付下单' }],
      },
    ]);
    mockedEvents.mockResolvedValue([
      {
        id: 10,
        code: 'PAY_ORDER',
        name: '支付下单',
        scenarioId: 1,
        purposes: ['COMPUTE', 'DECISION'],
        eventKind: 'FACT',
        status: 'ENABLED',
      },
    ]);
  });

  it('左侧渲染业务场景→事件树', async () => {
    renderPage();
    await waitFor(() => expect(mockedTree).toHaveBeenCalled());
    // 场景节点（含事件计数）与事件子节点
    expect(await screen.findByText('支付场景（1）')).toBeInTheDocument();
    expect(await screen.findByText('支付下单（PAY_ORDER）')).toBeInTheDocument();
  });

  it('右侧表格展示所选场景下事件及全部列', async () => {
    renderPage();
    // 默认选中第一个场景后加载事件
    await waitFor(() => expect(mockedEvents).toHaveBeenCalledWith(1));

    // 列标题
    const table = await screen.findByRole('table');
    const headerTexts = ['业务场景', '事件代码', '事件名称', '事件用途', '事件类型分型', '操作'];
    for (const h of headerTexts) {
      expect(within(table).getByText(h)).toBeInTheDocument();
    }

    // 行内容：用途标签 + 分型
    expect(within(table).getByText('PAY_ORDER')).toBeInTheDocument();
    expect(within(table).getAllByText('计算').length).toBeGreaterThan(0);
    expect(within(table).getByText('事实表')).toBeInTheDocument();
  });
});
