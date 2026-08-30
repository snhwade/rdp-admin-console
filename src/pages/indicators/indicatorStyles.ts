/** 指标页视觉常量（对齐指标模版 / 配置页）。 */
export const INDICATOR_THEME = {
  primary: '#1677ff',
  primaryLight: '#e6f4ff',
  primaryBorder: '#91caff',
  previewBg: '#f5f9ff',
  panelBorder: '#eceef2',
  sectionBar: '#1677ff',
  cardHeaderBg: '#1677ff',
  cardHeaderHoverBg: '#0958d9',
  muted: '#8c8c8c',
} as const;

export const templateCardStyle = (active: boolean) => ({
  height: '100%',
  borderRadius: 4,
  overflow: 'hidden' as const,
  border: active ? `1px solid ${INDICATOR_THEME.primary}` : `1px solid ${INDICATOR_THEME.panelBorder}`,
  boxShadow: active ? '0 4px 12px rgba(22,119,255,0.15)' : '0 1px 4px rgba(0,0,0,0.04)',
  transition: 'all 0.2s ease',
});
