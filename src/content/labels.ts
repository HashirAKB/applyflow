// Find the human question for a form control. Order follows how assistive technology computes
// an accessible name, then falls back to layout heuristics that job sites commonly use.

import { cleanLabel } from '../core/text';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function text(el: Element | null | undefined): string {
  if (!el) return '';
  // Ignore nested controls and option lists that would pollute the label (e.g. label wrapping a select).
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('input, select, textarea, option, script, style, button, [aria-hidden="true"]').forEach((n) => n.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function byIds(doc: Document, ids: string): string {
  return ids
    .split(/\s+/)
    .map((id) => text(doc.getElementById(id)))
    .filter(Boolean)
    .join(' ');
}

export function cssEscape(id: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/["\\]/g, '\\$&');
}

/** Button-like texts that sites put in visually hidden labels; they say nothing about the question. */
const GENERIC_LABEL = /^(attach|upload|browse|choose( a)? file|select( a)? file|drop files? here|enter manually|start typing\.*)$/i;

/** Label for a single control. */
export function labelFor(el: Control): string {
  const doc = el.ownerDocument;
  const group = el.closest('[role="group"][aria-labelledby], fieldset');
  const candidates = [
    el.getAttribute('aria-labelledby') ? byIds(doc, el.getAttribute('aria-labelledby')!) : '',
    el.id ? text(doc.querySelector(`label[for="${cssEscape(el.id)}"]`)) : '',
    text(el.closest('label')),
    el.getAttribute('aria-label') ?? '',
    nearbyText(el),
    // A file input inside <div role="group" aria-labelledby="upload-label-resume"> (Greenhouse).
    group?.getAttribute('aria-labelledby') ? byIds(doc, group.getAttribute('aria-labelledby')!) : '',
    el.getAttribute('placeholder') ?? '',
    el.getAttribute('title') ?? '',
    humanizeName(el.getAttribute('name') ?? ''),
  ];
  return cleanLabel(candidates.find((c) => c.trim() && !GENERIC_LABEL.test(cleanLabel(c))) ?? '');
}

/** Question for a radio or checkbox group: fieldset legend, aria group label, or the group's heading text. */
export function groupLabel(first: HTMLInputElement): string {
  const doc = first.ownerDocument;
  const group = first.closest('fieldset, [role="radiogroup"], [role="group"]');
  if (group) {
    const legend = group.querySelector('legend');
    const labelled = group.getAttribute('aria-labelledby');
    const t = text(legend) || (labelled ? byIds(doc, labelled) : '') || group.getAttribute('aria-label') || '';
    if (t) return cleanLabel(t);
  }
  return cleanLabel(nearbyText(first.closest('label') ?? first, 4) || humanizeName(first.name));
}

/**
 * Text of the closest preceding label-like element inside the field's container. Handles
 * `<div class="field"><div>Question</div><input></div>` style markup that has no <label>.
 */
function nearbyText(el: Element, maxDepth = 3): string {
  let node: Element | null = el;
  for (let depth = 0; node && depth < maxDepth; depth++) {
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
      // Reaching another control (or a label bound to another control) means we left this field.
      if (sib.matches('input, select, textarea') || sib.querySelector('input, select, textarea')) return '';
      if (sib.matches('label[for]')) {
        const target = el.ownerDocument.getElementById(sib.getAttribute('for')!);
        if (target && target !== el && !target.contains(el)) return '';
      }
      const t = text(sib);
      if (t && t.length <= 300) return t;
    }
    node = node.parentElement;
    if (!node || node.matches('form, body')) break;
  }
  return '';
}

function humanizeName(name: string): string {
  // job_application[first_name] -> first name
  const last = name.split(/[[\]]/).filter(Boolean).pop() ?? '';
  return last.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
}

/** Visible text of an option, for radios and checkboxes. */
export function optionText(input: HTMLInputElement): string {
  const doc = input.ownerDocument;
  return (
    (input.id ? text(doc.querySelector(`label[for="${cssEscape(input.id)}"]`)) : '') ||
    text(input.closest('label')) ||
    input.getAttribute('aria-label') ||
    text(input.nextElementSibling) ||
    input.value
  );
}
