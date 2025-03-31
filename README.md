# ESA Membership System

A web-based membership management system for ESA (Engineering Students Association) that allows:
- Generating unique membership codes for new members
- Preventing duplicate registrations
- Displaying existing membership codes for returning members
- Viewing all members in a spreadsheet-like interface
- Inline editing of member information
- Tracking additional metadata (department, registration number, year)

## Installation

1. Clone this repository:
```bash
git clone https://github.com/GabuGravin41/esa-membership.git
cd esa-membership
```

2. Create a virtual environment (optional but recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install the required packages:
```bash
pip install -r requirements.txt
```

## Running the Application

Start the Flask application:
```bash
python app.py
```

The application will be available at http://127.0.0.1:5000/

## Features

- **Member Registration**: Register new members with name, email, and phone number
- **Unique Membership Codes**: Automatically generates and assigns unique ESA membership codes
- **Duplicate Detection**: Prevents duplicate registrations and shows existing membership codes
- **Member Dashboard**: View all members in a spreadsheet-like interface
- **Inline Editing**: Edit member information directly in the members table
- **Database Migration**: Automatic handling of database schema changes
- **Data Validation**: Ensures data integrity and prevents conflicts

## API Endpoints

- `POST /generate-code`: Register a new member and generate membership code
- `GET /member-count`: Get the total number of registered members
- `GET /members`: View all members in a spreadsheet-like interface
- `POST /update-member-data`: Update member information via inline editing
- `GET /migrate-db`: Manually trigger database migration (admin only)

## Database

The application uses SQLite for data storage. The database file (`esa_membership.db`) is created automatically when the application runs for the first time.
