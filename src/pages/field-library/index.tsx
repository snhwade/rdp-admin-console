import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Dropdown,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createField,
  deleteField,
  getFieldRelations,
  importFields,
  listFields,
  updateField,
  type CreateFieldBody,
  type FieldDataType,
  type FieldRelationView,
  type FieldView,
  type ImportFieldsResult,
} from '@/api/console';
import { toFieldErrors, type ApiError } from '@/api/client';

/**
 * 字段库页（risk-console-redesign R3.1 / R3.7）。
 *
 * 全局字段表格（字段 code / 字段名称 / 字段类型 / 操作：编辑 / 枚举值 / 关联关系 / 更多），
 * 支持创建、编辑、批量导入与关联关系查看。
 *
 * 能力：
 * - 创建 / 编辑字段（code、name、dataType ∈ String/Double/Integer/Boolean/Date，R3.2/R3.3/R3.5）。
 * - 批量导入字段（JSON 数组，逐条校验，展示成功/失败明细，R3.6）。
 * - 枚举值视图：展示该字段被引用的枚举值（来自关联关系，R3.7）。
 * - 关联关系视图：展示引用该字段的事件、枚举值与衍生字段（getFieldRelations，R3.7）。
 *
 * 命名中性化（R1）：本页仅从 `@/api/console` import 中性 API，不引用旧版共享 API 模块。
 */

const { Text } = Typography;

/** 受支持的字段数据类型选项（R3.3）。 */
const DATA_TYPE_OPTIONS: { label: string; value: FieldDataType }[] = [
  { label: '字符串（String）', value: 'String' },
  { label: '双精度浮点（Double）', value: 'Double' },
  { label: '整数（Integer）', value: 'Integer' },
  { label: '布尔（Boolean）', value: 'Boolean' },
  { label: '日期（Date）', value: 'Date' },
];

/** 字段类型标签颜色映射。 */
function dataTypeColor(t: FieldDataType): string {
  switch (t) {
    case 'String':
      return 'blue';
    case 'Double':
    case 'Integer':
      return 'geekblue';
    case 'Boolean':
      return 'purple';
    case 'Date':
      return 'cyan';
    default:
      return 'default';
  }
}

interface FieldFormValues {
  code: string;
  name: string;
  dataType: FieldDataType;
  label?: string;
}

/** 关联关系弹窗的展示模式：完整关联关系，或仅枚举值。 */
type RelationsMode = 'relations' | 'enum';

export default function FieldLibraryPage() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm<FieldFormValues>();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FieldView | null>(null);

  // 批量导入弹窗
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<ImportFieldsResult | null>(null);

  // 关联关系 / 枚举值 弹窗
  const [relationsOpen, setRelationsOpen] = useState(false);
  const [relationsMode, setRelationsMode] = useState<RelationsMode>('relations');
  const [relationsTarget, setRelationsTarget] = useState<FieldView | null>(null);

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['fields'],
    queryFn: listFields,
  });

  // 表单回填 / 重置
  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    if (editing) {
      form.setFieldsValue({
        code: editing.code,
        name: editing.name,
        dataType: editing.dataType,
        label: editing.label ?? undefined,
      });
    } else {
      form.resetFields();
    }
  }, [modalOpen, editing, form]);

  /** 字段级错误回显到表单项并保留用户输入。 */
  const echoFieldErrors = (err: ApiError, fallback: string) => {
    const fieldErrors = toFieldErrors(err);
    const formErrors = Object.entries(fieldErrors).map(([name, msg]) => ({
      name: name as keyof FieldFormValues,
      errors: [msg],
    }));
    if (formErrors.length > 0) {
      form.setFields(formErrors);
    } else {
      message.error(err.message ?? fallback);
    }
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['fields'] });
  };

  const createMutation = useMutation({
    mutationFn: createField,
    onSuccess: () => {
      message.success('字段创建成功');
      closeModal();
      invalidate();
    },
    onError: (err: ApiError) => echoFieldErrors(err, '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number | string; body: FieldFormValues }) =>
      updateField(id, {
        code: body.code,
        name: body.name,
        dataType: body.dataType,
        label: body.label,
        enabled: editing?.enabled ?? true,
      }),
    onSuccess: () => {
      message.success('字段已更新');
      closeModal();
      invalidate();
    },
    onError: (err: ApiError) => echoFieldErrors(err, '更新失败'),
  });

  const importMutation = useMutation({
    mutationFn: (items: CreateFieldBody[]) => importFields(items),
    onSuccess: (result) => {
      setImportResult(result);
      message.success(
        `导入完成：成功 ${result.imported.length} 条，失败 ${result.failures.length} 条`,
      );
      invalidate();
    },
    onError: (err: ApiError) => message.error(err.message ?? '导入失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteField,
    onSuccess: () => {
      message.success('字段已删除');
      invalidate();
    },
    onError: (err: ApiError) => message.error(err.message ?? '删除失败'),
  });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (row: FieldView) => {
    setEditing(row);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const handleSubmit = (values: FieldFormValues) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, body: values });
    } else {
      createMutation.mutate({
        code: values.code,
        name: values.name,
        dataType: values.dataType,
        label: values.label,
      });
    }
  };

  const openRelations = (row: FieldView, mode: RelationsMode) => {
    setRelationsTarget(row);
    setRelationsMode(mode);
    setRelationsOpen(true);
  };

  // 关联关系查询（按需触发）
  const { data: relations, isFetching: relationsLoading } = useQuery<FieldRelationView>({
    queryKey: ['field-relations', relationsTarget?.id],
    queryFn: () => getFieldRelations(relationsTarget!.id),
    enabled: relationsOpen && relationsTarget != null,
  });

  const runImport = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      message.error('导入内容不是合法 JSON');
      return;
    }
    if (!Array.isArray(parsed)) {
      message.error('导入内容应为字段数组');
      return;
    }
    setImportResult(null);
    importMutation.mutate(parsed as CreateFieldBody[]);
  };

  const moreMenu = (row: FieldView): MenuProps => ({
    items: [
      { key: 'enum', label: '枚举值' },
      { key: 'relations', label: '关联关系' },
    ],
    onClick: ({ key }) => openRelations(row, key as RelationsMode),
  });

  const columns: ColumnsType<FieldView> = [
    { title: '字段', dataIndex: 'code', key: 'code' },
    { title: '字段名称', dataIndex: 'name', key: 'name' },
    {
      title: '字段类型',
      dataIndex: 'dataType',
      key: 'dataType',
      render: (t: FieldDataType) => <Tag color={dataTypeColor(t)}>{t}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      render: (_, row) => (
        <Space size="middle">
          <Button type="link" size="small" onClick={() => openEdit(row)}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => openRelations(row, 'enum')}>
            枚举值
          </Button>
          <Button type="link" size="small" onClick={() => openRelations(row, 'relations')}>
            关联关系
          </Button>
          <Popconfirm
            title="确认删除该字段？"
            description="若仍被事件字段/规则包/决策流/指标引用，将无法删除。"
            onConfirm={() => deleteMutation.mutate(row.id)}
          >
            <Button type="link" size="small" danger loading={deleteMutation.isPending}>
              删除
            </Button>
          </Popconfirm>
          <Dropdown menu={moreMenu(row)} trigger={['click']}>
            <Button type="link" size="small">
              更多
            </Button>
          </Dropdown>
        </Space>
      ),
    },
  ];

  const isEdit = editing !== null;

  return (
    <Card
      title="字段库"
      extra={
        <Space>
          <Button
            onClick={() => {
              setImportResult(null);
              setImportText('');
              setImportOpen(true);
            }}
          >
            批量导入
          </Button>
          <Button type="primary" onClick={openCreate}>
            新建字段
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={fields}
        locale={{ emptyText: '暂无字段' }}
      />

      {/* 创建 / 编辑字段 */}
      <Modal
        title={isEdit ? '编辑字段' : '新建字段'}
        open={modalOpen}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        onCancel={closeModal}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="字段"
            name="code"
            tooltip={isEdit ? '字段 code 为唯一标识，创建后不建议修改' : '字段 code 全局唯一'}
            rules={[
              { required: true, message: '请输入字段 code' },
              { max: 64, message: '字段 code 长度不超过 64' },
              { pattern: /^[A-Za-z0-9_]+$/, message: '字段 code 仅允许字母数字下划线' },
            ]}
          >
            <Input placeholder="如 trade_amount" disabled={isEdit} />
          </Form.Item>
          <Form.Item
            label="字段名称"
            name="name"
            rules={[
              { required: true, message: '请输入字段名称' },
              { max: 100, message: '字段名称长度不超过 100' },
            ]}
          >
            <Input placeholder="如 交易金额" />
          </Form.Item>
          <Form.Item
            label="字段类型"
            name="dataType"
            rules={[{ required: true, message: '请选择字段类型' }]}
          >
            <Select placeholder="选择字段类型" options={DATA_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item label="含义说明" name="label">
            <Input.TextArea rows={2} placeholder="字段含义说明（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量导入 */}
      <Modal
        title="批量导入字段"
        open={importOpen}
        width={680}
        onOk={runImport}
        okText="开始导入"
        confirmLoading={importMutation.isPending}
        onCancel={() => setImportOpen(false)}
      >
        <Text type="secondary">
          粘贴字段 JSON 数组，逐条校验后导入。字段：code、name、dataType、label（可选）。
        </Text>
        <Input.TextArea
          rows={8}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder={
            '[\n  {"code":"trade_amount","name":"交易金额","dataType":"Double","label":"本次交易金额"}\n]'
          }
          style={{ marginTop: 12, fontFamily: 'monospace' }}
        />
        {importResult && (
          <div style={{ marginTop: 16 }}>
            <Space style={{ marginBottom: 8 }}>
              <Tag color="green">成功 {importResult.imported.length}</Tag>
              <Tag color="red">失败 {importResult.failures.length}</Tag>
            </Space>
            {importResult.failures.length > 0 && (
              <Table
                size="small"
                rowKey={(r) => `${r.index}-${r.code}`}
                pagination={false}
                dataSource={importResult.failures}
                columns={[
                  { title: '序号', dataIndex: 'index', key: 'index', width: 64 },
                  { title: '字段', dataIndex: 'code', key: 'code' },
                  { title: '失败原因', dataIndex: 'reason', key: 'reason' },
                ]}
              />
            )}
          </div>
        )}
      </Modal>

      {/* 关联关系 / 枚举值 */}
      <Modal
        title={
          relationsTarget
            ? `${relationsMode === 'enum' ? '枚举值' : '关联关系'}：${relationsTarget.name}`
            : relationsMode === 'enum'
              ? '枚举值'
              : '关联关系'
        }
        open={relationsOpen}
        width={640}
        footer={<Button onClick={() => setRelationsOpen(false)}>关闭</Button>}
        onCancel={() => setRelationsOpen(false)}
      >
        {relationsLoading ? (
          <Empty description="加载中…" />
        ) : !relations ? (
          <Empty description="暂无关联关系" />
        ) : relationsMode === 'enum' ? (
          relations.enumValues.length > 0 ? (
            <List
              size="small"
              dataSource={relations.enumValues}
              renderItem={(ev) => (
                <List.Item>
                  <Space>
                    <Tag>{ev.value}</Tag>
                    <span>{ev.label}</span>
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            <Empty description="该字段暂无关联枚举值" />
          )
        ) : (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="字段">{relations.fieldCode}</Descriptions.Item>
            <Descriptions.Item label="字段名称">{relations.fieldName}</Descriptions.Item>
            <Descriptions.Item label="引用事件">
              {relations.events.length > 0 ? (
                <Space size={4} wrap>
                  {relations.events.map((e) => (
                    <Tag color="blue" key={e}>
                      {e}
                    </Tag>
                  ))}
                </Space>
              ) : (
                '无'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="关联枚举值">
              {relations.enumValues.length > 0 ? (
                <Space size={4} wrap>
                  {relations.enumValues.map((ev) => (
                    <Tag key={`${ev.enumLibId}-${ev.value}`}>{`${ev.value}（${ev.label}）`}</Tag>
                  ))}
                </Space>
              ) : (
                '无'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="衍生字段">
              {relations.derivedFields.length > 0 ? (
                <Space size={4} wrap>
                  {relations.derivedFields.map((d) => (
                    <Tag color="geekblue" key={d.id}>
                      {d.name}
                    </Tag>
                  ))}
                </Space>
              ) : (
                '无'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="血缘引用（阻断删除/改编码）">
              {(relations.blockingReferences?.length ?? 0) > 0 ? (
                <Space size={4} wrap>
                  {relations.blockingReferences!.map((r) => (
                    <Tag color="orange" key={r}>
                      {r}
                    </Tag>
                  ))}
                </Space>
              ) : (
                '无（可删除）'
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Card>
  );
}
