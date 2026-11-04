// Detect fillable fields inside a form root and describe them for the matcher.

import type { FieldDescriptor, FieldKind } from '../core/fields';
import { groupLabel, labelFor, optionText } from './labels';

export interface DetectedField {
  descriptor: FieldDescriptor;
  /** One element for most fields; every input of the group for radios and checkbox groups. */
  elements: HTMLElement[];
}

const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'password', 'search']);

/** Never touch credentials or anti-bot widgets. */
const CAPTCHA_SELECTOR =
  '.g-recaptcha, .h-captcha, .cf-turnstile, [data-sitekey], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"], iframe[src*="challenges.cloudflare.com"]';

export function isVisible(el: Element): boolean {
  if (el.closest('[hidden], [aria-hidden="true"], template')) return false;
  const view = el.ownerDocument.defaultView;
  for (let n: Element | null = el; n; n = n.parentElement) {
    const style = view?.getComputedStyle(n);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  }
  return true;
}

function kindOf(el: HTMLElement): FieldKind | null {
  if (el instanceof HTMLTextAreaElement) return 'textarea';
  if (el instanceof HTMLSelectElement) return 'select';
  if (!(el instanceof HTMLInputElement)) return null;
  const t = (el.getAttribute('type') ?? 'text').toLowerCase();
  if (SKIP_TYPES.has(t)) return null;
  if (t === 'radio' || t === 'checkbox' || t === 'file' || t === 'email' || t === 'tel' || t === 'url' || t === 'number' || t === 'date') {
    return t;
  }
  if (el.getAttribute('role') === 'combobox') return 'select';
  return 'text';
}

function isRequired(el: HTMLElement, label: string): boolean {
  return (
    (el as HTMLInputElement).required ||
    el.getAttribute('aria-required') === 'true' ||
    /\*\s*$/.test(label) ||
    !!el.closest('.required, [data-required="true"]')
  );
}

export function detectFields(root: ParentNode): DetectedField[] {
  const out: DetectedField[] = [];
  const groups = new Map<string, HTMLInputElement[]>();
  let n = 0;
  const nextId = () => `af-${++n}`;

  const controls = Array.from(root.querySelectorAll<HTMLElement>('input, select, textarea'));
  for (const el of controls) {
    const kind = kindOf(el);
    if (!kind) continue;
    if ((el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly) continue;
    if (el.closest(CAPTCHA_SELECTOR)) continue;
    // File inputs are often visually hidden behind a styled button, so do not require visibility for them.
    if (kind !== 'file' && !isVisible(el)) continue;

    if (kind === 'radio' || kind === 'checkbox') {
      const input = el as HTMLInputElement;
      const key = `${kind}:${input.name || input.id || out.length}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(input);
      continue;
    }

    const label = labelFor(el as HTMLInputElement);
    const options =
      el instanceof HTMLSelectElement
        ? Array.from(el.options)
            .filter((o) => o.value !== '' && !/^(select|choose|please select|--)/i.test(o.text.trim()))
            .map((o) => o.text.trim())
        : [];
    out.push({
      descriptor: {
        id: nextId(),
        label,
        kind,
        options,
        required: isRequired(el, el.closest('label')?.textContent ?? ''),
        name: el.getAttribute('name') ?? '',
      },
      elements: [el],
    });
  }

  for (const [key, inputs] of groups) {
    const kind = key.startsWith('radio') ? 'radio' : 'checkbox';
    // A single checkbox is a yes/no question whose label is its own text ("I agree to ...").
    const single = kind === 'checkbox' && inputs.length === 1;
    const label = single ? labelFor(inputs[0]) : groupLabel(inputs[0]);
    out.push({
      descriptor: {
        id: nextId(),
        label,
        kind,
        options: single ? [] : inputs.map(optionText),
        required: inputs.some((i) => isRequired(i, '')),
        name: inputs[0].name,
      },
      elements: inputs,
    });
  }

  // Keep document order so the side panel lists questions as the user sees them.
  const pos = (f: DetectedField) => controls.indexOf(f.elements[0]);
  return out.sort((a, b) => pos(a) - pos(b));
}

export function findBlockers(doc: Document): string[] {
  const blockers: string[] = [];
  if (doc.querySelector(CAPTCHA_SELECTOR)) blockers.push('captcha');
  const pw = Array.from(doc.querySelectorAll('input[type="password"]')).some(isVisible);
  if (pw) blockers.push('login');
  return blockers;
}
