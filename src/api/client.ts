import axios, { AxiosError } from 'axios';
import { useAuthStore } from '@/store/auth';

/**
 * 统一请求层：经 Admin BFF 访问后端，注入 JWT，统一错误映射。
 * 字段级校验错误（后端返回的 fields）由各表单页映射到表单项并保留用户输入。
 */
export const apiClient = axios.create({
  baseURL: '/bff/api/v1',
  timeout: 10_000,
});

/** 后端结构化错误体：{ code, message, fields? }。 */
export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

apiClient.interceptors.request.use((config) => {
  const isLoginRequest = (config.url ?? '').includes('/auth/login');
  const token = useAuthStore.getState().token;
  if (token && !isLoginRequest) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const isLoginRequest = (error.config?.url ?? '').includes('/auth/login');

    // 仅当 BFF/下游明确返回结构化未认证错误时才清登录态。
    // BFF 未注册路由时 Spring 也可能返回空 401，不应误判为登录失效。
    const authFailure =
      status === 401
      && !isLoginRequest
      && useAuthStore.getState().token
      && data?.code === 'SYSTEM.UNAUTHORIZED'
      && typeof data.message === 'string'
      && data.message.length > 0;

    if (authFailure) {
      useAuthStore.getState().logout();
      if (!window.location.pathname.startsWith('/login')) {
        const from = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`/login?from=${from}`);
      }
    }

    const normalized: ApiError = data?.code
      ? { code: data.code, message: data.message, fields: data.fields }
      : {
          code: status === 401 ? 'SYSTEM.UNAUTHORIZED' : 'SYSTEM.NETWORK_ERROR',
          message:
            status === 401
              ? '登录已失效，请重新登录'
              : error.message,
        };
    return Promise.reject(normalized);
  },
);

/** 从未知异常中提取字段级错误（供表单 setFields 使用）。 */
export function toFieldErrors(err: unknown): Record<string, string> {
  const apiErr = err as ApiError;
  return apiErr && apiErr.fields ? apiErr.fields : {};
}
