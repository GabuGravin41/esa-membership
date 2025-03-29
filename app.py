from flask import Flask, request, jsonify, render_template
import sqlite3
import random

app = Flask(__name__)

# Initialize SQLite database
def init_db():
    conn = sqlite3.connect('esa_membership.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            phone TEXT UNIQUE,
            membership_code TEXT UNIQUE
        )
    ''')
    conn.commit()
    conn.close()

# Function to generate unique membership code
def generate_membership_code():
    return f"ESA{random.randint(10000, 99999)}"

# Endpoint to generate membership code
@app.route('/generate-code', methods=['POST'])
def generate_code():
    data = request.json
    name = data['name']
    email = data['email']
    phone = data['phone']
    
    conn = sqlite3.connect('esa_membership.db')
    cursor = conn.cursor()

    # Check for existing email or phone number
    cursor.execute("SELECT * FROM users WHERE email = ? OR phone = ?", (email, phone))
    existing_user = cursor.fetchone()
    if existing_user:
        conn.close()
        return jsonify({'error': 'Email or phone number already registered.'}), 400

    membership_code = generate_membership_code()

    # Ensure the code is unique
    while True:
        cursor.execute("SELECT membership_code FROM users WHERE membership_code = ?", (membership_code,))
        if cursor.fetchone() is None:
            break
        membership_code = generate_membership_code()

    # Insert user into database
    cursor.execute("INSERT INTO users (name, email, phone, membership_code) VALUES (?, ?, ?, ?)",
                   (name, email, phone, membership_code))
    conn.commit()
    conn.close()

    return jsonify({'code': membership_code})

# Endpoint to get the number of members
@app.route('/member-count', methods=['GET'])
def member_count():
    conn = sqlite3.connect('esa_membership.db')
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]
    conn.close()
    return jsonify({'member_count': count})

@app.route('/')
def index():
    return render_template('registration.html')

if __name__ == '__main__':
    init_db()  # Initialize the database
    app.run(debug=True)
