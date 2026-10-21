# Survivor

RPG 2D de sobrevivência em estilo cartoon para Android e iOS (e navegador). Escolha um herói, sobreviva às hordas de inimigos por 15 minutos, suba de nível escolhendo armas e melhorias, e derrote os três chefes da fase (aos 5, 10 e 15 minutos). O ouro coletado compra melhorias permanentes e novos heróis.

## Como jogar

- **Mover:** arraste o dedo em qualquer lugar da tela (joystick virtual). No computador: WASD ou setas.
- **Atacar:** automático, de acordo com as armas que você tem.
- **Subir de nível:** colete as gemas que os inimigos deixam e escolha 1 de 3 melhorias.
- **Pausar:** botão `II` (ou ESC/P no computador; botão voltar no Android).

## Conteúdo e sistemas

O design completo está em [docs/GDD.md](docs/GDD.md).

- **Sem limite de armas:** qualquer arma pode aparecer a qualquer momento, e todas sobem de nível sem teto. A cada 10 níveis a arma **desperta** (dano ×1,5, +1 quantidade, visual dourado).
- **Armas modulares** (`src/data/weapons.ts`): padrão de ataque + elemento + tags + ciclo de crescimento. Hoje: Varinha, Espada (no inimigo mais próximo ao alcance, senão na direção do joystick), Machado (machadada de duas mãos), Orbe, Aura de Fogo, Raio, Adagas (no inimigo mais próximo), Onda (Água), Fissura (Terra), Tornado (Ar), Raio de Luz (laser que rebate nas bordas da tela; o início acompanha o herói), Bola de Fogo (explode em área), Passos Sísmicos (ondas de choque em círculo saindo do herói enquanto ele anda) e Martelo do Trovão (vai em linha carregando os inimigos e volta para a mão).
- **Grandeza por nível**: os ataques começam simples e crescem em faixas (nv 5, 10 = despertar, 20). Ex.: Onda → Maremoto → Tsunami; Fissura → Terremoto → abalo na tela toda; Tornado → Ciclone → tornado gigante; Espada despertada solta a lâmina; Raio despertado salta entre inimigos; Machado racha o chão → onda de choque → redemoinho (giro completo); Martelo: maior → trovão na volta → descarga ao pegar de volta.
- **Elementos** (`src/data/elements.ts`, Marco 2): vantagens Água > Fogo > Ar > Terra > Água, efeitos por chance (Queimando, Encharcado, Desequilibrado, Fraturado) e 6 reações quando dois efeitos se encontram (Lava, Gelo, Raio, Vapor, Lama, Areia). Inimigos com variantes elementais.
- **Bônus de tags** (`src/data/tags.ts`): várias armas com a mesma tag (Projétil, Corpo a corpo, Feitiço, Área...) fortalecem todas elas.
- **Atributos globais sem teto** (`src/core/stats.ts`): dano, vel. de ataque, quantidade, área, crítico (acima de 100% vira supercrítico), defesa e esquiva com retorno decrescente, sorte, maldição etc.
- **Cartas com raridade:** Comum (+1), Rara (+2), Épica (+3), Lendária (+5); a Sorte aumenta a chance das raras. Cada carta mostra o antes e depois.
- **Rolar, Banir e Fixar** liberados na loja de melhorias.
- **Partida de 15 min com 3 chefes** (início, meio e final; o final tem fase 2), golpes variados com aviso (salto, investida, tiros, chuva do céu, invocação, teletransporte) e fúria com pouca vida (`src/data/bosses.ts`, `src/systems/bossAI.ts`); ao vencer, dá para continuar no **modo infinito** (ciclos de 5 min, cada um com chefe e inimigos mais fortes; morrer ali não é derrota).
- **Melhorias permanentes sem teto** na loja (com rolagem); as que quebram o jogo (Renascer, Visão) ficam caríssimas a cada nível. Toda partida rende ouro, mesmo perdendo (por minuto sobrevivido e por chefe vencido).
- **Dificuldades** por fase: Normal, Difícil, Muito Difícil, Pesadelo e Pesadelo+N sem fim (`src/data/difficulty.ts`).
- **Estatísticas pós-partida:** dano causado por arma.
- **Fases** (`src/data/stages.ts`, Marco 3): 9 fases, das leves às épicas; cada uma com aparência, ondas, 3 chefes, eventos e 3 objetivos (estrelas). Vencer o chefe final libera a próxima. A seleção mostra uma fase por página, com a própria fase de fundo. Jogáveis hoje: Clareira Ensolarada, Bosque Outonal (chefe: Chefe Orc) e Pântano Enevoado (chefe: Rei Sapo; névoa nas bordas da tela e lama que deixa lento; Sapo, Jacaré com bote, Mosquito, Cogumelo de Esporos e Xamã Sapo, que lança a Onda) e Dunas Escaldantes (chefe: Imperador Escorpião; areia movediça; Escorpião, Abutre, Cacto Atirador, Verme da Areia que se enterra e irrompe, e Xamã Lagarto, que lança o Tornado; eventos de guerra de tribos e tempestade de areia) e Floresta Sombria (chefe: Ent Ancião Corrompido; escuridão e teias; Lobisomem, Fogo-Fátuo, Aranha Sombria que prende com teia e Bruxa, que lança o Raio; eventos de santuário maldito e lua de sangue; árvores secas que atacam) e Pico Congelado (chefe: Dragão de Gelo; gelo escorregadio; Pinguim Guerreiro, Coruja da Nevasca, Golem de Neve, Yeti e Espectro do Gelo; eventos de nevasca e avalanche). Cada criatura pertence a uma fase só; armadilhas com runa espalhadas em todos os mapas.
- **Inimigos com habilidade** (`src/systems/enemySkills.ts`): Slime Cuspidor (atira de longe), Slime de Magma (lança a Bola de Fogo, com nível que cresce com a fase e o tempo) e Slime Bomba (pisca e explode, ferindo também os inimigos). Todo ataque tem aviso antes.
- **Eventos aleatórios** (`src/systems/runEvents.ts`): baú guardado, prisioneiro que vira aliado, chefe surpresa, goblin dourado, chuva de meteoros, emboscada, guerra de tribos, tempestade de areia, santuário maldito e lua de sangue (cataclismos ferem herói e inimigos). Itens pelo mapa (ímã, bomba, cura) e setas na borda da tela apontando para os eventos.
- **Resistência a controle:** chefes e elites ignoram ou sofrem menos empurrões, congelamento e lentidão.
- **Itens equipáveis** (`src/data/items.ts`, `src/systems/inventory.ts`, tela EQUIPAMENTO): 10 espaços (arma, mão secundária, elmo, armadura, botas, capa, 2 anéis, amuleto, relíquia), 6 raridades (Comum a Mítico) e efeitos únicos a partir do Raro, que se veem na partida (rastro de fogo, sopro do dragão, nova de gelo, espinhos, raios, vampiro, carrasco, espelho, caos, ímã, segundo fôlego; `src/systems/itemEffects.ts`). Todo fim de partida abre um baú de itens (mais itens por tempo, chefes e vitória; fases e dificuldades altas dão itens melhores). Forja (+nível com ouro e pó) e desmanche (vira pó). Itens não mudam o visual do herói (isso é das skins); Épico ou melhor equipado dá um brilho no chão.
- **Pets** (`src/data/pets.ts`, `src/systems/pets.ts`, `src/systems/petCompanion.ts`, tela PETS): 6 linhagens (uma por elemento) com 6 estágios: Ovo, Bebê, Criança, Adulto, Super e Mega. O pet segue o herói, anima (movimento, preparar, atacar) e ataca mais forte a cada estágio; o Mega tem golpe supremo. Cada estágio tem teto de nível; para evoluir, requisitos cada vez mais difíceis (rações, abates, chefe, missão do elemento, Cristal de Evolução, afinidade, prova no Muito Difícil, Fragmentos Ancestrais) e uma cerimônia de evolução. Ovos caem no baú e chocam com tempo de partida. Hoje: linhagem do Fogo (Brasinha → Dragãozinho → Draco → Draco Magma → Rei Solar).
- Heróis: Cavaleiro, Maga, Caçadora (300 de ouro), Bárbaro (600 de ouro).

### Arte

Estilo cartoon 2D (contorno grosso, sombreado suave, cores vivas), gerado com IA e preparado por scripts. O plano e as decisões estão em [docs/ART_PLAN.md](docs/ART_PLAN.md).

- `art/manifest.mjs`: lista de toda a arte, com o prompt de cada imagem e o tamanho no jogo.
- `node scripts/gen-art.mjs [nome ...]`: gera com o Gemini as imagens que faltam em `art/source/` (ou refaz as indicadas, ex. `goblin_sheet`), usando o cavaleiro como referência de estilo. Personagens ganham também as folhas de movimento e de ação do modelo de quadros, feitas a partir da própria imagem base. A chave vem de `GEMINI_API_KEY`.
- `python3 scripts/process-art.py [nome ...]`: remove o fundo, recorta, reduz, acrescenta sombra e salva em `src/assets/art/`, com o índice (resolução e quantidade de quadros) em `src/art/sprites.json`. As folhas de animação viram tiras de quadros alinhados pelos pés.
- As texturas ficam em resolução 2–4× maior que a lógica e são desenhadas no tamanho lógico (`installHdSprites` em `src/art/textures.ts`); por isso o jogo exige WebGL.
- Animação: toda criatura segue o **modelo de quadros** de `art/manifest.mjs` (`FRAME_TEMPLATES`): monstro comum com andar (3), dano e morte; chefe com parado, andar (2), preparar, atacar, dano e morte; herói com parado, andar (2), ataque, dano, morte e vitória. As poses mudam com o tipo de corpo (bípede, quadrúpede, voador, gelatinoso). O ciclo de andar e o balanço por código ficam em `src/art/motion.ts`; dano, morte, ataque e vitória são escolhidos pelo jogo.
- Efeitos (brilho, golpe, aura, vinheta) e molduras da interface são desenhados por código (`src/art/fx.ts`, `src/art/ui.ts`).
- `npm run artsheet` gera `screenshots/artsheet.png` com todos os sprites, para revisar a arte.

O jogo usa resolução lógica de 400 px de largura com zoom de 1–2× no canvas. Funciona em retrato e na horizontal (gira junto com o celular): na horizontal a partida usa a largura inteira, a altura lógica cai para 440–640 (o tamanho das coisas fica igual ao do retrato) e as telas usam duas colunas lado a lado. Na partida, pinça com dois dedos (ou roda do mouse) aproxima e afasta a câmera; o zoom fica salvo. Fontes: Fredoka (texto) e Lilita One (títulos e botões). Os sons são sintetizados com WebAudio (`src/systems/sfx.ts`).

## Desenvolvimento

### Painel DEV

Botão **DEV** no menu e na pausa (desligar `DEV_TOOLS` em `src/systems/dev.ts` antes do lançamento):
- Configurações (ficam salvas): moedas infinitas, duração da partida (15/5/3/1 min, com as ondas comprimidas), herói imortal, inimigos imortais, velocidade do jogo (1×/2×/4×).
- Na partida (pela pausa): +1 e +5 níveis, todas as armas +5, uma arma +1 nível (tocar no ícone), chamar o chefe, matar todos, avançar 1 min, curar.

Requer Node 22+.

```bash
npm install
npm run dev          # servidor local (abre no celular pela mesma rede usando o IP mostrado)
npm test             # testes de lógica (vitest)
npm run build        # build web em dist/
npm run build:single # um único dist-single/index.html com tudo embutido
npm run smoke        # abre o jogo num Chromium headless, passa por todas as telas e salva screenshots
npm run stress       # 2.000 inimigos + build grande; mede FPS e tempo de lógica por frame
npm run balance -- clareira 20   # robô joga partidas seguidas comprando melhorias: quantas partidas até cada chefe
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

## Jogar no navegador (fora do Claude)
`npm run deploy:pages` compila o jogo num arquivo só e publica na branch `gh-pages`. Com o GitHub Pages ligado nessa branch (Settings → Pages; o repositório precisa ser público no plano grátis), o jogo fica em https://andre2700.github.io/Survivor/. No iPhone, "Compartilhar → Adicionar à Tela de Início" abre em tela cheia.
