import { Modal } from 'antd';
import TemplatePickerPanel from './TemplatePickerPanel';
import type { IndicatorTemplateType } from './templates';

interface Props {
  open: boolean;
  onCancel: () => void;
  onSelect: (type: IndicatorTemplateType) => void;
}

/** 切换模版弹窗（复用卡片墙组件）。 */
export default function TemplatePickerModal({ open, onCancel, onSelect }: Props) {
  return (
    <Modal
      title="选择指标模版"
      open={open}
      onCancel={onCancel}
      footer={null}
      width="92%"
      style={{ top: 24, maxWidth: 1280 }}
      styles={{ body: { maxHeight: 'calc(100vh - 140px)', overflow: 'auto', paddingTop: 8 } }}
      destroyOnClose
    >
      <TemplatePickerPanel
        onSelect={(type) => {
          onSelect(type);
          onCancel();
        }}
      />
    </Modal>
  );
}
