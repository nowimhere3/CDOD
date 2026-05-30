# 🎯 B2B Lead Generation & Enrichment Engine

**Part One: Lead Search & Sourcing Layer**

A production-ready, serverless B2B lead generation system built with vanilla JavaScript, HTML5, and CSS3. Integrates with Google Gemini AI to identify and score high-intent B2B coaches, thought leaders, and consultants using the "Hungry Fish" qualification framework.

---

## 📋 Features

### Core Functionality
- **Dynamic Batch Calculation**: Automatically calculates sequential API batches (max 50 leads/batch)
- **Gemini AI Integration**: Uses Google Gemini 1.5 Pro for intelligent lead sourcing
- **Global History Log**: Prevents AI amnesia with persistent, keyword-indexed lead tracking
- **Automatic Deduplication**: Final pass removes duplicates across all batches
- **Exhaustion Detection**: Halts execution when no new qualified leads are found
- **Intent Scoring**: Ranks leads 1-7 based on digital fingerprint and behavioral signals

### User Interface
- **Real-time Activity Log**: Live stream of processing events
- **Results Table**: Clean display of harvested leads with intent scores
- **Export Options**: Download leads as CSV or JSON
- **Config Persistence**: Saves settings to browser localStorage
- **Responsive Design**: Works on desktop, tablet, and mobile

### Architectural Layers
1. **Configuration Manager** - API keys, niche, target leads
2. **History & Deduplication Manager** - Global history log with exclusion lists
3. **Batch Calculation Engine** - Math.ceil batch logic
4. **Gemini AI Integration Layer** - API calls with dynamic prompt injection
5. **Results Aggregation & Export** - Combines, deduplicates, exports results
6. **UI Event Manager & Activity Logger** - User interactions and logging

---

## 🚀 Quick Start

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Google Gemini API key (get one free at [aistudio.google.com](https://aistudio.google.com/app/apikeys))

### Installation

1. **Clone or download the repository:**
   ```bash
   git clone https://github.com/nowimhere3/CDOD.git
   cd CDOD
   ```

2. **Set up environment (optional for local development):**
   ```bash
   cp .env.example .env
   # Edit .env and add your Gemini API key
   ```

3. **Run locally:**
   - Option A: Open `index.html` directly in your browser
   - Option B: Use a local server (recommended):
     ```bash
     # Python 3
     python -m http.server 8000
     
     # Or Node.js with http-server
     npx http-server
     ```
   - Then visit `http://localhost:8000` in your browser

---

## 📖 Usage Guide

### Step 1: Configure Settings

1. **Enter Gemini API Key**
   - Get your key from [aistudio.google.com/app/apikeys](https://aistudio.google.com/app/apikeys)
   - Key is saved securely in browser localStorage
   - Can also load from `.env` file during development

2. **Specify Target Niche**
   - Examples: "High-Ticket B2B Coaching", "SaaS Founders", "Digital Marketing Agencies"
   - Used to contextualize AI search queries

3. **Set Target Total Leads**
   - Maximum 1000 leads per session
   - System auto-calculates required batches
   - Example: 120 leads = 3 batches (50 + 50 + 20)

### Step 2: Start Lead Sourcing

1. Click **[ Start ]** button
2. Watch the Activity Log for real-time progress
3. System will:
   - Load historical exclusions for the keyword
   - Execute sequential API batches
   - Parse and score leads (1-7 scale)
   - Log all activity with timestamps
   - Halt on exhaustion signal

### Step 3: Review & Export Results

1. **View Harvested Leads**
   - Results table shows all discovered leads
   - Color-coded intent scores (red=1-2, orange=3-4, green=5-7)
   - Sortable columns with key information

2. **Export Data**
   - Click **📥 Export CSV** for spreadsheet import (Google Sheets, Excel)
   - Click **📥 Export JSON** for programmatic use
   - Includes all fields: name, company, intent score, product, etc.

3. **Manage History**
   - Previous results persist in browser storage
   - Click **🗑️ Clear History** to reset for a keyword
   - System automatically excludes previously found leads in new batches

---

## 🎯 The "Hungry Fish" Ranking System

Each lead is scored 1-7 based on digital fingerprint signals:

| Signal | Points | Description |
|--------|--------|-------------|
| **Paid Media Dominance** | +1 | Uses Facebook, Instagram, YouTube, or Google Ads pixels |
| **VSL/Webinar Tech** | +1 | WebinarJam, Demio, Vidyard, Wistia (15-20 min funnels) |
| **Setter Signal** | +1 | "DM me", hiring for appointment setters, VAs |
| **Closer Signal** | +1 | Strategy session or audit call funnels |
| **Community Ecosystem** | +1 | Hosts Skool, Circle, or Facebook Group |
| **CRM Automation** | +1 | Uses HubSpot, GoHighLevel, Ontraport |
| **Hiring Intent** | +1 | Active job postings for VAs, closers, setters |
| **Recency** | ✓ | Evidence of activity in last 60 days |

**Threshold**: Only leads with score ≥ 2 are included in results

---

## 📊 Data Schema

Each lead record includes:

```json
{
  "fullName": "John Doe",
  "firstName": "John",
  "lastName": "Doe",
  "company": "Doe Enterprises",
  "intentScore": 5,
  "webinarVslType": "WebinarJam VSL",
  "primaryPlatform": "LinkedIn",
  "salesTeam": "Setter + Closer",
  "primaryAds": "Facebook + Instagram",
  "hiring": true,
  "theirBaby": "The Scaling System"
}
```

### Field Definitions

- **fullName**: Person's complete name
- **company**: Company or brand name
- **intentScore**: 1-7 behavioral intent ranking
- **webinarVslType**: Type of webinar/VSL funnel technology
- **primaryPlatform**: Main social/digital platform (LinkedIn, Twitter, etc.)
- **salesTeam**: Sales team structure (Setter, Closer, both, or none)
- **primaryAds**: Active ad platforms (Facebook, Instagram, YouTube, Google)
- **hiring**: Active job postings for sales/operations team
- **theirBaby**: Name of their main paid product/coaching program

---

## 🔧 Configuration & Storage

### Local Storage Keys

The system automatically saves to browser localStorage:

```javascript
'gemini_api_key'    // Your API key (encrypted by browser)
'target_niche'      // Last used niche keyword
'target_leads'      // Last used lead count
'lead_gen_history'  // All discovered leads by keyword
```

### Environment Variables (.env)

For local development, create a `.env` file:

```env
GEMINI_API_KEY=your_key_here
DEFAULT_NICHE=High-Ticket B2B Coaching
DEFAULT_TARGET_LEADS=50
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      UI LAYER (HTML/CSS)                     │
│  Configuration Panel | Activity Log | Results Table          │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────┐
│           EVENT MANAGER & ACTIVITY LOGGER (Layer 6)          │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────┐
│              EXECUTION ENGINE (Main Coordinator)              │
└─────────┬──────────────┬──────────────┬─────────┬────────────┘
          │              │              │         │
     ┌────▼──┐    ┌──────▼──┐   ┌──────▼────┐   │
     │ Config│    │ Batch   │   │ Gemini    │   │
     │Manager│    │Calculator   │Integration   │   │
     │(L1)   │    │(L3)     │   │Layer(L4)  │   │
     └────────    └─────────┘   └───────────┘   │
                                                  │
              ┌──────────────────────────────────▼──┐
              │ History & Dedup Manager (Layer 2)   │
              │ - Global History Log                │
              │ - Exclusion Lists                   │
              └──────────────────────────────────────┘
                                │
                ┌───────────────▼────────────────┐
                │ Results Aggregator (Layer 5)   │
                │ - Combine Batches              │
                │ - Final Dedup                  │
                │ - CSV/JSON Export              │
                └────────────────────────────────┘
```

---

## 🔄 Batch Processing Flow

```
User Input (Niche, Target Leads)
        ↓
Calculate Batches (Math.ceil / 50)
        ↓
Load Historical Exclusions for Niche
        ↓
FOR EACH BATCH:
  ├─ Build Dynamic Prompt (niche + batch size + exclusions)
  ├─ Call Gemini API
  ├─ Parse & Score Leads (filter score < 2)
  ├─ Check Exhaustion (empty response = halt)
  ├─ Add to History for Niche
  └─ Log Activity & Continue
        ↓
Final Aggregation & Deduplication
        ↓
Display Results Table
        ↓
Enable Export (CSV/JSON)
```

---

## 🛡️ Security & Privacy

- **API Keys**: Never hardcoded. Loaded from `.env` (dev) or localStorage (browser)
- **Local Storage**: All data stored locally in browser—no external servers
- **No Tracking**: Zero analytics, no external calls except to Gemini API
- **Git Protection**: `.env` in `.gitignore` prevents accidental commits

---

## 📈 Scaling to Part Two: Manus Enrichment

The architecture is designed for seamless extension:

### Proposed Part Two Structure

```javascript
// Layer 7: Manus Enrichment Manager
const ManusEnrichmentManager = {
    // Takes leads from Part One output
    enrichLeads(leads) {
        // Call Manus API for additional data
        // Email validation, company research, etc.
    },
};

// Layer 8: Unified Export Engine
const UnifiedExportEngine = {
    // Combines Part One + Part Two results
    // Generates comprehensive lead profiles
};
```

**Integration Point**: `Part One Output` → `Manus Enrichment` → `Final Unified Dataset`

---

## 🐛 Troubleshooting

### "Invalid API Key" Error
- Verify your Gemini API key at [aistudio.google.com](https://aistudio.google.com/app/apikeys)
- Ensure key is entered correctly (copy-paste recommended)
- Check your quota hasn't been exceeded

### "No new qualified leads" (Early Exhaustion)
- Niche may be too narrow—try broader keywords
- All available leads may have been discovered—check history
- Intent scoring threshold (≥2) may be filtering too much

### Results Not Saving
- Ensure browser allows localStorage (privacy mode may block it)
- Check browser storage hasn't hit quota limit
- Clear cache and refresh if experiencing issues

### Slow Performance
- Batch execution is sequential—large lead counts take time
- Network connection affects Gemini API response times
- Try smaller batches first (e.g., 50-100 leads)

---

## 📦 Files Structure

```
CDOD/
├── index.html          # Main UI structure
├── app.js             # Complete execution engine (6 layers)
├── styles.css         # Comprehensive styling + responsive
├── .env.example       # Environment template
├── .gitignore         # Ignore sensitive files
└── README.md          # This file
```

---

## 🤝 Contributing

This is Part One of a larger system. Future enhancements:

- [ ] Part Two: Manus API Enrichment
- [ ] Database integration for lead history
- [ ] Advanced filtering & segmentation
- [ ] Bulk email validation
- [ ] LinkedIn integration
- [ ] Webhook support for external apps
- [ ] API endpoint wrapping

---

## 📝 License

MIT License - Feel free to use and modify for your projects

---

## 🎯 Next Steps

1. **Get your Gemini API key** → [aistudio.google.com/app/apikeys](https://aistudio.google.com/app/apikeys)
2. **Open index.html** in your browser
3. **Configure your niche** and target lead count
4. **Click [Start]** and watch the magic happen
5. **Export results** for your sales team

---

## 📞 Support

For issues or questions:
1. Check the **Troubleshooting** section above
2. Review the **Architecture Overview** to understand data flow
3. Check browser console for detailed error logs
4. Verify `.env` is set up correctly (if using local development)

---

**Built with ❤️ using vanilla JS, HTML5, CSS3**

*Ready to source high-intent B2B leads at scale.*