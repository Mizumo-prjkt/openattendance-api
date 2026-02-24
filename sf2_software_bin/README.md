# Qt SF2 DepEd Attendance App

A comprehensive application for managing, composing, and exporting DepEd Philippines SF2 (School Form 2) daily attendance records. The application provides multiple interfaces (GUI and TUI) to suit different environments and preferences, allowing users to input school details, manage student lists, track daily attendance, and generate standardized Excel reports.

## Features

- **Multi-Interface Support:**
  - **GUI Composer:** A rich, multi-screen graphical interface built with PyQt6 for intuitive data entry, student management, and attendance tracking.
  - **TUI Composer:** A terminal-based user interface using Textual for environments without a display server.
- **Automated Processing:**
  - Supports automated generation of Excel SF2 forms from JSON data files.
- **Attendance Tracking Logic:**
  - Handles holiday flagging, date-specific logic, and generates appropriate Excel formulas.
  - Preserves formatting and images from the base Excel template.

## Requirements

- Python 3.10+
- Dependencies listed in `requirements.txt`:
  - `PyQt6` (for the GUI)
  - `openpyxl` (for Excel processing)
  - `textual` & `textual-dev` (for the TUI)
  - `simple-term-menu` (for terminal prompts)
  - `Pillow` (for image processing in Excel)

## Installation & Setup

A convenient setup script is provided to create a virtual environment and install all dependencies.

1. Clone the repository and navigate to the project directory:
   ```bash
   cd qt-sf2-deped-attendance
   ```

2. Run the preparation script:
   ```bash
   bash prep.sh
   ```
   This script will:
   - Create a Python virtual environment in the `venv` folder.
   - Activate the virtual environment.
   - Upgrade `pip`.
   - Install all required dependencies from `requirements.txt`.

3. Activate the virtual environment manually (if not already active):
   ```bash
   source venv/bin/activate
   ```

## Usage Guides & Instructions

The script `main.py` is the primary entry point for the application. Make sure your virtual environment is active before running the commands.

### 1. GUI Composer (Recommended for Desktop)
Launch the graphical composer to intuitively manage school details, student information, and attendance records:
```bash
python3 main.py --composer-gui
```

### 2. TUI Composer (Terminal Interface)
Launch the terminal-based composer. Ideal for SSH sessions or environments without a graphical display:
```bash
python3 main.py --composer
```

### 3. General GUI Mode
Launch the standard GUI to select and process existing attendance data files:
```bash
python3 main.py
```

### 4. General Terminal Mode (TUI)
Launch the standard terminal interface to select and process files:
```bash
python3 main.py --terminal-only
```

### 5. Automated JSON Processing
Directly process a JSON file into an Excel SF2 report without launching an interactive interface:
```bash
python3 main.py --json path/to/data.json
```

---

## Project Structure

- `main.py`: The main entry point supporting various execution modes.
- `lib/`: Contains the core logic, UI components, and data processors.
  - `composer_gui.py`: PyQt6-based GUI Composer.
  - `composer_tui.py`: Textual-based TUI Composer.
  - `ui.py` / `tui.py`: Standard GUI and TUI interfaces.
  - `json_processor.py` / `processor.py`: Data processing and Excel generation logic.
- `prep.sh`: Bash script for environment setup.
- `sf2-template/`: Contains the base Excel templates used for generating reports.

## License
 License is MIT, 2026