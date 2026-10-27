@echo off
:: Script para adicionar '127.0.0.1 app' ao arquivo hosts do Windows
:: Execute este arquivo clicando com o botão direito -> "Executar como Administrador"

echo Verificando permissao de Administrador...
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Este script precisa ser executado como Administrador!
    echo Clique com o botao direito em configurar_hosts_admin.bat e selecione 'Executar como Administrador'.
    pause
    exit /b 1
)

set HOSTS_PATH=%WINDIR%\System32\drivers\etc\hosts

findstr /i "\<app\>" "%HOSTS_PATH%" >nul
if %errorLevel% equ 0 (
    echo [OK] O host 'app' ja esta mapeado no seu arquivo hosts!
) else (
    echo Adicionando '127.0.0.1 app' ao arquivo hosts...
    echo 127.0.0.1 app>>"%HOSTS_PATH%"
    echo [SUCESSO] Host 'app' mapeado com sucesso para 127.0.0.1!
)

echo.
echo Agora o Cloudflare Tunnel conseguira rotear http://app:8000 para este computador.
pause
