import { Layout, Menu, Button, Space, Typography } from 'antd';
import { Link, useLocation, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { AppRoutes, NAV_GROUPS } from './routes';
import LoginPage from '@/pages/login';
import { useAuthStore } from '@/store/auth';

const { Sider, Header } = Layout;
const { Text } = Typography;

/** 路由切换时将右侧内容区滚回顶部。 */
function ScrollToTop({ containerRef }: { containerRef: React.RefObject<HTMLDivElement> }) {
  const location = useLocation();
  useEffect(() => {
    containerRef.current?.scrollTo(0, 0);
  }, [location.pathname, containerRef]);
  return null;
}

/** 管理控制台主框架（左侧分组导航 + 路由出口 + 顶部用户信息/退出）。 */
function ConsoleShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };
  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        theme="dark"
        width={240}
        style={{ height: '100vh', overflow: 'auto', flexShrink: 0 }}
      >
        <div style={{ color: '#fff', padding: 16, fontWeight: 600 }}>风控决策平台</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={NAV_GROUPS.map((g) => g.label)}
          items={NAV_GROUPS.map((group) => ({
            key: group.label,
            label: group.label,
            children: group.children.map((item) => ({
              key: item.path,
              label: <Link to={item.path}>{item.label}</Link>,
            })),
          }))}
        />
      </Sider>
      <Layout style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span>管理控制台</span>
          <Space>
            {user && (
              <Text type="secondary">
                {user.username}（{user.roles.join('/')}）
              </Text>
            )}
            <Button onClick={handleLogout}>退出登录</Button>
          </Space>
        </Header>
        <div
          ref={contentRef}
          style={{ flex: 1, overflow: 'auto', margin: 16, minHeight: 0 }}
        >
          <ScrollToTop containerRef={contentRef} />
          <AppRoutes />
        </div>
      </Layout>
    </Layout>
  );
}

/**
 * 应用根：登录页为独立全屏路由，其余路径进入控制台主框架（主框架内部再做登录守卫）。
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<ConsoleShell />} />
    </Routes>
  );
}
