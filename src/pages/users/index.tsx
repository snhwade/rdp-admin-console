import { useState } from 'react';
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createUser,
  listUsers,
  resetUserPassword,
  setUserEnabled,
  updateUserRoles,
  type SysUser,
} from '@/api/tools';
import { toFieldErrors, type ApiError } from '@/api/client';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: '管理员',
  OPERATOR: '风控运营',
  AUDITOR: '只读审计',
};

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: '管理员' },
  { value: 'OPERATOR', label: '风控运营' },
  { value: 'AUDITOR', label: '只读审计' },
];

/**
 * 用户与权限页（S10 / OU1，RBAC）。
 *
 * 管理系统用户：新建、启停、改角色、重置密码（需管理员权限）。
 */
export default function UsersPage() {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [roleForm] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [createOpen, setCreateOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<SysUser | null>(null);
  const [pwdTarget, setPwdTarget] = useState<SysUser | null>(null);

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: listUsers });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });

  const onMutationError = (err: ApiError, formInstance?: ReturnType<typeof Form.useForm>[0]) => {
    const fe = Object.entries(toFieldErrors(err)).map(([name, msg]) => ({ name, errors: [msg] }));
    if (fe.length && formInstance) formInstance.setFields(fe);
    else message.error(err.message ?? '操作失败（需管理员权限）');
  };

  const create = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      message.success('用户已创建');
      setCreateOpen(false);
      form.resetFields();
      invalidate();
    },
    onError: (err: ApiError) => onMutationError(err, form),
  });

  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: number | string; enabled: boolean }) => setUserEnabled(id, enabled),
    onSuccess: () => {
      message.success('状态已更新');
      invalidate();
    },
    onError: (err: ApiError) => onMutationError(err),
  });

  const updateRoles = useMutation({
    mutationFn: ({ id, roles }: { id: number | string; roles: string[] }) => updateUserRoles(id, roles),
    onSuccess: () => {
      message.success('角色已更新');
      setRoleTarget(null);
      roleForm.resetFields();
      invalidate();
    },
    onError: (err: ApiError) => onMutationError(err, roleForm),
  });

  const resetPwd = useMutation({
    mutationFn: ({ id, password }: { id: number | string; password: string }) => resetUserPassword(id, password),
    onSuccess: () => {
      message.success('密码已重置');
      setPwdTarget(null);
      pwdForm.resetFields();
    },
    onError: (err: ApiError) => onMutationError(err, pwdForm),
  });

  const openRoleModal = (user: SysUser) => {
    setRoleTarget(user);
    roleForm.setFieldsValue({ roles: user.roles ?? [] });
  };

  const openPwdModal = (user: SysUser) => {
    setPwdTarget(user);
    pwdForm.resetFields();
  };

  const columns: ColumnsType<SysUser> = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) =>
        (roles ?? []).map((r) => <Tag key={r} color="blue">{ROLE_LABEL[r] ?? r}</Tag>),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (e?: boolean) => <Tag color={e === false ? 'default' : 'green'}>{e === false ? '禁用' : '启用'}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      render: (_, record) => (
        <Space size={0} wrap>
          {record.enabled !== false ? (
            <Popconfirm
              title="确认禁用该用户？"
              onConfirm={() => record.id != null && toggleEnabled.mutate({ id: record.id, enabled: false })}
            >
              <Button type="link" size="small" loading={toggleEnabled.isPending}>
                禁用
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="link"
              size="small"
              loading={toggleEnabled.isPending}
              onClick={() => record.id != null && toggleEnabled.mutate({ id: record.id, enabled: true })}
            >
              启用
            </Button>
          )}
          <Button type="link" size="small" onClick={() => openRoleModal(record)}>
            改角色
          </Button>
          <Button type="link" size="small" onClick={() => openPwdModal(record)}>
            重置密码
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="用户与权限"
      extra={
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          新建用户
        </Button>
      }
    >
      <p style={{ marginBottom: 16, color: 'rgba(0,0,0,0.45)' }}>
        管理员可启停账号、调整角色（ADMIN / OPERATOR / AUDITOR）、重置密码。不能禁用当前登录账号，且须至少保留一名启用的管理员。
      </p>
      <Table
        rowKey={(r) => String(r.id ?? r.username)}
        loading={isLoading}
        columns={columns}
        dataSource={users}
        locale={{ emptyText: '暂无用户' }}
      />

      <Modal
        title="新建用户"
        open={createOpen}
        onOk={() => form.submit()}
        confirmLoading={create.isPending}
        onCancel={() => setCreateOpen(false)}
      >
        <Form form={form} layout="vertical" initialValues={{ roles: ['OPERATOR'] }} onFinish={(v) => create.mutate(v)}>
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="登录用户名" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="初始密码" />
          </Form.Item>
          <Form.Item label="角色" name="roles" rules={[{ required: true, message: '请选择角色' }]}>
            <Select mode="multiple" options={ROLE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`改角色：${roleTarget?.username ?? ''}`}
        open={roleTarget != null}
        onOk={() => roleForm.submit()}
        confirmLoading={updateRoles.isPending}
        onCancel={() => setRoleTarget(null)}
      >
        <Form
          form={roleForm}
          layout="vertical"
          onFinish={(v) => {
            if (roleTarget?.id != null) {
              updateRoles.mutate({ id: roleTarget.id, roles: v.roles });
            }
          }}
        >
          <Form.Item label="角色" name="roles" rules={[{ required: true, message: '请选择角色' }]}>
            <Select mode="multiple" options={ROLE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`重置密码：${pwdTarget?.username ?? ''}`}
        open={pwdTarget != null}
        onOk={() => pwdForm.submit()}
        confirmLoading={resetPwd.isPending}
        onCancel={() => setPwdTarget(null)}
      >
        <Form
          form={pwdForm}
          layout="vertical"
          onFinish={(v) => {
            if (pwdTarget?.id != null) {
              resetPwd.mutate({ id: pwdTarget.id, password: v.password });
            }
          }}
        >
          <Form.Item label="新密码" name="password" rules={[{ required: true, message: '请输入新密码' }]}>
            <Input.Password placeholder="新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
