// Endereço de cada música (arquivos em src/assets/music). Na versão de arquivo único
// (vite --mode single) este módulo é trocado por musicUrls.single.ts: as músicas ficam ao lado
// do index.html, em music/, e não embutidas nele.
export const MUSIC_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/music/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>)
    .map(([path, url]) => [path.split('/').pop()!.replace('.mp3', ''), url]),
);
