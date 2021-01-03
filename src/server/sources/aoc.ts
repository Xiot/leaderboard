import fetch from 'node-fetch';
import type { AocLeaderboard } from '../../client/aoc';

export type QuestionResponse = {
  timestamp: number;
};

export type ICompetition = {
  id: string;
  title: string;
  source: Source;
};

export type AdventOfCodeSourceConfig = {
  type: 'advent-of-code';
  leaderboardId: string;
  year: string;
};

export type Source = AdventOfCodeSourceConfig;

export class Competition {}

export class AdventOfCodeCompetition {
  year: number;
  leaderboardId: string;

  constructor(leaderboardId: string, year: number) {
    this.leaderboardId = leaderboardId;
    this.year = year;
  }

  async getResults() {
    const data: AocLeaderboard = await fetch(`https://portal.xiot.ca/aoc-2020.json`).then(response => response.json());
  }
}
