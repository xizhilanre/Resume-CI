// packages/core/src/types/alignment.ts

export interface AlignmentOption {
  id: string;
  text: string;
}

export interface AlignmentQuestion {
  id: string;
  text: string;
  options: AlignmentOption[];
}

export interface STARBullet {
  id: string;
  situation: string;
  task: string;
  action: string;
  result: string;
}
