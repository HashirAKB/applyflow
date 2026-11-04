// Detect fillable fields inside a form root and describe them for the matcher.

import type { FieldDescriptor, FieldKind } from '../core/fields';
import { cssEscape, groupLabel, labelFor, optionText } from './labels';

/** Site-specific hooks an adapter can pass to detection. */
export interface DetectHooks {
  /** Containers to ignore entirely, e.g. a resume-autofill dropzone that would overwrite the form. */
  skipSelector?: string;
  /** Better label when the site's markup misleads the generic resolver. Return null to fall back. */
  label?(el: HTMLElement): string | null;
  /** Site widgets the generic pass cannot see, e.g. yes/no button pairs. Ids are assigned afterwards. */
  customFields?(root: HTMLElement): DetectedField[];
}

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

function isRequired(el: HTMLElement): boolean {
  if ((el as HTMLInputElement).required || el.getAttribute('aria-required') === 'true') return true;
  if (el.closest('[role="group"][aria-required="true"], fieldset[aria-required="true"], [data-required="true"]')) return true;
  // A "*" (or a .required marker) on the label, or on the legend of a radio/checkbox group.
  const marked = (n: Element | null | undefined) =>
    !!n && (/\*\s*$/.test(n.textContent ?? '') || !!n.querySelector('.required') || /required/i.test(n.className));
  const label = (el.id && el.ownerDocument.querySelector(`label[for="${cssEscape(el.id)}"]`)) || el.closest('label');
  const isOption = el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox');
  return marked(label) || (isOption && marked(el.closest('fieldset')?.querySelector('legend')));
}

function hasValue(el: HTMLElement): boolean {
  if (el instanceof HTMLSelectElement) return el.selectedIndex > 0 && el.value !== '';
  if (el instanceof HTMLInputElement && el.type === 'file') return !!el.files?.length;
  return !!(el as HTMLInputElement).value?.trim();
}

export function detectFields(root: HTMLElement, hooks: DetectHooks = {}): DetectedField[] {
  const out: DetectedField[] = hooks.customFields?.(root) ?? [];
  const groups = new Map<string, HTMLInputElement[]>();
  const labelOf = (el: HTMLElement) => hooks.label?.(el) || labelFor(el as HTMLInputElement);

  const controls = Array.from(root.querySelectorAll<HTMLElement>('input, select, textarea'));
  for (const el of controls) {
    const kind = kindOf(el);
    if (!kind) continue;
    if (hooks.skipSelector && el.closest(hooks.skipSelector)) continue;
    if ((el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly) continue;
    if (el.closest(CAPTCHA_SELECTOR)) continue;
    // File inputs are often visually hidden behind a styled button, so do not require visibility for them.
    // Custom radios and checkboxes are often hidden behind a styled label, so check the label instead.
    const visibleTarget = kind === 'radio' || kind === 'checkbox' ? (el.closest('label') ?? el) : el;
    if (kind !== 'file' && !isVisible(visibleTarget)) continue;

    if (kind === 'radio' || kind === 'checkbox') {
      const input = el as HTMLInputElement;
      const key = `${kind}:${input.name || input.id || out.length}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(input);
      continue;
    }

    const label = labelOf(el);
    const options =
      el instanceof HTMLSelectElement
        ? Array.from(el.options)
            .filter((o) => o.value !== '' && !/^(select|choose|please select|--)/i.test(o.text.trim()))
            .map((o) => o.text.trim())
        : [];
    out.push({
      descriptor: {
        id: '',
        label,
        kind,
        options,
        required: isRequired(el),
        name: el.getAttribute('name') ?? '',
        hasValue: hasValue(el),
      },
      elements: [el],
    });
  }

  for (const [key, inputs] of groups) {
    const kind = key.startsWith('radio') ? 'radio' : 'checkbox';
    // A single checkbox is a yes/no question whose label is its own text ("I agree to ...").
    const single = kind === 'checkbox' && inputs.length === 1;
    const label = (single ? hooks.label?.(inputs[0]) || labelFor(inputs[0]) : hooks.label?.(inputs[0]) || groupLabel(inputs[0]));
    out.push({
      descriptor: {
        id: '',
        label,
        kind,
        options: single ? [] : inputs.map(optionText),
        required: inputs.some((i) => isRequired(i)),
        name: inputs[0].name,
        // A lone checkbox's unchecked state is a valid answer, so only groups count as pre-filled.
        hasValue: !single && inputs.some((i) => i.checked),
      },
      elements: inputs,
    });
  }

  // Keep document order so the side panel lists questions as the user sees them, then number them.
  out.sort((a, b) => (a.elements[0].compareDocumentPosition(b.elements[0]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  out.forEach((f, i) => (f.descriptor.id = `af-${i + 1}`));
  return out;
}

export function findBlockers(doc: Document): string[] {
  const blockers: string[] = [];
  if (doc.querySelector(CAPTCHA_SELECTOR)) blockers.push('captcha');
  const pw = Array.from(doc.querySelectorAll('input[type="password"]')).some(isVisible);
  if (pw) blockers.push('login');
  return blockers;
}
