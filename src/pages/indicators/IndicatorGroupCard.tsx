import { Dropdown, Typography } from 'antd';
import { LineChartOutlined, MoreOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { IndicatorGroupCardView } from '@/api/config';
import type { ScenarioTreeNode } from '@/api/console';
import { formatGroupEventLines, summarizeGroupEvents } from './groupEventLabels';

const { Text } = Typography;

interface Props {
  group: IndicatorGroupCardView;
  scenarioTree: ScenarioTreeNode[];
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/** 指标分组卡片（对齐参考图：图标 + 名称 + 机构 + 事件 + 上下线统计）。 */
export default function IndicatorGroupCard({ group, scenarioTree, onOpen, onEdit, onDelete }: Props) {
  const eventSummary = summarizeGroupEvents(formatGroupEventLines(group.eventTypeCodes ?? [], scenarioTree));
  const menuItems: MenuProps['items'] = [];
  if (onEdit && group.id != null) {
    menuItems.push({ key: 'edit', label: '编辑分组' });
  }
  if (onDelete && group.id != null) {
    menuItems.push({ key: 'delete', label: '删除分组', danger: true });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{
        background: '#fff',
        border: '1px solid #eceef2',
        borderRadius: 8,
        padding: 16,
        height: '100%',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 168,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,23,42,0.08)';
        e.currentTarget.style.borderColor = '#91caff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = '#eceef2';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', gap: 12, minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <LineChartOutlined style={{ color: '#fff', fontSize: 20 }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text strong style={{ fontSize: 16, display: 'block' }} ellipsis>
              {group.name}
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {group.orgName || '总部'}
            </Text>
            <Text
              type="secondary"
              style={{ fontSize: 12, display: 'block', marginTop: 6, lineHeight: 1.5 }}
              ellipsis={{ tooltip: eventSummary }}
            >
              {eventSummary}
            </Text>
          </div>
        </div>
        {menuItems.length ? (
          <Dropdown
            menu={{
              items: menuItems,
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                if (key === 'edit') onEdit?.();
                if (key === 'delete') onDelete?.();
              },
            }}
            trigger={['click']}
          >
            <MoreOutlined
              style={{ fontSize: 18, color: '#8c8c8c', padding: 4 }}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 'auto',
          paddingTop: 14,
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          gap: 20,
          fontSize: 13,
        }}
      >
        <span>
          <span style={{ color: '#52c41a', marginRight: 6 }}>●</span>
          上线 {group.onlineCount ?? 0}
        </span>
        <span>
          <span style={{ color: '#fa8c16', marginRight: 6 }}>●</span>
          下线 {group.offlineCount ?? 0}
        </span>
      </div>
    </div>
  );
}
