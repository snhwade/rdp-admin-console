import { Col, Row, Typography } from 'antd';
import { useState } from 'react';
import TemplateCard from './TemplateCard';
import {
  INDICATOR_TEMPLATE_GROUPS,
  type IndicatorTemplateType,
} from './templates';
import { INDICATOR_THEME } from './indicatorStyles';

const { Text } = Typography;

interface Props {
  onSelect: (type: IndicatorTemplateType) => void;
}

function GroupTitle({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span
        style={{
          width: 4,
          height: 16,
          borderRadius: 2,
          background: INDICATOR_THEME.sectionBar,
          flexShrink: 0,
        }}
      />
      <Text strong style={{ fontSize: 15 }}>
        {title}
      </Text>
    </div>
  );
}

/** 指标模版选择区（全宽内嵌，对齐参考图卡片墙）。 */
export default function TemplatePickerPanel({ onSelect }: Props) {
  const [hovered, setHovered] = useState<IndicatorTemplateType | null>(null);

  return (
    <div>
      {INDICATOR_TEMPLATE_GROUPS.map((group) => (
        <div key={group.key} style={{ marginBottom: 32 }}>
          <GroupTitle title={group.title} />
          <Row gutter={[16, 16]}>
            {group.templates.map((template) => (
              <Col key={template.type} xs={24} sm={12} lg={8} xl={6}>
                <TemplateCard
                  template={template}
                  active={hovered === template.type}
                  onHover={(active) => setHovered(active ? template.type : null)}
                  onUse={() => onSelect(template.type)}
                />
              </Col>
            ))}
          </Row>
        </div>
      ))}
    </div>
  );
}
