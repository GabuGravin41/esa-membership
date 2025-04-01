#!/bin/bash
set -e

echo "Starting the ESA Membership application..."

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Wait for PostgreSQL database to be ready
echo "Waiting for PostgreSQL database to be ready..."
sleep 5

# Run database migrations
echo "Running database migrations..."
python -c "from app import init_db; init_db()"
echo "Database migrations completed."

# Start the application
echo "Starting the application using gunicorn..."
gunicorn app:app 