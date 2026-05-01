const captchas = { login:'', signup:'', forgot:'' };
function generateCaptcha(type) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    captchas[type] = code;
    document.getElementById(type + 'CaptchaText').textContent = code;
}
generateCaptcha('login');
generateCaptcha('signup');
generateCaptcha('forgot');

// ==================== BACKEND API INTEGRATION ====================
const API_BASE = '';
const API_URLS = {
    signup: `${API_BASE}/api/signup`,
    login: `${API_BASE}/api/login`,
    logout: `${API_BASE}/api/logout`,
    forgotPassword: `${API_BASE}/api/forgot-password`,
    resetPassword: `${API_BASE}/api/reset-password`,
    opportunities: `${API_BASE}/api/opportunities`,
    students: `${API_BASE}/api/students`,
    bulkStudents: `${API_BASE}/api/students/bulk`,
    verifiers: `${API_BASE}/api/verifiers`,
    bulkVerifiers: `${API_BASE}/api/verifiers/bulk`,
    checkSession: `${API_BASE}/api/check-session`,
};

let currentAdmin = null;
let currentOpportunities = [];
let currentStudents = [];
let currentVerifiers = [];
let editingOpportunityId = null;
let currentResetToken = null;

// ==================== CHECK EXISTING SESSION ====================
async function checkExistingSession() {
    try {
        const response = await fetch(API_URLS.checkSession, { 
            method: 'GET',
            credentials: 'include' 
        });
        const data = await response.json();
        
        if (data.authenticated) {
            currentAdmin = data.admin;
            currentOpportunities = data.opportunities || [];
            
            document.getElementById('dashName').textContent = currentAdmin.full_name;
            document.getElementById('dashAvatar').textContent = currentAdmin.full_name.substring(0, 2).toUpperCase();
            
            document.getElementById('authWrapper').style.display = 'none';
            document.getElementById('dashboardWrapper').classList.add('active');
            document.body.style.alignItems = 'stretch';
            
            renderOpportunityCards(currentOpportunities);
            await Promise.all([loadStudents(), loadVerifiers()]);
            
            if (window.innerWidth <= 768) {
                const menuBtn = document.getElementById('menuToggle');
                if (menuBtn) menuBtn.style.display = 'flex';
            }
        }
    } catch (error) {
        console.log('No active session');
    }
}

// ==================== LOAD OPPORTUNITIES FROM BACKEND ====================
async function loadOpportunities() {
    try {
        const response = await fetch(API_URLS.opportunities, { 
            method: 'GET',
            credentials: 'include' 
        });
        
        if (!response.ok) {
            if (response.status === 401) return [];
            throw new Error('Failed to load opportunities');
        }
        
        const data = await response.json();
        currentOpportunities = data.opportunities || [];
        renderOpportunityCards(currentOpportunities);
        return currentOpportunities;
    } catch (error) {
        console.error('Error loading opportunities:', error);
        showToast('Failed to load opportunities');
        return [];
    }
}

async function loadStudents() {
    try {
        const response = await fetch(API_URLS.students, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 401) return [];
            throw new Error('Failed to load students');
        }

        const data = await response.json();
        currentStudents = data.students || [];
        renderStudentsTable(currentStudents);
        renderStudentStats(currentStudents);
        return currentStudents;
    } catch (error) {
        console.error('Error loading students:', error);
        return [];
    }
}

async function loadVerifiers() {
    try {
        const response = await fetch(API_URLS.verifiers, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 401) return [];
            throw new Error('Failed to load verifiers');
        }

        const data = await response.json();
        currentVerifiers = data.verifiers || [];
        renderVerifiersTable(currentVerifiers);
        renderVerifierStats(currentVerifiers);
        return currentVerifiers;
    } catch (error) {
        console.error('Error loading verifiers:', error);
        return [];
    }
}

function humanizeStatus(status) {
    const labels = {
        active: 'Active',
        inactive: 'Inactive',
        pending: 'Pending Approval',
        deactivated: 'Deactivated'
    };
    return labels[status] || status;
}

function formatLastLogin(value) {
    if (!value) return 'Never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Never';
    return date.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function formatJoinDate(value) {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString([], {
        year: 'numeric',
        month: 'short'
    });
}

function renderStudentsTable(students) {
    const body = document.getElementById('studentsTableBody');
    if (!body) return;

    body.innerHTML = '';

    if (!students.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding: 24px; color: var(--qf-text-light);">
                    No students have been added yet.
                </td>
            </tr>
        `;
        return;
    }

    students.forEach(student => {
        const row = document.createElement('tr');
        row.setAttribute('data-status', student.status);
        row.innerHTML = `
            <td>${escapeHtml(student.display_id)}</td>
            <td>${escapeHtml(student.full_name)}</td>
            <td>${escapeHtml(student.email)}</td>
            <td><span class="badge ${escapeHtml(student.status)}">${escapeHtml(humanizeStatus(student.status))}</span></td>
            <td>${escapeHtml(String(student.courses_enrolled ?? 0))}</td>
            <td><span class="badge certified">${escapeHtml(String(student.certificates_count ?? 0))} Certified</span></td>
            <td>${escapeHtml(formatLastLogin(student.last_login_at))}</td>
        `;
        body.appendChild(row);
    });

    filterStudents();
}

function renderStudentStats(students) {
    const total = students.length;
    const certified = students.filter(student => (student.certificates_count || 0) > 0).length;
    const enrolled = students.filter(student => (student.courses_enrolled || 0) > 0).length;
    const deactivated = students.filter(student => student.status === 'deactivated').length;

    const totalNode = document.getElementById('studentsTotalCount');
    const certifiedNode = document.getElementById('studentsCertifiedCount');
    const enrolledNode = document.getElementById('studentsEnrolledCount');
    const deactivatedNode = document.getElementById('studentsDeactivatedCount');

    if (totalNode) totalNode.textContent = String(total);
    if (certifiedNode) certifiedNode.textContent = String(certified);
    if (enrolledNode) enrolledNode.textContent = String(enrolled);
    if (deactivatedNode) deactivatedNode.textContent = String(deactivated);
}

function renderVerifiersTable(verifiers) {
    const body = document.getElementById('verifiersTableBody');
    if (!body) return;

    body.innerHTML = '';

    if (!verifiers.length) {
        body.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding: 24px; color: var(--qf-text-light);">
                    No verifiers have been added yet.
                </td>
            </tr>
        `;
        return;
    }

    verifiers.forEach(verifier => {
        const row = document.createElement('tr');
        row.setAttribute('data-status', verifier.status);
        row.addEventListener('click', () => openVerifierDetailsById(verifier.id));
        row.innerHTML = `
            <td>${escapeHtml(verifier.display_id)}</td>
            <td>${escapeHtml(verifier.full_name)}</td>
            <td>${escapeHtml(verifier.email)}</td>
            <td><span class="badge ${escapeHtml(verifier.status)}">${escapeHtml(humanizeStatus(verifier.status))}</span></td>
            <td>${escapeHtml(verifier.subject)}</td>
            <td><span class="badge certified">${escapeHtml(String(verifier.certified_students ?? 0))}</span></td>
            <td>${escapeHtml(formatJoinDate(verifier.created_at))}</td>
        `;
        body.appendChild(row);
    });

    filterVerifiers();
}

function renderVerifierStats(verifiers) {
    const total = verifiers.length;
    const active = verifiers.filter(verifier => verifier.status === 'active').length;
    const pending = verifiers.filter(verifier => verifier.status === 'pending').length;
    const certified = verifiers.reduce(
        (sum, verifier) => sum + (verifier.certified_students || 0),
        0
    );

    const totalNode = document.getElementById('verifiersTotalCount');
    const activeNode = document.getElementById('verifiersActiveCount');
    const pendingNode = document.getElementById('verifiersPendingCount');
    const certifiedNode = document.getElementById('verifiersCertifiedCount');

    if (totalNode) totalNode.textContent = String(total);
    if (activeNode) activeNode.textContent = String(active);
    if (pendingNode) pendingNode.textContent = String(pending);
    if (certifiedNode) certifiedNode.textContent = String(certified);
}

async function openVerifierDetailsById(verifierId) {
    const verifier = currentVerifiers.find(item => item.id === verifierId);
    if (!verifier) {
        showToast('Verifier not found');
        return;
    }

    openVerifierDetails(verifier.full_name, {
        subjects: [{ name: verifier.subject, students: verifier.total_students || 0 }],
        totalStudents: verifier.total_students || 0,
        certified: verifier.certified_students || 0,
        inProgress: verifier.in_progress_students || 0,
        pending: verifier.pending_students || 0
    });
}

function parseCsvRows(csvText) {
    const lines = csvText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        return [];
    }

    const headers = lines[0]
        .split(',')
        .map(header => header.trim().toLowerCase());

    return lines.slice(1).map(line => {
        const values = line.split(',').map(value => value.trim());
        return headers.reduce((row, header, index) => {
            row[header] = values[index] || '';
            return row;
        }, {});
    });
}

function pickCsvValue(row, keys) {
    for (const key of keys) {
        if (row[key]) {
            return row[key];
        }
    }
    return '';
}

function syncResetPageFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');

    if (token) {
        currentResetToken = token;
        showPage('resetPage');
        return true;
    }

    return false;
}

// ==================== RENDER OPPORTUNITY CARDS (US-2.1) ====================
function renderOpportunityCards(opportunities) {
    const grid = document.querySelector('.opportunities-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (!opportunities || opportunities.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: var(--qf-white); border-radius: 16px;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--qf-text-light)" style="margin-bottom: 16px;">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                <h3 style="color: var(--qf-text); margin-bottom: 8px;">No Opportunities Yet</h3>
                <p style="color: var(--qf-text-light);">Click "Add New Opportunity" to create your first opportunity.</p>
            </div>
        `;
        return;
    }
    
    opportunities.forEach(opp => {
        const card = createOpportunityCard(opp);
        grid.appendChild(card);
    });
}

// ==================== CREATE OPPORTUNITY CARD ====================
function createOpportunityCard(opp) {
    const card = document.createElement('div');
    card.className = 'opportunity-card';
    card.dataset.id = opp.id;
    
    const skillsList = opp.skills_list || (opp.skills ? opp.skills.split(',').map(s => s.trim()) : []);
    const shortDescription = opp.description.length > 120 ? opp.description.substring(0, 120) + '...' : opp.description;
    
    card.innerHTML = `
        <div class="opportunity-card-header">
            <h5>${escapeHtml(opp.name)}</h5>
            <div class="opportunity-meta">
                <span><svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${escapeHtml(opp.duration)}</span>
                <span><svg viewBox="0 0 24 24" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${escapeHtml(opp.start_date)}</span>
            </div>
            <div style="display: inline-block; padding: 4px 10px; background: var(--qf-mint-pale); border-radius: 12px; font-size: 11px; margin-top: 8px;">
                ${escapeHtml(opp.category)}
            </div>
        </div>
        <p class="opportunity-description">${escapeHtml(shortDescription)}</p>
        <div class="opportunity-skills">
            <div class="opportunity-skills-label">Skills You'll Gain</div>
            <div class="skills-tags">
                ${skillsList.map(skill => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join('')}
            </div>
        </div>
        <div class="opportunity-footer">
            <div style="display: flex; gap: 8px;">
                <button onclick="viewOpportunityDetails(${opp.id})" class="view-course-btn" style="width: auto; padding: 8px 16px;">View Details</button>
                <button onclick="editOpportunity(${opp.id})" style="padding: 8px 16px; border: none; border-radius: 8px; background: var(--qf-mint-pale); color: var(--qf-green-dark); cursor: pointer;">Edit</button>
                <button onclick="deleteOpportunity(${opp.id})" style="padding: 8px 16px; border: none; border-radius: 8px; background: rgba(217,79,79,0.1); color: var(--qf-red); cursor: pointer;">Delete</button>
            </div>
        </div>
    `;
    
    return card;
}

// ==================== VIEW OPPORTUNITY DETAILS (US-2.4) ====================
async function viewOpportunityDetails(oppId) {
    try {
        const response = await fetch(`${API_URLS.opportunities}/${oppId}`, { 
            method: 'GET',
            credentials: 'include' 
        });
        
        if (!response.ok) throw new Error('Failed to load opportunity details');
        
        const data = await response.json();
        const opp = data.opportunity;
        
        document.getElementById('opportunityDetailTitle').textContent = opp.name;
        document.getElementById('opportunityDetailDuration').textContent = opp.duration;
        document.getElementById('opportunityDetailStartDate').textContent = opp.start_date;
        document.getElementById('opportunityDetailCategory').textContent = opp.category;
        document.getElementById('opportunityDetailApplicants').textContent = opp.max_applicants || 'No limit';
        document.getElementById('opportunityDetailDescription').textContent = opp.description;
        document.getElementById('opportunityDetailFuture').textContent = opp.future_opportunities;
        
        const skillsContainer = document.getElementById('opportunityDetailSkills');
        skillsContainer.innerHTML = '';
        const skillsList = opp.skills_list || (opp.skills ? opp.skills.split(',').map(s => s.trim()) : []);
        skillsList.forEach(skill => {
            const tag = document.createElement('span');
            tag.className = 'skill-tag';
            tag.textContent = skill;
            skillsContainer.appendChild(tag);
        });
        
        document.getElementById('opportunityDetailsModal').classList.add('active');
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to load opportunity details');
    }
}

// ==================== EDIT OPPORTUNITY (US-2.5) ====================
async function editOpportunity(oppId) {
    try {
        const response = await fetch(`${API_URLS.opportunities}/${oppId}`, { 
            method: 'GET',
            credentials: 'include' 
        });
        
        if (!response.ok) throw new Error('Failed to load opportunity');
        
        const data = await response.json();
        const opp = data.opportunity;
        
        editingOpportunityId = opp.id;
        
        document.getElementById('oppName').value = opp.name;
        document.getElementById('oppDuration').value = opp.duration;
        document.getElementById('oppStartDate').value = opp.start_date;
        document.getElementById('oppDescription').value = opp.description;
        document.getElementById('oppSkills').value = opp.skills;
        document.getElementById('oppCategory').value = opp.category;
        document.getElementById('oppFuture').value = opp.future_opportunities;
        document.getElementById('oppMaxApplicants').value = opp.max_applicants || '';
        
        const modal = document.getElementById('opportunityModal');
        const modalTitle = modal.querySelector('h3');
        const submitBtn = modal.querySelector('button[type="submit"]');
        modalTitle.textContent = 'Edit Opportunity';
        submitBtn.textContent = 'Update Opportunity';
        modal.dataset.mode = 'edit';
        
        modal.classList.add('active');
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to load opportunity for editing');
    }
}

// ==================== DELETE OPPORTUNITY (US-2.6) ====================
async function deleteOpportunity(oppId) {
    const confirmed = confirm('Are you sure you want to delete this opportunity? This action cannot be undone.');
    
    if (!confirmed) return;
    
    try {
        const response = await fetch(`${API_URLS.opportunities}/${oppId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast('Opportunity deleted successfully');
            await loadOpportunities();
        } else {
            showToast(data.error || 'Failed to delete opportunity');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Network error. Please try again.');
    }
}

// ==================== RESET OPPORTUNITY FORM ====================
function resetOpportunityForm() {
    const form = document.getElementById('opportunityForm');
    if (form) form.reset();
    
    const modal = document.getElementById('opportunityModal');
    modal.dataset.mode = 'create';
    const modalTitle = modal.querySelector('h3');
    const submitBtn = modal.querySelector('button[type="submit"]');
    modalTitle.textContent = 'Add New Opportunity';
    submitBtn.textContent = 'Create Opportunity';
    editingOpportunityId = null;
}

// ===== PAGE NAVIGATION =====
function showPage(pageId) {
    document.querySelectorAll('.form-page').forEach(p => p.classList.remove('active'));
    setTimeout(() => document.getElementById(pageId).classList.add('active'), 50);
    document.querySelectorAll('.error-msg').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('input').forEach(i => i.classList.remove('error'));
}

function togglePass(inputId, btn) {
    const input = document.getElementById(inputId);
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.innerHTML = isPass
        ? '<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

// ===== HELPERS =====
function showError(id, msg) {
    const el = document.getElementById(id);
    if (msg) el.querySelector('span').textContent = msg;
    el.classList.add('show');
}
function clearAllErrors(formId) {
    document.querySelectorAll('#' + formId + ' .error-msg').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('#' + formId + ' input').forEach(i => i.classList.remove('error'));
}
function shakeForm(formId) {
    const form = document.getElementById(formId);
    form.classList.add('shake');
    setTimeout(() => form.classList.remove('shake'), 400);
}
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function showToast(msg) {
    document.getElementById('toastMsg').textContent = msg;
    document.getElementById('toast').classList.add('show');
    setTimeout(() => document.getElementById('toast').classList.remove('show'), 3000);
}

function checkStrength(val) {
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const labels = ['','Weak','Medium','Strong','Very Strong'];
    const classes = ['','weak','medium','strong','very-strong'];
    for (let i = 1; i <= 4; i++) {
        const bar = document.getElementById('str' + i);
        bar.className = 'strength-bar';
        if (i <= score) bar.classList.add(classes[score]);
    }
    document.getElementById('strengthLabel').textContent = val.length > 0 ? labels[score] : '';
}

// ===== SHOW DASHBOARD =====
async function showDashboard(email) {
    document.getElementById('authWrapper').style.display = 'none';
    document.getElementById('dashboardWrapper').classList.add('active');
    document.body.style.alignItems = 'stretch';

    await loadOpportunities();

    const name = email.split('@')[0];
    const displayName = name.charAt(0).toUpperCase() + name.slice(1);
    document.getElementById('dashName').textContent = displayName;
    document.getElementById('dashAvatar').textContent = displayName.substring(0, 2).toUpperCase();

    if (window.innerWidth <= 768) {
        document.getElementById('menuToggle').style.display = 'flex';
    }
}

async function handleLogout() {
    try {
        await fetch(API_URLS.logout, { method: 'POST', credentials: 'include' });
    } catch (error) {
        console.log('Logout error:', error);
    }
    
    currentAdmin = null;
    currentOpportunities = [];
    editingOpportunityId = null;
    
    document.getElementById('dashboardWrapper').classList.remove('active');
    document.getElementById('authWrapper').style.display = 'flex';
    document.body.style.alignItems = '';
    showToast('Signed out successfully');
    showPage('loginPage');
}

// ===== NAV ITEMS =====
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', function() {
        const page = this.getAttribute('data-page');
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        
        document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
        
        if (page === 'dashboard') {
            document.getElementById('dashboardSection').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Dashboard';
        } else if (page === 'learner') {
            document.getElementById('learnerSection').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Learner Management';
        } else if (page === 'verifier') {
            document.getElementById('verifierSection').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Verifier Management';
        } else if (page === 'collaborator') {
            document.getElementById('collaboratorSection').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Collaborator Management';
        } else if (page === 'opportunity') {
            document.getElementById('opportunitySection').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Opportunity Management';
        } else if (page === 'reports') {
            document.getElementById('reportsSection').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Reports and Analytics';
        }
    });
});

// ===== TABS =====
function changeChartPeriod(period) {
    document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase() === period) {
            btn.classList.add('active');
        }
    });

    const chartData = {
        daily: 'M0,120 Q50,110 100,90 T200,70 T300,50 T400,40',
        weekly: 'M0,110 Q50,95 100,85 T200,65 T300,45 T400,35',
        monthly: 'M0,100 Q50,85 100,75 T200,55 T300,40 T400,30',
        quarterly: 'M0,90 Q50,75 100,65 T200,50 T300,35 T400,25',
        yearly: 'M0,80 Q50,65 100,55 T200,40 T300,30 T400,20'
    };

    const linePath = document.getElementById('linePath');
    const lineArea = document.getElementById('lineArea');
    
    const path = chartData[period];
    linePath.setAttribute('d', path);
    lineArea.setAttribute('d', path + ' L400,150 L0,150 Z');
}

// ===== NOTIFICATIONS =====
function toggleNotifications() {
    const dropdown = document.getElementById('notificationDropdown');
    dropdown.classList.toggle('active');
}

function markAllRead() {
    document.querySelectorAll('.notif-item.unread').forEach(item => {
        item.classList.remove('unread');
    });
    showToast('All notifications marked as read');
}

document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('notificationDropdown');
    const btn = document.getElementById('notifBtn');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

// ===== THEME TOGGLE =====
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    
    const icon = document.getElementById('themeIcon');
    if (newTheme === 'dark') {
        icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    } else {
        icon.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
    }
}

// ===== SEARCH =====
function openSearch() {
    document.getElementById('searchContainer').classList.add('active');
    document.getElementById('searchInput').focus();
}

function closeSearch() {
    document.getElementById('searchContainer').classList.remove('active');
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeSearch();
        closeCourseModal();
        closeOpportunityModal();
        closeOpportunityDetailsModal();
        closeCollaboratorCoursesModal();
        closeQuickAddModal();
        closeBulkUploadModal();
        closeQuickAddVerifierModal();
        closeBulkUploadVerifierModal();
        closeVerifierDetailsModal();
    }
});

document.getElementById('searchContainer').addEventListener('click', function(e) {
    if (e.target === this) {
        closeSearch();
    }
});

// ===== COURSE MODAL =====
function openCourseDetails(courseName, stats) {
    document.getElementById('modalCourseTitle').textContent = courseName;
    document.getElementById('modalEnrolled').textContent = stats.enrolled;
    document.getElementById('modalCompleted').textContent = stats.completed;
    document.getElementById('modalInProgress').textContent = stats.inProgress;
    document.getElementById('modalHalfDone').textContent = stats.halfDone;
    document.getElementById('courseModal').classList.add('active');
}

function closeCourseModal() {
    document.getElementById('courseModal').classList.remove('active');
}

document.getElementById('courseModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeCourseModal();
    }
});

// ===== OPPORTUNITY DETAILS MODAL =====
const originalOpenOpportunityDetails = window.openOpportunityDetails;
window.openOpportunityDetails = function(title, details) {
    document.getElementById('opportunityDetailTitle').textContent = title;
    document.getElementById('opportunityDetailDuration').textContent = details.duration;
    document.getElementById('opportunityDetailStartDate').textContent = details.startDate;
    document.getElementById('opportunityDetailCategory').textContent = details.category || 'Other';
    document.getElementById('opportunityDetailApplicants').textContent = details.applicants;
    document.getElementById('opportunityDetailDescription').textContent = details.description;
    document.getElementById('opportunityDetailFuture').textContent = details.futureOpportunities;
    
    const skillsContainer = document.getElementById('opportunityDetailSkills');
    skillsContainer.innerHTML = '';
    details.skills.forEach(skill => {
        const tag = document.createElement('span');
        tag.className = 'skill-tag';
        tag.textContent = skill;
        skillsContainer.appendChild(tag);
    });
    
    document.getElementById('opportunityDetailsModal').classList.add('active');
};

function closeOpportunityDetailsModal() {
    document.getElementById('opportunityDetailsModal').classList.remove('active');
}

function applyToOpportunity() {
    showToast('Application submitted successfully!');
    closeOpportunityDetailsModal();
}

document.getElementById('opportunityDetailsModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeOpportunityDetailsModal();
    }
});

// ===== COLLABORATOR COURSES MODAL =====
function openCollaboratorCourses(name, role) {
    document.getElementById('collaboratorName').textContent = name + "'s Submitted Courses";
    document.getElementById('collaboratorRole').textContent = 'Role: ' + role;
    document.getElementById('collaboratorCoursesModal').classList.add('active');
}

function closeCollaboratorCoursesModal() {
    document.getElementById('collaboratorCoursesModal').classList.remove('active');
}

function approveCourse(courseName) {
    showToast(courseName + ' has been approved!');
}

function rejectCourse(courseName) {
    showToast(courseName + ' has been rejected.');
}

function viewCourseDetails(courseName) {
    showToast('Viewing details for ' + courseName);
}

document.getElementById('collaboratorCoursesModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeCollaboratorCoursesModal();
    }
});

// ===== OPPORTUNITY MODAL =====
function openOpportunityModal() {
    resetOpportunityForm();
    document.getElementById('opportunityModal').classList.add('active');
}

function closeOpportunityModal() {
    resetOpportunityForm();
    document.getElementById('opportunityModal').classList.remove('active');
}

document.getElementById('opportunityModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeOpportunityModal();
    }
});

// ===== OPPORTUNITY FORM SUBMISSION (US-2.2 & US-2.5) =====
document.getElementById('opportunityForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const name = document.getElementById('oppName').value.trim();
    const duration = document.getElementById('oppDuration').value.trim();
    const start_date = document.getElementById('oppStartDate').value;
    const description = document.getElementById('oppDescription').value.trim();
    const skills = document.getElementById('oppSkills').value.trim();
    const category = document.getElementById('oppCategory').value;
    const future_opportunities = document.getElementById('oppFuture').value.trim();
    const max_applicants = document.getElementById('oppMaxApplicants').value.trim();

    if (!name || !duration || !start_date || !description || !skills || !category || !future_opportunities) {
        showToast('Please fill all required fields');
        return;
    }

    const opportunityData = {
        name, duration, start_date, description, skills,
        category, future_opportunities,
        max_applicants: max_applicants ? parseInt(max_applicants) : null
    };

    const modal = document.getElementById('opportunityModal');
    const isEdit = modal.dataset.mode === 'edit';
    const url = isEdit ? `${API_URLS.opportunities}/${editingOpportunityId}` : API_URLS.opportunities;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(opportunityData),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast(
                data.message ||
                (isEdit ? 'Opportunity updated successfully!' : 'Opportunity created successfully!')
            );
            closeOpportunityModal();
            await loadOpportunities();
        } else {
            showToast(data.error || 'Operation failed');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Network error. Please try again.');
    }
});

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ===== QUICK ADD STUDENT MODAL =====
function openQuickAddModal() {
    document.getElementById('quickAddModal').classList.add('active');
}

function closeQuickAddModal() {
    document.getElementById('quickAddModal').classList.remove('active');
}

document.getElementById('quickAddModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeQuickAddModal();
    }
});

document.getElementById('quickAddForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const first_name = document.getElementById('studentFirstName').value.trim();
    const last_name = document.getElementById('studentLastName').value.trim();
    const email = document.getElementById('studentEmail').value.trim();

    if (!first_name || !last_name || !email) {
        showToast('Please fill all student fields');
        return;
    }

    try {
        const response = await fetch(API_URLS.students, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ first_name, last_name, email })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast(data.message || 'Student added successfully');
            closeQuickAddModal();
            this.reset();
            await loadStudents();
        } else {
            showToast(data.error || 'Failed to add student');
        }
    } catch (error) {
        console.error('Student add error:', error);
        showToast('Network error. Please try again.');
    }
});

// ===== BULK UPLOAD MODAL =====
function openBulkUploadModal() {
    document.getElementById('bulkUploadModal').classList.add('active');
}

function closeBulkUploadModal() {
    document.getElementById('bulkUploadModal').classList.remove('active');
}

document.getElementById('bulkUploadModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeBulkUploadModal();
    }
});

document.getElementById('bulkUploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('csvFileInput');
    if (fileInput.files.length === 0) {
        showToast('Please select a CSV file');
        return;
    }

    try {
        const csvText = await fileInput.files[0].text();
        const rows = parseCsvRows(csvText).map(row => ({
            first_name: pickCsvValue(row, ['first name', 'firstname', 'first_name', 'first']),
            last_name: pickCsvValue(row, ['last name', 'lastname', 'last_name', 'last']),
            email: pickCsvValue(row, ['email'])
        }));

        const response = await fetch(API_URLS.bulkStudents, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ students: rows })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast(data.message || 'Students uploaded successfully');
            closeBulkUploadModal();
            this.reset();
            document.getElementById('fileName').textContent = '';
            await loadStudents();
        } else {
            showToast(data.error || 'Failed to upload students');
        }
    } catch (error) {
        console.error('Student bulk upload error:', error);
        showToast('Failed to read or upload the CSV file');
    }
});

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        document.getElementById('fileName').textContent = '✓ Selected: ' + file.name;
    }
}

function downloadSampleCSV() {
    const csvContent = 'First Name,Last Name,Email\nJohn,Doe,john.doe@example.com\nJane,Smith,jane.smith@example.com';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_students.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

// ===== QUICK ADD VERIFIER MODAL =====
function openQuickAddVerifierModal() {
    document.getElementById('quickAddVerifierModal').classList.add('active');
}

function closeQuickAddVerifierModal() {
    document.getElementById('quickAddVerifierModal').classList.remove('active');
}

document.getElementById('quickAddVerifierModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeQuickAddVerifierModal();
    }
});

document.getElementById('quickAddVerifierForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const first_name = document.getElementById('verifierFirstName').value.trim();
    const last_name = document.getElementById('verifierLastName').value.trim();
    const email = document.getElementById('verifierEmail').value.trim();
    const subject = document.getElementById('verifierSubject').value.trim();

    if (!first_name || !last_name || !email || !subject) {
        showToast('Please fill all verifier fields');
        return;
    }

    try {
        const response = await fetch(API_URLS.verifiers, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ first_name, last_name, email, subject })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast(data.message || 'Verifier added successfully');
            closeQuickAddVerifierModal();
            this.reset();
            await loadVerifiers();
        } else {
            showToast(data.error || 'Failed to add verifier');
        }
    } catch (error) {
        console.error('Verifier add error:', error);
        showToast('Network error. Please try again.');
    }
});

// ===== BULK UPLOAD VERIFIER MODAL =====
function openBulkUploadVerifierModal() {
    document.getElementById('bulkUploadVerifierModal').classList.add('active');
}

function closeBulkUploadVerifierModal() {
    document.getElementById('bulkUploadVerifierModal').classList.remove('active');
}

document.getElementById('bulkUploadVerifierModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeBulkUploadVerifierModal();
    }
});

document.getElementById('bulkUploadVerifierForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('csvVerifierFileInput');
    if (fileInput.files.length === 0) {
        showToast('Please select a CSV file');
        return;
    }

    try {
        const csvText = await fileInput.files[0].text();
        const rows = parseCsvRows(csvText).map(row => ({
            first_name: pickCsvValue(row, ['first name', 'firstname', 'first_name', 'first']),
            last_name: pickCsvValue(row, ['last name', 'lastname', 'last_name', 'last']),
            email: pickCsvValue(row, ['email']),
            subject: pickCsvValue(row, ['subject'])
        }));

        const response = await fetch(API_URLS.bulkVerifiers, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ verifiers: rows })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast(data.message || 'Verifiers uploaded successfully');
            closeBulkUploadVerifierModal();
            this.reset();
            document.getElementById('verifierFileName').textContent = '';
            await loadVerifiers();
        } else {
            showToast(data.error || 'Failed to upload verifiers');
        }
    } catch (error) {
        console.error('Verifier bulk upload error:', error);
        showToast('Failed to read or upload the CSV file');
    }
});

function handleVerifierFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        document.getElementById('verifierFileName').textContent = '✓ Selected: ' + file.name;
    }
}

function downloadSampleVerifierCSV() {
    const csvContent = 'First Name,Last Name,Email,Subject\nDr. John,Doe,john.doe@qf.edu.qa,Mathematics\nProf. Jane,Smith,jane.smith@qf.edu.qa,Physics';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_verifiers.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

// ===== VERIFIER DETAILS MODAL =====
function openVerifierDetails(name, stats) {
    document.getElementById('verifierName').textContent = name;
    document.getElementById('verifierTotalStudents').textContent = stats.totalStudents;
    document.getElementById('verifierCertified').textContent = stats.certified;
    document.getElementById('verifierInProgress').textContent = stats.inProgress;
    
    const container = document.getElementById('subjectsContainer');
    container.innerHTML = '';
    stats.subjects.forEach(subject => {
        const div = document.createElement('div');
        div.className = 'subject-item';
        div.innerHTML = `
            <span class="subject-name">${subject.name}</span>
            <span class="subject-students">${subject.students} students</span>
        `;
        container.appendChild(div);
    });
    
    document.getElementById('verifierDetailsModal').classList.add('active');
}

function closeVerifierDetailsModal() {
    document.getElementById('verifierDetailsModal').classList.remove('active');
}

document.getElementById('verifierDetailsModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeVerifierDetailsModal();
    }
});

// ===== STUDENT FILTERS =====
function filterStudents() {
    const statusFilter = document.getElementById('statusFilter').value;
    const rows = document.querySelectorAll('#studentsTableBody tr');
    
    rows.forEach(row => {
        const rowStatus = row.getAttribute('data-status');
        let showRow = true;
        
        if (statusFilter !== 'all' && rowStatus !== statusFilter) {
            showRow = false;
        }
        
        row.style.display = showRow ? '' : 'none';
    });
}

// ===== VERIFIER FILTERS =====
function filterVerifiers() {
    const statusFilter = document.getElementById('verifierStatusFilter').value;
    const rows = document.querySelectorAll('#verifiersTableBody tr');
    
    rows.forEach(row => {
        const rowStatus = row.getAttribute('data-status');
        let showRow = true;
        
        if (statusFilter !== 'all' && rowStatus !== statusFilter) {
            showRow = false;
        }
        
        row.style.display = showRow ? '' : 'none';
    });
}

// ===== LOGIN (US-1.2) =====
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    clearAllErrors('loginForm');
    let valid = true;
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const rememberMe = document.querySelector('#loginForm .remember-me input')?.checked || false;
    const captchaInput = document.getElementById('loginCaptchaInput').value.trim();

    if (!email || !isValidEmail(email)) { showError('loginEmailErr'); document.getElementById('loginEmail').classList.add('error'); valid = false; }
    if (!password) { showError('loginPasswordErr','Please enter your password'); document.getElementById('loginPassword').classList.add('error'); valid = false; }
    if (!captchaInput) { showError('loginCaptchaErr','Please enter the captcha code'); valid = false; }
    else if (captchaInput !== captchas.login) { showError('loginCaptchaErr','Captcha does not match. Please try again.'); valid = false; generateCaptcha('login'); }

    if (!valid) { shakeForm('loginForm'); return; }

    try {
        const response = await fetch(API_URLS.login, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, remember_me: rememberMe }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            currentAdmin = data.admin;
            currentOpportunities = data.opportunities || [];
            showToast('Login successful!');
            
            document.getElementById('dashName').textContent = currentAdmin.full_name;
            document.getElementById('dashAvatar').textContent = currentAdmin.full_name.substring(0, 2).toUpperCase();
            
            document.getElementById('authWrapper').style.display = 'none';
            document.getElementById('dashboardWrapper').classList.add('active');
            document.body.style.alignItems = 'stretch';
            
            renderOpportunityCards(currentOpportunities);
            await Promise.all([loadStudents(), loadVerifiers()]);
            
            if (window.innerWidth <= 768) {
                const menuBtn = document.getElementById('menuToggle');
                if (menuBtn) menuBtn.style.display = 'flex';
            }
            
            generateCaptcha('login');
            document.getElementById('loginForm').reset();
        } else {
            showToast(data.error || 'Invalid email or password');
            generateCaptcha('login');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Network error. Please try again.');
        generateCaptcha('login');
    }
});

// ===== SIGNUP (US-1.1) =====
document.getElementById('signupForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    clearAllErrors('signupForm');
    let valid = true;
    const full_name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value.trim();
    const confirm_password = document.getElementById('signupConfirmPassword').value.trim();
    const captchaInput = document.getElementById('signupCaptchaInput').value.trim();

    if (!full_name) { showError('signupNameErr'); document.getElementById('signupName').classList.add('error'); valid = false; }
    if (!email || !isValidEmail(email)) { showError('signupEmailErr'); document.getElementById('signupEmail').classList.add('error'); valid = false; }
    if (!password || password.length < 8) { showError('signupPasswordErr'); document.getElementById('signupPassword').classList.add('error'); valid = false; }
    if (!confirm_password || password !== confirm_password) { showError('signupConfirmPasswordErr'); document.getElementById('signupConfirmPassword').classList.add('error'); valid = false; }
    if (!captchaInput) { showError('signupCaptchaErr','Please enter the captcha code'); valid = false; }
    else if (captchaInput !== captchas.signup) { showError('signupCaptchaErr','Captcha does not match.'); valid = false; generateCaptcha('signup'); }

    if (!valid) { shakeForm('signupForm'); return; }

    try {
        const response = await fetch(API_URLS.signup, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name, email, password, confirm_password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast('Account created successfully!');
            generateCaptcha('signup');
            document.getElementById('signupForm').reset();
            checkStrength('');
            setTimeout(() => showPage('loginPage'), 1500);
        } else {
            showToast(data.error || 'Signup failed');
            generateCaptcha('signup');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showToast('Network error. Please try again.');
        generateCaptcha('signup');
    }
});

// ===== FORGOT PASSWORD (US-1.3) =====
document.getElementById('forgotForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    clearAllErrors('forgotForm');
    let valid = true;
    const email = document.getElementById('forgotEmail').value.trim();
    const captchaInput = document.getElementById('forgotCaptchaInput').value.trim();

    if (!email || !isValidEmail(email)) { showError('forgotEmailErr'); document.getElementById('forgotEmail').classList.add('error'); valid = false; }
    if (!captchaInput) { showError('forgotCaptchaErr','Please enter the captcha code'); valid = false; }
    else if (captchaInput !== captchas.forgot) { showError('forgotCaptchaErr','Captcha does not match.'); valid = false; generateCaptcha('forgot'); }

    if (!valid) { shakeForm('forgotForm'); return; }

    try {
        const response = await fetch(API_URLS.forgotPassword, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        showToast(data.message || 'Reset link sent to your email!');
        generateCaptcha('forgot');
        document.getElementById('forgotForm').reset();
    } catch (error) {
        console.error('Forgot password error:', error);
        showToast('Network error. Please try again.');
        generateCaptcha('forgot');
    }
});

document.getElementById('resetPasswordForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const new_password = document.getElementById('resetNewPassword').value.trim();
    const confirm_password = document.getElementById('resetConfirmPassword').value.trim();

    if (!currentResetToken) {
        showToast('This reset link is missing or invalid.');
        return;
    }

    if (!new_password || new_password.length < 8) {
        showToast('Password must be at least 8 characters');
        return;
    }

    if (new_password !== confirm_password) {
        showToast('Passwords do not match');
        return;
    }

    try {
        const response = await fetch(API_URLS.resetPassword, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: currentResetToken, new_password, confirm_password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast(data.message || 'Password reset successfully');
            currentResetToken = null;
            window.history.replaceState({}, '', '/admin.html');
            this.reset();
            setTimeout(() => showPage('loginPage'), 1000);
        } else {
            showToast(data.error || 'Failed to reset password');
        }
    } catch (error) {
        console.error('Reset password error:', error);
        showToast('Network error. Please try again.');
    }
});

// Clear errors on input
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function() {
        this.classList.remove('error');
        const err = this.closest('.form-group')?.querySelector('.error-msg');
        if (err) err.classList.remove('show');
    });
});

// Responsive sidebar
window.addEventListener('resize', () => {
    const toggle = document.getElementById('menuToggle');
    if (toggle) toggle.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
});

// Check for existing session on page load
if (!syncResetPageFromUrl()) {
    checkExistingSession();
}
