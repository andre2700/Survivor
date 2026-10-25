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
- **Regras dos eventos:** cataclismos (chuva de meteoros, tempestade de areia...) ferem o herói **e** os inimigos (herói: 12% da vida máx.; inimigos: 35% da vida). Aliados têm força relevante: usam a arma inicial deles num nível que acompanha o do herói (70% do nível + 2 por fase) com os bônus de dano do herói. Chefes surpresa são desafiadores: elite gigante com 8× a vida de elite, dano dobrado, Resistência alta, pancada de chefe com aviso e barra de vida na tela.

**Exploração:** itens pelo mapa (cura, ímã, bomba, relíquias); setas na borda da tela apontam para eventos e pontos de interesse.

**Implementado (3a):** dados das fases, progresso e estrelas no save, mapa-múndi (`StageScene`), Bosque Outonal jogável (tom de outono sobre a arte da floresta, Chefe Orc), inimigos à distância/conjurador/explosivo (por troca de cor dos slimes até ganharem arte própria), os 6 eventos da lista, aliado, itens no mapa, setas de borda e botão "Próximo evento" no painel DEV. Baú e bomba ainda são desenhos provisórios por código.

**Implementado (3b):** Pântano Enevoado com chão, decoração (juncos, árvore de mangue, tronco, cogumelos que brilham, lagoas, lama), névoa nas bordas, lama que deixa o herói 40% mais lento, revoada de mosquitos, cerco de sapos e jacarés, e 6 criaturas novas: Sapo, Jacaré (bote: para, mostra a faixa no chão e avança em linha reta), Mosquito Gigante, Cogumelo de Esporos (à distância), Xamã Sapo (conjurador: a Onda do herói, com nível) e o chefe Rei Sapo. Baú e bomba ganharam arte.

**Implementado (3c):** Dunas Escaldantes (clima sério, dificuldade 1,9) com chão de areia, cactos, palmeiras, rochas, ossos, arbustos secos e areia movediça (herói 50% mais lento), revoada de abutres, cerco de escorpiões e cactos, e 6 criaturas novas: Escorpião, Abutre, Cacto Atirador (leque de 3 espinhos), Verme da Areia (toca: se enterra, anda como um monte de areia sem ferir no contato, um círculo marca onde vai sair e ele irrompe ferindo o herói e os inimigos em cima), Xamã Lagarto (conjurador: o Tornado do herói, com nível, que persegue devagar, puxa e fere a cada instante) e o chefe Imperador Escorpião. Eventos novos: **guerra de tribos** (duas tribos da fase lutam entre si num campo, com um elite líder cada; as duas atacam o herói quando ele chega perto; derrotar uma tribo deixa um baú; depois de 55 s quem sobrou vira inimigo comum) e **tempestade de areia** (cataclismo de 16 s: véu de areia, vento que empurra o herói, e a cada 2 s fere o herói e todos os inimigos na tela; chefes perdem só 1%). Os primeiros inimigos da partida agora são os da primeira onda da fase.

**Implementado (Marco 4, fase 5):** Floresta Sombria (clima sombrio, dificuldade 2,3): o chão é a grama da Clareira sem cor e escura, a decoração da floresta reaproveitada em tom frio, mais árvores secas, espinheiros, lápides e teias no chão (herói 30% mais lento). Perigo **escuridão**: só a área em volta do herói fica clara. Criaturas: Lobisomem (bote), Fogo-Fátuo (revoadas), Aranha Sombria (cospe teia que prende: herói a 45% da velocidade por 1,6 s), Bruxa (conjuradora: o Raio do herói, com círculo de aviso onde cada raio cai; com nível, mais raios em volta) e o chefe Ent Ancião Corrompido. Eventos novos: **santuário maldito** (escolha arriscada: fique perto 1,5 s para ativar; +1 nível em duas armas e 30% de cura, mas por 45 s os inimigos ficam 30% mais rápidos e ferem 30% a mais) e **lua de sangue** (cataclismo de 20 s: a tela fica vermelha e a cada 2 s o herói perde 4% da vida e os inimigos na tela 10%; chefes 1%).

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

**Chefes (19/10/2026):** os chefes de fase têm cerca de 120 px de altura (quase 3× o herói) e o chefe surpresa é 2,2× o monstro original. Chefes não ficam brancos ao levar golpes (levam golpes o tempo todo e ficariam brancos direto): só um leve tom avermelhado e o quadro de dano, no máximo a cada 0,9 s. A pancada com aviso no chão cresce com o tamanho do chefe.

## Ritmo de cada fase, chefes e dificuldades (20/10/2026)

**Três chefes por fase**, no fim de cada terço da partida de 15 min: o do **início** (5:00), o do **meio** (10:00) e o **final** (15:00). Os do início e do meio são criaturas da própria fase em versão gigante (arte reaproveitada, ampliada); o final é o chefe da fase e tem **fase 2**: quando a vida acaba, ele se transforma (fica invulnerável por 2,4 s, cresce, muda de cor, a vida volta a 75%) e luta com golpes novos. Vencer o do início ou do meio deixa um baú e devolve 30% da vida; com um chefe na tela chegam menos inimigos. Se o do início ainda estiver vivo aos 10:00, os dois lutam juntos.

| Fase | Início | Meio | Final (fase 2) |
|---|---|---|---|
| Clareira | Rei Slime | Lobo Alfa | Demônio Ancestral (Demônio Desperto) |
| Bosque Outonal | Magma Primordial | Senhor da Guerra Goblin | Chefe Orc (Enfurecido) |
| Pântano | Jacaré Rei | Grão-Xamã Sapo | Rei Sapo (Furioso) |
| Dunas | Verme Colossal | Ancião Lagarto | Imperador Escorpião (Venenoso) |
| Floresta Sombria | Lobisomem Alfa | Bruxa Anciã | Ent Ancião (Desperto) |

**Golpes de chefe** (`src/data/bosses.ts`, `src/systems/bossAI.ts`), todos com aviso: pancada (anel no chão), **salto** até o herói (círculo de pouso; o pouso fere, empurra e levanta pedras), **investida** em linha (faixa no chão, até 4 seguidas), **leque de tiros** mirados (gosma, bola de fogo, onda, tornado, teia), **anel de tiros** para todos os lados, **chuva** do céu (raios, meteoros ou espinhos de pedra em círculos marcados), **invocação** de ajudantes e **teletransporte** (some e reaparece perto do herói). Cada chefe escolhe pelo repertório dele e pela distância. Abaixo de uma fração da vida fica **FURIOSO**: avermelhado, mais rápido, golpes mais seguidos e com mais tiros. A barra grande na tela é só dos chefes da fase (alerta máximo); o chefe surpresa tem uma barra pequena sobre a cabeça.

**Dificuldades** por fase (`src/data/difficulty.ts`): Normal, Difícil, Muito Difícil, Pesadelo, Pesadelo+1, +2... sem fim. Cada uma se libera vencendo o chefe final da anterior na mesma fase. Vida dos inimigos ×1,8 e dano ×1,35 por nível; ouro e experiência +80% por nível; um pouco mais de inimigos. Estrelas e chefes vencidos são guardados por dificuldade.

**Ritmo desejado (Normal):** a fase nova encanta e derrota rápido; o jogador tenta de novo, compra melhorias, chega ao chefe do início, perde, melhora, vence o do início, perde no meio... até vencer o chefe final. Para isso cada partida rende ouro mesmo na derrota: **8 de ouro por minuto sobrevivido e 40 por chefe vencido** (vezes a dificuldade da fase e a recompensa da dificuldade escolhida), além das moedas.

**Números do ritmo** (ajustados com o simulador): força das fases 1 / 2,8 / 4,5 / 7 / 11 (vida dos inimigos; dano ^0,75; recompensa ^0,85), entrando com 90% no início da partida. Ao longo da partida a vida dos inimigos cresce até ×11 aos 15 min e o dano até ×1,75. Chefes: início 1.400–1.500, meio 3.500–3.700, final 9.000–9.500 de vida base, vezes a raiz do crescimento do momento em que chegam (×1,8 / ×2,6 / ×3,3) e a força da fase. Eventos de cerco e revoada não acontecem na chegada nem durante a luta com um chefe. Golpes de chefe sempre dão tempo de fugir andando (60 px/s): raio do pouso ≤ 72 px com 1,6 s de aviso, pancada ≤ 62 px com 1 s.

Resultado do robô (Cavaleiro, que não desvia tão bem quanto uma pessoa): Clareira do zero, chega ao 1º chefe na 2ª partida e vence a fase na 16ª; Bosque Outonal com as melhorias da Clareira, morre entre 2:40 e 5:00 nas primeiras, chega ao 1º chefe na 4ª, vence-o na 17ª e vence a fase na 20ª.

**Melhorias permanentes sem limite:** nenhuma tem teto. As que podem quebrar o jogo ficam caríssimas: Renascer (500 de ouro, ×3,5 a cada nível) e Visão (+1 opção por nível; 600, ×3,2).

**Seleção de fase:** uma fase por página, aberta na próxima fase a vencer. O fundo é a própria fase (chão, decoração e as criaturas andando); embaixo: dificuldade (‹ Normal ›), os três chefes (vencidos aparecem, o próximo em silhueta, os outros "?"), mistérios, perigos, tesouros e objetivos. Setas ou arrastar para o lado trocam de fase. Fase bloqueada mostra só um vislumbre: nome, frase, clima e o que falta para liberar.

**Simulador de equilíbrio** (`npm run balance -- <fase> <partidas> <herói> <dificuldade>`): um robô joga partidas aceleradas, sem desenhar a tela, guarda o ouro, compra melhorias e joga de novo; mostra em quantas partidas chegou e venceu cada chefe. O robô não desvia dos avisos, então é um piso: uma pessoa vai melhor.

## Pico Congelado, criaturas exclusivas, armadilhas e árvores bravas (20/10/2026)

**Cada criatura pertence a uma fase só** (teste automático): Clareira (slime, slime d'água, morcego, goblin, lobo), Bosque Outonal (slimes de fogo, cuspidor, de magma e bomba, goblin da terra, orc, morcego do vento), Pântano (sapo, jacaré, mosquito, cogumelo, xamã sapo), Dunas (escorpião, abutre, cacto, verme, xamã lagarto), Floresta Sombria (lobisomem, fogo-fátuo, aranha, bruxa, esqueleto) e Pico Congelado (pinguim guerreiro, coruja da nevasca, golem de neve, yeti, espectro do gelo). Cerco, revoada, tribos e a criatura dourada também são da própria fase (o "goblin dourado" vira o sapo dourado no Pântano, o pinguim dourado no Pico...).

**Chefe final da Clareira: Rei Goblin** (salto, pancada, investida, chama goblins; fase 2 "Rei Goblin Furioso"). O Demônio Ancestral fica guardado para fases avançadas. Chefes ~25% menores que antes (finais ~85–95 px, os do início e do meio ~80 px), para não perderem nitidez.

**Pico Congelado** (sombrio, força 16): chão de neve, pinheiros nevados, cristais, rochas, montes de neve, troncos congelados e **placas de gelo** onde o herói escorrega (a velocidade muda devagar). Tiros das criaturas de gelo (golem, espectro, dragão) deixam o herói lento ("CONGELADO!"). Chefes: Yeti Ancião (saltos seguidos), Rainha do Gelo (ondas, anel de gelo, espinhos, teletransporte) e Dragão de Gelo (sopro de gelo em leque, salto, investida; fase 2 "Dragão de Gelo Ancestral" com anel de 18 tiros). Eventos: **nevasca** (cataclismo: véu branco, todos 30% mais lentos, todos se ferem) e **avalanche** (uma faixa vermelha atravessa a tela por 2,6 s; depois a parede de neve esmaga quem está nela, herói e inimigos; escapar vale uma estrela).

**Coração do Vulcão** (épico, força 24): chão de rocha vulcânica, rochas, obsidiana, árvores queimadas, cinzas, **poças de lava** (queimam quem pisa, herói e inimigos; criaturas de fogo nadam nelas) e **respiros vulcânicos** (quando o herói chega perto, o chão em volta fica vermelho por 1,1 s e sobe uma coluna de fogo que fere todos no círculo). Criaturas: Salamandra, Morcego de Brasa, Golem de Magma (tanque lento que derrete numa poça de lava ao cair), Diabrete Lança-Chamas (bolas de fogo que explodem) e Serpente de Lava (mergulha e irrompe embaixo do herói). Chefes: Salamandra Rainha e Senhor das Cinzas (versões gigantes das criaturas) e o **Titã de Magma** (um vulcão nas costas; chuva de meteoros, anel de bolas de fogo, chama golens e serpentes; fase 2 "Titã Desperto"). Eventos: **erupção** (cataclismo: céu de cinzas, meteoros caem pela tela com aviso e ferem herói e inimigos) e **rio de lava** (como a avalanche, mas a parede é de lava e deixa poças que esfriam em 9 s; escapar vale uma estrela). Robô com as mesmas melhorias: um pouco mais difícil que o Pico (sobrevive ~2:00 contra ~2:30).

**Armadilhas** em todos os mapas: placa de pedra com runa. Pisou, acontece algo aleatório: explosão (fere o herói e destrói inimigos em volta), teletransporte, emboscada, tesouro, preso, cura, raios nos inimigos ou maldição.

**Árvores bravas** na Floresta Sombria: a árvore seca treme e marca o chão em vermelho por 0,8 s quando o herói chega perto, depois golpeia (herói e inimigos).

**Avisos por cima de tudo:** todos os avisos de golpe ficam acima da escuridão e do véu dos cataclismos.

**Loja de melhorias por abas:** Ataque, Defesa, Exploração e Cartas, com o total comprado em cada aba e um ponto verde quando há algo que dá para comprar.


## Itens equipáveis (20/10/2026)

**Espaços:** arma, mão secundária, elmo, armadura, botas, capa, anel ×2, amuleto e relíquia. Os itens aparecem como ícones e efeitos; as peças no corpo do herói ficam para as skins pagas.

**Aparência (decisão de 21/10/2026):** os itens não mudam o visual do herói. O visual muda só com skins completas (loja); assim cada skin sai barata (só a arte do herói) e tem mais valor. Os itens se mostram pelos efeitos únicos na partida e por um brilho no chão na cor da melhor raridade equipada (Épico ou mais). Um teste de arma, escudo e capa desenhados sobre o herói foi feito e descartado (está no histórico do git).

**Raridades:** Comum, Incomum, Raro, Épico, Lendário e Mítico, com 0–4 atributos extras e força ×1 a ×4,3. Do Raro para cima, o item ganha um **efeito único** visível na partida: Carrasco, Espelho, Sopro do Dragão, Explosão de Espinhos, Passos Ígneos, Manto da Tempestade, Vampiro, Caos, Nova de Gelo, Ímã Ancestral e Segundo Fôlego. Dois itens com o mesmo efeito somam a força. O dano dos efeitos acompanha o dano do herói e a força da fase.

**Baú da partida:** 1 item depois de 3 min, +1 por chefe vencido e +1 na vitória (a vitória garante um Raro ou melhor). O nível do item sobe com a fase e a dificuldade, e a chance de raridade sobe com a sorte, a fase, a dificuldade e os chefes vencidos.

**Forja e pó:** forjar dá +10% de força ao item (custo em ouro e pó, crescente). Desmanchar transforma o item em pó. A mochila guarda 80 itens; o excedente mais fraco vira pó sozinho.

**Nunca à venda:** itens, ovos e energia não se compram com dinheiro real (só atalhos de tempo e cosméticos).

## Plano até o lançamento (20/10/2026)

1. Itens equipáveis ✅
2. Pets com 3 evoluções (ovos de elites e chefes)
3. Montarias (no lançamento ou na 1ª atualização)
4. Mais 3 fases: Vulcão, Ruínas e Cidadela (Demônio Ancestral como chefe final): 9 no total
5. Acabamento: música e sons, tutorial, configurações, inglês e português, missões diárias e conquistas
6. Monetização: anúncios com recompensa (ouro em dobro, reviver 1 vez, rolar de novo; limite por dia), VIP de compra única, cosméticos e pacotes de ouro; AdMob com consentimento, RevenueCat, salvamento na nuvem
7. Lançamento: métricas, relatório de erros, desempenho em aparelho fraco, imagens da loja e lançamento em teste

## Pets (21/10/2026, revisto)

**6 linhagens, uma por elemento, com 6 estágios:** Ovo → Bebê → Criança → Jovem → Adulto → Supremo. Os nomes e desenhos são nossos (referências de criaturas que evoluem servem só de inspiração). **O pet cresce a cada estágio:** 14, 22, 34, 52 e 84 px de altura (o herói tem 44; o Supremo tem o porte de um chefe), com uma aura de poder a partir do Adulto.

| Elemento | Bebê | Criança | Jovem | Adulto | Supremo |
|---|---|---|---|---|---|
| Fogo | Brasinha | Dragãozinho | Draco | Draco Magma | Rei Solar |
| Água | Gotinha | Tartaruguinha | Casco-Maré | Leviatã Coral | Imperador Abissal |
| Ar | Penugem | Corujinha | Gavião-Vento | Grifo Tempestade | Roc Celeste |
| Terra | Pedrinha | Golenzinho | Golem de Pedra | Colosso de Cristal | Titã Ancestral |
| Luz | Faísca | Fadinha | Fada da Luz | Serafina | Arcanjo Radiante |
| Sombra | Sombrinha | Gatinho Sombrio | Pantera Noturna | Lobo Eclipse | Senhor do Eclipse |

**Arte:** cada forma tem a imagem base e uma folha com 4 quadros (2 de movimento, preparar e atacar); o balanço (flutuar, pulinhos) é por código. Cada evolução parte da imagem da forma anterior, para parecer o mesmo bicho crescendo. Cada linhagem tem o seu projétil (bola de fogo, orbe de água, lâmina de vento, pedra, orbe de luz, garras de sombra).

**Kits** (o ataque básico cresce em quantidade, dano e área a cada estágio, e no Adulto e no Supremo vira uma versão grandiosa: bolas de fogo gigantes, jatos d'água em linha, lâminas que atravessam e mini-tornados, pedregulhos com espinhos, pilares de luz do céu, garras gigantes; o Adulto ganha um golpe extra a cada 8 s, 50% maior no Supremo; o Supremo, um golpe na tela toda a cada 30 s):

| Linhagem | Ataque básico | Adulto | Supremo |
|---|---|---|---|
| Fogo | bolas de fogo (explodem a partir do Jovem) | Sopro de Fogo em leque | Chuva Solar: meteoros sobre os inimigos |
| Água | orbes que encharcam (área a partir do Jovem) | Onda que atravessa e empurra | Maremoto: ondas gigantes cruzam a tela |
| Ar | lâminas de vento que empurram forte | Tornado que puxa e fere | Furacão: tornado gigante atravessa a tela |
| Terra | pedras em arco que atordoam | Muralha de espinhos em volta (atordoa) | Terremoto: espinhos sob todos os inimigos |
| Luz | cura o herói aos poucos + orbes de luz | Escudo de Luz (invulnerável um instante) | Julgamento: raios de luz na tela e cura forte |
| Sombra | avança e arranha; puxa gemas; rouba ouro (Jovem+) | Frenesi: arranha vários em volta | Eclipse: a tela escurece e os inimigos sofrem |

Força por estágio: ×0,6 / 1 / 1,5 / 2,2 / 3,2, vezes o nível (+12% por nível), o dano do herói e a força da fase.

**Supremo+N (sem fim):** depois do Supremo o pet ascende: Supremo+1, +2... Cada ascensão pede nível 40 + 5N, 1.000 × (N+1) inimigos derrotados com ele e 1 + N/2 Fragmentos Ancestrais, e dá +25% de força e uma aura maior. Cerimônia própria ("ASCENDEU!").

**Mistério das evoluções:** na tela de pets as formas ainda não alcançadas aparecem só como silhueta preta, cada vez maior, com um brilho roxo.

**Teto de nível por estágio** (5, 12, 22, 35, sem teto no Supremo): no teto o XP para e a tela pede evolução. XP do próximo nível: 50 × 1,12^(nível−1). XP por partida: 10/min, 25 por chefe, 50 pela vitória. Ração (ouro): um quarto do próximo nível, preço 40 × 1,15^(nível−1).

**Requisitos para evoluir:**

| Evolução | Requisito |
|---|---|
| Ovo → Bebê | chocar (3 min de partida no primeiro ovo, 15 nos outros) |
| Bebê → Criança | nível 5 + comer 3 rações |
| Criança → Jovem | nível 12 + 300 inimigos derrotados pelo pet + vencer 1 chefe com ele |
| Jovem → Adulto | nível 22 + missão do elemento + 1 Cristal de Evolução |
| Adulto → Supremo | nível 35 + afinidade máxima (10 corações) + vencer o chefe final da fase natal no Muito Difícil com ele + 3 Fragmentos Ancestrais |

- **Missões do elemento:** Fogo derrota 1.000 inimigos queimando; Água faz 500 reações de Vapor ou Gelo; Ar empurra 2.000 inimigos; Terra atordoa 300; Luz cura 5.000 de vida; Sombra coleta 3.000 gemas (contam só as partidas com o pet).
- **Afinidade:** 1 coração a cada 3 partidas juntos (máximo 10).
- **Cristal de Evolução:** 25% por chefe vencido no Difícil ou acima. **Fragmento Ancestral:** 30% por chefe no Pesadelo ou acima. Aparecem no baú.
- **Cerimônia:** botão EVOLUIR! na tela de pets; a forma vira silhueta, pisca alternando com a nova cada vez mais rápido, clarão, "EVOLUIU!" e o nome novo.

**Ovos:** nunca à venda. Caem no baú: 20% por chefe, 30% pela vitória, 2% por elite (até 90%); o primeiro chefe vencido na vida garante um. Cada linhagem cai em fases próprias (a primeira é a fase natal). Ovo repetido vira 400 XP. Chocadeira com até 6 ovos. Uma linhagem só cai em ovos quando toda a arte dela está pronta.

**Equilíbrio:** o pet deve render uns 10–20% do dano total.

**Evolução alternativa (atualizações):** a mesma linhagem pode virar outra forma Adulto/Supremo conforme como foi criada (ex. dragão criado na neve → Draco Gélido).

## Revisão visual dos efeitos (21/10/2026)

Todos os eventos, golpes de chefes, armadilhas e árvores foram revistos na tela, fase por fase. Mudanças:
- **Avisos de golpe num estilo só** (`src/systems/telegraph.ts`): área translúcida com contorno forte (borda escura por baixo, aparece em qualquer chão) e um preenchimento que cresce até a hora do golpe, para ler quanto tempo falta; o contorno pulsa no fim. Faixas (investida, bote, onda, mira dos tiros do chefe) com setas na direção do golpe. Usado por chefes, monstros com habilidade, meteoros e árvores bravas.
- **Avalanche** com arte animada (onda de neve com blocos de gelo e pedras) no lugar do retângulo; aviso com bordas tracejadas e setas andando.
- **Lua de Sangue** com arte da lua e halo vermelho pulsando.

## Animações, atlas e menus (22/10/2026)

- **Pets:** todas as 25 formas das 6 linhagens têm folha de 4 quadros (2 de movimento, preparar e atacar); nenhum pet fica parado num quadro só. As 6 linhagens caem em ovos.
- **Heróis:** o ataque tem 3 tempos: preparar (windup), golpe (attack) e acompanhamento (follow), em 0,28 s; um disparo no meio não reinicia a animação.
- **Atlas em páginas:** as imagens do jogo são empacotadas em páginas de 2048×4096 no máximo (limite seguro de celulares simples), todas na mesma textura `atlas`.
- **Mochila:** ordem (raridade, força, nível, tipo, novos) e filtro (tudo, armas, mão secundária, armadura, joias, com efeito), salvos entre as visitas; botão para desmanchar de uma vez os itens Comuns e Incomuns sem efeito, sem forja e não equipados (pede confirmação).
- **Pets:** coleção ordenável (elemento, nível, estágio), com marca no pet que vai na partida; chocadeira em grade com os 6 ovos, barra de progresso em cada um, e tocar num ovo o põe para chocar primeiro (cada ovo guarda o próprio progresso).

## Tutorial, ajustes e missões (24/10/2026)

**Tutorial da primeira partida** (`src/systems/tutorial.ts`): balões amarelos, um de cada vez: andar (com uma mão arrastando na tela), gemas e nível, escolher a carta (na tela de nível), avisos vermelhos no chão (aos 40 s) e chefes aos 5/10/15 min (aos 70 s). Cada passo some quando o jogador faz o que ele pede, ou depois de alguns segundos. O passo fica salvo; quem passou da carta não vê de novo. Jogadores antigos (com partidas) não veem. Nos Ajustes: "Ver o tutorial de novo".

**Dicas do menu** (depois do tutorial): um balão aponta o botão que vale abrir (melhorias com ouro sobrando, equipamento com itens novos, pets com ovo pronto, missões com recompensa), uma por vez e só até o jogador tocar nele.

**Ajustes** (`src/systems/settings.ts`, no menu e na pausa): som, vibração (dano no herói e chefe vencido), tremor de tela, números de dano (os destaques aparecem sempre) e idioma (inglês em breve). Ficam salvos à parte do progresso.

**Missões diárias** (`src/data/missions.ts`, `src/systems/progress.ts`): 3 por dia, sorteadas pela data (todos recebem as mesmas), trocam à meia-noite. Cada uma dá ouro (150 + 100 por fase vencida) e 20 de pó; as 3 resgatadas abrem o **Baú Diário** (item Raro ou melhor e 40 de pó).

**Conquistas** em níveis (estrelas): Exterminador, Caçador de Chefes, Lenda, Desbravador, Sem Medo, Sobrevivente, Alquimista, Criador, Evolução e Ferreiro. Dão ouro e pó; os níveis altos dão Cristais de Evolução e Fragmentos Ancestrais. Botão MISSÕES no menu, com selo do número de recompensas esperando.

**Conferência visual:** `npm run audit` abre todas as telas, o tutorial e uma partida, em retrato e na horizontal, e salva as capturas em `screenshots/audit*` (rodar antes de publicar). `node scripts/stage-audit.mjs <fase> <pasta> [largura altura]` faz o mesmo para uma fase: a página no mapa, cada criatura, cada evento e cada chefe (`PAGE_ONLY=1` para só a página).
