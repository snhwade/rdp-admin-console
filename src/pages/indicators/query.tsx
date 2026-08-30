import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMutation, useQuery } from '@tanstack/react-query';
import { DatabaseOutlined, SearchOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { listIndicatorDefinitions, type IndicatorDefinitionView } from '@/api/config';
import { queryIndicator, type IndicatorValueView } from '@/api/indicators';
import type { ApiError } from '@/api/client';
import { INDICATOR_THEME } from './indicatorStyles';

const GRANULARITY_OPTIONS = [
  { value: 'MINUTE', label: '分钟 (MINUTE)' },
  { value: 'HOUR', label: '小时 (HOUR)' },
  { value: 'DAY', label: '天 (DAY)' },
];

const SOURCE_META: Record<string, { label: string; color: string }> = {
  REDIS: { label: 'Redis 热读', color: 'green' },
  ES: { label: 'ES 回退', color: 'blue' },
  DEFAULT: { label: '默认值', color: 'default' },
};

type QueryRow = IndicatorValueView & { key: string; error?: string };

function dimensionHint(def?: IndicatorDefinitionView): string {
  if (!def?.dimensions?.length) return '请输入维度键';
  if (def.dimensions.length === 1) {
    return `单维度「${def.dimensions[0]}」：维度键即该字段值，如商户号 M001`;
  }
  return `多维度：按 ${def.dimensions.map((d) => `${d}#值`).join(';')} 拼接（无结尾分号）`;
}

function formatValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function ResultCard({ row }: { row: QueryRow }) {
  if (row.error) {
    return (
      <Card size="small" title={row.refName} style={{ borderColor: '#ffccc7' }}>
        <Alert type="error" showIcon message={row.error} />
      </Card>
    );
  }

  const sourceMeta = SOURCE_META[row.source] ?? { label: row.source, color: 'default' };
  const latencyOk = row.elapsedMs <= 50;

  return (
    <Card
      size="small"
      title={
        <Space>
          <span>{row.refName}</span>
          {row.missing && <Tag color="orange">缺失</Tag>}
        </Space>
      }
      style={{
        borderColor: row.missing ? '#ffd591' : INDICATOR_THEME.primaryBorder,
        background: row.missing ? '#fffbe6' : '#fff',
      }}
    >
      <Row gutter={16} align="middle">
        <Col flex="auto">
          <Statistic
            title="当前值"
            value={row.value}
            formatter={() => formatValue(row.value)}
            valueStyle={{
              color: row.missing ? '#d48806' : INDICATOR_THEME.primary,
              fontSize: 28,
            }}
          />
        </Col>
        <Col>
          <Space direction="vertical" size={4} align="end">
            <Tag icon={<DatabaseOutlined />} color={sourceMeta.color}>
              {sourceMeta.label}
            </Tag>
            <Tooltip title="读取耗时目标 ≤50ms">
              <Tag icon={<ThunderboltOutlined />} color={latencyOk ? 'success' : 'warning'}>
                {row.elapsedMs} ms
              </Tag>
            </Tooltip>
          </Space>
        </Col>
      </Row>
      {row.missing && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          message="Redis 与 ES 均不可读，已返回 defaultValue；规则引擎会按 defaultValueStrategy 处理。"
        />
      )}
    </Card>
  );
}

export default function IndicatorQueryPage() {
  const [form] = Form.useForm();
  const [batchMode, setBatchMode] = useState(false);
  const [results, setResults] = useState<QueryRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedRef, setSelectedRef] = useState<string>();

  const { data: definitions = [], isLoading: defsLoading } = useQuery({
    queryKey: ['indicator-definitions', 'query'],
    queryFn: () => listIndicatorDefinitions({ status: 'ONLINE' }),
  });

  const selectedDef = useMemo(
    () => definitions.find((d) => d.refName === selectedRef),
    [definitions, selectedRef],
  );

  const onlineOptions = useMemo(
    () =>
      definitions.map((d) => ({
        value: d.refName,
        label: d.name ? `${d.refName}（${d.name}）` : d.refName,
      })),
    [definitions],
  );

  const queryMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const dimensionKey = String(values.dimensionKey ?? '').trim();
      const windowDays = Number(values.windowDays);
      const granularity = values.granularity as 'MINUTE' | 'HOUR' | 'DAY';
      const defaultValue = values.defaultValue != null ? Number(values.defaultValue) : undefined;
      const refName = String(values.refName ?? selectedRef ?? '').trim();

      if (!dimensionKey) {
        throw { message: '请输入维度键' } as ApiError;
      }

      const targets: IndicatorDefinitionView[] = batchMode
        ? definitions
        : (() => {
            const def = definitions.find((d) => d.refName === refName);
            return def ? [def] : [];
          })();

      if (targets.length === 0) {
        throw { message: batchMode ? '暂无上线指标可查询' : '请选择指标' } as ApiError;
      }

      const rows: QueryRow[] = [];
      for (const def of targets) {
        try {
          const r = await queryIndicator({
            refName: def.refName,
            dimensionKey,
            windowDays: batchMode ? def.windowDays : windowDays,
            granularity: batchMode ? def.sliceGranularity : granularity,
            defaultValue,
          });
          rows.push({ ...r, key: def.refName });
        } catch (err) {
          rows.push({
            key: def.refName,
            refName: def.refName,
            dimensionKey,
            value: 0,
            source: '-',
            missing: true,
            elapsedMs: 0,
            error: (err as ApiError).message ?? '查询失败',
          });
        }
      }
      return rows;
    },
    onSuccess: (rows) => {
      setResults(rows);
      setSearched(true);
      if (rows.some((r) => !r.error && !r.missing)) {
        message.success('查询完成');
      }
    },
    onError: (err: ApiError) => message.error(err.message ?? '查询失败'),
  });

  const onRefChange = (refName: string) => {
    setSelectedRef(refName);
    const def = definitions.find((d) => d.refName === refName);
    if (def) {
      form.setFieldsValue({
        windowDays: def.windowDays,
        granularity: def.sliceGranularity,
      });
    }
  };

  const onFinish = (values: Record<string, unknown>) => {
    queryMutation.mutate(values);
  };

  const onReset = () => {
    form.resetFields();
    setSelectedRef(undefined);
    setResults([]);
    setSearched(false);
  };

  const tableColumns: ColumnsType<QueryRow> = [
    { title: '指标', dataIndex: 'refName', key: 'refName', width: 160 },
    { title: '维度键', dataIndex: 'dimensionKey', key: 'dimensionKey', ellipsis: true },
    {
      title: '数值',
      dataIndex: 'value',
      key: 'value',
      width: 120,
      render: (v: number, r) => (r.error ? '-' : formatValue(v)),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 110,
      render: (s: string, r) =>
        r.error ? <Tag color="red">失败</Tag> : (
          <Tag color={SOURCE_META[s]?.color ?? 'default'}>{SOURCE_META[s]?.label ?? s}</Tag>
        ),
    },
    {
      title: '缺失',
      dataIndex: 'missing',
      key: 'missing',
      width: 72,
      render: (m: boolean, r) => (r.error ? '-' : m ? <Tag color="orange">是</Tag> : <Tag color="green">否</Tag>),
    },
    {
      title: '耗时',
      dataIndex: 'elapsedMs',
      key: 'elapsedMs',
      width: 88,
      render: (ms: number, r) => (r.error ? '-' : `${ms} ms`),
    },
    {
      title: '说明',
      key: 'error',
      ellipsis: true,
      render: (_, r) => r.error ?? (r.missing ? '两源不可读，已用默认值' : '-'),
    },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        指标查询
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        从指标存储（Redis 优先、ES 回退）读取当前窗口累计值，适用于联调 Flink 累计、规则引擎读指标与运维排查。
      </Typography.Paragraph>

      <Card title="查询条件" style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ windowDays: 1, granularity: 'DAY', defaultValue: 0 }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12} lg={8}>
              <Form.Item label="查询模式">
                <Space>
                  <Switch
                    checked={batchMode}
                    onChange={(v) => {
                      setBatchMode(v);
                      setResults([]);
                      setSearched(false);
                    }}
                  />
                  <span>{batchMode ? '批量：全部上线指标' : '单个指标'}</span>
                </Space>
              </Form.Item>
            </Col>
            {!batchMode && (
              <Col xs={24} md={12} lg={8}>
                <Form.Item
                  name="refName"
                  label="指标"
                  rules={[{ required: true, message: '请选择指标' }]}
                >
                  <Select
                    showSearch
                    allowClear
                    placeholder={defsLoading ? '加载中…' : '选择上线指标'}
                    options={onlineOptions}
                    loading={defsLoading}
                    optionFilterProp="label"
                    onChange={(v) => v && onRefChange(v)}
                  />
                </Form.Item>
              </Col>
            )}
            <Col xs={24} md={12} lg={8}>
              <Form.Item
                name="dimensionKey"
                label="维度键"
                rules={[{ required: true, message: '请输入维度键' }]}
                extra={dimensionHint(selectedDef)}
              >
                <Input placeholder="如 M001 或 merchantId#M001;country#CN" allowClear />
              </Form.Item>
            </Col>
            {!batchMode && (
              <>
                <Col xs={24} md={8} lg={4}>
                  <Form.Item
                    name="windowDays"
                    label="窗口（天）"
                    rules={[{ required: true, message: '必填' }]}
                  >
                    <InputNumber min={1} max={365} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8} lg={4}>
                  <Form.Item
                    name="granularity"
                    label="切片粒度"
                    rules={[{ required: true, message: '必选' }]}
                  >
                    <Select options={GRANULARITY_OPTIONS} />
                  </Form.Item>
                </Col>
              </>
            )}
            <Col xs={24} md={8} lg={4}>
              <Form.Item name="defaultValue" label="默认值">
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {selectedDef && !batchMode && (
            <Descriptions size="small" bordered column={{ xs: 1, sm: 2, md: 4 }} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="事件类型">
                {(selectedDef.eventTypeCodes ?? []).join(', ') || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="维度字段">
                {(selectedDef.dimensions ?? []).join(', ') || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="配置窗口">{selectedDef.windowDays} 天</Descriptions.Item>
              <Descriptions.Item label="配置粒度">{selectedDef.sliceGranularity}</Descriptions.Item>
            </Descriptions>
          )}

          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={queryMutation.isPending}>
              查询
            </Button>
            <Button onClick={onReset}>重置</Button>
          </Space>
        </Form>
      </Card>

      {searched && results.length === 0 && (
        <Card>
          <Empty description="无查询结果" />
        </Card>
      )}

      {results.length === 1 && !results[0].error && (
        <ResultCard row={results[0]} />
      )}

      {results.length === 1 && results[0].error && (
        <Alert type="error" showIcon message={results[0].error} />
      )}

      {results.length > 1 && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {results.map((row) => (
              <Col key={row.key} xs={24} sm={12} lg={8}>
                <ResultCard row={row} />
              </Col>
            ))}
          </Row>
          <Card title="明细列表" size="small">
            <Table
              rowKey="key"
              size="small"
              columns={tableColumns}
              dataSource={results}
              pagination={false}
            />
          </Card>
        </>
      )}

      {!searched && (
        <Card>
          <Empty description="选择指标并输入维度键后点击查询" />
        </Card>
      )}
    </div>
  );
}
