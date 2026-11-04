// Auto-submit gate. A pure function: given the settings and what is on the page, may we click?
// Off by default. Every rule must pass; the result lists every rule that failed so the user
// sees exactly why nothing was submitted.

import type { FieldDecision, FieldDescriptor } from './fields';
import type { AutoSubmitSettings } from './types';

export interface GateInput {
  settings: AutoSubmitSettings;
  threshold: number;
  site: string;
  /** Submissions already made today on this site. */
  usedToday: number;
  fields: FieldDescriptor[];
  decisions: FieldDecision[];
  blockers: string[];
  hasSubmit: boolean;
  hasNext: boolean;
  nextMaySubmit: boolean;
}

export type GateResult =
  | { allowed: true; action: 'submit' | 'next' | 'dry-run' }
  | { allowed: false; reasons: string[] };

export function gate(i: GateInput): GateResult {
  const reasons: string[] = [];
  const s = i.settings;

  if (!s.enabled) reasons.push('Auto-submit is off.');
  if (!s.riskAcknowledged) reasons.push('The risk confirmation has not been accepted.');
  if (i.site === 'generic') reasons.push('Auto-submit only runs on sites with a dedicated adapter.');
  else if (!s.sites[i.site]) reasons.push(`Auto-submit is not enabled for ${i.site}.`);
  if (i.usedToday >= s.dailyCap) reasons.push(`Daily limit reached (${s.dailyCap} on ${i.site}).`);
  if (i.blockers.includes('captcha')) reasons.push('A CAPTCHA is present. Complete it yourself.');
  if (i.blockers.includes('login')) reasons.push('A login prompt is present. Sign in yourself.');
  if (!i.fields.length && !i.hasSubmit) reasons.push('Unknown step: no form fields and no submit button.');
  if (!i.hasSubmit && !i.hasNext) reasons.push('Unknown step: neither a next nor a submit button was found.');

  const byId = new Map(i.decisions.map((d) => [d.fieldId, d]));
  for (const f of i.fields) {
    if (!f.required) continue;
    const d = byId.get(f.id);
    const ok = d && (d.action === 'skip' || (d.action === 'fill' && d.confidence >= i.threshold));
    if (!ok) reasons.push(`Required field not confidently filled: "${f.label || f.name || f.id}".`);
  }

  if (reasons.length) return { allowed: false, reasons };
  const finalStep = i.hasSubmit || i.nextMaySubmit;
  if (finalStep && s.dryRun) return { allowed: true, action: 'dry-run' };
  return { allowed: true, action: i.hasSubmit ? 'submit' : 'next' };
}

/** Pacing between automated clicks, so a run never fires faster than a person would. */
export function pacingDelay(s: AutoSubmitSettings, rand = Math.random): number {
  const lo = Math.max(0, Math.min(s.minDelayMs, s.maxDelayMs));
  const hi = Math.max(s.minDelayMs, s.maxDelayMs);
  return Math.round(lo + rand() * (hi - lo));
}

export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
