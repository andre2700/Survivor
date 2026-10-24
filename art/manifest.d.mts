// Tipos do manifesto de arte (usado pelos testes).
export interface ArtEntry {
  role?: 'monster' | 'special' | 'boss' | 'hero' | 'vfx';
  variant?: string;
  [key: string]: unknown;
}
export const ART: Record<string, ArtEntry>;
export const FRAME_TEMPLATES: Record<'monster' | 'special' | 'boss' | 'hero' | 'vfx', { move: string[]; action: string[] }>;
export const POSES: Record<string, Record<string, string>>;
export function sheets(a: ArtEntry): { move: { slot: string; text: string }[]; actions: { slot: string; text: string }[][] };
