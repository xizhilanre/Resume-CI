// packages/core/src/types/project.ts

export interface FlashCardData {
  id: string;
  question: string;
  answer: string;
  codeSnippet?: string;
  language?: string;
}

export interface ProjectCard {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  jdMatchScore: number;
  architecture: string;
  challenges: FlashCardData[];
}
