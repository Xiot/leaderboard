export type Member = {
  name: string;
  days: MemberDay[];
  score: number;
  lastAttempted: number;
};

export type MemberDay = {
  day: number;
  star1?: Star;
  star2?: Star;
  score: number;
};

export type Star = {
  index: number;
  timestamp: number;
  duration: number;
  gaveUp?: boolean;
  position?: number;
};
