// script.js - ESA-KU Membership Manager

document.addEventListener('DOMContentLoaded', function() {
    loadMembers();
    document.getElementById('member-form').addEventListener('submit', addMember);
    document.getElementById('export-csv').addEventListener('click', exportCSV);
    document.getElementById('export-json').addEventListener('click', exportJSON);
    document.getElementById('export-xlsx').addEventListener('click', exportXLSX);
    document.getElementById('import-btn').addEventListener('click', importData);
    document.getElementById('bulk-add').addEventListener('click', bulkAddMembers);
    document.getElementById('quick-backup').addEventListener('click', quickBackup);
    
    // Initialize persistent member counter so member numbers are unique
    initMemberCounter();
    // Tab functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
});

function switchTab(tabName) {
    // Hide all tab panels
    const tabPanels = document.querySelectorAll('.tab-panel');
    tabPanels.forEach(panel => panel.classList.remove('active'));
    
    // Remove active class from all buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => button.classList.remove('active'));
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

function getMembers() {
    const members = localStorage.getItem('esa-members');
    return members ? JSON.parse(members) : [];
}

function saveMembers(members) {
    localStorage.setItem('esa-members', JSON.stringify(members));
}

function initMemberCounter() {
    const members = getMembers();
    let max = 0;
    members.forEach(m => {
        if (m && m.memberNumber) {
            const match = String(m.memberNumber).match(/ESA-KU-(\d+)/);
            if (match) {
                const n = parseInt(match[1], 10);
                if (!isNaN(n) && n > max) max = n;
            }
        }
    });

    const stored = parseInt(localStorage.getItem('esa-member-counter') || '0', 10);
    if (isNaN(stored) || stored < max) {
        localStorage.setItem('esa-member-counter', String(max));
    }
}

function generateMemberNumber() {
    let counter = parseInt(localStorage.getItem('esa-member-counter') || '0', 10);
    if (isNaN(counter)) counter = 0;
    counter += 1;
    localStorage.setItem('esa-member-counter', String(counter));
    return `ESA-KU-${String(counter).padStart(4, '0')}`;
}

function addMember(e) {
    e.preventDefault();
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const studentId = document.getElementById('student-id').value.trim();
    const department = document.getElementById('department').value.trim();
    const year = document.getElementById('year').value;
    const phone = document.getElementById('phone').value.trim();
    
    if (!name || !email || !studentId || !department || !year) {
        alert('Please fill in all required fields.');
        return;
    }
    
    const members = getMembers();
    
    // Check if email or student ID already exists
    if (members.some(m => m.email === email || m.studentId === studentId)) {
        alert('A member with this email or student ID already exists.');
        return;
    }
    
    const newMember = {
        memberNumber: generateMemberNumber(),
        name: name,
        email: email,
        studentId: studentId,
        department: department,
        year: year,
        phone: phone,
        dateAdded: new Date().toISOString()
    };
    
    members.push(newMember);
    saveMembers(members);
    initMemberCounter();
    
    document.getElementById('member-form').reset();
    loadMembers();
    
    alert(`Member added successfully! Member Number: ${newMember.memberNumber}`);
}

function loadMembers() {
    const members = getMembers();
    const membersDiv = document.getElementById('members');
    
    if (members.length === 0) {
        membersDiv.innerHTML = '<p>No members added yet.</p>';
        return;
    }
    
    membersDiv.innerHTML = members.map(member => {
        const displayName = String(member.name || '').replace(/\s*\(ESA-KU-\d+\)\s*/,'').trim();
        const memberNumberDisplay = member.memberNumber || 'Unassigned';
        let yearText = member.year || '';
        const y = parseInt(yearText, 10);
        if (!isNaN(y)) {
            yearText = `${y}${y == 1 ? 'st' : y == 2 ? 'nd' : y == 3 ? 'rd' : 'th'} Year`;
        } else if (yearText) {
            yearText = `${yearText} Year`;
        }

        return `
        <div class="member-card">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <h4>${displayName} (${memberNumberDisplay})</h4>
                <button class="delete-btn" data-member-number="${memberNumberDisplay}" title="Delete member">Delete</button>
            </div>
            <p><strong>Email:</strong> ${member.email}</p>
            <p><strong>Student ID:</strong> ${member.studentId}</p>
            <p><strong>Department:</strong> ${member.department}</p>
            <p><strong>Year:</strong> ${yearText}</p>
            ${member.phone ? `<p><strong>Phone:</strong> ${member.phone}</p>` : ''}
            <p><strong>Date Added:</strong> ${new Date(member.dateAdded).toLocaleDateString()}</p>
        </div>
    `;
    }).join('');

    // Wire delete buttons after rendering
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const memberNumber = btn.dataset.memberNumber;
            deleteMember(memberNumber);
        });
    });
}

function deleteMember(memberNumber) {
    if (!memberNumber) return;
    const ok = confirm(`Delete member ${memberNumber}? This action cannot be undone.`);
    if (!ok) return;

    const members = getMembers();
    const updated = members.filter(m => m.memberNumber !== memberNumber);
    if (updated.length === members.length) {
        alert('Member not found.');
        return;
    }
    saveMembers(updated);
    // keep counter intact (do not decrement) but ensure counter stays at least max
    initMemberCounter();
    loadMembers();
    alert(`Member ${memberNumber} deleted.`);
}

function exportCSV() {
    const members = getMembers();
    if (members.length === 0) {
        alert('No members to export.');
        return;
    }
    
    const csvContent = [
        ['Member Number', 'Name', 'Email', 'Student ID', 'Department', 'Year', 'Phone', 'Date Added'],
        ...members.map(m => [
            m.memberNumber,
            m.name,
            m.email,
            m.studentId,
            m.department,
            m.year,
            m.phone || '',
            m.dateAdded
        ])
    ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
    
    downloadFile(csvContent, 'esa-members.csv', 'text/csv');
}

function exportJSON() {
    const members = getMembers();
    if (members.length === 0) {
        alert('No members to export.');
        return;
    }
    
    const jsonContent = JSON.stringify(members, null, 2);
    downloadFile(jsonContent, 'esa-members.json', 'application/json');
}

function exportXLSX() {
    const members = getMembers();
    if (members.length === 0) {
        alert('No members to export.');
        return;
    }
    
    const ws = XLSX.utils.json_to_sheet(members.map(m => ({
        'Member Number': m.memberNumber,
        'Name': m.name,
        'Email': m.email,
        'Student ID': m.studentId,
        'Department': m.department,
        'Year': m.year,
        'Phone': m.phone || '',
        'Date Added': m.dateAdded
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members');
    XLSX.writeFile(wb, 'esa-members.xlsx');
}

function importData() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a file to import.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let importedMembers;
            
            if (file.name.endsWith('.json')) {
                importedMembers = JSON.parse(e.target.result);
            } else if (file.name.endsWith('.csv')) {
                // Simple CSV parsing - assumes first row is headers
                const csvText = e.target.result;
                const lines = csvText.split('\n').filter(line => line.trim());
                const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
                
                importedMembers = lines.slice(1).map(line => {
                    const values = line.split(',').map(v => v.replace(/"/g, ''));
                    const member = {};
                    headers.forEach((header, index) => {
                        member[header.toLowerCase().replace(' ', '')] = values[index] || '';
                    });
                    return member;
                });
            } else {
                throw new Error('Unsupported file format. Please use JSON or CSV.');
            }
            
            // Validate imported data
            const validMembers = importedMembers.filter(m => m.name && m.email && m.studentId);
            
            if (validMembers.length === 0) {
                alert('No valid member data found in the file.');
                return;
            }
            
            // Merge with existing members, avoiding duplicates
            const existingMembers = getMembers();
            const existingEmails = new Set(existingMembers.map(m => m.email));
            const existingStudentIds = new Set(existingMembers.map(m => m.studentId));
            
            const newMembers = validMembers.filter(m => 
                !existingEmails.has(m.email) && !existingStudentIds.has(m.studentId)
            );
            
            if (newMembers.length === 0) {
                alert('All imported members already exist or are invalid.');
                return;
            }
            
            // Assign member numbers to imported members if they don't have them
            newMembers.forEach(member => {
                if (!member.memberNumber) {
                    member.memberNumber = generateMemberNumber();
                }
                if (!member.dateAdded) {
                    member.dateAdded = new Date().toISOString();
                }
            });
            
            const updatedMembers = [...existingMembers, ...newMembers];
            saveMembers(updatedMembers);
            initMemberCounter();
            
            loadMembers();
            alert(`Successfully imported ${newMembers.length} new members.`);
            
        } catch (error) {
            alert('Error importing data: ' + error.message);
        }
    };
    
    reader.readAsText(file);
}

function bulkAddMembers() {
    const bulkData = document.getElementById('bulk-data').value.trim();
    const statusDiv = document.getElementById('bulk-status');
    
    if (!bulkData) {
        statusDiv.innerHTML = '<p style="color: red;">Please paste member data first.</p>';
        return;
    }
    
    try {
        const lines = bulkData.split('\n').map(line => line.trim()).filter(line => line);
        const parsedMembers = [];
        const errors = [];
        
        let currentMember = null;
        let memberIndex = 0;
        
        for (const line of lines) {
            // Check if this is a new member (starts with number.)
            const numberMatch = line.match(/^(\d+)\.\s*(.+)$/);
            if (numberMatch) {
                // Save previous member if exists
                if (currentMember) {
                    parsedMembers.push(currentMember);
                }
                
                memberIndex = parseInt(numberMatch[1]);
                const name = numberMatch[2].trim();
                
                currentMember = {
                    name: name,
                    email: '',
                    studentId: '',
                    department: '',
                    year: '',
                    phone: '',
                    dateAdded: new Date().toISOString()
                };
            } else if (currentMember) {
                // Parse key: value lines
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const key = line.substring(0, colonIndex).trim().toLowerCase().replace(/\s+/g, '');
                    const value = line.substring(colonIndex + 1).trim();
                    
                    if (key.includes('email') && !currentMember.email) {
                        currentMember.email = value;
                    } else if (key.includes('admission') || key.includes('studentid')) {
                        currentMember.studentId = value;
                    } else if (key.includes('phone')) {
                        currentMember.phone = value;
                    } else if (key.includes('department')) {
                        currentMember.department = value;
                    } else if (key.includes('year')) {
                        currentMember.year = value;
                    }
                }
            }
        }
        
        // Don't forget the last member
        if (currentMember) {
            parsedMembers.push(currentMember);
        }
        
        // Also try the old key:value format as fallback
        if (parsedMembers.length === 0) {
            const memberBlocks = bulkData.split(/\n\s*\n/).filter(block => block.trim());
            
            memberBlocks.forEach((block, index) => {
                const lines = block.split('\n').map(line => line.trim()).filter(line => line);
                const memberData = {};
                
                lines.forEach(line => {
                    const colonIndex = line.indexOf(':');
                    if (colonIndex > 0) {
                        const key = line.substring(0, colonIndex).trim().toLowerCase().replace(/\s+/g, '');
                        const value = line.substring(colonIndex + 1).trim();
                        memberData[key] = value;
                    }
                });
                
                const name = memberData.name || memberData.fullname || memberData.full_name;
                const email = memberData.email || memberData.emailaddress;
                const studentId = memberData.studentid || memberData.student_id || memberData.admissionnumber || memberData.admission_number;
                const department = memberData.department || memberData.dept;
                const year = memberData.year || memberData.yearofstudy || memberData.year_of_study;
                const phone = memberData.phone || memberData.phonenumber || memberData.phone_number || memberData.mobile;
                
                if (name && email && studentId) {
                    parsedMembers.push({
                        name: name,
                        email: email,
                        studentId: studentId,
                        department: department || '',
                        year: year || '',
                        phone: phone || '',
                        dateAdded: new Date().toISOString()
                    });
                } else {
                    errors.push(`Member ${index + 1}: Missing required fields (name, email, student_id)`);
                }
            });
        }
        
        // Validate parsed members
        const validMembers = parsedMembers.filter(m => m.name && m.email && m.studentId);
        const invalidCount = parsedMembers.length - validMembers.length;
        
        if (invalidCount > 0) {
            errors.push(`${invalidCount} members had missing required fields`);
        }
        
        if (validMembers.length === 0) {
            statusDiv.innerHTML = '<p style="color: red;">No valid members found in the pasted data.</p>';
            return;
        }
        
        // Check for duplicates
        const existingMembers = getMembers();
        const existingEmails = new Set(existingMembers.map(m => m.email));
        const existingStudentIds = new Set(existingMembers.map(m => m.studentId));
        
        const newMembers = validMembers.filter(m => 
            !existingEmails.has(m.email) && !existingStudentIds.has(m.studentId)
        );
        
        const duplicates = validMembers.length - newMembers.length;
        
        if (newMembers.length === 0) {
            statusDiv.innerHTML = '<p style="color: red;">All members already exist in the system.</p>';
            return;
        }
        
        // Generate member numbers
        newMembers.forEach(member => {
            member.memberNumber = generateMemberNumber();
        });
        
        // Add to existing members
        const updatedMembers = [...existingMembers, ...newMembers];
        saveMembers(updatedMembers);
        initMemberCounter();
        
        loadMembers();
        
        let statusMessage = `<p style="color: green;">Successfully added ${newMembers.length} new members.`;
        if (duplicates > 0) {
            statusMessage += ` ${duplicates} duplicates were skipped.`;
        }
        if (errors.length > 0) {
            statusMessage += ` Errors: ${errors.join(', ')}.`;
        }
        statusMessage += '</p>';
        
        statusDiv.innerHTML = statusMessage;
        
        // Clear the textarea
        document.getElementById('bulk-data').value = '';
        
    } catch (error) {
        statusDiv.innerHTML = `<p style="color: red;">Error processing data: ${error.message}</p>`;
    }
}

function quickBackup() {
    const members = getMembers();
    if (members.length === 0) {
        document.getElementById('backup-status').innerHTML = '<p style="color: red;">No members to backup.</p>';
        return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `esa-members-backup-${timestamp}.json`;
    
    const jsonContent = JSON.stringify(members, null, 2);
    downloadFile(jsonContent, filename, 'application/json');
    
    // Update last backup time
    localStorage.setItem('esa-last-backup', new Date().toISOString());
    document.getElementById('backup-status').innerHTML = `<p style="color: green;">Backup created: ${filename}</p>`;
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}