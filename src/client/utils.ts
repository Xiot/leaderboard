import { DateTime } from 'luxon';

export async function fallback<T = unknown>(promises: Array<() => Promise<T>>) {
  const errors = [];
  for (let i = 0; i < promises.length; i++) {
    try {
      return await promises[i]();
    } catch (ex) {
      // ignore
      errors.push(ex);
    }
  }
  throw new Error('all promises rejected');
}

export function range(to: number) {
  return Array.from(new Array(to), (x, i) => i);
}

export function get<T = unknown>(obj: Record<string, unknown>, keys: string[]): T | void {
  for (const key of keys) {
    // @ts-ignore
    obj = obj[key];
    if (obj == null) {
      return undefined;
    }
  }
  return obj as T;
}

export const last = <T>(arr: T[]): T => arr[arr.length - 1];

type Comparable = undefined | number | string;
export function minOf<T>(arr: T[]): T;
export function minOf<T, K extends Comparable>(arr: T[], accessor: (item: T) => K): K;
// @ts-ignore
export function minOf<T, K extends Comparable>(arr: T[], accessor: (item: T) => K = x => x) {
  type Accumulator = {
    value?: K;
    item?: T;
  };

  return arr.reduce<Accumulator>(
    (min, current) => {
      const value = accessor(current);
      if (value === undefined) return min;
      if (!min.value || min.value > value) {
        return { value, item: current };
      }
      return min;
    },
    { value: undefined, item: undefined },
  )?.value;
}

export function midnightMs(year: number, month: number, day: number) {
  return DateTime.fromObject(
    {
      year,
      month,
      day,
    },
    {
      zone: 'America/Toronto',
    },
  ).toMillis();
}
