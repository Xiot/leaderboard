import { range, get, last, midnightMs } from './utils';
import { byNumber } from './sort';

import type { AocLeaderboard, AocMember } from './aoc';
import type { Member, MemberDay, Override, Star } from './types';

export function transformData(year: number, input: AocLeaderboard, overrides: Override[] = []) {
  const members = Object.values(input.members)
    .map(member => transformMemberData(member, year))
    .filter(x => x.lastAttempted >= 0);

  members.forEach(m => {
    overrides.forEach(fn => fn(m));
  });

  populatePositions(members);
  calculateLocalScore(members);

  return members;
}

function transformMemberData(member: AocMember, year: number): Member {
  return {
    name: member.name,
    days: range(25).map(index => {
      return buildMemberDayStats(member, year, index + 1);
    }),
    lastAttempted: range(25).reduce((last, day) => {
      if (member.completion_day_level[String(day + 1)]) {
        return day;
      }
      return last;
    }, -1),
    score: 0,
  };
}

function getStarTimestamp(member: AocMember, day: number, star: number) {
  const text = get(member, ['completion_day_level', String(day), String(star), 'get_star_ts']) as string | undefined;
  return text ? parseInt(text, 10) * 1000 : undefined;
}

function buildMemberDayStats(member: AocMember, year: number, day: number): MemberDay {
  const star1Timestamp = getStarTimestamp(member, day, 1);
  const star2Timestamp = getStarTimestamp(member, day, 2);

  const startTime = midnightMs(year, 12, day);

  const buildStar = (ts: number | void, star: number) => {
    if (!ts) {
      return undefined;
    }

    return {
      index: star,
      timestamp: ts,
      startTime,
      get duration() {
        return this.timestamp - this.startTime;
      },
    };
  };

  return {
    day,
    startTime,
    star1: buildStar(star1Timestamp, 1),
    star2: buildStar(star2Timestamp, 2),
    score: 0,
  };
}

function populatePositions(members: Member[]) {
  range(25).forEach(day => {
    const data1 = members
      .map(m => m.days[day].star1)
      .filter((s): s is Star => !!s && s.gaveUp !== true)
      .map(s => s.duration)
      .sort(byNumber);

    const data2 = members
      .map(m => m.days[day].star2)
      .filter((s): s is Star => !!s && s.gaveUp !== true)
      .map(s => s.duration)
      .sort(byNumber);

    function modifyStar(star: Star | void, sortedDurations: number[]) {
      if (!star) return;
      const position = sortedDurations.indexOf(star.duration);
      star.position = position === -1 ? members.length : position;
    }

    members.forEach(m => {
      modifyStar(m.days[day].star1, data1);
      modifyStar(m.days[day].star2, data2);
    });
  });
}

function calculateLocalScore(members: Member[]) {
  const positionScore = (star?: Star) => (star == null ? 0 : star.gaveUp ? 0 : members.length - (star?.position ?? 0));

  for (let i = 0; i < members.length; i++) {
    let sum = 0;
    range(25).forEach(dayIndex => {
      const day = members[i].days[dayIndex];
      const star1 = positionScore(day.star1);
      const star2 = positionScore(day.star2);
      sum += star1 + star2;
      day.score = star1 + star2;
    });
    members[i].score = sum;
  }
}

export type PointArray = (number | null)[];
export const getPoints = (member: Member, opts?: { allowEmpty: boolean }): PointArray => {
  type Accumulator = null | PointArray;

  return member.days.reduce<Accumulator>((acc, day) => {
    const { allowEmpty = false } = opts ?? {};
    if (acc === null) {
      return [day.score];
    } else {
      const previousScore = last(acc.filter(Boolean));
      const score = day.score ? day.score : day.day <= member.lastAttempted ? 0 : allowEmpty ? 0 : null;
      return [...acc, score != null && previousScore ? previousScore + score : null];
    }
  }, null) as PointArray;
};

export const getDayPoints = (member: Member, opts?: { allowEmpty: boolean }): PointArray =>
  member.days.reduce((acc, day) => {
    const { allowEmpty = false } = opts ?? {};
    if (acc === null) {
      return [day.score];
    } else {
      const score = day.score ? day.score : day.day <= member.lastAttempted ? 0 : allowEmpty ? 0 : null;
      return [...acc, score];
    }
  }, null as null | PointArray) as PointArray;

export const avgLast = (arr: PointArray, index: number, count = 5) => {
  const actualCount = index + 1 < count ? index + 1 : count;
  if (actualCount === 0) return 0;
  let sum = 0;
  for (let i = index; i > index - actualCount; i--) {
    sum += arr[i] ?? 0;
  }

  return sum / actualCount;
};
