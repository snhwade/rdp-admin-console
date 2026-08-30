import {
  LanguageSupport,
  StreamLanguage,
  type StreamParser,
} from '@codemirror/language';
import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import type { EditorField } from '../types';

/**
 * Aviator 表达式的 CodeMirror 语言支持。
 *
 * Aviator 是一款轻量级 Java 表达式引擎（com.googlecode.aviator），其表达式语法
 * 与常见 C 风格表达式接近：支持 && || ! 等逻辑运算、+ - * / % 等算术运算、
 * 比较运算、三元运算、字符串字面量、数字字面量与函数调用。
 *
 * 这里使用 StreamLanguage 实现一个轻量的词法高亮器（无需引入完整 Lezer 语法），
 * 配合自动补全与错误回显（错误回显由 RuleExpressionEditor 通过 lint 扩展注入）。
 */

/** Aviator 常用关键字 / 字面量。 */
const AVIATOR_KEYWORDS = new Set([
  'true',
  'false',
  'nil',
  'null',
  'if',
  'else',
  'elsif',
  'for',
  'while',
  'return',
  'let',
  'fn',
  'lambda',
  'in',
  'use',
  'break',
  'continue',
]);

/** Aviator 内建函数（用于高亮与补全）。 */
export const AVIATOR_BUILTIN_FUNCTIONS = [
  'string.length',
  'string.contains',
  'string.startsWith',
  'string.endsWith',
  'string.substring',
  'string.indexOf',
  'string.split',
  'string.join',
  'string.replace_all',
  'string.replace_first',
  'math.abs',
  'math.round',
  'math.floor',
  'math.ceil',
  'math.sqrt',
  'math.pow',
  'math.max',
  'math.min',
  'sysdate',
  'now',
  'long',
  'double',
  'str',
  'boolean',
  'date_to_string',
  'string_to_date',
  'seq.map',
  'seq.filter',
  'seq.count',
  'include',
  'is_def',
];

/** 运算符字符集合。 */
const OPERATOR_CHARS = '+-*/%=!<>&|?:^~';

/**
 * Aviator 流式词法解析器（用于语法高亮）。
 * 识别注释、字符串、数字、运算符、关键字与标识符。
 */
const aviatorStreamParser: StreamParser<unknown> = {
  token(stream) {
    // 跳过空白
    if (stream.eatSpace()) return null;

    // 单行注释 # 或 //
    if (stream.match('//') || stream.match('#')) {
      stream.skipToEnd();
      return 'comment';
    }

    // 块注释 /* ... */
    if (stream.match('/*')) {
      while (!stream.eol()) {
        if (stream.match('*/')) break;
        stream.next();
      }
      return 'comment';
    }

    const ch = stream.peek();
    if (ch == null) {
      stream.next();
      return null;
    }

    // 字符串字面量（单引号 / 双引号）
    if (ch === '"' || ch === "'") {
      stream.next();
      let escaped = false;
      let c: string | void;
      while ((c = stream.next()) != null) {
        if (c === ch && !escaped) break;
        escaped = !escaped && c === '\\';
      }
      return 'string';
    }

    // 数字字面量（含小数）
    if (/\d/.test(ch)) {
      stream.eatWhile(/[\d._]/);
      // 科学计数法与类型后缀
      stream.eatWhile(/[eE+\-0-9NLDM]/);
      return 'number';
    }

    // 标识符 / 关键字 / 函数名（允许 . 形成 string.length 等命名空间函数）
    if (/[A-Za-z_$]/.test(ch)) {
      stream.eatWhile(/[A-Za-z0-9_$.]/);
      const word = stream.current();
      if (AVIATOR_KEYWORDS.has(word)) return 'keyword';
      // 后接 ( 视为函数调用
      const after = stream.peek();
      if (after === '(') return 'function';
      return 'variableName';
    }

    // 运算符
    if (OPERATOR_CHARS.includes(ch)) {
      stream.eatWhile((c: string) => OPERATOR_CHARS.includes(c));
      return 'operator';
    }

    // 括号与分隔符
    if ('()[]{},;'.includes(ch)) {
      stream.next();
      return 'punctuation';
    }

    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: '//' },
  },
};

/** Aviator StreamLanguage 实例。 */
export const aviatorLanguage = StreamLanguage.define(aviatorStreamParser);

/** 触发补全的标识符正则（允许命名空间点号）。 */
const COMPLETION_WORD = /[\w$.]*/;

/**
 * 构建 Aviator 自动补全源：合并字段（指标引用名 / 事件上下文字段）、
 * 关键字与内建函数。
 */
export function aviatorCompletionSource(fields: EditorField[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(COMPLETION_WORD);
    // 未显式触发且无输入前缀时不弹出补全
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    const options: Completion[] = [];

    // 1) 字段补全（指标引用名 / 事件上下文字段）
    for (const field of fields) {
      const isIndicator = field.source === 'indicator';
      options.push({
        label: field.name,
        type: isIndicator ? 'variable' : 'property',
        detail: field.detail ?? (isIndicator ? '指标' : field.source === 'context' ? '上下文' : undefined),
        info: field.info,
        boost: isIndicator ? 2 : 1,
      });
    }

    // 2) 内建函数补全
    for (const fn of AVIATOR_BUILTIN_FUNCTIONS) {
      options.push({
        label: fn,
        type: 'function',
        detail: '函数',
        apply: `${fn}()`,
      });
    }

    // 3) 关键字 / 字面量补全
    for (const kw of AVIATOR_KEYWORDS) {
      options.push({ label: kw, type: 'keyword' });
    }

    return {
      from: word.from,
      options,
      // 输入前缀变化时仍可继续过滤
      validFor: COMPLETION_WORD,
    };
  };
}

/**
 * 返回 Aviator 语言支持扩展（高亮 + 补全）。
 * @param fields 可补全字段集合（指标引用名 / 事件上下文字段）。
 */
export function aviator(fields: EditorField[] = []): LanguageSupport {
  return new LanguageSupport(aviatorLanguage, [
    aviatorLanguage.data.of({
      autocomplete: aviatorCompletionSource(fields),
    }),
    autocompletion(),
  ]);
}
