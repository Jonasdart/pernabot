import os
import sys
from pathlib import Path

# Add project root to sys.path so 'src' module can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import logging
from dotenv import load_dotenv
from telegram.ext import ApplicationBuilder
from src.database import engine, Base
import src.models  # Ensure all models are registered
from src.bot.handlers.presence import presence_handler
from src.bot.handlers.commands import handlers as command_handlers

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

import time

def main():
    # Load env vars
    load_dotenv()
    token = os.getenv("TELEGRAM_TOKEN")
    if not token:
        logging.error("TELEGRAM_TOKEN not found in environment variables.")
        return

    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Run the bot with retry resilience
    logging.info("Bot is starting...")
    max_retries = 10
    for attempt in range(1, max_retries + 1):
        try:
            # Initialize Application
            application = ApplicationBuilder().token(token).build()
            
            # Add handlers
            for handler in command_handlers:
                application.add_handler(handler)
                
            application.add_handler(presence_handler)
            application.run_polling()
            break
        except Exception as e:
            logging.error(f"Erro ao conectar com a API do Telegram (tentativa {attempt}/{max_retries}): {e}")
            if attempt < max_retries:
                time.sleep(3)
            else:
                raise e

if __name__ == '__main__':
    main()

