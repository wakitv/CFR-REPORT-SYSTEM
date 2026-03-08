/**
 * WackyBuds CFR - App v5.9.0
 */

// ===== Configuration =====
const STORAGE_KEYS = {
  pending: 'cfr_pending_v5',
  sent: 'cfr_sent_v5',
  cache: 'cfr_cache_v5',
  config: 'cfr_config_v5'
};

const SHIFT_ORDER = {
  '4:00AM - 12:00PM': 1,
  '12:00PM - 8:00PM': 2,
  '8:00PM - 4:00AM': 3
};

const SHIFT_MAP = {
  '4:00AM - 12:00PM': '4AM - 12NN (Morning)',
  '12:00PM - 8:00PM': '12NN - 8PM (Afternoon)',
  '8:00PM - 4:00AM': '8PM - 4AM (Graveyard)'
};

// ===== State =====
let config = JSON.parse(localStorage.getItem(STORAGE_KEYS.config) || '{}');
let allData = [];
let filteredData = [];
let online = navigator.onLine;
let editingEntry = null;

// ===== Helpers =====
const $ = id => document.getElementById(id);
const formatNum = n => parseFloat(n || 0).toLocaleString('en-US');
const formatMoney = n => '₱' + formatNum(n);
const parseNum = s => parseFloat(String(s || 0).replace(/,/g, '')) || 0;

function generateId() {
  return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function getDayName(dateStr) {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

function showToast(message, type = 'info') {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  setTimeout(() => toast.className = 'toast', 3000);
}

// ===== Clock =====
function updateClock() {
  const now = new Date();
  $('clock').textContent = now.toLocaleTimeString('en-US', { hour12: false });
  $('date').textContent = now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// ===== Status =====
function updateStatus() {
  const status = $('status');
  if (online) {
    status.textContent = '● Online';
    status.className = 'status';
  } else {
    status.textContent = '● Offline';
    status.className = 'status offline';
  }
}

// ===== Tabs =====
function initTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      
      // Update nav buttons
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update tab content
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      $('tab-' + tab).classList.add('active');
    });
  });
}

// ===== Chip Rows =====
function addChipRow(containerId) {
  const container = $(containerId);
  const row = document.createElement('div');
  row.className = 'chip-row';
  row.innerHTML = `
    <input type="number" placeholder="Amount" class="chip-amount">
    <input type="text" placeholder="Remarks" class="chip-remarks">
    <button type="button" class="btn-icon" onclick="removeChipRow(this)">×</button>
  `;
  container.appendChild(row);
  updateSummary();
}

function removeChipRow(btn) {
  const container = btn.closest('.chip-row').parentElement;
  if (container.children.length > 1) {
    btn.closest('.chip-row').remove();
    updateSummary();
  }
}

function getChipData(containerId) {
  const rows = $(containerId).querySelectorAll('.chip-row');
  const data = [];
  rows.forEach(row => {
    const amount = parseNum(row.querySelector('.chip-amount').value);
    const remarks = row.querySelector('.chip-remarks').value || '';
    if (amount > 0) {
      data.push({ amount, remarks });
    }
  });
  return data;
}

function getChipTotal(containerId) {
  return getChipData(containerId).reduce((sum, item) => sum + item.amount, 0);
}

// ===== Summary =====
function updateSummary() {
  const active = getChipTotal('activeChipsContainer');
  const end = getChipTotal('endChipsContainer');
  const remit = getChipTotal('remitContainer');
  const salary = parseNum($('entrySalary').value);
  const cfr = active - end;
  const total = remit + salary;
  const unremit = total - cfr;
  
  $('sumActive').textContent = formatMoney(active);
  $('sumEnd').textContent = formatMoney(end);
  $('sumCfr').textContent = formatMoney(cfr);
  $('sumRemit').textContent = formatMoney(remit);
  $('sumSalary').textContent = formatMoney(salary);
  $('sumTotal').textContent = formatMoney(total);
  $('sumUnremit').textContent = formatMoney(unremit);
}

// ===== Form =====
function initForm() {
  // Set default date
  $('entryDate').value = new Date().toISOString().split('T')[0];
  
  // Listen for changes to update summary
  ['activeChipsContainer', 'endChipsContainer', 'remitContainer'].forEach(id => {
    $(id).addEventListener('input', updateSummary);
  });
  
  $('entrySalary').addEventListener('input', updateSummary);
  
  // Form submit
  $('entryForm').addEventListener('submit', handleSubmit);
  
  updateSummary();
}

function resetForm() {
  $('entryForm').reset();
  $('entryDate').value = new Date().toISOString().split('T')[0];
  
  // Reset chip rows
  ['activeChipsContainer', 'endChipsContainer', 'remitContainer'].forEach(id => {
    const container = $(id);
    container.innerHTML = `
      <div class="chip-row">
        <input type="number" placeholder="Amount" class="chip-amount">
        <input type="text" placeholder="Remarks" class="chip-remarks" value="${id === 'activeChipsContainer' ? 'Starting (Prev End)' : id === 'endChipsContainer' ? 'End Chips' : 'Remittance'}">
        <button type="button" class="btn-icon" onclick="removeChipRow(this)">×</button>
      </div>
    `;
  });
  
  $('entryRemarks').value = 'DONE';
  $('entryBankFee').value = '15';
  updateSummary();
}

async function handleSubmit(e) {
  e.preventDefault();
  
  const date = $('entryDate').value;
  const shift = $('entryShift').value;
  const loader = $('entryLoader').value.trim().toUpperCase();
  
  if (!date || !shift || !loader) {
    showToast('Please fill all required fields', 'error');
    return;
  }
  
  const activeChips = getChipData('activeChipsContainer');
  const endChips = getChipData('endChipsContainer');
  const remittances = getChipData('remitContainer');
  
  const activeTotal = activeChips.reduce((sum, item) => sum + item.amount, 0);
  const endTotal = endChips.reduce((sum, item) => sum + item.amount, 0);
  const remitTotal = remittances.reduce((sum, item) => sum + item.amount, 0);
  const salary = parseNum($('entrySalary').value);
  const bankFee = parseNum($('entryBankFee').value) || 15;
  const cfr = activeTotal - endTotal;
  const totalRemit = remitTotal + salary;
  const unremit = totalRemit - cfr;
  
  const entry = {
    date,
    day: getDayName(date),
    shift,
    dutyName: loader,
    activeChips,
    endChips,
    remittances,
    activeChipsTotal: activeTotal,
    endChipsTotal: endTotal,
    remittanceTotal: remitTotal,
    cfr,
    salary,
    totalRemittances: totalRemit,
    unremitted: unremit,
    bankFee,
    remarks: $('entryRemarks').value || 'DONE',
    uniqueId: generateId(),
    timestamp: new Date().toISOString()
  };
  
  // Save entry
  await saveEntry(entry);
  
  showToast('Entry saved successfully!', 'success');
  resetForm();
  loadData();
  
  // Switch to dashboard
  document.querySelector('[data-tab="dashboard"]').click();
}

// ===== Data Operations =====
async function saveEntry(entry) {
  if (!config.url) {
    // Save to pending
    const pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.pending) || '[]');
    pending.push(entry);
    localStorage.setItem(STORAGE_KEYS.pending, JSON.stringify(pending));
    updatePendingCount();
    return;
  }
  
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'addEntry', ...entry })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Sync to COH if configured
      if (config.cohUrl) {
        syncToCOH(entry);
      }
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Save error:', error);
    // Save to pending
    const pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.pending) || '[]');
    pending.push(entry);
    localStorage.setItem(STORAGE_KEYS.pending, JSON.stringify(pending));
    updatePendingCount();
  }
}

async function loadData() {
  if (!config.url) {
    loadFromCache();
    return;
  }
  
  try {
    const response = await fetch(config.url + '?action=getData');
    const result = await response.json();
    
    if (result.success) {
      allData = result.entries || [];
      localStorage.setItem(STORAGE_KEYS.cache, JSON.stringify(allData));
      filterData();
      updateStats();
      updateLoaderFilter();
    }
  } catch (error) {
    console.error('Load error:', error);
    loadFromCache();
  }
}

function loadFromCache() {
  allData = JSON.parse(localStorage.getItem(STORAGE_KEYS.cache) || '[]');
  filterData();
  updateStats();
  updateLoaderFilter();
}

function filterData() {
  let data = [...allData];
  
  const loader = $('filterLoader')?.value;
  if (loader) {
    data = data.filter(e => e.dutyName === loader);
  }
  
  const startDate = $('filterStart')?.value;
  const endDate = $('filterEnd')?.value;
  
  if (startDate) {
    data = data.filter(e => e.date >= startDate);
  }
  if (endDate) {
    data = data.filter(e => e.date <= endDate);
  }
  
  // Sort by date desc, then shift
  data.sort((a, b) => {
    const dateCompare = new Date(b.date) - new Date(a.date);
    if (dateCompare !== 0) return dateCompare;
    return (SHIFT_ORDER[a.shift] || 0) - (SHIFT_ORDER[b.shift] || 0);
  });
  
  filteredData = data;
  renderTables();
}

function updateLoaderFilter() {
  const select = $('filterLoader');
  if (!select) return;
  
  const loaders = [...new Set(allData.map(e => e.dutyName).filter(Boolean))].sort();
  select.innerHTML = '<option value="">All Loaders</option>' + 
    loaders.map(l => `<option value="${l}">${l}</option>`).join('');
}

// ===== Render =====
function renderTables() {
  // Recent entries (dashboard)
  const recentBody = $('recentBody');
  const recent = filteredData.slice(0, 5);
  
  if (recent.length === 0) {
    recentBody.innerHTML = '<tr><td colspan="5" class="empty">No entries yet</td></tr>';
  } else {
    recentBody.innerHTML = recent.map(e => `
      <tr>
        <td>${e.date}</td>
        <td>${e.shift.split(' - ')[0]}</td>
        <td>${e.dutyName}</td>
        <td>${formatMoney(e.cfr)}</td>
        <td>${formatMoney(e.remittanceTotal)}</td>
      </tr>
    `).join('');
  }
  
  // All records
  const recordsBody = $('recordsBody');
  
  if (filteredData.length === 0) {
    recordsBody.innerHTML = '<tr><td colspan="9" class="empty">No records</td></tr>';
  } else {
    recordsBody.innerHTML = filteredData.map(e => `
      <tr>
        <td>${e.date}</td>
        <td>${e.day}</td>
        <td>${e.shift.split(' - ')[0]}</td>
        <td>${e.dutyName}</td>
        <td>${formatMoney(e.activeChipsTotal)}</td>
        <td>${formatMoney(e.endChipsTotal)}</td>
        <td>${formatMoney(e.cfr)}</td>
        <td>${formatMoney(e.remittanceTotal)}</td>
        <td><button class="btn btn-sm" onclick="editEntry(${e.rowIndex})">Edit</button></td>
      </tr>
    `).join('');
  }
}

function updateStats() {
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = allData.filter(e => e.date === today);
  
  const todayCfr = todayEntries.reduce((sum, e) => sum + (e.cfr || 0), 0);
  const todayCoh = todayEntries.reduce((sum, e) => sum + (e.remittanceTotal || 0), 0);
  
  $('todayCfr').textContent = formatMoney(todayCfr);
  $('todayCoh').textContent = formatMoney(todayCoh);
  $('totalEntries').textContent = allData.length;
  
  updatePendingCount();
}

function updatePendingCount() {
  const pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.pending) || '[]');
  $('pendingSync').textContent = pending.length;
  $('pendingCount').textContent = pending.length;
}

// ===== COH Sync =====
async function syncToCOH(entry) {
  if (!config.cohUrl) return;
  
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
    
    await fetch(config.cohUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('COH sync error:', error);
  }
}

// ===== Settings =====
function saveSettings() {
  config.url = $('scriptUrl').value.trim();
  config.cohUrl = $('cohUrl').value.trim();
  localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config));
  showToast('Settings saved!', 'success');
}

async function testConnection() {
  if (!config.url) {
    showToast('Please enter Script URL first', 'error');
    return;
  }
  
  try {
    const response = await fetch(config.url + '?action=test');
    const result = await response.json();
    
    if (result.success) {
      showToast('Connection successful! ' + result.message, 'success');
    } else {
      showToast('Connection failed: ' + result.message, 'error');
    }
  } catch (error) {
    showToast('Connection failed: ' + error.message, 'error');
  }
}

async function syncPending() {
  const pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.pending) || '[]');
  
  if (pending.length === 0) {
    showToast('No pending entries to sync', 'info');
    return;
  }
  
  if (!config.url) {
    showToast('Please configure Script URL first', 'error');
    return;
  }
  
  let synced = 0;
  const remaining = [];
  
  for (const entry of pending) {
    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'addEntry', ...entry })
      });
      
      const result = await response.json();
      
      if (result.success) {
        synced++;
        if (config.cohUrl) {
          syncToCOH(entry);
        }
      } else {
        remaining.push(entry);
      }
    } catch (error) {
      remaining.push(entry);
    }
  }
  
  localStorage.setItem(STORAGE_KEYS.pending, JSON.stringify(remaining));
  updatePendingCount();
  
  showToast(`Synced ${synced} entries. ${remaining.length} remaining.`, synced > 0 ? 'success' : 'error');
  loadData();
}

function clearCache() {
  if (confirm('Clear all cached data?')) {
    localStorage.removeItem(STORAGE_KEYS.cache);
    localStorage.removeItem(STORAGE_KEYS.pending);
    allData = [];
    filteredData = [];
    renderTables();
    updateStats();
    showToast('Cache cleared', 'success');
  }
}

// ===== Edit Modal =====
function editEntry(rowIndex) {
  const entry = allData.find(e => e.rowIndex === rowIndex);
  if (!entry) return;
  
  editingEntry = entry;
  
  $('editRowIndex').value = rowIndex;
  $('editDate').value = entry.date;
  $('editShift').value = entry.shift;
  $('editLoader').value = entry.dutyName;
  $('editActive').value = entry.activeChipsTotal;
  $('editEnd').value = entry.endChipsTotal;
  $('editRemit').value = entry.remittanceTotal;
  $('editSalary').value = entry.salary || 0;
  
  $('editModal').classList.add('show');
}

function closeModal() {
  $('editModal').classList.remove('show');
  editingEntry = null;
}

async function updateEntry(e) {
  e.preventDefault();
  
  if (!config.url) {
    showToast('Please configure Script URL', 'error');
    return;
  }
  
  const rowIndex = parseInt($('editRowIndex').value);
  const activeTotal = parseNum($('editActive').value);
  const endTotal = parseNum($('editEnd').value);
  const remitTotal = parseNum($('editRemit').value);
  const salary = parseNum($('editSalary').value);
  
  const data = {
    action: 'updateEntry',
    rowIndex,
    date: $('editDate').value,
    shift: $('editShift').value,
    dutyName: $('editLoader').value.toUpperCase(),
    activeChipsTotal: activeTotal,
    endChipsTotal: endTotal,
    cfr: activeTotal - endTotal,
    remittanceTotal: remitTotal,
    salary,
    totalRemittances: remitTotal + salary,
    unremitted: (remitTotal + salary) - (activeTotal - endTotal),
    bankFee: editingEntry?.bankFee || 15,
    remarks: editingEntry?.remarks || 'DONE'
  };
  
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('Entry updated!', 'success');
      closeModal();
      loadData();
    } else {
      showToast('Update failed: ' + result.message, 'error');
    }
  } catch (error) {
    showToast('Update failed: ' + error.message, 'error');
  }
}

async function deleteEntry() {
  if (!confirm('Delete this entry?')) return;
  
  if (!config.url) {
    showToast('Please configure Script URL', 'error');
    return;
  }
  
  const rowIndex = parseInt($('editRowIndex').value);
  
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'deleteEntry', rowIndex })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('Entry deleted!', 'success');
      closeModal();
      loadData();
    } else {
      showToast('Delete failed: ' + result.message, 'error');
    }
  } catch (error) {
    showToast('Delete failed: ' + error.message, 'error');
  }
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
  // Clock
  updateClock();
  setInterval(updateClock, 1000);
  
  // Online/Offline
  window.addEventListener('online', () => { online = true; updateStatus(); loadData(); });
  window.addEventListener('offline', () => { online = false; updateStatus(); });
  updateStatus();
  
  // Tabs
  initTabs();
  
  // Form
  initForm();
  
  // Settings
  if (config.url) $('scriptUrl').value = config.url;
  if (config.cohUrl) $('cohUrl').value = config.cohUrl;
  
  // Edit form
  $('editForm').addEventListener('submit', updateEntry);
  
  // Load data
  loadFromCache();
  if (config.url && online) {
    setTimeout(loadData, 500);
  }
});

// Close modal on outside click
$('editModal')?.addEventListener('click', (e) => {
  if (e.target === $('editModal')) closeModal();
});
