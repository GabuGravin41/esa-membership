# ESA-KU Membership Manager

A static web application for managing Engineering Students Association - Kenyatta University members.

## Features

- Add new members with auto-generated member numbers
- **Bulk import** - Paste multiple members at once in key:value format
- Store member data locally in browser storage
- Export data as CSV, JSON, or XLSX
- Quick backup with timestamp
- Import data from JSON or CSV files
- Duplicate prevention (by email and student ID)

## How to Use

1. Open `index.html` in a web browser
2. **Add Single Member**: Fill the form and click "Add Member"
3. **Bulk Import**: Paste member data in the bulk import section using key:value format
4. View members in the list below
5. Export data using the export buttons
6. Save the exported files to ESA email for backup
7. To restore data, use the import function with a previously exported JSON or CSV file

## Bulk Import Format

The system supports two formats:

**Format 1: Numbered List (Recommended for WhatsApp data)**
```
1. John Doe
Email: john@example.com
Admission No: J174/12345/2025
Phone: +254712345678

2. Jane Smith
Email: jane@example.com
Admission No: J174/12346/2025
Phone: +254712345679
```

**Format 2: Key:Value pairs**
```
name: John Doe
email: john@example.com
student_id: J174/12345/2025
department: Computer Science
year: 2
phone: +254712345678
```

## Member Number Format

Member numbers are generated as ESA-KU-XXXX where XXXX is a 4-digit sequential number.

## Data Storage & Safety

- Data stored in browser localStorage
- Clear browser data will delete all members
- **Always export regularly for backup**
- Use Quick Backup for timestamped JSON files
- Import JSON files to restore on new devices
- No external services or costs involved

## Files

- `index.html` - Main HTML file
- `styles.css` - Styling
- `script.js` - JavaScript logic

## Dependencies

- XLSX library from CDN for Excel export

## Browser Compatibility

Works in modern browsers with localStorage support.