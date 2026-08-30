import type { ReactNode } from 'react';
import { Typography } from 'antd';
import { INDICATOR_THEME } from './indicatorStyles';

const { Text } = Typography;

export interface TimelineStep {
  key: string;
  label: ReactNode;
  required?: boolean;
  content: ReactNode;
}

interface Props {
  steps: TimelineStep[];
}

/** 竖向步骤时间线（维度 → 时间 → 对象 → 函数）。 */
export default function IndicatorStepTimeline({ steps }: Props) {
  return (
    <div style={{ paddingLeft: 4 }}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <div key={step.key} style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
            <div
              style={{
                width: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: INDICATOR_THEME.primary,
                  marginTop: 6,
                  flexShrink: 0,
                  boxShadow: '0 0 0 3px rgba(22,119,255,0.15)',
                }}
              />
              {!isLast ? (
                <div
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 28,
                    background: `linear-gradient(${INDICATOR_THEME.primary}, ${INDICATOR_THEME.primaryBorder})`,
                    marginTop: 4,
                    marginBottom: 4,
                  }}
                />
              ) : null}
            </div>
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 20, minWidth: 0 }}>
              <div style={{ marginBottom: 8, lineHeight: '22px' }}>
                {step.required ? <Text type="danger">* </Text> : null}
                <Text strong>{step.label}</Text>
              </div>
              {step.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
