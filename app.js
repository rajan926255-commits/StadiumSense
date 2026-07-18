/* ─────────────────────────────────────────────────────────
   StadiumSense — app.js
   Navigation, Gemini AI integration, Web Speech API, data
   Desktop layout support + all new features
   ───────────────────────────────────────────────────────── */

'use strict';

// ═══════════════════════════════════════════════════════
// GEMINI API
// ═══════════════════════════════════════════════════════
const API_KEY = sessionStorage.getItem('gemini_key') || '';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=';

async function callGeminiAI(userMessage, zoneData) {
  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const systemContext =
`You are StadiumSense AI Co-Pilot, an intelligent assistant for FIFA World Cup volunteers.

CURRENT STADIUM STATUS:
- Zone A: ${zoneData.A.pct}% capacity (${zoneData.A.status}) - ${zoneData.A.fans.toLocaleString()} fans
- Zone B: ${zoneData.B.pct}% capacity (${zoneData.B.status}) - ${zoneData.B.fans.toLocaleString()} fans
- Zone C: ${zoneData.C.pct}% capacity (${zoneData.C.status}) - ${zoneData.C.fans.toLocaleString()} fans ⚠️
- Zone D: ${zoneData.D.pct}% capacity (${zoneData.D.status}) - ${zoneData.D.fans.toLocaleString()} fans
- Zone E: ${zoneData.E.pct}% capacity (${zoneData.E.status}) - ${zoneData.E.fans.toLocaleString()} fans
- Zone F: ${zoneData.F.pct}% capacity (${zoneData.F.status}) - ${zoneData.F.fans.toLocaleString()} fans
- Total Fans: 67,432 | Active Volunteers: 248
- Match: #47 | Time: ${now}

ACTIVE INCIDENTS:
- Crowd Surge at Gate C2 (ACTIVE)
- Lost Child at Zone D Row 7 (IN PROGRESS)
- Medical Emergency Zone E Row 22 (ACTIVE)

YOUR RESPONSE RULES:
1. ALWAYS open with a status emoji line: 🔴 Critical / 🟡 Moderate / 🟢 Safe — pick whichever matches the most relevant zone.
2. Write an **Analysis** section using "Based on..." or "Historical patterns show..." reasoning. Explain WHY.
3. Give numbered **Recommended Actions** — clear, specific, actionable steps.
4. Give **Announcement Scripts** in at least 3 languages: English 🇬🇧, Spanish 🇪🇸, Hindi 🇮🇳, French 🇫🇷.
5. Keep responses concise but detailed — think like an experienced stadium operations manager with 10 years experience.
6. Use markdown: **bold** for key terms, numbered lists for actions, plain lines for paragraphs.`;

  const activeKey = sessionStorage.getItem('gemini_key') || API_KEY;
  const apiUrl = `${GEMINI_API_BASE}${activeKey}`;

  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: systemContext + '\n\nVolunteer Query: ' + userMessage }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
    })
  });
  if (!resp.ok) throw new Error(`Gemini API ${resp.status}`);
  const data = await resp.json();
  return data.candidates[0].content.parts[0].text;
}

// ═══════════════════════════════════════════════════════
// MARKDOWN → STYLED CARD HTML RENDERER
// ═══════════════════════════════════════════════════════
function renderMarkdownToHtml(raw) {
  const lines = raw.split('\n');
  let out = '';
  let inNumberedList = false;
  let inBulletList  = false;
  let inAnnouncement = false;
  const announcementLines = [];

  const flushAnnouncements = () => {
    if (announcementLines.length === 0) return;
    out += `<div class="ai-section announcements-section">
      <p class="ai-section-title">📢 Announcement Scripts Ready</p>
      <div class="announcement-list">${announcementLines.join('')}</div>
    </div>`;
    announcementLines.length = 0;
    inAnnouncement = false;
  };

  const closeList = () => {
    if (inNumberedList) { out += '</div>'; inNumberedList = false; }
    if (inBulletList)   { out += '</div>'; inBulletList   = false; }
  };

  const renderInline = (t) =>
    t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
     .replace(/\*(.+?)\*/g, '<em>$1</em>');

  const FLAG_RE = /^(\p{Regional_Indicator}\p{Regional_Indicator}|🇬🇧|🇪🇸|🇫🇷|🇮🇳|🇸🇦|🇧🇷|🇩🇪|🇨🇳|🇯🇵)\s/u;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (/^###\s/.test(line)) {
      flushAnnouncements(); closeList();
      out += `<div class="ai-section"><p class="ai-section-title">${renderInline(line.slice(4))}</p>`;
      continue;
    }
    if (/^##\s/.test(line)) {
      flushAnnouncements(); closeList();
      out += `<div class="ai-section"><p class="ai-section-title" style="font-size:12px">${renderInline(line.slice(3))}</p>`;
      continue;
    }

    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      flushAnnouncements();
      if (!inNumberedList) {
        closeList();
        out += '<div class="ai-section"><div style="display:flex;flex-direction:column;gap:6px">';
        inNumberedList = true;
      }
      out += `<div class="action-item"><span class="action-num">${numMatch[1]}</span><p>${renderInline(numMatch[2])}</p></div>`;
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)/);
    if (bulletMatch) {
      flushAnnouncements();
      if (!inBulletList) {
        closeList();
        out += '<div class="ai-section"><div style="display:flex;flex-direction:column;gap:4px">';
        inBulletList = true;
      }
      out += `<p class="ai-body-text" style="padding-left:10px">• ${renderInline(bulletMatch[1])}</p>`;
      continue;
    }

    if (FLAG_RE.test(line)) {
      closeList();
      inAnnouncement = true;
      const flagMatch = line.match(FLAG_RE);
      const rest = line.slice(flagMatch[0].length);
      announcementLines.push(
        `<div class="announcement-item"><span class="lang-flag">${flagMatch[1]}</span><p>${renderInline(rest)}</p></div>`
      );
      continue;
    }

    if (line.trim() === '') {
      if (inAnnouncement) flushAnnouncements();
      closeList();
      continue;
    }

    if (inAnnouncement) flushAnnouncements();
    closeList();
    out += `<div class="ai-section"><p class="ai-body-text">${renderInline(line.trim())}</p></div>`;
  }

  flushAnnouncements();
  closeList();

  return out || `<div class="ai-section"><p class="ai-body-text">${renderInline(raw)}</p></div>`;
}

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
const state = {
  currentTab: 'dashboard',
  micActive: false,
  reportMicActive: false,
  alertDismissed: false,
  selectedZone: null,
  liveDataInterval: null,
  criticalModalShown: false,
  clockInterval: null,
  matchMinute: 67,
  zones: {
    A: { pct: 45, color: 'green', status: 'SAFE', fans: 30344, rec: 'Zone A is at comfortable capacity. No action required. Good option for redirecting fans from Zone C.' },
    B: { pct: 62, color: 'yellow', status: 'MODERATE', fans: 41808, rec: 'Zone B is at moderate capacity. Monitor for the next 15 minutes. Prepare overflow protocol.' },
    C: { pct: 87, color: 'red', status: 'CRITICAL', fans: 58666, rec: 'Redirect fans to Zone A and Zone D immediately. Deploy 2 volunteers to Gate C2. Critical action needed.' },
    D: { pct: 34, color: 'green', status: 'SAFE', fans: 22927, rec: 'Zone D is well within capacity. Excellent redirect destination. Volunteers can guide fans from Zone C here.' },
    E: { pct: 71, color: 'yellow', status: 'MODERATE', fans: 47877, rec: 'Zone E is moderately busy. Do not redirect additional fans here. Continue monitoring.' },
    F: { pct: 28, color: 'green', status: 'SAFE', fans: 18881, rec: 'Zone F has ample space. Can absorb up to 2,000 more fans without reaching moderate levels.' },
  }
};

// Incident detail data for the log detail panel
const incidentDetails = {
  'crowd-surge': {
    type: 'Crowd Surge',
    status: '🔴 Active',
    statusClass: 'status-active',
    location: 'Gate C2 — Zone C',
    time: '20:41',
    desc: 'High density crowd pushing toward Gate C2. Risk of surge event. Situation requires immediate intervention to prevent crowd crush.',
    ai: 'Deploy crowd barriers immediately to Gate C2. Dispatch 3 volunteers to manage flow. Redirect incoming fans to Zone A and D via PA announcement. Estimated time to safe levels: 6 minutes.'
  },
  'lost-fan': {
    type: 'Lost Fan',
    status: '🟡 In Progress',
    statusClass: 'status-progress',
    location: 'Zone D — Row 7',
    time: '20:38',
    desc: 'Child separated from guardian. Last seen near Gate D3. Guardian is at Zone D information booth.',
    ai: 'PA announcement has been generated in English, Spanish, French, and Hindi. Security team notified. Child description broadcast on all internal channels. Estimated reunion time: 8 minutes.'
  },
  'medical-e': {
    type: 'Medical',
    status: '🔴 Active',
    statusClass: 'status-active',
    location: 'Zone E — Row 22, Seat 14',
    time: '20:35',
    desc: 'Fan reported feeling unwell. Medical team en route. Symptoms: dizziness, shortness of breath.',
    ai: 'Medical team ETA 2 min. Clear access path on Row 22. Request nearby volunteers to create space. Cooling station is 40m east of Gate E2.'
  },
  'heat-exhaustion': {
    type: 'Medical',
    status: '✅ Resolved',
    statusClass: 'status-resolved',
    location: 'Zone B — Row 14',
    time: '20:12',
    desc: 'Fan with heat exhaustion. Treated and escorted to cooling station. Situation fully resolved.',
    ai: 'Resolved successfully in 8 minutes. AI prediction accuracy: 94%. The fan was treated with cooling measures and is now stable. No further action required.'
  },
  'access-issue': {
    type: 'Access Issue',
    status: '✅ Resolved',
    statusClass: 'status-resolved',
    location: 'Gate A1 — North Entrance',
    time: '19:58',
    desc: 'Ticket scanner offline. Manual check-in performed for 47 fans. Scanner has been repaired.',
    ai: 'Resolved in 14 minutes. Scanner back online and operational. 47 fans successfully checked in manually. No fan complaints recorded.'
  }
};


// ═══════════════════════════════════════════════════════
// LIVE CLOCK
// ═══════════════════════════════════════════════════════
function startLiveClock() {
  const headerTime = document.getElementById('headerTime');
  if (!headerTime) return;

  function update() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    headerTime.textContent = `${h}:${m}:${s}`;
  }

  update();
  state.clockInterval = setInterval(update, 1000);
}

// Tick match minute slowly
function startMatchClock() {
  setInterval(() => {
    const el = document.getElementById('matchMinute');
    if (el && state.matchMinute < 90) {
      state.matchMinute = Math.min(90, state.matchMinute + 1);
      el.textContent = `${state.matchMinute}' MIN`;
    }
  }, 60000);
}


// ═══════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════
function switchTab(tab) {
  if (state.currentTab === tab) return;

  const prevScreen = document.getElementById(`screen-${state.currentTab}`);
  const nextScreen = document.getElementById(`screen-${tab}`);

  if (!prevScreen || !nextScreen) return;

  // Mobile nav buttons
  const prevNav = document.getElementById(`nav-${state.currentTab}`);
  const nextNav = document.getElementById(`nav-${tab}`);
  prevNav?.classList.remove('active');
  nextNav?.classList.add('active');

  // Desktop sidebar buttons
  const prevSidebar = document.getElementById(`sidebar-${state.currentTab}`);
  const nextSidebar = document.getElementById(`sidebar-${tab}`);
  prevSidebar?.classList.remove('active');
  nextSidebar?.classList.add('active');

  // Smooth fade transition
  prevScreen.classList.remove('active');
  nextScreen.classList.add('active');

  state.currentTab = tab;

  // Scroll chat to bottom when switching to AI
  if (tab === 'ai') {
    setTimeout(() => {
      const chatWindow = document.getElementById('chatWindow');
      if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
    }, 350);
    updateContextPanel();
  }

  // Update zone chip labels when switching to AI
  if (tab === 'ai') updateZoneChips();
}


// ═══════════════════════════════════════════════════════
// ALERT BANNER
// ═══════════════════════════════════════════════════════
function dismissAlert() {
  const banner = document.getElementById('alertBanner');
  if (!banner) return;
  banner.style.transition = 'height 0.3s ease, opacity 0.3s ease';
  banner.style.opacity = '0';
  banner.style.height = '0';
  banner.style.overflow = 'hidden';
  state.alertDismissed = true;

  document.documentElement.style.setProperty('--alert-height', '0px');
  setTimeout(() => { banner.style.display = 'none'; }, 300);
}


// ═══════════════════════════════════════════════════════
// ZONE POPUP (Map Screen)
// ═══════════════════════════════════════════════════════
function showZonePopup(zone) {
  const popup = document.getElementById('zonePopup');
  const z = state.zones[zone];
  if (!popup || !z) return;

  state.selectedZone = zone;

  document.getElementById('popupZoneName').textContent = `Zone ${zone}`;
  document.getElementById('popupPct').textContent = `${Math.round(z.pct)}%`;

  const statusEl = document.getElementById('popupStatus');
  statusEl.textContent = z.status;
  statusEl.style.background = z.color === 'red' ? 'rgba(255,68,68,0.15)'
    : z.color === 'yellow' ? 'rgba(255,214,0,0.15)' : 'rgba(0,255,136,0.15)';
  statusEl.style.color = z.color === 'red' ? 'var(--red)'
    : z.color === 'yellow' ? 'var(--yellow)' : 'var(--green)';
  statusEl.style.padding = '3px 8px';
  statusEl.style.borderRadius = '6px';

  document.getElementById('popupPct').style.color = z.color === 'red' ? 'var(--red)'
    : z.color === 'yellow' ? 'var(--yellow)' : 'var(--green)';
  document.getElementById('popupDetail').textContent = `${z.fans.toLocaleString()} fans • ${z.status === 'CRITICAL' ? '⚠️ Near Limit' : 'Normal capacity'}`;
  document.getElementById('popupRecText').textContent = z.rec;

  popup.classList.add('visible');

  // On desktop, also update the right panel
  updateMapDetailPanel(zone);
}

function closeZonePopup() {
  const popup = document.getElementById('zonePopup');
  if (popup) popup.classList.remove('visible');
  state.selectedZone = null;
}

document.addEventListener('click', (e) => {
  const popup = document.getElementById('zonePopup');
  if (popup && popup.classList.contains('visible') && !popup.contains(e.target) && !e.target.closest('.map-zone')) {
    closeZonePopup();
  }
});


// ═══════════════════════════════════════════════════════
// MAP DETAIL PANEL (Desktop right panel)
// ═══════════════════════════════════════════════════════
function updateMapDetailPanel(zone) {
  const placeholder = document.getElementById('mapDetailPlaceholder');
  const content = document.getElementById('mapDetailContent');
  if (!placeholder || !content) return;

  const z = state.zones[zone];
  if (!z) return;

  placeholder.classList.add('hidden');
  content.classList.remove('hidden');

  const colorVar = z.color === 'red' ? 'var(--red)' : z.color === 'yellow' ? 'var(--yellow)' : 'var(--green)';
  const barColor = z.color === 'red'
    ? 'linear-gradient(90deg, var(--red), #FF6666)'
    : z.color === 'yellow'
    ? 'linear-gradient(90deg, var(--yellow), #FFE033)'
    : 'linear-gradient(90deg, var(--green), #33FF99)';

  document.getElementById('mapDetailZoneName').textContent = `Zone ${zone}`;
  const pctEl = document.getElementById('mapDetailPct');
  pctEl.textContent = `${Math.round(z.pct)}%`;
  pctEl.style.color = colorVar;

  const statusEl = document.getElementById('mapDetailStatus');
  statusEl.textContent = z.status;
  statusEl.style.background = z.color === 'red' ? 'rgba(255,68,68,0.15)' : z.color === 'yellow' ? 'rgba(255,214,0,0.15)' : 'rgba(0,255,136,0.15)';
  statusEl.style.color = colorVar;

  document.getElementById('mapDetailFans').textContent = `${z.fans.toLocaleString()} fans`;

  const capBar = document.getElementById('mapDetailCapBar');
  if (capBar) { capBar.style.width = `${z.pct}%`; capBar.style.background = barColor; }

  document.getElementById('mapDetailRecText').textContent = z.rec;
}


// ═══════════════════════════════════════════════════════
// ZONE POPUP (Dashboard zones → switch to map)
// ═══════════════════════════════════════════════════════
function selectZone(zone) {
  switchTab('map');
  setTimeout(() => showZonePopup(zone), 400);
}


// ═══════════════════════════════════════════════════════
// INCIDENT LOG: Select Incident Detail (Desktop)
// ═══════════════════════════════════════════════════════
function selectIncident(cardEl, incidentId) {
  // Remove selected class from all cards
  document.querySelectorAll('.incident-card').forEach(c => c.classList.remove('selected'));
  cardEl.classList.add('selected');

  // Mobile: expand inline
  cardEl.classList.toggle('expanded');

  // Desktop: update right panel
  const placeholder = document.getElementById('logDetailPlaceholder');
  const content = document.getElementById('logDetailContent');
  if (!placeholder || !content) return;

  const detail = incidentDetails[incidentId];
  if (!detail) return;

  placeholder.classList.add('hidden');
  content.classList.remove('hidden');

  document.getElementById('logDetailType').textContent = detail.type;
  const statusBadge = document.getElementById('logDetailStatusBadge');
  statusBadge.textContent = detail.status;
  statusBadge.className = `log-detail-status-badge ${detail.statusClass}`;
  document.getElementById('logDetailLocation').textContent = detail.location;
  document.getElementById('logDetailTime').textContent = `Reported: ${detail.time}`;
  document.getElementById('logDetailDesc').textContent = detail.desc;
  document.getElementById('logDetailAiAction').textContent = detail.ai;
}


// ═══════════════════════════════════════════════════════
// CRITICAL ZONE C MODAL
// ═══════════════════════════════════════════════════════
function showCriticalModal(pct) {
  const modal = document.getElementById('criticalModal');
  if (!modal) return;

  document.getElementById('criticalModalPct').textContent = `${Math.round(pct)}%`;
  modal.style.display = 'flex';

  // Apply red border glow to body
  document.body.classList.add('critical-glow');

  // Speed up the alert banner flash
  const banner = document.getElementById('alertBanner');
  if (banner) banner.classList.add('fast-flash');
}

function dismissCriticalModal() {
  const modal = document.getElementById('criticalModal');
  if (modal) modal.style.display = 'none';

  document.body.classList.remove('critical-glow');

  // Slow banner back down
  const banner = document.getElementById('alertBanner');
  if (banner) banner.classList.remove('fast-flash');
}

function checkCriticalThreshold() {
  const zoneCPct = state.zones.C.pct;

  // Show modal once if Zone C reaches 90%
  if (zoneCPct >= 90 && !state.criticalModalShown) {
    state.criticalModalShown = true;
    setTimeout(() => showCriticalModal(zoneCPct), 500);
  }

  // If Zone C drops below 88%, allow the modal to show again
  if (zoneCPct < 88) {
    state.criticalModalShown = false;
    document.body.classList.remove('critical-glow');
    const banner = document.getElementById('alertBanner');
    if (banner) banner.classList.remove('fast-flash');
  }
}


// ═══════════════════════════════════════════════════════
// ZONE CHIPS — AI Screen
// ═══════════════════════════════════════════════════════
function updateZoneChips() {
  const chips = document.querySelectorAll('.zone-chip');
  const zoneKeys = ['A', 'B', 'C', 'D', 'E', 'F'];

  chips.forEach((chip, i) => {
    const key = zoneKeys[i];
    if (!key) return;
    const z = state.zones[key];
    if (!z) return;
    const emoji = z.color === 'red' ? '🔴' : z.color === 'yellow' ? '🟡' : '🟢';
    chip.textContent = `Zone ${key} ${Math.round(z.pct)}% ${emoji}`;
    // Update color class
    chip.className = 'zone-chip ' + (z.color === 'red' ? 'zone-chip-red' : z.color === 'yellow' ? 'zone-chip-yellow' : 'zone-chip-green');
  });
}

function sendZoneChipQuery(zone) {
  const z = state.zones[zone];
  if (!z) return;
  const query = `Zone ${zone} situation update? Current capacity: ${Math.round(z.pct)}% (${z.status})`;
  const input = document.getElementById('chatInput');
  if (input) input.value = query;
  sendMessage();
}


// ═══════════════════════════════════════════════════════
// AI CONTEXT PANEL — Desktop right panel updates
// ═══════════════════════════════════════════════════════
function updateContextPanel() {
  const list = document.getElementById('contextZoneList');
  if (!list) return;

  const zoneKeys = ['A', 'B', 'C', 'D', 'E', 'F'];
  const cards = list.querySelectorAll('.context-zone-card');

  cards.forEach((card, i) => {
    const key = zoneKeys[i];
    if (!key) return;
    const z = state.zones[key];
    if (!z) return;

    const pct = Math.round(z.pct);
    const nameEl = card.querySelector('.context-zone-name');
    const barEl = card.querySelector('.context-zone-bar');
    const pctEl = card.querySelector('.context-zone-pct');

    if (pctEl) {
      pctEl.textContent = `${pct}%`;
      pctEl.className = 'context-zone-pct ' + (z.color === 'red' ? 'red-text' : z.color === 'yellow' ? 'yellow-text' : 'green-text');
    }
    if (barEl) {
      barEl.style.width = `${pct}%`;
      barEl.className = 'context-zone-bar ' + (z.color === 'red' ? 'red-bar' : z.color === 'yellow' ? 'yellow-bar' : 'green-bar');
    }
    if (card) {
      card.className = 'context-zone-card ' + (z.color === 'red' ? 'red-border' : z.color === 'yellow' ? 'yellow-border' : 'green-border');
      if (key === 'C' && z.pct >= 80) card.classList.add('context-zone-highlight');
    }
  });
}


// ═══════════════════════════════════════════════════════
// SIDEBAR STATS UPDATE
// ═══════════════════════════════════════════════════════
function updateSidebarStats() {
  const total = Object.values(state.zones).reduce((s, z) => s + z.fans, 0);
  const fansEl = document.getElementById('sidebarFans');
  if (fansEl) fansEl.textContent = total.toLocaleString();
}


// ═══════════════════════════════════════════════════════
// MIC TOGGLE (AI Screen) — Web Speech API
// ═══════════════════════════════════════════════════════
let speechRecognition = null;
let silenceTimer = null;

function toggleMic() {
  const micBtn   = document.getElementById('micBtn');
  const micLabel = document.getElementById('micLabel');

  if (state.micActive) {
    stopListening();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('⚠️ Voice not supported in this browser — type your query');
    document.getElementById('chatInput')?.focus();
    return;
  }

  state.micActive = true;
  micBtn.classList.add('active');
  micLabel.textContent = '🔴 Listening...';
  showToast('🎤 Speak now — AI is listening');

  const langMap = { es: 'es-ES', fr: 'fr-FR', hi: 'hi-IN', ar: 'ar-SA', pt: 'pt-BR', en: 'en-US' };
  const uiLang  = document.getElementById('langSelect')?.value || 'en';

  speechRecognition = new SpeechRecognition();
  speechRecognition.continuous      = true;
  speechRecognition.interimResults  = true;
  speechRecognition.lang            = langMap[uiLang] || 'en-US';

  const chatInput = document.getElementById('chatInput');
  let finalTranscript = '';

  speechRecognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i].transcript;
      if (event.results[i].isFinal) finalTranscript += t;
      else interim += t;
    }
    if (chatInput) chatInput.value = finalTranscript + interim;

    clearTimeout(silenceTimer);
    if (finalTranscript.trim()) {
      silenceTimer = setTimeout(() => {
        stopListening();
        if (chatInput?.value.trim()) {
          showToast('✅ Voice captured — sending to AI...');
          setTimeout(sendMessage, 300);
        }
      }, 2000);
    }
  };

  speechRecognition.onerror = (e) => {
    const msg = e.error === 'not-allowed'
      ? '⚠️ Microphone access denied — check browser permissions'
      : '⚠️ Voice recognition error — please type your query';
    showToast(msg, 3500);
    stopListening();
  };

  speechRecognition.onend = () => { if (state.micActive) stopListening(); };
  speechRecognition.start();
}

function stopListening() {
  state.micActive = false;
  const micBtn   = document.getElementById('micBtn');
  const micLabel = document.getElementById('micLabel');
  micBtn?.classList.remove('active');
  if (micLabel) micLabel.textContent = 'Tap to Speak';
  clearTimeout(silenceTimer);
  try { speechRecognition?.stop(); } catch (_) {}
  speechRecognition = null;
}


// ═══════════════════════════════════════════════════════
// MIC TOGGLE (Incident Log)
// ═══════════════════════════════════════════════════════
function toggleReportMic() {
  const btn = document.getElementById('reportVoiceBtn');
  const label = document.getElementById('reportMicLabel');
  state.reportMicActive = !state.reportMicActive;

  if (state.reportMicActive) {
    btn.classList.add('recording');
    label.textContent = '🔴 Recording...';
    showToast('Reporting incident — speak clearly');

    setTimeout(() => {
      if (state.reportMicActive) {
        btn.classList.remove('recording');
        label.textContent = '🎤 Report Incident';
        state.reportMicActive = false;
        addNewIncident();
        showToast('✅ Incident reported and logged');
      }
    }, 3000);
  } else {
    btn.classList.remove('recording');
    label.textContent = '🎤 Report Incident';
  }
}


// ═══════════════════════════════════════════════════════
// ADD NEW INCIDENT (Demo)
// ═══════════════════════════════════════════════════════
function addNewIncident() {
  const list = document.getElementById('incidentsList');
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const card = document.createElement('div');
  card.className = 'incident-card glass-card progress-incident';
  card.dataset.status = 'progress';
  const newId = 'new-' + Date.now();
  card.onclick = function() { selectIncident(this, newId); };
  card.style.animation = 'cardReveal 0.4s cubic-bezier(0.4,0,0.2,1)';
  card.innerHTML = `
    <div class="inc-left">
      <div class="inc-type-icon lost-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
    </div>
    <div class="inc-body">
      <div class="inc-title-row">
        <span class="inc-type">Safety Concern</span>
        <span class="inc-status-badge status-progress">🟡 In Progress</span>
      </div>
      <p class="inc-location">Zone A — Gate A1</p>
      <p class="inc-desc">Unattended item reported near Gate A1. Security notified.</p>
      <div class="inc-ai-rec">
        <span class="rec-icon">🤖</span>
        <span>AI: Security dispatch triggered. ETA 90 seconds.</span>
      </div>
    </div>
    <div class="inc-meta">
      <span class="inc-time">${timeStr}</span>
      <span class="inc-zone-tag zone-tag-yellow">Zone A</span>
    </div>
  `;

  // Register new incident detail
  incidentDetails[newId] = {
    type: 'Safety Concern',
    status: '🟡 In Progress',
    statusClass: 'status-progress',
    location: 'Zone A — Gate A1',
    time: timeStr,
    desc: 'Unattended item reported near Gate A1. Security notified and en route.',
    ai: 'Security dispatch triggered. ETA 90 seconds. Clear immediate area around item. Do not touch until security arrives.'
  };

  list.insertBefore(card, list.firstChild);
}


// ═══════════════════════════════════════════════════════
// FILTER INCIDENTS
// ═══════════════════════════════════════════════════════
function filterIncidents(filter, btn) {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  const cards = document.querySelectorAll('.incident-card');
  cards.forEach(card => {
    const status = card.dataset.status;
    if (filter === 'all') {
      card.classList.remove('hidden');
    } else {
      if (status === filter) card.classList.remove('hidden');
      else card.classList.add('hidden');
    }
  });
}


// ═══════════════════════════════════════════════════════
// COPY ANNOUNCEMENT TEXT
// ═══════════════════════════════════════════════════════
function copyText(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✓ Copied';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = '✓ Copied';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  });
}


// ═══════════════════════════════════════════════════════
// SEND CHAT MESSAGE — routes to Gemini API with fallback
// ═══════════════════════════════════════════════════════
let isAIThinking = false;

function sendMessage() {
  if (isAIThinking) {
    showToast('⏳ AI is still thinking — please wait');
    return;
  }
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  addUserMessage(text);
  dispatchToAI(text);
}

function sendQuickPrompt(text) {
  if (isAIThinking) return;
  const input = document.getElementById('chatInput');
  if (input) input.value = text;
  sendMessage();
}

function addUserMessage(text) {
  const chatWindow = document.getElementById('chatWindow');
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const row = document.createElement('div');
  row.className = 'chat-row volunteer-row';
  row.innerHTML = `
    <div class="vol-avatar">V</div>
    <div class="chat-bubble vol-bubble">
      <span class="bubble-sender">Volunteer</span>
      <p>${escapeHtml(text)}</p>
      <span class="bubble-time">${timeStr}</span>
    </div>
  `;
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function dispatchToAI(query) {
  isAIThinking = true;
  const t0          = Date.now();
  const indicator   = document.getElementById('typingIndicator');
  const chatWindow  = document.getElementById('chatWindow');
  const sendBtn     = document.querySelector('.send-btn');
  const micBtn      = document.getElementById('micBtn');
  const analyzeLabel = document.getElementById('typingAnalyzingLabel');

  if (analyzeLabel) analyzeLabel.textContent = 'AI Co-Pilot analyzing...';
  if (sendBtn) sendBtn.style.opacity = '0.35';
  if (micBtn)  micBtn.style.pointerEvents = 'none';

  indicator.classList.remove('hidden');
  chatWindow.scrollTop = chatWindow.scrollHeight;

  let rawText   = null;
  let usedLive  = false;

  try {
    rawText  = await callGeminiAI(query, state.zones);
    usedLive = true;
  } catch (err) {
    console.warn('[StadiumSense] Gemini API unavailable — using local fallback:', err.message);
  }

  indicator.classList.add('hidden');

  if (sendBtn) sendBtn.style.opacity = '';
  if (micBtn)  micBtn.style.pointerEvents = '';

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  if (usedLive && rawText) {
    addAIMessage({ content: renderMarkdownToHtml(rawText), time: timeStr, elapsed, source: 'gemini' }, query);
  } else {
    const offlineBanner =
      `<div class="ai-section" style="background:rgba(255,160,0,0.06);border:1px solid rgba(255,160,0,0.2);border-radius:8px">
         <p style="font-size:10px;color:#FFB347;font-weight:700;margin:0">
           ⚠️ AI temporarily offline — using cached data for Zone recommendations
         </p>
       </div>`;
    const local = generateAIResponse(query);
    local.content  = offlineBanner + local.content;
    local.elapsed  = elapsed;
    local.time     = timeStr;
    addAIMessage(local, query);
  }

  isAIThinking = false;
}


function generateAIResponse(query) {
  const q = query.toLowerCase();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  if (q.includes('zone') && (q.includes('all') || q.includes('status') || q.includes('update'))) {
    return {
      type: 'zones-summary', time: timeStr,
      content: `
        <div class="ai-section">
          <p class="ai-section-title">📊 Live Zone Status Summary</p>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${Object.entries(state.zones).map(([z, d]) =>
              `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:rgba(255,255,255,0.03);border-radius:6px">
                <span style="font-size:12px;font-weight:700">Zone ${z}</span>
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="width:60px;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden">
                    <div style="height:100%;width:${d.pct}%;background:${d.color==='red'?'#FF4444':d.color==='yellow'?'#FFD600':'#00FF88'};border-radius:2px"></div>
                  </div>
                  <span style="font-size:12px;font-weight:700;color:${d.color==='red'?'#FF4444':d.color==='yellow'?'#FFD600':'#00FF88'}">${Math.round(d.pct)}%</span>
                  <span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${d.color==='red'?'rgba(255,68,68,0.12)':d.color==='yellow'?'rgba(255,214,0,0.12)':'rgba(0,255,136,0.12)'};color:${d.color==='red'?'#FF4444':d.color==='yellow'?'#FFD600':'#00FF88'}">${d.status}</span>
                </div>
              </div>`
            ).join('')}
          </div>
        </div>
        <div class="ai-section">
          <p class="ai-section-title">🎯 Priority Action</p>
          <p class="ai-body-text">Focus on <strong>Zone C</strong> immediately. All other zones are within safe operational parameters. Recommend activating overflow protocol for Zone C within the next 2 minutes.</p>
        </div>
      `
    };
  }

  if (q.includes('evacuat')) {
    return {
      type: 'evacuation', time: timeStr,
      content: `
        <div class="ai-section">
          <p class="ai-section-title">🚨 Evacuation Routes</p>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div class="action-item"><span class="action-num">1</span><p><strong>North Exit (Gate A1, A2)</strong> — Current flow: 340/min. Capacity: 600/min. Status: Available</p></div>
            <div class="action-item"><span class="action-num">2</span><p><strong>East Exit (Gate B1, B2)</strong> — Current flow: 280/min. Capacity: 600/min. Status: Available</p></div>
            <div class="action-item"><span class="action-num">3</span><p><strong>South Exit (Gate C1, C2)</strong> — Current flow: 520/min. Capacity: 600/min. Status: ⚠️ Near Limit</p></div>
            <div class="action-item"><span class="action-num">4</span><p><strong>West Exit (Gate D1, D2)</strong> — Current flow: 180/min. Capacity: 600/min. Status: ✅ Optimal</p></div>
          </div>
        </div>
        <div class="ai-section" style="background:rgba(0,255,136,0.04)">
          <p class="ai-section-title">✅ Recommendation</p>
          <p class="ai-body-text">Direct Zone C fans to <strong>West (Gate D)</strong> and <strong>North (Gate A)</strong> exits. Estimated full stadium evacuation time: <strong>8.5 minutes</strong>.</p>
        </div>
      `
    };
  }

  if (q.includes('medical') || q.includes('health')) {
    return {
      type: 'medical', time: timeStr,
      content: `
        <div class="ai-section">
          <p class="ai-section-title">🏥 Medical Team Status</p>
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(0,255,136,0.05);border-radius:6px;border:1px solid rgba(0,255,136,0.1)">
              <span style="font-size:12px">Team Alpha (Zone A-B)</span>
              <span style="font-size:10px;color:#00FF88;font-weight:700">✅ Available</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(255,214,0,0.05);border-radius:6px;border:1px solid rgba(255,214,0,0.1)">
              <span style="font-size:12px">Team Beta (Zone C-D)</span>
              <span style="font-size:10px;color:#FFD600;font-weight:700">🟡 En Route Zone E</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(0,255,136,0.05);border-radius:6px;border:1px solid rgba(0,255,136,0.1)">
              <span style="font-size:12px">Team Gamma (Zone E-F)</span>
              <span style="font-size:10px;color:#00FF88;font-weight:700">✅ Available</span>
            </div>
          </div>
        </div>
        <div class="ai-section">
          <p class="ai-section-title">📊 Medical Incidents Today</p>
          <p class="ai-body-text">3 incidents handled — 1 active, 2 resolved. Average response time: <strong>4.2 minutes</strong>. Heat exhaustion is primary concern (32°C ambient temp).</p>
        </div>
      `
    };
  }

  if (q.includes('forecast') || q.includes('predict') || q.includes('30 min')) {
    return {
      type: 'forecast', time: timeStr,
      content: `
        <div class="ai-section">
          <p class="ai-section-title">📈 30-Minute Crowd Forecast</p>
          <p class="ai-body-text" style="margin-bottom:8px">Based on historical match patterns (HT + 15 min wave), entry patterns, and current velocity:</p>
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:11px;color:var(--text-secondary)">Zone A (now ${Math.round(state.zones.A.pct)}%)</span><span style="font-size:11px;font-weight:700;color:#FFD600">→ ~${Math.round(state.zones.A.pct+13)}% in 30min</span></div>
            <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:11px;color:var(--text-secondary)">Zone B (now ${Math.round(state.zones.B.pct)}%)</span><span style="font-size:11px;font-weight:700;color:#FF4444">→ ~${Math.round(state.zones.B.pct+12)}% in 30min</span></div>
            <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:11px;color:var(--text-secondary)">Zone C (now ${Math.round(state.zones.C.pct)}%)</span><span style="font-size:11px;font-weight:700;color:#FF4444">⚠️ 100%+ without action</span></div>
            <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:11px;color:var(--text-secondary)">Zone D (now ${Math.round(state.zones.D.pct)}%)</span><span style="font-size:11px;font-weight:700;color:#00FF88">→ ~${Math.round(state.zones.D.pct+8)}% in 30min</span></div>
          </div>
          <div class="confidence-row" style="margin-top:10px">
            <span class="conf-label">Model Confidence</span>
            <div class="conf-bar"><div class="conf-fill" style="width:89%"></div></div>
            <span class="conf-pct">89%</span>
          </div>
        </div>
        <div class="ai-section" style="background:rgba(255,68,68,0.04)">
          <p class="ai-section-title">⚡ Immediate Priority</p>
          <p class="ai-body-text">Zone C will breach safe capacity in <strong>~4 minutes</strong> without intervention. Execute redirect plan immediately.</p>
        </div>
      `
    };
  }

  // Generic fallback
  return {
    type: 'generic', time: timeStr,
    content: `
      <div class="ai-section">
        <p class="ai-section-title">💬 AI Response</p>
        <p class="ai-body-text">Processing your query: <em>"${escapeHtml(query)}"</em></p>
        <p class="ai-body-text" style="margin-top:6px">Based on current stadium data, all systems are being monitored in real-time. The primary concern remains <strong>Zone C</strong> at ${Math.round(state.zones.C.pct)}% capacity. Would you like a detailed breakdown of any specific zone or operational area?</p>
      </div>
      <div class="ai-section">
        <p class="ai-section-title">🔍 Suggested Queries</p>
        <div style="display:flex;flex-direction:column;gap:4px">
          <button class="qp-btn" style="text-align:left;width:100%" onclick="sendQuickPrompt('Zone C situation update?')">→ Zone C detailed status</button>
          <button class="qp-btn" style="text-align:left;width:100%" onclick="sendQuickPrompt('Show evacuation routes')">→ Evacuation routes</button>
          <button class="qp-btn" style="text-align:left;width:100%" onclick="sendQuickPrompt('Crowd forecast next 30 minutes?')">→ 30-minute crowd forecast</button>
        </div>
      </div>
    `
  };
}

function addAIMessage(response, originalQuery = '') {
  const chatWindow  = document.getElementById('chatWindow');
  const elapsed     = response.elapsed ?? (1.2 + Math.random() * 0.8).toFixed(1);
  const sourceLabel = response.source === 'gemini' ? '✦ Gemini AI' : '✦ AI Reasoning';

  const q = (originalQuery || '').toLowerCase();
  const allChips = [
    { label: '📈 Crowd Forecast',    prompt: 'Crowd forecast next 30 minutes?',          skip: q.includes('forecast') || q.includes('predict') },
    { label: '🚨 Evacuation Routes', prompt: 'Show all evacuation routes',                skip: q.includes('evacuat') },
    { label: '🏥 Medical Status',    prompt: 'What is the current medical team status?',  skip: q.includes('medical') || q.includes('health') },
    { label: '🔴 Zone C Update',     prompt: 'Zone C situation update?',                  skip: q.includes('zone c') },
    { label: '📊 Zone Summary',      prompt: 'Give me a full status update of all zones', skip: q.includes('all zone') || q.includes('status of all') },
  ];
  const chips = allChips.filter(c => !c.skip).slice(0, 3);
  const chipsHtml = chips.map(c =>
    `<button class="qp-btn gemini-chip" onclick="sendQuickPrompt('${c.prompt}')">${c.label}</button>`
  ).join('');

  const row = document.createElement('div');
  row.className = 'chat-row ai-row';
  row.innerHTML = `
    <div class="ai-msg-avatar">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" stroke-width="2">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M8 7V4a4 4 0 0 1 8 0v3"/>
        <circle cx="9" cy="14" r="1.5" fill="#00D4FF"/>
        <circle cx="15" cy="14" r="1.5" fill="#00D4FF"/>
      </svg>
    </div>
    <div class="ai-response-card">
      <div class="ai-response-header">
        <span class="ai-response-label">AI Co-Pilot</span>
        <span class="ai-thinking-badge">${sourceLabel}</span>
      </div>
      ${response.content}
      ${chipsHtml
        ? `<div class="ai-section" style="border-top:1px solid rgba(255,255,255,0.05);padding-top:8px">
             <p class="ai-section-title" style="margin-bottom:6px">💬 Follow-up</p>
             <div class="quick-prompts" style="flex-wrap:wrap;gap:5px">${chipsHtml}</div>
           </div>`
        : ''}
      <span class="bubble-time ai-time">${response.time} • ${elapsed}s response</span>
    </div>
  `;

  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}


// ═══════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════
let toastTimer = null;

function showToast(msg, duration = 2800) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('visible'); }, duration);
}


// ═══════════════════════════════════════════════════════
// LIVE DATA SIMULATION (subtle zone % drift)
// ═══════════════════════════════════════════════════════
function startLiveDataSimulation() {
  state.liveDataInterval = setInterval(() => {
    // Drift Zone C upward, slight drift on others
    const drifts = { C: +0.5, B: +0.2, E: -0.1 };

    Object.entries(drifts).forEach(([zone, delta]) => {
      const z = state.zones[zone];
      z.pct = Math.max(0, Math.min(100, z.pct + delta + (Math.random() - 0.5) * 0.3));
      z.fans = Math.round(z.pct / 100 * 67432);

      // Update zone card meter text
      const meterPct = document.querySelector(`#zone-${zone} .meter-pct`);
      if (meterPct) meterPct.textContent = `${Math.round(z.pct)}%`;

      // Update zone status color
      if (z.pct >= 80) z.color = 'red';
      else if (z.pct >= 60) z.color = 'yellow';
      else z.color = 'green';
    });

    // Update sidebar stats
    updateSidebarStats();

    // Update context panel if on AI screen
    if (state.currentTab === 'ai') updateContextPanel();

    // Update zone chips
    updateZoneChips();

    // Check Zone C critical threshold
    checkCriticalThreshold();

  }, 5000);
}


// ═══════════════════════════════════════════════════════
// KEYBOARD NAV
// ═══════════════════════════════════════════════════════
document.querySelectorAll('.zone-card').forEach(card => {
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      card.click();
    }
  });
});

document.querySelectorAll('.map-zone').forEach(zone => {
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      zone.click();
    }
  });
});


// ═══════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════
function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}


// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

  // Animate circular meter fills on load
  setTimeout(() => {
    document.querySelectorAll('.meter-fill').forEach(fill => {
      const target = fill.style.getPropertyValue('--target-offset') || fill.getAttribute('stroke-dashoffset');
      fill.style.strokeDashoffset = 238.76;
      requestAnimationFrame(() => {
        fill.style.strokeDashoffset = target;
      });
    });
  }, 200);

  // Confidence bar animation
  setTimeout(() => {
    document.querySelectorAll('.conf-fill').forEach(bar => {
      const target = bar.style.width;
      bar.style.width = '0%';
      requestAnimationFrame(() => {
        setTimeout(() => { bar.style.width = target; }, 50);
      });
    });
  }, 500);

  // Animate summary bars on load
  setTimeout(() => {
    document.querySelectorAll('.summary-bar-fill').forEach(bar => {
      const target = bar.style.width;
      bar.style.width = '0%';
      requestAnimationFrame(() => {
        setTimeout(() => { bar.style.width = target; }, 100);
      });
    });
  }, 600);

  // Enter key → send message
  document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  // Start live simulation
  startLiveDataSimulation();

  // Start live clock
  startLiveClock();
  startMatchClock();

  // Initial zone chips update
  updateZoneChips();

  // Initial context panel update
  updateContextPanel();

  // Initial scroll to bottom in AI chat
  const chatWindow = document.getElementById('chatWindow');
  if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;

  // Check Gemini API key on load
  checkApiKeyOnLoad();

  console.log('%cStadiumSense AI Co-Pilot v2.0 — Gemini Powered', 'color:#00D4FF;font-size:16px;font-weight:bold');
  console.log('%cFIFA World Cup 2026 • Stadium Operations', 'color:#00FF88;font-size:12px');
  console.log('%c✅ Desktop Layout + All Features Active', 'color:#00FF88;font-size:11px');
});

// ═══════════════════════════════════════════════════════
// BUG FIX: DOWNLOAD SHIFT REPORT
// ═══════════════════════════════════════════════════════
function downloadShiftReport() {
  const reportContent = [
    'STADIUMSENSE \u2014 SHIFT REPORT',
    '============================',
    'Generated: ' + new Date().toLocaleString(),
    'Volunteer ID: V-2847',
    'Zone Assignment: C & D',
    'Shift: 18:00 \u2014 22:00',
    'Match: #47 \u2014 Argentina vs Egypt',
    '',
    'PERFORMANCE SUMMARY',
    '--------------------',
    'Incidents Handled : 12',
    'Fans Assisted     : 347',
    'AI Queries Used   : 28',
    'Avg Response Time : 1.2 min',
    '',
    'INCIDENTS BY ZONE',
    '------------------',
    'Zone A : 2 incidents',
    'Zone B : 1 incident',
    'Zone C : 5 incidents (CRITICAL)',
    'Zone D : 1 incident',
    'Zone E : 2 incidents',
    'Zone F : 1 incident',
    '',
    'ACTIVE INCIDENTS',
    '-----------------',
    '1. Crowd Surge \u2014 Gate C2, Zone C (ACTIVE)',
    '2. Lost Fan \u2014 Zone D, Row 7 (IN PROGRESS)',
    '3. Medical Emergency \u2014 Zone E, Row 22 (ACTIVE)',
    '',
    'RESOLVED INCIDENTS',
    '-------------------',
    '1. Medical \u2014 Zone B, Row 14 (RESOLVED)',
    '2. Access Issue \u2014 Gate A1 (RESOLVED)',
    '',
    'AI GENERATED SUMMARY',
    '---------------------',
    'Strong performance today. Zone C crowd',
    'management was efficiently handled with',
    'AI-assisted redirections. 3 medical incidents',
    'resolved within 4 minutes average. Response',
    'time 40% better than stadium average.',
    '',
    '---',
    'Powered by Gemini AI \u2022 StadiumSense v1.0',
    'FIFA World Cup 2026 \u2022 Stadium Operations'
  ].join('\n');

  const blob = new Blob([reportContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'StadiumSense_ShiftReport_V2847_' + Date.now() + '.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('\u2705 Report downloaded successfully!');
}

// ═══════════════════════════════════════════════════════
// BUG FIX: EXECUTE PLAN BUTTON
// ═══════════════════════════════════════════════════════
function executePlan(e) {
  const btn = (e && e.currentTarget) || document.querySelector('.execute-plan-btn');
  if (!btn) return;

  showToast('\ud83d\ude80 Plan executed! Dispatching to field volunteers...');

  const originalHTML = btn.innerHTML;
  btn.innerHTML = '\u23f3 Executing...';
  btn.disabled = true;
  btn.style.opacity = '0.7';

  setTimeout(function () {
    btn.innerHTML = '\u2705 Plan Executed';
    btn.style.background = '#00FF88';
    btn.style.color = '#0A0E1A';
    showToast('\u2705 Action dispatched to all Zone C volunteers!');
  }, 2000);

  setTimeout(function () {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.background = '';
    btn.style.color = '';
  }, 5000);
}

// ═══════════════════════════════════════════════════════
// API KEY MODAL FUNCTIONS
// ═══════════════════════════════════════════════════════
function openApiKeyModal(isUpdate) {
  const modal = document.getElementById('apiKeyModal');
  const title = document.getElementById('apiKeyModalTitle');
  const subtitle = document.getElementById('apiKeyModalSubtitle');
  const input = document.getElementById('apiKeyInput');
  const error = document.getElementById('apiKeyError');
  const closeBtn = document.getElementById('apiKeyModalClose');

  if (!modal) return;

  if (isUpdate) {
    if (title) title.textContent = 'Update API Key';
    if (subtitle) subtitle.textContent = 'Enter your Gemini API key to activate AI features';
    if (closeBtn) closeBtn.style.display = 'block';
  } else {
    if (title) title.textContent = 'Welcome to StadiumSense';
    if (subtitle) subtitle.textContent = 'Enter your Gemini API key to activate AI features';
    if (closeBtn) closeBtn.style.display = 'none';
  }

  if (input) {
    input.value = sessionStorage.getItem('gemini_key') || '';
    input.classList.remove('shake');
  }
  if (error) {
    error.style.display = 'none';
  }

  modal.style.display = 'flex';
  if (input) setTimeout(function() { input.focus(); }, 100);
}

function closeApiKeyModal() {
  const modal = document.getElementById('apiKeyModal');
  if (modal) modal.style.display = 'none';
}

function submitApiKey() {
  const input = document.getElementById('apiKeyInput');
  const error = document.getElementById('apiKeyError');
  if (!input) return;

  const val = input.value.trim();
  if (!val) {
    input.classList.remove('shake');
    void input.offsetWidth; // force reflow
    input.classList.add('shake');
    if (error) error.style.display = 'block';
    return;
  }

  sessionStorage.setItem('gemini_key', val);
  closeApiKeyModal();
  showToast('✅ AI activated!');
}

function checkApiKeyOnLoad() {
  if (!sessionStorage.getItem('gemini_key')) {
    openApiKeyModal(false);
  }
}

