import os
import logging
from dotenv import load_dotenv

# Setup centralized logging
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("logs/server_history.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("sf2_server")

ENV_FILE = ".env"

def load_or_create_env():
    """Reads .env properties. If missing, auto-generates with defaults."""
    if not os.path.exists(ENV_FILE):
        logger.info(f"No {ENV_FILE} found. Auto-generating defaults.")
        default_config = {
            "HOST": "0.0.0.0",
            "PORT": "5000",
            "MODE": "HEADLESS", # Can be HEADLESS, TUI, or GUI
        }
        _write_env(default_config)

    load_dotenv(ENV_FILE)
    
    return {
        "HOST": os.environ.get("HOST", "0.0.0.0"),
        "PORT": os.environ.get("PORT", "5000"),
        "MODE": os.environ.get("MODE", "HEADLESS")
    }

def update_env(updates):
    """Updates the .env file with a dictionary of new key-value pairs."""
    # Read existing
    current_config = {}
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, "r") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    current_config[k] = v
                    
    # Update and write
    current_config.update(updates)
    _write_env(current_config)
    
    # Reload into process environment
    for k, v in updates.items():
        os.environ[k] = str(v)
    logger.info(f"Updated {ENV_FILE} with new configurations.")

def _write_env(config_dict):
    with open(ENV_FILE, "w") as f:
        for k, v in config_dict.items():
            f.write(f"{k}={v}\n")
