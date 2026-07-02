# PRD - Pernabot

## 1. Visão Geral

O Pernabot é um assistente para grupos de WhatsApp ou Telegram responsável por organizar automaticamente uma pelada de futebol.

O objetivo é eliminar completamente a necessidade de aplicativos, links ou um organizador central. Toda a interação acontece através de mensagens naturais no grupo.

O sistema será responsável por:

- Controle de presença;
- Controle de chegada;
- Formação automática dos times;
- Controle dos próximos;
- Controle de substituições;
- Aplicação das regras de rodízio.

---

# 2. Objetivos

- Não exigir instalação de aplicativo.
- Não exigir abertura de links.
- Não exigir cadastro.
- Não depender de apenas um organizador.
- Manter regras previsíveis e transparentes.
- Minimizar discussões sobre "quem é o próximo".

---

# 3. Conceitos

## Jogador

Representa um participante da pelada.

### Atributos

| Campo | Descrição |
|---------|-----------|
| Nome | Nome exibido |
| Telefone | Identificador do WhatsApp/Telegram |
| Confirmado | Confirmou presença |
| Chegou | Já chegou ao local |
| Jogando | Está em quadra |
| Goleiro | Indica se é goleiro |
| partidas_jogadas | Quantidade de partidas disputadas |
| ciclos_em_quadra | Jogos consecutivos permanecendo em quadra |
| ciclos_esperando | Jogos consecutivos aguardando |
| ordem_chegada | Ordem absoluta de chegada no dia |
| peso_sorteio | Peso utilizado apenas para desempate de saída |

---

# 4. Estados

Todo jogador possui um único estado.

```
CONFIRMADO

↓

CHEGOU

↓

AGUARDANDO

↓

JOGANDO

↓

AGUARDANDO

↓

JOGANDO
```

---

# 5. Interações

## Confirmar presença

Aceitar:

```
Eu vou
Vou
+
👍
```

O jogador da própria mensagem será confirmado.

---

## Confirmar outra pessoa

Obrigatoriamente utilizando menção.

Exemplos:

```
@Jonas vai
Vai @Jonas
```

Sem menção a mensagem será ignorada.

---

## Registrar chegada

Aceitar:

```
Cheguei
To aqui
```

---

## Registrar chegada de terceiro

Obrigatoriamente utilizando menção.

```
@Jonas chegou
```

---

## Cancelar presença

```
Não vou
-
```

---

## Cancelar presença de terceiro

Obrigatoriamente utilizando menção.

```
@Jonas não vai
```

---

# 6. Formação inicial dos times

Quando houver jogadores suficientes:

- sorteio totalmente aleatório;
- cada jogador de linha recebe um peso único.

Exemplo:

```
Peso

1
2
3
4
```

O maior peso representa o primeiro desempate para saída.

Os goleiros não participam desta numeração.

---

# 7. Atualização após cada partida

## Permanecer em quadra

```
ciclos_em_quadra++
```

---

## Permanecer aguardando

```
ciclos_esperando++
```

---

## Entrar em quadra

```
estado = JOGANDO

ciclos_em_quadra = 1

ciclos_esperando = 0

peso_sorteio = novo sorteio
```

---

## Sair da quadra

```
estado = AGUARDANDO

ciclos_em_quadra = 0

ciclos_esperando = 1

partidas_jogadas++
```

---

# 8. Escolha dos próximos

Sempre que houver vagas disponíveis, os jogadores aguardando serão ordenados utilizando o seguinte critério lexicográfico:

```sql
ORDER BY

ciclos_esperando DESC,
partidas_jogadas ASC,
ordem_chegada ASC
```

## Critérios

### 1º

Quem espera há mais partidas possui prioridade.

### 2º

Persistindo empate, entra quem jogou menos partidas.

### 3º

Persistindo empate, entra quem chegou primeiro.

---

# 9. Escolha de quem sai

Os jogadores atualmente em quadra serão ordenados utilizando:

```sql
ORDER BY

ciclos_em_quadra DESC,
partidas_jogadas DESC,
peso_sorteio DESC
```

## Critérios

### 1º

Sai quem permanece há mais partidas consecutivas.

### 2º

Persistindo empate, sai quem já disputou mais partidas.

### 3º

Persistindo empate, sai quem possui maior peso do sorteio inicial.

---

# 10. Goleiros

Caso exista goleiro aguardando:

- a substituição do goleiro ocorrerá obrigatoriamente;
- a substituição independe das regras dos jogadores de linha.

---

# 11. Regra de substituição

## Caso exista um time completo aguardando

Um time completo é formado por:

- 4 jogadores de linha

O sistema selecionará automaticamente os quatro primeiros jogadores conforme a ordenação da fila.

Os quatro entram simultaneamente.

---

## Caso não exista time completo

Entram apenas os jogadores necessários.

Saem os jogadores definidos pelo algoritmo de saída.

---

# 12. Peso do sorteio

O peso do sorteio:

- existe apenas enquanto o jogador permanece em quadra;
- é recriado toda vez que um jogador entra;
- nunca influencia quem entra;
- apenas desempata quem sai.

---

# 13. Transparência

Sempre que solicitado, o sistema poderá explicar uma decisão.

Exemplo:

```
Lucas entrou porque:

• aguardava há 3 partidas
• havia disputado apenas 2 partidas
• chegou antes de Pedro
```

Ou

```
João saiu porque:

• permaneceu 4 partidas consecutivas
• já disputou 6 partidas hoje
• possuía maior peso de desempate
```

---

# 14. Objetivo do algoritmo

O algoritmo deve garantir simultaneamente:

- equilíbrio no tempo de jogo;
- respeito à ordem de chegada;
- rodízio justo;
- previsibilidade;
- ausência de decisões arbitrárias;
- eliminação de discussões sobre "quem é o próximo".

Todas as decisões devem ser determinísticas e explicáveis aos participantes.