from flask import Flask, request, jsonify, render_template
import sqlite3
import random

app = Flask(__name__)

# Initialize SQLite database
def init_db():
    conn = sqlite3.connect('esa_membership.db')
    cursor = conn.cursor()
    
    # Check if users table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    table_exists = cursor.fetchone()
    
    if not table_exists:
        # Create table if it doesn't exist
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT UNIQUE,
                phone TEXT UNIQUE,
                membership_code TEXT UNIQUE,
                department TEXT,
                reg_number TEXT,
                year TEXT
            )
        ''')
    else:
        # Check if new columns exist, add them if they don't
        try:
            cursor.execute("SELECT department FROM users LIMIT 1")
        except sqlite3.OperationalError:
            cursor.execute("ALTER TABLE users ADD COLUMN department TEXT")
            
        try:
            cursor.execute("SELECT reg_number FROM users LIMIT 1")
        except sqlite3.OperationalError:
            cursor.execute("ALTER TABLE users ADD COLUMN reg_number TEXT")
            
        try:
            cursor.execute("SELECT year FROM users LIMIT 1")
        except sqlite3.OperationalError:
            cursor.execute("ALTER TABLE users ADD COLUMN year TEXT")
    
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
    # Get optional fields with default None if not provided
    department = data.get('department')
    reg_number = data.get('reg_number')
    year = data.get('year')
    
    conn = sqlite3.connect('esa_membership.db')
    cursor = conn.cursor()

    # Check for existing email or phone number
    cursor.execute("SELECT membership_code FROM users WHERE email = ? OR phone = ?", (email, phone))
    existing_user = cursor.fetchone()
    if existing_user:
        existing_code = existing_user[0]
        conn.close()
        # Return an error response with status code 400, but include the existing code
        return jsonify({
            'error': 'Email or phone number already registered.',
            'existing_code': existing_code,
            'success': False
        }), 400
    
    # At this point, we know the user is not a duplicate
    
    # Generate a new membership code
    membership_code = generate_membership_code()

    # Ensure the code is unique
    while True:
        cursor.execute("SELECT membership_code FROM users WHERE membership_code = ?", (membership_code,))
        if cursor.fetchone() is None:
            break
        membership_code = generate_membership_code()

    # Insert user into database
    cursor.execute(
        "INSERT INTO users (name, email, phone, membership_code, department, reg_number, year) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (name, email, phone, membership_code, department, reg_number, year)
    )
    conn.commit()
    conn.close()

    # Return success response with the generated code
    return jsonify({
        'code': membership_code,
        'success': True
    })

# Endpoint to get the number of members
@app.route('/member-count', methods=['GET'])
def member_count():
    conn = sqlite3.connect('esa_membership.db')
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]
    conn.close()
    return jsonify({'member_count': count})

# Endpoint to get all members
@app.route('/members', methods=['GET'])
def all_members():
    conn = sqlite3.connect('esa_membership.db')
    conn.row_factory = sqlite3.Row  # This enables column access by name
    cursor = conn.cursor()
    
    # Get table columns to determine what fields are available
    cursor.execute("PRAGMA table_info(users)")
    table_info = cursor.fetchall()
    column_names = [column[1] for column in table_info]
    
    # Always include id column for editing purposes
    if 'id' not in column_names:
        raise ValueError("Database schema is missing 'id' column")
    
    # Build a dynamic SELECT query based on available columns
    # Always include id first for reference
    base_columns = ["id", "name", "email", "phone", "membership_code"]
    optional_columns = ["department", "reg_number", "year"]
    
    # Combine columns that exist in the table
    select_columns = ["id"] + [col for col in base_columns[1:] + optional_columns if col in column_names and col != "id"]
    select_query = f"SELECT {', '.join(select_columns)} FROM users ORDER BY name"
    
    cursor.execute(select_query)
    members = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return render_template('members.html', members=members, columns=select_columns)

# Route to manually migrate database (admin only)
@app.route('/migrate-db', methods=['GET'])
def migrate_db():
    try:
        init_db()
        return jsonify({
            'success': True,
            'message': 'Database migration completed successfully'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Endpoint to verify member identity
@app.route('/verify-member', methods=['POST'])
def verify_member():
    data = request.json
    identifier = data['identifier']
    code = data['code']
    
    conn = sqlite3.connect('esa_membership.db')
    conn.row_factory = sqlite3.Row  # This enables column access by name
    cursor = conn.cursor()
    
    # Check if the identifier is an email or phone and the code matches
    cursor.execute("""
        SELECT * FROM users 
        WHERE (email = ? OR phone = ?) AND membership_code = ?
    """, (identifier, identifier, code))
    
    user = cursor.fetchone()
    conn.close()
    
    if user:
        return jsonify({
            'success': True,
            'user': dict(user)
        })
    else:
        return jsonify({
            'success': False,
            'error': 'Invalid credentials. Please check your email/phone and membership code.'
        }), 400

# Endpoint to update member information
@app.route('/update-member', methods=['POST'])
def update_member():
    data = request.json
    identifier = data['identifier']
    code = data['code']
    
    # Get fields to update
    name = data.get('name')
    email = data.get('email')
    phone = data.get('phone')
    department = data.get('department')
    reg_number = data.get('reg_number')
    year = data.get('year')
    
    conn = sqlite3.connect('esa_membership.db')
    cursor = conn.cursor()
    
    # First verify the user exists with provided credentials
    cursor.execute("""
        SELECT id FROM users 
        WHERE (email = ? OR phone = ?) AND membership_code = ?
    """, (identifier, identifier, code))
    
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        return jsonify({
            'success': False,
            'error': 'Invalid credentials. Please check your email/phone and membership code.'
        }), 400
    
    user_id = user[0]
    
    # Check if new email or phone would cause a conflict
    if email and email != identifier:
        cursor.execute("SELECT id FROM users WHERE email = ? AND id != ?", (email, user_id))
        if cursor.fetchone():
            conn.close()
            return jsonify({
                'success': False,
                'error': 'Email already exists for another member.'
            }), 400
    
    if phone and phone != identifier:
        cursor.execute("SELECT id FROM users WHERE phone = ? AND id != ?", (phone, user_id))
        if cursor.fetchone():
            conn.close()
            return jsonify({
                'success': False,
                'error': 'Phone number already exists for another member.'
            }), 400
    
    # Build update query dynamically based on provided fields
    update_fields = []
    params = []
    
    if name:
        update_fields.append("name = ?")
        params.append(name)
    if email:
        update_fields.append("email = ?")
        params.append(email)
    if phone:
        update_fields.append("phone = ?")
        params.append(phone)
    if department is not None:  # Allow empty string to clear the field
        update_fields.append("department = ?")
        params.append(department)
    if reg_number is not None:
        update_fields.append("reg_number = ?")
        params.append(reg_number)
    if year is not None:
        update_fields.append("year = ?")
        params.append(year)
    
    # Only update if there are fields to update
    if update_fields:
        query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"
        params.append(user_id)
        
        cursor.execute(query, params)
        conn.commit()
    
    conn.close()
    
    return jsonify({
        'success': True,
        'message': 'Member information updated successfully.'
    })

# Endpoint to update member data from the members table
@app.route('/update-member-data', methods=['POST'])
def update_member_data():
    data = request.json
    id_value = data.get('id')
    email = data.get('email')
    phone = data.get('phone')
    code = data.get('code')
    column = data.get('column')
    value = data.get('value')
    
    # Validate required fields
    if not all([column, code]) or not any([id_value, email, phone]):
        return jsonify({
            'success': False,
            'error': 'Missing required fields'
        }), 400
    
    # Validate column name to prevent SQL injection
    allowed_columns = ['name', 'email', 'phone', 'department', 'reg_number', 'year']
    if column not in allowed_columns:
        return jsonify({
            'success': False,
            'error': 'Invalid column name'
        }), 400
    
    conn = sqlite3.connect('esa_membership.db')
    cursor = conn.cursor()
    
    try:
        # Verify that the user exists
        if id_value:
            cursor.execute("SELECT id FROM users WHERE id = ? AND membership_code = ?", (id_value, code))
        else:
            cursor.execute("SELECT id FROM users WHERE (email = ? OR phone = ?) AND membership_code = ?", 
                          (email, phone, code))
        
        user = cursor.fetchone()
        if not user:
            conn.close()
            return jsonify({
                'success': False,
                'error': 'User not found or invalid membership code'
            }), 404
        
        user_id = user[0]
        
        # Special handling for email and phone to ensure uniqueness
        if column in ['email', 'phone'] and value:
            cursor.execute(f"SELECT id FROM users WHERE {column} = ? AND id != ?", (value, user_id))
            if cursor.fetchone():
                conn.close()
                return jsonify({
                    'success': False,
                    'error': f'This {column} is already registered to another user'
                }), 400
        
        # Update the field
        cursor.execute(f"UPDATE users SET {column} = ? WHERE id = ?", (value, user_id))
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Update successful'
        })
        
    except Exception as e:
        conn.close()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/')
def index():
    return render_template('registration.html')

if __name__ == '__main__':
    init_db()  # Initialize the database
    app.run(debug=True)
