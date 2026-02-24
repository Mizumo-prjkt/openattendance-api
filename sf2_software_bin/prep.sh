#!/bin/bash

# Configuration
VENV_DIR="venv"
REQUIREMENTS_FILE="requirements.txt"

# Colors
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Setup for Qt SF2 Attendance App...${NC}"

# 1. Check/Create Virtual Environment
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment in '$VENV_DIR'..."
    python3 -m venv "$VENV_DIR"
else
    echo "Virtual environment '$VENV_DIR' already exists."
fi

# 2. Activate Virtual Environment
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# 3. Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# 4. Install Dependencies
if [ -f "$REQUIREMENTS_FILE" ]; then
    echo "Installing dependencies from '$REQUIREMENTS_FILE'..."
    pip install -r "$REQUIREMENTS_FILE"
else
    echo "requirements.txt not found! Generating basic one..."
    echo "PyQt6" > requirements.txt
    echo "openpyxl" >> requirements.txt
    echo "textual" >> requirements.txt
    echo "textual-dev" >> requirements.txt
    echo "simple-term-menu" >> requirements.txt
    echo "Pillow" >> requirements.txt
    echo "Flask" >> requirements.txt
    echo "python-dotenv" >> requirements.txt
    pip install -r requirements.txt
fi

echo -e "${GREEN}Setup Complete!${NC}"
echo "To run the app:"
echo "1. source $VENV_DIR/bin/activate"
echo "2. python3 main.py (GUI)"
echo "   OR"
echo "   python3 main.py --terminal-only (TUI)"
echo "   OR"
echo "   python3 main.py --composer (TUI Composer)"
echo "   OR"
echo "   python3 main.py --composer-gui (GUI Composer)"
