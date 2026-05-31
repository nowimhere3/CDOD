# 🎯 B2B Lead Generation & Enrichment Engine

**Part One: Lead Search & Sourcing Layer**

A production-ready B2B lead generation system built with vanilla JavaScript, HTML5, CSS3, and a minimal Node.js/Express backend.  It integrates with Google Gemini AI (via Google Cloud ADC) to identify and score high-intent B2B coaches, thought leaders, and consultants using the "Hungry Fish" qualification framework.

> **Google Cloud org users:** this app no longer uses browser-side API keys.  Authentication is handled server-side via Application Default Credentials (ADC) or a service-account key, which is compatible with Google Cloud org policies that disallow plain API keys.

---

## 📋 Features

### Core Functionality
- **Dynamic Batch Calculation**: Automatically calculates sequential API batches (max 50 leads/batch)
- **Gemini AI Integration**: Uses Google Gemini 2.0 Flash for intelligent lead sourcing
- **Global History Log**: Prevents AI amnesia with persistent, keyword-indexed lead tracking
- **Automatic Deduplication**: Final pass removes duplicates across all batches
- **Exhaustion Detection**: Halts execution when no new qualified leads are found
- **Intent Scoring**: Ranks leads 1-7 based on digital fingerprint and behavioral signals

### User Interface
- **Real-time Activity Log**: Live stream of processing events
- **Results Table**: Clean display of harvested leads with intent scores
- **Export Options**: Download leads as CSV or JSON
- **Config Persistence**: Saves niche & lead-count settings to browser localStorage
- **Responsive Design**: Works on desktop, tablet, and mobile

### Architecture
```
Browser (HTML/CSS/JS)
        │  HTTP POST /api/generate
        │  GET        /api/health
        ▼
Express Backend (server.js)
        │  Authorization: ADC access token
        ▼
Google Gemini REST API
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js ≥ 18** (uses native `fetch`)
- A **Google Cloud project** with the **Generative Language API** (or **Vertex AI**) enabled
- **Google Cloud SDK** (`gcloud`) installed — or a service-account JSON key

### 1 — Clone the repo
```bash
git clone https://github.com/nowimhere3/CDOD.git
cd CDOD
```

### 2 — Install dependencies
```bash
npm install
```

### 3 — Authenticate with Google Cloud

**Option A — Developer workstation (recommended)**
```bash
gcloud auth application-default login
```
Follow the browser prompt.  Credentials are stored in `~/.config/gcloud/`.

**Option B — Service-account key file**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```
Or add it to a `.env` file (see step 4).

**Option C — Deployed on Google Cloud (Cloud Run, GCE, GKE, etc.)**
No extra steps — ADC is picked up automatically from the instance metadata service.

### 4 — Configure environment (optional)
```bash
cp .env.example .env
# Edit .env to change PORT, GEMINI_MODEL, or GOOGLE_APPLICATION_CREDENTIALS
```

### 5 — Start the server
```bash
npm start
```
You should see:
```
✅ Server running on http://localhost:3000
   Model : gemini-2.0-flash
   Auth  : Application Default Credentials (ADC)
```

### 6 — Open the app
Navigate to **http://localhost:3000** in your browser.

Click **🔌 Verify Backend Connection** to confirm the server can reach Gemini before starting a session.

---

## 📖 Usage Guide

### Step 1: Verify the connection
Click **🔌 Verify Backend Connection** to confirm that the backend can authenticate with Google Cloud and reach the Gemini API.

If it fails, check the server console for the exact ADC/auth error message.

### Step 2: Configure settings

1. **Specify Target Niche**
   - Examples: "High-Ticket B2B Coaching", "SaaS Founders", "Digital Marketing Agencies"
   - Used to contextualise AI search queries

2. **Set Target Total Leads**
   - Maximum 1000 leads per session
   - System auto-calculates required batches
   - Example: 120 leads = 3 batches (50 + 50 + 20)

### Step 3: Start lead sourcing
1. Click **[ Start ]**
2. Watch the Activity Log for real-time progress
3. System will:
   - Load historical exclusions for the keyword
   - Execute sequential API batches
   - Parse and score leads (1-7 scale)
   - Log all activity with timestamps
   - Halt on exhaustion signal

### Step 4: Review & export results
- **View Harvested Leads** — colour-coded intent scores (red=1-2, orange=3-4, green=5-7)
- **Export CSV** — spreadsheet import (Google Sheets, Excel)
- **Export JSON** — programmatic use
- **Clear History** — reset lead history for a keyword

---

## ☁️ Google Cloud Setup (detailed)

### Enable the Generative Language API
```bash
gcloud services enable generativelanguage.googleapis.com \
  --project=YOUR_PROJECT_ID
```

### Create a service account (for server/CI deployments)
```bash
# Create the service account
gcloud iam service-accounts create cdod-lead-gen \
  --display-name="CDOD Lead Gen" \
  --project=YOUR_PROJECT_ID

# Grant it permission to call the Gemini API
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:cdod-lead-gen@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Download the key file
gcloud iam service-accounts keys create service-account.json \
  --iam-account=cdod-lead-gen@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

Then set:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
npm start
```

### Deploy to Cloud Run (optional)
```bash
gcloud run deploy cdod-lead-gen \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --project YOUR_PROJECT_ID
```
Cloud Run automatically uses the service's ADC — no key file needed.

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

---

## 🔧 Configuration & Storage

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port the backend listens on |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | *(ADC default)* | Path to service-account JSON key |

### Browser localStorage Keys

| Key | Description |
|-----|-------------|
| `target_niche` | Last used niche keyword |
| `target_leads` | Last used lead count |
| `lead_gen_history` | All discovered leads by keyword |

No API key is ever stored in the browser.

---

## 🏗️ Architecture Overview

```
CDOD/
├── index.html      # Main UI structure
├── app.js          # Frontend execution engine (6 layers)
├── styles.css      # Comprehensive styling + responsive
├── server.js       # Node.js/Express backend proxy (ADC auth)
├── package.json    # Node.js dependencies
├── .env.example    # Environment variable template
├── .gitignore      # Ignores .env, node_modules, etc.
└── README.md       # This file
```

### Backend API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Verify ADC credentials and Gemini reachability |
| `/api/generate` | POST `{ prompt }` | Generate leads via Gemini |
| `/*` | GET | Serve static frontend files |

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
  ├─ POST /api/generate → server → Gemini API (ADC auth)
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

- **No browser API keys** — authentication is handled server-side via ADC
- **Credentials never reach the browser** — the server obtains a short-lived token from Google's metadata service or a service-account key and forwards it only on server-side requests
- **Local storage** — lead history and config stored locally in the browser; no external databases
- **No tracking** — zero analytics, no external calls except to the Gemini API (via the backend)
- **Git protection** — `.env` and `node_modules` are in `.gitignore`

---

## 🐛 Troubleshooting

### "Backend connection failed" / ADC error
- Run `gcloud auth application-default login` (developer workstation)
- Or set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`
- Ensure the **Generative Language API** is enabled in your GCP project

### "Gemini API Error (403)"
- The service account or ADC user may lack the required IAM role
- Grant `roles/aiplatform.user` or `roles/ml.developer` to the principal

### "No new qualified leads" (Early Exhaustion)
- Niche may be too narrow — try broader keywords
- All available leads may have been discovered — check history
- Intent scoring threshold (≥2) may be filtering too aggressively

### Server won't start
- Ensure Node.js ≥ 18 is installed: `node --version`
- Run `npm install` if `node_modules` is missing

---

## 📈 Scaling to Part Two: Manus Enrichment

The architecture is designed for seamless extension:

```javascript
// Layer 7: Manus Enrichment Manager
const ManusEnrichmentManager = {
    enrichLeads(leads) {
        // Call Manus API for additional data
    },
};
```

**Integration Point**: `Part One Output` → `Manus Enrichment` → `Final Unified Dataset`

---

## 📝 License

MIT License - Feel free to use and modify for your projects

---

**Built with ❤️ using vanilla JS, HTML5, CSS3, and Node.js**

*Ready to source high-intent B2B leads at scale — now with Google Cloud ADC.*
