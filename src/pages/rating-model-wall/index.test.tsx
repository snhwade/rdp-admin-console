import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RatingModelWallPage from './index';
import * as consoleApi from '@/api/console';

/**
 * 评级模型卡片墙页单元测试（risk-console-redesign 任务 14.5 / R10.1）。
 *
 * 验证：左侧场景→事件树渲染并默认选中首个事件，右侧卡片墙展示评级模型卡片
 * （名称 / 事件路径 / 标签：商户·实时 / 状态：已上线），顶部提供执行方式、评级主体
 * 筛选与「新建评级模型」入口。API 层以 vi.mock 替身隔离网络。
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
    listScenarioTree: vi.fn(),
    listRatingModels: vi.fn(),
  };
});

const mockedTree = consoleApi.listScenarioTree as unknown as ReturnType<typeof vi.fn>;
const mockedModels = consoleApi.listRatingModels as unknown as ReturnType<typeof vi.fn>;

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RatingModelWallPage />
    </QueryClientProvider>,
  );
}

describe('RatingModelWallPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedTree.mockResolvedValue([
      {
        id: 10,
        code: 'PAYIN',
        name: '收单场景',
        events: [{ id: 100, code: 'TRADE', name: '交易事件' }],
      },
    ]);
    mockedModels.mockResolvedValue([
      {
        id: 1,
        name: '商户实时评级模型',
        eventPath: '收单场景 / 交易事件',
        executionMode: 'REALTIME',
        subject: 'MERCHANT',
        gradingMode: 'SCORE_BASED',
        status: 'ONLINE',
      },
    ]);
  });

  it('默认选中首个事件并展示评级模型卡片与标签/状态', async () => {
    renderPage();
    await waitFor(() => expect(mockedModels).toHaveBeenCalled());

    expect(await screen.findByText('商户实时评级模型')).toBeInTheDocument();
    // 标签：商户·实时
    expect(screen.getByText('商户·实时')).toBeInTheDocument();
    // 状态：已上线
    expect(screen.getByText('已上线')).toBeInTheDocument();
  });

  it('顶部提供新建评级模型入口与筛选', async () => {
    renderPage();
    await waitFor(() => expect(mockedModels).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: '新建评级模型' })).toBeInTheDocument();
    // 执行方式 / 评级主体筛选项
    expect(screen.getByText('全部方式')).toBeInTheDocument();
    expect(screen.getByText('全部主体')).toBeInTheDocument();
  });

  it('选中事件后以正确 eventCode 拉取评级模型', async () => {
    renderPage();
    await waitFor(() => expect(mockedModels).toHaveBeenCalled());
    expect(mockedModels).toHaveBeenCalledWith(
      expect.objectContaining({ eventCode: 'TRADE' }),
    );
  });
});
