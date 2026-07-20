FROM python:3.10-slim

# Configurações de ambiente
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    BASE_URL=https://pelada.duzzsystem.com.br \
    DATABASE_URL=sqlite:////app/data/pernabot.db

WORKDIR /app

# Instala dependências do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instala dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia os arquivos do projeto
COPY . .

# Prepara diretório de dados e permissão do entrypoint
RUN mkdir -p /app/data && chmod +x /app/entrypoint.sh

# Porta exposta para a API e a Web
EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
