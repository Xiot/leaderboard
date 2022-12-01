import { range, minOf } from './utils';
import { byNumberReverse } from './sort';
import { element } from './dom';
import { getPoints, getDayPoints, avgLast } from './standings';
import { Chart } from 'chart.js';

import type { Member } from './types';
import type { ChartConfiguration } from 'chart.js';

let activeChart: Chart | void = undefined;

const colors = [
  'rgba(255, 99, 132, 1)',
  'rgba(54, 162, 235, 1)',
  'rgba(255, 206, 86, 1)',
  'rgba(75, 192, 192, 1)',
  'rgba(153, 102, 255, 1)',
  'rgba(255, 159, 64, 1)',
];

export function createChart(title: string, config: ChartConfiguration) {
  const ctx = (element('rank-chart') as HTMLCanvasElement).getContext('2d');
  activeChart && activeChart.destroy();

  if (!ctx) throw new Error('unable to get context');

  return (activeChart = new Chart(ctx, {
    ...config,
    options: {
      animation: undefined,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: title, padding: 20 },
        legend: {
          display: true,
          position: 'left',
          labels: {
            boxHeight: 4,
            generateLabels: chart => {
              const labels = Chart.defaults.plugins.legend.labels.generateLabels(chart).map(label => ({
                ...label,
                fillStyle: label.strokeStyle,
                lineWidth: 0,
              }));
              return labels;
            },
          },
        },
        tooltip: {
          callbacks: {
            labelColor: ctx => {
              // @ts-ignore - base types seem incorrect
              const base = Chart.defaults.plugins.tooltip.callbacks.labelColor(ctx);
              base.backgroundColor = base.borderColor;
              base.borderWidth = 2;
              return base;
            },
          },
        },
      },

      ...config.options,
    },
  }));
}

export function buildDifferenceChart(el: HTMLElement, members: Member[]) {
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
                return null;
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

export function buildRankChart(el: HTMLElement, members: Member[]) {
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
        return null;
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
        yAxis: {
          display: false,
          ticks: {
            stepSize: 1,
          },
        },
      },
    },
  });
}

export function buildPointChart(el: HTMLElement, members: Member[]) {
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

export function buildPointsPerDayChart(el: HTMLElement, members: Member[]) {
  createChart('Points Per Day', {
    type: 'line',
    data: {
      labels: range(25).map(x => String(x + 1)),
      datasets: members.map((m, i) => {
        return {
          label: m.name,
          data: m.days.map(day => day.score).filter(Boolean),
          fill: false,
          borderColor: colors[i],
          lineTension: 0,
          spanGaps: true,
        };
      }),
    },
  });
}

export function buildPointsByDeltaChart(el: HTMLElement, members: Member[]) {
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
      const totalScore = day > m.lastAttempted ? null : (acc[day - 1] ?? 0) + (score?.score ?? 0);
      return [...acc, totalScore];
    }, [] as (number | null)[]);
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

export function buildRollingAverageChart(el: HTMLElement, members: Member[]) {
  const AVG_SIZE = 5;

  const allPoints = members
    .map(m => getDayPoints(m))
    .map(points => range(25).map(day => (points[day] == null ? null : avgLast(points, day, AVG_SIZE))));

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

export function buildAveragePointsChart(el: HTMLElement, members: Member[]) {
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
