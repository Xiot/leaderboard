import type {Member} from './types';

export function byNumber(l: number | void | null, r: number | void | null) {
  if (l == null && r == null) return 0;
  if (l == null && r != null) return 1;
  if (l != null && r == null) return -1;
  // @ts-ignore - l and r are garenteed to have a value.
  return l - r;
}

export function byNumberReverse(l: number | void | null, r: number | void | null): number {
  return -byNumber(l, r);
}

export function membersByTotalScore(l: Member, r: Member) {
  return r.score - l.score;
}
