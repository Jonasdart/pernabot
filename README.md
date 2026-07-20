# ⚽ Pernabot - Bot de Pelada & Dashboard Web

**Pernabot** é uma aplicação completa para gestão de peladas de futebol. Ela combina um **Bot no Telegram** para controle interativo da presença e rotação de times em quadra com um **Dashboard Web moderno (FastAPI)** para acompanhamento de estatísticas em tempo real.

---

## 🚀 Funcionalidades

- 📌 **Controle de Presença**: Confirmação de presença (`Vou`), registro de chegada na quadra (`Cheguei`), cancelamento (`Não vou`) e marcação de pagamento (`Pago`).
- ⚖️ **Sorteio & Rotação de Quadra**: Sorteio inicial de times e motor de rotação inteligente com regra LIFO/FIFO para ordenação da fila de espera.
- 📊 **Estatísticas & Frag (V/E/D)**: Contabilização de partidas jogadas, minutos estimados em quadra e histórico de **Vitórias / Empates / Derrotas (Frag V/E/D)** por jogador.
- 💻 **Dashboard Web Responsive**: Interface visual com estética *Glassmorphic* para consultar o histórico de peladas e o desempenho de cada jogador.

---

## 📋 Pré-requisitos

- **Python**: versão 3.10 ou superior.
- **Bot Token do Telegram**: Obtido através do [@BotFather](https://t.me/BotFather).

---

## 🔧 Instalação e Configuração

### 1. Clonar o Repositório

```bash
git clone https://github.com/Jonasdart/pernabot.git
cd pelada-bot
```

### 2. Criar e Ativar o Ambiente Virtual

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Instalar as Dependências

```bash
pip install -r requirements.txt
```

### 4. Configurar as Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:

```env
TELEGRAM_BOT_TOKEN=seu_token_do_telegram_aqui
PORT=8000
```

---

## 🏃 Como Rodar o Projeto

### 1. Executar o Bot do Telegram

Para iniciar o bot e escutar os comandos do Telegram:

```bash
python src/main.py
```

### 2. Executar o Dashboard Web (API & Frontend)

Para rodar a interface web com FastAPI e Uvicorn:

```bash
uvicorn src.api.main:app --reload --port 8000
```

Após iniciar, abra o seu navegador no endereço:
👉 [http://localhost:8000](http://localhost:8000)

---

## 🧪 Testes Unitários

O projeto conta com uma suíte de testes automatizados com `pytest` dividida em **3 módulos principais**:

1. `tests/test_match_engine.py`: Testa o sorteio de times, a fila de espera e o registro de Frag (Vitórias / Empates / Derrotas).
2. `tests/test_player_service.py`: Testa a confirmação de presença, ordem de chegada e status de pagamento dos jogadores.
3. `tests/test_api.py`: Testa os endpoints REST do Dashboard Web e o retorno estruturado de estatísticas.

### Como Executar os Testes

Com o ambiente virtual ativado, execute:

```bash
pytest tests/
```

Para ver a saída detalhada dos testes:

```bash
pytest tests/ -v
```

---

## 📁 Estrutura do Projeto

```text
pelada-bot/
├── frontend/                # Interface Web (HTML, CSS Glassmorphic, Vanilla JS)
│   ├── index.html
│   ├── app.js
│   └── style.css
├── src/
│   ├── api/                 # Endpoints REST (FastAPI)
│   │   └── main.py
│   ├── bot/                 # Handlers e teclados do Telegram Bot
│   │   ├── handlers/
│   │   └── keyboards.py
│   ├── engine/              # Lógica de sorteio, rotação e explicador da fila
│   │   ├── match.py
│   │   └── explainer.py
│   ├── models/              # Modelos SQLAlchemy (Player, Session, MatchLog)
│   ├── services/            # Camada de regras de negócio de jogadores e sessões
│   ├── database.py          # Configuração da conexão com SQLite
│   └── main.py              # Ponto de entrada do Bot Telegram
├── tests/                   # Suíte de testes unitários (pytest)
│   ├── test_api.py
│   ├── test_match_engine.py
│   └── test_player_service.py
├── .env.example
├── migrate.py
├── pernabot.db              # Banco de dados SQLite local
├── requirements.txt
└── README.md
```
