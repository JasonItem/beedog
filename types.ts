export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface RoadmapPhase {
  phase: string;
  title: string;
  items: string[];
  status: 'completed' | 'current' | 'upcoming';
}

export enum SectionId {
  HERO = 'hero',
  ABOUT = 'about',
  TOKENOMICS = 'tokenomics',
  ROADMAP = 'roadmap',
  COMMUNITY = 'community',
}