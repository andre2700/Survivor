# Plano de arte: teste de estilo com IA

Status: aguardando o primeiro teste com a API do Gemini. O estilo final (pixel art ou 2D cartoon) ainda não foi decidido; o usuário decide depois de ver o teste.

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
