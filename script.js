// === CHANGED / NEW: Added global variable ===
let currentLoggedInUser = null;

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

/* === CHANGED / NEW: Updated Prediction Function with saving === */
// 1. Unified Click Listener for all Tags
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('tag')) {
        e.target.classList.toggle('active');
        console.log("Toggled symptom:", e.target.textContent.trim());
    }
});

// 2. Prediction Function - MODIFIED to save results
async function runPrediction() {
    const btn = document.querySelector('.btn-prediction');
    const resultDiv = document.getElementById('prediction-result');
    const diseaseText = document.getElementById('disease-name');
    
    // Remove any existing save message
    const oldSaveMsg = resultDiv.querySelector('.save-confirmation');
    if (oldSaveMsg) oldSaveMsg.remove();
    
    // Collect active tags
    const activeTags = Array.from(document.querySelectorAll('.tag.active'))
        .map(tag => tag.textContent.trim().toLowerCase().replace(/\s+/g, '_'));

    if (activeTags.length === 0) {
        alert("Please select at least one symptom.");
        return;
    }

    // === CHANGED / NEW: Get current logged in user ===
    const savedUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    const patientId = savedUser ? JSON.parse(savedUser).email : null;

    // UI Loading State
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Analyzing...`;

    try {
        // === CHANGED / NEW: Send patient_id to backend ===
        const response = await fetch('http://127.0.0.1:5000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                symptoms: activeTags,
                patient_id: patientId  // Send patient ID if logged in
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Show result directly on the page
            resultDiv.style.display = 'block';
            diseaseText.innerHTML = `<strong>Potential Condition:</strong> ${data.disease}`;
            
            // === CHANGED / NEW: Add save confirmation message ===
            if (data.saved) {
                const saveMsg = document.createElement('p');
                saveMsg.className = 'save-confirmation';
                saveMsg.style.cssText = 'color: #10b981; margin-top: 10px; padding: 8px; background: rgba(16, 185, 129, 0.1); border-radius: 8px;';
                saveMsg.innerHTML = '<i class="fas fa-check-circle"></i> ✓ Result saved to your history';
                resultDiv.appendChild(saveMsg);
                setTimeout(() => saveMsg.remove(), 3000);
            } else if (patientId) {
                // User is logged in but save failed (maybe backend issue)
                console.log("Prediction made but not saved to database");
            } else {
                // Not logged in - show prompt
                const loginMsg = document.createElement('p');
                loginMsg.className = 'save-confirmation';
                loginMsg.style.cssText = 'color: #f59e0b; margin-top: 10px; padding: 8px; background: rgba(245, 158, 11, 0.1); border-radius: 8px;';
                loginMsg.innerHTML = '<i class="fas fa-info-circle"></i> Login to save your prediction history';
                resultDiv.appendChild(loginMsg);
                setTimeout(() => loginMsg.remove(), 4000);
            }
            
            resultDiv.scrollIntoView({ behavior: 'smooth' });
        } else {
            alert("Error from server: " + (data.error || "Unknown error"));
        }
    } catch (error) {
        console.error("Fetch error:", error);
        alert("Cannot connect to backend. Make sure app.py is running on port 5000");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `Analyze Symptoms <i class="fas fa-arrow-right"></i>`;
    }
}

// === CHANGED / NEW: Updated Auth Submit with backend sync ===
function handleAuthSubmit(e, mode) {
    e.preventDefault();
    const role = document.querySelector('input[name="role"]:checked').value;
    const id = document.getElementById('user-id').value.trim().toUpperCase();
    const email = document.getElementById('user-email').value.trim().toLowerCase();
    const pass = document.getElementById('user-pass').value;
    const errorEl = document.getElementById('auth-error');

    if (role === 'doctor' && !id.startsWith('D')) {
        errorEl.textContent = "⚠ Doctor IDs must start with 'D'"; 
        return;
    }
    if (role === 'patient' && !id.startsWith('P')) {
        errorEl.textContent = "⚠ Patient IDs must start with 'P'"; 
        return;
    }

    let users = JSON.parse(localStorage.getItem('hp_users') || '[]');

    if (mode === 'register') {
        const name = document.getElementById('reg-name').value.trim();
        const pass2 = document.getElementById('user-pass2').value;
        if (pass !== pass2) { 
            errorEl.textContent = "⚠ Passwords do not match."; 
            return; 
        }
        if (users.find(u => u.id === id)) { 
            errorEl.textContent = "⚠ ID already registered."; 
            return; 
        }

        const newUser = { id, email, pass, role, name, joined: new Date().toLocaleDateString() };
        users.push(newUser);
        localStorage.setItem('hp_users', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        currentLoggedInUser = newUser;
        updateNavAfterLogin(newUser);
        showProfileView(newUser);
        closeModal();  // Close modal after successful registration
        
        // === CHANGED / NEW: Try to register in backend ===
        fetch('http://127.0.0.1:5000/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass, name, role })
        }).catch(e => console.log("Backend registration optional:", e));
        
    } else {
        // LOGIN
        const user = users.find(u => u.id === id && u.email === email && u.pass === pass);
        if (!user) { 
            errorEl.textContent = "⚠ Invalid Credentials."; 
            return; 
        }

        const remember = document.getElementById('remember-me')?.checked;
        if (remember) localStorage.setItem('currentUser', JSON.stringify(user));
        else sessionStorage.setItem('currentUser', JSON.stringify(user));
        
        currentLoggedInUser = user;
        updateNavAfterLogin(user);
        showProfileView(user);
        closeModal();  // Close modal after successful login
    }
}

/* === CHANGED / NEW: Updated Profile View with History === */
async function showProfileView(user) {
    const content = document.querySelector('.modal-content');
    if (!content) return;

    // Generate initials for the avatar
    const initials = (user.name || user.id).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    // Show loading state first
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
                    <label><i class="fas fa-id-badge"></i> ID</label>
                    <span>${user.id}</span>
                </div>
                <div class="detail-item">
                    <label><i class="fas fa-envelope"></i> Email</label>
                    <span>${user.email}</span>
                </div>
                <div class="detail-item">
                    <label><i class="fas fa-calendar-alt"></i> Member Since</label>
                    <span>${user.joined || 'April 2026'}</span>
                </div>
            </div>
            <div class="history-section" style="margin-top: 20px;">
                <h4>Loading prediction history...</h4>
                <div class="history-list"></div>
            </div>
            <div class="profile-actions">
                <button class="btn-primary" onclick="closeModal()">Close</button>
                <button onclick="handleLogout()" class="btn-logout">
                    <i class="fas fa-sign-out-alt"></i> Sign Out
                </button>
            </div>
        </div>
    `;

    // === CHANGED / NEW: Load prediction history from backend ===
    try {
        const response = await fetch(`http://127.0.0.1:5000/patient/${encodeURIComponent(user.email)}/history`);
        const data = await response.json();
        
        const historySection = content.querySelector('.history-section');
        if (data.history && data.history.length > 0) {
            let historyHtml = '<h4><i class="fas fa-history"></i> Recent Predictions</h4><div class="history-list">';
            data.history.slice(0, 5).forEach(record => {
                historyHtml += `
                    <div class="history-item" style="border-bottom: 1px solid var(--border); padding: 10px 0;">
                        <div style="font-size: 0.8rem; color: var(--primary);">${record.date}</div>
                        <div><strong>Disease:</strong> ${record.disease}</div>
                        <div style="font-size: 0.8rem; opacity: 0.7;"><strong>Symptoms:</strong> ${record.symptoms.join(', ')}</div>
                    </div>
                `;
            });
            historyHtml += '</div>';
            historySection.innerHTML = historyHtml;
        } else {
            historySection.innerHTML = '<h4><i class="fas fa-history"></i> Recent Predictions</h4><p style="color: gray;">No predictions yet. Try analyzing symptoms!</p>';
        }
    } catch (error) {
        console.error("Could not load history:", error);
        const historySection = content.querySelector('.history-section');
        historySection.innerHTML = '<h4><i class="fas fa-history"></i> Recent Predictions</h4><p style="color: #ef4444;">Unable to load history. Make sure backend is running.</p>';
    }
}

function handleLogout() {
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');
    currentLoggedInUser = null;
    location.reload();
}

function updateNavAfterLogin(user) {
    const container = document.getElementById('main-signin-btn');
    if (!container) return;

    const initials = (user.name || user.id).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    const iconCircle = container.querySelector('.profile-icon-circle');
    iconCircle.innerHTML = `<span class="nav-initials">${initials}</span>`;
    iconCircle.style.background = "linear-gradient(135deg, #4361ee, #7209b7)";

    const label = container.querySelector('.nav-label');
    label.textContent = user.id;
    
    container.classList.add('logged-in');
}

/* === CHANGED / NEW: Updated Doctor Dashboard to use Backend === */
async function searchPatient() {
    const id = document.getElementById('patient-search-input').value.trim().toUpperCase();
    const resultArea = document.getElementById('patient-result-area');
    const errorMsg = document.getElementById('no-result-msg');
    const tableBody = document.getElementById('patient-record-body');

    // Show loading state
    resultArea.style.display = 'none';
    errorMsg.style.display = 'none';
    errorMsg.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Searching...`;
    errorMsg.style.display = 'block';

    try {
        // === CHANGED / NEW: Fetch from backend API ===
        const response = await fetch(`http://127.0.0.1:5000/patient/${encodeURIComponent(id)}/history`);
        const data = await response.json();
        
        if (data.history && data.history.length > 0) {
            errorMsg.style.display = 'none';
            tableBody.innerHTML = '';
            document.getElementById('res-name').innerText = id;
            document.getElementById('res-date').innerText = data.history[0]?.date || 'N/A';
            
            data.history.forEach(rec => {
                tableBody.innerHTML += `
                    <tr>
                        <td>${rec.date}</td>
                        <td>${rec.symptoms.join(', ')}</td>
                        <td>${rec.disease}</td>
                        <td>High</td>
                        <td><span class="status-badge status-reviewed">Analyzed</span></td>
                    </tr>
                `;
            });
            resultArea.style.display = 'block';
        } else {
            resultArea.style.display = 'none';
            errorMsg.style.display = 'block';
            errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> No records found for patient ID: ${id}`;
        }
    } catch (error) {
        console.error("Search error:", error);
        resultArea.style.display = 'none';
        errorMsg.style.display = 'block';
        errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> Backend error. Make sure server is running on port 5000.`;
    }
}

// === REMOVED: Old prediction logic (section 7) - replaced by runPrediction above ===

/* === 8. CONTACT FORM (Direct Email via EmailJS) === */
const contactForm = document.querySelector('.contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const btn = this.querySelector('button');
        const originalText = btn.innerText;
        
        btn.innerText = "Sending...";
        btn.disabled = true;

        const serviceID = 'service_xtddcju';
        const templateID = 'template_zrywow4';

        emailjs.sendForm(serviceID, templateID, this)
            .then(() => {
                btn.innerText = "Message Sent!";
                alert("Success! Your message has been delivered to healthpredict.us@gmail.com");
                contactForm.reset();
                btn.disabled = false;
                setTimeout(() => { btn.innerText = originalText; }, 3000);
            }, (err) => {
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
    if (savedUser) {
        const user = JSON.parse(savedUser);
        updateNavAfterLogin(user);
        currentLoggedInUser = user;
    }

    // === CHANGED / NEW: Ensure prediction button uses updated function ===
    const analyzeBtn = document.querySelector('.btn-prediction');
    if (analyzeBtn) {
        // Remove any existing listeners and add new one to avoid duplicates
        const newBtn = analyzeBtn.cloneNode(true);
        analyzeBtn.parentNode.replaceChild(newBtn, analyzeBtn);
        newBtn.addEventListener('click', runPrediction);
    }

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
    
    document.querySelectorAll('.faq-item').forEach(otherItem => {
        if (otherItem !== item) otherItem.classList.remove('active');
    });
    
    item.classList.toggle('active');
}
