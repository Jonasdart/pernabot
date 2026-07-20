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

def main():
    # Load env vars
    load_dotenv()
    token = os.getenv("TELEGRAM_TOKEN")
    if not token:
        logging.error("TELEGRAM_TOKEN not found in environment variables.")
        return

    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Initialize Application
    application = ApplicationBuilder().token(token).build()
    
    # Add handlers
    for handler in command_handlers:
        application.add_handler(handler)
        
    application.add_handler(presence_handler)
    
    # Run the bot
    logging.info("Bot is starting...")
    application.run_polling()

if __name__ == '__main__':
    main()
