#!/bin/bash

# Print working directory and list files
echo "Current directory: $(pwd)"
echo "Files in directory:"
ls -la

# Run database migration first with more verbose output
echo "Running database migration..."
python -c "
from app import init_db, app
import os
import sqlite3

print('Database path:', os.path.abspath('esa_membership.db'))
print('Database exists before migration:', os.path.exists('esa_membership.db'))

# Force creation of the database file
if not os.path.exists('esa_membership.db'):
    print('Creating database file...')
    open('esa_membership.db', 'a').close()
    print('Database file created:', os.path.exists('esa_membership.db'))

# Run the migration
print('Running init_db...')
init_db()

# Verify the migration worked
print('Database exists after migration:', os.path.exists('esa_membership.db'))

# Check the schema
try:
    conn = sqlite3.connect('esa_membership.db')
    cursor = conn.cursor()
    cursor.execute('PRAGMA table_info(users)')
    columns = cursor.fetchall()
    print('Table schema after migration:')
    for col in columns:
        print(f'- {col[1]} ({col[2]})')
    conn.close()
except Exception as e:
    print('Error checking schema:', e)
"

# Show database after migration
echo "Database after migration:"
ls -la *.db

# Start the application with gunicorn
echo "Starting application..."
gunicorn app:app 