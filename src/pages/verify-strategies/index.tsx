import { useEffect, useState } from 'react';

import {

  Button,

  Card,

  Descriptions,

  Empty,

  Form,

  Input,

  InputNumber,

  List,

  Modal,

  Space,

  Table,

  Tag,

  message,

} from 'antd';

import type { ColumnsType } from 'antd/es/table';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {

  createVerifyStrategy,

  getVerifyStrategyRelations,

  listVerifyStrategies,

  updateVerifyStrategy,

  type CreateVerifyStrategyBody,

  type VerifyStrategyRelationView,

  type VerifyStrategyView,

} from '@/api/console';

import { toFieldErrors, type ApiError } from '@/api/client';



/**

 * 验证策略页（risk-console-redesign R5.1 / R5.2）。

 *

 * 验证策略为全局通用配置，不绑定具体业务场景；优先级字段取值 1..9999，数值越大优先级越高。

 */



interface StrategyFormValues {

  code: string;

  name: string;

  priority: number;

}



export default function VerifyStrategiesPage() {

  const queryClient = useQueryClient();

  const [form] = Form.useForm<StrategyFormValues>();



  const [modalOpen, setModalOpen] = useState(false);

  const [editing, setEditing] = useState<VerifyStrategyView | null>(null);



  const [relationsOpen, setRelationsOpen] = useState(false);

  const [relationsTarget, setRelationsTarget] = useState<VerifyStrategyView | null>(null);



  const { data: strategies = [], isLoading } = useQuery({

    queryKey: ['verify-strategies'],

    queryFn: listVerifyStrategies,

  });



  useEffect(() => {

    if (!modalOpen) {

      return;

    }

    if (editing) {

      form.setFieldsValue({

        code: editing.code,

        name: editing.name,

        priority: editing.priority,

      });

    } else {

      form.resetFields();

      form.setFieldsValue({ priority: 100 });

    }

  }, [modalOpen, editing, form]);



  const echoFieldErrors = (err: ApiError, fallback: string) => {

    const fieldErrors = toFieldErrors(err);

    const formErrors = Object.entries(fieldErrors).map(([name, msg]) => ({

      name: name as keyof StrategyFormValues,

      errors: [msg],

    }));

    if (formErrors.length > 0) {

      form.setFields(formErrors);

    } else {

      message.error(err.message ?? fallback);

    }

  };



  const invalidate = () => {

    queryClient.invalidateQueries({ queryKey: ['verify-strategies'] });

  };



  const createMutation = useMutation({

    mutationFn: createVerifyStrategy,

    onSuccess: () => {

      message.success('验证策略创建成功');

      closeModal();

      invalidate();

    },

    onError: (err: ApiError) => echoFieldErrors(err, '创建失败'),

  });



  const updateMutation = useMutation({

    mutationFn: ({ id, body }: { id: number | string; body: CreateVerifyStrategyBody }) =>

      updateVerifyStrategy(id, {

        name: body.name,

        priority: body.priority,

      }),

    onSuccess: () => {

      message.success('验证策略已更新');

      closeModal();

      invalidate();

    },

    onError: (err: ApiError) => echoFieldErrors(err, '更新失败'),

  });



  const openCreate = () => {

    setEditing(null);

    setModalOpen(true);

  };



  const openEdit = (row: VerifyStrategyView) => {

    setEditing(row);

    setModalOpen(true);

  };



  const closeModal = () => {

    setModalOpen(false);

    setEditing(null);

    form.resetFields();

  };



  const openRelations = (row: VerifyStrategyView) => {

    setRelationsTarget(row);

    setRelationsOpen(true);

  };



  const { data: relations, isFetching: relationsLoading } = useQuery<VerifyStrategyRelationView>({

    queryKey: ['verify-strategy-relations', relationsTarget?.id],

    queryFn: () => getVerifyStrategyRelations(relationsTarget!.id),

    enabled: relationsOpen && relationsTarget != null,

  });



  const handleSubmit = (values: StrategyFormValues) => {

    const body: CreateVerifyStrategyBody = {

      code: values.code,

      name: values.name,

      priority: values.priority,

    };

    if (editing) {

      updateMutation.mutate({ id: editing.id, body });

    } else {

      createMutation.mutate(body);

    }

  };



  const columns: ColumnsType<VerifyStrategyView> = [

    { title: '策略代码', dataIndex: 'code', key: 'code' },

    { title: '策略名称', dataIndex: 'name', key: 'name' },

    {

      title: '优先级',

      dataIndex: 'priority',

      key: 'priority',

      defaultSortOrder: 'descend',

      sorter: (a, b) => b.priority - a.priority,

      render: (p: number) => <Tag color="blue">{p}</Tag>,

    },

    {

      title: '更新人',

      dataIndex: 'updatedBy',

      key: 'updatedBy',

      render: (v?: string | null) => v ?? '-',

    },

    {

      title: '更新时间',

      dataIndex: 'updatedAt',

      key: 'updatedAt',

      render: (v?: string | null) => v ?? '-',

    },

    {

      title: '操作',

      key: 'action',

      render: (_, row) => (

        <Space size="middle">

          <Button type="link" size="small" onClick={() => openEdit(row)}>

            编辑

          </Button>

          <Button type="link" size="small" onClick={() => openRelations(row)}>

            关联关系

          </Button>

        </Space>

      ),

    },

  ];



  const isEdit = editing !== null;



  return (

    <Card

      title="验证策略"

      extra={

        <Button type="primary" onClick={openCreate}>

          新建验证策略

        </Button>

      }

    >

      <Table

        rowKey="id"

        loading={isLoading}

        columns={columns}

        dataSource={strategies}

        locale={{ emptyText: '暂无验证策略' }}

      />



      <Modal

        title={isEdit ? '编辑验证策略' : '新建验证策略'}

        open={modalOpen}

        onOk={() => form.submit()}

        confirmLoading={createMutation.isPending || updateMutation.isPending}

        onCancel={closeModal}

        forceRender

      >

        <Form form={form} layout="vertical" onFinish={handleSubmit}>

          <Form.Item

            label="策略代码"

            name="code"

            tooltip={isEdit ? '策略代码为唯一标识，创建后不可修改' : '策略代码全局唯一'}

            rules={[

              { required: true, message: '请输入策略代码' },

              { max: 64, message: '策略代码长度不超过 64' },

              { pattern: /^[A-Za-z0-9_]+$/, message: '策略代码仅允许字母数字下划线' },

            ]}

          >

            <Input placeholder="如 VERIFY_HIGH_RISK" disabled={isEdit} />

          </Form.Item>

          <Form.Item

            label="策略名称"

            name="name"

            rules={[

              { required: true, message: '请输入策略名称' },

              { max: 100, message: '策略名称长度不超过 100' },

            ]}

          >

            <Input placeholder="如 高风险验证策略" />

          </Form.Item>

          <Form.Item

            label="优先级"

            name="priority"

            tooltip="取值范围 1..9999，数值越大优先级越高，全场景通用"

            rules={[{ required: true, message: '请输入优先级' }]}

          >

            <InputNumber

              min={1}

              max={9999}

              precision={0}

              style={{ width: '100%' }}

              placeholder="1..9999"

            />

          </Form.Item>

        </Form>

      </Modal>



      <Modal

        title={relationsTarget ? `关联关系：${relationsTarget.name}` : '关联关系'}

        open={relationsOpen}

        width={640}

        footer={<Button onClick={() => setRelationsOpen(false)}>关闭</Button>}

        onCancel={() => setRelationsOpen(false)}

      >

        {relationsLoading ? (

          <Empty description="加载中…" />

        ) : !relations ? (

          <Empty description="暂无关联关系" />

        ) : (

          <Descriptions column={1} bordered size="small">

            <Descriptions.Item label="引用规则">

              {relations.ruleRefs.length > 0 ? (

                <List

                  size="small"

                  dataSource={relations.ruleRefs}

                  renderItem={(r) => (

                    <List.Item>

                      <Tag color="blue">{String(r)}</Tag>

                    </List.Item>

                  )}

                />

              ) : (

                '无'

              )}

            </Descriptions.Item>

            <Descriptions.Item label="评分区间绑定">

              {relations.scoreBandRefs.length > 0 ? (

                <Space size={4} wrap>

                  {relations.scoreBandRefs.map((b) => (

                    <Tag color="geekblue" key={String(b)}>

                      {String(b)}

                    </Tag>

                  ))}

                </Space>

              ) : (

                '无'

              )}

            </Descriptions.Item>

          </Descriptions>

        )}

      </Modal>

    </Card>

  );

}


