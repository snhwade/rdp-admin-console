import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EventFieldsPage from './index';
import * as consoleApi from '@/api/console';

/**
 * 事件字段页单元测试（risk-console-redesign 任务 4.4 / R4.1）。
 *
 * 验证：左侧「场景 → 事件」树渲染并默认选中首个事件，右侧事件字段表格列
 * （字段 / 字段名称 / 字段类型 / 用途 / 操作）渲染，操作列含衍生开关与移除入口。
 * API 层以 vi.mock 替身隔离网络。
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
    listEventFields: vi.fn(),
    listFields: vi.fn(),
  };
});

const mockedTree = consoleApi.listScenarioTree as unknown as ReturnType<typeof vi.fn>;
const mockedEventFields = consoleApi.listEventFields as unknown as ReturnType<typeof vi.fn>;
const mockedFields = consoleApi.listFields as unknown as ReturnType<typeof vi.fn>;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EventFieldsPage />
    </QueryClientProvider>,
  );
}

describe('EventFieldsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedTree.mockResolvedValue([
      {
        id: 1,
        code: 'PAYMENT',
        name: '支付场景',
        events: [{ id: 11, code: 'PAY_ORDER', name: '支付下单' }],
      },
    ]);
    mockedEventFields.mockResolvedValue([
      {
        id: 100,
        eventTypeCode: 'PAY_ORDER',
        fieldId: 1,
        fieldCode: 'trade_amount',
        fieldName: '交易金额',
        dataType: 'Double',
        purposes: ['COMPUTE'],
        derived: false,
      },
    ]);
    mockedFields.mockResolvedValue([
      { id: 1, code: 'trade_amount', name: '交易金额', dataType: 'Double' },
      { id: 2, code: 'risk_score', name: '风险分值', dataType: 'Integer' },
    ]);
  });

  it('默认选中首个事件并加载其事件字段', async () => {
    renderPage();
    await waitFor(() => expect(mockedTree).toHaveBeenCalled());
    await waitFor(() => expect(mockedEventFields).toHaveBeenCalledWith('PAY_ORDER'));
  });

  it('表格展示事件字段及全部列', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    const headerTexts = ['字段', '字段名称', '字段类型', '用途', '操作'];
    for (const h of headerTexts) {
      expect(within(table).getByText(h)).toBeInTheDocument();
    }

    await within(table).findByText('trade_amount');
    expect(within(table).getByText('交易金额')).toBeInTheDocument();
    expect(within(table).getByText('Double')).toBeInTheDocument();
  });

  it('操作列提供衍生标记与移除入口', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    await within(table).findByText('trade_amount');
    expect(within(table).getByText('衍生')).toBeInTheDocument();
    expect(within(table).getByText('移除')).toBeInTheDocument();
    // 衍生开关
    expect(within(table).getByRole('switch')).toBeInTheDocument();
  });
});
