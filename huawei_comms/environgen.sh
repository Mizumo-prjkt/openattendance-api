#!/bin/bash

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install huawei-lte-api

# Create requirements.txt
pip freeze > requirements.txt

# Deactivate virtual environment
deactivate