// Versão de arquivo único: as músicas ficam em music/<id>.mp3 ao lado do index.html (scripts/deploy-pages.sh copia).
import { MUSIC_LOOPS } from './musicLoops';

export const MUSIC_URLS: Record<string, string> = Object.fromEntries(Object.keys(MUSIC_LOOPS).map((id) => [id, `music/${id}.mp3`]));
