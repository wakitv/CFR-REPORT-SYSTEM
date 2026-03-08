/**
 * WackyBuds CFR v5.9.0
 * Features: Auto-fill, Next entry, COH sync, Offline support
 */

// ===== Config =====
const STR = { pend: 'cfr_pend_v5', sent: 'cfr_sent_v5', cache: 'cfr_cache_v5', config: 'cfr_config_v5', lastEnd: 'cfr_last_end' };
const TZ = 'Asia/Manila';

// Shift cycle order (for determining next entry)
const SHIFT_CYC = ['4:00AM - 12:00PM', '12:00PM - 8:00PM', '8:00PM - 4:00AM'];
// Shift order for sorting (business day order)
const SHIFT_ORD = { '4:00AM - 12:00PM': 1, '12:00PM - 8:00PM': 2, '8:00PM - 4:00AM': 3 };
// Shift map for COH
const SHIFT_MAP = {
  '4:00AM - 12:00PM': '4AM - 12NN (Morning)',
  '12:00PM - 8:00PM': '12NN - 8PM (Afternoon)',
  '8:00PM - 4:00AM': '8PM - 4AM (Graveyard)'
};

// ===== State =====
let CFG = JSON.parse(localStorage.getItem(STR.config) || '{}');
let allData = [];
let filtered = [];
let lastEnd = parseFloat(localStorage.getItem(STR.lastEnd)) || 0;
let editRow = null;
let online = navigator.onLine;
let submitting = false;

// ===== Helpers =====
const $ = id => document.getElementById(id);
const pN = v => { if (v === null || v === undefined || v === '') return 0; const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };
const fmtNum = n => parseFloat(n || 0).toLocaleString('en-US');
const fV = v => (!v && v !== 0) ? '' : fmtNum(v);
const genId = () => Date.now() + '-' + Math.random().toString(36).substr(2, 9);

function formatInput(el) {
  let v = el.value.replace(/[^0-9.]/g, '');
  const parts = v.split('.');
  if (parts[0]) parts[0] = parseInt(parts[0] || 0).toLocaleString('en-US');
  el.value = parts.length > 1 ? parts[0] + '.' + parts.slice(1).join('') : parts[0];
}

const fTime = () => new Date().toLocaleTimeString('en-US', { timeZone: TZ, hour12: false });
const fDateFull = (d = new Date()) => d.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const fDateShort = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-';
const getDayName = d => ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(d + 'T12:00:00').getDay()];

// Storage
const getPend = () => JSON.parse(localStorage.getItem(STR.pend) || '[]');
const savePend = d => localStorage.setItem(STR.pend, JSON.stringify(d));
const getSent = () => JSON.parse(localStorage.getItem(STR.sent) || '[]');
const saveSent = d => localStorage.setItem(STR.sent, JSON.stringify(d));
const wasSent = id => getSent().includes(id);
const markSent = id => { const s = getSent(); if (!s.includes(id)) { s.push(id); saveSent(s); } };
const getCache = () => JSON.parse(localStorage.getItem(STR.cache) || '[]');
const saveCache = d => localStorage.setItem(STR.cache, JSON.stringify(d));
const setLastEnd = v => { lastEnd = pN(v); localStorage.setItem(STR.lastEnd, lastEnd); };

// Toast
function toast(msg, type = 'info') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 3000);
}

// ===== Clock =====
function updateClock() {
  $('clock').textContent = fTime();
  $('date').textContent = fDateFull();
}

function updateDay() {
  const d = $('entryDate').value;
  $('entryDay').value = d ? getDayName(d) : '';
}

// ===== Status =====
function updateStatus() {
  const dot = $('statusDot');
  const txt = $('statusText');
  const pend = getPend().filter(e => !wasSent(e.uniqueId));
  
  if (!online) {
    dot.className = 'status-dot offline';
    txt.textContent = 'Offline';
  } else if (pend.length > 0) {
    dot.className = 'status-dot pending';
    txt.textContent = 'Pending';
  } else {
    dot.className = 'status-dot online';
    txt.textContent = 'Online';
  }
}

function updatePendUI() {
  const pend = getPend().filter(e => !wasSent(e.uniqueId));
  const badge = $('pendingBadge');
  const count = $('pendingCount');
  
  if (pend.length > 0) {
    badge.style.display = 'inline';
    badge.textContent = pend.length;
  } else {
    badge.style.display = 'none';
  }
  
  if (count) count.textContent = pend.length;
  updateStatus();
}

// ===== Tabs =====
function initTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      $('tab-' + tab).classList.add('active');
    });
  });
}

// ===== Next Entry =====
function getNext() {
  const sorted = [...allData].sort((a, b) => 
    new Date(b.date) - new Date(a.date) || (SHIFT_ORD[a.shift] || 0) - (SHIFT_ORD[b.shift] || 0)
  );
  
  if (sorted.length === 0) {
    return { date: new Date().toISOString().split('T')[0], shift: SHIFT_CYC[0] };
  }
  
  const last = sorted[0];
  const idx = SHIFT_CYC.indexOf(last.shift);
  
  if (idx === -1) {
    return { date: new Date().toISOString().split('T')[0], shift: SHIFT_CYC[0] };
  }
  
  // If last shift is 8PM-4AM (index 2), next day starts with 4AM-12PM
  if (idx === 2) {
    const d = new Date(last.date + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return { date: d.toISOString().split('T')[0], shift: SHIFT_CYC[0] };
  }
  
  // Same day, next shift
  return { date: last.date, shift: SHIFT_CYC[idx + 1] };
}

function setNext() {
  const n = getNext();
  $('entryDate').value = n.date;
  $('entryShift').value = n.shift;
  updateDay();
  $('nextEntryHint').innerHTML = '<span class="next-icon">→</span><span>Next Entry: <strong>' + fDateShort(n.date) + ' • ' + n.shift + '</strong></span>';
}

// ===== Auto-fill Starting (from last End Chips) =====
function updateStarting() {
  const list = $('activeList');
  const existing = list.querySelector('.starting');
  
  if (lastEnd > 0) {
    if (existing) {
      existing.querySelector('.amt').value = fV(lastEnd);
    } else {
      const row = document.createElement('div');
      row.className = 'chip-row starting';
      row.innerHTML = `
        <input type="text" inputmode="decimal" class="chip-input amt" value="${fV(lastEnd)}" onkeyup="formatInput(this)" oninput="calc()">
        <input type="text" class="chip-input" value="Starting (Prev End)">
        <button type="button" class="btn-remove" onclick="removeRow(this)">×</button>
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
  row.className = 'chip-row';
  row.innerHTML = `
    <input type="text" inputmode="decimal" placeholder="Amount" class="chip-input amt" onkeyup="formatInput(this)" oninput="calc()">
    <input type="text" class="chip-input" value="${def}" placeholder="Description">
    <button type="button" class="btn-remove" onclick="removeRow(this)">×</button>
  `;
  list.appendChild(row);
  row.querySelector('.amt').focus();
}

function removeRow(btn) {
  const row = btn.closest('.chip-row');
  const list = row.parentElement;
  if (list.children.length > 1 || row.classList.contains('starting')) {
    row.remove();
    calc();
  }
}

const getSum = id => {
  let s = 0;
  $(id).querySelectorAll('.amt').forEach(i => s += pN(i.value));
  return s;
};

const getDetails = id => {
  const items = [];
  $(id).querySelectorAll('.chip-row').forEach(row => {
    const amt = pN(row.querySelector('.amt').value);
    const rem = row.querySelectorAll('.chip-input')[1]?.value || '';
    if (amt > 0) items.push({ amount: amt, remarks: rem });
  });
  return items;
};

// ===== Calculate =====
function calc() {
  const active = getSum('activeList');
  const end = getSum('endList');
  const remit = getSum('remitList');
  const salary = pN($('salary').value);
  const cfr = active - end;
  const total = remit + salary;
  const unremit = total - cfr;
  
  $('activeTotal').textContent = '₱' + fmtNum(active);
  $('endTotal').textContent = '₱' + fmtNum(end);
  $('remitTotal').textContent = '₱' + fmtNum(remit);
  
  $('statCFR').textContent = '₱' + fmtNum(cfr);
  $('statRemit').textContent = '₱' + fmtNum(remit);
  $('statUnremit').textContent = '₱' + fmtNum(unremit);
  
  $('calcActive').textContent = '₱' + fmtNum(active);
  $('calcEnd').textContent = '₱' + fmtNum(end);
  $('calcCFR').textContent = '₱' + fmtNum(cfr);
  $('calcRemit').textContent = '₱' + fmtNum(remit);
  $('calcSalary').textContent = '₱' + fmtNum(salary);
  $('calcTotal').textContent = '₱' + fmtNum(total);
  $('calcUnremit').textContent = '₱' + fmtNum(unremit);
}

// ===== Form =====
function validate() {
  let valid = true;
  if (!$('entryDate').value) valid = false;
  if (!$('entryShift').value) valid = false;
  if (!$('entryLoader').value.trim()) valid = false;
  return valid;
}

function clearForm() {
  $('entryLoader').value = '';
  $('bankFee').value = '15';
  $('salary').value = '0';
  $('remarks').value = 'DONE';
  
  ['endList', 'remitList'].forEach((id, i) => {
    const list = $(id);
    const def = i === 0 ? 'End Chips' : 'Remittance';
    list.querySelectorAll('.chip-row').forEach((r, j) => {
      if (j === 0) {
        r.querySelector('.amt').value = '';
        r.querySelectorAll('.chip-input')[1].value = def;
      } else {
        r.remove();
      }
    });
  });
  
  $('activeList').querySelectorAll('.chip-row:not(.starting)').forEach(r => r.remove());
  
  setNext();
  updateStarting();
}

// ===== Submit =====
$('entryForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  
  if (!validate()) {
    toast('Please fill all required fields', 'error');
    return;
  }
  
  const btn = $('submitBtn');
  if (btn.disabled || submitting) return;
  
  submitting = true;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Saving...';
  
  const activeTotal = getSum('activeList');
  const endTotal = getSum('endList');
  const remitTotal = getSum('remitList');
  const salary = pN($('salary').value);
  
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
    remittanceTotal: remitTotal,
    bankFee: pN($('bankFee').value),
    salary: salary,
    remarks: $('remarks').value || 'DONE',
    timestamp: new Date().toISOString()
  };
  
  entry.cfr = activeTotal - endTotal;
  entry.totalRemittances = remitTotal + salary;
  entry.unremitted = entry.totalRemittances - entry.cfr;
  
  // Save to pending
  const pend = getPend();
  pend.push(entry);
  savePend(pend);
  
  // Add to local data
  allData.unshift({ ...entry, pending: true });
  filterData();
  
  // Update last end chips
  setLastEnd(endTotal);
  
  // Clear form
  clearForm();
  
  toast('Entry saved successfully!', 'success');
  
  btn.innerHTML = '💾 Save Entry';
  btn.disabled = false;
  submitting = false;
  
  // Send to server
  if (online && CFG.url) {
    setTimeout(() => sendToServer(entry), 100);
  }
});

// ===== Send to Server =====
async function sendToServer(entry) {
  if (!CFG.url || !online) return;
  
  try {
    const res = await fetch(CFG.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(entry)
    });
    
    const json = await res.json();
    
    if (json.success) {
      markSent(entry.uniqueId);
      updatePendUI();
      
      // Sync to COH
      if (CFG.cohUrl) {
        syncToCOH(entry);
      }
    }
  } catch (err) {
    console.log('Send error:', err);
  }
}

// ===== COH Sync =====
async function syncToCOH(entry) {
  if (!CFG.cohUrl) return;
  
  try {
    const payload = {
      action: 'addEntry',
      date: entry.date,
      shift: SHIFT_MAP[entry.shift] || entry.shift,
      dutyName: entry.dutyName,
      activeChips: entry.activeChips,
      endChips: entry.endChips,
      remittance: entry.remittances,
      bankFee: entry.bankFee,
      remarks: entry.remarks,
      rowId: 'CFR-' + entry.uniqueId
    };
    
    await fetch(CFG.cohUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.log('COH sync error:', err);
  }
}

// ===== Load Data =====
function loadLocal() {
  const cache = getCache();
  const pend = getPend().filter(e => !wasSent(e.uniqueId));
  allData = [...pend.map(p => ({ ...p, pending: true })), ...cache];
  filterData();
  updateLoaderFilter();
  
  const sorted = [...allData].filter(e => !e.pending).sort((a, b) => 
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
      
      const sorted = [...allData].filter(e => !e.pending).sort((a, b) => 
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
      
      const pend = getPend().filter(e => !wasSent(e.uniqueId));
      allData = [...pend.map(p => ({ ...p, pending: true })), ...entries];
      filterData();
      updateLoaderFilter();
      
      const sorted = [...allData].filter(e => !e.pending).sort((a, b) => 
        new Date(b.date) - new Date(a.date) || (SHIFT_ORD[a.shift] || 0) - (SHIFT_ORD[b.shift] || 0)
      );
      
      if (sorted[0]?.endChipsTotal !== undefined) {
        setLastEnd(sorted[0].endChipsTotal);
      }
      
      setNext();
      updateStarting();
      updatePendUI();
      
      toast('Loaded ' + entries.length + ' entries', 'success');
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

// ===== Filter =====
function updateLoaderFilter() {
  const sel = $('filterLoader');
  const loaders = [...new Set(allData.map(e => e.dutyName).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">All Loaders</option>' + loaders.map(l => `<option value="${l}">${l}</option>`).join('');
}

function filterData() {
  let d = allData;
  
  const loader = $('filterLoader')?.value;
  if (loader) d = d.filter(e => e.dutyName === loader);
  
  const start = $('filterStart')?.value;
  const end = $('filterEnd')?.value;
  if (start) d = d.filter(e => e.date >= start);
  if (end) d = d.filter(e => e.date <= end);
  
  d.sort((a, b) => new Date(b.date) - new Date(a.date) || (SHIFT_ORD[a.shift] || 0) - (SHIFT_ORD[b.shift] || 0));
  
  filtered = d;
  renderTable();
}

function renderTable() {
  const body = $('recordsBody');
  
  if (filtered.length === 0) {
    body.innerHTML = '<tr><td colspan="9" class="empty">No records</td></tr>';
    return;
  }
  
  body.innerHTML = filtered.map(e => `
    <tr class="${e.pending ? 'pending' : ''}">
      <td>${e.date}</td>
      <td>${e.day || ''}</td>
      <td>${(e.shift || '').split(' - ')[0]}</td>
      <td>${e.dutyName}</td>
      <td>₱${fmtNum(e.activeChipsTotal)}</td>
      <td>₱${fmtNum(e.endChipsTotal)}</td>
      <td>₱${fmtNum(e.cfr)}</td>
      <td>₱${fmtNum(e.remittanceTotal)}</td>
      <td>${e.rowIndex ? `<button class="btn btn-sm" onclick="openEdit(${e.rowIndex})">Edit</button>` : '<span style="color:var(--yellow)">●</span>'}</td>
    </tr>
  `).join('');
}

// ===== Edit Modal =====
function openEdit(rowIndex) {
  const entry = allData.find(e => e.rowIndex === rowIndex);
  if (!entry) return;
  
  editRow = entry;
  
  $('editRowIndex').value = rowIndex;
  $('editDate').value = entry.date;
  $('editShift').value = entry.shift;
  $('editLoader').value = entry.dutyName;
  $('editActive').value = fV(entry.activeChipsTotal);
  $('editEnd').value = fV(entry.endChipsTotal);
  $('editRemit').value = fV(entry.remittanceTotal);
  $('editSalary').value = fV(entry.salary || 0);
  $('editFee').value = fV(entry.bankFee || 15);
  $('editCFR').value = '₱' + fmtNum(entry.cfr);
  
  $('editModal').classList.add('show');
}

function closeModal() {
  $('editModal').classList.remove('show');
  editRow = null;
}

function recalcEdit() {
  const active = pN($('editActive').value);
  const end = pN($('editEnd').value);
  $('editCFR').value = '₱' + fmtNum(active - end);
}

$('editForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  
  if (!CFG.url) {
    toast('Configure URL first', 'error');
    return;
  }
  
  const rowIndex = parseInt($('editRowIndex').value);
  const active = pN($('editActive').value);
  const end = pN($('editEnd').value);
  const remit = pN($('editRemit').value);
  const salary = pN($('editSalary').value);
  
  const data = {
    action: 'updateEntry',
    rowIndex,
    date: $('editDate').value,
    shift: $('editShift').value,
    dutyName: $('editLoader').value.toUpperCase(),
    activeChipsTotal: active,
    endChipsTotal: end,
    cfr: active - end,
    remittanceTotal: remit,
    salary,
    totalRemittances: remit + salary,
    unremitted: (remit + salary) - (active - end),
    bankFee: pN($('editFee').value)
  };
  
  try {
    const res = await fetch(CFG.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    });
    
    const json = await res.json();
    
    if (json.success) {
      toast('Entry updated!', 'success');
      closeModal();
      loadData();
    } else {
      toast('Update failed: ' + json.message, 'error');
    }
  } catch (err) {
    toast('Update failed', 'error');
  }
});

async function deleteEntry() {
  if (!confirm('Delete this entry?')) return;
  
  if (!CFG.url) {
    toast('Configure URL first', 'error');
    return;
  }
  
  const rowIndex = parseInt($('editRowIndex').value);
  
  try {
    const res = await fetch(CFG.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'deleteEntry', rowIndex })
    });
    
    const json = await res.json();
    
    if (json.success) {
      toast('Entry deleted!', 'success');
      closeModal();
      loadData();
    } else {
      toast('Delete failed', 'error');
    }
  } catch (err) {
    toast('Delete failed', 'error');
  }
}

// ===== Settings =====
function saveSettings() {
  CFG.url = $('scriptUrl').value.trim();
  CFG.cohUrl = $('cohUrl').value.trim();
  localStorage.setItem(STR.config, JSON.stringify(CFG));
  updateCohStatus();
  toast('Settings saved!', 'success');
}

function updateCohStatus() {
  const el = $('cohStatus');
  if (CFG.cohUrl) {
    el.textContent = 'COH: Connected';
    el.className = 'coh-status connected';
  } else {
    el.textContent = 'COH: Not configured';
    el.className = 'coh-status';
  }
}

async function testConnection() {
  if (!CFG.url) {
    toast('Enter Script URL first', 'error');
    return;
  }
  
  try {
    const res = await fetch(CFG.url + '?action=test');
    const json = await res.json();
    
    if (json.success) {
      toast('Connected! ' + json.message, 'success');
    } else {
      toast('Connection failed', 'error');
    }
  } catch (err) {
    toast('Connection failed', 'error');
  }
}

async function syncPending() {
  const pend = getPend().filter(e => !wasSent(e.uniqueId));
  
  if (pend.length === 0) {
    toast('No pending entries', 'info');
    return;
  }
  
  if (!CFG.url) {
    toast('Configure URL first', 'error');
    return;
  }
  
  let synced = 0;
  
  for (const entry of pend) {
    try {
      const res = await fetch(CFG.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ ...entry, action: 'addEntry' })
      });
      
      const json = await res.json();
      
      if (json.success) {
        markSent(entry.uniqueId);
        synced++;
        
        if (CFG.cohUrl) {
          syncToCOH(entry);
        }
      }
    } catch (err) {
      console.log('Sync error:', err);
    }
  }
  
  updatePendUI();
  toast(`Synced ${synced} of ${pend.length} entries`, synced > 0 ? 'success' : 'error');
  
  if (synced > 0) loadData();
}

function clearAllData() {
  if (!confirm('Clear all local data?')) return;
  
  localStorage.removeItem(STR.cache);
  localStorage.removeItem(STR.pend);
  localStorage.removeItem(STR.sent);
  localStorage.removeItem(STR.lastEnd);
  
  allData = [];
  filtered = [];
  lastEnd = 0;
  
  renderTable();
  updatePendUI();
  setNext();
  updateStarting();
  
  toast('Data cleared', 'success');
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  // Clock
  updateClock();
  setInterval(updateClock, 1000);
  
  // Online/Offline
  window.addEventListener('online', () => { online = true; updateStatus(); loadDataSilent(); });
  window.addEventListener('offline', () => { online = false; updateStatus(); });
  updateStatus();
  
  // Tabs
  initTabs();
  
  // Settings
  if (CFG.url) $('scriptUrl').value = CFG.url;
  if (CFG.cohUrl) $('cohUrl').value = CFG.cohUrl;
  updateCohStatus();
  
  // Date change
  $('entryDate').addEventListener('change', updateDay);
  
  // Load data
  loadLocal();
  
  if (CFG.url && online) {
    setTimeout(loadDataSilent, 500);
  }
});

// Close modal on outside click
$('editModal')?.addEventListener('click', e => {
  if (e.target === $('editModal')) closeModal();
});

// Service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
