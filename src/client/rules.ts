import { midnightMs } from './utils';
import type { Override, Star } from './types';

export function overrideDisqualified(name: string, day: number, starNo: 1 | 2): Override {
  return member => {
    if (member.name !== name) return;

    const star: Star | void = member.days[day - 1][`star${starNo}`];
    if (star) star.gaveUp = true;
  };
}

export function overrideChristmasPresent(): Override {
  return member => {
    const lastDay = member.days[24];
    if (!lastDay?.star1 || !lastDay?.star2) return;
    lastDay.star2.timestamp = lastDay.star1.timestamp;
    lastDay.star2.startTime = lastDay.star1.timestamp;
  };
}

export function overrideStartTime(year: number, offset: number): Override {
  return member => {
    member.days.forEach(day => {
      if (!day.star1) return;
      const withOffset = midnightMs(year, 12, day.day) + offset;
      if (day.star1.timestamp >= withOffset) {
        day.startTime = withOffset;
        day.star1.startTime = withOffset;
        if (day.star2) {
          day.star2.startTime = withOffset;
        }
      }
    });
  };
}
