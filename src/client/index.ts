/* eslint-env browser */

import { Duration } from 'luxon';
import { Chart, ChartConfiguration } from 'chart.js';

import type { AocLeaderboard, AocMember } from './aoc';
import type { Member, MemberDay, Star } from './types';

const PARSE_TIME = Date.now();

// import {stats} from 'https://portal.xiot.ca/aoc-2020.js'
const statsJsonUriLocal = 'https://raw.githubusercontent.com/Xiot/xiot.github.io/master/2020.json';
const statsJsonUri = '/api/aoc/682929/2020'; //'https://portal.xiot.ca/aoc-2020.json';
const trophySvg = createTrophy();

window.onload = load;

const dataFetch = fetch(statsJsonUri)
  .catch(() => fetch(statsJsonUriLocal))
  .then(response => response.json());

function element(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

function load() {
  if (window.outerWidth < 800) {
    element('root').classList.add('phone');
  }

  // fetch(statsJsonUri)
  //     .then(response => response.json())
  // Promise.resolve(stats)
  dataFetch.then(data => transformData(data)).then(initialize);
}

function transformData(input: AocLeaderboard) {
  const members = Object.values(input.members)
    .map(transformMemberData)
    .filter(x => x.lastAttempted >= 0);

  applyOverrides(members);
  populatePositions(members);
  calculateLocalScore(members);

  return members;
}

type Override = (m: Member) => void;

const OVERRIDES: Override[] = [
  // Everyone gets gold for 25.2
  m => {
    const lastDay = m.days[24];
    if (!lastDay?.star1 || !lastDay?.star2) return;
    lastDay.star2.timestamp = lastDay.star1.timestamp;
    lastDay.star2.duration = 1000;
  },
  // Calculate didGiveUp
  m => {
    m.days.forEach(day => {
      if (day.star1 && didGiveUp(m, day.day, 1)) {
        day.star1.gaveUp = true;
      }
      if (day.star2 && didGiveUp(m, day.day, 2)) {
        day.star2.gaveUp = true;
      }
    });
  },
];

function applyOverrides(members: Member[]) {
  members.forEach(m => {
    OVERRIDES.forEach(fn => fn(m));
  });
}

function byNumber(l: number | void, r: number | void) {
  if (l == null && r == null) return 0;
  if (l == null && r != null) return 1;
  if (l != null && r == null) return -1;
  // @ts-ignore - l and r are garenteed to have a value.
  return l - r;
}
function byNumberReverse(l: number | void, r: number | void): number {
  return -byNumber(l, r);
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

function membersByTotalScore(l: Member, r: Member) {
  return r.score - l.score;
}

function transformMemberData(member: AocMember): Member {
  return {
    name: member.name,
    days: range(25).map(index => {
      return buildMemberDayStats(member, index + 1);
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

function buildMemberDayStats(member: AocMember, day: number): MemberDay {
  const star1Timestamp = getStarTimestamp(member, day, 1);
  const star2Timestamp = getStarTimestamp(member, day, 2);
  const startTime = getDayStartTime(day, star1Timestamp);

  const buildStar = (ts: number | void, startTime: number | void, star: number) => {
    if (!ts || !startTime) {
      return undefined;
    }
    const duration = ts - startTime;
    return {
      index: star,
      timestamp: ts,
      duration,
    };
  };

  return {
    day,
    star1: buildStar(star1Timestamp, startTime, 1),
    star2: buildStar(star2Timestamp, startTime, 2),
    score: 0,
  };
}

const colors = [
  'rgba(255, 99, 132, 1)',
  'rgba(54, 162, 235, 1)',
  'rgba(255, 206, 86, 1)',
  'rgba(75, 192, 192, 1)',
  'rgba(153, 102, 255, 1)',
  'rgba(255, 159, 64, 1)',
];

const last = <T>(arr: T[]): T => arr[arr.length - 1];

let activeChart: Chart | void = undefined;

type Comparable = undefined | number | string;
function minOf<T>(arr: T[]): T;
function minOf<T, K extends Comparable>(arr: T[], accessor: (item: T) => K): K;
// @ts-ignore
function minOf<T, K extends Comparable>(arr: T[], accessor: (item: T) => K = x => x) {
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

function buildDifferenceChart(el: HTMLElement, members: Member[]) {
  const isActiveMember = (member: Member) => member.score > 50;

  const allPoints = members.filter(isActiveMember).map(x => getPoints(x, { allowEmpty: true }));
  const minOfDay = range(25).map(i => {
    return minOf(allPoints.map(p => p[i]));
  });

  createChart('Point Differrence', {
    type: 'line',
    data: {
      labels: range(25).map(x => String(x + 1)),
      datasets: members.map((m, i) => {
        const data = isActiveMember(m)
          ? getPoints(m).map((value, index) => {
              const min = minOfDay[index];
              if (min == null || value == null) {
                return undefined;
              }
              return value - min;
            })
          : [];
        return {
          label: m.name,
          data: data,
          fill: false,
          borderColor: colors[i],
          lineTension: 0,
        };
      }),
    },
    options: { maintainAspectRatio: false },
  });
}

function buildRankChart(el: HTMLElement, members: Member[]) {
  const memberPoints = members.map(m => {
    return {
      member: m,
      points: getPoints(m, { allowEmpty: true }),
    };
  });

  const pointsPerDay = range(25).map(i => {
    return memberPoints.map(x => x.points[i]).sort(byNumberReverse);
  });
  const positions = memberPoints.map(mp => {
    const points = memberPoints.find(x => x.member === mp.member)?.points;

    const d = range(25).map(d => {
      const value = points?.[d];
      if (value === undefined) {
        return undefined;
      }
      const day = pointsPerDay[d];
      return members.length - day.indexOf(value);
    });

    return {
      member: mp.member,
      positions: d,
    };
  });

  createChart('Rank', {
    type: 'line',
    data: {
      labels: range(25).map(x => String(x + 1)),
      datasets: positions.map((m, i) => {
        return {
          label: m.member.name,
          data: m.positions,
          fill: false,
          borderColor: colors[i],
          lineTension: 0,
          spanGaps: true,
        };
      }),
    },
    options: {
      scales: {
        yAxes: [
          {
            display: false,
            ticks: {
              stepSize: 1,
            },
          },
        ],
      },
    },
  });
}

function buildPointChart(el: HTMLElement, members: Member[]) {
  createChart('Points', {
    type: 'line',
    data: {
      labels: range(25).map(x => String(x + 1)),
      datasets: members.map((m, i) => {
        const data = getPoints(m);
        return {
          label: m.name,
          data,
          fill: false,
          borderColor: colors[i],
          lineTension: 0,
          spanGaps: true,
        };
      }),
    },
  });
}

function createChart(title: string, config: ChartConfiguration) {
  const ctx = (element('rank-chart') as HTMLCanvasElement).getContext('2d');
  activeChart && activeChart.destroy();

  if (!ctx) throw new Error('unable to get context');

  return (activeChart = new Chart(ctx, {
    ...config,
    options: {
      animation: undefined,
      maintainAspectRatio: false,
      title: { display: true, text: title, padding: 20 },
      legend: { display: true, position: 'left' },
      ...config.options,
    },
  }));
}

function buildPointsByDeltaChart(el: HTMLElement, members: Member[]) {
  const delta = members.map(m => {
    return m.days.map(d => {
      const t1 = d.star1?.timestamp;
      const t2 = d.star2?.timestamp;
      return t2 != null && t1 != null ? t2 - t1 : Number.MAX_SAFE_INTEGER;
    });
  });

  const positions = range(25).map(day => {
    return delta
      .map((scores, memberIndex) => ({ memberIndex, delta: scores[day] }))
      .sort((l, r) => r.delta - l.delta)
      .map((item, i) => ({
        ...item,
        score: item.delta === Number.MAX_SAFE_INTEGER ? 0 : i + 1,
      }));
  });

  const additive = members.map((m, memberIndex) => {
    return range(25).reduce((acc, day) => {
      const score = positions[day]?.find(x => x.memberIndex === memberIndex);
      const totalScore = day > m.lastAttempted ? undefined : (acc[day - 1] ?? 0) + (score?.score ?? 0);
      return [...acc, totalScore];
    }, [] as (number | undefined)[]);
  });

  createChart('Points by Delta', {
    type: 'line',
    data: {
      labels: range(25).map(x => String(x + 1)),
      datasets: members.map((m, i) => {
        const data = additive[i];
        return {
          label: m.name,
          data,
          fill: false,
          borderColor: colors[i],
          lineTension: 0,
          spanGaps: true,
        };
      }),
    },
  });
}

function buildRollingAverageChart(el: HTMLElement, members: Member[]) {
  const AVG_SIZE = 5;

  const allPoints = members
    .map(m => getDayPoints(m))
    .map(points => range(25).map(day => (points[day] == null ? undefined : avgLast(points, day, AVG_SIZE))));

  createChart(`${AVG_SIZE} Day Moving Average`, {
    type: 'line',
    data: {
      labels: range(25).map(x => String(x + 1)),
      datasets: members.map((m, i) => {
        const data = allPoints[i];
        return {
          label: m.name,
          data,
          fill: false,
          borderColor: colors[i],
          lineTension: 0,
          spanGaps: true,
        };
      }),
    },
  });
}

const avgLast = (arr: PointArray, index: number, count = 5) => {
  const actualCount = index + 1 < count ? index + 1 : count;
  if (actualCount === 0) return 0;
  let sum = 0;
  for (let i = index; i > index - actualCount; i--) {
    sum += arr[i] ?? 0;
  }

  return sum / actualCount;
};

function buildAveragePointsChart(el: HTMLElement, members: Member[]) {
  const allPoints = members
    .map(x => getPoints(x, { allowEmpty: false }))
    .map(points => points.map((p, i) => (p ?? 0) / (i + 1)));

  createChart('Average Points', {
    type: 'line',
    data: {
      labels: range(25).map(x => String(x + 1)),
      datasets: members.map((m, i) => {
        const data = allPoints[i];
        return {
          label: m.name,
          data,
          fill: false,
          borderColor: colors[i],
          // cubicInterpolationMode: 'monotone',
          lineTension: 0,
          spanGaps: true,
        };
      }),
    },
  });
}
type PointArray = (number | undefined)[];
const getPoints = (member: Member, opts?: { allowEmpty: boolean }): PointArray => {
  type Accumulator = undefined | PointArray;

  return member.days.reduce<Accumulator>((acc, day) => {
    const { allowEmpty = false } = opts ?? {};
    if (acc === undefined) {
      return [day.score];
    } else {
      const previousScore = last(acc.filter(Boolean));
      const score = day.score ? day.score : day.day <= member.lastAttempted ? 0 : allowEmpty ? 0 : undefined;
      return [...acc, score != null && previousScore ? previousScore + score : undefined];
    }
  }, undefined) as PointArray;
};

const getDayPoints = (member: Member, opts?: { allowEmpty: boolean }): PointArray =>
  member.days.reduce((acc, day) => {
    const { allowEmpty = false } = opts ?? {};
    if (acc === undefined) {
      return [day.score];
    } else {
      const score = day.score ? day.score : day.day <= member.lastAttempted ? 0 : allowEmpty ? 0 : undefined;
      return [...acc, score];
    }
  }, undefined as undefined | PointArray) as PointArray;

function initialize(members: Member[]) {
  element('medals').appendChild(buildMedalGrid(members));

  element('show-point-chart').onclick = function () {
    buildPointChart(element('rank-chart'), members);
  };
  element('show-rank-chart').onclick = function () {
    buildRankChart(element('rank-chart'), members);
  };
  element('show-difference-chart').onclick = function () {
    buildDifferenceChart(element('rank-chart'), members);
  };
  element('show-average-points-chart').onclick = function () {
    buildAveragePointsChart(element('rank-chart'), members);
  };
  element('show-sliding-average-chart').onclick = function () {
    buildRollingAverageChart(element('rank-chart'), members);
  };
  element('show-points-by-delta-chart').onclick = function () {
    buildPointsByDeltaChart(element('rank-chart'), members);
  };

  const chartEl = element('rank-chart');
  buildPointChart(chartEl, members);

  const grid = element('ranking-grid');
  const days = dataByDay(members);

  append(grid, [
    div({ class: 'day title' }, ''),
    div({ class: 'name title' }, 'name'),
    div({ class: 'time title' }, 'star 1'),
    div({ class: 'trophy title empty' }),
    div({ class: 'time title' }, 'star 2'),
    div({ class: 'trophy title empty' }),
  ]);
  days.forEach(day => {
    const winner = fastestScore(day.scores, 2);
    if (!winner) return;
    append(grid, [
      div({ class: 'day link value', onclick: () => showStatsForDay(day) }, (day.day + 1).toString()),
      div({ class: 'name value' }, winner.name),
      div({ class: 'time value' }, formatStarTime(winner.star1)),
      starTrophy(winner.star1),
      div({ class: 'time value' }, formatStarTime(winner.star2)),
      starTrophy(winner.star2),
    ]);
  });

  const delay = Math.max(0, 1200 - (Date.now() - PARSE_TIME));

  setTimeout(() => element('container').classList.remove('loading'), delay);
}

function starDuration(star: Star | undefined) {
  if (!star) return Number.MAX_SAFE_INTEGER;
  if (star.gaveUp) return Number.MAX_SAFE_INTEGER / 2 + star.duration;
  return star.duration;
}

function showStatsForDay(day: DataByDayItem) {
  const el = element('speed-grid');
  while (el.lastChild) el.removeChild(el.lastChild);

  element('day').innerText = `Day ${day.day + 1}`;

  const sorted = [...day.scores].sort((l, r) => {
    const l1 = starDuration(l.star1);
    const l2 = starDuration(l.star2);
    const r1 = starDuration(r.star1);
    const r2 = starDuration(r.star2);

    return r2 === l2 ? l1 - r1 : l2 - r2;
  });

  const getDelta = (d: MemberDay) => {
    const t1 = d.star1?.timestamp;
    const t2 = d.star2?.timestamp;
    return t2 != null && t1 != null ? t2 - t1 : undefined;
  };

  sorted.forEach((user, index) => {
    append(el, [
      div({ class: 'day value' }, (index + 1).toString()),
      div({ class: 'name value' }, user.name),
      div({ class: 'time value' }, formatStarTime(user.star1)),
      starTrophy(user.star1),
      div({ class: 'time value' }, formatStarTime(user.star2)),
      starTrophy(user.star2),
      div({ class: 'time value' }, formatDuration(getDelta(user))),
    ]);
  });
}

function fastestScore(scores: DataByDayScore[], star: number) {
  if (scores.length === 0) {
    return null;
  }
  const sorted = [...scores].sort((l, r) => {
    const l1 = starDuration(l.star1);
    const l2 = starDuration(l.star2);
    const r1 = starDuration(r.star1);
    const r2 = starDuration(r.star2);

    if (star === 2) {
      return r2 === l2 ? l1 - r1 : l2 - r2;
    }
    return l1 - r1;
  });
  return sorted[0];
}

function buildMedalGrid(members: Member[]) {
  const el = div({ class: 'medal-grid' });
  members = [...members].sort(membersByTotalScore);

  const days = dataByDay(members);

  append(el, [
    div({ style: 'grid-column: start;' }),
    trophy(0, { class: 'header' }),
    trophy(1, { class: 'header' }),
    trophy(2, { class: 'header' }),
    div({ class: 'header' }),
    div(
      {
        class: 'name header',
        style: 'grid-column: name;',
      },
      text('Name'),
    ),

    ...days.map(day =>
      div(
        {
          class: 'day header',
          onclick: () => showStatsForDay(day),
        },
        text(day.day + 1),
      ),
    ),
    div({ class: 'header-border' }),
  ]);

  for (const member of members) {
    const row = range(25).map(i => {
      const star1 = member.days[i].star1;
      const star2 = member.days[i].star2;
      const pos1 = star1?.position ?? -1;
      const pos2 = star2?.position ?? -1;

      const star = starTrophy(star2);
      const strokeColor = ['gold', 'silver', '#cd7f32'][pos1] ?? 'transparent';
      star.style.backgroundColor = strokeColor;

      // Add a border if they finished part 1 (but didn't place) and haven't finished part 2
      const borderColor = pos2 !== -1 || pos1 <= 2 ? 'transparent' : 'rgba(0,0,0,0.2)';
      star.style['border'] = `4px solid ${borderColor}`;

      star.classList.add('day');
      if (pos2 >= 0) {
        star.style.position = 'relative';
        if (!star2?.gaveUp) {
          star.appendChild(div({ class: 'position' }, text(pos2 + 1)));
        }
      }
      return star;
    });
    el.appendChild(div({ class: 'score', style: 'grid-column: 1' }, text(member.score)));

    const medals = member.days.reduce(
      (acc, day) => {
        acc.gold += medalsForDay(day, 0);
        acc.silver += medalsForDay(day, 1);
        acc.bronze += medalsForDay(day, 2);
        acc.tin += medalsForDay(day, 3);
        return acc;
      },
      { gold: 0, silver: 0, bronze: 0, tin: 0 },
    );

    append(el, [
      div({ class: 'medal-count gold' }, text(medals.gold)),
      div({ class: 'medal-count silver' }, text(medals.silver)),
      div({ class: 'medal-count bronze' }, text(medals.bronze)),
      div({ class: 'medal-count tin' }, text(medals.tin)),
    ]);

    el.appendChild(div({ class: 'name', style: 'grid-column: name' }, text(member.name)));

    for (const r of row) {
      el.appendChild(r);
    }
    el.appendChild(div({}));
  }
  return el;
}

function medalsForDay(day: MemberDay, position: number) {
  return (isPosition(day.star1, position) ? 1 : 0) + (isPosition(day.star2, position) ? 1 : 0);
}
function isPosition(star: Star | undefined, target: number) {
  return star?.position === target;
}

type DataByDayItem = {
  day: number;
  scores: DataByDayScore[];
};
type DataByDayScore = MemberDay & { name: string };

function dataByDay(members: Member[]): DataByDayItem[] {
  return range(25)
    .map(day => ({
      day,
      scores: members
        .map(m => ({
          name: m.name,
          ...m.days[day],
        }))
        .filter(m => m.star1 || m.star2),
    }))
    .filter(d => d.scores.length > 0);
}

function range(to: number) {
  return Array.from(new Array(to), (x, i) => i);
}

function getStarTimestamp(member: AocMember, day: number, star: number) {
  const text = get(member, ['completion_day_level', String(day), String(star), 'get_star_ts']) as string | undefined;
  return text ? parseInt(text, 10) * 1000 : undefined;
}

const FIRST_DAY_TS = 1606798800000; // 2020-12-02T00:00:00-5:00
const MS_IN_DAY = 24 * 60 * 60 * 1000;
const OFFSET_930 = (9 * 60 + 30) * 60 * 1000;

function getDayStartTime(day: number, ts?: number) {
  if (!ts) return undefined;

  if (day === 25) return 1609009200000; //2020-12-26 2pm
  const startOfDay = FIRST_DAY_TS + (day - 1) * MS_IN_DAY;
  const secondStart = startOfDay + OFFSET_930;

  return ts > secondStart ? secondStart : startOfDay;
}

function formatStarTime(star: Star | undefined) {
  if (!star || !star.duration) return '';
  return formatDuration(star.duration);
}

function formatDuration(duration: number | undefined) {
  if (duration == null) return '';
  return Duration.fromMillis(duration).toFormat('hh:mm:ss');
}

function get(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    // @ts-ignore
    obj = obj[key];
    if (obj == null) {
      return undefined;
    }
  }
  return obj;
}

function text(value: string | number) {
  return document.createTextNode(String(value));
}

type NodeProps = {
  class?: string;
  style?: string | unknown;
  onclick?: () => void;
};
function node(tag: string, props: NodeProps, children?: NodeChildren) {
  const el = document.createElement(tag);
  props &&
    Object.entries(props).forEach(([key, value]) => {
      if (key.startsWith('on')) {
        // @ts-ignore
        el[key] = value;
      } else if (key === 'style' && typeof value !== 'string') {
        // @ts-ignore
        Object.entries(value).forEach(
          ([key, value]) =>
            // @ts-ignore
            (el.style[key] = value),
        );
      } else {
        el.setAttribute(key, value as string);
      }
    });
  children && append(el, children);
  return el;
}

type NodeChildren = string | Node | Text | Node[];
function div(props: NodeProps, children?: NodeChildren) {
  return node('div', props, children);
}

function append(target: HTMLElement, children?: NodeChildren) {
  if (!children) return;
  if (typeof children === 'string') target.appendChild(text(children));
  else if (Array.isArray(children)) children.forEach(c => target.appendChild(c));
  else target.appendChild(children);
}

function createTrophy() {
  const container = document.createElement('div');
  const el = document.createElement('svg');
  container.appendChild(el);

  container.innerHTML = `
        <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="star" class="svg-inline--fa fa-star fa-w-18" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M259.3 17.8L194 150.2 47.9 171.5c-26.2 3.8-36.7 36.1-17.7 54.6l105.7 103-25 145.5c-4.5 26.3 23.2 46 46.4 33.7L288 439.6l130.7 68.7c23.2 12.2 50.9-7.4 46.4-33.7l-25-145.5 105.7-103c19-18.5 8.5-50.8-17.7-54.6L382 150.2 316.7 17.8c-11.7-23.6-45.6-23.9-57.4 0z"></path></svg>
    `;
  return container.firstElementChild as SVGElement;
}

function starTrophy(star: Star | undefined, props?: NodeProps) {
  if (!star) return div({ class: 'trophy' });
  if (star.gaveUp) return div({ class: 'trophy dnf' }, text('DNF'));
  return trophy(star.position, props);
}

function trophy(position: number | undefined, props?: NodeProps) {
  if (position == null) return div({ class: 'trophy' });
  if (position === -1) return div({ class: 'trophy' });
  if (position === -2) return div({ class: 'trophy' }, text('DNF'));
  if (position < 0 || position > 2) return div({ class: 'trophy' });
  const classes = ['gold', 'silver', 'bronze'];
  const className = classes[position];

  const { class: additionalClasses, ...otherProps } = props ?? {};

  const el = node(
    'i',
    {
      class: `trophy ${className} ${additionalClasses ?? ''}`,
      ...otherProps,
    },
    trophySvg.cloneNode(true) as Element,
  );
  return el;
}

function didGiveUp(member: Member, day: number, star: number) {
  return !!get(disqualified, [member.name, String(day), String(star)]);
}

const disqualified = {
  'Chris Thomas': {
    '13': {
      '2': true,
    },
  },
  'S. Sepehr': {
    '13': {
      '2': true,
    },
  },
};
