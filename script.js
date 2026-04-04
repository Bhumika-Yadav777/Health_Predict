const BASE_URL = "http://127.0.0.1:5000";
let currentLoggedInUser = null;

// Theme Toggle
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

// Symptom Tag Selection
function attachTagListeners() {
  const tags = document.querySelectorAll(".tag");
  tags.forEach((tag) => {
    tag.removeEventListener("click", tagClickHandler);
    tag.addEventListener("click", tagClickHandler);
  });
}

function tagClickHandler(e) {
  e.stopPropagation();
  this.classList.toggle("active");
}

// Modal Controls
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

// Auth Form
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
      <h2 style="margin-bottom:15px; color:var(--text);">${isLogin ? "Welcome Back" : "Create Account"}</h2>
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
      <p id="auth-error" style="color:#ef4444; font-size:0.8rem; min-height:20px; margin:10px 0;"></p>
      <button type="submit" class="btn-primary" style="width:100%">${isLogin ? "Login" : "Register"}</button>
    </form>
  `;
}

function handleAuthSubmit(e, mode) {
  e.preventDefault();
  const role = document.querySelector('input[name="role"]:checked').value;
  const id = document.getElementById("user-id").value.trim().toUpperCase();
  const email = document.getElementById("user-email").value.trim().toLowerCase();
  const pass = document.getElementById("user-pass").value;
  const errorEl = document.getElementById("auth-error");

  if (role === "doctor" && !id.startsWith("D")) {
    errorEl.textContent = "Doctor IDs must start with 'D'";
    return;
  }
  if (role === "patient" && !id.startsWith("P")) {
    errorEl.textContent = "Patient IDs must start with 'P'";
    return;
  }

  let users = JSON.parse(localStorage.getItem("hp_users") || "[]");

  if (mode === "register") {
    const name = document.getElementById("reg-name").value.trim();
    const pass2 = document.getElementById("user-pass2").value;
    if (pass !== pass2) {
      errorEl.textContent = "Passwords do not match.";
      return;
    }
    if (users.find((u) => u.id === id)) {
      errorEl.textContent = "ID already registered.";
      return;
    }

    const newUser = {
      id,
      email,
      pass,
      role,
      name,
      joined: new Date().toLocaleDateString(),
    };
    users.push(newUser);
    localStorage.setItem("hp_users", JSON.stringify(users));
    localStorage.setItem("currentUser", JSON.stringify(newUser));
    currentLoggedInUser = newUser;
    updateNavAfterLogin(newUser);
    showProfileView(newUser);
    closeModal();

    fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass, name, role }),
    }).catch((e) => console.log("Backend sync:", e));
  } else {
    const user = users.find((u) => u.id === id && u.email === email && u.pass === pass);
    if (!user) {
      errorEl.textContent = "Invalid Credentials.";
      return;
    }
    const remember = document.getElementById("remember-me")?.checked;
    if (remember) localStorage.setItem("currentUser", JSON.stringify(user));
    else sessionStorage.setItem("currentUser", JSON.stringify(user));
    currentLoggedInUser = user;
    updateNavAfterLogin(user);
    showProfileView(user);
    closeModal();
  }
}

async function showProfileView(user) {
  const content = document.querySelector(".modal-content");
  if (!content) return;

  const initials = (user.name || user.id).split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  content.innerHTML = `
    <span class="close" onclick="closeModal()">&times;</span>
    <div style="display: flex; min-height: 500px;">
      <div style="flex: 1; padding: 30px; border-right: 1px solid var(--border); text-align: center;">
        <div class="profile-avatar-large">${initials}</div>
        <h2>${user.name || "User"}</h2>
        <span class="role-badge">${user.role.toUpperCase()}</span>
        <div style="margin-top: 30px; text-align: left;">
          <div style="margin-bottom: 15px;"><label style="display: block; font-size: 0.75rem; opacity: 0.6;">ID</label><span>${user.id}</span></div>
          <div style="margin-bottom: 15px;"><label style="display: block; font-size: 0.75rem; opacity: 0.6;">Email</label><span>${user.email}</span></div>
          <div><label style="display: block; font-size: 0.75rem; opacity: 0.6;">Total Predictions</label><span id="total-count">--</span></div>
        </div>
        <button onclick="handleLogout()" class="btn-logout" style="margin-top: 20px;"><i class="fas fa-sign-out-alt"></i> Sign Out</button>
      </div>
      <div style="flex: 1.5; padding: 30px; display: flex; flex-direction: column;">
        <h3><i class="fas fa-history"></i> Prediction History</h3>
        <div id="history-list" style="overflow-y: auto; flex: 1; margin-top: 20px; max-height: 400px;"></div>
      </div>
    </div>
  `;

  try {
    const res = await fetch(`${BASE_URL}/patient/${encodeURIComponent(user.email)}/history`);
    const data = await res.json();
    const list = document.getElementById("history-list");
    const totalSpan = document.getElementById("total-count");

    if (data.history && data.history.length > 0) {
      if (totalSpan) totalSpan.innerText = data.history.length;
      list.innerHTML = data.history.map(rec => {
        let confColor = rec.confidence >= 80 ? "#10b981" : (rec.confidence >= 60 ? "#f59e0b" : "#ef4444");
        return `
          <div style="background: var(--glass); border: 1px solid var(--border); padding: 15px; border-radius: 12px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--primary);">
              <span>${rec.date}</span>
              <strong style="color: ${confColor};">${rec.confidence}%</strong>
            </div>
            <h4 style="margin: 5px 0;">${rec.disease}</h4>
            <p style="font-size: 0.8rem; opacity: 0.7;">Symptoms: ${rec.symptoms.join(', ')}</p>
            <details style="margin-top: 10px;">
              <summary style="cursor: pointer; color: var(--primary); font-size: 0.8rem;"><i class="fas fa-leaf"></i> View Remedies</summary>
              <ul style="margin-top: 10px; padding-left: 20px;">
                ${rec.remedies.slice(0, 3).map(r => `<li>${r}</li>`).join('')}
              </ul>
            </details>
          </div>
        `;
      }).join('');
    } else {
      if (totalSpan) totalSpan.innerText = "0";
      list.innerHTML = "<p style='text-align: center; padding: 40px;'>No predictions yet.<br><small>Try analyzing symptoms!</small></p>";
    }
  } catch (e) {
    document.getElementById("history-list").innerHTML = "<p style='color: red;'>Error loading history. Make sure backend is running.</p>";
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
  const initials = (user.name || user.id).split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const iconCircle = container.querySelector(".profile-icon-circle");
  if (iconCircle) {
    iconCircle.innerHTML = `<span class="nav-initials">${initials}</span>`;
    iconCircle.style.background = "linear-gradient(135deg, #4361ee, #7209b7)";
  }
  const label = container.querySelector(".nav-label");
  if (label) label.textContent = user.id;
}

// Doctor Dashboard Search
async function searchPatient() {
  const id = document.getElementById("patient-search-input").value.trim().toUpperCase();
  const resultArea = document.getElementById("patient-result-area");
  const errorMsg = document.getElementById("no-result-msg");
  const tableBody = document.getElementById("patient-record-body");

  if (!id) {
    alert("Please enter a Patient ID (e.g., P101)");
    return;
  }

  resultArea.style.display = "none";
  errorMsg.style.display = "block";
  errorMsg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';

  try {
    const response = await fetch(`${BASE_URL}/patient/${encodeURIComponent(id)}/history`);
    const data = await response.json();

    if (data.history && data.history.length > 0) {
      errorMsg.style.display = "none";
      tableBody.innerHTML = "";

      document.getElementById("res-name").innerText = id;
      document.getElementById("res-date").innerText = data.history[0]?.date || "N/A";
      document.getElementById("total-records").innerText = data.history.length;

      let avgConf = data.history.reduce((s, r) => s + r.confidence, 0) / data.history.length;
      document.getElementById("avg-confidence").innerHTML = `<span style="color: #10b981;">${avgConf.toFixed(1)}%</span>`;

      data.history.forEach((rec) => {
        let confColor = rec.confidence >= 80 ? "#10b981" : (rec.confidence >= 60 ? "#f59e0b" : "#ef4444");
        let remediesHtml = rec.remedies.map(r => `<li>${r}</li>`).join('');

        tableBody.innerHTML += `
          <tr>
            <td>${rec.date}</td>
            <td style="max-width: 200px;">${rec.symptoms.join(", ")}</td>
            <td><strong>${rec.disease}</strong></td>
            <td>
              <span style="background: ${confColor}; color: white; padding: 4px 8px; border-radius: 20px; font-size: 0.8rem;">${rec.confidence}%</span>
              <div style="background: #e5e7eb; border-radius: 10px; height: 4px; margin-top: 5px; width: 80px;">
                <div style="background: ${confColor}; width: ${rec.confidence}%; height: 4px; border-radius: 10px;"></div>
              </div>
            </td>
            <td><span class="status-badge status-reviewed">Completed</span></td>
            <td>
              <button onclick="showRemediesModal('${rec.disease.replace(/'/g, "\\'")}', \`${remediesHtml.replace(/`/g, "\\`")}\`)" style="background: var(--primary); color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
                <i class="fas fa-leaf"></i> View
              </button>
            </td>
          </tr>
        `;
      });
      resultArea.style.display = "block";
    } else {
      errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> No records found for: ${id}`;
    }
  } catch (error) {
    errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> Backend error. Make sure server is running.`;
  }
}

function showRemediesModal(disease, remediesHtml) {
  const modal = document.createElement("div");
  modal.style.cssText = `position: fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:10000;`;
  modal.innerHTML = `
    <div style="background: white; padding: 30px; border-radius: 15px; max-width: 400px; width: 90%;">
      <h3 style="color: var(--primary); margin-bottom: 15px;"><i class="fas fa-leaf"></i> Remedies for ${disease}</h3>
      <ul style="margin: 20px 0;">${remediesHtml}</ul>
      <div style="background: #fef3c7; padding: 10px; border-radius: 8px; margin: 15px 0;">
        <small style="color: #92400e;"><i class="fas fa-exclamation-triangle"></i> Consult a doctor for proper medical advice.</small>
      </div>
      <button onclick="this.closest('div').parentElement.remove()" style="background: var(--primary); color: white; border: none; padding: 10px; border-radius: 8px; width: 100%; cursor: pointer;">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
}

// Contact Form
const contactForm = document.querySelector(".contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const btn = this.querySelector("button");
    const originalText = btn.innerText;
    btn.innerText = "Sending...";
    btn.disabled = true;
    emailjs.sendForm("service_xtddcju", "template_zrywow4", this).then(
      () => {
        btn.innerText = "Message Sent!";
        alert("Message sent successfully!");
        contactForm.reset();
        setTimeout(() => {
          btn.innerText = originalText;
          btn.disabled = false;
        }, 3000);
      },
      (err) => {
        btn.innerText = "Error";
        btn.disabled = false;
        alert("Failed to send.");
        setTimeout(() => {
          btn.innerText = originalText;
        }, 3000);
      }
    );
  });
}

// MAIN PREDICTION FUNCTION
async function runPrediction() {
  try {
    const selectedTags = document.querySelectorAll('.tag.active');
    const symptoms = Array.from(selectedTags).map(tag => tag.textContent);

    if (symptoms.length === 0) {
      alert("Please select at least one symptom");
      return;
    }

    const savedUser = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
    let patient_id = null;
    if (savedUser) {
      const user = JSON.parse(savedUser);
      if (user.role === "patient") {
        patient_id = user.email;
      }
    }

    const response = await fetch(`${BASE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptoms, patient_id })
    });

    const data = await response.json();

    let confidenceColor = data.confidence >= 80 ? "#10b981" : (data.confidence >= 60 ? "#f59e0b" : "#ef4444");

    const resultHtml = `
      <div class="prediction-result-overlay" onclick="if(event.target===this)this.remove()" style="position: fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:10000;">
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 450px; width: 90%; max-height: 80vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="color: var(--primary);"><i class="fas fa-microscope"></i> Analysis Result</h3>
            <button onclick="this.closest('.prediction-result-overlay').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
          </div>
          <div style="margin-bottom: 20px;">
            <label style="font-weight: bold;">Predicted Disease</label>
            <h2 style="color: ${confidenceColor}; margin-top: 5px;">${data.disease}</h2>
          </div>
          <div style="margin-bottom: 20px;">
            <label style="font-weight: bold;">Confidence Level</label>
            <div style="font-size: 24px; font-weight: bold; color: ${confidenceColor};">${data.confidence}%</div>
            <div style="background: #e5e7eb; border-radius: 10px; height: 8px; margin-top: 5px;">
              <div style="background: ${confidenceColor}; width: ${data.confidence}%; height: 8px; border-radius: 10px;"></div>
            </div>
          </div>
          <div style="margin-bottom: 20px;">
            <label style="font-weight: bold;"><i class="fas fa-leaf"></i> Home Remedies</label>
            <ul style="margin-top: 10px; padding-left: 20px;">
              ${data.remedies.map(r => `<li style="margin: 8px 0;">${r}</li>`).join('')}
            </ul>
          </div>
          <div style="background: #fef3c7; padding: 10px; border-radius: 8px; margin: 15px 0;">
            <small style="color: #92400e;"><i class="fas fa-exclamation-triangle"></i> This is an AI prediction. Please consult a doctor for proper medical advice.</small>
          </div>
          <button onclick="this.closest('.prediction-result-overlay').remove()" style="background: var(--primary); color: white; border: none; padding: 10px; border-radius: 8px; width: 100%; cursor: pointer;">Close</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', resultHtml);
    
    if (data.saved && patient_id) {
      const modal = document.getElementById("login-modal");
      if (modal && modal.style.display === "flex") {
        const savedUserData = JSON.parse(savedUser);
        const res = await fetch(`${BASE_URL}/patient/${encodeURIComponent(savedUserData.email)}/history`);
        const historyData = await res.json();
        const list = document.getElementById("history-list");
        if (list && historyData.history) {
          list.innerHTML = historyData.history.map(rec => {
            let confColor = rec.confidence >= 80 ? "#10b981" : (rec.confidence >= 60 ? "#f59e0b" : "#ef4444");
            return `<div style="background: var(--glass); border: 1px solid var(--border); padding: 15px; border-radius: 12px; margin-bottom: 15px;">
              <div style="display: flex; justify-content: space-between;"><span>${rec.date}</span><strong style="color: ${confColor};">${rec.confidence}%</strong></div>
              <h4>${rec.disease}</h4>
              <p style="font-size: 0.8rem;">Symptoms: ${rec.symptoms.join(', ')}</p>
            </div>`;
          }).join('');
        }
      }
    }
  } catch (error) {
    console.error(error);
    alert("Prediction failed. Make sure the backend server is running on port 5000.");
  }
}

function toggleFAQ(element) {
  const item = element.parentElement;
  document.querySelectorAll(".faq-item").forEach((otherItem) => {
    if (otherItem !== item) otherItem.classList.remove("active");
  });
  item.classList.toggle("active");
}

// Page Initialization
window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("hp_theme");
  if (savedTheme) {
    document.body.setAttribute("data-theme", savedTheme);
    if (themeBtn)
      themeBtn.innerHTML = savedTheme === "dark" ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
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