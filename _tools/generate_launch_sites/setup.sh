#!/bin/bash

# Navigate to the generate_launch_sites directory
cd "$(dirname "$0")"

# Create a virtual environment in the generate_launch_sites directory
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate

# Install the required dependencies
pip install -r requirements.txt

echo "Setup complete. Virtual environment created in generate_launch_sites/venv."
echo "To activate the environment, run: source venv/bin/activate"