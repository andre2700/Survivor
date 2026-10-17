# Survivor

RPG 2D de sobrevivência em pixel art para Android e iOS (e navegador). Escolha um herói, sobreviva às hordas de inimigos por 10 minutos, suba de nível escolhendo armas e melhorias, e derrote o chefe no final. O ouro coletado compra melhorias permanentes e novos heróis.

## Como jogar

- **Mover:** arraste o dedo em qualquer lugar da tela (joystick virtual). No computador: WASD ou setas.
- **Atacar:** automático, de acordo com as armas que você tem.
- **Subir de nível:** colete as gemas que os inimigos deixam e escolha 1 de 3 melhorias.
- **Pausar:** botão `II` (ou ESC/P no computador; botão voltar no Android).

## Conteúdo

| Tipo | Itens |
| --- | --- |
| Heróis | Cavaleiro (Espada), Maga (Varinha), Caçadora (Adagas, 300 de ouro), Bárbaro (Machado, 600 de ouro) |
| Armas (até 5, nível 6) | Varinha Mágica, Espada, Machado, Orbe Sagrado, Aura de Fogo, Raio, Adagas |
| Passivas (até 6, nível 5) | Força, Vigor, Botas, Tomo Arcano, Ímã, Erva Curativa, Armadura, Sabedoria |
| Inimigos | Slime, Morcego, Esqueleto, Orc, elites dourados a cada minuto e o Demônio Ancestral (chefe aos 10:00) |
| Eventos | Revoadas de morcegos e cercos em anel |
| Melhorias permanentes | Vitalidade, Poder, Couraça, Agilidade, Atração, Crescimento, Ganância, Sorte (trocar opções), Renascer |

Toda a arte é gerada por código a partir de matrizes de pixels (`src/art/sprites.ts`) e os sons são sintetizados com WebAudio (`src/systems/sfx.ts`), então não há arquivos de asset.

## Desenvolvimento

Requer Node 22+.

```bash
npm install
npm run dev          # servidor local (abre no celular pela mesma rede usando o IP mostrado)
npm test             # testes de lógica (vitest)
npm run build        # build web em dist/
npm run build:single # um único dist-single/index.html com tudo embutido
npm run smoke        # abre o jogo num Chromium headless, joga e salva screenshots em screenshots/
```

### Estrutura

```
src/
  main.ts              configuração do Phaser (resolução 360px de largura, retrato)
  art/                 pixel art (matrizes) e geração de texturas/animações
  data/                armas, passivas, inimigos, ondas, heróis, melhorias permanentes
  systems/             atributos, sorteio de melhorias, armas, save (localStorage), sons
  scenes/              Boot/Menu/Loja, Jogo, HUD (joystick), Nível, Pausa, Fim de jogo
  entities.ts          Inimigo, Projétil e Coletável (com pool de objetos)
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
