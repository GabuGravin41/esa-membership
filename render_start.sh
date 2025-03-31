#!/bin/bash

# Run database migration first
echo "Running database migration..."
python -c "from app import init_db; init_db()"

# Start the application with gunicorn
echo "Starting application..."
gunicorn app:app 