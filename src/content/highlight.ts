// Visual feedback on the page: every field we touched or need help with gets an outline.
// Styles are inline and removed on the next scan, so we leave no lasting trace on the site.

const MARK = 'data-applyflow';
const ID = 'data-applyflow-id';

export function clearHighlights(doc: Document) {
  doc.querySelectorAll<HTMLElement>(`[${MARK}]`).forEach((el) => {
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.removeAttribute(MARK);
  });
  doc.querySelectorAll(`[${ID}]`).forEach((el) => el.removeAttribute(ID));
}

export function highlight(el: HTMLElement, state: 'filled' | 'ask', confidence: number, fieldId?: string) {
  if (fieldId) el.setAttribute(ID, fieldId);
  const target = el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox') ? (el.closest('fieldset, label') as HTMLElement) ?? el : el;
  const color = state === 'ask' ? '#ea580c' : confidence >= 0.9 ? '#16a34a' : '#ca8a04';
  target.style.outline = `2px ${state === 'ask' ? 'dashed' : 'solid'} ${color}`;
  target.style.outlineOffset = '2px';
  target.setAttribute(MARK, `${state} ${Math.round(confidence * 100)}%`);
}
