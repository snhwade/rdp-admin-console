#!/usr/bin/env node
/**
 * 命名中性化构建期扫描器（risk-console-redesign）。
 *
 * 扫描本期新增的前端代码/资源（scripts/naming-scan.config.json 中的 scanRoots），
 * 命中厂商专有名词清单（vendorTerms 配置，大小写不敏感）即判定不通过，
 * 报告每个出现位置（文件:行:列 + 命中词 + 行内容）并以非零退出码失败。
 *
 * Validates: Requirements 1.1, 1.3, 1.4
 *
 * 使用：
 *   node scripts/naming-scan.mjs                 # 使用默认配置文件
 *   node scripts/naming-scan.mjs --config x.json # 指定配置文件
 *   npm run scan:naming                          # 经 package.json script
 *
 * 设计：核心匹配逻辑（findVendorTermHits / scanText）为纯函数并具名导出，
 * 供属性测试（任务 1.3，Property 1）复用，无需启动文件系统。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 默认厂商专有名词清单（大小写不敏感匹配；留空则跳过扫描）。 */
export const DEFAULT_VENDOR_TERMS = [];

/** 默认参与扫描的文件扩展名（代码与资源）。 */
const DEFAULT_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.css', '.scss', '.less', '.html', '.md', '.txt', '.svg',
];

/**
 * 在单行文本中查找所有厂商专有名词命中位置（大小写不敏感）。
 * @param {string} line 行文本
 * @param {string[]} terms 厂商专有名词清单
 * @returns {{term: string, column: number}[]} 命中项（column 为 1 基列号）
 */
export function findVendorTermHits(line, terms) {
  const hits = [];
  const lower = line.toLowerCase();
  for (const term of terms) {
    if (!term) continue;
    const needle = term.toLowerCase();
    let from = 0;
    for (;;) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      hits.push({ term, column: idx + 1 });
      from = idx + 1;
    }
  }
  return hits;
}

/**
 * 扫描整段文本（可能多行），返回所有命中位置。
 * @param {string} text 文本内容
 * @param {string[]} terms 厂商专有名词清单
 * @returns {{line: number, column: number, term: string, lineText: string}[]}
 */
export function scanText(text, terms = DEFAULT_VENDOR_TERMS) {
  const results = [];
  const lines = text.split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const hit of findVendorTermHits(lines[i], terms)) {
      results.push({ line: i + 1, column: hit.column, term: hit.term, lineText: lines[i] });
    }
  }
  return results;
}

/** 简单 glob（仅支持 ** 与 *）匹配，用于 excludeGlobs。 */
function matchesGlob(relPath, glob) {
  const normalized = relPath.split(path.sep).join('/');
  const re = new RegExp(
    '^' +
      glob
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '\u0000')
        .replace(/\*/g, '[^/]*')
        .replace(/\u0000/g, '.*') +
      '$',
  );
  return re.test(normalized);
}

function isExcluded(relPath, excludeGlobs) {
  return excludeGlobs.some((g) => matchesGlob(relPath, g));
}

/** 递归收集某根目录下需扫描的文件（绝对路径）。 */
function collectFiles(absRoot, baseDir, excludeGlobs, extensions) {
  const out = [];
  if (!fs.existsSync(absRoot)) return out;
  const stat = fs.statSync(absRoot);
  if (stat.isFile()) {
    out.push(absRoot);
    return out;
  }
  for (const entry of fs.readdirSync(absRoot, { withFileTypes: true })) {
    const abs = path.join(absRoot, entry.name);
    const rel = path.relative(baseDir, abs);
    if (isExcluded(rel, excludeGlobs)) continue;
    if (entry.isDirectory()) {
      out.push(...collectFiles(abs, baseDir, excludeGlobs, extensions));
    } else if (entry.isFile()) {
      if (extensions.length === 0 || extensions.includes(path.extname(entry.name))) {
        out.push(abs);
      }
    }
  }
  return out;
}

/**
 * 按配置扫描文件系统，返回所有命中。
 * @param {{baseDir: string, scanRoots: string[], vendorTerms?: string[], excludeGlobs?: string[], extensions?: string[]}} cfg
 * @returns {{file: string, line: number, column: number, term: string, lineText: string}[]}
 */
export function scanPaths(cfg) {
  const {
    baseDir,
    scanRoots,
    vendorTerms = DEFAULT_VENDOR_TERMS,
    excludeGlobs = [],
    extensions = DEFAULT_EXTENSIONS,
  } = cfg;
  const findings = [];
  for (const root of scanRoots) {
    const absRoot = path.resolve(baseDir, root);
    for (const file of collectFiles(absRoot, baseDir, excludeGlobs, extensions)) {
      let text;
      try {
        text = fs.readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      for (const hit of scanText(text, vendorTerms)) {
        findings.push({ file: path.relative(baseDir, file), ...hit });
      }
    }
  }
  return findings;
}

function parseArgs(argv) {
  const args = { config: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config' || argv[i] === '-c') {
      args.config = argv[++i];
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseDir = path.resolve(__dirname, '..');
  const configPath = args.config
    ? path.resolve(baseDir, args.config)
    : path.join(__dirname, 'naming-scan.config.json');

  if (!fs.existsSync(configPath)) {
    console.error(`[naming-scan] 配置文件不存在: ${configPath}`);
    process.exit(2);
  }

  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const vendorTerms = cfg.vendorTerms?.length ? cfg.vendorTerms : DEFAULT_VENDOR_TERMS;
  const scanRoots = cfg.scanRoots ?? [];
  const excludeGlobs = cfg.excludeGlobs ?? [];

  const findings = scanPaths({ baseDir, scanRoots, vendorTerms, excludeGlobs });

  if (findings.length > 0) {
    console.error('[naming-scan] 检测到厂商专有名词，命名中性化检查不通过（Requirement 1.1/1.3/1.4）：\n');
    for (const f of findings) {
      console.error(`  ${f.file}:${f.line}:${f.column}  命中 "${f.term}"  → ${f.lineText.trim()}`);
    }
    console.error(`\n[naming-scan] 共 ${findings.length} 处命中。请改用中性的"风控/反欺诈平台"命名。`);
    process.exit(1);
  }

  console.log(
    `[naming-scan] 通过：已扫描 ${scanRoots.length} 个根路径，未发现厂商专有名词 ` +
      `(${vendorTerms.join(', ')})。`,
  );
}

// 仅在作为 CLI 直接执行时运行 main；作为模块被 import（属性测试）时不执行。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
