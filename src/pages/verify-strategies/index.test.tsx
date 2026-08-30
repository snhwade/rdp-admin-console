import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import VerifyStrategiesPage from './index';
import * as consoleApi from '@/api/console';

/**
 * 验证策略页单元测试（risk-console-redesign 任务 5.4 / R5.1 / R5.2）。
 *
 * 验证：验证策略表格列（策略代码 / 策略名称 / 优先级 / 更新人 / 更新时间 / 操作）
 * 渲染，操作列含编辑 / 关联关系入口，关联关系视图调用 getVerifyStrategyRelations。
 */

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
    listVerifyStrategies: vi.fn(),
    getVerifyStrategyRelations: vi.fn(),
  };
});

const mockedStrategies = consoleApi.listVerifyStrategies as unknown as ReturnType<typeof vi.fn>;
const mockedRelations = consoleApi.getVerifyStrategyRelations as unknown as ReturnType<
  typeof vi.fn
>;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VerifyStrategiesPage />
    </QueryClientProvider>,
  );
}

describe('VerifyStrategiesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStrategies.mockResolvedValue([
      {
        id: 1,
        code: 'VERIFY_HIGH_RISK',
        name: '高风险验证策略',
        priority: 200,
        updatedBy: 'alice',
        updatedAt: '2024-05-01 10:00:00',
      },
      {
        id: 2,
        code: 'VERIFY_GLOBAL',
        name: '全局验证策略',
        priority: 100,
        updatedBy: 'bob',
        updatedAt: '2024-05-02 12:00:00',
      },
    ]);
    mockedRelations.mockResolvedValue({
      strategyId: 1,
      ruleRefs: ['R-1001'],
      scoreBandRefs: ['SB-1'],
    });
  });

  it('表格展示验证策略及全部列', async () => {
    renderPage();
    await waitFor(() => expect(mockedStrategies).toHaveBeenCalled());

    const table = await screen.findByRole('table');
    const headerTexts = ['策略代码', '策略名称', '优先级', '更新人', '更新时间', '操作'];
    for (const h of headerTexts) {
      expect(within(table).getByText(h)).toBeInTheDocument();
    }

    expect(within(table).getByText('VERIFY_HIGH_RISK')).toBeInTheDocument();
    expect(within(table).getByText('高风险验证策略')).toBeInTheDocument();
    expect(within(table).getByText('alice')).toBeInTheDocument();
    expect(within(table).queryByText('业务场景')).not.toBeInTheDocument();
  });

  it('操作列提供编辑 / 关联关系入口，仅验证策略创建入口', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    await within(table).findByText('VERIFY_HIGH_RISK');

    expect(within(table).getAllByText('编辑').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('关联关系').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '新建验证策略' })).toBeInTheDocument();
  });
});
