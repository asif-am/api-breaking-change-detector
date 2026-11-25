/**
 * Generates docs/RULES.md from the single source of truth in engine/rules.js.
 * Run: npm run docs:rules
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../engine/rules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, '../../docs/RULES.md');

const groups = new Map();
for (const rule of RULES) {
  const list = groups.get(rule.category) || [];
  list.push(rule);
  groups.set(rule.category, list);
}

const lines = [
  '# Compatibility rule catalogue',
  '',
  '> Generated from `server/engine/rules.js` — do not edit by hand. Run `npm run docs:rules` to refresh.',
  '',
  `Total rules: **${RULES.length}**. Every rule has a stable id so the report, the design document and the`,
  'demonstration script can refer to the same definition (BR-02, FR-15, FR-16).',
  '',
  'Direction semantics:',
  '',
  '- **Request** rules describe what the server newly *accepts*. Narrowing input (new required field,',
  '  removed enum value, tighter bounds) breaks consumers.',
  '- **Response** rules describe what the server newly *returns*. Widening output (new enum value,',
  '  wider type, removed property) breaks consumers.',
  '',
];

for (const [category, rules] of groups) {
  lines.push(`## ${category}`, '', '| Rule | Code | Classification | Severity | Title |', '| --- | --- | --- | --- | --- |');
  for (const rule of rules) {
    lines.push(
      `| ${rule.id} | \`${rule.code}\` | ${rule.classification} | ${rule.severity} | ${rule.title} |`
    );
  }
  lines.push('');
}

lines.push(
  '## Severity scale',
  '',
  '| Severity | Meaning |',
  '| --- | --- |',
  '| critical | The endpoint or method disappears; every caller fails. |',
  '| high | A request that used to succeed is rejected, or data a caller reads disappears. |',
  '| medium | A narrower/wider contract that breaks a meaningful subset of consumers. |',
  '| low | Behaviour changes that usually need consumer attention but rarely crash them. |',
  '| info | Purely additive or compatible changes, reported for completeness. |',
  ''
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${RULES.length} rules to ${outputPath}`);
