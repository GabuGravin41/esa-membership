// ============================================================
// ESA-KU MEMBERSHIP MANAGER — localStorage version
// Firebase will replace this once configured.
// ============================================================

// Change this password before sharing the link.
const COMMITTEE_PASSWORD = 'esa@2026';

// ============================================================
// MODULE STATE
// ============================================================
let _lastDeleted = [];
let _undoTimer   = null;

// ============================================================
// localStorage HELPERS
// ============================================================
function getMembers() {
    try { return JSON.parse(localStorage.getItem('esa-members') || '[]'); } catch { return []; }
}
function saveMembers(members) {
    localStorage.setItem('esa-members', JSON.stringify(members));
}

// ============================================================
// AUTH — simple password stored in sessionStorage
// Resets when the browser tab is closed.
// ============================================================
function isLoggedIn() {
    return sessionStorage.getItem('esa-auth') === '1';
}

function applyAuthState() {
    if (isLoggedIn()) {
        document.body.classList.add('logged-in');
        document.getElementById('auth-user-email').textContent = 'Committee';
    } else {
        document.body.classList.remove('logged-in');
        document.getElementById('auth-user-email').textContent = '';
        const active = document.querySelector('.tab-panel.active');
        if (active && (active.id === 'add-member' || active.id === 'bulk-import')) {
            switchTab('member-list');
        }
    }
    renderMemberList(getMembers());
}

function openLoginModal() {
    document.getElementById('login-modal').setAttribute('aria-hidden', 'false');
    document.getElementById('login-password').focus();
}
function closeLoginModal() {
    document.getElementById('login-modal').setAttribute('aria-hidden', 'true');
    document.getElementById('login-password').value    = '';
    document.getElementById('login-error').textContent = '';
}

function loginUser() {
    const password = document.getElementById('login-password').value;
    const errorEl  = document.getElementById('login-error');
    errorEl.textContent = '';

    if (!password) { errorEl.textContent = 'Please enter the committee password.'; return; }

    if (password === COMMITTEE_PASSWORD) {
        sessionStorage.setItem('esa-auth', '1');
        closeLoginModal();
        applyAuthState();
    } else {
        errorEl.textContent = 'Incorrect password.';
    }
}

// ============================================================
// MEMBER NUMBER — derived from student ID
// J174/10483/2025 → ESA-10483
// J79/1417/2025   → ESA-1417
// ============================================================
function deriveMemberNumber(studentId) {
    const parts = studentId.trim().split('/');
    if (parts.length >= 3) return `ESA-${parts[1].trim()}`;
    if (parts.length === 2) return `ESA-${parts[1].trim()}`;
    return `ESA-${studentId.replace(/[^a-zA-Z0-9]/g, '')}`;
}

// One-time migration: re-derive member numbers for any record
// that has an old counter-based number (ESA-KU-0001, 0002, etc.)
// or any number that doesn't match the derived value.
function migrateMemberNumbers() {
    const members = getMembers();
    if (!members.length) return;
    let changed = false;
    members.forEach(m => {
        if (!m.studentId) return;
        const correct = deriveMemberNumber(m.studentId);
        if (m.memberNumber !== correct) {
            m.memberNumber = correct;
            changed = true;
        }
    });
    if (changed) saveMembers(members);
}

// ============================================================
// LOAD / RENDER
// ============================================================
function loadMembers() {
    const members = getMembers();
    renderStatsBar(members);
    renderMemberList(members);
}

// ============================================================
// ADD MEMBER
// ============================================================
function showFormStatus(message, type) {
    const el = document.getElementById('add-member-status');
    if (!el) return;
    el.textContent = message;
    el.className   = `form-status ${type}`;
    if (type === 'success') {
        setTimeout(() => { el.className = 'form-status'; el.textContent = ''; }, 5000);
    }
}

function addMember(e) {
    e.preventDefault();
    if (!isLoggedIn()) { showFormStatus('You must be logged in to add members.', 'error'); return; }

    const name       = document.getElementById('name').value.trim();
    const email      = document.getElementById('email').value.trim();
    const studentId  = document.getElementById('student-id').value.trim();
    const department = document.getElementById('department').value.trim();
    const year       = document.getElementById('year').value;
    const phone      = document.getElementById('phone').value.trim();

    if (!name || !email || !studentId || !department || !year) {
        showFormStatus('Please fill in all required fields.', 'error'); return;
    }

    const members = getMembers();
    if (members.some(m => m.email === email)) {
        showFormStatus('A member with this email already exists.', 'error'); return;
    }
    if (members.some(m => m.studentId === studentId)) {
        showFormStatus('A member with this student ID already exists.', 'error'); return;
    }

    const memberNumber = deriveMemberNumber(studentId);
    members.push({ memberNumber, name, email, studentId, department, year, phone, dateAdded: new Date().toISOString() });
    saveMembers(members);
    document.getElementById('member-form').reset();
    loadMembers();
    showFormStatus(`Member added! Member Number: ${memberNumber}`, 'success');
}

// ============================================================
// EDIT MEMBER
// ============================================================
function openEditModal(member) {
    document.getElementById('edit-doc-id').value              = member.memberNumber;
    document.getElementById('edit-member-number').textContent = member.memberNumber || '';
    document.getElementById('edit-name').value                = member.name || '';
    document.getElementById('edit-email').value               = member.email || '';
    document.getElementById('edit-student-id').value          = member.studentId || '';
    document.getElementById('edit-department').value          = member.department || '';
    document.getElementById('edit-year').value                = member.year || '';
    document.getElementById('edit-phone').value               = member.phone || '';
    document.getElementById('edit-error').textContent         = '';
    document.getElementById('edit-modal').setAttribute('aria-hidden', 'false');
    document.getElementById('edit-name').focus();
}
function closeEditModal() {
    document.getElementById('edit-modal').setAttribute('aria-hidden', 'true');
}

function saveEditMember() {
    const originalNumber = document.getElementById('edit-doc-id').value;
    const name       = document.getElementById('edit-name').value.trim();
    const email      = document.getElementById('edit-email').value.trim();
    const studentId  = document.getElementById('edit-student-id').value.trim();
    const department = document.getElementById('edit-department').value.trim();
    const year       = document.getElementById('edit-year').value;
    const phone      = document.getElementById('edit-phone').value.trim();
    const errorEl    = document.getElementById('edit-error');

    if (!name || !email || !studentId || !department || !year) {
        errorEl.textContent = 'Please fill in all required fields.'; return;
    }

    const members = getMembers();
    const others  = members.filter(m => m.memberNumber !== originalNumber);

    if (others.some(m => m.email === email)) {
        errorEl.textContent = 'Another member with this email already exists.'; return;
    }
    if (others.some(m => m.studentId === studentId)) {
        errorEl.textContent = 'Another member with this student ID already exists.'; return;
    }

    // Re-derive member number if student ID changed
    const newMemberNumber = deriveMemberNumber(studentId);

    const idx = members.findIndex(m => m.memberNumber === originalNumber);
    if (idx === -1) { errorEl.textContent = 'Member not found.'; return; }

    members[idx] = { ...members[idx], memberNumber: newMemberNumber, name, email, studentId, department, year, phone };
    saveMembers(members);
    closeEditModal();
    loadMembers();
}

// ============================================================
// DELETE & UNDO
// ============================================================
function performSoftDelete(memberNumbers) {
    if (!Array.isArray(memberNumbers) || !memberNumbers.length) return;
    const members  = getMembers();
    _lastDeleted   = members.filter(m => memberNumbers.includes(m.memberNumber));
    if (!_lastDeleted.length) return;

    saveMembers(members.filter(m => !memberNumbers.includes(m.memberNumber)));
    loadMembers();
    showUndoSnackbar(`${_lastDeleted.length} member(s) deleted.`);

    if (_undoTimer) clearTimeout(_undoTimer);
    _undoTimer = setTimeout(() => { _lastDeleted = []; hideUndoSnackbar(); }, 8000);
}

function undoDelete() {
    if (!_lastDeleted.length) return;
    const members = getMembers();
    saveMembers([...members, ..._lastDeleted]);
    _lastDeleted = [];
    if (_undoTimer) clearTimeout(_undoTimer);
    hideUndoSnackbar();
    loadMembers();
}

function showUndoSnackbar(message) {
    document.getElementById('undo-message').textContent = message;
    document.getElementById('undo-snackbar').style.display = 'flex';
}
function hideUndoSnackbar() {
    const sb = document.getElementById('undo-snackbar');
    if (sb) sb.style.display = 'none';
}

// ============================================================
// STATS BAR
// ============================================================
function renderStatsBar(members) {
    const bar = document.getElementById('stats-bar');
    if (!bar) return;
    const yearCounts = {};
    members.forEach(m => {
        const y = parseInt(m.year, 10);
        if (!isNaN(y)) yearCounts[y] = (yearCounts[y] || 0) + 1;
    });
    const deptSet = new Set(members.map(m => (m.department || '').trim().toLowerCase()).filter(Boolean));
    bar.innerHTML = `
        <div class="stat-card"><span class="stat-number">${members.length}</span><span class="stat-label">Total Members</span></div>
        <div class="stat-card"><span class="stat-number">${deptSet.size}</span><span class="stat-label">Departments</span></div>
        ${[1,2,3,4,5].filter(y => yearCounts[y]).map(y => `
        <div class="stat-card"><span class="stat-number">${yearCounts[y]}</span><span class="stat-label">Year ${y}</span></div>`).join('')}
    `;
}

// ============================================================
// MEMBER LIST RENDERING
// ============================================================
function renderMemberList(allMembers) {
    const membersDiv = document.getElementById('members');
    const countLabel = document.getElementById('member-count-label');
    const loggedIn   = isLoggedIn();

    const q = ((document.getElementById('member-search') || {}).value || '').trim().toLowerCase();
    const members = q
        ? allMembers.filter(m =>
            (m.name         || '').toLowerCase().includes(q) ||
            (m.studentId    || '').toLowerCase().includes(q) ||
            (m.department   || '').toLowerCase().includes(q) ||
            (m.memberNumber || '').toLowerCase().includes(q))
        : allMembers;

    if (countLabel) {
        countLabel.textContent = q
            ? `${members.length} of ${allMembers.length} shown`
            : `${allMembers.length} member${allMembers.length !== 1 ? 's' : ''}`;
    }

    if (allMembers.length === 0) { membersDiv.innerHTML = '<p>No members added yet.</p>'; return; }
    if (members.length === 0)    { membersDiv.innerHTML = '<p>No members match your search.</p>'; return; }

    membersDiv.innerHTML = members.map(member => {
        const displayName        = String(member.name || '').replace(/\s*\(ESA-[^)]+\)\s*/, '').trim();
        const memberNumberDisplay = member.memberNumber || 'Unassigned';
        const y = parseInt(member.year, 10);
        const yearText = !isNaN(y) ? `${y}${y===1?'st':y===2?'nd':y===3?'rd':'th'} Year`
                       : member.year ? `${member.year} Year` : '';

        const checkboxHtml = loggedIn
            ? `<input type="checkbox" class="select-checkbox" data-member-number="${memberNumberDisplay}" aria-label="Select ${displayName}">`
            : '';
        const actionsHtml = loggedIn ? `
            <div style="display:flex;gap:5px;flex-shrink:0">
                <button class="edit-btn"   data-member-number="${memberNumberDisplay}" title="Edit">Edit</button>
                <button class="delete-btn" data-member-number="${memberNumberDisplay}" title="Delete">Delete</button>
            </div>` : '';

        return `
        <div class="member-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
                <div style="display:flex;align-items:center;gap:8px;min-width:0">
                    ${checkboxHtml}
                    <div style="min-width:0">
                        <h4 style="margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${displayName}</h4>
                        <small style="color:#0047AB;font-weight:bold">${memberNumberDisplay}</small>
                    </div>
                </div>
                ${actionsHtml}
            </div>
            <p><strong>Email:</strong> ${member.email}</p>
            <p><strong>Student ID:</strong> ${member.studentId}</p>
            <p><strong>Dept:</strong> ${member.department}</p>
            ${yearText ? `<p><strong>Year:</strong> ${yearText}</p>` : ''}
            ${member.phone ? `<p><strong>Phone:</strong> ${member.phone}</p>` : ''}
            <p style="color:#888;font-size:0.78em;margin-top:4px">Added: ${new Date(member.dateAdded).toLocaleDateString()}</p>
        </div>`;
    }).join('');

    membersDiv.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const m = getMembers().find(x => x.memberNumber === btn.dataset.memberNumber);
            if (m) openEditModal(m);
        });
    });

    membersDiv.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showConfirmModal(`Delete member ${btn.dataset.memberNumber}?`,
                () => performSoftDelete([btn.dataset.memberNumber]));
        });
    });

    membersDiv.querySelectorAll('.select-checkbox').forEach(cb => {
        cb.addEventListener('change', updateBulkControls);
    });

    const selectAll = document.getElementById('select-all');
    if (selectAll) {
        selectAll.checked = false;
        selectAll.onclick = () => {
            membersDiv.querySelectorAll('.select-checkbox').forEach(cb => cb.checked = selectAll.checked);
            updateBulkControls();
        };
    }
    const bulkBtn = document.getElementById('bulk-delete-btn');
    if (bulkBtn) {
        bulkBtn.disabled = true;
        bulkBtn.onclick = () => {
            const selected = Array.from(membersDiv.querySelectorAll('.select-checkbox:checked'))
                .map(cb => cb.dataset.memberNumber);
            if (!selected.length) return;
            showConfirmModal(`Delete ${selected.length} selected member(s)?`, () => performSoftDelete(selected));
        };
    }
}

function updateBulkControls() {
    const selected  = document.querySelectorAll('.select-checkbox:checked').length;
    const bulkBtn   = document.getElementById('bulk-delete-btn');
    if (bulkBtn) bulkBtn.disabled = selected === 0;
    const selectAll = document.getElementById('select-all');
    if (selectAll) {
        const total = document.querySelectorAll('.select-checkbox').length;
        selectAll.checked = total > 0 && selected === total;
    }
}

// ============================================================
// BULK ADD MEMBERS
// ============================================================
function bulkAddMembers() {
    if (!isLoggedIn()) return;
    const bulkData  = document.getElementById('bulk-data').value.trim();
    const statusDiv = document.getElementById('bulk-status');

    if (!bulkData) { statusDiv.innerHTML = '<p style="color:red">Please paste member data first.</p>'; return; }

    try {
        const lines         = bulkData.split('\n').map(l => l.trim()).filter(Boolean);
        const parsedMembers = [];
        let currentMember   = null;

        for (const line of lines) {
            const numMatch = line.match(/^(\d+)\.\s*(.+)$/);
            if (numMatch) {
                if (currentMember) parsedMembers.push(currentMember);
                currentMember = { name: numMatch[2].trim(), email:'', studentId:'', department:'', year:'', phone:'', dateAdded: new Date().toISOString() };
            } else if (currentMember) {
                const ci = line.indexOf(':');
                if (ci > 0) {
                    const key = line.slice(0, ci).trim().toLowerCase().replace(/\s+/g, '');
                    const val = line.slice(ci + 1).trim();
                    if      (key.includes('email'))                               currentMember.email      = currentMember.email || val;
                    else if (key.includes('admission') || key.includes('studentid')) currentMember.studentId = val;
                    else if (key.includes('phone'))                               currentMember.phone      = val;
                    else if (key.includes('department') || key.includes('dept')) currentMember.department = val;
                    else if (key.includes('year'))                                currentMember.year       = val;
                }
            }
        }
        if (currentMember) parsedMembers.push(currentMember);

        const validMembers = parsedMembers.filter(m => m.name && m.email && m.studentId);
        if (!validMembers.length) {
            statusDiv.innerHTML = '<p style="color:red">No valid members found. Check each entry has Name, Email, and Admission No.</p>';
            return;
        }

        const existing       = getMembers();
        const existingEmails = new Set(existing.map(m => m.email));
        const existingIds    = new Set(existing.map(m => m.studentId));
        const newMembers     = validMembers.filter(m => !existingEmails.has(m.email) && !existingIds.has(m.studentId));
        const duplicates     = validMembers.length - newMembers.length;

        if (!newMembers.length) { statusDiv.innerHTML = '<p style="color:red">All members in the pasted data already exist.</p>'; return; }

        newMembers.forEach(m => { m.memberNumber = deriveMemberNumber(m.studentId); });
        saveMembers([...existing, ...newMembers]);
        loadMembers();

        let msg = `<p style="color:green">Added ${newMembers.length} new member(s).`;
        if (duplicates) msg += ` ${duplicates} duplicate(s) skipped.`;
        msg += '</p>';
        statusDiv.innerHTML = msg;
        document.getElementById('bulk-data').value = '';

    } catch (err) {
        statusDiv.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
    }
}

// ============================================================
// EXPORT
// ============================================================
function exportCSV() {
    const members = getMembers();
    if (!members.length) { alert('No members to export.'); return; }
    const rows = [
        ['Member Number','Name','Email','Student ID','Department','Year','Phone','Date Added'],
        ...members.map(m => [m.memberNumber, m.name, m.email, m.studentId, m.department, m.year, m.phone||'', m.dateAdded])
    ];
    downloadFile(rows.map(r => r.map(f => `"${f}"`).join(',')).join('\n'), 'esa-members.csv', 'text/csv');
}

function exportJSON() {
    const members = getMembers();
    if (!members.length) { alert('No members to export.'); return; }
    downloadFile(JSON.stringify(members, null, 2), 'esa-members.json', 'application/json');
}

function exportXLSX() {
    const members = getMembers();
    if (!members.length) { alert('No members to export.'); return; }
    const ws = XLSX.utils.json_to_sheet(members.map(m => ({
        'Member Number': m.memberNumber, 'Name': m.name, 'Email': m.email,
        'Student ID': m.studentId, 'Department': m.department, 'Year': m.year,
        'Phone': m.phone || '', 'Date Added': m.dateAdded
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members');
    XLSX.writeFile(wb, 'esa-members.xlsx');
}

function quickBackup() {
    const members = getMembers();
    if (!members.length) { document.getElementById('backup-status').innerHTML = '<p style="color:red">No members to backup.</p>'; return; }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    downloadFile(JSON.stringify(members, null, 2), `esa-members-backup-${ts}.json`, 'application/json');
    document.getElementById('backup-status').innerHTML = `<p style="color:green">Backup saved: esa-members-backup-${ts}.json</p>`;
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ============================================================
// IMPORT
// ============================================================
function importData() {
    if (!isLoggedIn()) return;
    const fileInput = document.getElementById('import-file');
    const file      = fileInput.files[0];
    if (!file) { alert('Please select a file to import.'); return; }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let imported;
            if (file.name.endsWith('.json')) {
                imported = JSON.parse(e.target.result);
            } else if (file.name.endsWith('.csv')) {
                const lines   = e.target.result.split('\n').filter(l => l.trim());
                const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
                imported = lines.slice(1).map(line => {
                    const vals = line.split(',').map(v => v.replace(/"/g, '').trim());
                    const obj  = {};
                    headers.forEach((h, i) => { obj[h.toLowerCase().replace(/\s+/g, '')] = vals[i] || ''; });
                    return obj;
                });
            } else { throw new Error('Unsupported format. Use JSON or CSV.'); }

            const valid = imported.filter(m => m.name && m.email && (m.studentId || m.studentid));
            if (!valid.length) { alert('No valid member data found.'); return; }

            const existing       = getMembers();
            const existingEmails = new Set(existing.map(m => m.email));
            const existingIds    = new Set(existing.map(m => m.studentId));
            const toAdd = valid.filter(m => !existingEmails.has(m.email) && !existingIds.has(m.studentId || m.studentid));
            if (!toAdd.length) { alert('All imported members already exist.'); return; }

            toAdd.forEach(m => {
                const sid = m.studentId || m.studentid || '';
                if (!m.memberNumber) m.memberNumber = deriveMemberNumber(sid);
                if (!m.dateAdded)    m.dateAdded    = new Date().toISOString();
                if (!m.studentId)    m.studentId    = sid;
            });
            saveMembers([...existing, ...toAdd]);
            loadMembers();
            alert(`Imported ${toAdd.length} new member(s).`);
            fileInput.value = '';
        } catch (err) { alert('Import error: ' + err.message); }
    };
    reader.readAsText(file);
}

// ============================================================
// CONFIRMATION MODAL
// ============================================================
let _pendingConfirm = null;
function showConfirmModal(message, onConfirm) {
    const modal  = document.getElementById('confirm-modal');
    const msg    = document.getElementById('confirm-message');
    const ok     = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');
    msg.textContent = message;
    modal.setAttribute('aria-hidden', 'false');
    _pendingConfirm = onConfirm;
    const done     = () => { modal.setAttribute('aria-hidden', 'true'); ok.removeEventListener('click', onOk); cancel.removeEventListener('click', onCancel); _pendingConfirm = null; };
    const onOk     = () => { if (_pendingConfirm) _pendingConfirm(); done(); };
    const onCancel = () => done();
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
}

// ============================================================
// TAB SWITCHING
// ============================================================
function switchTab(tabName) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    const panel  = document.getElementById(tabName);
    const button = document.querySelector(`[data-tab="${tabName}"]`);
    if (panel)  panel.classList.add('active');
    if (button) button.classList.add('active');
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    migrateMemberNumbers(); // fix any old ESA-KU-0001 style numbers
    applyAuthState();
    loadMembers();

    document.getElementById('member-form').addEventListener('submit', addMember);
    document.getElementById('export-csv').addEventListener('click', exportCSV);
    document.getElementById('export-json').addEventListener('click', exportJSON);
    document.getElementById('export-xlsx').addEventListener('click', exportXLSX);
    document.getElementById('quick-backup').addEventListener('click', quickBackup);
    document.getElementById('import-btn').addEventListener('click', importData);
    document.getElementById('bulk-add').addEventListener('click', bulkAddMembers);
    document.getElementById('undo-btn').addEventListener('click', undoDelete);

    // Auth
    document.getElementById('login-btn').addEventListener('click', openLoginModal);
    document.getElementById('logout-btn').addEventListener('click', () => { sessionStorage.removeItem('esa-auth'); applyAuthState(); });
    document.getElementById('login-submit').addEventListener('click', loginUser);
    document.getElementById('login-cancel').addEventListener('click', closeLoginModal);
    document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') loginUser(); });

    // Edit modal
    document.getElementById('edit-save').addEventListener('click', saveEditMember);
    document.getElementById('edit-cancel').addEventListener('click', closeEditModal);

    // Search
    const searchInput = document.getElementById('member-search');
    searchInput.addEventListener('input', () => renderMemberList(getMembers()));
    document.getElementById('search-clear').addEventListener('click', () => { searchInput.value = ''; renderMemberList(getMembers()); });

    // Tabs
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    switchTab('member-list');
});
