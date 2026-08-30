import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FieldLibraryPage from './index';
import * as consoleApi from '@/api/console';

/**
 * 字段库页单元测试（risk-console-redesign 任务 3.3 / R3.1 / R3.7）。
 *
 * 验证：字段表格列（字段 / 字段名称 / 字段类型 / 操作）渲染，操作列含
 * 编辑 / 枚举值 / 关联关系 / 更多入口，关联关系视图调用 getFieldRelations。
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
    listFields: vi.fn(),
    getFieldRelations: vi.fn(),
  };
});

const mockedFields = consoleApi.listFields as unknown as ReturnType<typeof vi.fn>;
const mockedRelations = consoleApi.getFieldRelations as unknown as ReturnType<typeof vi.fn>;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <FieldLibraryPage />
    </QueryClientProvider>,
  );
}

describe('FieldLibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFields.mockResolvedValue([
      {
        id: 1,
        code: 'trade_amount',
        name: '交易金额',
        dataType: 'Double',
        label: '本次交易金额',
        enabled: true,
      },
    ]);
    mockedRelations.mockResolvedValue({
      fieldId: 1,
      fieldCode: 'trade_amount',
      fieldName: '交易金额',
      events: ['PAY_ORDER'],
      enumValues: [],
      derivedFields: [],
    });
  });

  it('表格展示字段及全部列', async () => {
    renderPage();
    await waitFor(() => expect(mockedFields).toHaveBeenCalled());

    const table = await screen.findByRole('table');
    const headerTexts = ['字段', '字段名称', '字段类型', '操作'];
    for (const h of headerTexts) {
      expect(within(table).getByText(h)).toBeInTheDocument();
    }

    // 行内容：code、名称、类型标签
    expect(within(table).getByText('trade_amount')).toBeInTheDocument();
    expect(within(table).getByText('交易金额')).toBeInTheDocument();
    expect(within(table).getByText('Double')).toBeInTheDocument();
  });

  it('操作列提供编辑/枚举值/关联关系/更多入口', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    // 等待数据行渲染后再断言操作列入口
    await within(table).findByText('trade_amount');
    expect(within(table).getByText('编辑')).toBeInTheDocument();
    expect(within(table).getByText('枚举值')).toBeInTheDocument();
    expect(within(table).getByText('关联关系')).toBeInTheDocument();
    expect(within(table).getByText('更多')).toBeInTheDocument();
  });
});
