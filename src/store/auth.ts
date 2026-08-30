import { create } from 'zustand';

/**
 * 登录态 store（S10）。
 *
 * 仅保存登录用户与角色的轻量信息；JWT 令牌持久化在 localStorage（键 `token`），
 * 由请求层 `apiClient` 的请求拦截器读取并注入 Authorization 头。
 * 这样刷新页面后仍保持登录态（令牌未过期时）。
 */

const TOKEN_KEY = 'token';
const USER_KEY = 'auth_user';

export interface AuthUser {
  username: string;
  roles: string[];
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** 是否已登录（存在有效令牌）。 */
  isAuthenticated: () => boolean;
  /** 登录成功后保存令牌与用户信息。 */
  setAuth: (token: string, user: AuthUser) => void;
  /** 退出登录，清除令牌与用户信息。 */
  logout: () => void;
}

/** 从 localStorage 读取已保存的用户信息（刷新后恢复）。 */
function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: readStoredUser(),

  isAuthenticated: () => !!get().token,

  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null });
  },
}));
