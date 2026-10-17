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

## Elementos (Marco 2)
Ciclo: Água > Fogo > Ar > Terra > Água; Luz ⇄ Trevas. Vantagem ×2, desvantagem ×0,5.
Derivados herdam das origens (Lava = Fogo+Terra, Gelo = Água+Ar, Raio = Fogo+Ar, ...).
Efeitos por chance (Queimando, Encharcado, Desequilibrado, Fraturado, Marcado, Amaldiçoado);
dois efeitos ativos no mesmo inimigo se consomem e disparam a reação do derivado.

## Arte e técnica
- Pixel art 32×32 em camadas (Marco 3); hoje 16×16 gerada por código.
- Meta: 60 FPS com 2.000 inimigos e 3.000 projéteis num celular médio.
- Todo conteúdo em dados (`src/data`), sem código por item.

## Marcos
1. Fundação de sistemas (atual) · 2. Elementos · 3. Arte 32×32 e primeiro conteúdo ·
4. Progressão e heróis · 5. Pets e montarias · 6. Lançamento.
