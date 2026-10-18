# Survivor — resumo do design

Documento completo (fonte da verdade): https://claude.ai/code/artifact/15a9f03c-abfb-4f94-b436-b21d154a7919

Este arquivo resume as decisões que o código precisa seguir.

## Pilares
1. Liberdade total de build: sem limite de armas/habilidades por partida.
2. Conteúdo combinatório: armas = padrão de ataque + elemento + modificadores + tags.
3. Crescimento infinito: nenhum atributo, arma ou progressão tem teto.
4. Partida padrão de 15 min + chefe; depois, modo infinito opcional (ciclos de 5 min). Morrer no infinito não é derrota.
5. Experimentação: nenhuma build única vence tudo.
6. Justo: 100% do conteúdo obtível jogando; anúncios só opcionais com recompensa.

## Regras numéricas
- Recarga = base ÷ (1 + velocidade de ataque) — nunca chega a zero.
- Crítico acima de 100%: o excesso vira chance de supercrítico (crítico do crítico), sem limite.
- Defesa e esquiva: retorno decrescente (`p / (p + K)`), nunca 100%.
- Quantidade acima de 8 projéteis por arma vira bônus de dano (desempenho).
- Armas sobem de nível sem teto; a cada 10 níveis, **despertar** (dano ×1,5, +1 quantidade, visual dourado).
- Cartas de nível têm raridade (Comum +1, Rara +2, Épica +3, Lendária +5) influenciada pela Sorte.

## Elementos (Marco 2 — implementado)
Dados em `src/data/elements.ts`; lógica em `src/systems/elements.ts`.
- Ciclo: Água > Fogo > Ar > Terra > Água. Vantagem ×2, desvantagem ×0,5, mesmo elemento ×0,25. Físico e Luz são neutros (Luz/Trevas entram depois).
- Derivados herdam das origens: o ataque usa a melhor vantagem entre elas (Raio = Fogo + Ar) e conta como as duas tags.
- Efeitos por chance (20% × chance da arma × (1 + potência elemental + sorte×0,5%); acima de 100% vira potência): Queimando (dano contínuo), Encharcado (−30% velocidade), Desequilibrado (empurrão, +25% chance crítica contra o alvo), Fraturado (+25% dano recebido). Inimigos não sofrem o efeito do próprio elemento.
- Dois efeitos ativos no mesmo inimigo se consomem e disparam a reação, com nome e cor na tela: Lava (explosão + queimadura), Gelo (congela), Raio (salta entre 4), Vapor (nuvem em pulsos), Lama (lentidão forte em área), Areia (tempestade em pulsos).
- Tags de elemento: 2 armas = +30% chance de efeito; 4 = +30% dano.
- Armas elementais com padrões próprios: Onda (Água, varre e empurra), Fissura (Terra, rachaduras com espinhos), Tornado (Ar, puxa e fere). Carta Catalisador (potência elemental).
- Grandeza: todo ataque cresce em faixas de nível (5, 10 = despertar, 20) até formas grandiosas (Tsunami, Terremoto, tornado gigante).
- Reações marcantes: título grande, onda de choque, clarão, véu de cor na tela, som e uma animação própria de 4 quadros no chão ou em volta do alvo, sem tampar os inimigos (erupção de lava, cristais de gelo nos pés, raios em ziguezague, colunas de vapor, poça de lama, redemoinho de areia).
- Pode haver mais de um ataque por elemento, desde que diferentes: Raio de Luz (laser que rebate nas bordas; o início acompanha o herói, a direção fica fixa), Bola de Fogo (explosão; nv 10 se divide; nv 20 Meteoro), Passos Sísmicos (ao andar, ondas de choque saem do herói em círculo e empurram os inimigos; nv 10 uma segunda onda mais larga; nv 20 uma terceira, que empurra mais), Martelo do Trovão (Raio; arremessado em linha no inimigo mais próximo, carrega os atingidos e volta para a mão; nv 5 maior, nv 10 trovão no ponto de volta, nv 20 descarga ao pegar de volta).
- Armas de corpo a corpo miram sozinhas: a Espada golpeia o inimigo mais próximo ao alcance (senão, a direção do joystick); o Machado do Bárbaro é uma machadada de duas mãos (nv 5 racha o chão, nv 10 onda de choque, nv 20 redemoinho de 360°). As Adagas vão no inimigo mais próximo.
- Heróis: o Cavaleiro tem espada e escudo; os heróis correm, com 4 tempos (pé de perto à frente, passagem, pé de longe à frente, passagem).
- Tremor de tela: leve nos golpes comuns (peso da machadada); forte só em coisas raras e poderosas (chefe, Terremoto da Fissura).
- Variantes elementais por troca de cor: Slime de Fogo, Slime d'Água, Goblin da Terra, Morcego do Vento.
- Estatísticas pós-partida mostram o dano por reação.
- Pendente: reações triplas, Luz/Trevas, resistências mostradas antes da partida.

## Arte e técnica
- Estilo cartoon 2D gerado com IA (decisão de 17/10/2026, ver docs/ART_PLAN.md), com modelo de quadros por papel de criatura.
- Meta: 60 FPS com 2.000 inimigos e 3.000 projéteis num celular médio.
- Todo conteúdo em dados (`src/data`), sem código por item.

## Marcos
1. Fundação de sistemas ✅ · 2. Elementos ✅ · 3. Mundo e fases (3a sistemas, 3b segundo mapa, 3c terceiro mapa e mais eventos) ·
4. Progressão e heróis · 5. Pets e montarias · 6. Lançamento.

## Marco 3 — Mundo e fases

**Progressão de clima:** as primeiras fases são coloridas e leves; o mundo fica mais sério, sombrio e épico a cada região. Biomas podem voltar mais adiante em versões mais avançadas (a floresta do começo e, depois, uma floresta sombria).

| # | Fase | Bioma | Clima | Elementos dominantes |
|---|---|---|---|---|
| 1 | Clareira Ensolarada | floresta | leve | neutro (aprendizado) |
| 2 | Bosque Outonal | floresta | leve | fogo e terra |
| 3 | Pântano Enevoado | pântano | leve → sério | água e terra |
| 4 | Dunas Escaldantes | deserto | sério | ar e terra |
| 5 | Floresta Sombria | floresta | sombrio | trevas (futuro), mistos |
| 6 | Pico Congelado | montanha | sombrio | água e ar |
| 7 | Coração do Vulcão | vulcão | épico | fogo |
| 8 | Ruínas Malditas | ruínas | épico | mistos |
| 9 | Cidadela Demoníaca | cidadela | épico | todos |

**Cada fase define:** aparência (chão, decoração, tom de cor), ondas e inimigos, chefe, perigo do mapa, eventos possíveis e 3 objetivos (estrelas): 1) vencer o chefe; 2) um objetivo da fase (ex.: libertar o prisioneiro); 3) um desafio (ex.: terminar com metade da vida). Vencer o chefe libera a próxima fase.

**Menu de fases:** mapa-múndi com uma trilha entre as regiões; cada fase é um ponto com suas estrelas; as bloqueadas aparecem apagadas.

**Comportamentos de inimigo:** corpo a corpo (o atual); à distância (mantém distância e atira, com aviso); conjurador (usa uma habilidade do herói com nível, que cresce com a fase e o tempo — ex.: Bola de Fogo nv 3); explosivo (corre, pisca e explode); depois: escudeiro, invocador/totem, divisor, escavador.

**Eventos aleatórios na partida:** baú guardado por elites; prisioneiro numa jaula (libertar = aliado temporário que luta com você); chefe surpresa; goblin dourado que foge com tesouro; chuva de meteoros; emboscada de elites; depois: guerra entre tribos (criaturas brigando entre si e contra o herói), santuário (escolha arriscada), mercador, totens que enfraquecem o chefe, ninhos.

**Exploração:** itens pelo mapa (cura, ímã, bomba, relíquias); setas na borda da tela apontam para eventos e pontos de interesse.

**Implementado (3a):** dados das fases, progresso e estrelas no save, mapa-múndi (`StageScene`), Bosque Outonal jogável (tom de outono sobre a arte da floresta, Chefe Orc), inimigos à distância/conjurador/explosivo (por troca de cor dos slimes até ganharem arte própria), os 6 eventos da lista, aliado, itens no mapa, setas de borda e botão "Próximo evento" no painel DEV. Baú e bomba ainda são desenhos provisórios por código.

**Etapas:** 3a sistemas (fases, menu de mapa, novos comportamentos de inimigo, eventos, itens, setas; testado com a Clareira e o Bosque Outonal, que reaproveita a arte da floresta); 3b Pântano completo; 3c Dunas, guerra entre tribos e mais eventos.

## Resistência a controle

Todo inimigo tem **Resistência** (0 a 1) contra controles: empurrão, congelamento, lentidão, puxão (tornado) e ser carregado (martelo).
- Chance de ignorar o controle = Resistência × 0,6 (aparece "RESISTIU" em elites e chefe).
- Quando pega, força e duração caem para 1 − Resistência × 0,7 (lentidões contínuas usam só essa redução).
- Valores: slime e morcego 0; goblin 0,05; lobo 0,1; esqueleto 0,15; orc 0,35; Demônio Ancestral 0,75. Elites +0,25 (máx. 0,9).
- O chefe agora pode ser congelado (raramente e por pouco tempo) e, congelado, não ataca.
- Peso (`knockback`) continua separado: diz quanto um empurrão move a criatura.

## Padrões de arte

- Todo monstro tem ao menos um quadro de ataque (mostrado quando encosta no herói).
- Todo efeito animado tem ao menos 2 quadros (onda e tornado: 4).
