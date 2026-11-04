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

/** Smallest element containing every option of a radio/checkbox group, so the whole group is outlined. */
function groupBox(els: HTMLElement[]): HTMLElement {
  let box: HTMLElement | null = els[0].parentElement;
  while (box && !els.every((e) => box!.contains(e))) box = box.parentElement;
  return box ?? els[0];
}

export function highlight(els: HTMLElement[], state: 'filled' | 'ask', confidence: number, fieldId?: string) {
  const el = els[0];
  if (fieldId) el.setAttribute(ID, fieldId);
  const option = el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox');
  const target = els.length > 1 ? groupBox(els) : option ? ((el.closest('label') as HTMLElement) ?? el) : el;
  const color = state === 'ask' ? '#ea580c' : confidence >= 0.9 ? '#16a34a' : '#ca8a04';
  target.style.outline = `2px ${state === 'ask' ? 'dashed' : 'solid'} ${color}`;
  target.style.outlineOffset = '2px';
  target.setAttribute(MARK, `${state} ${Math.round(confidence * 100)}%`);
}
