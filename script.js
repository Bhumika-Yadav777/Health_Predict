// =====================================================================
// HealthPredict — script.js  (fixed version — no Firebase)
// Uses localStorage for auth + Flask backend for predictions/history
// =====================================================================

// ── IMPORTANT: Change this to your deployed Flask API URL ─────────────
// While testing locally: "http://127.0.0.1:5000"
// After deploying Flask to Render/Railway/etc: "https://your-api.onrender.com"
const BASE_URL = "https://health-predict-api.onrender.com";
// ---------------------------------------------------------------------

let currentLoggedInUser = null;

// ── Theme ─────────────────────────────────────────────────────────────
const themeBtn = document.getElementById("theme-toggle");
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const isDark = document.body.getAttribute("data-theme") === "dark";
    const newTheme = isDark ? "light" : "dark";
    document.body.setAttribute("data-theme", newTheme);
    themeBtn.innerHTML =
      newTheme === "dark"
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';
    localStorage.setItem("hp_theme", newTheme);
  });
}

// ── Symptom Tags ──────────────────────────────────────────────────────
function attachTagListeners() {
  document.querySelectorAll(".tag").forEach((tag) => {
    tag.removeEventListener("click", tagClickHandler);
    tag.addEventListener("click", tagClickHandler);
  });
}

function tagClickHandler(e) {
  e.stopPropagation();
  this.classList.toggle("active");
}

// ── Modal ─────────────────────────────────────────────────────────────
function openModal() {
  const modal = document.getElementById("login-modal");
  if (!modal) return;
  modal.style.display = "flex";
  const saved =
    localStorage.getItem("currentUser") ||
    sessionStorage.getItem("currentUser");
  if (saved) {
    showProfileView(JSON.parse(saved));
  } else {
    showAuthForm("login");
  }
}

function closeModal() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.style.display = "none";
}

window.onclick = function (event) {
  const modal = document.getElementById("login-modal");
  if (event.target === modal) closeModal();
};

// ── Auth Form ─────────────────────────────────────────────────────────
function showAuthForm(mode) {
  const isLogin = mode === "login";
  const content = document.querySelector(".modal-content");
  if (!content) return;

  content.innerHTML = `
    <span class="close" onclick="closeModal()">&times;</span>
    <div class="auth-tabs">
      <button class="tab-btn ${isLogin ? "active" : ""}" onclick="showAuthForm('login')">Sign In</button>
      <button class="tab-btn ${!isLogin ? "active" : ""}" onclick="showAuthForm('register')">Register</button>
    </div>
    <form id="auth-form" onsubmit="handleAuthSubmit(event, '${mode}')">
      <h2 style="margin-bottom:15px;color:var(--text);">${isLogin ? "Welcome Back" : "Create Account"}</h2>
      ${!isLogin ? '<input type="text" id="reg-name" placeholder="Full Name" required class="auth-input">' : ""}
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
      ${!isLogin ? '<input type="password" id="user-pass2" placeholder="Confirm Password" required class="auth-input">' : ""}
      ${isLogin ? `
      <div class="remember-group">
        <input type="checkbox" id="remember-me">
        <label for="remember-me" style="color:var(--text);">Keep me logged in</label>
      </div>` : ""}
      <p id="auth-error" style="color:#ef4444;font-size:0.8rem;min-height:20px;margin:10px 0;"></p>
      <button type="submit" class="btn-primary" style="width:100%">${isLogin ? "Login" : "Register"}</button>
    </form>`;
}

function handleAuthSubmit(e, mode) {
  e.preventDefault();
  const role = document.querySelector('input[name="role"]:checked').value;
  const id = document.getElementById("user-id").value.trim().toUpperCase();
  const email = document.getElementById("user-email").value.trim().toLowerCase();
  const pass = document.getElementById("user-pass").value;
  const errorEl = document.getElementById("auth-error");

  if (role === "doctor" && !id.startsWith("D")) {
    errorEl.textContent = "Doctor IDs must start with 'D'"; return;
  }
  if (role === "patient" && !id.startsWith("P")) {
    errorEl.textContent = "Patient IDs must start with 'P'"; return;
  }

  let users = JSON.parse(localStorage.getItem("hp_users") || "[]");

  if (mode === "register") {
    const name = document.getElementById("reg-name").value.trim();
    const pass2 = document.getElementById("user-pass2").value;
    if (pass !== pass2) { errorEl.textContent = "Passwords do not match."; return; }
    if (users.find((u) => u.id === id)) { errorEl.textContent = "ID already registered."; return; }

    const newUser = { id, email, pass, role, name, joined: new Date().toLocaleDateString() };
    users.push(newUser);
    localStorage.setItem("hp_users", JSON.stringify(users));
    localStorage.setItem("currentUser", JSON.stringify(newUser));
    currentLoggedInUser = newUser;
    updateNavAfterLogin(newUser);
    showProfileView(newUser);

    // Sync to backend (non-blocking)
    fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass, name, role, patient_id: id }),
    }).catch((e) => console.log("Backend sync:", e));

  } else {
    const user = users.find((u) => u.id === id && u.email === email && u.pass === pass);
    if (!user) { errorEl.textContent = "Invalid Credentials."; return; }
    const remember = document.getElementById("remember-me")?.checked;
    if (remember) localStorage.setItem("currentUser", JSON.stringify(user));
    else sessionStorage.setItem("currentUser", JSON.stringify(user));
    currentLoggedInUser = user;
    updateNavAfterLogin(user);
    showProfileView(user);
  }
}

// ── Profile View ──────────────────────────────────────────────────────
async function showProfileView(user) {
  const content = document.querySelector(".modal-content");
  if (!content) return;

  const initials = (user.name || user.id)
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  content.innerHTML = `
    <span class="close" onclick="closeModal()">&times;</span>
    <div class="profile-card">
      <div class="profile-header">
        <div class="profile-avatar-large">${initials}</div>
        <h2 class="profile-name">${user.name || user.id}</h2>
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
          <span>${user.joined || "—"}</span>
        </div>
        <div class="detail-item">
          <label><i class="fas fa-chart-line"></i> Total Predictions</label>
          <span id="total-predictions-count">—</span>
        </div>
      </div>

      <div class="history-section">
        <h4><i class="fas fa-history"></i> Prediction History</h4>
        <div id="history-list-container" class="history-list-container">
          <div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading...</div>
        </div>
      </div>

      <div class="profile-actions">
        <button class="btn-primary" onclick="closeModal()">Close</button>
        <button onclick="handleLogout()" class="btn-logout">
          <i class="fas fa-sign-out-alt"></i> Sign Out
        </button>
      </div>
    </div>`;

  await loadPatientHistory(user.email);
}

// ── Load Patient History ──────────────────────────────────────────────
async function loadPatientHistory(email) {
  const container = document.getElementById("history-list-container");
  if (!container) return;

  try {
    const res = await fetch(`${BASE_URL}/patient/${encodeURIComponent(email)}/history`);
    const data = await res.json();
    const countEl = document.getElementById("total-predictions-count");

    if (data.history && data.history.length > 0) {
      if (countEl) countEl.textContent = data.history.length;

      container.innerHTML = data.history.map((rec) => {
        const conf = parseFloat(rec.confidence) || 0;
        const badgeCls = conf >= 80 ? "conf-high" : conf >= 60 ? "conf-medium" : "conf-low";
        const badgeLabel = conf >= 80 ? "High" : conf >= 60 ? "Medium" : "Low";
        return `
          <div class="history-record">
            <div class="record-header">
              <span class="record-date"><i class="far fa-calendar-alt"></i> ${rec.date}</span>
              <span class="record-confidence ${badgeCls}">${conf.toFixed(1)}% ${badgeLabel}</span>
            </div>
            <div class="record-disease">
              <strong>Predicted Disease:</strong> ${rec.disease}
            </div>
            <div class="record-symptoms">
              <strong>Symptoms:</strong> ${(rec.symptoms || []).join(", ")}
            </div>
            <div class="record-remedies">
              <strong><i class="fas fa-leaf"></i> Remedies:</strong>
              <ul>${(rec.remedies || []).slice(0, 3).map((r) => `<li>${r}</li>`).join("")}</ul>
            </div>
          </div>`;
      }).join("");
    } else {
      if (countEl) countEl.textContent = "0";
      container.innerHTML = `
        <div class="empty-history">
          <i class="fas fa-clinic-medical"></i>
          <p>No predictions yet</p>
          <small>Try analyzing symptoms to see your history here!</small>
        </div>`;
    }
  } catch (err) {
    console.error("History error:", err);
    container.innerHTML = `
      <div class="empty-history error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Unable to load history</p>
        <small>Backend server may be offline.</small>
      </div>`;
  }
}

function handleLogout() {
  localStorage.removeItem("currentUser");
  sessionStorage.removeItem("currentUser");
  location.reload();
}

function updateNavAfterLogin(user) {
  const container = document.getElementById("main-signin-btn");
  if (!container) return;
  const initials = (user.name || user.id)
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const iconCircle = container.querySelector(".profile-icon-circle");
  iconCircle.innerHTML = `<span class="nav-initials">${initials}</span>`;
  iconCircle.style.background = "linear-gradient(135deg, #4361ee, #7209b7)";
  container.querySelector(".nav-label").textContent = user.id;
  container.classList.add("logged-in");
}

// ── Prediction — result shown INLINE below the form ───────────────────
async function runPrediction() {
  const selectedTags = document.querySelectorAll(".tag.active");
  const symptoms = Array.from(selectedTags).map((t) => t.textContent.trim());

  if (symptoms.length === 0) {
    alert("Please select at least one symptom.");
    return;
  }

  const btn = document.querySelector(".btn-prediction");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';

  // Show inline loader immediately
  const resultDiv = document.getElementById("prediction-result");
  resultDiv.style.display = "block";
  resultDiv.innerHTML = `
    <div class="pred-loading">
      <i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#1D9E75;"></i>
      <p style="margin-top:12px;color:var(--text-muted,#666);">Analyzing your symptoms...</p>
    </div>`;
  resultDiv.scrollIntoView({ behavior: "smooth", block: "start" });

  const saved = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
  let patient_id = null;
  if (saved) {
    const user = JSON.parse(saved);
    if (user.role === "patient") patient_id = user.email;
  }

  try {
    const res = await fetch(`${BASE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptoms, patient_id }),
    });
    if (!res.ok) throw new Error(`Server responded with status ${res.status}`);
    const data = await res.json();
    renderInlinePrediction(data);

    // Refresh profile history if the profile modal is open
    if (saved && document.getElementById("login-modal")?.style.display === "flex") {
      await loadPatientHistory(JSON.parse(saved).email);
    }
  } catch (err) {
    console.error(err);
    resultDiv.innerHTML = `
      <div class="pred-error">
        <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:#ef4444;"></i>
        <p style="margin-top:10px;font-weight:600;">Prediction failed</p>
        <small style="color:#888;">${err.message}</small>
        <p style="margin-top:8px;font-size:13px;">Make sure the backend server is running.</p>
      </div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Get Prediction <i class="fas fa-arrow-right"></i>';
  }
}

function renderInlinePrediction(data) {
  const conf = parseFloat(data.confidence) || 0;
  const badgeCls = conf >= 80 ? "conf-high" : conf >= 60 ? "conf-medium" : "conf-low";
  const badgeLabel = conf >= 80 ? "High" : conf >= 60 ? "Medium" : "Low";
  const barColor = conf >= 80 ? "#1D9E75" : conf >= 60 ? "#f59e0b" : "#ef4444";

  const remediesHtml = (data.remedies || []).length > 0
    ? `<ul>${data.remedies.map((r) => `<li>${r}</li>`).join("")}</ul>`
    : `<p style="color:#888;">Consult a doctor for personalised advice.</p>`;

  const resultDiv = document.getElementById("prediction-result");
  resultDiv.style.display = "block";
  resultDiv.innerHTML = `
    <div class="pred-result-header">
      <span class="pred-badge-ai"><i class="fas fa-robot"></i> AI ANALYSIS COMPLETE</span>
    </div>
    <div class="pred-disease-row">
      <div class="pred-label">Predicted Condition</div>
      <div class="pred-disease-name">${data.disease || "Unknown"}</div>
    </div>
    <div class="pred-confidence-row">
      <div class="pred-conf-meta">
        <span class="pred-label">Match Confidence</span>
        <span class="pred-conf-value">
          ${conf.toFixed(1)}%
          <span class="record-confidence ${badgeCls}" style="font-size:12px;margin-left:8px;">${badgeLabel}</span>
        </span>
      </div>
      <div class="pred-conf-bar-wrap">
        <div class="pred-conf-bar-fill" style="width:0%;background:${barColor};transition:width 1s ease;"></div>
      </div>
      <p class="pred-conf-note">Our Random Forest model calculated this probability based on your reported symptoms.</p>
    </div>
    <div class="pred-remedies-row">
      <div class="pred-label"><i class="fas fa-leaf"></i> Recommended Actions</div>
      <div class="pred-remedies-list">${remediesHtml}</div>
    </div>
    <div class="pred-disclaimer">
      <i class="fas fa-exclamation-triangle"></i>
      <span><strong>Disclaimer:</strong> This is an automated preliminary assessment. It is not a substitute for professional medical diagnosis. Please consult a healthcare provider.</span>
    </div>`;

  // Trigger bar animation after paint
  setTimeout(() => {
    const fill = resultDiv.querySelector(".pred-conf-bar-fill");
    if (fill) fill.style.width = conf + "%";
  }, 60);

  resultDiv.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Doctor Dashboard ──────────────────────────────────────────────────
async function searchPatient() {
  const id = document.getElementById("patient-search-input").value.trim().toUpperCase();
  const resultArea = document.getElementById("patient-result-area");
  const errorMsg = document.getElementById("no-result-msg");
  const tableBody = document.getElementById("patient-record-body");

  if (!id) { alert("Please enter a Patient ID (e.g., P101)"); return; }

  resultArea.style.display = "none";
  errorMsg.style.display = "block";
  errorMsg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading patient records...';
  tableBody.innerHTML = "";

  try {
    // Look up email from localStorage (patients register with P-ID + email)
    const allUsers = JSON.parse(localStorage.getItem("hp_users") || "[]");
    const matchedUser = allUsers.find((u) => u.id === id && u.role === "patient");
    const lookupKey = matchedUser ? matchedUser.email : id;

    const histRes = await fetch(`${BASE_URL}/patient/${encodeURIComponent(lookupKey)}/history`);
    const histData = await histRes.json();

    // Try to get patient name from backend
    let patientName = matchedUser?.name || id;
    try {
      const infoRes = await fetch(`${BASE_URL}/patient/${encodeURIComponent(lookupKey)}/info`);
      if (infoRes.ok) {
        const info = await infoRes.json();
        patientName = info.name || patientName;
      }
    } catch (_) {}

    if (histData.history && histData.history.length > 0) {
      errorMsg.style.display = "none";
      document.getElementById("res-name").textContent = patientName;
      document.getElementById("res-date").textContent = histData.history[0]?.date || "—";
      document.getElementById("total-records").textContent = histData.history.length;

      const avg = histData.history.reduce((s, r) => s + (parseFloat(r.confidence) || 0), 0)
                  / histData.history.length;
      document.getElementById("avg-confidence").innerHTML =
        `<span style="color:#1D9E75;font-weight:700;">${avg.toFixed(1)}%</span>`;

      tableBody.innerHTML = histData.history.map((rec) => {
        const conf = parseFloat(rec.confidence) || 0;
        const barColor = conf >= 80 ? "#1D9E75" : conf >= 60 ? "#f59e0b" : "#ef4444";
        const badgeCls = conf >= 80 ? "conf-high" : conf >= 60 ? "conf-medium" : "conf-low";
        const badgeLabel = conf >= 80 ? "High" : conf >= 60 ? "Medium" : "Low";
        const remediesList = (rec.remedies || []).map((r) => `• ${r}`).join("\n");

        return `
          <tr>
            <td>${rec.date || "—"}</td>
            <td style="max-width:200px;">${(rec.symptoms || []).join(", ")}</td>
            <td><strong>${rec.disease || "—"}</strong></td>
            <td>
              <span class="record-confidence ${badgeCls}">${conf.toFixed(1)}% (${badgeLabel})</span>
              <div class="confidence-bar-small" style="margin-top:5px;">
                <div class="confidence-fill-small" style="width:${conf}%;background:${barColor};"></div>
              </div>
            </td>
            <td><span class="status-badge status-reviewed">Completed</span></td>
            <td>
              <button class="btn-view-remedies"
                onclick="showDetailedRemedies('${rec.disease.replace(/'/g, "\\'")}',
                \`${remediesList.replace(/`/g, "\\`")}\`)">
                <i class="fas fa-leaf"></i> View
              </button>
            </td>
          </tr>`;
      }).join("");

      resultArea.style.display = "block";
    } else {
      errorMsg.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        No records found for patient ID: <strong>${id}</strong><br>
        <small>Make sure the patient has made predictions after logging in.</small>`;
    }
  } catch (err) {
    console.error("Search error:", err);
    errorMsg.innerHTML = `
      <i class="fas fa-exclamation-circle"></i>
      Backend error — make sure the server is running.<br>
      <small>${err.message}</small>`;
  }
}

// ── Remedies popup ────────────────────────────────────────────────────
function showDetailedRemedies(disease, remediesText) {
  const modal = document.createElement("div");
  modal.className = "remedies-modal-overlay";
  modal.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.5);display:flex;
    justify-content:center;align-items:center;z-index:10000;`;
  modal.innerHTML = `
    <div class="remedies-modal-content">
      <div class="remedies-modal-header">
        <h3><i class="fas fa-leaf"></i> Home Remedies for ${disease}</h3>
        <button class="remedies-modal-close" onclick="this.closest('.remedies-modal-overlay').remove()">&times;</button>
      </div>
      <div class="remedies-modal-body">
        ${remediesText.split("\n").filter(r => r.trim()).map((r) => `<p><i class="fas fa-check-circle"></i> ${r}</p>`).join("")}
      </div>
      <div class="remedies-modal-footer">
        <small><i class="fas fa-exclamation-triangle"></i> These are home remedies. Please consult a doctor.</small>
        <button onclick="this.closest('.remedies-modal-overlay').remove()" class="btn-close-remedies">Close</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// ── FAQ ───────────────────────────────────────────────────────────────
function toggleFAQ(element) {
  const item = element.parentElement;
  document.querySelectorAll(".faq-item").forEach((other) => {
    if (other !== item) other.classList.remove("active");
  });
  item.classList.toggle("active");
}

// ── Contact Form ──────────────────────────────────────────────────────
const contactForm = document.querySelector(".contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const btn = this.querySelector("button");
    const orig = btn.innerText;
    btn.innerText = "Sending...";
    btn.disabled = true;
    emailjs.sendForm("service_xtddcju", "template_zrywow4", this).then(
      () => {
        btn.innerText = "Message Sent!";
        alert("Message sent successfully!");
        contactForm.reset();
        setTimeout(() => { btn.innerText = orig; btn.disabled = false; }, 3000);
      },
      () => {
        btn.innerText = "Error";
        btn.disabled = false;
        alert("Failed to send.");
        setTimeout(() => { btn.innerText = orig; }, 3000);
      }
    );
  });
}

// ── Page Init ─────────────────────────────────────────────────────────
window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("hp_theme");
  if (savedTheme) {
    document.body.setAttribute("data-theme", savedTheme);
    if (themeBtn)
      themeBtn.innerHTML =
        savedTheme === "dark" ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }

  const savedUser = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
  if (savedUser) updateNavAfterLogin(JSON.parse(savedUser));

  attachTagListeners();

  const analyzeBtn = document.querySelector(".btn-prediction");
  if (analyzeBtn) {
    const newBtn = analyzeBtn.cloneNode(true);
    analyzeBtn.parentNode.replaceChild(newBtn, analyzeBtn);
    newBtn.addEventListener("click", runPrediction);
  }

  const addBtn = document.querySelector(".add-btn");
  const customInput = document.querySelector(".input-group input");
  const tagsContainer = document.querySelector(".symptom-tags");
  if (addBtn && customInput && tagsContainer) {
    addBtn.addEventListener("click", () => {
      const val = customInput.value.trim();
      if (!val) return;
      const tag = document.createElement("button");
      tag.className = "tag";
      tag.type = "button";
      tag.textContent = val;
      tag.addEventListener("click", tagClickHandler);
      tagsContainer.appendChild(tag);
      customInput.value = "";
    });
  }
});
