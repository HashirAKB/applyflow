// Matching eval. Usage: npm run eval  (writes eval/results.md, exits 1 if precision drops below 0.95)
// Optional: EVAL_PROVIDER=anthropic EVAL_MODEL=<model id> ANTHROPIC_API_KEY=... npm run eval  adds a real-model row.
import { readFileSync, writeFileSync } from 'node:fs';
import { matchField, type MatchOptions } from '../src/core/matching';
import { defaultSettings } from '../src/core/types';
import { mockProvider } from '../src/llm/mock';
import { anthropicProvider } from '../src/llm/anthropic';
import type { LlmProvider } from '../src/llm/provider';

const THRESHOLD = defaultSettings().threshold;
const items = readFileSync('eval/questions.tsv', 'utf8')
  .split('\n')
  .filter((l) => l.trim() && !l.startsWith('#'))
  .map((l) => {
    const [label, expected] = l.split('\t');
    return { label, expected };
  });

interface Row {
  name: string;
  accuracy: number;
  precision: number;
  coverage: number;
  askRate: number;
  wrongFills: string[];
}

async function run(name: string, opts: Partial<MatchOptions>): Promise<Row> {
  let top1 = 0;
  let auto = 0;
  let autoCorrect = 0;
  let answerable = 0;
  let answerableAuto = 0;
  const wrongFills: string[] = [];
  for (const { label, expected } of items) {
    const m = await matchField({ label, name: '', options: [] }, { answers: [], threshold: THRESHOLD, ...opts });
    const predicted = m.questionId ?? 'none';
    if (predicted === expected) top1++;
    const filled = m.questionId !== null && m.confidence >= THRESHOLD;
    if (expected !== 'none') answerable++;
    if (filled) {
      auto++;
      if (predicted === expected) autoCorrect++;
      else wrongFills.push(`${label} -> ${predicted} (expected ${expected}, ${m.method} ${m.confidence.toFixed(2)})`);
      if (expected !== 'none') answerableAuto++;
    }
  }
  return {
    name,
    accuracy: top1 / items.length,
    precision: auto ? autoCorrect / auto : 1,
    coverage: answerableAuto / answerable,
    askRate: (items.length - auto) / items.length,
    wrongFills,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

const rows: Row[] = [
  await run('Rules only', { stages: { fuzzy: false, llm: false } }),
  await run('Rules + fuzzy', { stages: { llm: false } }),
  await run('Rules + fuzzy + mock LLM', { llm: mockProvider() }),
];
if (process.env.EVAL_PROVIDER === 'anthropic' && process.env.ANTHROPIC_API_KEY && process.env.EVAL_MODEL) {
  const llm: LlmProvider = anthropicProvider(process.env.ANTHROPIC_API_KEY, process.env.EVAL_MODEL);
  rows.push(await run('Rules + fuzzy + Anthropic', { llm }));
}

const none = items.filter((i) => i.expected === 'none').length;
const md = [
  '# Matching eval results',
  '',
  `${items.length} labelled form questions (${items.length - none} answerable, ${none} with no canonical question). Confidence threshold ${THRESHOLD}.`,
  '',
  '- Accuracy: top prediction equals the label (no prediction counts as "none").',
  '- Precision at threshold: of the fields that would be filled automatically, the share mapped to the right question.',
  '- Coverage: share of answerable questions filled automatically.',
  '- Ask rate: share of all questions sent to the user.',
  '',
  'The mock LLM is a deterministic concept lexicon, not a real model (see src/llm/mock.ts). Its row shows the pipeline handling LLM output, not real-model accuracy.',
  '',
  '| Pipeline | Accuracy | Precision at threshold | Coverage | Ask rate |',
  '| --- | --- | --- | --- | --- |',
  ...rows.map((r) => `| ${r.name} | ${pct(r.accuracy)} | ${pct(r.precision)} | ${pct(r.coverage)} | ${pct(r.askRate)} |`),
  '',
  ...rows.flatMap((r) => (r.wrongFills.length ? [`Wrong automatic fills, ${r.name}:`, '', ...r.wrongFills.map((w) => `- ${w}`), ''] : [])),
].join('\n');

writeFileSync('eval/results.md', md + '\n');
console.log(md);
const gate = rows[2];
if (gate.precision < 0.95) {
  console.error(`Precision ${pct(gate.precision)} is below 0.95`);
  process.exit(1);
}
