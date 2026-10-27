import os
import sys
import time
import base64
import json
import signal
import shutil
import subprocess
import threading
from pathlib import Path
from urllib.parse import urlparse

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

# Detect python executable in virtualenv
VENV_PYTHON = PROJECT_ROOT / ".venv" / ("Scripts" if os.name == "nt" else "bin") / ("python.exe" if os.name == "nt" else "python")
PYTHON_EXEC = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable

VENV_UVICORN = PROJECT_ROOT / ".venv" / ("Scripts" if os.name == "nt" else "bin") / ("uvicorn.exe" if os.name == "nt" else "uvicorn")
UVICORN_EXEC = str(VENV_UVICORN) if VENV_UVICORN.exists() else "uvicorn"

# Colors for terminal output
RESET = "\033[0m"
BOLD = "\033[1m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
MAGENTA = "\033[35m"
RED = "\033[31m"

def log_system(msg):
    print(f"{BOLD}{MAGENTA}[SISTEMA]{RESET} {msg}", flush=True)

def find_cloudflared():
    # 1. Search PATH
    path_found = shutil.which("cloudflared")
    if path_found:
        return path_found

    # 2. Search common Windows locations
    candidates = [
        r"C:\Program Files (x86)\cloudflared\cloudflared.exe",
        r"C:\Program Files\cloudflared\cloudflared.exe",
        str(PROJECT_ROOT / "cloudflared.exe"),
        str(PROJECT_ROOT / "cloudflared"),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None

def prepare_tunnel_config(token: str, base_url: str):
    """
    Decodes the Cloudflare Tunnel token and prepares local credentials and config.
    This guarantees routing to 127.0.0.1:8000 even if the Cloudflare Zero Trust
    Dashboard was configured with Docker's hostname (e.g. 'http://app:8000').
    """
    try:
        data = json.loads(base64.b64decode(token).decode("utf-8"))
        account_tag = data.get("a")
        tunnel_id = data.get("t")
        tunnel_secret = data.get("s")
    except Exception as e:
        log_system(f"{YELLOW}Aviso: Não foi possível decodificar o CLOUDFLARE_TUNNEL_TOKEN ({e}). Usaremos o modo --token padrão.{RESET}")
        return None

    cf_dir = PROJECT_ROOT / ".cloudflared"
    cf_dir.mkdir(parents=True, exist_ok=True)

    cred_file = cf_dir / f"{tunnel_id}.json"
    cred_data = {
        "AccountTag": account_tag,
        "TunnelID": tunnel_id,
        "TunnelSecret": tunnel_secret
    }
    with open(cred_file, "w", encoding="utf-8") as f:
        json.dump(cred_data, f, indent=2)

    parsed_url = urlparse(base_url)
    hostname = parsed_url.hostname or "ranca.duzzsystem.com.br"

    # Use forward slashes in credentials-file path for cloudflared compatibility
    cred_file_path = str(cred_file.resolve()).replace("\\", "/")

    config_file = cf_dir / "config.yml"
    config_content = f"""tunnel: {tunnel_id}
credentials-file: {cred_file_path}

ingress:
  - hostname: {hostname}
    service: http://127.0.0.1:8000
  - service: http_status:404
"""
    with open(config_file, "w", encoding="utf-8") as f:
        f.write(config_content)

    return str(config_file)

def pipe_output(proc, tag, color):
    """Pipes stdout/stderr lines with a colorful prefix."""
    try:
        for line in iter(proc.stdout.readline, ''):
            if not line:
                break
            line_str = line.rstrip()
            print(f"{color}{tag}{RESET} {line_str}", flush=True)
            if "lookup app: no such host" in line_str:
                print(f"{BOLD}{YELLOW}[DICA CLOUDFLARE]{RESET} O túnel está tentando acessar 'http://app:8000' (origem configurada no Docker).\n"
                      f" 👉 Opção 1 (Recomendada): No Cloudflare Zero Trust > Tunnels > Configure > Public Hostnames, mude o serviço de 'http://app:8000' para 'http://localhost:8000'.\n"
                      f" 👉 Opção 2: Execute como Administrador o arquivo 'configurar_hosts_admin.bat' para mapear '127.0.0.1 app'.", flush=True)
    except (ValueError, OSError):
        pass

def run_migrations():
    log_system("🔄 Executando migrações de banco de dados (migrate.py)...")
    res = subprocess.run([PYTHON_EXEC, "migrate.py"], cwd=str(PROJECT_ROOT))
    if res.returncode == 0:
        log_system("✅ Banco de dados atualizado com sucesso!")
    else:
        log_system(f"{YELLOW}⚠️ Aviso ao executar migrate.py (código {res.returncode}). Continuando...{RESET}")

def main():
    # Load .env
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")

    telegram_token = os.getenv("TELEGRAM_TOKEN")
    base_url = os.getenv("BASE_URL", "https://ranca.duzzsystem.com.br")
    cf_token = os.getenv("CLOUDFLARE_TUNNEL_TOKEN")

    print("=" * 65)
    print(f"{BOLD}{GREEN}⚽ PERNABOT & DASHBOARD WEB - INICIALIZADOR WINDOWS{RESET}")
    print("=" * 65)
    print(f" • Python Executável : {PYTHON_EXEC}")
    print(f" • Base URL          : {base_url}")
    print(f" • Telegram Token    : {'Configurado' if telegram_token else 'NÃO ENCONTRADO'}")
    print(f" • Cloudflare Tunnel : {'Configurado' if cf_token else 'NÃO ENCONTRADO'}")
    print("=" * 65)

    # 1. Run migrations
    run_migrations()

    processes = []
    threads = []

    def cleanup(signum=None, frame=None):
        log_system(f"\n{YELLOW}🛑 Encerrando todos os serviços...{RESET}")
        for tag, proc in processes:
            if proc.poll() is None:
                log_system(f"Encerrando {tag}...")
                proc.terminate()
        
        # Wait up to 5 seconds for termination
        time.sleep(1)
        for tag, proc in processes:
            if proc.poll() is None:
                try:
                    proc.kill()
                except Exception:
                    pass
        log_system(f"{GREEN}Todos os serviços foram encerrados.{RESET}")
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    # 2. Start FastAPI & Frontend (uvicorn)
    log_system(f"🚀 Iniciando Servidor Web (FastAPI + Dashboard) em http://127.0.0.1:8000...")
    api_proc = subprocess.Popen(
        [UVICORN_EXEC, "src.api.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=str(PROJECT_ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    processes.append(("API", api_proc))
    t_api = threading.Thread(target=pipe_output, args=(api_proc, "[API]   ", CYAN), daemon=True)
    t_api.start()
    threads.append(t_api)

    # 3. Start Telegram Bot
    if telegram_token:
        log_system("🤖 Iniciando Pernabot Telegram Assistant...")
        bot_proc = subprocess.Popen(
            [PYTHON_EXEC, "src/main.py"],
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        processes.append(("BOT", bot_proc))
        t_bot = threading.Thread(target=pipe_output, args=(bot_proc, "[BOT]   ", GREEN), daemon=True)
        t_bot.start()
        threads.append(t_bot)
    else:
        log_system(f"{RED}TELEGRAM_TOKEN ausente no arquivo .env! Bot não será iniciado.{RESET}")

    # 4. Start Cloudflare Tunnel
    if cf_token:
        cf_bin = find_cloudflared()
        if cf_bin:
            log_system(f"🌐 Iniciando Cloudflare Tunnel ({cf_bin})...")
            config_file = prepare_tunnel_config(cf_token, base_url)
            cf_env = os.environ.copy()
            if config_file:
                # Remove tokens from child env so cloudflared respects the local config file
                cf_env.pop("CLOUDFLARE_TUNNEL_TOKEN", None)
                cf_env.pop("TUNNEL_TOKEN", None)
                cf_cmd = [cf_bin, "tunnel", "--no-autoupdate", "--config", config_file, "run"]
            else:
                cf_cmd = [cf_bin, "tunnel", "--no-autoupdate", "run", "--token", cf_token]

            cf_proc = subprocess.Popen(
                cf_cmd,
                cwd=str(PROJECT_ROOT),
                env=cf_env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
            processes.append(("TUNNEL", cf_proc))
            t_cf = threading.Thread(target=pipe_output, args=(cf_proc, "[TUNNEL]", YELLOW), daemon=True)
            t_cf.start()
            threads.append(t_cf)
        else:
            log_system(f"{RED}cloudflared não encontrado! Instale com 'winget install Cloudflare.cloudflared'.{RESET}")
    else:
        log_system(f"{YELLOW}CLOUDFLARE_TUNNEL_TOKEN não configurado no .env. Túnel ignorado.{RESET}")

    log_system(f"{BOLD}{GREEN}✨ Aplicação iniciada com sucesso! Pressione Ctrl+C para encerrar.{RESET}\n")

    # Monitor processes
    try:
        while True:
            time.sleep(1)
            for tag, proc in processes:
                ret = proc.poll()
                if ret is not None:
                    log_system(f"{RED}⚠️ O processo {tag} encerrou inesperadamente (código {ret}).{RESET}")
                    cleanup()
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()
