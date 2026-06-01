// packages/core/src/types/jd.ts

export interface KeywordItem {
  word: string;
  weight: number;
  category: 'language' | 'architecture' | 'middleware' | 'devops' | 'concept';
}

export interface MatchProfile {
  score: number;
  gaps: string[];
}

export interface JDParsed {
  keywords: KeywordItem[];
  techStack: string[];
  roleType: string;
  matchProfile: MatchProfile;
}
