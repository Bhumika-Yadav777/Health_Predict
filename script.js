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
            ${
              isLogin
                ? `
            <div class="remember-group">
                <input type="checkbox" id="remember-me">
                <label for="remember-me" style="color:var(--text);">Keep me logged in</label>
            </div>`
                : ""
            }
            <p id="auth-error" style="color:#ef4444; font-size:0.8rem; min-height:20px; margin:10px 0;"></p>
            <button type="submit" class="btn-primary" style="width:100%">${isLogin ? "Login" : "Register"}</button>
        </form>
    `;
}

function handleAuthSubmit(e, mode) {
  e.preventDefault();
  const role = document.querySelector('input[name="role"]:checked').value;
  const id = document.getElementById("user-id").value.trim().toUpperCase();
  const email = document
    .getElementById("user-email")
    .value.trim()
    .toLowerCase();
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
    const user = users.find(
      (u) => u.id === id && u.email === email && u.pass === pass,
    );
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

  const initials = (user.name || user.id)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Fetch patient info from backend
  let patientInfo = { name: user.name || "User", joined: user.joined || "April 2026" };
  try {
    const infoRes = await fetch(`${BASE_URL}/patient/${encodeURIComponent(user.email)}/info`);
    if (infoRes.ok) {
      const infoData = await infoRes.json();
      patientInfo = infoData;
    }
  } catch (e) {
    console.log("Using local user info");
  }

  content.innerHTML = `
        <span class="close" onclick="closeModal()">&times;</span>
        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-avatar-large">${initials}</div>
                <h2 class="profile-name">${patientInfo.name || user.name}</h2>
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
                    <span>${patientInfo.joined || user.joined}</span>
                </div>
                <div class="detail-item">
                    <label><i class="fas fa-chart-line"></i> Total Predictions</label>
                    <span id="total-predictions-count">--</span>
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
                <button onclick="handleLogout()" class="btn-logout"><i class="fas fa-sign-out-alt"></i> Sign Out</button>
            </div>
        </div>
    `;

  await loadPatientHistory(user.email);
}

async function loadPatientHistory(email) {
  const historyContainer = document.getElementById("history-list-container");
  if (!historyContainer) return;

  try {
    const response = await fetch(`${BASE_URL}/patient/${encodeURIComponent(email)}/history`);
    const data = await response.json();
    const totalCountSpan = document.getElementById("total-predictions-count");
    
    if (data.history && data.history.length > 0) {
      if (totalCountSpan) totalCountSpan.innerText = data.history.length;
      
      let historyHtml = '';
      data.history.forEach((record) => {
        let confidenceColor = "#10b981";
        let confidenceText = "High";
        if (record.confidence >= 80) {
          confidenceColor = "#10b981";
          confidenceText = "High";
        } else if (record.confidence >= 60) {
          confidenceColor = "#f59e0b";
          confidenceText = "Medium";
        } else {
          confidenceColor = "#ef4444";
          confidenceText = "Low";
        }

        historyHtml += `
          <div class="history-record">
            <div class="record-header">
              <span class="record-date"><i class="far fa-calendar-alt"></i> ${record.date}</span>
              <span class="record-confidence" style="background: ${confidenceColor};">${record.confidence}% ${confidenceText}</span>
            </div>
            <div class="record-disease">
              <strong>Predicted Disease:</strong> ${record.disease}
            </div>
            <div class="record-symptoms">
              <strong>Symptoms:</strong> ${record.symptoms.join(", ")}
            </div>
            <div class="record-remedies">
              <strong><i class="fas fa-leaf"></i> Remedies:</strong>
              <ul>
                ${record.remedies.slice(0, 3).map(r => `<li>${r}</li>`).join("")}
              </ul>
            </div>
          </div>
        `;
      });
      historyContainer.innerHTML = historyHtml;
    } else {
      if (totalCountSpan) totalCountSpan.innerText = "0";
      historyContainer.innerHTML = `
        <div class="empty-history">
          <i class="fas fa-clinic-medical"></i>
          <p>No predictions yet</p>
          <small>Try analyzing symptoms to see your history here!</small>
        </div>
      `;
    }
  } catch (error) {
    console.error("History error:", error);
    historyContainer.innerHTML = `
      <div class="empty-history error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Unable to load history</p>
        <small>Make sure the backend server is running.</small>
      </div>
    `;
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
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const iconCircle = container.querySelector(".profile-icon-circle");
  iconCircle.innerHTML = `<span class="nav-initials">${initials}</span>`;
  iconCircle.style.background = "linear-gradient(135deg, #4361ee, #7209b7)";
  const label = container.querySelector(".nav-label");
  label.textContent = user.id;
  container.classList.add("logged-in");
}

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
  errorMsg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading patient records...';

  try {
    // First, try to find user by email (patient_id is email)
    const historyResponse = await fetch(`${BASE_URL}/patient/${encodeURIComponent(id)}/history`);
    const historyData = await historyResponse.json();

    // Also try to get patient info
    let patientName = id;
    try {
      const infoResponse = await fetch(`${BASE_URL}/patient/${encodeURIComponent(id)}/info`);
      if (infoResponse.ok) {
        const infoData = await infoResponse.json();
        patientName = infoData.name || id;
      }
    } catch (e) {}

    if (historyData.history && historyData.history.length > 0) {
      errorMsg.style.display = "none";
      tableBody.innerHTML = "";

      document.getElementById("res-name").innerText = patientName;
      document.getElementById("res-date").innerText = historyData.history[0]?.date || "N/A";
      document.getElementById("total-records").innerText = historyData.history.length;

      let avgConfidence = historyData.history.reduce((sum, rec) => sum + rec.confidence, 0) / historyData.history.length;
      document.getElementById("avg-confidence").innerHTML = `<span style="color: #10b981;">${avgConfidence.toFixed(1)}%</span>`;

      historyData.history.forEach((rec) => {
        let confidenceColor = "#10b981";
        let confidenceText = "High";
        if (rec.confidence >= 80) {
          confidenceColor = "#10b981";
          confidenceText = "High";
        } else if (rec.confidence >= 60) {
          confidenceColor = "#f59e0b";
          confidenceText = "Medium";
        } else {
          confidenceColor = "#ef4444";
          confidenceText = "Low";
        }

        const remediesList = rec.remedies.map((r) => `• ${r}`).join("\n");

        tableBody.innerHTML += `
          <tr>
            <td>${rec.date}</td>
            <td style="max-width: 200px;">${rec.symptoms.join(", ")}</td>
            <td><strong>${rec.disease}</strong></td>
            <td>
              <span class="confidence-badge" style="background: ${confidenceColor};">${rec.confidence}% (${confidenceText})</span>
              <div class="confidence-bar-small">
                <div class="confidence-fill-small" style="width: ${rec.confidence}%; background: ${confidenceColor};"></div>
              </div>
            </td>
            <td><span class="status-badge status-reviewed">Completed</span></td>
            <td>
              <button class="btn-view-remedies" onclick="showDetailedRemedies('${rec.disease.replace(/'/g, "\\'")}', \`${remediesList.replace(/`/g, "\\`")}\`)">
                <i class="fas fa-leaf"></i> View
              </button>
            </td>
          </tr>
        `;
      });
      resultArea.style.display = "block";
    } else {
      errorMsg.innerHTML = `
        <i class="fas fa-exclamation-circle"></i> No records found for patient ID: ${id}<br>
        <small>Make sure the patient has made predictions after logging in.</small>
      `;
    }
  } catch (error) {
    console.error("Search error:", error);
    errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> Backend error. Make sure server is running on port 5000.`;
  }
}

function showDetailedRemedies(disease, remediesText) {
  const modal = document.createElement("div");
  modal.className = "remedies-modal-overlay";
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  modal.innerHTML = `
    <div class="remedies-modal-content">
      <div class="remedies-modal-header">
        <h3><i class="fas fa-leaf"></i> Home Remedies for ${disease}</h3>
        <button class="remedies-modal-close" onclick="this.closest('.remedies-modal-overlay').remove()">&times;</button>
      </div>
      <div class="remedies-modal-body">
        ${remediesText.split("\n").map(r => `<p><i class="fas fa-check-circle"></i> ${r}</p>`).join("")}
      </div>
      <div class="remedies-modal-footer">
        <small><i class="fas fa-exclamation-triangle"></i> Note: These are home remedies. Please consult a doctor for proper medical advice.</small>
        <button onclick="this.closest('.remedies-modal-overlay').remove()" class="btn-close-remedies">Close</button>
      </div>
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
      },
    );
  });
}

// Prediction Function
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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        symptoms: symptoms,
        patient_id: patient_id
      })
    });

    const data = await response.json();
    console.log("Prediction result:", data);

    let confidenceColor = "#10b981";
    if (data.confidence < 80) confidenceColor = "#f59e0b";
    if (data.confidence < 70) confidenceColor = "#ef4444";

    const resultHtml = `
      <div class="prediction-result-overlay" onclick="if(event.target===this)this.remove()">
        <div class="prediction-result-card">
          <div class="result-header">
            <h3><i class="fas fa-microscope"></i> Analysis Result</h3>
            <button class="result-close" onclick="this.closest('.prediction-result-overlay').remove()">&times;</button>
          </div>
          <div class="result-disease">
            <label>Predicted Disease</label>
            <h2 style="color: ${confidenceColor};">${data.disease}</h2>
          </div>
          <div class="result-confidence">
            <label>Confidence Level</label>
            <div class="confidence-value" style="color: ${confidenceColor};">${data.confidence}%</div>
            <div class="confidence-bar">
              <div class="confidence-fill" style="width: ${data.confidence}%; background: ${confidenceColor};"></div>
            </div>
          </div>
          <div class="result-remedies">
            <label><i class="fas fa-leaf"></i> Home Remedies</label>
            <ul>
              ${data.remedies.map(r => `<li>${r}</li>`).join("")}
            </ul>
          </div>
          <div class="result-note">
            <small><i class="fas fa-exclamation-triangle"></i> This is an AI prediction. Please consult a doctor for proper medical advice.</small>
          </div>
          <button class="btn-close-result" onclick="this.closest('.prediction-result-overlay').remove()">Close</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', resultHtml);
    
    if (data.saved && patient_id) {
      // Refresh history if modal is open
      const modal = document.getElementById("login-modal");
      if (modal && modal.style.display === "flex") {
        const savedUserData = JSON.parse(savedUser);
        await loadPatientHistory(savedUserData.email);
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
      themeBtn.innerHTML =
        savedTheme === "dark"
          ? '<i class="fas fa-sun"></i>'
          : '<i class="fas fa-moon"></i>';
  }
  const savedUser =
    localStorage.getItem("currentUser") ||
    sessionStorage.getItem("currentUser");
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