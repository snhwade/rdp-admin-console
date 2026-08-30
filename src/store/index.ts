import { create } from 'zustand';

/** 全局 UI 状态（占位）。服务端数据使用 TanStack Query 管理。 */
interface AppState {
  currentUser?: string;
  setCurrentUser: (user?: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: undefined,
  setCurrentUser: (user) => set({ currentUser: user }),
}));
