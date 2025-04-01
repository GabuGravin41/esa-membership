# ESA Membership Registration Application

A Flask-based web application for managing ESA memberships, built for Kenyatta University Engineering Students Association.

## Features

- Membership code generation
- Member verification
- Member information management
- Member database access and administration

## Setup and Installation

### Prerequisites

- Python 3.8+
- PostgreSQL database

### Local Development Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd esa-membership
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up a local PostgreSQL database:
   ```bash
   # Create a PostgreSQL database
   createdb esa_membership
   ```

5. Update the database connection settings in `app.py` if needed.

6. Run the application:
   ```bash
   python app.py
   ```

The application will be available at http://localhost:5000

### Deployment on Render

1. Create a new Web Service on Render.
2. Link your GitHub repository.
3. Use the following settings:
   - Name: `esa-membership`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `bash render_start.sh`
   
4. Create a PostgreSQL database on Render:
   - Go to "New" > "PostgreSQL"
   - Name: `esa-membership-db`
   - Database: `esa_membership`
   - User: `esa_user`
   - Select the Free plan

5. Link the database to your web service:
   - Go to your web service
   - Navigate to Environment
   - Add environment variable:
     - Key: `DATABASE_URL`
     - Value: The Internal Database URL from your PostgreSQL service

## Application Structure

- `app.py`: Main application file
- `templates/`: HTML templates
- `static/`: Static files (CSS, JS)
- `render_start.sh`: Script for starting the application on Render

## Contributing

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.
