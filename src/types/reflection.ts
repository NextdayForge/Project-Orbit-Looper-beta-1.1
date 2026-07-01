export interface Reflection {
  id: string;
  date: string;
  sessionId?: string | null;
  mood: number;
  energy: number;
  wins: string[];
  blockers: string[];
  createdAt: string;
}
