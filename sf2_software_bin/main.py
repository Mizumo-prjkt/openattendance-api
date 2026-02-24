#!/usr/bin/env python3
import sys
import argparse
import os

# Ensure lib can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from lib import parser

def main():
    parser_args = argparse.ArgumentParser(description="SF2 Attendance Tool")
    parser_args.add_argument("--parse-data", type=str, help="Path to file to parse", default=None)
    parser_args.add_argument("--terminal-only", action="store_true", help="Force terminal only mode")
    parser_args.add_argument("--autoyes", action="store_true", help="Skip confirmation prompts")
    parser_args.add_argument("--composer", action="store_true", help="Launch the TUI Composer directly")
    parser_args.add_argument("--composer-gui", action="store_true", help="Launch the GUI Composer directly")
    parser_args.add_argument("--json-lintcheck", type=str, help="Lint and check JSON file syntax and schema")
    parser_args.add_argument("--json", type=str, help="Path to JSON file for automated processing")
    parser_args.add_argument("--force-yes", action="store_true", help="Force automatic splitting of Excel sheets if student limits are exceeded")
    
    args = parser_args.parse_args()

    # Lint Check
    if args.json_lintcheck:
        from lib import json_lintcheck
        success = json_lintcheck.check_json(args.json_lintcheck)
        sys.exit(0 if success else 1)

    # JSON Mode
    if args.json:
        try:
            from lib import guardrails
            guardrails.validate_student_count(args.json, force_split=args.force_yes)
            
            from lib import json_processor
            json_processor.process_json_to_excel(args.json, force_split=args.force_yes)
            sys.exit(0)
        except Exception as e:
            if type(e).__name__ == "StudentLimitExceeded":
                print(e)
            else:
                print(f"Error processing JSON: {e}")
            sys.exit(1)

    # 2. Modes
    if args.composer:
        # Launch TUI Composer
        from lib.composer_tui import run_composer
        res = run_composer()
        print(f"Composer exited with: {res}")
        sys.exit(0)

    if args.composer_gui:
        # Launch GUI Composer
        try:
            from PyQt6.QtWidgets import QApplication, QMessageBox
            from lib.composer_gui import run_composer_gui
            
            # Check if we can connect to a display (rudimentary check for Linux)
            if sys.platform.startswith('linux') and not os.environ.get('DISPLAY') and not os.environ.get('WAYLAND_DISPLAY'):
                 raise OSError("No display detected")

            app = QApplication(sys.argv)
            run_composer_gui()
            sys.exit(app.exec())
        except (ImportError, OSError) as e:
            print(f"GUI Composer initialization failed ({e}). Falling back to terminal mode...")
            # If GUI composer fails, maybe offer TUI composer or just exit?
            # For now, just exit.
            sys.exit(1)
        except Exception as e:
            print(f"An unexpected error occurred during GUI Composer launch: {e}")
            sys.exit(1)

    if args.terminal_only:
        handle_terminal_mode(args)
        return

    # GUI Mode
    try:
        from PyQt6.QtWidgets import QApplication, QMessageBox
        from lib import ui
        
        # Check if we can connect to a display (rudimentary check for Linux)
        if sys.platform.startswith('linux') and not os.environ.get('DISPLAY') and not os.environ.get('WAYLAND_DISPLAY'):
             raise OSError("No display detected")

        app = QApplication(sys.argv)
    except (ImportError, OSError, Exception) as e:
        print(f"GUI initialization failed ({e}). Falling back to terminal mode...")
        handle_terminal_mode(args)
        return

    window = ui.MainWindow()
    
    if args.parse_data:
        if args.autoyes:
            # Auto-load and show
            window.show()
            window.process_file(args.parse_data)
        else:
            # Ask for confirmation
            reply = QMessageBox.question(None, 'Confirm Parse', 
                                         f"Do you want to parse {args.parse_data}?",
                                         QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No, 
                                         QMessageBox.StandardButton.No)
            
            if reply == QMessageBox.StandardButton.Yes:
                window.show()
                window.process_file(args.parse_data)
            else:
                window.show()
    else:
        window.show()
        
    sys.exit(app.exec())

def handle_terminal_mode(args):
    """Handles logic for terminal-only execution."""
    
    # If no file is provided, launch TUI in file selector mode
    if not args.parse_data and not args.composer:
        while True:
            try:
                from lib import tui
                result = tui.run_tui()
                
                if result == "COMPOSER":
                    from lib import composer_tui
                    composer_tui.run_composer()
                    continue
                elif result == "SERVER":
                    from lib.network import tui as net_tui
                    from lib.network import envparse
                    config = envparse.load_or_create_env()
                    net_tui.launch_tui(config)
                    continue
                else:
                    break # Normal exit
                    
            except ImportError as e:
                print(f"Could not load TUI: {e}")
                sys.exit(1)
            except Exception as e:
                print(f"An error occurred: {e}")
                sys.exit(1)
        return

    # Direct Composer Launch
    if args.composer:
        try:
             from lib import composer_tui
             composer_tui.run_composer()
        except ImportError as e:
             print(f"Could not load Composer: {e}")
             sys.exit(1)
        return

    if args.autoyes:
        run_cli_parse(args.parse_data)
    else:
        # Use simple-term-menu for confirmation
        try:
            from simple_term_menu import TerminalMenu
            options = ["[y] Yes", "[n] No"]
            terminal_menu = TerminalMenu(options, title=f"Confirm parsing of {args.parse_data}?")
            menu_entry_index = terminal_menu.show()
            
            if menu_entry_index == 0: # Yes
                run_cli_parse(args.parse_data)
            else:
                print("Aborted.")
                sys.exit(0)
        except ImportError:
            # Fallback to input if simple-term-menu somehow fails/not installed (though user installed it)
            confirm = input(f"Confirm parsing of {args.parse_data}? [y/N]: ")
            if confirm.lower() == 'y':
                run_cli_parse(args.parse_data)
            else:
                print("Aborted.")
                sys.exit(0)

def run_cli_parse(filepath):
    try:
        # We now launch the TUI directly with the data loaded
        try:
            from lib import tui
            tui.run_tui(filepath)
        except ImportError as e:
            print(f"Could not load TUI: {e}")
            # Fallback to print if TUI fails
            data = parser.load_data(filepath)
            print(f"Successfully parsed {len(data)} records from {filepath}")
            print(data)
            
    except Exception as e:
        print(f"Error parsing file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
