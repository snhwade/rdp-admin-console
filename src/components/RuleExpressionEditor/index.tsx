import { useMemo } from 'react';
import CodeMirror, { type Extension } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { Alert, Space, Tag, Typography } from 'antd';
import { aviator } from './aviator';
import type { EditorField, ExpressionError } from '../types';

const { Text } = Typography;

export interface RuleExpressionEditorProps {
  /** 当前表达式内容（受控）。 */
  value: string;
  /** 内容变更回调。 */
  onChange?: (value: string) => void;
  /**
   * 可补全字段集合：来自指标定义引用名与事件上下文声明。
   * 同时用于「未声明字段」高亮的判定基准。
   */
  fields?: EditorField[];
  /**
   * 后端返回的表达式错误（语法错误位置/描述 或 未声明字段名）。
   * 传入后会在编辑器内通过 lint 下划线标注，并在编辑器下方汇总展示。
   */
  error?: ExpressionError | null;
  /** 是否只读。 */
  readOnly?: boolean;
  /** 编辑器高度（默认 200px）。 */
  height?: string;
  /** 占位提示。 */
  placeholder?: string;
  /** 测试与可访问性标识。 */
  'data-testid'?: string;
}

/**
 * 将行列号转换为文档内的字符偏移（0 基）。
 * line/column 均为 1 基。
 */
function lineColumnToOffset(doc: string, line: number, column: number): number {
  const lines = doc.split('\n');
  let offset = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 为换行符
  }
  offset += Math.max(0, column - 1);
  return Math.min(offset, doc.length);
}

/**
 * 根据后端错误信息计算编辑器内的诊断范围。
 * 支持三种定位方式：字符偏移 position、行列 line/column、未声明字段名匹配。
 */
function buildDiagnostics(doc: string, error?: ExpressionError | null): Diagnostic[] {
  if (!error || !doc) return [];
  const diagnostics: Diagnostic[] = [];

  // 1) 未声明字段：在文本中定位每个字段名并逐处标注（R3.6 / R7.x）
  if (error.undeclaredFields && error.undeclaredFields.length > 0) {
    for (const field of error.undeclaredFields) {
      if (!field) continue;
      const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // 使用单词边界，避免匹配到子串
      const regex = new RegExp(`(?<![\\w$.])${escaped}(?![\\w$.])`, 'g');
      let match: RegExpExecArray | null;
      let found = false;
      while ((match = regex.exec(doc)) != null) {
        found = true;
        diagnostics.push({
          from: match.index,
          to: match.index + field.length,
          severity: 'error',
          message: `未声明字段：${field}`,
        });
      }
      // 兜底：未在文本中定位到时，标注整段
      if (!found) {
        diagnostics.push({
          from: 0,
          to: doc.length,
          severity: 'error',
          message: `未声明字段：${field}`,
        });
      }
    }
    return diagnostics;
  }

  // 2) 语法错误：优先使用字符偏移，其次行列号
  let from: number | undefined;
  if (typeof error.position === 'number' && error.position >= 0) {
    from = Math.min(error.position, doc.length);
  } else if (typeof error.line === 'number') {
    from = lineColumnToOffset(doc, error.line, error.column ?? 1);
  }

  if (typeof from === 'number') {
    // 标注从错误位置到该词末尾；若无可标注词则标注单个字符
    const rest = doc.slice(from);
    const tokenMatch = /^[\w$.]+/.exec(rest);
    const to = tokenMatch ? from + tokenMatch[0].length : Math.min(from + 1, doc.length);
    diagnostics.push({
      from,
      to: Math.max(to, from + 1) > doc.length ? doc.length : Math.max(to, from + 1),
      severity: 'error',
      message: error.message ?? '表达式语法错误',
    });
  } else if (error.message) {
    // 无位置信息时整段标注
    diagnostics.push({
      from: 0,
      to: doc.length || 1,
      severity: 'error',
      message: error.message,
    });
  }

  return diagnostics;
}

/**
 * 规则 / 累计脚本表达式编辑器（R3.10、R3.12、R7.7、R7.8）。
 *
 * 基于 CodeMirror，提供：
 * - Aviator 语法高亮；
 * - 字段自动补全（从指标定义引用名 / 事件上下文声明拉取）；
 * - 保存时回显后端返回的语法错误位置/描述与未声明字段名，并保留已编辑内容。
 */
export default function RuleExpressionEditor({
  value,
  onChange,
  fields = [],
  error,
  readOnly = false,
  height = '200px',
  placeholder = '请输入 Aviator 表达式，例如：txn_cnt_7d > 10 && amount > 1000',
  'data-testid': testId = 'rule-expression-editor',
}: RuleExpressionEditorProps) {
  // 语言支持依赖字段集合，仅在字段变化时重建
  const extensions = useMemo<Extension[]>(() => {
    const exts: Extension[] = [aviator(fields), lintGutter(), EditorView.lineWrapping];
    return exts;
  }, [fields]);

  // 错误诊断作为独立扩展，随 error / value 变化重建
  const lintExtension = useMemo<Extension>(() => {
    return linter((view) => buildDiagnostics(view.state.doc.toString(), error));
  }, [error]);

  const allExtensions = useMemo<Extension[]>(
    () => [...extensions, lintExtension],
    [extensions, lintExtension],
  );

  const hasUndeclared = !!error?.undeclaredFields && error.undeclaredFields.length > 0;

  return (
    <div data-testid={testId}>
      <CodeMirror
        value={value}
        height={height}
        readOnly={readOnly}
        editable={!readOnly}
        placeholder={placeholder}
        extensions={allExtensions}
        onChange={(v) => onChange?.(v)}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: !readOnly,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
        }}
      />
      {error && (
        <Alert
          style={{ marginTop: 8 }}
          type="error"
          showIcon
          data-testid={`${testId}-error`}
          message={hasUndeclared ? '存在未声明字段' : '表达式语法错误'}
          description={
            hasUndeclared ? (
              <Space size={[4, 4]} wrap>
                <Text type="secondary">未声明字段：</Text>
                {error!.undeclaredFields!.map((f) => (
                  <Tag color="red" key={f}>
                    {f}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Space direction="vertical" size={2}>
                {(error!.line != null || error!.position != null) && (
                  <Text type="secondary">
                    位置：
                    {error!.line != null
                      ? `第 ${error!.line} 行${error!.column != null ? ` 第 ${error!.column} 列` : ''}`
                      : `偏移 ${error!.position}`}
                  </Text>
                )}
                <Text>{error!.message ?? '表达式无法被解析'}</Text>
              </Space>
            )
          }
        />
      )}
    </div>
  );
}

export { aviator } from './aviator';
