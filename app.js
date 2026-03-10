/**
 * WackyBuds CFR v5.9.10
 * Based on Original System - All Logic Preserved
 * NO DAY COLUMN IN TABLE
 */

// ===== CONFIG (from old system) =====
const CFG = {
  url: localStorage.getItem('cfr_url') || '',
  cohUrl: localStorage.getItem('coh_url') || '',
  tz: 'Asia/Manila'
};

// Storage keys (from old system)
const STR = {
  pend: 'cfr_pend_v5',
  sent: 'cfr_sent_v5',
  cache: 'cfr_cache_v5',
  cohSent: 'cfr_coh_sent'  // NEW: track COH sent entries
};

// Shift constants (EXACT from old system)
const SHIFT_ORD = {'4:00AM - 12:00PM': 1, '8:00PM - 4:00AM': 2, '12:00PM - 8:00PM': 3};
const SHIFT_CYC = ['12:00PM - 8:00PM', '8:00PM - 4:00AM', '4:00AM - 12:00PM'];
const SHIFT_TO_COH = {
  '12:00PM - 8:00PM': '12NN - 8PM (Afternoon)',
  '8:00PM - 4:00AM': '8PM - 4AM (Graveyard)',
  '4:00AM - 12:00PM': '4AM - 12NN (Morning)'
};

// ===== STATE =====
let allData = [];
let filtered = [];
let lastEnd = parseFloat(localStorage.getItem('cfr_last_end')) || 0;
let editRow = null;
let online = navigator.onLine;
let submitting = false;
let cohExistingKeys = new Set();
let entryOpen = true;

// ===== HELPERS (EXACT from old system) =====
const $ = id => document.getElementById(id);

function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '0';
  const num = parseFloat(String(v).replace(/,/g, ''));
  if (isNaN(num)) return '0';
  const parts = num.toString().split('.');
  parts[0] = parseInt(parts[0]).toLocaleString('en-US');
  return parts.length > 1 ? parts[0] + '.' + parts[1] : parts[0];
}

const fC = v => '₱' + fmtNum(v);

const pN = v => {
  if (v === null || v === undefined || v === '') return 0;
  const num = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};

const fV = v => {
  if (!v && v !== 0) return '';
  return fmtNum(v);
};

// Format input with commas (EXACT from old system)
function formatInput(el) {
  let v = el.value.replace(/[^0-9.]/g, '');
  const parts = v.split('.');
  if (parts[0]) parts[0] = parseInt(parts[0] || 0).toLocaleString('en-US');
  el.value = parts.length > 1 ? parts[0] + '.' + parts.slice(1).join('') : parts[0];
}

// Date formatting
const fDateShort = d => {
  if (!d) return '-';
  try {
    const date = new Date(d + 'T12:00:00');
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return '-'; }
};

const fDateHint = d => {
  if (!d) return '-';
  try {
    const date = new Date(d + 'T12:00:00');
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return '-'; }
};

const getDayName = d => {
  if (!d) return '';
  try {
    const date = new Date(d + 'T12:00:00');
    if (isNaN(date.getTime())) return '';
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
  } catch { return ''; }
};

const getShortDay = d => {
  if (!d) return '-';
  try {
    const date = new Date(d + 'T12:00:00');
    if (isNaN(date.getTime())) return '-';
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  } catch { return '-'; }
};

const getTodayDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const genId = () => Date.now() + '-' + Math.random().toString(36).substr(2, 9);

// ===== TOAST (from old system) =====
function toast(msg, type = 'success') {
  const c = $('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = '<span class="toast-icon">' + (type === 'success' ? '✓' : type === 'warning' ? '⚠' : '✕') + '</span><span>' + msg + '</span>';
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ===== ENTER KEY HANDLER (from old system) =====
function handleEnterKey(e) {
  if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    const inputs = [...$('entryForm').querySelectorAll('input:not([readonly]),select')];
    const idx = inputs.indexOf(e.target);
    if (idx > -1 && idx < inputs.length - 1) inputs[idx + 1].focus();
    return false;
  }
  return true;
}

// ===== STORAGE (from old system) =====
const getPend = () => { try { return JSON.parse(localStorage.getItem(STR.pend)) || []; } catch { return []; } };
const savePend = a => localStorage.setItem(STR.pend, JSON.stringify(a));
const getSent = () => { try { return JSON.parse(localStorage.getItem(STR.sent)) || []; } catch { return []; } };
const saveSent = a => localStorage.setItem(STR.sent, JSON.stringify(a.slice(-500)));
const wasSent = id => getSent().includes(id);
const markSent = id => { const a = getSent(); if (!a.includes(id)) { a.push(id); saveSent(a); } };
const getCache = () => { try { return JSON.parse(localStorage.getItem(STR.cache)) || []; } catch { return []; } };
const saveCache = a => localStorage.setItem(STR.cache, JSON.stringify(a));
const setLastEnd = v => { lastEnd = pN(v); localStorage.setItem('cfr_last_end', lastEnd); };

// COH Sent tracking (NEW)
const getCohSent = () => { try { return JSON.parse(localStorage.getItem(STR.cohSent)) || []; } catch { return []; } };
const saveCohSent = a => localStorage.setItem(STR.cohSent, JSON.stringify(a.slice(-500)));
const wasCohSent = id => getCohSent().includes(id);
const markCohSent = id => { const a = getCohSent(); if (!a.includes(id)) { a.push(id); saveCohSent(a); } };

// ===== PENDING UI (from old system) =====
function updatePendUI() {
  const p = getPend().filter(e => !wasSent(e.uniqueId));
  $('pendingBadge').style.display = p.length > 0 ? 'inline' : 'none';
  $('pendingBadge').textContent = p.length;
  $('pendingCount').textContent = p.length + ' entries waiting to sync';
}

// ===== TOGGLE ENTRY FORM =====
function toggleEntry() {
  const card = document.querySelector('.entry-card');
  const arrow = document.getElementById('toggleArrow');
  if (!card || !arrow) return;
  
  entryOpen = !entryOpen;
  
  if (entryOpen) {
    card.classList.add('open');
    arrow.classList.add('up');
  } else {
    card.classList.remove('open');
    arrow.classList.remove('up');
  }
}

// ===== STATUS (from old system) =====
function updateStatus() {
  online = navigator.onLine;
  $('offlineBanner').classList.toggle('show', !online);
  const dot = $('statusDot');
  const txt = $('statusText');
  dot.className = 'status-dot';
  if (!online) {
    dot.classList.add('off');
    txt.textContent = 'Offline';
  } else if (CFG.url) {
    dot.classList.add('on');
    txt.textContent = 'Connected';
  } else {
    txt.textContent = 'Not configured';
  }
}

// ===== COH SYNC (from old system with improvements) =====
function getCohKey(entry) {
  const shift = SHIFT_TO_COH[entry.shift] || entry.shift;
  return `${entry.date}|${shift}|${entry.dutyName}`;
}

async function fetchCohData() {
  if (!CFG.cohUrl || !online) return [];
  try {
    const res = await fetch(CFG.cohUrl + '?type=IN&_=' + Date.now());
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.records) {
        cohExistingKeys.clear();
        json.records.forEach(r => {
          if (r.category === 'Remittance') {
            cohExistingKeys.add(`${r.date}|${r.shift}|${r.remarks}`);
          }
        });
        return json.records;
      }
    }
  } catch (err) {
    console.log('Fetch COH error:', err);
  }
  return [];
}

function isInCOH(entry) {
  return cohExistingKeys.has(getCohKey(entry)) || wasCohSent(entry.uniqueId);
}

async function sendToCOH(entry, showToast = true) {
  if (!CFG.cohUrl || !online) return false;
  
  // Check if already sent
  if (wasCohSent(entry.uniqueId)) {
    if (showToast) toast('Already synced to COH');
    return true;
  }
  
  // Check if exists in COH
  if (cohExistingKeys.has(getCohKey(entry))) {
    markCohSent(entry.uniqueId);
    if (showToast) toast('Already in COH');
    return true;
  }
  
  try {
    const cohData = {
      action: 'ADD',
      type: 'IN',
      date: entry.date,
      shift: SHIFT_TO_COH[entry.shift] || entry.shift,
      category: 'Remittance',
      remarks: entry.dutyName,
      amount: entry.cfr,
      fee: entry.bankFee,
      rowId: 'CFR-' + entry.date + '-' + (SHIFT_TO_COH[entry.shift] || entry.shift).replace(/[^a-zA-Z0-9]/g, '') + '-' + entry.dutyName
    };
    
    const res = await fetch(CFG.cohUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(cohData)
    });
    
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        cohExistingKeys.add(getCohKey(entry));
        markCohSent(entry.uniqueId);
        if (showToast) toast('Synced to COH!');
        return true;
      }
    }
  } catch (err) {
    console.log('COH sync error:', err);
  }
  return false;
}

async function syncAllToCOH() {
  if (!CFG.cohUrl) {
    toast('Configure COH URL first', 'error');
    return;
  }
  if (!online) {
    toast('You are offline', 'warning');
    return;
  }
  
  const btn = $('syncAllCohBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';
  
  const progress = $('syncProgress');
  const progressText = $('syncProgressText');
  const progressBar = $('syncBarFill');
  
  progress.classList.add('show');
  progressText.textContent = 'Fetching COH data...';
  progressBar.style.width = '0%';
  
  // Fetch existing COH data to know what's already there
  await fetchCohData();
  
  const entries = getCache().filter(e => e.date && e.cfr);
  
  if (entries.length === 0) {
    toast('No CFR entries found', 'warning');
    btn.disabled = false;
    btn.textContent = 'Sync Missing';
    progress.classList.remove('show');
    return;
  }
  
  // Only sync entries NOT already in COH
  const toSync = entries.filter(e => !isInCOH(e));
  
  if (toSync.length === 0) {
    toast('All entries already synced!');
    btn.disabled = false;
    btn.textContent = 'Sync Missing';
    progress.classList.remove('show');
    $('cohSyncCount').textContent = 'All ' + entries.length + ' entries synced ✓';
    return;
  }
  
  progressText.textContent = `Found ${toSync.length} missing entries...`;
  
  let synced = 0, failed = 0;
  for (let i = 0; i < toSync.length; i++) {
    progressText.textContent = `Syncing ${i + 1} of ${toSync.length}...`;
    progressBar.style.width = ((i + 1) / toSync.length * 100) + '%';
    if (await sendToCOH(toSync[i], false)) synced++;
    else failed++;
    await new Promise(r => setTimeout(r, 300));
  }
  
  btn.disabled = false;
  btn.textContent = 'Sync Missing';
  progress.classList.remove('show');
  $('cohSyncCount').textContent = synced + ' new entries synced';
  toast(failed === 0 ? `Successfully synced ${synced} entries!` : `${synced} synced, ${failed} failed`, failed === 0 ? 'success' : 'warning');
}

// ===== SERVER SYNC (from old system) =====
async function sendToServer(entry) {
  if (!CFG.url || !online) return false;
  if (wasSent(entry.uniqueId)) {
    savePend(getPend().filter(e => e.uniqueId !== entry.uniqueId));
    updatePendUI();
    return true;
  }
  
  try {
    const res = await fetch(CFG.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(entry)
    });
    
    if (res.ok) {
      markSent(entry.uniqueId);
      savePend(getPend().filter(e => e.uniqueId !== entry.uniqueId));
      updatePendUI();
      return true;
    }
  } catch (err) {
    console.log('Send error:', err);
  }
  return false;
}

async function syncPending() {
  if (!CFG.url) {
    toast('Configure URL first', 'error');
    return;
  }
  if (!online) {
    toast('You are offline', 'warning');
    return;
  }
  
  const pend = getPend().filter(e => !wasSent(e.uniqueId));
  if (pend.length === 0) {
    toast('Nothing to sync');
    return;
  }
  
  toast('Syncing ' + pend.length + ' entries...');
  let ok = 0;
  
  for (const e of pend) {
    if (await sendToServer(e)) {
      ok++;
      // Also sync to COH
      if (CFG.cohUrl && !wasCohSent(e.uniqueId)) {
        await sendToCOH(e, false);
      }
    }
  }
  
  toast(ok === pend.length ? 'All entries synced!' : ok + '/' + pend.length + ' synced', ok === pend.length ? 'success' : 'warning');
}

// ===== TABS =====
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      // Remove active from all tabs
      tabs.forEach(t => t.classList.remove('active'));
      // Remove active from all content
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      // Add active to clicked tab
      this.classList.add('active');
      // Add active to corresponding content
      const tabId = this.getAttribute('data-tab');
      const content = document.getElementById(tabId);
      if (content) content.classList.add('active');
    });
  });
}

// ===== NEXT ENTRY (EXACT from old system) =====
function getNext() {
  const sorted = [...allData].filter(e => e.date).sort((a, b) =>
    new Date(b.date) - new Date(a.date) || (SHIFT_ORD[a.shift] || 0) - (SHIFT_ORD[b.shift] || 0)
  );
  
  if (sorted.length === 0) {
    return { date: getTodayDate(), shift: SHIFT_CYC[0] };
  }
  
  const last = sorted[0];
  const idx = SHIFT_CYC.indexOf(last.shift);
  
  if (idx === -1) {
    return { date: getTodayDate(), shift: SHIFT_CYC[0] };
  }
  
  // If last shift is 4AM-12PM (index 2), advance to next day
  if (idx === 2) {
    const d = new Date(last.date + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return { date: `${y}-${m}-${day}`, shift: SHIFT_CYC[0] };
  }
  
  return { date: last.date, shift: SHIFT_CYC[idx + 1] };
}

function setNext() {
  const n = getNext();
  const dateField = document.getElementById('entryDate');
  const shiftField = document.getElementById('entryShift');
  const hintField = document.getElementById('nextHint');
  
  if (dateField) dateField.value = n.date;
  if (shiftField) shiftField.value = n.shift;
  updateDay();
  
  const shortShift = n.shift.replace(':00', '').replace(' - ', '-');
  if (hintField) hintField.textContent = 'Next: ' + fDateHint(n.date) + ' • ' + shortShift;
}

// ===== UPDATE DAY (from old system) =====
function updateDay() {
  const dateField = document.getElementById('entryDate');
  const dayField = document.getElementById('entryDay');
  if (dateField && dayField && dateField.value) {
    dayField.value = getDayName(dateField.value);
  }
}

// ===== UPDATE STARTING (EXACT from old system) =====
function updateStarting() {
  const list = $('activeList');
  const ex = list.querySelector('.starting');
  
  if (lastEnd > 0) {
    if (ex) {
      ex.querySelector('.amt').value = fV(lastEnd);
    } else {
      const row = document.createElement('div');
      row.className = 'entry-row starting';
      row.innerHTML = '<input type="text" inputmode="decimal" class="entry-input amt" value="' + fV(lastEnd) + '" onkeyup="formatInput(this)" oninput="calc()"><input type="text" class="entry-input" value="Starting (Prev End)"><button type="button" class="btn-remove" onclick="removeRow(this)">×</button>';
      list.insertBefore(row, list.firstChild);
    }
  }
  calc();
}

// ===== ROW MANAGEMENT (from old system) =====
function addRow(type) {
  const listId = type === 'active' ? 'activeList' : type === 'end' ? 'endList' : 'remitList';
  const def = type === 'end' ? 'End Chips' : type === 'remit' ? 'Remittance' : '';
  const list = $(listId);
  const row = document.createElement('div');
  row.className = 'entry-row';
  row.innerHTML = '<input type="text" inputmode="decimal" placeholder="Amount" class="entry-input amt" onkeyup="formatInput(this)" oninput="calc()"><input type="text" class="entry-input" value="' + def + '" placeholder="Description"><button type="button" class="btn-remove" onclick="removeRow(this)">×</button>';
  list.appendChild(row);
  row.querySelector('.amt').focus();
}

function removeRow(btn) {
  btn.closest('.entry-row').remove();
  calc();
}

const getSum = id => {
  let s = 0;
  $(id).querySelectorAll('.amt').forEach(i => s += pN(i.value));
  return s;
};

const getDetails = id => {
  const arr = [];
  $(id).querySelectorAll('.entry-row').forEach(row => {
    const a = pN(row.querySelector('.amt')?.value);
    const r = row.querySelectorAll('.entry-input')[1]?.value || '';
    if (a > 0 || r) arr.push({ amount: a, remarks: r });
  });
  return arr;
};

// ===== CALCULATE (from old system) =====
function calc() {
  const active = getSum('activeList');
  const end = getSum('endList');
  const remit = getSum('remitList');
  const sal = pN($('salary').value);
  const cfr = active - end;
  const totalRemit = remit + sal;
  const unremit = totalRemit - cfr;
  
  $('activeTotal').textContent = fC(active);
  $('endTotal').textContent = fC(end);
  $('remitTotal').textContent = fC(remit);
  $('calcCFR').textContent = fC(cfr);
  $('calcRemit').textContent = fC(totalRemit);
  
  const u = $('calcUnremit');
  u.textContent = fC(unremit);
  u.classList.toggle('neg', unremit < 0);
  
  $('statCFR').textContent = fC(cfr);
  $('statRemit').textContent = fC(totalRemit);
  $('statUnremit').textContent = fC(unremit);
}

// ===== VALIDATE (from old system) =====
function validate() {
  let ok = true;
  [
    { id: 'entryDate', err: 'dateErr', val: $('entryDate').value },
    { id: 'entryShift', err: 'shiftErr', val: $('entryShift').value },
    { id: 'dutyName', err: 'nameErr', val: $('dutyName').value.trim() }
  ].forEach(c => {
    const el = $(c.id), er = $(c.err);
    if (!c.val) {
      er.classList.add('show');
      el.classList.add('err');
      ok = false;
    } else {
      er.classList.remove('show');
      el.classList.remove('err');
    }
  });
  return ok;
}

// ===== CHECK DUPLICATE =====
function isDuplicateEntry(date, shift, loader) {
  const loaderUpper = (loader || '').toUpperCase();
  return allData.some(e => 
    e.date === date && 
    e.shift === shift && 
    (e.dutyName || '').toUpperCase() === loaderUpper
  );
}

// ===== FORM SUBMIT (moved to init) =====
function initFormHandler() {
  const form = $('entryForm');
  if (!form) return;
  
  form.onsubmit = async e => {
    e.preventDefault();
    
    if (!validate()) {
      toast('Please fill all required fields', 'error');
      return;
    }
    
    const btn = $('submitBtn');
    if (btn.disabled || submitting) return;
    
    // Get form values
    const date = $('entryDate').value;
    const shift = $('entryShift').value;
    const loader = $('dutyName').value.trim();
    
    // Check for duplicate entry
    if (isDuplicateEntry(date, shift, loader)) {
      const shortShift = shift.replace(':00', '').replace(' - ', '-');
      const confirmDupe = confirm(
        '⚠️ Duplicate Entry Detected!\n\n' +
        'An entry already exists for:\n' +
        '• Date: ' + date + '\n' +
        '• Shift: ' + shortShift + '\n' +
        '• Loader: ' + loader.toUpperCase() + '\n\n' +
        'Do you want to save anyway?'
      );
      
      if (!confirmDupe) {
        toast('Entry cancelled - duplicate detected', 'warning');
        return;
      }
    }
    
    submitting = true;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Saving...';
    
    const activeTotal = getSum('activeList');
    const endTotal = getSum('endList');
    
    const entry = {
      action: 'addEntry',
      uniqueId: genId(),
      date: date,
      day: $('entryDay').value,
      shift: shift,
      dutyName: loader.toUpperCase(),
      activeChips: getDetails('activeList'),
      activeChipsTotal: activeTotal,
      endChips: getDetails('endList'),
      endChipsTotal: endTotal,
      remittances: getDetails('remitList'),
      remittanceTotal: getSum('remitList'),
      bankFee: pN($('bankFee').value),
      salary: pN($('salary').value),
      remarks: $('remarks').value || 'DONE',
      timestamp: new Date().toISOString()
    };
    
    entry.cfr = activeTotal - endTotal;
    entry.totalRemittances = entry.remittanceTotal + entry.salary;
    entry.unremitted = entry.totalRemittances - entry.cfr;
    
    // Save to pending
    const pend = getPend();
    pend.push(entry);
    savePend(pend);
    
    // Add to local display
    allData.unshift({ ...entry, pending: true });
    filterData();
    
    // Update last end
    setLastEnd(endTotal);
    
    // Clear form
    clearForm();
    
    toast('Entry saved successfully!');
    
    btn.innerHTML = '💾 Save Entry';
    btn.disabled = false;
    submitting = false;
    
    // Send to server AND auto-sync to COH
    if (online && CFG.url) {
      const sent = await sendToServer(entry);
      
      // Auto-sync to COH if CFR was sent successfully
      if (sent && CFG.cohUrl) {
        setTimeout(async () => {
          await sendToCOH(entry, true);
        }, 500);
      }
    }
    
    updatePendUI();
  };
}

// ===== CLEAR FORM (from old system) =====
function clearForm() {
  $('dutyName').value = '';
  $('bankFee').value = '15';
  $('salary').value = '0';
  $('remarks').value = 'DONE';
  
  document.querySelectorAll('.form-err').forEach(e => e.classList.remove('show'));
  document.querySelectorAll('.form-input.err').forEach(e => e.classList.remove('err'));
  
  ['endList', 'remitList'].forEach((id, i) => {
    const list = $(id);
    const def = i === 0 ? 'End Chips' : 'Remittance';
    list.querySelectorAll('.entry-row').forEach((r, j) => {
      if (j === 0) {
        r.querySelector('.amt').value = '';
        r.querySelectorAll('.entry-input')[1].value = def;
      } else {
        r.remove();
      }
    });
  });
  
  $('activeList').querySelectorAll('.entry-row:not(.starting)').forEach(r => r.remove());
  
  setNext();
  updateStarting();
}

// ===== LOAD DATA (from old system) =====
function loadLocal() {
  const cache = getCache();
  
  // Auto-detect and clear bad cache (entries without dates)
  if (cache.length > 0 && cache.every(e => !e.date)) {
    console.log('Bad cache detected - entries missing dates, clearing...');
    localStorage.removeItem(STR.cache);
    toast('Cache cleared - please refresh', 'warning');
    return;
  }
  
  // Get cache entry uniqueIds for deduplication
  const cacheIds = new Set(cache.map(e => e.uniqueId).filter(Boolean));
  
  // Only show pending entries NOT in cache yet AND not marked as sent
  const pend = getPend().filter(e => !wasSent(e.uniqueId) && !cacheIds.has(e.uniqueId));
  
  allData = [...pend.map(p => ({ ...p, pending: true })), ...cache];
  filterData();
  updateLoaderFilter();
  
  const sorted = [...allData].filter(e => !e.pending && e.date).sort((a, b) =>
    new Date(b.date) - new Date(a.date) || (SHIFT_ORD[a.shift] || 0) - (SHIFT_ORD[b.shift] || 0)
  );
  
  if (sorted[0]?.endChipsTotal !== undefined) {
    setLastEnd(sorted[0].endChipsTotal);
  }
  
  setNext();
  updateStarting();
  updatePendUI();
}

async function loadDataSilent() {
  if (!CFG.url || !online) return;
  
  try {
    const res = await fetch(CFG.url + '?action=getData&_=' + Date.now());
    if (!res.ok) return;
    
    const json = await res.json();
    if (json.success) {
      const entries = (json.entries || []).map(e => ({
        rowIndex: e.rowIndex,
        date: e.date || '',
        day: e.day || '',
        shift: e.shift || '',
        dutyName: String(e.dutyName || '').toUpperCase(),
        activeChipsTotal: pN(e.activeChipsTotal),
        endChipsTotal: pN(e.endChipsTotal),
        cfr: pN(e.cfr),
        remittanceTotal: pN(e.remittanceTotal),
        totalRemittances: pN(e.totalRemittances),
        bankFee: pN(e.bankFee),
        salary: pN(e.salary),
        unremitted: pN(e.unremitted),
        remarks: e.remarks || '',
        uniqueId: e.uniqueId || ''
      }));
      
      saveCache(entries);
      
      // Get server entry uniqueIds for deduplication
      const serverIds = new Set(entries.map(e => e.uniqueId).filter(Boolean));
      
      // Only show pending entries NOT in server data yet AND not marked as sent
      const pend = getPend().filter(e => !wasSent(e.uniqueId) && !serverIds.has(e.uniqueId));
      
      // Clean up pending queue - remove entries now in server
      const cleanPend = getPend().filter(e => !serverIds.has(e.uniqueId));
      if (cleanPend.length !== getPend().length) {
        savePend(cleanPend);
      }
      
      allData = [...pend.map(p => ({ ...p, pending: true })), ...entries];
      filterData();
      updateLoaderFilter();
      
      const sorted = [...allData].filter(e => !e.pending && e.date).sort((a, b) =>
        new Date(b.date) - new Date(a.date) || (SHIFT_ORD[a.shift] || 0) - (SHIFT_ORD[b.shift] || 0)
      );
      
      if (sorted[0]?.endChipsTotal !== undefined) {
        setLastEnd(sorted[0].endChipsTotal);
      }
      
      setNext();
      updateStarting();
      updatePendUI();
    }
  } catch (err) {
    console.log('Auto-load error:', err);
  }
}

async function loadData() {
  if (!CFG.url) {
    toast('Configure URL first', 'warning');
    loadLocal();
    return;
  }
  if (!online) {
    toast('You are offline', 'warning');
    loadLocal();
    return;
  }
  
  const btn = $('refreshBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';
  
  try {
    const res = await fetch(CFG.url + '?action=getData&_=' + Date.now());
    if (!res.ok) throw new Error('Server error');
    
    const json = await res.json();
    if (json.success) {
      const entries = (json.entries || []).map(e => ({
        rowIndex: e.rowIndex,
        date: e.date || '',
        day: e.day || '',
        shift: e.shift || '',
        dutyName: String(e.dutyName || '').toUpperCase(),
        activeChipsTotal: pN(e.activeChipsTotal),
        endChipsTotal: pN(e.endChipsTotal),
        cfr: pN(e.cfr),
        remittanceTotal: pN(e.remittanceTotal),
        totalRemittances: pN(e.totalRemittances),
        bankFee: pN(e.bankFee),
        salary: pN(e.salary),
        unremitted: pN(e.unremitted),
        remarks: e.remarks || '',
        uniqueId: e.uniqueId || ''
      }));
      
      saveCache(entries);
      
      // Get server entry uniqueIds for deduplication
      const serverIds = new Set(entries.map(e => e.uniqueId).filter(Boolean));
      
      // Only show pending entries NOT in server data yet AND not marked as sent
      const pend = getPend().filter(e => !wasSent(e.uniqueId) && !serverIds.has(e.uniqueId));
      
      // Clean up pending queue - remove entries now in server
      const cleanPend = getPend().filter(e => !serverIds.has(e.uniqueId));
      if (cleanPend.length !== getPend().length) {
        savePend(cleanPend);
      }
      
      allData = [...pend.map(p => ({ ...p, pending: true })), ...entries];
      filterData();
      updateLoaderFilter();
      
      const sorted = [...allData].filter(e => !e.pending && e.date).sort((a, b) =>
        new Date(b.date) - new Date(a.date) || (SHIFT_ORD[a.shift] || 0) - (SHIFT_ORD[b.shift] || 0)
      );
      
      if (sorted[0]?.endChipsTotal !== undefined) {
        setLastEnd(sorted[0].endChipsTotal);
      }
      
      setNext();
      updateStarting();
      updatePendUI();
      toast('Loaded ' + entries.length + ' entries');
    } else {
      toast(json.message || 'Failed to load', 'error');
      loadLocal();
    }
  } catch (err) {
    toast('Connection error', 'error');
    loadLocal();
  }
  
  btn.disabled = false;
  btn.innerHTML = '🔄 Refresh';
}

// ===== FILTER (from old system) =====
function updateLoaderFilter() {
  const sel = $('filterLoader');
  const loaders = [...new Set(allData.map(e => e.dutyName).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">All Loaders</option>' + loaders.map(l => '<option value="' + l + '">' + l + '</option>').join('');
}

function filterData() {
  let d = allData;
  
  const loader = $('filterLoader')?.value;
  if (loader) d = d.filter(e => e.dutyName === loader);
  
  const start = $('filterStart')?.value;
  const end = $('filterEnd')?.value;
  if (start) d = d.filter(e => e.date >= start);
  if (end) d = d.filter(e => e.date <= end);
  
  d.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0) || (SHIFT_ORD[a.shift] || 0) - (SHIFT_ORD[b.shift] || 0));
  
  filtered = d;
  renderTable();
}

function clearFilter() {
  $('filterStart').value = '';
  $('filterEnd').value = '';
  $('filterLoader').value = '';
  filterData();
}

// ===== RENDER TABLE (from old system with all details) =====
function renderTable() {
  const tbody = $('reportBody');
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="13" class="empty-row">No transactions found</td></tr>';
    return;
  }
  
  let html = '';
  
  filtered.forEach(e => {
    const pend = e.pending && !wasSent(e.uniqueId);
    const shortShift = (e.shift || '').replace(':00', '').replace(' - ', '-');
    
    html += '<tr class="' + (pend ? 'pending' : '') + '">';
    html += '<td>' + fDateShort(e.date) + '</td>';
    html += '<td style="font-size:.65rem">' + shortShift + '</td>';
    html += '<td>' + (e.dutyName || '-') + '</td>';
    html += '<td>' + fC(e.activeChipsTotal) + '</td>';
    html += '<td>' + fC(e.endChipsTotal) + '</td>';
    html += '<td style="color:var(--accent)">' + fC(e.cfr) + '</td>';
    html += '<td>' + fC(e.remittanceTotal) + '</td>';
    html += '<td>' + fC(e.salary) + '</td>';
    html += '<td style="color:var(--green)">' + fC(e.totalRemittances) + '</td>';
    html += '<td style="color:' + (pN(e.unremitted) < 0 ? 'var(--red)' : 'var(--yellow)') + '">' + fC(e.unremitted) + '</td>';
    html += '<td>' + fC(e.bankFee) + '</td>';
    html += '<td style="font-family:inherit;font-size:.65rem">' + ((e.remarks || '-').substring(0, 8)) + '</td>';
    html += '<td>';
    if (!pend && e.rowIndex) {
      html += '<button class="btn btn-secondary btn-sm" onclick="openEdit(' + e.rowIndex + ')">✎</button>';
    } else if (pend) {
      html += '<span style="color:var(--orange)">●</span>';
    }
    html += '</td>';
    html += '</tr>';
  });
  
  tbody.innerHTML = html;
}

// ===== EDIT MODAL (from old system) =====
function openEdit(rowIndex) {
  editRow = rowIndex;
  const entry = allData.find(e => e.rowIndex === rowIndex);
  if (!entry) {
    toast('Entry not found', 'error');
    return;
  }
  
  $('editDate').value = entry.date;
  $('editShift').value = entry.shift || '';
  $('editLoader').value = entry.dutyName || '';
  $('editActive').value = fV(entry.activeChipsTotal);
  $('editEnd').value = fV(entry.endChipsTotal);
  $('editCFR').value = fV(entry.cfr);
  $('editRemit').value = fV(entry.remittanceTotal);
  $('editSalary').value = fV(entry.salary);
  $('editFee').value = fV(entry.bankFee);
  $('editUnremit').value = fV(entry.unremitted);
  $('editRemarks').value = entry.remarks || '';
  
  $('editModal').classList.add('show');
}

function recalcEdit() {
  const a = pN($('editActive').value);
  const e = pN($('editEnd').value);
  const r = pN($('editRemit').value);
  const s = pN($('editSalary').value);
  $('editCFR').value = fV(a - e);
  $('editUnremit').value = fV((r + s) - (a - e));
}

function closeEdit() {
  editRow = null;
  $('editModal').classList.remove('show');
}

function saveEdit(e) {
  e.preventDefault();
  if (!editRow) return;
  
  const data = {
    action: 'updateEntry',
    rowIndex: editRow,
    date: $('editDate').value,
    shift: $('editShift').value,
    dutyName: $('editLoader').value.toUpperCase(),
    activeChipsTotal: pN($('editActive').value),
    endChipsTotal: pN($('editEnd').value),
    cfr: pN($('editCFR').value),
    remittanceTotal: pN($('editRemit').value),
    bankFee: pN($('editFee').value),
    salary: pN($('editSalary').value),
    totalRemittances: pN($('editRemit').value) + pN($('editSalary').value),
    unremitted: pN($('editUnremit').value),
    remarks: $('editRemarks').value
  };
  
  // Update local
  const idx = allData.findIndex(entry => entry.rowIndex === editRow);
  if (idx !== -1) Object.assign(allData[idx], data);
  
  const cache = getCache();
  const cIdx = cache.findIndex(entry => entry.rowIndex === editRow);
  if (cIdx !== -1) {
    Object.assign(cache[cIdx], data);
    saveCache(cache);
  }
  
  filterData();
  toast('Entry updated!');
  closeEdit();
  
  if (online && CFG.url) {
    fetch(CFG.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    }).then(r => r.json()).then(j => {
      if (!j.success) toast('Server sync failed', 'warning');
    }).catch(() => toast('Sync failed', 'warning'));
  }
}

function deleteEntry() {
  $('editModal').classList.remove('show');
  $('deleteModal').classList.add('show');
}

function closeDelete() {
  $('deleteModal').classList.remove('show');
}

function confirmDelete() {
  if (!editRow) return;
  
  const row = editRow;
  allData = allData.filter(e => e.rowIndex !== row);
  
  const cache = getCache();
  saveCache(cache.filter(e => e.rowIndex !== row));
  
  filterData();
  toast('Entry deleted');
  closeDelete();
  editRow = null;
  
  if (online && CFG.url) {
    fetch(CFG.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'deleteEntry', rowIndex: row })
    }).then(r => r.json()).then(j => {
      if (j.success) setTimeout(() => loadData(), 500);
      else toast('Server error', 'error');
    }).catch(() => toast('Sync failed', 'warning'));
  }
}

// ===== SETTINGS (from old system) =====
function saveUrl() {
  const url = $('scriptUrl').value.trim();
  if (url) {
    CFG.url = url;
    localStorage.setItem('cfr_url', url);
    toast('URL saved!');
    updateStatus();
  } else {
    toast('Please enter URL', 'error');
  }
}

async function testConn() {
  const url = $('scriptUrl').value.trim();
  if (!url) {
    toast('Please enter URL first', 'error');
    return;
  }
  
  try {
    const res = await fetch(url + '?action=test&_=' + Date.now());
    const json = await res.json();
    toast(json.success ? 'Connection successful!' : 'Connection failed', json.success ? 'success' : 'error');
  } catch {
    toast('Connection failed', 'error');
  }
}

function saveCohUrl() {
  const url = $('cohUrl').value.trim();
  if (url) {
    CFG.cohUrl = url;
    localStorage.setItem('coh_url', url);
    toast('COH URL saved!');
    updateCohStatus();
  } else {
    toast('Please enter URL', 'error');
  }
}

function updateCohStatus() {
  const st = $('cohStatus');
  if (CFG.cohUrl) {
    st.className = 'coh-status connected';
    st.innerHTML = '<span>●</span> Connected • Auto-sync enabled';
  } else {
    st.className = 'coh-status';
    st.innerHTML = '<span>○</span> Not configured';
  }
}

async function testCoh() {
  const url = $('cohUrl').value.trim() || CFG.cohUrl;
  if (!url) {
    toast('Configure COH URL first', 'error');
    return;
  }
  
  try {
    const res = await fetch(url + '?action=test&_=' + Date.now());
    const json = await res.json();
    toast(json.success ? 'COH connected!' : 'COH connection failed', json.success ? 'success' : 'error');
  } catch {
    toast('COH connection failed', 'error');
  }
}

function hardRefresh() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()));
  }
  caches.keys().then(names => names.forEach(n => caches.delete(n)));
  toast('Refreshing app...');
  setTimeout(() => location.reload(true), 500);
}

function clearAllData() {
  if (!confirm('⚠️ Clear ALL local data?\n\nThis will remove all cached entries and settings. This action cannot be undone.')) return;
  localStorage.clear();
  toast('All data cleared');
  setTimeout(() => location.reload(), 500);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Initialize tabs
  initTabs();
  
  // Initialize form handler
  initFormHandler();
  
  // Online/Offline
  window.addEventListener('online', () => {
    online = true;
    updateStatus();
    loadDataSilent();
  });
  window.addEventListener('offline', () => {
    online = false;
    updateStatus();
  });
  updateStatus();
  
  // Load settings
  if (CFG.url) $('scriptUrl').value = CFG.url;
  if (CFG.cohUrl) $('cohUrl').value = CFG.cohUrl;
  updateCohStatus();
  
  // Entry toggle click handler
  const entryToggle = document.getElementById('entryToggle');
  if (entryToggle) {
    entryToggle.addEventListener('click', toggleEntry);
  }
  
  // Open entry form by default
  const entryCard = document.querySelector('.entry-card');
  const toggleArrow = document.getElementById('toggleArrow');
  if (entryCard) entryCard.classList.add('open');
  if (toggleArrow) toggleArrow.classList.add('up');
  entryOpen = true;
  
  // Modal close on outside click
  const editModal = $('editModal');
  if (editModal) editModal.addEventListener('click', e => { if (e.target === editModal) closeEdit(); });
  const deleteModal = $('deleteModal');
  if (deleteModal) deleteModal.addEventListener('click', e => { if (e.target === deleteModal) closeDelete(); });
  
  // Load data
  loadLocal();
  
  if (CFG.url && online) {
    setTimeout(() => loadDataSilent(), 300);
  }
  
  // Pre-fetch COH data
  if (CFG.cohUrl && online) {
    setTimeout(() => fetchCohData(), 500);
  }
});

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
