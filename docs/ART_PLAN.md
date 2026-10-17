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

## Refinamento (17/10/2026)
- Quadros de animação: heróis com 4 (parado, passo esquerdo, passo direito, ataque); monstros com 3 (passo, pernas juntas, passo; slime: normal, achatado, esticado; morcego: asas em cima, no meio, embaixo). A animação por código continua por cima, mais suave.
- As folhas são geradas numa imagem só a partir da imagem base de cada personagem (mais coerência entre quadros), sempre de perfil olhando para a direita. Isso também corrigiu goblin, orc, esqueleto e demônio, que andavam de costas.
- O demônio, grande e com asas, encostava no vizinho na folha: a folha dele é gerada em formato 21:9 (`wide`). Gerar cada pose numa imagem separada não funciona: a IA repete a mesma pose.
- Chão refeito: grama pintada lisa, sem pontinhos; ladrilho de 128 px lógicos para a repetição não aparecer.
- A espadada do cavaleiro segue a direção do joystick (antes só esquerda/direita).

## Modelo de quadros (17/10/2026)
Toda criatura nova segue o modelo do seu papel (`FRAME_TEMPLATES` em `art/manifest.mjs`); a descrição das poses muda com o tipo de corpo (`POSES`: bípede, quadrúpede, voador, gelatinoso).

| Quadro | Monstro comum | Com ataque especial | Chefe | Herói |
|---|---|---|---|---|
| Parado | – | – | ✓ | ✓ |
| Andar: passo A, pernas juntas, passo B | ✓ | ✓ | passo A e B | passo A e B |
| Preparar ataque | – | ✓ | ✓ | – |
| Atacar | – | ✓ | ✓ | ✓ |
| Dano | ✓ | ✓ | ✓ | ✓ |
| Morte | ✓ | ✓ | ✓ | ✓ |
| Vitória | – | – | – | ✓ |

- Duas folhas por criatura, ambas a partir da imagem base: movimento e ação. Cada folha de ação começa com a pose do 1º quadro de movimento, usada só para igualar a escala entre as folhas. Figuras grandes (`wide`) dividem a ação em folhas de 2 poses.
- No jogo: o quadro de dano aparece por um instante a cada golpe; ao morrer, o monstro fica caído e some (até 60 corpos ao mesmo tempo); o herói mostra dano ao apanhar, cai na derrota e comemora na vitória.
- O chefe ganhou um ataque para usar os quadros de preparar/atacar: perto do herói, para, mostra um anel vermelho no chão por 0,9 s e golpeia a área (1,5× o dano de contato), a cada ~4 s.
- "Com ataque especial" ainda não é usado por nenhum monstro; fica pronto para criaturas novas.
