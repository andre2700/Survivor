# Plano de arte: teste de estilo com IA

Status: **estilo cartoon escolhido em definitivo** (17/10/2026). Toda a arte do jogo foi trocada; a pixel art gerada por código foi removida.

## Contexto
- A arte atual (gerada por código em `src/art/`) é provisória.
- Opções de pacotes já pesquisadas: pixel art (Time Fantasy, Mana Seed, Ninja Adventure, Tiny Swords, Pixel Crawler) e cartoon (Hippo Character Editor 4D, DoodleDwarf Spine, Octolust, CraftPix, CartoonSmart).
- Decisões grandes de arte são sempre consultadas com o usuário antes.

## Ferramenta
`scripts/gen-image.mjs` chama a API do Gemini. A chave é um segredo de rede do ambiente (host `generativelanguage.googleapis.com`, cabeçalho `x-goog-api-key`, sem prefixo), injetado pelo proxy; `GEMINI_API_KEY` também funciona.

```bash
node scripts/gen-image.mjs --list                      # modelos de imagem disponíveis
node scripts/gen-image.mjs --out art-tests/x.png --prompt "..." [--ref ref.png]
```

## Teste de estilo
Gerar o mesmo conjunto nos dois estilos e colocar dentro do jogo para comparar lado a lado:

1. Herói cavaleiro (corpo inteiro, de lado, fundo liso para recorte)
2. Monstros: slime, goblin, lobo
3. Chefe: demônio ancestral
4. Pedaço de chão de grama (textura que se repete) + árvore
5. Ícones: espada, raio, orbe

Fluxo: gerar a primeira imagem de cada estilo, usar como `--ref` nas seguintes para manter coerência, remover o fundo, reduzir ao tamanho do jogo, montar uma cena de demonstração e tirar screenshots para o usuário.

## Resultado do primeiro teste
- Imagens brutas: `art-tests/raw/<estilo>/` (o `_style.txt` de cada pasta é o prompt de estilo; o herói foi a referência das demais).
- `python3 scripts/process-art-test.py` remove o fundo magenta, recorta e reduz para `dev/art-test/<estilo>/` nos tamanhos da arte atual (pixel em 1×, cartoon em 2× com filtro suave).
- `npm run styletest` gera `screenshots/style-test.png` com a cena `dev/style-test.html`: arte atual, pixel e cartoon lado a lado, na escala do jogo (400 px lógicos, zoom 2).
- Refeitos uma vez: goblin cartoon (vieram três), raio cartoon (fundo errado), árvore pixel (cortada).
- Observações: a grama gerada é mais saturada que a atual e precisa de ajuste de cor; o demônio pixel ficou escuro demais sobre a grama.

## Decisões (17/10/2026)
- Estilo: cartoon 2D. O usuário achou com mais personalidade e mais apelo.
- Animação: por código (uma imagem por personagem, com esticar/achatar, inclinação e respiração), em vez de quadros gerados pela IA ou esqueleto por partes.
- Interface: também cartoon. Molduras arredondadas com contorno grosso; fontes Fredoka (texto) e Lilita One (títulos e botões).
- Fluxo de produção: `art/manifest.mjs` → `scripts/gen-art.mjs` → `scripts/process-art.py` (ver README).
- Os arquivos do teste de estilo (pixel × cartoon) foram removidos; estão no histórico do git.
