import { Button, Typography } from 'antd';
import type { IndicatorTemplateMeta } from './templates';
import { INDICATOR_THEME, templateCardStyle } from './indicatorStyles';

const { Text, Paragraph } = Typography;

interface Props {
  template: IndicatorTemplateMeta;
  active: boolean;
  onHover: (active: boolean) => void;
  onUse: () => void;
}

/** 指标模版卡片（悬停高亮 + 立即使用）。 */
export default function TemplateCard({ template, active, onHover, onUse }: Props) {
  return (
    <div
      style={templateCardStyle(active)}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div
        style={{
          background: active ? INDICATOR_THEME.cardHeaderHoverBg : INDICATOR_THEME.cardHeaderBg,
          color: '#fff',
          padding: '10px 16px',
          fontWeight: 600,
          fontSize: 15,
          transition: 'background 0.2s ease',
        }}
      >
        {template.name}
      </div>
      <div style={{ padding: '14px 16px 48px', background: '#fff', position: 'relative', minHeight: 210 }}>
        <Paragraph style={{ marginBottom: 10, fontSize: 13, color: INDICATOR_THEME.muted }}>
          <Text style={{ color: '#595959' }}>模板格式：</Text>
          {template.format}
        </Paragraph>
        <Text style={{ fontSize: 13, color: INDICATOR_THEME.muted }}>模板举例：</Text>
        {template.examples.map((ex, i) => (
          <Paragraph key={i} style={{ marginBottom: 6, marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
            <Text type="secondary">场景{i + 1}：</Text>
            {ex}
          </Paragraph>
        ))}
        {active ? (
          <Button
            type="primary"
            size="small"
            style={{ position: 'absolute', right: 16, bottom: 14 }}
            onClick={onUse}
          >
            立即使用
          </Button>
        ) : null}
      </div>
    </div>
  );
}
