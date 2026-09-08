import os

# Balance Category Configuration (Configurável para permitir fácil escala)
BALANCE_RULE_ENABLED = os.getenv("BALANCE_RULE_ENABLED", "true").lower() in ("true", "1", "yes")
BALANCE_CATEGORY_KEY = os.getenv("BALANCE_CATEGORY_KEY", "jovem")
BALANCE_CATEGORY_LABEL = os.getenv("BALANCE_CATEGORY_LABEL", "Jovens")
BALANCE_CATEGORY_EMOJI = os.getenv("BALANCE_CATEGORY_EMOJI", "🧒")
BALANCE_MAX_PER_TEAM = int(os.getenv("BALANCE_MAX_PER_TEAM", "1"))

# Goalkeeper Configuration (Fila própria, 5º jogador)
GOALKEEPERS_PER_TEAM = int(os.getenv("GOALKEEPERS_PER_TEAM", "1"))
GOALKEEPER_LABEL = os.getenv("GOALKEEPER_LABEL", "Goleiro")
GOALKEEPER_EMOJI = os.getenv("GOALKEEPER_EMOJI", "🧤")
