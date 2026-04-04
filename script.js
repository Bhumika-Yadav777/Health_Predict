/* === 1. THEME TOGGLE & PERSISTENCE === */
const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);
        themeBtn.innerHTML = newTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        localStorage.setItem('hp_theme', newTheme);
    });
}

/* === 2. MODAL CONTROLS === */
function openModal() {
    const modal = document.getElementById('login-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    
    const saved = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (saved) {
        showProfileView(JSON.parse(saved));
    } else {
        showAuthForm('login');
    }
}

function closeModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'none';
}

window.onclick = function (event) {
    const modal = document.getElementById('login-modal');
    if (event.target === modal) closeModal();
};

/* === 3. RENDER AUTH FORM === */
function showAuthForm(mode) {
    const isLogin = mode === 'login';
    const content = document.querySelector('.modal-content');
    if (!content) return;

    content.innerHTML = `
        <span class="close" onclick="closeModal()">&times;</span>
        <div class="auth-tabs">
            <button class="tab-btn ${isLogin ? 'active' : ''}" onclick="showAuthForm('login')">Sign In</button>
            <button class="tab-btn ${!isLogin ? 'active' : ''}" onclick="showAuthForm('register')">Register</button>
        </div>
        <form id="auth-form" onsubmit="handleAuthSubmit(event, '${mode}')">
            <h2 style="margin-bottom:15px; color:var(--text);">${isLogin ? 'Welcome Back' : 'Create Account'}</h2>
            ${!isLogin ? `<input type="text" id="reg-name" placeholder="Full Name" required class="auth-input">` : ''}
            <div class="role-selection">
                <label style="color:var(--text);">I am a:</label>
                <div class="radio-group">
                    <input type="radio" name="role" value="patient" id="role-p" checked>
                    <label for="role-p">Patient</label>
                    <input type="radio" name="role" value="doctor" id="role-d">
                    <label for="role-d">Doctor</label>
                </div>
            </div>
            <input type="text" id="user-id" placeholder="ID (e.g. P101 or D202)" required class="auth-input">
            <input type="email" id="user-email" placeholder="Email Address" required class="auth-input">
            <input type="password" id="user-pass" placeholder="Password" required class="auth-input">
            ${!isLogin ? `<input type="password" id="user-pass2" placeholder="Confirm Password" required class="auth-input">` : ''}
            ${isLogin ? `
            <div class="remember-group">
                <input type="checkbox" id="remember-me">
                <label for="remember-me" style="color:var(--text);">Keep me logged in</label>
            </div>` : ''}
            <p id="auth-error" style="color:#ef4444; font-size:0.8rem; min-height:20px; margin:10px 0;"></p>
            <button type="submit" class="btn-primary" style="width:100%">${isLogin ? 'Login' : 'Register'}</button>
        </form>
    `;
}

/* === 4. HANDLE AUTH SUBMIT (Fixed & Closed) === */
function handleAuthSubmit(e, mode) {
    e.preventDefault();
    const role = document.querySelector('input[name="role"]:checked').value;
    const id = document.getElementById('user-id').value.trim().toUpperCase();
    const email = document.getElementById('user-email').value.trim().toLowerCase();
    const pass = document.getElementById('user-pass').value;
    const errorEl = document.getElementById('auth-error');

    if (role === 'doctor' && !id.startsWith('D')) {
        errorEl.textContent = "⚠ Doctor IDs must start with 'D'"; return;
    }
    if (role === 'patient' && !id.startsWith('P')) {
        errorEl.textContent = "⚠ Patient IDs must start with 'P'"; return;
    }

    let users = JSON.parse(localStorage.getItem('hp_users') || '[]');

    if (mode === 'register') {
        const name = document.getElementById('reg-name').value.trim();
        const pass2 = document.getElementById('user-pass2').value;
        if (pass !== pass2) { errorEl.textContent = "⚠ Passwords do not match."; return; }
        if (users.find(u => u.id === id)) { errorEl.textContent = "⚠ ID already registered."; return; }

        const newUser = { id, email, pass, role, name, joined: new Date().toLocaleDateString() };
        users.push(newUser);
        localStorage.setItem('hp_users', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        updateNavAfterLogin(newUser);
        showProfileView(newUser);
    } else {
        const user = users.find(u => u.id === id && u.email === email && u.pass === pass);
        if (!user) { errorEl.textContent = "⚠ Invalid Credentials."; return; }

        const remember = document.getElementById('remember-me')?.checked;
        if (remember) localStorage.setItem('currentUser', JSON.stringify(user));
        else sessionStorage.setItem('currentUser', JSON.stringify(user));

        updateNavAfterLogin(user);
        showProfileView(user);
    }
}

/* === 5. PROFILE & NAV UPDATES === */
function showProfileView(user) {
    const content = document.querySelector('.modal-content');
    if (!content) return;

    // Generate initials for the avatar (e.g., "John Doe" -> "JD")
    const initials = (user.name || user.id).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    content.innerHTML = `
        <span class="close" onclick="closeModal()">&times;</span>
        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-avatar-large">${initials}</div>
                <h2 class="profile-name">${user.name || 'User'}</h2>
                <span class="role-badge">${user.role.toUpperCase()}</span>
            </div>
            
            <div class="profile-details">
                <div class="detail-item">
                    <label><i class="fas fa-id-badge"></i> Patient ID</label>
                    <span>${user.id}</span>
                </div>
                <div class="detail-item">
                    <label><i class="fas fa-envelope"></i> Email Address</label>
                    <span>${user.email}</span>
                </div>
                <div class="detail-item">
                    <label><i class="fas fa-calendar-alt"></i> Member Since</label>
                    <span>${user.joined || 'April 2026'}</span>
                </div>
            </div>

            <div class="profile-actions">
                <button class="btn-primary" onclick="closeModal()">Back to Dashboard</button>
                <button onclick="handleLogout()" class="btn-logout">
                    <i class="fas fa-sign-out-alt"></i> Sign Out
                </button>
            </div>
        </div>
    `;
}

function handleLogout() {
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    location.reload();
}

function updateNavAfterLogin(user) {
    const container = document.getElementById('main-signin-btn');
    if (!container) return;

    // Get initials (e.g., "P101" -> "P" or "John Doe" -> "JD")
    const initials = (user.name || user.id).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    // Update the Circle to show Initials
    const iconCircle = container.querySelector('.profile-icon-circle');
    iconCircle.innerHTML = `<span class="nav-initials">${initials}</span>`;
    iconCircle.style.background = "linear-gradient(135deg, #4361ee, #7209b7)";

    // Update the Label to show the Patient/Doctor ID
    const label = container.querySelector('.nav-label');
    label.textContent = user.id;
    
    container.classList.add('logged-in');
}
window.addEventListener('load', () => {
    const savedUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (savedUser) {
        updateNavAfterLogin(JSON.parse(savedUser));
    }
});

/* === 6. DOCTOR DASHBOARD (Clean State) === */
const patientDB = {}; // Demo records removed as requested

function searchPatient() {
    const id = document.getElementById('patient-search-input').value.trim().toUpperCase();
    const resultArea = document.getElementById('patient-result-area');
    const errorMsg = document.getElementById('no-result-msg');
    const tableBody = document.getElementById('patient-record-body');

    if (patientDB[id]) {
        errorMsg.style.display = 'none';
        tableBody.innerHTML = '';
        document.getElementById('res-name').innerText = patientDB[id].name;
        document.getElementById('res-date').innerText = patientDB[id].lastVisit;
        patientDB[id].records.forEach(rec => {
            tableBody.innerHTML += `<tr><td>${rec.date}</td><td>${rec.symptoms}</td><td>${rec.disease}</td><td>${rec.confidence}</td><td><span class="status-badge">${rec.status}</span></td></tr>`;
        });
        resultArea.style.display = 'block';
    } else {
        resultArea.style.display = 'none';
        errorMsg.style.display = 'block';
        errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> No patient records found for ID: ${id}`;
    }
}

/* === 7. PREDICTION & SYMPTOMS (Optional Logic) === */
const predictionBtn = document.querySelector('.btn-prediction');
if (predictionBtn) {
    predictionBtn.addEventListener('click', () => {
        const selectedTags = Array.from(document.querySelectorAll('.tag.active')).map(t => t.textContent);
        const historyText = document.querySelector('textarea[placeholder*="history"]')?.value.trim() || 
                           document.querySelector('textarea').value.trim();

        // Common symptoms are optional: need either a tag OR text history
        if (selectedTags.length === 0 && !historyText) {
            alert("Please select a symptom or describe your condition in the history box.");
            return;
        }

        predictionBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
        
        setTimeout(() => {
            alert("Analysis Complete: Please check the dashboard or consult a doctor for details.");
            predictionBtn.innerHTML = `Get Prediction <i class="fas fa-arrow-right"></i>`;
        }, 2000);
    });
}

/* === 8. CONTACT FORM (Direct Email via EmailJS) === */
const contactForm = document.querySelector('.contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const btn = this.querySelector('button');
        const originalText = btn.innerText;
        
        // Visual feedback for the user
        btn.innerText = "Sending...";
        btn.disabled = true;

        // STEP 2: Replace these with your actual IDs from the EmailJS Dashboard
        const serviceID = 'service_xtddcju';   // Found in "Email Services"
        const templateID = 'template_zrywow4'; // Found in "Email Templates" > Settings

        // This command sends the form data directly
        emailjs.sendForm(serviceID, templateID, this)
            .then(() => {
                // Success Actions
                btn.innerText = "Message Sent!";
                alert("Success! Your message has been delivered to healthpredict.us@gmail.com");
                contactForm.reset();
                btn.disabled = false;
                
                // Reset button text after 3 seconds
                setTimeout(() => { btn.innerText = originalText; }, 3000);
            }, (err) => {
                // Error Actions
                btn.innerText = "Error";
                btn.disabled = false;
                console.error("EmailJS Error:", err);
                alert("Failed to send. Please check your Service/Template IDs.");
                
                setTimeout(() => { btn.innerText = originalText; }, 3000);
            });
    });
}

/* === 9. PAGE INITIALIZATION === */
window.addEventListener('load', () => {
    // Load Theme
    const savedTheme = localStorage.getItem('hp_theme');
    if (savedTheme) {
        document.body.setAttribute('data-theme', savedTheme);
        if (themeBtn) themeBtn.innerHTML = savedTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }

    // Load User
    const savedUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (savedUser) updateNavBtn(JSON.parse(savedUser));

    // Symptom tag toggling
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('tag')) {
            e.target.classList.toggle('active');
        }
    });

    // Custom symptom adding
    const addBtn = document.querySelector('.add-btn');
    const customInput = document.querySelector('.input-group input');
    const tagsContainer = document.querySelector('.symptom-tags');

    if (addBtn && customInput && tagsContainer) {
        addBtn.addEventListener('click', () => {
            const val = customInput.value.trim();
            if (!val) return;
            const tag = document.createElement('button');
            tag.className = 'tag active';
            tag.type = 'button';
            tag.textContent = val;
            tagsContainer.appendChild(tag);
            customInput.value = '';
        });
    }
});

function toggleFAQ(element) {
    const item = element.parentElement;
    
    // Optional: Close other FAQs when one opens
    
    document.querySelectorAll('.faq-item').forEach(otherItem => {
        if (otherItem !== item) otherItem.classList.remove('active');
    });
    

    item.classList.toggle('active');
}