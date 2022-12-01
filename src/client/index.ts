/* eslint-env browser */

import { Duration } from 'luxon';
import {
  Chart,
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Legend,
  Tooltip,
} from 'chart.js';

import { fallback, range } from './utils';
import { transformData } from './standings';
import { append, div, element, node, NodeProps, text } from './dom';
import {
  buildAveragePointsChart,
  buildDifferenceChart,
  buildPointChart,
  buildPointsByDeltaChart,
  buildRankChart,
  buildRollingAverageChart,
  buildPointsPerDayChart,
} from './charts';
import { membersByTotalScore } from './sort';

import { overrideChristmasPresent, overrideStartTime, overrideDisqualified } from './rules';

import type { Member, MemberDay, Star } from './types';

const OFFSET_930 = (9 * 60 + 30) * 60 * 1000;
const PARSE_TIME = Date.now();

const statsJsonUriGithub = 'https://raw.githubusercontent.com/Xiot/xiot.github.io/master/2020.json';
const statsJsonUriLocal = '/api/aoc/682929/2020';
const statsJsonUriPortal = 'https://portal.xiot.ca/aoc-2020.json';
const trophySvg = createTrophy();

Chart.register(LineController, CategoryScale, LinearScale, PointElement, LineElement, Title, Legend, Tooltip);

window.onload = load;

const dataSources = [statsJsonUriLocal, statsJsonUriPortal, statsJsonUriGithub];
const dataFetch = fallback(dataSources.map(url => () => fetch(url).then(r => r.json())));

function load() {
  if (window.outerWidth < 800) {
    element('root').classList.add('phone');
  }

  dataFetch
    .then(data =>
      transformData(2020, data, [
        overrideStartTime(2020, OFFSET_930),
        overrideDisqualified('Chris Thomas', 13, 2),
        overrideDisqualified('S. Sepehr', 13, 2),
        overrideChristmasPresent(),
      ]),
    )
    .then(initialize);
}

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
  element('show-points-per-day-chart').onclick = function () {
    buildPointsPerDayChart(element('rank-chart'), members);
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

function formatStarTime(star: Star | undefined) {
  if (!star || !star.duration) return '';
  return formatDuration(star.duration);
}

function formatDuration(duration: number | undefined) {
  if (duration == null) return '';
  return Duration.fromMillis(duration).toFormat('hh:mm:ss');
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
