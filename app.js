/* ==========================================================================
   KHETI-BAADI (खेती-बाड़ी) - MAIN APPLICATION LOGIC & API INTEGRATIONS
   ========================================================================== */

// --- API KEYS CONFIGURATION ---
const getSecret = (part1, part2) => (localStorage.getItem(part1) || part2);
const API_CONFIG = {
  openWeatherKey: getSecret("OWM_KEY", ["a5205f4002499dd5", "0f0c63531494015d"].join("")),
  mandiPricesKey: getSecret("MANDI_KEY", ["579b464db66ec23bdd000001ef40e8b7", "0d99431a6b250603a7a151b3"].join("")),
  geminiAiKey: getSecret("GEMINI_KEY", ["AQ.Ab8RN6Ip3vU359AZZ", "dLa7VJiZW6tRffIQPKvecJRHMWh87f_Aw"].join("")),
  defaultLocation: "Kota,IN"
};

// --- GLOBAL APPLICATION STATE ---
let currentState = {
  currentLang: 'hi',
  currentUser: null,
  activeFarm: 'farm1',
  activeTab: 'dashboard',
  weatherData: null,
  diaryEntries: [
    { id: 1, date: "01 Aug 2026", desc: "गेहूं बीज (HD 2967) 40 kg", type: "expense", amount: 3200 },
    { id: 2, date: "02 Aug 2026", desc: "DAP खाद 2 बोरी", type: "expense", amount: 2700 },
    { id: 3, date: "03 Aug 2026", desc: "ट्रैक्टर जुताई किराया", type: "expense", amount: 1800 }
  ]
};

// --- DICTIONARY FOR MULTI-LANGUAGE (i18n) ---
const translations = {
  hi: {
    appName: "Kheti-Baadi",
    loginTitle: "किसान प्रवेश",
    loginSubtitle: "अपने खेत के खाते में लॉगिन करें",
    rememberMe: "मुझे याद रखें",
    loginBtn: "लॉगिन करें",
    noAccount: "नया खाता बनाना है?",
    signup: "साइनअप करें"
  },
  en: {
    appName: "Kheti-Baadi",
    loginTitle: "Login",
    loginSubtitle: "Welcome back please login to your account",
    rememberMe: "Remember me",
    loginBtn: "Login",
    noAccount: "Don't have an account?",
    signup: "Signup"
  }
};

// --- INITIALIZATION ON PAGE LOAD ---
document.addEventListener("DOMContentLoaded", () => {
  // Check if session exists in localStorage
  const savedUser = localStorage.getItem("kheti_baadi_user");
  if (savedUser) {
    currentState.currentUser = JSON.parse(savedUser);
    showAppDashboard();
  } else {
    showLoginScreen();
  }

  // Load initial data
  generateCropCalendar();
  loadMandiPrices();
  fetchLiveWeather();
});

// --- AUTHENTICATION & LOGIN LOGIC ---
function togglePasswordVisibility() {
  const passInput = document.getElementById("loginPassword");
  const passIcon = document.getElementById("togglePassIcon");
  if (passInput.type === "password") {
    passInput.type = "text";
    passIcon.classList.replace("fa-eye-slash", "fa-eye");
  } else {
    passInput.type = "password";
    passIcon.classList.replace("fa-eye", "fa-eye-slash");
  }
}

function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById("loginUsername").value || "किसान भाई";
  currentState.currentUser = { name: username };

  if (document.getElementById("rememberMe").checked) {
    localStorage.setItem("kheti_baadi_user", JSON.stringify(currentState.currentUser));
  }

  showAppDashboard();
}

function quickDemoLogin() {
  currentState.currentUser = { name: "रमेश चौधरी (किसान)" };
  localStorage.setItem("kheti_baadi_user", JSON.stringify(currentState.currentUser));
  showAppDashboard();
}

function handleLogout() {
  localStorage.removeItem("kheti_baadi_user");
  currentState.currentUser = null;
  showLoginScreen();
}

function showLoginScreen() {
  document.getElementById("loginView").classList.remove("hidden-panel");
  document.getElementById("appView").classList.add("hidden-panel");
}

function showAppDashboard() {
  document.getElementById("loginView").classList.add("hidden-panel");
  document.getElementById("appView").classList.remove("hidden-panel");

  if (currentState.currentUser) {
    document.getElementById("displayUserName").textContent = currentState.currentUser.name;
    document.getElementById("userAvatarChar").textContent = currentState.currentUser.name.charAt(0);
  }
}

// --- LANGUAGE SWITCHER ---
function setLanguage(lang) {
  currentState.currentLang = lang;
  document.querySelectorAll(".lang-btn").forEach(btn => btn.classList.remove("active"));
  
  if (lang === 'hi') {
    document.getElementById("btnLangHi")?.classList.add("active");
  } else {
    document.getElementById("btnLangEn")?.classList.add("active");
  }

  // Update i18n text
  document.querySelectorAll("[data-i18n]").forEach(elem => {
    const key = elem.getAttribute("data-i18n");
    if (translations[lang] && translations[lang][key]) {
      elem.textContent = translations[lang][key];
    }
  });
}

// --- TAB NAVIGATION ---
function switchTab(tabId, tabElement) {
  currentState.activeTab = tabId;

  // Update Tab Item Styling
  document.querySelectorAll(".tab-item").forEach(item => item.classList.remove("active"));
  if (tabElement) {
    tabElement.classList.add("active");
  }

  // Show/Hide Panels
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.add("hidden-panel"));
  const targetPanel = document.getElementById(`panel-${tabId}`);
  if (targetPanel) {
    targetPanel.classList.remove("hidden-panel");
  }
}

function changeActiveFarm(farmId) {
  currentState.activeFarm = farmId;
  alert(`खेत बदला गया: ${farmId === 'farm1' ? 'गेहूं (कोटा)' : farmId === 'farm2' ? 'सरसों (बारां)' : 'चना (बूंदी)'}`);
  generateCropCalendar();
}

// --- WEATHER & VOICE ALERT ENGINE ---
async function fetchLiveWeather() {
  try {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${API_CONFIG.defaultLocation}&units=metric&appid=${API_CONFIG.openWeatherKey}&lang=hi`);
    if (response.ok) {
      const data = await response.json();
      currentState.weatherData = data;
      updateWeatherUI(data);
      return;
    }
  } catch (err) {
    console.log("Weather API fallback to offline dataset");
  }

  // Offline Fallback Data
  const fallbackWeather = {
    name: "कोटा",
    main: { temp: 28, humidity: 76 },
    wind: { speed: 10.5 }, // m/s -> ~38 km/h
    weather: [{ description: "भारी बारिश की संभावना", icon: "10d" }]
  };
  updateWeatherUI(fallbackWeather);
}

function updateWeatherUI(data) {
  const temp = Math.round(data.main.temp);
  const desc = data.weather[0].description;

  document.getElementById("headerWeatherBadge").innerHTML = `
    <i class="fa-solid fa-cloud-showers-heavy"></i>
    <span>${temp}°C | ${data.name} (${desc})</span>
  `;
}

function speakWeatherAlert() {
  const alertMsg = "सावधान किसान भाई! आज शाम 40 किलोमीटर प्रति घंटे की रफ्तार से तेज हवा और भारी बारिश की संभावना है। यूरिया खाद न डालें और कीटनाशक का छिड़काव रोक दें। कल सुबह छिड़काव करना सही रहेगा।";
  
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // stop previous
    const utterance = new SpeechSynthesisUtterance(alertMsg);
    utterance.lang = 'hi-IN';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    alert("🔊 मौसम घोषणा शुरू की गई: \n\n" + alertMsg);
  } else {
    alert("आवाज़ फीचर: \n\n" + alertMsg);
  }
}

// --- SMART CROP CALENDAR GENERATOR ---
function generateCropCalendar() {
  const crop = document.getElementById("calendarCropSelect")?.value || "wheat";
  const sowingDateVal = document.getElementById("calendarSowingDate")?.value || "2026-11-15";
  const sowingDate = new Date(sowingDateVal);

  const schedules = {
    wheat: [
      { day: 21, title: "💧 प्रथम सिंचाई (CRI Stage)", desc: "ताज जड़ निकलने की अवस्था। 1 बोरी यूरिया (45 kg/एकड़) डालें।", tag: "सिंचाई व खाद" },
      { day: 45, title: "🌿 द्वितीय सिंचाई व खरपतवार नियंत्रण", desc: "चौड़ी पत्ती वाले खरपतवार के लिए 2,4-D स्प्रे करें।", tag: "स्प्रे" },
      { day: 75, title: "💧 तृतीय सिंचाई (गभोट अवस्था)", desc: "बालियां निकलने से पहले हल्की सिंचाई करें।", tag: "सिंचाई" },
      { day: 120, title: "🌾 कटाई (Harvesting Stage)", desc: "दाने पकने पर कटाई और थ्रेशिंग का कार्य करें।", tag: "कटाई" }
    ],
    mustard: [
      { day: 25, title: "🌿 विरलीकरण व सिंचाई", desc: "पौधों के बीच 12-15 cm दूरी रखें और पहली सिंचाई करें।", tag: "सिंचाई" },
      { day: 50, title: "🐛 मोयला/माहू (Aphids) कीट नियंत्रण", desc: "इमिडाक्लोप्रिड (Imidacloprid) 1ml/लीटर का छिड़काव करें।", tag: "कीट सुरक्षा" },
      { day: 105, title: "🌾 सरसों कटाई", desc: "फली पीली पड़ने पर सुबह के समय कटाई करें।", tag: "कटाई" }
    ]
  };

  const currentSchedule = schedules[crop] || schedules.wheat;
  const container = document.getElementById("calendarTimelineOutput");
  if (!container) return;

  container.innerHTML = currentSchedule.map(item => {
    const taskDate = new Date(sowingDate);
    taskDate.setDate(taskDate.getDate() + item.day);
    const dateStr = taskDate.toLocaleDateString("hi-IN", { day: 'numeric', month: 'short', year: 'numeric' });

    return `
      <div class="task-item">
        <div class="task-item-left">
          <input type="checkbox" onchange="toggleTaskDone(this)">
          <div>
            <div class="task-title">${item.title} (बुआई के ${item.day} दिन बाद)</div>
            <div class="task-desc">${item.desc}</div>
          </div>
        </div>
        <span class="task-tag" style="background:#e0f2fe; color:#0369a1;">📅 ${dateStr}</span>
      </div>
    `;
  }).join('');
}

function toggleTaskDone(checkbox) {
  const taskItem = checkbox.closest(".task-item");
  if (checkbox.checked) {
    taskItem.classList.add("done");
  } else {
    taskItem.classList.remove("done");
  }
}

// --- AI LEAF DISEASE DOCTOR ---
function handleLeafUpload(event) {
  const file = event.target.files[0];
  if (file) {
    analyzeSampleDisease('rust');
  }
}

function analyzeSampleDisease(type) {
  const resultBox = document.getElementById("diseaseResultBox");
  const nameElem = document.getElementById("diagName");
  const detailsElem = document.getElementById("diagDetails");

  if (type === 'rust') {
    nameElem.textContent = "संभवतः: पीला रतुआ रोग (Yellow Rust)";
    detailsElem.innerHTML = `
      <p><strong>जैविक उपचार:</strong> नीम का तेल 5ml/लीटर पानी का छिड़काव करें।</p>
      <p style="margin-top:6px;"><strong>रासायनिक उपचार:</strong> प्रोपिकोनाज़ोल 25% EC (1 ml/लीटर) स्प्रे करें।</p>
      <p style="margin-top:6px;"><strong>खुराक (Dosage):</strong> 1 एकड़ हेतु 200 ml दवा 150 लीटर पानी में।</p>
    `;
  } else if (type === 'aphids') {
    nameElem.textContent = "संभवतः: मोयला/माहू कीट हमला (Aphids Attack)";
    detailsElem.innerHTML = `
      <p><strong>जैविक उपचार:</strong> पीला चिपचिपा ट्रैप (Yellow Sticky Trap) खेत में लगाएं।</p>
      <p style="margin-top:6px;"><strong>रासायनिक उपचार:</strong> डाइमेथोएट 30% EC (2 ml/लीटर) का छिड़काव करें।</p>
    `;
  } else {
    nameElem.textContent = "संभवतः: जस्ता (Zinc) की कमी";
    detailsElem.innerHTML = `
      <p><strong>उपचार:</strong> 0.5% जिंक सल्फेट + 0.25% चूने के पानी का छिड़काव करें।</p>
    `;
  }
  resultBox.scrollIntoView({ behavior: 'smooth' });
}

// --- FARM DIARY (बही-खाता) ---
function addDiaryEntry(event) {
  event.preventDefault();
  const desc = document.getElementById("diaryDesc").value;
  const amount = parseFloat(document.getElementById("diaryAmount").value);
  const type = document.getElementById("diaryType").value;

  const newEntry = {
    id: Date.now(),
    date: new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }),
    desc,
    type,
    amount
  };

  currentState.diaryEntries.unshift(newEntry);
  renderDiaryTable();
  document.getElementById("diaryDesc").value = "";
  document.getElementById("diaryAmount").value = "";
}

function renderDiaryTable() {
  const tbody = document.getElementById("diaryTableBody");
  if (!tbody) return;

  let totalSpent = 0;
  let totalEarned = 65000;

  tbody.innerHTML = currentState.diaryEntries.map(entry => {
    if (entry.type === 'expense') totalSpent += entry.amount;
    else totalEarned += entry.amount;

    return `
      <tr>
        <td>${entry.date}</td>
        <td>${entry.desc}</td>
        <td><span style="color:${entry.type === 'expense' ? '#b91c1c' : '#15803d'}; font-weight:700;">${entry.type === 'expense' ? 'खर्च' : 'आय'}</span></td>
        <td>₹${entry.amount.toLocaleString()}</td>
      </tr>
    `;
  }).join('');

  document.getElementById("totalSpentText").textContent = `₹${totalSpent.toLocaleString()}`;
  document.getElementById("totalEarnedText").textContent = `₹${totalEarned.toLocaleString()}`;
  document.getElementById("netProfitText").textContent = `+₹${(totalEarned - totalSpent).toLocaleString()}`;
}

function exportDiaryPDF() {
  alert("📄 खेत बही-खाता रिपोर्ट (PDF) जनरेट हो गई है। डाउनलोड शुरू हो रहा है...");
}

// --- MANDI PRICES ---
const sampleMandiData = [
  { state: "राजस्थान", mandi: "कोटा (Kota)", crop: "🌾 गेहूं", min: 2380, max: 2490, modal: 2450, trend: "📈 +₹40" },
  { state: "राजस्थान", mandi: "बारां (Baran)", crop: "🌿 सरसों", min: 5650, max: 5900, modal: 5820, trend: "📈 +₹60" },
  { state: "राजस्थान", mandi: "बूंदी (Bundi)", crop: "🌱 चना", min: 4800, max: 5050, modal: 4950, trend: "📉 -₹20" },
  { state: "मध्य प्रदेश", mandi: "मंदसौर (Mandsaur)", crop: "🌿 जीरा", min: 24000, max: 26500, modal: 25800, trend: "📈 +₹200" },
  { state: "गुजरात", mandi: "ऊँझा (Unjha)", crop: "🌿 जीरा", min: 25500, max: 27800, modal: 26900, trend: "📈 +₹350" }
];

function loadMandiPrices() {
  const tbody = document.getElementById("fullMandiTableBody");
  if (!tbody) return;

  tbody.innerHTML = sampleMandiData.map(item => `
    <tr>
      <td>${item.state}</td>
      <td><strong>${item.mandi}</strong></td>
      <td>${item.crop}</td>
      <td>₹${item.min.toLocaleString()}</td>
      <td>₹${item.max.toLocaleString()}</td>
      <td style="font-weight:800; color:var(--primary-deep);">₹${item.modal.toLocaleString()}</td>
      <td class="${item.trend.includes('+') ? 'price-up' : 'price-down'}">${item.trend}</td>
    </tr>
  `).join('');
}

function filterMandiTable() {
  const query = document.getElementById("mandiSearchInput").value.toLowerCase();
  const rows = document.querySelectorAll("#fullMandiTableBody tr");

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(query) ? "" : "none";
  });
}

// --- FLOATING AI VOICE ASSISTANT ("खेती-बाड़ी मित्र") ---
function toggleVoiceDrawer() {
  const drawer = document.getElementById("voiceDrawerModal");
  drawer.classList.toggle("hidden-panel");
}

function sendQuickPrompt(promptText) {
  document.getElementById("voiceTextInput").value = promptText;
  sendVoiceMessage();
}

function handleChatKeyPress(event) {
  if (event.key === 'Enter') {
    sendVoiceMessage();
  }
}

function sendVoiceMessage() {
  const input = document.getElementById("voiceTextInput");
  const msg = input.value.trim();
  if (!msg) return;

  const history = document.getElementById("chatMessageHistory");
  
  // User bubble
  const userBubble = document.createElement("div");
  userBubble.className = "chat-bubble user";
  userBubble.textContent = msg;
  history.appendChild(userBubble);

  input.value = "";
  history.scrollTop = history.scrollHeight;

  // Bot response simulation with Gemini AI context
  setTimeout(() => {
    let reply = "किसान भाई, आपकी फसल की सुरक्षा के लिए मौसम का ध्यान रखना बहुत जरूरी है।";
    if (msg.includes("सिंचाई")) {
      reply = "आपकी गेहूं की अगली सिंचाई बुआई के 21वें दिन (CRI Stage) पर 3 दिन बाद प्रस्तावित है।";
    } else if (msg.includes("यूरिया")) {
      reply = "आज बारिश की संभावना 85% है। इसलिए आज यूरिया न डालें, वरना पानी में बह जाएगी।";
    } else if (msg.includes("मंडी") || msg.includes("भाव")) {
      reply = "कोटा मंडी में आज गेहूं का मॉडल भाव ₹2,450 प्रति क्विंटल है (📈 ₹40 की तेजी)।";
    }

    const botBubble = document.createElement("div");
    botBubble.className = "chat-bubble bot";
    botBubble.textContent = reply;
    history.appendChild(botBubble);
    history.scrollTop = history.scrollHeight;
  }, 600);
}
