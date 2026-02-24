#!/usr/bin/env python3
import sys
import argparse
from lib.network import envparse, handshake

logger = envparse.logger

def start_server_headless(config):
    logger.info("Starting up Network Server (Headless Mode)...")
    handshake.start_server(config["HOST"], int(config["PORT"]))

def main():
    parser = argparse.ArgumentParser(description="SF2 Attendance Network Server")
    parser.add_argument("--mode", type=str, choices=["headless", "tui", "gui"],
                        help="Override the MODE defined in .env")
    
    args = parser.parse_args()

    # Load configuration
    config = envparse.load_or_create_env()

    # CLI Override
    mode = args.mode.upper() if args.mode else config.get("MODE", "HEADLESS")

    logger.info(f"Initializing SF2 Server components in {mode} mode.")

    if mode == "TUI":
        try:
            from lib.network import tui
            tui.launch_tui(config)
        except ImportError as e:
            logger.error(f"Failed to launch TUI: {e}")
            logger.info("Falling back to Headless mode.")
            start_server_headless(config)
            
    elif mode == "GUI":
        try:
            from lib.network import ui
            ui.launch_gui(config)
        except ImportError as e:
            logger.error(f"Failed to launch GUI: {e}")
            logger.info("Falling back to Headless mode.")
            start_server_headless(config)
            
    else:
         start_server_headless(config)

if __name__ == "__main__":
    main()