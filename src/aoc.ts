export type AocLeaderboard = {
  owner_id: string,
  event: string,
  members: {
    [memberId: string]: AocMember
  }
}

export type AocMember = {
  stars: number,
  last_star_ts: number,
  global_score: number,
  name: string,
  id: string,
  local_score: number,
  completion_day_level: {
    [day: string]: {
      [star: string]: {
        get_star_ts: string,
      }
    }
  }
};