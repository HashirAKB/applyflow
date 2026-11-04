import { ashby } from './ashby';
import { generic } from './generic';
import { greenhouse } from './greenhouse';
import { lever } from './lever';
import { linkedin } from './linkedin';
import { naukri } from './naukri';
import type { SiteAdapter } from './types';
import { workable } from './workable';

/** Dedicated adapters first; the generic one matches everything and goes last. */
export const ADAPTERS: SiteAdapter[] = [greenhouse, lever, ashby, workable, linkedin, naukri, generic];

export function pickAdapter(url: URL, doc: Document): SiteAdapter {
  return ADAPTERS.find((a) => a.matches(url, doc)) ?? generic;
}
