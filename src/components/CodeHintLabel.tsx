import { Input, Tooltip } from 'antd';
import type { InputProps } from 'antd';

export interface CodeHintLabelProps {
  /** 主展示名称。 */
  name: string;
  /** 悬浮展示的编码。 */
  code?: string | null;
  /** 名称前前缀，如「事件字段：」。 */
  prefix?: string;
}

/** 默认只展示名称，编码在鼠标悬浮时通过 Tooltip 显示。 */
export function CodeHintLabel({ name, code, prefix = '' }: CodeHintLabelProps) {
  const text = `${prefix}${name}`;
  if (!code?.trim()) {
    return <span>{text}</span>;
  }
  return (
    <Tooltip title={code} mouseEnterDelay={0.3}>
      <span>{text}</span>
    </Tooltip>
  );
}

/** 只读输入框：展示名称，编码悬浮可见。 */
export function CodeHintReadonlyInput({
  name,
  code,
  ...rest
}: { name?: string; code?: string | null } & InputProps) {
  const input = <Input value={name ?? ''} disabled {...rest} />;
  if (!code?.trim()) {
    return input;
  }
  return (
    <Tooltip title={code} mouseEnterDelay={0.3}>
      {input}
    </Tooltip>
  );
}

/** Select 选项：label 仅名称，title 为编码（浏览器原生悬浮提示）。 */
export function codeHintSelectOption<T extends string | number>(
  value: T,
  name: string,
  code?: string | null,
) {
  return {
    value,
    label: name,
    title: code?.trim() || undefined,
  };
}

/** @deprecated 使用 CodeHintLabel */
export default function TreeNodeWithCodeHint({
  label,
  code,
}: {
  label: string;
  code?: string | null;
}) {
  return <CodeHintLabel name={label} code={code} />;
}
