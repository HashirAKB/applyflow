// Helpers shared by adapters.
import { isVisible } from '../detect';

export function textOf(el: Element | null | undefined): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function meta(doc: Document, prop: string): string {
  return doc.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`)?.getAttribute('content')?.trim() ?? '';
}

/** First visible button or submit input whose text matches. */
export function buttonByText(root: ParentNode, re: RegExp): HTMLElement | null {
  const buttons = Array.from(root.querySelectorAll<HTMLElement>('button, input[type="submit"], [role="button"]'));
  return (
    buttons.find((b) => isVisible(b) && re.test((b.textContent || (b as HTMLInputElement).value || b.getAttribute('aria-label') || '').trim())) ??
    null
  );
}

/** Truncate long job descriptions so snapshots and LLM prompts stay bounded. */
export function clip(s: string, max = 20_000): string {
  return s.length > max ? s.slice(0, max) : s;
}
