// Write values into form controls in a way framework-controlled inputs accept.
//
// React (and similar libraries) keep their own copy of an input's value. Assigning `input.value = x`
// directly updates React's value tracker too, so React thinks nothing changed and drops the event.
// Calling the native setter from the element's prototype bypasses the tracker, and then a bubbling
// `input` event makes React's onChange fire. Angular and Vue listen to `input`/`change` directly.

import { matchOption } from '../core/options';
import type { ResumeFile } from '../core/messages';
import { fromBase64 } from '../core/crypto';
import type { DetectedField } from './detect';

function nativeSetter(el: HTMLElement, prop: 'value' | 'checked'): ((v: unknown) => void) | undefined {
  const proto = Object.getPrototypeOf(el);
  return Object.getOwnPropertyDescriptor(proto, prop)?.set;
}

function fire(el: HTMLElement, type: string) {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

export function setText(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.focus();
  const set = nativeSetter(el, 'value');
  if (set) set.call(el, value);
  else el.value = value;
  fire(el, 'input');
  fire(el, 'change');
  el.blur();
}

export function setSelect(el: HTMLSelectElement, optionText: string): boolean {
  const opts = Array.from(el.options);
  const idx = opts.findIndex((o) => o.text.trim() === optionText);
  if (idx < 0) return false;
  const set = nativeSetter(el, 'value');
  if (set) set.call(el, opts[idx].value);
  else el.value = opts[idx].value;
  fire(el, 'input');
  fire(el, 'change');
  return true;
}

/** Click the matching input so the page sees a real user-like change (React listens to click for these). */
function setChecked(input: HTMLInputElement, checked: boolean) {
  if (input.checked !== checked) input.click();
}

export function setFile(input: HTMLInputElement, file: ResumeFile) {
  const dt = new DataTransfer();
  dt.items.add(new File([fromBase64(file.base64)], file.name, { type: file.type }));
  input.files = dt.files;
  fire(input, 'input');
  fire(input, 'change');
}

const TRUTHY = /^(yes|y|true|1|i agree|agree|checked)$/i;

/**
 * Fill one detected field with a value already decided by the matcher.
 * Returns false when the value cannot be applied (e.g. no option matches), so the caller asks the user.
 */
export function fillField(field: DetectedField, value: string, resume: ResumeFile | null): boolean {
  const { kind, options } = field.descriptor;
  const [el] = field.elements;
  switch (kind) {
    case 'select': {
      if (el instanceof HTMLSelectElement) {
        const i = matchOption(value, options);
        return i >= 0 && setSelect(el, options[i]);
      }
      // ARIA combobox (custom dropdown): type the value; the page's own widget resolves it.
      setText(el as HTMLInputElement, value);
      return true;
    }
    case 'radio': {
      const i = matchOption(value, options);
      if (i < 0) return false;
      setChecked(field.elements[i] as HTMLInputElement, true);
      return true;
    }
    case 'checkbox': {
      if (field.elements.length === 1) {
        setChecked(el as HTMLInputElement, TRUTHY.test(value.trim()));
        return true;
      }
      const wanted = value.split(/\s*[,;]\s*/).map((v) => matchOption(v, options));
      if (wanted.some((i) => i < 0)) return false;
      field.elements.forEach((input, i) => setChecked(input as HTMLInputElement, wanted.includes(i)));
      return true;
    }
    case 'file': {
      if (!resume) return false;
      setFile(el as HTMLInputElement, resume);
      return true;
    }
    default:
      setText(el as HTMLInputElement, value);
      return true;
  }
}
