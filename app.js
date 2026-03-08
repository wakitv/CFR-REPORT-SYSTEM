/**
 * WackyBuds CFR v5.9.1
 * Fixes: Invalid date, auto-sync COH, entry inside reports
 */

// ===== Config =====
const CFG = {
  url: localStorage.getItem('cfr_url') || '',
  cohUrl: localStorage.getItem('coh_url') || '',
  tz: 'Asia/Manila'
};

const STR = { pend: 'cfr_pend_v5', sent: 'cfr_sent_v5', cache: 'cfr_cache_v5', cohSent: 'cfr_coh_sent' };

// Shift order for sorting (business day)
const SHIFT_ORD = { '4:00AM - 12:00PM': 1, '8:00PM - 4:00AM': 2, '12:00PM - 8:00PM': 3 };
// Shift cycle for next entry
const SHIFT_CYC = ['4:00AM - 12:00PM', '12:00PM - 8:00PM', '8:00PM - 4:00AM'];
// Shift map for COH
const SHIFT_COH = {
  '4:00AM - 12:00PM': '4AM - 12NN (Morning)',
  '12:00PM - 8:00PM': '12NN - 8PM (Afternoon)',
  '8:00PM - 4:00AM': '8PM - 4AM (Graveyard)'
};

// ===== State =====
let allData = [];
let filtered = [];
let lastEnd = parseFloat(localStorage.getItem('cfr_last_end')) || 0;
let editRow = null;
let online = navigator.onLine;
let submitting = false;
let cohExistingKeys = new Set();
let entryOpen = true;

// ===== Helpers =====
const $ = id => document.getElementById(id);
const pN = v => { if (v == null || v === '') return 0; const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };
const fmtNum = v => { if (v == null || v === '') return '0'; const n = parseFloat(String(v).replace(/,/g, '')); if (isNaN(n)) return '0'; return n.toLocaleString('en-US'); };
const fC = v => '₱' + fmtNum(v);
const fV = v => (!v && v !== 0) ? '' : fmtNum(v);
const genId = () => Date.now() + '-' + Math.random().toString(36).substr(2, 9);

// Fixed date formatting - handle invalid dates
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    // Handle both YYYY-MM-DD and other formats
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '-';
  }
}

function formatDateFull(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '-';
  }
}

function getDayName(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return '';
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
  } catch {
    return '';
  }
}

function getShortDay(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return '-';
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  } catch {
    return '-';
  }
}

function getTodayDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Storage
const getPend = () => { try { return JSON.parse(localStorage.getItem(STR.pend)) || []; } catch { return []; } };
const savePend = a => localStorage.setItem(STR.pend, JSON.stringify(a));
const getSent = () => { try { return JSON.parse(localStorage.getItem(STR.sent)) || []; } catch { return []; } };
const saveSent = a => localStorage.setItem(STR.sent, JSON.stringify(a.slice(-500)));
const wasSent = id => getSent().includes(id);
const markSent = id => { const a = getSent(); if (!a.includes(id)) { a.push(id); saveSent(a); } };
const getCache = () => { try { return JSON.parse(localStorage.getItem(STR.cache)) || []; } catch { return []; } };
const saveCache = a => localStorage.setItem(STR.cache, JSON.stringify(a));
const setLastEnd = v => { lastEnd = pN(v); localStorage.setItem('cfr_last_end', lastEnd); };

// COH sent tracking
const getCohSent = () => { try { return JSON.parse(localStorage.getItem(STR.cohSent)) || []; } catch { return []; } };
const saveCohSent = a => localStorage.setItem(STR.cohSent, JSON.stringify(a.slice(-500)));
const wasCohSent = id => getCohSent().includes(id);
const markCohSent = id => { const a = getCohSent(); if (!a.includes(id)) { a.push(id); saveCohSent(a); } };

// Toast
function toast(msg, type = 'success') {
  const c = $('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = '<span class="toast-icon">' + (type === 'success' ? '✓' : type === 'warning' ? '⚠' : '✕') + '</span><span>' + msg + '</span>';
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ===== Toggle Entry Form =====
function toggleEntry() {
  const card = document.querySelector('.entry-card');
  const icon = $('toggleIcon');
  entryOpen = !entryOpen;
  card.classList.toggle('open', entryOpen);
  icon.classList.toggle('up', entryOpen);
}

// ===== Status =====
function updateStatus() {
  online = navigator.onLine;
  $('offlineBar').classList.toggle('show', !online);
  const dot = $('statusDot');
  const txt = $('statusText');
  dot.className = 'dot';
  if (!online) { dot.classList.add('off'); txt.textContent = 'Offline'; }
  else if (CFG.url) { dot.classList.add('on'); txt.textContent = 'Connected'; }
  else { txt.textContent = 'Not configured'; }
}

function updatePendUI() {
  const p = getPend().filter(e => !wasSent(e.uniqueId));
  const badge = $('pendingBadge');
  badge.textContent = p.length;
  badge.classList.toggle('show', p.length > 0);
  $('pendingCount').textContent = p.length + ' waiting';
  
  const dot = $('statusDot');
  if (online && p.length > 0) {
    dot.className = 'dot pend';
    $('statusText').textContent = 'Pending';
  } else if (online && CFG.url) {
    dot.className = 'dot on';
    $('statusText').textContent = 'Connected';
  }
}

// ===== Tabs =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $('tab-' + tab.dataset.tab).classList.add('active');
  };
});

// ===== Day Update =====
function updateDay() {
  const v = $('entryDate').value;
  $('entryDay').value = getDayName(v);
}

// ===== Next Entry =====
function getNext() {
  const sorted = [...allData].filter(e => e.date).sort((a, b) =>
    new Date(b.date) - new Date(a.date) || (SHIFT_ORD[a.shift] || 0) - (SHIFT_ORD[b.shift] || 0)
  );
  
  if (sorted.length === 0) {
    return { date: getTodayDate(), shift: SHIFT_CYC[0] };
  }
  
  const last = sorted[0];
  const idx = SHIFT_CYC.indexOf(last.shift);
  
  if (idx === -1) return { date: getTodayDate(), shift: SHIFT_CYC[0] };
  
  // If last shift is 8PM-4AM (index 2), next day
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
  $('entryDate').value = n.date;
  $('entryShift').value = n.shift;
  updateDay();
  
  const shortShift = n.shift.replace(':00', '').replace(' - ', '-');
  $('nextHint').textContent = 'Next: ' + formatDate(n.date) + ' • ' + shortShift;
}

// ===== Auto-fill Starting =====
function updateStarting() {
  const list = $('activeList');
  const existing = list.querySelector('.starting');
  
  if (lastEnd > 0) {
    if (existing) {
      existing.querySelector('.amt').value = fV(lastEnd);
    } else {
      const row = document.createElement('div');
      row.className = 'row starting';
      row.innerHTML = `
        <input type="text" inputmode="decimal" class="amt" value="${fV(lastEnd)}" oninput="calc()">
        <input type="text" class="desc" value="Starting (Prev End)">
        <button type="button" class="btn-x" onclick="removeRow(this)">×</button>
      `;
      list.insertBefore(row, list.firstChild);
    }
  }
  calc();
}

// ===== Chip Rows =====
function addRow(type) {
  const listId = type === 'active' ? 'activeList' : type === 'end' ? 'endList' : 'remitList';
  const def = type === 'end' ? 'End Chips' : type === 'remit' ? 'Remittance' : '';
  const list = $(listId);
  
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `
    <input type="text" inputmode="decimal" placeholder="Amount" class="amt" oninput="calc()">
    <input type="text" class="desc" value="${def}" placeholder="Description">
    <button type="button" class="btn-x" onclick="removeRow(this)">×</button>
  `;
  list.appendChild(row);
  row.querySelector('.amt').focus();
}

function removeRow(btn) {
  btn.closest('.row').remove();
  calc();
}

const getSum = id => {
  let s = 0;
  $(id).querySelectorAll('.amt').forEach(i => s += pN(i.value));
  return s;
};

const getDetails = id => {
  const arr = [];
  $(id).querySelectorAll('.row').forEach(row => {
    const a = pN(row.querySelector('.amt')?.value);
    const r = row.querySelector('.desc')?.value || '';
    if (a > 0 || r) arr.push({ amount: a, remarks: r });
  });
  return arr;
};

// ===== Calculate =====
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
  
  $('statCFR').textContent = fC(cfr);
  $('statRemit').textContent = fC(totalRemit);
  $('statUnremit').textContent = fC(unremit);
  
  $('calcCFR').textContent = fC(cfr);
  $('calcRemit').textContent = fC(totalRemit);
  
  const u = $('calcUnremit');
  u.textContent = fC(unremit);
  u.classList.toggle('neg', unremit < 0);
}

// ===== Form =====
function validate() {
  return $('entryDate').value && $('entryShift').value && $('entryLoader').value.trim();
}

function clearForm() {
  $('entryLoader').value = '';
  $('bankFee').value = '15';
  $('salary').value = '0';
  $('remarks').value = 'DONE';
  
  ['endList', 'remitList'].forEach((id, i) => {
    const list = $(id);
    const def = i === 0 ? 'End Chips' : 'Remittance';
    list.querySelectorAll('.row').forEach((r, j) => {
      if (j === 0) {
        r.querySelector('.amt').value = '';
        r.querySelector('.desc').value = def;
      } else r.remove();
    });
  });
  
  $('activeList').querySelectorAll('.row:not(.starting)').forEach(r => r.remove());
  
  setNext();
  updateStarting();
}

// ===== Submit =====
$('theForm').onsubmit = async e => {
  e.preventDefault();
  
  if (!validate()) {
    toast('Fill all required fields', 'error');
    return;
  }
  
  const btn = $('submitBtn');
  if (btn.disabled || submitting) return;
  
  submitting = true;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Saving...';
  
  const activeTotal = getSum('activeList');
  const endTotal = getSum('endList');
  
  const entry = {
    action: 'addEntry',
    uniqueId: genId(),
    date: $('entryDate').value,
    day: $('entryDay').value,
    shift: $('entryShift').value,
    dutyName: $('entryLoader').value.trim().toUpperCase(),
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
  
  // Add to local
  allData.unshift({ ...entry, pending: true });
  filterData();
  
  // Update last end
  setLastEnd(endTotal);
  
  // Clear form
  clearForm();
  
  toast('Entry saved!');
  
  btn.innerHTML = '💾 Save Entry';
  btn.disabled = false;
  submitting = false;
  
  // Send to server AND auto-sync to COH
  if (online && CFG.url) {
    const sent = await sendToServer(entry);
    
    // Auto-sync to COH if CFR was sent successfully
    if (sent && CFG.cohUrl) {
      await sendToCOH(entry, true);
    }
  }
  
  updatePendUI();
};

// ===== Server Sync =====
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
      const json = await res.json();
      if (json.success) {
        markSent(entry.uniqueId);
        savePend(getPend().filter(e => e.uniqueId !== entry.uniqueId));
        updatePendUI();
        return true;
      }
    }
  } catch (err) {
    console.log('Send error:', err);
  }
  return false;
}

async function syncPending() {
  if (!CFG.url) { toast('Configure URL first', 'error'); return; }
  if (!online) { toast('You are offline', 'warning'); return; }
  
  const pend = getPend().filter(e => !wasSent(e.uniqueId));
  if (pend.length === 0) { toast('Nothing to sync'); return; }
  
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
  
  toast(ok === pend.length ? 'All synced!' : ok + '/' + pend.length + ' synced', ok === pend.length ? 'success' : 'warning');
}

// ===== COH Sync =====
function getCohKey(e) {
  return `${e.date}|${SHIFT_COH[e.shift] || e.shift}|${e.dutyName}`;
}

async function fetchCohData() {
  if (!CFG.cohUrl || !online) return;
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
      }
    }
  } catch (err) { console.log('COH fetch error:', err); }
}

async function sendToCOH(entry, showToast = false) {
  if (!CFG.cohUrl || !online) return false;
  
  // Check if already sent via local tracking
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
    const data = {
      action: 'ADD',
      type: 'IN',
      date: entry.date,
      shift: SHIFT_COH[entry.shift] || entry.shift,
      category: 'Remittance',
      remarks: entry.dutyName,
      amount: entry.cfr,
      fee: entry.bankFee,
      rowId: 'CFR-' + entry.uniqueId
    };
    
    const res = await fetch(CFG.cohUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
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
  } catch (err) { console.log('COH sync error:', err); }
  return false;
}

async function syncAllToCOH() {
  if (!CFG.cohUrl) { toast('Configure COH URL first', 'error'); return; }
  if (!online) { toast('You are offline', 'warning'); return; }
  
  const btn = $('syncAllBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';
  
  const progress = $('syncProgress');
  const progressText = $('syncText');
  const progressBar = $('syncFill');
  
  progress.classList.add('show');
  progressText.textContent = 'Checking COH...';
  progressBar.style.width = '0%';
  
  // Fetch existing COH data first
  await fetchCohData();
  
  // Get entries that haven't been sent to COH
  const entries = getCache().filter(e => e.date && e.cfr);
  const toSync = entries.filter(e => !wasCohSent(e.uniqueId) && !cohExistingKeys.has(getCohKey(e)));
  
  if (toSync.length === 0) {
    toast('All entries already in COH!');
    btn.disabled = false;
    btn.textContent = 'Sync Missing';
    progress.classList.remove('show');
    $('cohSyncCount').textContent = 'All ' + entries.length + ' synced ✓';
    return;
  }
  
  progressText.textContent = `Found ${toSync.length} new entries...`;
  
  let synced = 0;
  for (let i = 0; i < toSync.length; i++) {
    progressText.textContent = `Syncing ${i + 1} of ${toSync.length}...`;
    progressBar.style.width = ((i + 1) / toSync.length * 100) + '%';
    if (await sendToCOH(toSync[i], false)) synced++;
    await new Promise(r => setTimeout(r, 250));
  }
  
  btn.disabled = false;
  btn.textContent = 'Sync Missing';
  progress.classList.remove('show');
  $('cohSyncCount').textContent = synced + ' new entries synced';
  toast(`Synced ${synced} of ${toSync.length}`, synced === toSync.length ? 'success' : 'warning');
}

// ===== Load Data =====
function loadLocal() {
  const cache = getCache();
  const pend = getPend().filter(e => !wasSent(e.uniqueId));
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
      
      const pend = getPend().filter(e => !wasSent(e.uniqueId));
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
  } catch (err) { console.log('Auto-load error:', err); }
}

async function loadData() {
  if (!CFG.url) { toast('Configure URL first', 'warning'); loadLocal(); return; }
  if (!online) { toast('You are offline', 'warning'); loadLocal(); return; }
  
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
      
      const pend = getPend().filter(e => !wasSent(e.uniqueId));
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
      toast(json.message || 'Failed', 'error');
      loadLocal();
    }
  } catch (err) {
    toast('Connection error', 'error');
    loadLocal();
  }
  
  btn.disabled = false;
  btn.innerHTML = '🔄';
}

// ===== Filter =====
function updateLoaderFilter() {
  const sel = $('filterLoader');
  const loaders = [...new Set(allData.map(e => e.dutyName).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">All</option>' + loaders.map(l => `<option value="${l}">${l}</option>`).join('');
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

function renderTable() {
  const tbody = $('reportBody');
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="14" class="empty">No data</td></tr>';
    return;
  }
  
  let html = '';
  filtered.forEach(e => {
    const pend = e.pending && !wasSent(e.uniqueId);
    const shortShift = (e.shift || '').replace(':00', '').replace(' - ', '-');
    
    html += `
      <tr class="${pend ? 'pending' : ''}">
        <td>${formatDate(e.date)}</td>
        <td>${getShortDay(e.date)}</td>
        <td>${shortShift}</td>
        <td>${e.dutyName || '-'}</td>
        <td>${fC(e.activeChipsTotal)}</td>
        <td>${fC(e.endChipsTotal)}</td>
        <td style="color:var(--cyan)">${fC(e.cfr)}</td>
        <td>${fC(e.remittanceTotal)}</td>
        <td>${fC(e.salary)}</td>
        <td style="color:var(--green)">${fC(e.totalRemittances)}</td>
        <td style="color:${pN(e.unremitted) < 0 ? 'var(--red)' : 'var(--yellow)'}">${fC(e.unremitted)}</td>
        <td>${fC(e.bankFee)}</td>
        <td>${(e.remarks || '-').substring(0, 10)}</td>
        <td>${!pend && e.rowIndex ? `<button class="btn small secondary" onclick="openEdit(${e.rowIndex})">✎</button>` : (pend ? '●' : '')}</td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
}

// ===== Edit Modal =====
function openEdit(rowIndex) {
  editRow = rowIndex;
  const entry = allData.find(e => e.rowIndex === rowIndex);
  if (!entry) { toast('Not found', 'error'); return; }
  
  $('editDate').value = entry.date || '';
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
  if (cIdx !== -1) { Object.assign(cache[cIdx], data); saveCache(cache); }
  
  filterData();
  toast('Updated!');
  closeEdit();
  
  // Sync to server
  if (online && CFG.url) {
    fetch(CFG.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    }).then(r => r.json()).then(j => {
      if (!j.success) toast('Sync failed', 'warning');
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
  toast('Deleted');
  closeDelete();
  editRow = null;
  
  // Sync to server
  if (online && CFG.url) {
    fetch(CFG.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'deleteEntry', rowIndex: row })
    }).then(r => r.json()).then(j => {
      if (j.success) setTimeout(() => loadData(), 500);
    }).catch(() => {});
  }
}

// ===== Settings =====
function saveUrl() {
  const url = $('scriptUrl').value.trim();
  if (url) {
    CFG.url = url;
    localStorage.setItem('cfr_url', url);
    toast('URL saved!');
    updateStatus();
  } else toast('Enter URL', 'error');
}

async function testConn() {
  const url = $('scriptUrl').value.trim();
  if (!url) { toast('Enter URL first', 'error'); return; }
  
  try {
    const res = await fetch(url + '?action=test&_=' + Date.now());
    const json = await res.json();
    toast(json.success ? 'Connected!' : 'Failed', json.success ? 'success' : 'error');
  } catch { toast('Failed', 'error'); }
}

function saveCohUrl() {
  const url = $('cohUrl').value.trim();
  if (url) {
    CFG.cohUrl = url;
    localStorage.setItem('coh_url', url);
    toast('COH URL saved!');
    updateCohStatus();
  } else toast('Enter URL', 'error');
}

function updateCohStatus() {
  const st = $('cohStatus');
  if (CFG.cohUrl) {
    st.className = 'coh-status on';
    st.textContent = '● Connected • Auto-sync ON';
  } else {
    st.className = 'coh-status';
    st.textContent = '○ Not configured';
  }
}

async function testCoh() {
  const url = $('cohUrl').value.trim() || CFG.cohUrl;
  if (!url) { toast('Configure COH URL', 'error'); return; }
  
  try {
    const res = await fetch(url + '?action=test&_=' + Date.now());
    const json = await res.json();
    toast(json.success ? 'COH connected!' : 'Failed', json.success ? 'success' : 'error');
  } catch { toast('Failed', 'error'); }
}

function hardRefresh() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()));
  }
  caches.keys().then(names => names.forEach(n => caches.delete(n)));
  toast('Refreshing...');
  setTimeout(() => location.reload(true), 500);
}

function clearAllData() {
  if (!confirm('Clear ALL local data? This cannot be undone.')) return;
  localStorage.clear();
  toast('Cleared');
  setTimeout(() => location.reload(), 500);
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  // Online/Offline
  window.addEventListener('online', () => { online = true; updateStatus(); loadDataSilent(); });
  window.addEventListener('offline', () => { online = false; updateStatus(); });
  updateStatus();
  
  // Settings
  if (CFG.url) $('scriptUrl').value = CFG.url;
  if (CFG.cohUrl) $('cohUrl').value = CFG.cohUrl;
  updateCohStatus();
  
  // Date change
  $('entryDate').addEventListener('change', updateDay);
  
  // Open entry form by default
  document.querySelector('.entry-card').classList.add('open');
  $('toggleIcon').classList.add('up');
  
  // Load data
  loadLocal();
  
  if (CFG.url && online) {
    setTimeout(() => loadDataSilent(), 300);
  }
  
  // Fetch COH data for sync check
  if (CFG.cohUrl && online) {
    setTimeout(() => fetchCohData(), 500);
  }
});

// Close modals on outside click
$('editModal').addEventListener('click', e => { if (e.target === $('editModal')) closeEdit(); });
$('deleteModal').addEventListener('click', e => { if (e.target === $('deleteModal')) closeDelete(); });

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
