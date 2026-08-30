import { Alert, Empty, Modal, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { IndicatorReference } from '../types';

const { Text } = Typography;

export interface IndicatorRefPickerProps {
  /** 被引用的指标定义引用名（用于提示文案）。 */
  refName?: string;
  /** 引用该指标的规则列表（R7.6 / R7.9）。 */
  references?: IndicatorReference[];
  /** 是否处于加载中。 */
  loading?: boolean;
  /** 测试与可访问性标识。 */
  'data-testid'?: string;
}

/** 引用规则表格列。 */
const referenceColumns: ColumnsType<IndicatorReference> = [
  {
    title: '引用位置',
    key: 'label',
    render: (_, r) => r.label ?? r.ruleName ?? r.ruleId ?? '-',
  },
  { title: '规则标识', dataIndex: 'ruleId', key: 'ruleId', render: (v) => v ?? '-' },
  {
    title: '规则名称',
    dataIndex: 'ruleName',
    key: 'ruleName',
    render: (v) => v ?? '-',
  },
  {
    title: '版本',
    dataIndex: 'ruleVersion',
    key: 'ruleVersion',
    render: (v) => (v != null ? `v${v}` : '-'),
  },
  {
    title: '事件类型',
    dataIndex: 'eventTypeCode',
    key: 'eventTypeCode',
    render: (v) => v ?? '-',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: string | undefined) =>
      status ? (
        <Tag color={status === 'ENABLED' || status === '启用' ? 'green' : 'default'}>{status}</Tag>
      ) : (
        '-'
      ),
  },
];

/**
 * 指标引用关系展示组件（R7.6 / R7.9）。
 *
 * 展示引用某指标定义的全部启用规则列表。配合 {@link confirmIndicatorUpdate}
 * 在更新被引用指标前弹出引用规则列表并要求确认。
 */
export default function IndicatorRefPicker({
  refName,
  references = [],
  loading = false,
  'data-testid': testId = 'indicator-ref-picker',
}: IndicatorRefPickerProps) {
  const hasRefs = references.length > 0;

  return (
    <div data-testid={testId}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {hasRefs ? (
          <Alert
            type="warning"
            showIcon
            message={
              <Text>
                指标
                {refName ? (
                  <Text strong>「{refName}」</Text>
                ) : null}
                正被 {references.length} 条规则引用，更新前请确认影响范围。
              </Text>
            }
          />
        ) : (
          <Alert type="info" showIcon message="当前指标未被任何启用规则引用，可安全更新。" />
        )}
        {hasRefs ? (
          <Table
            size="small"
            loading={loading}
            rowKey={(r) => String(r.label ?? r.ruleId ?? Math.random())}
            columns={referenceColumns}
            dataSource={references}
            pagination={false}
            data-testid={`${testId}-table`}
          />
        ) : (
          !loading && <Empty description="无引用规则" />
        )}
      </Space>
    </div>
  );
}

/** confirmIndicatorUpdate 的入参。 */
export interface ConfirmIndicatorUpdateOptions {
  /** 被更新的指标引用名。 */
  refName?: string;
  /** 引用该指标的规则列表。 */
  references: IndicatorReference[];
  /** 用户确认后的回调（执行真正的提交）。 */
  onConfirm: () => void;
  /** 用户取消后的回调（可选）。 */
  onCancel?: () => void;
}

/**
 * 更新被引用指标前的确认弹窗（R7.9）。
 *
 * 当指标被启用规则引用时，弹出引用规则列表并要求用户确认后再提交；
 * 未被引用时直接执行确认回调，避免无谓的二次确认。
 */
export function confirmIndicatorUpdate({
  refName,
  references,
  onConfirm,
  onCancel,
}: ConfirmIndicatorUpdateOptions): void {
  // 未被引用：无需确认，直接提交
  if (!references || references.length === 0) {
    onConfirm();
    return;
  }

  Modal.confirm({
    title: '该指标正被规则引用，确认更新？',
    width: 720,
    okText: '确认更新',
    cancelText: '取消',
    okButtonProps: { danger: true },
    content: <IndicatorRefPicker refName={refName} references={references} />,
    onOk: onConfirm,
    onCancel,
  });
}
