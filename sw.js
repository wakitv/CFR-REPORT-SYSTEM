# WackyBuds CFR System v3.1

## ✨ What's New in v3.1

| Feature | Description |
|---------|-------------|
| **Editable Starting Chips** | Can now edit or remove Starting Chips entry |
| **Bank Fee Enabled** | Bank fee field is now editable (not disabled) |
| **Date Range Filter** | Two calendars: Start Date → End Date |
| **Persistent Filter** | Filter dates saved and restored on refresh |
| **Full Edit Modal** | Edit ALL fields: Date, Shift, Loader, Active, End, CFR, Remit, Fee, Unremit, Status |
| **Auto-Recalculate on Edit** | CFR and Unremitted auto-calculate when editing |

---

## 📋 Form Fields

| Field | Type | Notes |
|-------|------|-------|
| **DATE** | Calendar Picker | Click to select |
| **DAY** | Auto-filled | From selected date |
| **SHIFT** | Dropdown | 12PM-8PM, 8PM-4AM, 4AM-12PM |
| **DUTY NAME** | Text | Loader name |
| **ACTIVE CHIPS** | Multi-entry | Starting Chips (editable/removable) + additional |
| **Button** | + Add Chips / CO by Admin | |
| **END CHIPS** | Multi-entry | Ending chips + deductions |
| **Button** | + Add Deduct Chips / CI by Admin | |
| **REMITTANCE** | Multi-entry | All remittance entries |
| **BANK FEE** | Number | Now editable! |
| **SALARY** | Number | |
| **REMARKS** | Text | Status/notes |

---

## 📊 Report Features

### Date Range Filter
1. Click **Start Date** calendar → select first date
2. Click **End Date** calendar → select last date  
3. Report shows all entries between those dates
4. Filter dates are SAVED - will persist after refresh

### Edit Entry (All Fields)
Click ✏️ on any row to edit:
- Date
- Shift
- Loader / Duty Name
- Active Chips
- End Chips
- CFR (auto-calculates)
- Remittance
- Bank Fee
- Salary
- Unremitted (auto-calculates)
- Status / Remarks

---

## 🧮 Formulas

```
CFR = Active Chips Total - End Chips Total

Total Remittances = Remittance Total + Salary

Unremitted = Total Remittances - CFR
```

---

## 📁 Files to Copy

```
/
├── index.html      ← Main app
├── Code.gs         ← Google Apps Script (paste in script editor)
├── manifest.json   ← PWA manifest
├── sw.js           ← Service worker
├── favicon.ico     ← Browser icon
└── icons/          ← PWA icons folder
    ├── icon-72.png
    ├── icon-96.png
    ├── icon-128.png
    ├── icon-144.png
    ├── icon-152.png
    ├── icon-192.png
    ├── icon-384.png
    └── icon-512.png
```

---

## 🚀 Setup

### 1. GitHub Pages
1. Create repository on GitHub
2. Upload all files (keeping folder structure)
3. Settings → Pages → Enable from main branch
4. Your app: `https://username.github.io/repo-name/`

### 2. Google Apps Script
1. Go to script.google.com
2. New project → paste `Code.gs`
3. Replace `YOUR_SPREADSHEET_ID_HERE` with your Sheet ID
4. Deploy → Web app → Execute as Me → Anyone can access
5. Copy the URL

### 3. Configure App
1. Open your deployed app
2. Settings tab → paste Apps Script URL
3. Test Connection
4. Done! ✅

---

**Version 3.1.0** | WackyBuds CFR System
