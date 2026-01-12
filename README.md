# WackyBuds CFR System v2

**Cash For Remittance Report System** - Multi-Entry Support

A Progressive Web App (PWA) for tracking CFR with dynamic multi-entry support for Active Chips, End Chips, and Remittances.

---

## ✨ What's New in v2

- **📅 Calendar Date Picker** - Click to select dates visually
- **➕ Multi-Entry Active Chips** - Add multiple entries (Starting Chips, Additional Chips, Cash Out, etc.)
- **📉 Multi-Entry End Chips** - Add multiple entries (Ending Chips, CI Tru Admin, etc.)
- **💸 Multi-Entry Remittances** - Add multiple remittance entries
- **🧮 Real-time Calculations** - CFR, Total Remittances, and Unremitted update instantly
- **📱 Full PWA Support** - Install as mobile app

---

## 📋 Form Structure

| Field | Type | Description |
|-------|------|-------------|
| **DATE** | Calendar Picker | Click to select date |
| **DAY** | Auto-filled | Automatically set from date |
| **SHIFT** | Dropdown | Select shift time |
| **DUTY NAME** | Text | Loader name (e.g., MRN, BOK) |
| **ACTIVE CHIPS** | Multi-Entry | Add multiple: Amount + Remarks |
| **END CHIPS** | Multi-Entry | Add multiple: Amount + Remarks |
| **REMITTANCE** | Multi-Entry | Add multiple: Amount + Remarks |
| **BANK FEE** | Number | Default: ₱15.00 |
| **SALARY** | Number | Loader salary |
| **REMARKS** | Text | Status or notes |

---

## 🧮 Formulas (Same as Excel)

```
CFR = Active Chips Total - End Chips Total

Total Remittances = Remittance Total + Salary

Unremitted = Total Remittances - CFR
```

---

## 🚀 Quick Setup

### Step 1: Deploy to GitHub Pages

1. Create a new GitHub repository
2. Upload all files from this folder
3. Go to **Settings → Pages**
4. Set Source to **main** branch, **/ (root)** folder
5. Click **Save**
6. Your app will be live at: `https://yourusername.github.io/repo-name/`

### Step 2: Setup Google Sheets

1. Create a new Google Sheet
2. Go to **Extensions → Apps Script**
3. Delete default code and paste contents of `Code.gs`
4. Update `SPREADSHEET_ID` with your sheet ID:
   - Sheet URL: `https://docs.google.com/spreadsheets/d/YOUR_ID_HERE/edit`
   - Copy the ID between `/d/` and `/edit`

### Step 3: Deploy Apps Script

1. Click **Deploy → New deployment**
2. Select type: **Web app**
3. Settings:
   - Description: "CFR API v2"
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**
5. Authorize when prompted
6. Copy the **Web app URL**

### Step 4: Configure the App

1. Open your deployed PWA
2. Go to **Settings** tab
3. Paste the Apps Script URL
4. Click **Test Connection**
5. You're ready to go! 🎉

---

## 📱 Install as Mobile App

### Android
1. Open the app in Chrome
2. Tap the **Install** prompt OR
3. Menu (⋮) → **Add to Home Screen**

### iOS
1. Open the app in Safari
2. Tap Share button
3. Tap **Add to Home Screen**

### Desktop
1. Open in Chrome/Edge
2. Click install icon in address bar

---

## 📁 File Structure

```
cfr-app-v2/
├── index.html      # Main PWA application
├── Code.gs         # Google Apps Script backend
├── manifest.json   # PWA manifest
├── sw.js           # Service Worker (offline support)
├── favicon.ico     # Browser icon
├── icons/          # PWA icons
│   ├── icon-72.png
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-144.png
│   ├── icon-152.png
│   ├── icon-192.png
│   ├── icon-384.png
│   └── icon-512.png
└── README.md       # This file
```

---

## 📊 Google Sheet Structure

The app automatically creates a sheet named `CFR_DATA` with these columns:

| Column | Field |
|--------|-------|
| A | Date |
| B | Day |
| C | Shift |
| D | Duty Name |
| E | Active Chips Total |
| F | Active Chips Details |
| G | End Chips Total |
| H | End Chips Details |
| I | CFR |
| J | Remittance Total |
| K | Remittance Details |
| L | Salary |
| M | Total Remittances |
| N | Unremitted |
| O | Bank Fee |
| P | Remarks |

---

## 🔧 Troubleshooting

### "Connection failed" error
- Check that the Apps Script URL is correct
- Make sure the script is deployed as "Anyone can access"
- Try redeploying the Apps Script

### Data not saving
- Verify the SPREADSHEET_ID in Code.gs
- Check you have edit access to the Google Sheet
- Look at Apps Script logs for errors

### App not installing
- Make sure you're using HTTPS
- Clear browser cache and try again
- Check manifest.json is accessible

---

## 💡 Tips

1. **Quick Entry**: The form remembers your settings - just update amounts and save
2. **Multi-Entry**: Click "+ Add Entry" to add more items under each category
3. **Calculations**: Watch the real-time calculations at the bottom
4. **Export**: Use the Report tab to export data to CSV

---

## 📞 Support

For issues or feature requests, contact your system administrator.

---

**Version 2.0.0** | Built for WackyBuds Team
