from flask import Flask, request, jsonify, render_template
import os
import random
import time
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

# Database configuration
def get_db_connection():
    """Get a connection to the PostgreSQL database"""
    # Check if running on Render (production)
    if os.environ.get('RENDER'):
        # Use the environment variables provided by Render
        db_url = os.environ.get('DATABASE_URL')
        if not db_url:
            raise ValueError("DATABASE_URL environment variable not set")
        conn = psycopg2.connect(db_url)
    else:
        # Local development configuration
        conn = psycopg2.connect(
            dbname="esa_membership",
            user="postgres",
            password="postgres",
            host="localhost",
            port="5432"
        )
    
    # Set the cursor factory to return dictionaries
    conn.autocommit = False
    return conn

# Initialize database
def init_db():
    """Create database tables if they don't exist"""
    try:
        print("Starting database initialization...")
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Create users table if it doesn't exist
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT UNIQUE NOT NULL,
                membership_code TEXT UNIQUE NOT NULL,
                department TEXT,
                reg_number TEXT,
                year TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create a table to store db_tests for monitoring
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS db_tests (
                key TEXT PRIMARY KEY,
                value TEXT,
                timestamp BIGINT
            )
        ''')
        
        conn.commit()
        print("Database tables created successfully")
        
        # Verify tables exist
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        tables = cursor.fetchall()
        print(f"Tables in database: {tables}")
        
        # Check structure of users table
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        """)
        columns = cursor.fetchall()
        print("Users table structure:")
        for col in columns:
            print(f"- {col[0]} ({col[1]})")
            
        conn.close()
        print("Database initialization completed successfully")
        
    except Exception as e:
        print(f"⚠️ Error initializing database: {e}")
        import traceback
        traceback.print_exc()
        raise

# Function to generate unique membership code
def generate_membership_code():
    return f"ESA{random.randint(10000, 99999)}"

# Endpoint to generate membership code
@app.route('/generate-code', methods=['POST'])
def generate_code():
    try:
        # Make sure we have a valid JSON request
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Invalid request format - expecting JSON'
            }), 400
            
        data = request.json
        name = data['name']
        email = data['email']
        phone = data['phone']
        # Get optional fields with default None if not provided
        department = data.get('department')
        reg_number = data.get('reg_number')
        year = data.get('year')
        
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Check for existing email or phone number
        cursor.execute(
            "SELECT membership_code FROM users WHERE email = %s OR phone = %s", 
            (email, phone)
        )
        existing_user = cursor.fetchone()
        
        if existing_user:
            existing_code = existing_user['membership_code']
            conn.close()
            # Return an error response with status code 400, but include the existing code
            return jsonify({
                'error': 'Email or phone number already registered.',
                'existing_code': existing_code,
                'success': False
            }), 400
        
        # Generate a new membership code
        membership_code = generate_membership_code()

        # Ensure the code is unique
        cursor.execute("SELECT membership_code FROM users WHERE membership_code = %s", (membership_code,))
        while cursor.fetchone() is not None:
            membership_code = generate_membership_code()
            cursor.execute("SELECT membership_code FROM users WHERE membership_code = %s", (membership_code,))

        # Insert user into database
        cursor.execute(
            """
            INSERT INTO users 
            (name, email, phone, membership_code, department, reg_number, year)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (name, email, phone, membership_code, department, reg_number, year)
        )
        conn.commit()
        conn.close()

        # Return success response with the generated code
        return jsonify({
            'code': membership_code,
            'success': True
        })
        
    except KeyError as e:
        # Missing required field
        return jsonify({
            'success': False,
            'error': f'Missing required field: {str(e)}'
        }), 400
    except psycopg2.Error as e:
        # Handle database errors
        return jsonify({
            'success': False,
            'error': f'Database error: {str(e)}'
        }), 500
    except Exception as e:
        # Catch any other exceptions
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500

# Endpoint to get the number of members
@app.route('/member-count', methods=['GET'])
def member_count():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        count = cursor.fetchone()[0]
        conn.close()
        return jsonify({'member_count': count})
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Endpoint to get all members
@app.route('/members', methods=['GET'])
def all_members():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get column information
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        """)
        columns_data = cursor.fetchall()
        columns = [col['column_name'] for col in columns_data]
        
        # Exclude created_at from displayed columns if it exists
        if 'created_at' in columns:
            columns.remove('created_at')
        
        # Build query dynamically
        select_columns = ", ".join(columns)
        cursor.execute(f"SELECT {select_columns} FROM users ORDER BY name")
        members = cursor.fetchall()
        
        conn.close()
        return render_template('members.html', members=members, columns=columns)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return render_template('error.html', error=str(e)), 500

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
    try:
        data = request.json
        identifier = data['identifier']
        code = data['code']
        
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if the identifier is an email or phone and the code matches
        cursor.execute("""
            SELECT * FROM users 
            WHERE (email = %s OR phone = %s) AND membership_code = %s
        """, (identifier, identifier, code))
        
        user = cursor.fetchone()
        conn.close()
        
        if user:
            return jsonify({
                'success': True,
                'user': user
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Invalid credentials. Please check your email/phone and membership code.'
            }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Endpoint to update member information
@app.route('/update-member', methods=['POST'])
def update_member():
    try:
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
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # First verify the user exists with provided credentials
        cursor.execute("""
            SELECT id FROM users 
            WHERE (email = %s OR phone = %s) AND membership_code = %s
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
            cursor.execute("SELECT id FROM users WHERE email = %s AND id != %s", (email, user_id))
            if cursor.fetchone():
                conn.close()
                return jsonify({
                    'success': False,
                    'error': 'Email already exists for another member.'
                }), 400
        
        if phone and phone != identifier:
            cursor.execute("SELECT id FROM users WHERE phone = %s AND id != %s", (phone, user_id))
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
            update_fields.append("name = %s")
            params.append(name)
        if email:
            update_fields.append("email = %s")
            params.append(email)
        if phone:
            update_fields.append("phone = %s")
            params.append(phone)
        if department is not None:  # Allow empty string to clear the field
            update_fields.append("department = %s")
            params.append(department)
        if reg_number is not None:
            update_fields.append("reg_number = %s")
            params.append(reg_number)
        if year is not None:
            update_fields.append("year = %s")
            params.append(year)
        
        # Only update if there are fields to update
        if update_fields:
            query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s"
            params.append(user_id)
            
            cursor.execute(query, params)
            conn.commit()
        
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Member information updated successfully.'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Endpoint to update member data from the members table
@app.route('/update-member-data', methods=['POST'])
def update_member_data():
    try:
        # Make sure we have a valid JSON request
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Invalid request format - expecting JSON'
            }), 400
            
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
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify that the user exists
        if id_value:
            cursor.execute("SELECT id FROM users WHERE id = %s AND membership_code = %s", (id_value, code))
        else:
            cursor.execute("SELECT id FROM users WHERE (email = %s OR phone = %s) AND membership_code = %s", 
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
            cursor.execute(f"SELECT id FROM users WHERE {column} = %s AND id != %s", (value, user_id))
            if cursor.fetchone():
                conn.close()
                return jsonify({
                    'success': False,
                    'error': f'This {column} is already registered to another user'
                }), 400
        
        # Update the field
        cursor.execute(f"UPDATE users SET {column} = %s WHERE id = %s", (value, user_id))
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Update successful'
        })
            
    except Exception as e:
        # Catch any other exceptions
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500

# Database health-check endpoint
@app.route('/api/db-health', methods=['GET'])
def db_health():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Write a test value to verify persistence
        test_key = f"test_{int(time.time())}"
        test_value = f"value_{int(time.time())}"
        
        try:
            # Add a test entry
            cursor.execute(
                "INSERT INTO db_tests (key, value, timestamp) VALUES (%s, %s, %s)", 
                (test_key, test_value, int(time.time()))
            )
            conn.commit()
            
            # Read back the last 5 test values
            cursor.execute(
                "SELECT key, value, timestamp FROM db_tests ORDER BY timestamp DESC LIMIT 5"
            )
            test_values = cursor.fetchall()
        except Exception as e:
            test_values = [{"error": str(e)}]
            
        # Check structure of users table
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        """)
        columns = cursor.fetchall()
        
        # Count users
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()['count']
        
        # Get all tables
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        tables = [table['table_name'] for table in cursor.fetchall()]
        
        conn.close()
        
        # Get environment info
        env_info = {k: v for k, v in os.environ.items() 
                   if not k.startswith('_') and
                   not any(secret in k.lower() for secret in 
                          ['key', 'token', 'secret', 'password', 'credential'])}
        
        return jsonify({
            'success': True,
            'database': {
                'tables': tables,
                'columns': columns,
                'user_count': user_count,
                'persistence_tests': test_values
            },
            'environment': {
                'variables': env_info,
                'is_render': 'RENDER' in os.environ
            }
        })
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

# Error handlers for API routes
@app.errorhandler(404)
def not_found_error(error):
    # Check if route is for an API endpoint
    if request.path.startswith('/generate-code') or \
       request.path.startswith('/verify-member') or \
       request.path.startswith('/update-member') or \
       request.path.startswith('/update-member-data') or \
       request.path.startswith('/member-count') or \
       request.path.startswith('/api/'):
        return jsonify({'success': False, 'error': 'Endpoint not found'}), 404
    return render_template('error.html', error='Page not found'), 404

@app.errorhandler(500)
def internal_error(error):
    # Check if route is for an API endpoint
    if request.path.startswith('/generate-code') or \
       request.path.startswith('/verify-member') or \
       request.path.startswith('/update-member') or \
       request.path.startswith('/update-member-data') or \
       request.path.startswith('/member-count') or \
       request.path.startswith('/api/'):
        return jsonify({'success': False, 'error': 'Internal server error'}), 500
    return render_template('error.html', error='Internal server error'), 500

@app.route('/')
def index():
    return render_template('registration.html')

if __name__ == '__main__':
    init_db()  # Initialize the database
    app.run(debug=True)
