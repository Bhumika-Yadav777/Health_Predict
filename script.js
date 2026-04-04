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

  content.innerHTML = `
        <span class="close" onclick="closeModal()">&times;</span>
        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-avatar-large">${initials}</div>
                <h2 class="profile-name">${user.name || "User"}</h2>
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
                    <span>${user.joined || "April 2026"}</span>
                </div>
            </div>
            <div class="history-section" style="margin-top: 20px;"><h4><i class="fas fa-spinner fa-spin"></i> Loading history...</h4></div>
            <div class="profile-actions">
                <button class="btn-primary" onclick="closeModal()">Close</button>
                <button onclick="handleLogout()" class="btn-logout"><i class="fas fa-sign-out-alt"></i> Sign Out</button>
            </div>
        </div>
    `;

  try {
    const response = await fetch(
      `${BASE_URL}/patient/${encodeURIComponent(user.email)}/history`,
    );
    const data = await response.json();
    const historySection = content.querySelector(".history-section");

    if (data.history && data.history.length > 0) {
      let historyHtml =
        '<h4><i class="fas fa-history"></i> Recent Predictions</h4>';
      data.history.slice(0, 5).forEach((record) => {
        let confidenceColor = "#10b981";
        if (record.confidence < 80) confidenceColor = "#f59e0b";
        if (record.confidence < 70) confidenceColor = "#ef4444";

        historyHtml += `
                    <div style="border-bottom:1px solid var(--border); padding:10px 0;">
                        <div style="font-size:0.8rem; color:var(--primary);">${record.date}</div>
                        <div><strong>Disease:</strong> ${record.disease}</div>
                        <div><strong>Confidence:</strong> <span style="color: ${confidenceColor}; font-weight: bold;">${record.confidence}%</span></div>
                        <div style="font-size:0.8rem;"><strong>Symptoms:</strong> ${record.symptoms.join(", ")}</div>
                        <div style="font-size:0.8rem; margin-top: 5px;"><strong><i class="fas fa-leaf"></i> Remedies:</strong> ${record.remedies.slice(0, 2).join("; ")}</div>
                    </div>
                `;
      });
      historySection.innerHTML = historyHtml;
    } else {
      historySection.innerHTML =
        '<h4><i class="fas fa-history"></i> Recent Predictions</h4><p>No predictions yet. Try analyzing symptoms!</p>';
    }
  } catch (error) {
    console.error("History error:", error);
    const historySection = content.querySelector(".history-section");
    historySection.innerHTML =
      '<h4><i class="fas fa-history"></i> Recent Predictions</h4><p style="color: #ef4444;">Unable to load history. Make sure backend is running.</p>';
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
  const id = document
    .getElementById("patient-search-input")
    .value.trim()
    .toUpperCase();
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
    const response = await fetch(
      `${BASE_URL}/patient/${encodeURIComponent(id)}/history`,
    );
    const data = await response.json();

    if (data.history && data.history.length > 0) {
      errorMsg.style.display = "none";
      tableBody.innerHTML = "";

      document.getElementById("res-name").innerText = id;
      document.getElementById("res-date").innerText =
        data.history[0]?.date || "N/A";
      document.getElementById("total-records").innerText = data.history.length;

      let avgConfidence =
        data.history.reduce((sum, rec) => sum + rec.confidence, 0) /
        data.history.length;
      document.getElementById("avg-confidence").innerHTML =
        `<span style="color: #10b981;">${avgConfidence.toFixed(1)}%</span>`;

      data.history.forEach((rec) => {
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
                            <span style="background: ${confidenceColor}; color: white; padding: 4px 8px; border-radius: 20px; font-size: 0.8rem;">
                                ${rec.confidence}% (${confidenceText})
                            </span>
                            <div style="background: #e5e7eb; border-radius: 10px; height: 4px; margin-top: 5px; width: 80px;">
                                <div style="background: ${confidenceColor}; width: ${rec.confidence}%; height: 4px; border-radius: 10px;"></div>
                            </div>
                        </td>
                        <td><span class="status-badge status-reviewed">Completed</span></td>
                        <td>
                            <button onclick="showDetailedRemedies('${rec.disease.replace(/'/g, "\\'")}', \`${remediesList.replace(/`/g, "\\`")}\`)" 
                                    style="background: var(--primary); color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">
                                <i class="fas fa-leaf"></i> View Remedies
                            </button>
                        </td>
                    </tr>
                `;
      });
      resultArea.style.display = "block";
    } else {
      errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> No records found for patient ID: ${id}<br><small>Make sure the patient has made predictions after logging in.</small>`;
    }
  } catch (error) {
    console.error("Search error:", error);
    errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> Backend error. Make sure server is running on port 5000.`;
  }
}

function showDetailedRemedies(disease, remediesText) {
  const modal = document.createElement("div");
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
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 400px; width: 90%;">
            <h3 style="color: var(--primary); margin-bottom: 15px;">
                <i class="fas fa-leaf"></i> Home Remedies for ${disease}
            </h3>
            <div style="margin: 20px 0;">
                ${remediesText
                  .split("\n")
                  .map((r) => `<p style="margin: 10px 0;">${r}</p>`)
                  .join("")}
            </div>
            <div style="background: #fef3c7; padding: 10px; border-radius: 8px; margin: 15px 0;">
                <small style="color: #92400e;">
                    <i class="fas fa-exclamation-triangle"></i> Note: These are home remedies. Please consult a doctor for proper medical advice.
                </small>
            </div>
            <button onclick="this.closest('div').parentElement.remove()" 
                    style="background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; width: 100%;">
                Close
            </button>
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

    // Get current logged in user's email as patient_id
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

    // Display result in a nice modal
    let confidenceColor = "#10b981";
    if (data.confidence < 80) confidenceColor = "#f59e0b";
    if (data.confidence < 70) confidenceColor = "#ef4444";

    const resultHtml = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 10000;" onclick="if(event.target===this)this.remove()">
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 450px; width: 90%;">
          <h3 style="color: var(--primary); margin-bottom: 20px;">
            <i class="fas fa-microscope"></i> Analysis Result
          </h3>
          <div style="margin-bottom: 20px;">
            <strong>Predicted Disease:</strong>
            <h2 style="color: ${confidenceColor}; margin-top: 5px;">${data.disease}</h2>
          </div>
          <div style="margin-bottom: 20px;">
            <strong>Confidence:</strong>
            <div style="font-size: 24px; font-weight: bold; color: ${confidenceColor}; margin: 5px 0;">${data.confidence}%</div>
            <div style="background: #e5e7eb; border-radius: 10px; height: 8px;">
              <div style="background: ${confidenceColor}; width: ${data.confidence}%; height: 8px; border-radius: 10px;"></div>
            </div>
          </div>
          <div style="margin-bottom: 20px;">
            <strong><i class="fas fa-leaf"></i> Home Remedies:</strong>
            <ul style="margin-top: 10px; padding-left: 20px;">
              ${data.remedies.map(r => `<li style="margin: 8px 0;">${r}</li>`).join("")}
            </ul>
          </div>
          <div style="background: #fef3c7; padding: 10px; border-radius: 8px; margin: 15px 0;">
            <small style="color: #92400e;">
              <i class="fas fa-exclamation-triangle"></i> Note: This is an AI prediction. Please consult a doctor for proper medical advice.
            </small>
          </div>
          <button onclick="this.closest('div').parentElement.remove()" 
                  style="background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; width: 100%;">
            Close
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', resultHtml);
    
    // If prediction was saved, show a toast message
    if (data.saved) {
      console.log("Prediction saved to history!");
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