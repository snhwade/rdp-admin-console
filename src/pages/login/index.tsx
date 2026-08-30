import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { login, type LoginResult } from '@/api/config';
import { useAuthStore } from '@/store/auth';
import type { ApiError } from '@/api/client';

const { Title, Text } = Typography;

/** 仅允许站内相对路径，防止 open redirect。 */
function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/login')) {
    return '/events';
  }
  return raw;
}

interface LoginFormValues {
  username: string;
  password: string;
}

/**
 * 登录页（S10）。
 *
 * 用户名+密码经 Admin BFF 登录（POST /bff/api/v1/auth/login），成功后将 JWT 令牌
 * 写入 auth store（持久化到 localStorage），随后跳转回访问前的页面或默认首页。
 * 内置管理员账号：admin / admin123。
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const stateFrom = (location.state as { from?: string } | null)?.from;
  const queryFrom = new URLSearchParams(location.search).get('from');
  const from = safeRedirectPath(stateFrom ?? (queryFrom ? decodeURIComponent(queryFrom) : undefined));

  // 已登录则直接跳转（避免重复登录）
  useEffect(() => {
    if (isAuthenticated()) {
      navigate(from, { replace: true });
    }
  }, [from, isAuthenticated, navigate]);

  // 登录前用户想访问的页面（路由守卫经 state.from 传入，或拦截器经 ?from= 查询参数传入），
  // 登录后跳回；缺省回事件管理首页。

  const loginMutation = useMutation({
    mutationFn: ({ username, password }: LoginFormValues) => login(username, password),
    onSuccess: (res: LoginResult) => {
      setAuth(res.token, { username: res.username, roles: res.roles });
      message.success('登录成功');
      navigate(from, { replace: true });
    },
    onError: (err: ApiError) => {
      message.error(err.message ?? '登录失败，请检查用户名或密码');
    },
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}
    >
      <Card style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 4 }}>
            风控决策平台
          </Title>
          <Text type="secondary">管理控制台登录</Text>
        </div>
        <Form<LoginFormValues>
          layout="vertical"
          onFinish={(values) => loginMutation.mutate(values)}
          initialValues={{ username: 'admin', password: '' }}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="用户名" autoComplete="username" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="密码" autoComplete="current-password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loginMutation.isPending}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ display: 'block', marginTop: 16, fontSize: 12 }}>
          默认管理员账号：admin / admin123
        </Text>
      </Card>
    </div>
  );
}
