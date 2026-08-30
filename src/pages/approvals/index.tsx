import { useState } from 'react';
import { Button, Card, Modal, Segmented, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveRequest,
  listApprovals,
  rejectRequest,
  type ApprovalRequest,
} from '@/api/tools';
import { type ApiError } from '@/api/client';

const STATUS = { PENDING: { t: '待审', c: 'blue' }, APPROVED: { t: '通过', c: 'green' }, REJECTED: { t: '驳回', c: 'red' } } as Record<string, { t: string; c: string }>;

/**
 * 复核审批中心页（S5，Maker-Checker）。
 *
 * 配置变更（规则/指标/名单等）走审批闭环：待审列表 + 通过/驳回操作。
 * 通过后生效并被引擎加载；驳回不生效。
 */
export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['approvals', statusFilter],
    queryFn: () => listApprovals(statusFilter ? { status: statusFilter } : undefined),
  });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: number | string; action: 'approve' | 'reject' }) =>
      action === 'approve'
        ? approveRequest(id, 'admin')
        : rejectRequest(id, 'admin', '驳回'),
    onSuccess: (_d, v) => {
      message.success(v.action === 'approve' ? '已通过' : '已驳回');
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (err: ApiError) => message.error(err.message ?? '操作失败'),
  });

  const confirm = (id: number | string, action: 'approve' | 'reject') =>
    Modal.confirm({
      title: action === 'approve' ? '确认通过该变更？' : '确认驳回该变更？',
      content: action === 'approve' ? '通过后将生效并被引擎加载。' : '驳回后该变更不生效。',
      onOk: () => act.mutate({ id, action }),
    });

  const columns: ColumnsType<ApprovalRequest> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '资源类型', dataIndex: 'assetType', key: 'assetType' },
    { title: '资源ID', dataIndex: 'assetId', key: 'assetId' },
    { title: '发起人', dataIndex: 'applicant', key: 'applicant' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS[s]?.c}>{STATUS[s]?.t ?? s}</Tag>,
    },
    { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_, row) =>
        row.status === 'PENDING' ? (
          <Space>
            <Button type="link" onClick={() => confirm(row.id, 'approve')}>
              通过
            </Button>
            <Button type="link" danger onClick={() => confirm(row.id, 'reject')}>
              驳回
            </Button>
          </Space>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <Card title="复核审批中心">
      <Segmented
        style={{ marginBottom: 16 }}
        value={statusFilter}
        onChange={(v) => setStatusFilter(v as string)}
        options={[
          { value: 'PENDING', label: '待审' },
          { value: 'APPROVED', label: '已通过' },
          { value: 'REJECTED', label: '已驳回' },
          { value: '', label: '全部' },
        ]}
      />
      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={items}
        locale={{ emptyText: '暂无审批请求' }}
      />
    </Card>
  );
}
