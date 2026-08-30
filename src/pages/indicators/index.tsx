import { useMemo, useState } from 'react';

import {

  Breadcrumb,

  Button,

  Alert,

  Card,

  Col,

  Empty,

  Input,

  Popconfirm,

  Row,

  Segmented,

  Space,

  Spin,

  Table,

  Tag,

  Typography,

  message,

} from 'antd';

import type { ColumnsType } from 'antd/es/table';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {

  createIndicatorGroup,

  deleteIndicatorDefinition,

  deleteIndicatorGroup,

  listIndicatorDefinitions,

  listIndicatorGroups,

  listIndicatorRuntimeStats,

  offlineIndicatorDefinition,

  onlineIndicatorDefinition,

  updateIndicatorGroup,

  type IndicatorDefinitionView,

  type IndicatorGroupCardView,

  type IndicatorRuntimeStatsView,

  type SaveIndicatorGroupBody,

} from '@/api/config';

import { listScenarioTree } from '@/api/console';

import { type ApiError } from '@/api/client';

import IndicatorEditorPanel from './IndicatorEditorPanel';

import IndicatorGroupCard from './IndicatorGroupCard';

import IndicatorGroupFormModal from './IndicatorGroupFormModal';

import TemplatePickerPanel from './TemplatePickerPanel';

import { getTemplateMeta, type IndicatorTemplateType } from './templates';



const { Text } = Typography;



type PageMode = 'groups' | 'list' | 'pick-template' | 'editor';

interface ActiveGroup {

  id: number | string | null;

  name: string;

  orgName: string;

  eventTypeCodes: string[];

  ungrouped?: boolean;

}



const GRANULARITY_LABEL: Record<string, string> = {

  MINUTE: '分钟',

  HOUR: '小时',

  DAY: '天',

};



const STATUS_META: Record<string, { label: string; color: string }> = {

  ONLINE: { label: '上线', color: 'green' },

  OFFLINE: { label: '下线', color: 'default' },

};



export default function IndicatorsPage() {

  const queryClient = useQueryClient();

  const [pageMode, setPageMode] = useState<PageMode>('groups');

  const [activeGroup, setActiveGroup] = useState<ActiveGroup | null>(null);

  const [editing, setEditing] = useState<IndicatorDefinitionView | null>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<IndicatorTemplateType>('GENERAL_STATS');

  const [keyword, setKeyword] = useState('');

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');

  const [groupModalOpen, setGroupModalOpen] = useState(false);

  const [editingGroup, setEditingGroup] = useState<IndicatorGroupCardView | null>(null);



  const { data: scenarioTree = [] } = useQuery({

    queryKey: ['scenario-tree'],

    queryFn: listScenarioTree,

  });



  const { data: groups = [], isLoading: groupsLoading, isError: groupsError, error: groupsErr } = useQuery({

    queryKey: ['indicator-groups'],

    queryFn: listIndicatorGroups,

    enabled: pageMode === 'groups',

  });



  const indicatorQueryKey = activeGroup?.ungrouped

    ? ['indicator-definitions', 'ungrouped']

    : ['indicator-definitions', activeGroup?.id];



  const listParams = activeGroup?.ungrouped

    ? { ungrouped: true as const }

    : activeGroup?.id != null

      ? { groupId: activeGroup.id }

      : undefined;



  const { data: indicators = [], isLoading, isError, error } = useQuery({

    queryKey: indicatorQueryKey,

    queryFn: () => listIndicatorDefinitions(listParams),

    enabled: pageMode === 'list' && activeGroup != null,

    retry: false,

  });



  const runtimeStatsQueryKey = activeGroup?.ungrouped

    ? ['indicator-runtime-stats', 'ungrouped']

    : ['indicator-runtime-stats', activeGroup?.id];



  const { data: runtimeStats = [] } = useQuery({

    queryKey: runtimeStatsQueryKey,

    queryFn: () =>

      activeGroup?.ungrouped

        ? Promise.resolve([] as IndicatorRuntimeStatsView[])

        : listIndicatorRuntimeStats({ groupId: activeGroup!.id! }),

    enabled: pageMode === 'list' && activeGroup != null && !activeGroup.ungrouped && activeGroup.id != null,

  });



  const statsByRef = useMemo(() => {

    const map = new Map<string, IndicatorRuntimeStatsView>();

    runtimeStats.forEach((s) => map.set(s.refName, s));

    return map;

  }, [runtimeStats]);



  const filteredIndicators = useMemo(() => {

    const kw = keyword.trim().toLowerCase();

    return indicators.filter((item) => {

      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

      if (!kw) return true;

      return (

        item.refName.toLowerCase().includes(kw)

        || (item.name ?? '').toLowerCase().includes(kw)

        || (item.templateType ?? '').toLowerCase().includes(kw)

      );

    });

  }, [indicators, keyword, statusFilter]);



  const invalidateGroups = () => queryClient.invalidateQueries({ queryKey: ['indicator-groups'] });

  const invalidateIndicators = () => queryClient.invalidateQueries({ queryKey: ['indicator-definitions'] });



  const createGroupMutation = useMutation({

    mutationFn: (body: SaveIndicatorGroupBody) => createIndicatorGroup(body),

    onSuccess: () => {

      message.success('分组已创建');

      setGroupModalOpen(false);

      invalidateGroups();

    },

    onError: (err: ApiError) => message.error(err.message ?? '创建失败'),

  });



  const updateGroupMutation = useMutation({

    mutationFn: ({ id, body }: { id: number | string; body: SaveIndicatorGroupBody }) =>

      updateIndicatorGroup(id, body),

    onSuccess: () => {

      message.success('分组已更新');

      setGroupModalOpen(false);

      setEditingGroup(null);

      invalidateGroups();

    },

    onError: (err: ApiError) => message.error(err.message ?? '更新失败'),

  });



  const deleteGroupMutation = useMutation({

    mutationFn: (id: number | string) => deleteIndicatorGroup(id),

    onSuccess: () => {

      message.success('分组已删除');

      invalidateGroups();

    },

    onError: (err: ApiError) => message.error(err.message ?? '删除失败'),

  });



  const deleteMutation = useMutation({

    mutationFn: (id: number | string) => deleteIndicatorDefinition(id),

    onSuccess: () => {

      message.success('已删除');

      invalidateIndicators();

      invalidateGroups();

    },

    onError: (err: ApiError) => message.error(err.message ?? '删除失败'),

  });



  const onlineMutation = useMutation({

    mutationFn: (id: number | string) => onlineIndicatorDefinition(id),

    onSuccess: () => {

      message.success('已上线');

      invalidateIndicators();

      invalidateGroups();

    },

    onError: (err: ApiError) => message.error(err.message ?? '上线失败'),

  });



  const offlineMutation = useMutation({

    mutationFn: (id: number | string) => offlineIndicatorDefinition(id),

    onSuccess: () => {

      message.success('已下线');

      invalidateIndicators();

      invalidateGroups();

    },

    onError: (err: ApiError) => message.error(err.message ?? '下线失败'),

  });



  const openGroup = (group: IndicatorGroupCardView) => {

    setActiveGroup({

      id: group.id,

      name: group.name,

      orgName: group.orgName,

      eventTypeCodes: group.eventTypeCodes ?? [],

      ungrouped: group.id == null,

    });

    setKeyword('');

    setStatusFilter('ALL');

    setPageMode('list');

  };



  const backToGroups = () => {

    setPageMode('groups');

    setActiveGroup(null);

    setEditing(null);

  };



  const backToList = () => {

    setPageMode('list');

    setEditing(null);

  };



  const openCreateIndicator = () => {

    setEditing(null);

    setPageMode('pick-template');

  };



  const onTemplateSelected = (type: IndicatorTemplateType) => {

    setSelectedTemplate(type);

    setPageMode('editor');

  };



  const openEdit = (record: IndicatorDefinitionView) => {

    setEditing(record);

    setSelectedTemplate((record.templateType as IndicatorTemplateType) ?? 'GENERAL_STATS');

    setPageMode('editor');

  };



  const indicatorColumns: ColumnsType<IndicatorDefinitionView> = [

    { title: '指标编码', dataIndex: 'refName', key: 'refName', width: 160, ellipsis: true },

    { title: '指标名称', dataIndex: 'name', key: 'name', width: 140, render: (v?: string | null) => v || '—' },

    {

      title: '模版',

      dataIndex: 'templateType',

      key: 'templateType',

      width: 120,

      render: (t?: string | null) => (t ? getTemplateMeta(t as IndicatorTemplateType).name : '—'),

    },

    {

      title: '事件',

      dataIndex: 'eventTypeCodes',

      key: 'eventTypeCodes',

      width: 120,

      render: (codes?: string[]) => (codes ?? []).join(', ') || '—',

    },

    {

      title: '统计维度',

      dataIndex: 'dimensions',

      key: 'dimensions',

      width: 140,

      render: (dims?: string[]) => (dims ?? []).join(', ') || '—',

    },

    {

      title: '窗口',

      key: 'window',

      width: 100,

      render: (_, r) => `${r.windowDays}天 / ${GRANULARITY_LABEL[r.sliceGranularity] ?? r.sliceGranularity}`,

    },

    {

      title: '状态',

      dataIndex: 'status',

      key: 'status',

      width: 80,

      render: (s: string) => {

        const meta = STATUS_META[s] ?? { label: s, color: 'default' };

        return <Tag color={meta.color}>{meta.label}</Tag>;

      },

    },

    {

      title: '最近累计',

      key: 'lastAccumulateAt',

      width: 150,

      render: (_, r) => {

        const ts = statsByRef.get(r.refName)?.lastAccumulateAt;

        return ts ? new Date(ts).toLocaleString() : '—';

      },

    },

    {

      title: '读缺失',

      key: 'readMissCount',

      width: 80,

      align: 'right',

      render: (_, r) => statsByRef.get(r.refName)?.readMissCount ?? 0,

    },

    {

      title: '备注',

      dataIndex: 'description',

      key: 'description',

      width: 140,

      align: 'right',

      ellipsis: true,

      render: (v?: string | null) => v || '—',

    },

    {

      title: '操作',

      key: 'actions',

      width: 200,

      fixed: 'right',

      render: (_, record) => (

        <Space size={0} wrap>

          <Button type="link" size="small" onClick={() => openEdit(record)}>

            编辑

          </Button>

          {record.status === 'ONLINE' ? (

            <Button type="link" size="small" loading={offlineMutation.isPending} onClick={() => offlineMutation.mutate(record.id)}>

              下线

            </Button>

          ) : (

            <Button type="link" size="small" loading={onlineMutation.isPending} onClick={() => onlineMutation.mutate(record.id)}>

              上线

            </Button>

          )}

          <Popconfirm title="确认删除该指标？" onConfirm={() => deleteMutation.mutate(record.id)}>

            <Button type="link" size="small" danger loading={deleteMutation.isPending}>

              删除

            </Button>

          </Popconfirm>

        </Space>

      ),

    },

  ];



  const breadcrumbItems = useMemo(() => {

    const items = [{ title: '指标分组' }];

    if (activeGroup && pageMode !== 'groups') {

      items.push({ title: activeGroup.name });

    }

    if (pageMode === 'pick-template') {

      items.push({ title: '选择指标模版' });

    }

    if (pageMode === 'editor') {

      items.push({ title: editing ? '编辑指标' : '新建指标' });

    }

    return items;

  }, [activeGroup, pageMode, editing]);



  const cardTitle =

    pageMode === 'groups' ? (

      '指标分组'

    ) : (

      <Breadcrumb items={breadcrumbItems} />

    );



  const cardExtra =

    pageMode === 'groups' ? (

      <Button

        type="primary"

        onClick={() => {

          setEditingGroup(null);

          setGroupModalOpen(true);

        }}

      >

        新建分组

      </Button>

    ) : pageMode === 'list' ? (

      <Space wrap>

        <Input.Search

          allowClear

          placeholder="按编码/名称筛选"

          value={keyword}

          onChange={(e) => setKeyword(e.target.value)}

          style={{ width: 180 }}

        />

        <Segmented

          value={statusFilter}

          onChange={(v) => setStatusFilter(v as typeof statusFilter)}

          options={[

            { label: '全部', value: 'ALL' },

            { label: '上线', value: 'ONLINE' },

            { label: '下线', value: 'OFFLINE' },

          ]}

        />

        <Button onClick={backToGroups}>返回分组</Button>

        <Button type="primary" onClick={openCreateIndicator}>

          新建指标

        </Button>

      </Space>

    ) : pageMode === 'pick-template' || pageMode === 'editor' ? (
      <Button onClick={backToList}>返回列表</Button>
    ) : null;



  return (

    <>

      <Card title={cardTitle} extra={cardExtra}>

        {pageMode === 'groups' ? (

          <>

            {groupsError ? (

              <Alert

                type="error"

                showIcon

                message="分组列表加载失败"

                description={(groupsErr as unknown as ApiError)?.message}

                style={{ marginBottom: 12 }}

              />

            ) : null}

            <Spin spinning={groupsLoading}>

              {groups.length === 0 && !groupsLoading ? (

                <Empty description="暂无指标分组，请先新建分组">

                  <Button type="primary" onClick={() => setGroupModalOpen(true)}>

                    新建分组

                  </Button>

                </Empty>

              ) : (

                <Row gutter={[16, 16]}>

                  {groups.map((group) => (

                    <Col key={String(group.id ?? 'ungrouped')} xs={24} sm={12} lg={8} xxl={6}>

                      <IndicatorGroupCard

                        group={group}

                        scenarioTree={scenarioTree}

                        onOpen={() => openGroup(group)}

                        onEdit={

                          group.id != null

                            ? () => {

                                setEditingGroup(group);

                                setGroupModalOpen(true);

                              }

                            : undefined

                        }

                        onDelete={

                          group.id != null

                            ? () => deleteGroupMutation.mutate(group.id as number | string)

                            : undefined

                        }

                      />

                    </Col>

                  ))}

                </Row>

              )}

            </Spin>

          </>

        ) : null}



        {pageMode === 'list' && activeGroup ? (

          <>

            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>

              {activeGroup.orgName} · 绑定 {activeGroup.eventTypeCodes.length} 个事件 · 通过模版可视化配置统计规则，规则中引用指标编码

            </Text>

            {isError ? (

              <Alert

                type="error"

                showIcon

                message="指标列表加载失败"

                description={(error as unknown as ApiError)?.message}

                style={{ marginBottom: 12 }}

              />

            ) : null}



            {!activeGroup.ungrouped && runtimeStats.length > 0 ? (

              <Alert

                type="info"

                showIcon

                style={{ marginBottom: 12 }}

                message="运行统计（IS1）"

                description={`本组 ${runtimeStats.filter((s) => s.status === 'ONLINE').length} 个上线指标；读缺失合计 ${runtimeStats.reduce((n, s) => n + (s.readMissCount ?? 0), 0)} 次`}

              />

            ) : null}



            <Spin spinning={isLoading}>

              {filteredIndicators.length === 0 && !isLoading ? (

                <Empty description="该分组下暂无指标">

                  <Button type="primary" onClick={openCreateIndicator}>

                    新建指标

                  </Button>

                </Empty>

              ) : (

                <Table

                  rowKey="id"

                  columns={indicatorColumns}

                  dataSource={filteredIndicators}

                  scroll={{ x: 980 }}

                  pagination={{ pageSize: 20, showSizeChanger: true }}

                />

              )}

            </Spin>

          </>

        ) : null}



        {pageMode === 'pick-template' ? (

          <>

            <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>

              请选择指标模版，悬停卡片后点击「立即使用」

            </Text>

            <TemplatePickerPanel onSelect={onTemplateSelected} />

          </>

        ) : null}



        {pageMode === 'editor' && activeGroup ? (

          <IndicatorEditorPanel

            editing={editing}

            groupId={activeGroup.ungrouped ? null : activeGroup.id}

            initialTemplateType={selectedTemplate}

            presetEventCodes={activeGroup.eventTypeCodes}

            onBack={backToList}

            onSaved={() => {

              invalidateIndicators();

              invalidateGroups();

            }}

          />

        ) : null}

      </Card>



      <IndicatorGroupFormModal

        open={groupModalOpen}

        editing={editingGroup}

        loading={createGroupMutation.isPending || updateGroupMutation.isPending}

        onCancel={() => {

          setGroupModalOpen(false);

          setEditingGroup(null);

        }}

        onSubmit={(values) => {

          if (editingGroup?.id != null) {

            updateGroupMutation.mutate({ id: editingGroup.id, body: values });

          } else {

            createGroupMutation.mutate(values);

          }

        }}

      />

    </>

  );

}


