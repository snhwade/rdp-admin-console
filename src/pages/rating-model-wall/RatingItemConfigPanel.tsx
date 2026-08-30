import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import {
  getGradeMinScore,
  listEventFields,
  type DirectGradingItem,
  type EventFieldView,
  type GradeBand,
  type RatingItem,
} from '@/api/console';
import { codeHintSelectOption } from '@/components/CodeHintLabel';
import {
  buildFieldCondition,
  CONDITION_OPERATOR_OPTIONS,
  parseFieldCondition,
  type ConditionOperator,
} from './ratingCondition';

const { Text } = Typography;

type ConfigTab = 'score' | 'direct';

interface RatingItemConfigPanelProps {
  eventCode: string;
  gradeBands: GradeBand[];
  scoreItems: RatingItem[];
  directItems: DirectGradingItem[];
  onScoreItemsChange: (items: RatingItem[]) => void;
  onDirectItemsChange: (items: DirectGradingItem[]) => void;
}

interface ItemFormValues {
  fieldCode: string;
  operator: ConditionOperator;
  conditionValue: string;
  score?: number;
  grade?: string;
}

function fieldLabel(field: EventFieldView): string {
  return field.fieldName ?? field.fieldCode ?? String(field.fieldId);
}

export default function RatingItemConfigPanel({
  eventCode,
  gradeBands,
  scoreItems,
  directItems,
  onScoreItemsChange,
  onDirectItemsChange,
}: RatingItemConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<ConfigTab>('score');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form] = Form.useForm<ItemFormValues>();

  const editingMode: ConfigTab = activeTab;

  const { data: eventFields = [], isLoading: fieldsLoading } = useQuery({
    queryKey: ['event-fields', eventCode],
    queryFn: () => listEventFields(eventCode),
    enabled: Boolean(eventCode),
  });

  const fieldByCode = useMemo(() => {
    const map = new Map<string, EventFieldView>();
    for (const field of eventFields) {
      if (field.fieldCode) {
        map.set(field.fieldCode, field);
      }
    }
    return map;
  }, [eventFields]);

  const fieldOptions = useMemo(
    () =>
      eventFields
        .filter((field) => field.fieldCode)
        .map((field) => codeHintSelectOption(field.fieldCode!, fieldLabel(field), field.fieldCode!)),
    [eventFields],
  );

  const gradeOptions = useMemo(
    () => gradeBands.map((band) => band.grade).filter((grade) => grade.trim().length > 0),
    [gradeBands],
  );

  const isEdit = editingIndex != null;
  const isScoreForm = editingMode === 'score';
  const operator = Form.useWatch('operator', form);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    if (isEdit) {
      if (isScoreForm) {
        const row = scoreItems[editingIndex!];
        const parsed = parseFieldCondition(row.condition);
        form.setFieldsValue({
          fieldCode: row.subItem ?? '',
          operator: parsed.operator,
          conditionValue: parsed.value,
          score: row.score ?? 0,
        });
      } else {
        const row = directItems[editingIndex!];
        const parsed = parseFieldCondition(row.condition);
        form.setFieldsValue({
          fieldCode: row.fieldCode ?? '',
          operator: parsed.operator,
          conditionValue: parsed.value,
          grade: row.grade,
        });
      }
      return;
    }
    form.resetFields();
    form.setFieldsValue({
      operator: 'EQ',
      score: 0,
      grade: gradeOptions[0],
    });
  }, [
    modalOpen,
    isEdit,
    editingIndex,
    isScoreForm,
    scoreItems,
    directItems,
    gradeOptions,
    form,
  ]);

  const openCreate = (tab: ConfigTab) => {
    setActiveTab(tab);
    setEditingIndex(null);
    setModalOpen(true);
  };

  const openEdit = (tab: ConfigTab, index: number) => {
    setActiveTab(tab);
    setEditingIndex(index);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingIndex(null);
  };

  const resolveFieldMeta = (fieldCode: string) => {
    const field = fieldByCode.get(fieldCode);
    return {
      fieldName: field ? fieldLabel(field) : fieldCode,
    };
  };

  const handleSubmit = (values: ItemFormValues) => {
    const condition = buildFieldCondition(values.fieldCode, values.operator, values.conditionValue);
    const { fieldName } = resolveFieldMeta(values.fieldCode);

    if (isScoreForm) {
      const nextItem: RatingItem = {
        category: fieldName,
        subItem: values.fieldCode,
        condition,
        score: values.score ?? 0,
        subItemCap: null,
        importance: null,
        grade: null,
      };
      if (isEdit) {
        onScoreItemsChange(scoreItems.map((item, i) => (i === editingIndex ? nextItem : item)));
      } else {
        onScoreItemsChange([...scoreItems, nextItem]);
      }
    } else {
      const nextItem: DirectGradingItem = {
        fieldCode: values.fieldCode,
        fieldName,
        condition,
        grade: values.grade ?? '',
      };
      if (isEdit) {
        onDirectItemsChange(directItems.map((item, i) => (i === editingIndex ? nextItem : item)));
      } else {
        onDirectItemsChange([...directItems, nextItem]);
      }
    }
    closeModal();
  };

  const scoreTotalHint = useMemo(
    () => scoreItems.reduce((sum, item) => sum + (item.score ?? 0), 0),
    [scoreItems],
  );

  const scoreColumns: ColumnsType<RatingItem & { index: number }> = [
    {
      title: '字段',
      key: 'field',
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text>{row.category ?? row.subItem ?? '-'}</Text>
          {row.subItem ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.subItem}
            </Text>
          ) : null}
        </Space>
      ),
    },
    { title: '条件', dataIndex: 'condition', key: 'condition', render: (v) => v ?? '-' },
    { title: '分值', dataIndex: 'score', key: 'score', render: (v) => (v != null ? v : '-') },
    {
      title: '操作',
      key: 'action',
      render: (_, row) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => openEdit('score', row.index)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            onClick={() => onScoreItemsChange(scoreItems.filter((_, i) => i !== row.index))}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const directColumns: ColumnsType<DirectGradingItem & { index: number }> = [
    {
      title: '字段',
      key: 'field',
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text>{row.fieldName ?? row.fieldCode ?? '-'}</Text>
          {row.fieldCode ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.fieldCode}
            </Text>
          ) : null}
        </Space>
      ),
    },
    { title: '条件', dataIndex: 'condition', key: 'condition', render: (v) => v ?? '-' },
    {
      title: '命中等级',
      dataIndex: 'grade',
      key: 'grade',
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: '得分',
      key: 'derivedScore',
      render: (_, row) => {
        const score = getGradeMinScore(gradeBands, row.grade);
        return score != null ? score : '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, row) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => openEdit('direct', row.index)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            onClick={() => onDirectItemsChange(directItems.filter((_, i) => i !== row.index))}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'score',
      label: `评分定级 (${scoreItems.length})`,
      children: (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="评分子项仅设置分值；全部命中项累加为总分，再由等级区间映射最终等级。"
          />
          <div style={{ marginBottom: 8, textAlign: 'right' }}>
            <Text type="secondary">子项分值合计（全部命中时）= {scoreTotalHint} 分</Text>
          </div>
          <Table
            size="small"
            rowKey="index"
            columns={scoreColumns}
            dataSource={scoreItems.map((item, index) => ({ ...item, index }))}
            pagination={false}
            locale={{ emptyText: '暂无评分子项' }}
          />
          <Button type="dashed" block style={{ marginTop: 12 }} onClick={() => openCreate('score')}>
            新增配置
          </Button>
        </>
      ),
    },
    {
      key: 'direct',
      label: `直接定级 (${directItems.length})`,
      children: (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="直接定级子项配置命中等级；得分取该等级区间下界。与评分子项可同时生效，最终取较高等级。"
          />
          <Table
            size="small"
            rowKey="index"
            columns={directColumns}
            dataSource={directItems.map((item, index) => ({ ...item, index }))}
            pagination={false}
            locale={{ emptyText: '暂无直接定级项' }}
          />
          <Button type="dashed" block style={{ marginTop: 12 }} onClick={() => openCreate('direct')}>
            新增配置
          </Button>
        </>
      ),
    },
  ];

  return (
    <>
      <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as ConfigTab)} items={tabItems} />

      <Modal
        title={isEdit ? '编辑配置' : '新增配置'}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={closeModal}
        forceRender
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="事件字段"
            name="fieldCode"
            rules={[{ required: true, message: '请选择事件字段' }]}
          >
            <Select
              showSearch
              loading={fieldsLoading}
              options={fieldOptions}
              placeholder={eventCode ? '选择事件下的字段' : '模型未关联事件'}
              optionFilterProp="label"
              disabled={!eventCode}
            />
          </Form.Item>

          <Form.Item
            label="条件"
            name="operator"
            rules={[{ required: true, message: '请选择条件类型' }]}
          >
            <Select options={CONDITION_OPERATOR_OPTIONS} />
          </Form.Item>

          {operator === 'CUSTOM' ? (
            <Form.Item
              label="自定义表达式"
              name="conditionValue"
              rules={[{ required: true, message: '请输入条件表达式' }]}
            >
              <Input.TextArea rows={2} placeholder="如 pep == 'YES'" />
            </Form.Item>
          ) : (
            <Form.Item
              label="条件值"
              name="conditionValue"
              rules={[{ required: true, message: '请输入条件值' }]}
            >
              <Input placeholder="如 YES / 100 / true" />
            </Form.Item>
          )}

          {isScoreForm ? (
            <Form.Item label="分值" name="score" rules={[{ required: true, message: '请输入分值' }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          ) : (
            <>
              <Form.Item
                label="命中等级"
                name="grade"
                rules={[{ required: true, message: '请选择命中等级' }]}
              >
                {gradeOptions.length > 0 ? (
                  <Select
                    options={gradeOptions.map((grade) => ({ label: grade, value: grade }))}
                    placeholder="选择等级"
                  />
                ) : (
                  <Input placeholder="请先在上方配置等级区间" />
                )}
              </Form.Item>
              <Form.Item shouldUpdate noStyle>
                {() => {
                  const grade = form.getFieldValue('grade') as string | undefined;
                  const score = grade ? getGradeMinScore(gradeBands, grade) : null;
                  return score != null ? (
                    <Alert
                      type="success"
                      showIcon
                      message={`该项得分 = 等级「${grade}」区间下界：${score} 分`}
                    />
                  ) : null;
                }}
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </>
  );
}
