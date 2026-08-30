import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Typography,
  Alert,
  message,
} from 'antd';
import {
  MinusCircleOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { RuleExpressionEditor, confirmIndicatorUpdate } from '@/components';
import type { ExpressionError } from '@/components/types';
import { listScenarioTree } from '@/api/console';
import { listEventFields } from '@/api/console/params';
import {
  createIndicatorDefinition,
  listIndicatorDefinitionSnapshots,
  listIndicatorReferences,
  rollbackIndicatorDefinition,
  updateIndicatorDefinition,
  type CreateIndicatorBody,
  type IndicatorDefinitionView,
  type UpdateIndicatorBody,
} from '@/api/config';
import { toFieldErrors, type ApiError } from '@/api/client';
import TemplateConfigShell from './TemplateConfigShell';
import TemplatePickerModal from './TemplatePickerModal';
import IndicatorStepTimeline from './IndicatorStepTimeline';
import { buildPreviewText, compileTemplate } from './templateCompile';
import { INDICATOR_THEME } from './indicatorStyles';
import {
  AGGREGATE_FUNCTION_OPTIONS,
  FILTER_OPERATOR_OPTIONS,
  TIME_UNIT_OPTIONS,
  defaultTemplateConfig,
  getTemplateMeta,
  isStatsTemplate,
  parseTemplateConfig,
  type IndicatorTemplateConfig,
  type IndicatorTemplateType,
  type StatsTemplateConfig,
} from './templates';

const { Text } = Typography;

interface Props {
  editing: IndicatorDefinitionView | null;
  groupId?: number | string | null;
  initialTemplateType?: IndicatorTemplateType;
  presetEventCodes?: string[];
  onBack: () => void;
  onSaved: () => void;
}

function StatsStepperFields({
  fieldOptions,
  fieldsLoading,
  showObject,
  defaultAgg,
}: {
  fieldOptions: { value: string; label: string }[];
  fieldsLoading: boolean;
  showObject: boolean;
  defaultAgg?: string;
}) {
  const steps = [
    {
      key: 'dimension',
      label: '维度',
      required: true,
      content: (
        <Form.Item name="dimension" rules={[{ required: true, message: '请选择维度' }]} style={{ marginBottom: 0 }}>
          <Select
            placeholder="请选择"
            options={fieldOptions}
            loading={fieldsLoading}
            optionFilterProp="label"
            suffixIcon={<QuestionCircleOutlined style={{ color: INDICATOR_THEME.muted }} />}
            style={{ maxWidth: 420 }}
          />
        </Form.Item>
      ),
    },
    {
      key: 'time',
      label: '时间',
      required: true,
      content: (
        <Space align="start" wrap>
          <Form.Item name="timeValue" rules={[{ required: true, message: '请输入' }]} style={{ marginBottom: 0 }}>
            <InputNumber min={1} style={{ width: 88 }} />
          </Form.Item>
          <Form.Item name="timeUnit" rules={[{ required: true, message: '请选择单位' }]} style={{ marginBottom: 0 }}>
            <Select placeholder="单位" options={TIME_UNIT_OPTIONS} style={{ width: 108 }} />
          </Form.Item>
        </Space>
      ),
    },
    ...(showObject
      ? [
          {
            key: 'object',
            label: '对象',
            required: true,
            content: (
              <Form.Item
                name="objectField"
                rules={[{ required: true, message: '请选择对象字段' }]}
                style={{ marginBottom: 0 }}
              >
                <Select
                  placeholder="请选择"
                  options={fieldOptions}
                  loading={fieldsLoading}
                  optionFilterProp="label"
                  style={{ maxWidth: 420 }}
                />
              </Form.Item>
            ),
          },
        ]
      : []),
    {
      key: 'function',
      label: '函数',
      required: true,
      content: (
        <Form.Item
          name="aggregateFunction"
          initialValue={defaultAgg}
          rules={[{ required: true, message: '请选择函数' }]}
          style={{ marginBottom: 0 }}
        >
          <Select placeholder="请选择" options={AGGREGATE_FUNCTION_OPTIONS} style={{ maxWidth: 420 }} />
        </Form.Item>
      ),
    },
  ];

  return <IndicatorStepTimeline steps={steps} />;
}

/** 指标配置页（全宽内嵌，非 Drawer）。 */
export default function IndicatorEditorPanel({
  editing,
  groupId = null,
  initialTemplateType = 'GENERAL_STATS',
  presetEventCodes = [],
  onBack,
  onSaved,
}: Props) {
  const [form] = Form.useForm();
  const [templateType, setTemplateType] = useState<IndicatorTemplateType>(initialTemplateType);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [accScriptOverride, setAccScriptOverride] = useState('');
  const [scriptError, setScriptError] = useState<ExpressionError | null>(null);
  const [saving, setSaving] = useState(false);

  const templateMeta = getTemplateMeta(templateType);
  const isStats = isStatsTemplate(templateType);

  const { data: scenarioTree = [] } = useQuery({
    queryKey: ['scenario-tree'],
    queryFn: listScenarioTree,
  });

  const eventSelectOptions = useMemo(() => {
    const allowed = new Set(presetEventCodes.filter(Boolean));
    const opts: { value: string; label: string }[] = [];
    for (const scenario of scenarioTree) {
      for (const event of scenario.events ?? []) {
        if (allowed.size > 0 && !allowed.has(event.code)) continue;
        opts.push({ value: event.code, label: `${scenario.name} / ${event.name}` });
      }
    }
    return opts;
  }, [scenarioTree, presetEventCodes]);

  const watchedEvents: string[] = Form.useWatch('eventTypeCodes', form) ?? [];

  const { data: fieldOptions = [], isFetching: fieldsLoading } = useQuery({
    queryKey: ['indicator-editor-fields', watchedEvents],
    queryFn: async () => {
      const codes = [...new Set(watchedEvents.filter(Boolean))];
      if (!codes.length) return [];
      const lists = await Promise.all(codes.map((code) => listEventFields(code)));
      const seen = new Set<string>();
      return lists
        .flatMap((list) =>
          list.map((f) => {
            const code = f.fieldCode ?? String(f.fieldId);
            return { code, label: f.fieldName ? `${f.fieldName} (${code})` : code };
          }),
        )
        .filter((o) => {
          if (seen.has(o.code)) return false;
          seen.add(o.code);
          return true;
        })
        .map((o) => ({ value: o.code, label: o.label }))
        .sort((a, b) => a.value.localeCompare(b.value));
    },
    enabled: watchedEvents.length > 0,
  });

  const formValues = Form.useWatch([], form);
  const preview = useMemo(() => {
    if (!formValues) return buildPreviewText(templateType, defaultTemplateConfig(templateType));
    const cfg = { ...defaultTemplateConfig(templateType), ...formValues } as IndicatorTemplateConfig;
    const dimLabel = fieldOptions.find((o) => o.value === (formValues as StatsTemplateConfig).dimension)?.label;
    const objLabel = fieldOptions.find((o) => o.value === (formValues as StatsTemplateConfig).objectField)?.label;
    const fnLabel = AGGREGATE_FUNCTION_OPTIONS.find(
      (o) => o.value === (formValues as StatsTemplateConfig).aggregateFunction,
    )?.label;
    return buildPreviewText(templateType, cfg, { dimension: dimLabel, object: objLabel, fn: fnLabel });
  }, [formValues, templateType, fieldOptions]);

  useEffect(() => {
    const type = (editing?.templateType as IndicatorTemplateType) ?? initialTemplateType;
    setTemplateType(type);
    setAdvancedOpen(false);
    setScriptError(null);
    form.resetFields();
    const parsed = parseTemplateConfig(type, editing?.templateConfig ?? null);
    const events = editing?.eventTypeCodes ?? presetEventCodes;
    form.setFieldsValue({
      ...parsed,
      eventTypeCodes: events.length ? events : (parsed as StatsTemplateConfig).eventTypeCodes,
    });
    setAccScriptOverride(editing?.accScript ?? '');
    if (!editing) {
      form.setFieldsValue({ refName: '', name: '', dataSource: 'FACT_TABLE', filters: [], includeCurrentTxn: false });
    } else {
      form.setFieldsValue({ refName: editing.refName, name: editing.name ?? '', description: editing.description ?? '' });
    }
  }, [editing, initialTemplateType, presetEventCodes, form]);

  const switchTemplate = (type: IndicatorTemplateType) => {
    setTemplateType(type);
    setPickerOpen(false);
    const events = form.getFieldValue('eventTypeCodes') ?? presetEventCodes;
    form.resetFields();
    form.setFieldsValue({
      ...defaultTemplateConfig(type),
      eventTypeCodes: events,
      dataSource: 'FACT_TABLE',
      filters: [],
    });
  };

  const buildSaveBody = (): (CreateIndicatorBody | UpdateIndicatorBody) & { refName?: string } | null => {
    const values = form.getFieldsValue(true);
    const cfg = { ...defaultTemplateConfig(templateType), ...values } as IndicatorTemplateConfig;
    const compiled = compileTemplate(templateType, cfg);
    if (advancedOpen && accScriptOverride.trim()) {
      compiled.accScript = accScriptOverride.trim();
    }
    if (!compiled.eventTypeCodes?.length) {
      message.error('请选择适用事件');
      return null;
    }
    if (!compiled.dimensions?.length) {
      message.error('请配置统计维度');
      return null;
    }
    const base = {
      groupId: groupId ?? editing?.groupId ?? null,
      name: values.name,
      description: values.description,
      eventTypeCodes: compiled.eventTypeCodes,
      dimensions: compiled.dimensions,
      windowDays: compiled.windowDays,
      sliceGranularity: compiled.sliceGranularity,
      accScript: compiled.accScript,
      defaultValueStrategy: compiled.defaultValueStrategy,
      templateType,
      templateConfig: compiled.templateConfig,
    };
    if (editing) return base;
    if (!values.refName?.trim()) {
      message.error('请输入指标编码');
      return null;
    }
    return { refName: values.refName.trim(), ...base };
  };

  const doSave = async () => {
    const body = buildSaveBody();
    if (!body) return;
    setSaving(true);
    setScriptError(null);
    try {
      if (editing?.id != null) {
        await updateIndicatorDefinition(editing.id, body as UpdateIndicatorBody);
      } else {
        await createIndicatorDefinition(body as CreateIndicatorBody);
      }
      message.success(editing ? '指标已更新' : '指标已创建');
      onSaved();
      onBack();
    } catch (err) {
      const apiErr = err as ApiError;
      const fields = toFieldErrors(apiErr);
      if (fields.accScript) {
        setScriptError({ message: fields.accScript });
        setAdvancedOpen(true);
      } else {
        message.error(apiErr.message ?? '保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  const refNameForQuery = editing?.refName;
  const { data: editReferences = [] } = useQuery({
    queryKey: ['indicator-references', refNameForQuery],
    queryFn: () => listIndicatorReferences(refNameForQuery!),
    enabled: !!refNameForQuery,
  });
  const { data: definitionSnapshots = [] } = useQuery({
    queryKey: ['indicator-definition-snapshots', editing?.id],
    queryFn: () => listIndicatorDefinitionSnapshots(editing!.id),
    enabled: editing?.id != null,
  });

  const handleRollback = async () => {
    if (!editing?.id) return;
    try {
      await rollbackIndicatorDefinition(editing.id);
      message.success('已回退到上一版定义');
      onSaved();
    } catch (err) {
      message.error((err as ApiError).message ?? '回退失败');
    }
  };

  const handleSave = async () => {
    try {
      await form.validateFields();
    } catch {
      return;
    }
    const refName = editing?.refName ?? form.getFieldValue('refName');
    if (!refName) {
      doSave();
      return;
    }
    try {
      const references = await listIndicatorReferences(refName);
      if (!references.length) {
        doSave();
        return;
      }
      confirmIndicatorUpdate({
        refName,
        references: references.map((label, i) => ({ label, ruleId: i })),
        onConfirm: doSave,
      });
    } catch {
      doSave();
    }
  };

  const renderStatsForm = () => (
    <>
      <IndicatorStepTimeline
        steps={[
          {
            key: 'scope',
            label: '计算数据范围',
            required: true,
            content: (
              <Space.Compact style={{ width: '100%', maxWidth: 520 }}>
                <Select
                  value="FACT_TABLE"
                  disabled
                  style={{ width: '38%' }}
                  options={[{ label: '事实表数据', value: 'FACT_TABLE' }]}
                />
                <Form.Item name="eventTypeCodes" noStyle rules={[{ required: true, message: '请选择事件' }]}>
                  <Select
                    mode="multiple"
                    placeholder="请选择适用事件"
                    options={eventSelectOptions}
                    style={{ width: '62%' }}
                    optionFilterProp="label"
                    maxTagCount="responsive"
                  />
                </Form.Item>
              </Space.Compact>
            ),
          },
        ]}
      />
      <div style={{ marginTop: 4 }}>
        <StatsStepperFields
          fieldOptions={fieldOptions}
          fieldsLoading={fieldsLoading}
          showObject={templateType !== 'COUNT'}
          defaultAgg={
            templateType === 'AMOUNT' ? 'SUM' : templateType === 'ASSOC_STATS' ? 'DISTINCT_COUNT' : 'COUNT'
          }
        />
      </div>
      <div style={{ marginLeft: 34, marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          过滤条件（可选）
        </Text>
        <Form.List name="filters">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...rest }) => (
                <Space key={key} align="baseline" style={{ display: 'flex', marginTop: 10 }} wrap>
                  <Form.Item {...rest} name={[name, 'field']} rules={[{ required: true, message: '字段' }]}>
                    <Select placeholder="字段" options={fieldOptions} style={{ width: 150 }} />
                  </Form.Item>
                  <Form.Item {...rest} name={[name, 'operator']}>
                    <Select options={FILTER_OPERATOR_OPTIONS} style={{ width: 108 }} />
                  </Form.Item>
                  <Form.Item {...rest} name={[name, 'value']}>
                    <Input placeholder="值" style={{ width: 120 }} />
                  </Form.Item>
                  <MinusCircleOutlined style={{ color: '#ff4d4f' }} onClick={() => remove(name)} />
                </Space>
              ))}
              <Button
                type="dashed"
                onClick={() => add({ operator: 'GT' })}
                icon={<PlusOutlined />}
                size="small"
                style={{ marginTop: 10 }}
              >
                添加过滤条件
              </Button>
            </>
          )}
        </Form.List>
        <Form.Item name="includeCurrentTxn" valuePropName="checked" style={{ marginTop: 12, marginBottom: 0 }}>
          <Checkbox>统计当前交易</Checkbox>
        </Form.Item>
      </div>
    </>
  );

  const renderOtherForm = () => {
    switch (templateType) {
      case 'RATIO':
        return (
          <>
            <Form.Item name="eventTypeCodes" label="适用事件" rules={[{ required: true }]}>
              <Select mode="multiple" options={eventSelectOptions} optionFilterProp="label" />
            </Form.Item>
            <Form.Item name="dimension" label="维度" rules={[{ required: true }]}>
              <Select options={fieldOptions} loading={fieldsLoading} />
            </Form.Item>
            <Space>
              <Form.Item name="timeValue" label="时间" rules={[{ required: true }]}>
                <InputNumber min={1} />
              </Form.Item>
              <Form.Item name="timeUnit" label="单位" rules={[{ required: true }]}>
                <Select options={TIME_UNIT_OPTIONS} style={{ width: 100 }} />
              </Form.Item>
            </Space>
            <Form.Item name="numeratorField" label="分子字段" rules={[{ required: true }]}>
              <Select options={fieldOptions} />
            </Form.Item>
            <Form.Item name="denominatorField" label="分母字段" rules={[{ required: true }]}>
              <Select options={fieldOptions} />
            </Form.Item>
          </>
        );
      case 'DATA_FETCH':
        return (
          <>
            <Form.Item name="eventTypeCodes" label="适用事件" rules={[{ required: true }]}>
              <Select mode="multiple" options={eventSelectOptions} />
            </Form.Item>
            <Form.Item name="dimension" label="维度" rules={[{ required: true }]}>
              <Select options={fieldOptions} />
            </Form.Item>
            <Form.Item name="targetField" label="取数字段" rules={[{ required: true }]}>
              <Select options={fieldOptions} />
            </Form.Item>
          </>
        );
      case 'LIST':
        return (
          <>
            <Form.Item name="eventTypeCodes" label="适用事件" rules={[{ required: true }]}>
              <Select mode="multiple" options={eventSelectOptions} />
            </Form.Item>
            <Form.Item name="dimension" label="维度" rules={[{ required: true }]}>
              <Select options={fieldOptions} />
            </Form.Item>
            <Form.Item name="field" label="字段" rules={[{ required: true }]}>
              <Select options={fieldOptions} />
            </Form.Item>
            <Form.Item name="listType" label="名单类型" rules={[{ required: true }]}>
              <Select
                options={[
                  { label: '黑名单', value: 'BLACK' },
                  { label: '白名单', value: 'WHITE' },
                  { label: '关注名单', value: 'WATCH' },
                ]}
              />
            </Form.Item>
          </>
        );
      case 'TIME_DIFF':
      case 'DISTANCE_DIFF':
        return (
          <>
            <Form.Item name="eventTypeCodes" label="适用事件" rules={[{ required: true }]}>
              <Select mode="multiple" options={eventSelectOptions} />
            </Form.Item>
            <Form.Item name="dimension" label="维度" rules={[{ required: true }]}>
              <Select options={fieldOptions} />
            </Form.Item>
            <Form.Item name="leftField" label="左侧对象" rules={[{ required: true }]}>
              <Select options={fieldOptions} />
            </Form.Item>
            <Form.Item name="rightField" label="右侧对象" rules={[{ required: true }]}>
              <Select options={fieldOptions} />
            </Form.Item>
          </>
        );
      case 'ASSOC_2D':
        return (
          <>
            <Form.Item name="eventTypeCodes" label="适用事件" rules={[{ required: true }]}>
              <Select mode="multiple" options={eventSelectOptions} />
            </Form.Item>
            <Form.Item name="dimension" label="维度" rules={[{ required: true }]}>
              <Select options={fieldOptions} />
            </Form.Item>
            <Space>
              <Form.Item name="timeValue" label="时间" rules={[{ required: true }]}>
                <InputNumber min={1} />
              </Form.Item>
              <Form.Item name="timeUnit" label="单位" rules={[{ required: true }]}>
                <Select options={TIME_UNIT_OPTIONS} style={{ width: 100 }} />
              </Form.Item>
            </Space>
            <Form.Item name="primaryAssocField" label="关联对象" rules={[{ required: true }]}>
              <Select options={fieldOptions} />
            </Form.Item>
            <Form.Item name="secondaryAssocField" label="二次关联对象" rules={[{ required: true }]}>
              <Select options={fieldOptions} />
            </Form.Item>
            <Form.Item name="aggregateFunction" label="计算函数" rules={[{ required: true }]}>
              <Select options={AGGREGATE_FUNCTION_OPTIONS} />
            </Form.Item>
          </>
        );
      default:
        return (
          <>
            <Form.Item name="eventTypeCodes" label="适用事件" rules={[{ required: true }]}>
              <Select mode="multiple" options={eventSelectOptions} />
            </Form.Item>
            <Form.Item name="dimension" label="维度" rules={[{ required: true }]}>
              <Select options={fieldOptions} />
            </Form.Item>
            <Space>
              <Form.Item name="timeValue" label="时间" rules={[{ required: true }]}>
                <InputNumber min={1} />
              </Form.Item>
              <Form.Item name="timeUnit" label="单位" rules={[{ required: true }]}>
                <Select options={TIME_UNIT_OPTIONS} style={{ width: 100 }} />
              </Form.Item>
            </Space>
            <Form.Item name="expression" label="运算表达式" rules={[{ required: true }]}>
              <Input.TextArea rows={3} placeholder="如 current + amount - avgAmount" />
            </Form.Item>
          </>
        );
    }
  };

  const compiledPreview = compileTemplate(
    templateType,
    { ...defaultTemplateConfig(templateType), ...form.getFieldsValue(true) } as IndicatorTemplateConfig,
  );

  return (
    <>
      <Form form={form} layout="vertical" requiredMark={false}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Space wrap align="start">
            {!editing ? (
              <>
                <Form.Item
                  label="指标编码"
                  name="refName"
                  rules={[
                    { required: true, message: '请输入指标编码' },
                    { pattern: /^[A-Za-z0-9_]+$/, message: '仅允许字母数字下划线' },
                  ]}
                  style={{ marginBottom: 0 }}
                >
                  <Input placeholder="如 txn_cnt_1h" style={{ width: 180 }} />
                </Form.Item>
                <Form.Item label="指标名称" name="name" style={{ marginBottom: 0 }}>
                  <Input placeholder="展示名称" style={{ width: 180 }} />
                </Form.Item>
              </>
            ) : (
              <>
                <div style={{ lineHeight: '32px' }}>
                  <Text type="secondary">编码 </Text>
                  <Text strong>{editing.refName}</Text>
                </div>
                <Form.Item label="指标名称" name="name" style={{ marginBottom: 0 }}>
                  <Input placeholder="展示名称" style={{ width: 180 }} />
                </Form.Item>
              </>
            )}
          </Space>
          <Space wrap>
            {editing && definitionSnapshots.length >= 2 ? (
              <Popconfirm
                title="确认回退到上一版定义？"
                description="将恢复最近一次更新前的定义内容（不含上下线状态）。"
                onConfirm={handleRollback}
              >
                <Button>回退上一版</Button>
              </Popconfirm>
            ) : null}
            <Button onClick={onBack}>取消</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              保存
            </Button>
          </Space>
        </div>

        {editing && editReferences.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={`该指标被引用：${editReferences.join('、')}`}
            description="删除或下线将被阻断；更新前请确认影响范围。"
          />
        ) : null}

        <Form.Item label="备注" name="description">
          <Input.TextArea rows={2} placeholder="指标说明（ID1）" maxLength={512} showCount />
        </Form.Item>

        <TemplateConfigShell
          template={templateMeta}
          preview={preview}
          headerExtra={
            <Space>
              <Button icon={<SettingOutlined />} onClick={() => setAdvancedOpen((v) => !v)}>
                高级配置
              </Button>
              <Button icon={<SwapOutlined />} onClick={() => setPickerOpen(true)}>
                切换模板
              </Button>
            </Space>
          }
        >
          {isStats ? renderStatsForm() : renderOtherForm()}
        </TemplateConfigShell>

        {advancedOpen ? (
          <div
            style={{
              marginTop: 24,
              border: `1px solid ${INDICATOR_THEME.panelBorder}`,
              borderRadius: 8,
              padding: 16,
              background: '#fafafa',
            }}
          >
            <Text strong>高级配置：累计脚本</Text>
            <div style={{ marginTop: 12 }}>
              <RuleExpressionEditor
                value={accScriptOverride || compiledPreview.accScript}
                onChange={setAccScriptOverride}
                fields={[{ name: 'current', source: 'context', detail: '当前累计值' }]}
                error={scriptError}
                placeholder="自动生成，可手工覆盖"
              />
            </div>
          </div>
        ) : null}
      </Form>

      <TemplatePickerModal open={pickerOpen} onCancel={() => setPickerOpen(false)} onSelect={switchTemplate} />
    </>
  );
}