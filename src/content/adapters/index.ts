import { generic } from './generic';
import type { SiteAdapter } from './types';

/** Dedicated adapters first; the generic one matches everything and goes last. */
export const ADAPTERS: SiteAdapter[] = [generic];

export function pickAdapter(url: URL, doc: Document): SiteAdapter {
  return ADAPTERS.find((a) => a.matches(url, doc)) ?? generic;
}
