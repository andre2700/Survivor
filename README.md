# Survivor

RPG 2D de sobrevivência em estilo cartoon para Android e iOS (e navegador). Escolha um herói, sobreviva às hordas de inimigos por 10 minutos, suba de nível escolhendo armas e melhorias, e derrote o chefe no final. O ouro coletado compra melhorias permanentes e novos heróis.

## Como jogar

- **Mover:** arraste o dedo em qualquer lugar da tela (joystick virtual). No computador: WASD ou setas.
- **Atacar:** automático, de acordo com as armas que você tem.
- **Subir de nível:** colete as gemas que os inimigos deixam e escolha 1 de 3 melhorias.
- **Pausar:** botão `II` (ou ESC/P no computador; botão voltar no Android).

## Conteúdo e sistemas (Marco 1)

O design completo está em [docs/GDD.md](docs/GDD.md).

- **Sem limite de armas:** qualquer arma pode aparecer a qualquer momento, e todas sobem de nível sem teto. A cada 10 níveis a arma **desperta** (dano ×1,5, +1 quantidade, visual dourado).
- **Armas modulares** (`src/data/weapons.ts`): padrão de ataque + elemento + tags + ciclo de crescimento. Hoje: Varinha, Espada, Machado, Orbe, Aura de Fogo, Raio, Adagas.
- **Bônus de tags** (`src/data/tags.ts`): várias armas com a mesma tag (Projétil, Corpo a corpo, Feitiço, Área...) fortalecem todas elas.
- **Atributos globais sem teto** (`src/core/stats.ts`): dano, vel. de ataque, quantidade, área, crítico (acima de 100% vira supercrítico), defesa e esquiva com retorno decrescente, sorte, maldição etc.
- **Cartas com raridade:** Comum (+1), Rara (+2), Épica (+3), Lendária (+5); a Sorte aumenta a chance das raras. Cada carta mostra o antes e depois.
- **Rolar, Banir e Fixar** liberados na loja de melhorias.
- **Partida de 15 min + chefe**; ao vencer, dá para continuar no **modo infinito** (ciclos de 5 min, cada um com chefe e inimigos mais fortes; morrer ali não é derrota).
- **Melhorias permanentes sem teto** na loja (com rolagem).
- **Estatísticas pós-partida:** dano causado por arma.
- Heróis: Cavaleiro, Maga, Caçadora (300 de ouro), Bárbaro (600 de ouro).

### Arte

Estilo cartoon 2D (contorno grosso, sombreado suave, cores vivas), gerado com IA e preparado por scripts. O plano e as decisões estão em [docs/ART_PLAN.md](docs/ART_PLAN.md).

- `art/manifest.mjs`: lista de toda a arte, com o prompt de cada imagem e o tamanho no jogo.
- `node scripts/gen-art.mjs [nome ...]`: gera com o Gemini as imagens que faltam em `art/source/` (ou refaz as indicadas), usando o cavaleiro como referência de estilo. A chave vem de `GEMINI_API_KEY`.
- `python3 scripts/process-art.py [nome ...]`: remove o fundo, recorta, reduz, acrescenta sombra e salva em `src/assets/art/`, com o índice de resolução em `src/art/sprites.json`.
- As texturas ficam em resolução 2–4× maior que a lógica e são desenhadas no tamanho lógico (`installHdSprites` em `src/art/textures.ts`); por isso o jogo exige WebGL.
- Animação por código (`src/art/motion.ts`): cada personagem é uma imagem só, animada com esticar/achatar, inclinação e respiração.
- Efeitos (brilho, golpe, aura, vinheta) e molduras da interface são desenhados por código (`src/art/fx.ts`, `src/art/ui.ts`).
- `npm run artsheet` gera `screenshots/artsheet.png` com todos os sprites, para revisar a arte.

O jogo usa resolução lógica de 400 px de largura com zoom de 1–2× no canvas. Fontes: Fredoka (texto) e Lilita One (títulos e botões). Os sons são sintetizados com WebAudio (`src/systems/sfx.ts`).

## Desenvolvimento

Requer Node 22+.

```bash
npm install
npm run dev          # servidor local (abre no celular pela mesma rede usando o IP mostrado)
npm test             # testes de lógica (vitest)
npm run build        # build web em dist/
npm run build:single # um único dist-single/index.html com tudo embutido
npm run smoke        # abre o jogo num Chromium headless, passa por todas as telas e salva screenshots
npm run stress       # 2.000 inimigos + build grande; mede FPS e tempo de lógica por frame
```

### Estrutura

```
src/
  main.ts              configuração do Phaser (resolução 360px de largura, retrato)
  art/                 carregamento das texturas, efeitos, molduras e animação por código
  assets/art/          sprites cartoon prontos (gerados por scripts/process-art.py)
  core/                atributos globais, grade espacial, formatação de números grandes
  data/                armas, tags, cartas, inimigos, ondas, heróis, melhorias permanentes
  systems/             sorteio de cartas, armas (padrões de ataque), save (localStorage), sons
  scenes/              Boot/Menu/Loja, Jogo, HUD (joystick), Nível, Pausa, Vitória, Fim de jogo
  entities.ts          Inimigo, Projétil e Coletável (sem física; pool de objetos)
  native.ts            integração Capacitor (botão voltar, app em segundo plano)
```

Para ajustar o balanceamento, edite os arquivos em `src/data/` (vida/velocidade dos inimigos, taxa de spawn por minuto, stats de cada nível das armas).

## Android e iOS (Capacitor)

Os projetos nativos ficam em `android/` e `ios/`.

```bash
npm run android   # build + sync + abre no Android Studio
npm run ios       # build + sync + abre no Xcode (requer macOS)
```

### APK pronto pelo GitHub Actions

A cada push, o workflow **Build** roda os testes e gera um APK de debug. Para instalar no celular:

1. Abra a aba **Actions** do repositório e entre na execução mais recente do workflow **Build**.
2. Baixe o artefato `survivor-android-debug-apk` e descompacte.
3. Copie `app-debug.apk` para o Android e instale (permita "instalar apps de fontes desconhecidas").

O artefato `survivor-web` contém o jogo em um único `index.html`, que pode ser aberto direto no navegador.

Para publicar nas lojas é preciso gerar builds assinados (keystore no Android; conta Apple Developer no iOS).
