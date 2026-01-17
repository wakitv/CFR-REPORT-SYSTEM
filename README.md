# WackyBuds CFR System v3

## ✨ What's New in v3

| Feature | Description |
|---------|-------------|
| **Starting Chips Auto-Fill** | Automatically pulls from previous END CHIPS value |
| **5 Decimal Precision** | All amounts show 5 decimal places (e.g., 10,000.12345) |
| **Number Formatting** | Comma separator for thousands (e.g., 1,234,567.89012) |
| **Weekly Filter** | Filter by date shows Week 1 (1-7), Week 2 (8-14), etc. |
| **Persistent Filter** | Filter date is saved and restored after refresh |
| **Export to Image** | Export report as PNG image instead of CSV |
| **Edit/Delete Records** | Edit remarks or delete entries from the report |
| **Shift Ordering** | Report sorts by date then shift (12PM→8PM→4AM) |
| **Bank Fee = 0** | Bank fee is always 0 (read-only) |

---

## 📋 Form Fields

| Field | Type | Notes |
|-------|------|-------|
| **DATE** | Calendar Picker | Click to select |
| **DAY** | Auto-filled | From selected date |
| **SHIFT** | Dropdown | 12PM-8PM, 8PM-4AM, 4AM-12PM |
| **DUTY NAME** | Text | Loader name |
| **ACTIVE CHIPS** | Multi-entry | Starting Chips (auto) + additional entries |
| **Button** | + Add Chips / CO by Admin | |
| **END CHIPS** | Multi-entry | Ending chips + deductions |
| **Button** | + Add Deduct Chips / CI by Admin | |
| **REMITTANCE** | Multi-entry | All remittance entries |
| **BANK FEE** | Always 0 | Read-only |
| **SALARY** | Number | |
| **REMARKS** | Text | Status/notes |

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
├── index.html      ← Main app (copy this)
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
2. New project → paste Code.gs
3. Replace YOUR_SPREADSHEET_ID_HERE with your Sheet ID
4. Deploy → Web app → Execute as Me → Anyone can access
5. Copy the URL

### 3. Configure App
1. Open your deployed app
2. Settings tab → paste Apps Script URL
3. Test Connection
4. Done!

---

## 📊 Report Features

- **Filter by Date**: Select any date → shows that week's data
- **Week Grouping**: Week 1 = 1-7, Week 2 = 8-14, etc.
- **Sort Order**: Date ascending, then Shift (12PM→8PM→4AM)
- **Edit**: Click pencil to change remarks
- **Delete**: Click trash to remove entry
- **Export Image**: Camera button downloads PNG screenshot

---

**Version 3.0.0** | WackyBuds CFR System
