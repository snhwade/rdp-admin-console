import { ReactNode } from 'react';
import { Card, Col, Row, Typography } from 'antd';
import type { IndicatorTemplateMeta } from './templates';
import { INDICATOR_THEME } from './indicatorStyles';

const { Text, Paragraph, Title } = Typography;

interface Props {
  template: IndicatorTemplateMeta;
  preview: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}

/** 模版配置页：左侧步骤表单 + 右侧预览/示例（通用统计布局）。 */
export default function TemplateConfigShell({ template, preview, headerExtra, children }: Props) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          paddingBottom: 12,
          borderBottom: `1px solid ${INDICATOR_THEME.panelBorder}`,
        }}
      >
        <Title level={5} style={{ margin: 0 }}>
          <Text type="danger">* </Text>
          {template.name}
        </Title>
        {headerExtra}
      </div>
      <Row gutter={24} align="top">
        <Col xs={24} lg={15}>
          <div
            style={{
              background: '#fff',
              border: `1px solid ${INDICATOR_THEME.panelBorder}`,
              borderRadius: 8,
              padding: '20px 24px 8px',
            }}
          >
            {children}
          </div>
        </Col>
        <Col xs={24} lg={9}>
          <div style={{ position: 'sticky', top: 0 }}>
            <Card
              size="small"
              title="指标预览"
              styles={{
                header: { background: '#fafafa', fontWeight: 600 },
                body: {
                  background: INDICATOR_THEME.previewBg,
                  minHeight: 96,
                  borderTop: `1px solid ${INDICATOR_THEME.primaryBorder}`,
                },
              }}
              style={{ marginBottom: 16, borderColor: INDICATOR_THEME.primaryBorder }}
            >
              <Text style={{ fontSize: 14, lineHeight: 1.7, color: '#262626' }}>
                {preview || '请完善左侧配置，预览将在此实时生成'}
              </Text>
            </Card>
            <Card
              size="small"
              title="示例"
              styles={{ header: { background: '#fafafa', fontWeight: 600 } }}
              style={{ borderColor: INDICATOR_THEME.panelBorder }}
            >
              {template.examples.map((ex, i) => (
                <Paragraph key={i} style={{ marginBottom: 10, fontSize: 13, lineHeight: 1.65 }}>
                  <Text type="secondary">场景{i + 1}：</Text>
                  {ex}
                </Paragraph>
              ))}
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  );
}
