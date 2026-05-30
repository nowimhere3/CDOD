/**
 * ============================================================================
 * B2B Lead Generation & Enrichment Engine - Part One: Lead Search & Sourcing
 * ============================================================================
 * 
 * ARCHITECTURE OVERVIEW:
 * 
 * Layer 1: Configuration Manager
 *   - Handles API key, niche, target leads
 *   - LocalStorage persistence
 *   - Env file support for development
 * 
 * Layer 2: History & Deduplication Manager
 *   - Global History Log (indexed by keyword)
 *   - Tracks all leads ever found for a keyword
 *   - Provides exclusion list for subsequent batches
 * 
 * Layer 3: Batch Calculation Engine
 *   - Math.ceil(totalLeads / 50) batch logic
 *   - Dynamic batch sizing (e.g., 50, 50, 20)
 * 
 * Layer 4: Gemini AI Integration Layer
 *   - Google Gen AI SDK initialization
 *   - Dynamic prompt building with context injection
 *   - Response parsing and validation
 * 
 * Layer 5: Results Aggregation & Export
 *   - Combines all batch results
 *   - Final deduplication
 *   - CSV/JSON export
 *   - Display in results table
 * 
 * Layer 6: UI Event Manager & Activity Logger
 *   - User interactions
 *   - Real-time activity logging
 *   - Processing state management
 */

// ============================================================================
// LAYER 1: CONFIGURATION MANAGER
// ============================================================================

const ConfigManager = {
    // Load Gemini API key from env or localStorage
    async loadGeminiApiKey() {
        try {
            // Check if running in Node-like environment with .env
            if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
                return process.env.GEMINI_API_KEY;
            }
        } catch (e) {
            // Browser environment, ignore
        }

        // Check localStorage
        return localStorage.getItem('gemini_api_key') || '';
    },

    saveGeminiApiKey(key) {
        localStorage.setItem('gemini_api_key', key);
        return true;
    },

    loadTargetNiche() {
        return localStorage.getItem('target_niche') || '';
    },

    saveTargetNiche(niche) {
        localStorage.setItem('target_niche', niche);
        return true;
    },

    loadTargetLeads() {
        const stored = localStorage.getItem('target_leads');
        return stored ? parseInt(stored, 10) : 50;
    },

    saveTargetLeads(count) {
        localStorage.setItem('target_leads', count.toString());
        return true;
    },

    getAllConfig() {
        return {
            geminiApiKey: this.loadGeminiApiKey(),
            targetNiche: this.loadTargetNiche(),
            targetLeads: this.loadTargetLeads(),
        };
    },

    isConfigValid(config) {
        return (
            config.geminiApiKey &&
            config.geminiApiKey.trim().length > 0 &&
            config.targetNiche &&
            config.targetNiche.trim().length > 0 &&
            config.targetLeads &&
            config.targetLeads > 0 &&
            config.targetLeads <= 1000
        );
    },
};

// ============================================================================
// LAYER 2: HISTORY & DEDUPLICATION MANAGER
// ============================================================================

const HistoryManager = {
    STORAGE_KEY: 'lead_gen_history',

    // Get or create history entry for a keyword
    getHistoryForKeyword(keyword) {
        const history = this.getAllHistory();
        if (!history[keyword]) {
            history[keyword] = {
                keyword,
                discoveredLeads: [],
                lastUpdated: null,
                batchCount: 0,
            };
            this.saveAllHistory(history);
        }
        return history[keyword];
    },

    // Add leads to history for a keyword
    addLeadsToHistory(keyword, leads) {
        const history = this.getAllHistory();
        if (!history[keyword]) {
            history[keyword] = {
                keyword,
                discoveredLeads: [],
                lastUpdated: null,
                batchCount: 0,
            };
        }

        // Extract full names from leads and add if not already present
        const existingNames = new Set(
            history[keyword].discoveredLeads.map(l => l.fullName.toLowerCase())
        );

        leads.forEach(lead => {
            if (!existingNames.has(lead.fullName.toLowerCase())) {
                history[keyword].discoveredLeads.push(lead);
                existingNames.add(lead.fullName.toLowerCase());
            }
        });

        history[keyword].lastUpdated = new Date().toISOString();
        history[keyword].batchCount += 1;

        this.saveAllHistory(history);
        return history[keyword];
    },

    // Get exclusion list (all previously found names for a keyword)
    getExclusionList(keyword) {
        const history = this.getHistoryForKeyword(keyword);
        return history.discoveredLeads.map(lead => lead.fullName);
    },

    // Get all previously discovered leads for a keyword
    getAllDiscoveredLeads(keyword) {
        const history = this.getHistoryForKeyword(keyword);
        return history.discoveredLeads;
    },

    getAllHistory() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    },

    saveAllHistory(history) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
        return true;
    },

    clearHistory(keyword = null) {
        if (keyword) {
            const history = this.getAllHistory();
            delete history[keyword];
            this.saveAllHistory(history);
        } else {
            localStorage.removeItem(this.STORAGE_KEY);
        }
        return true;
    },

    getStatistics(keyword) {
        const history = this.getHistoryForKeyword(keyword);
        return {
            totalLeadsFound: history.discoveredLeads.length,
            batchCount: history.batchCount,
            lastUpdated: history.lastUpdated,
        };
    },
};

// ============================================================================
// LAYER 3: BATCH CALCULATION ENGINE
// ============================================================================

const BatchCalculator = {
    BATCH_SIZE: 50,

    calculateBatches(totalLeads) {
        const numBatches = Math.ceil(totalLeads / this.BATCH_SIZE);
        const batches = [];

        for (let i = 0; i < numBatches; i++) {
            const batchNumber = i + 1;
            const remainingLeads = totalLeads - (i * this.BATCH_SIZE);
            const batchSize = Math.min(this.BATCH_SIZE, remainingLeads);

            batches.push({
                batchNumber,
                size: batchSize,
                requestedCount: batchSize,
            });
        }

        return batches;
    },

    formatBatchInfo(batches) {
        return batches
            .map(b => `Batch ${b.batchNumber}: ${b.size} leads`)
            .join(' | ');
    },
};

// ============================================================================
// LAYER 4: GEMINI AI INTEGRATION LAYER
// ============================================================================

const GeminiIntegration = {
    API_ENDPOINT: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
    MODEL: 'gemini-1.5-pro',
    REQUEST_TIMEOUT_MS: 60000,

    // Build the master sourcing prompt with dynamic context injection
    buildMasterPrompt(niche, batchSize, exclusionList = []) {
        const exclusionJson = JSON.stringify(exclusionList, null, 0);

        const systemPrompt = `Role: You are a Senior Growth Marketer and Competitive Intelligence Analyst specializing in high-ticket B2B funnels.

Task: Compile a list of ${batchSize} active B2B coaches, thought leaders, experts or consultants in the ${niche} industry. You are looking for "Hungry Fish"—operators who show clear behavioral signals of running a high-ticket sales operation.

The "Hungry Fish" Ranking System (Scale 1–7):
Rank each lead based on their Digital Fingerprint. Strictly exclude any lead with a score lower than 2.
+1 Point: Paid Media Dominance. Uses tracking pixels for Facebook, Instagram, YouTube, or Google Ads.
+1 Point: Hybrid VSL/Webinar Tech. Uses WebinarJam, Demio, or custom VSL players (Vidyard/Wistia) for 15–20 min high-intensity funnels.
+1 Point: The "Setter" Signal. Evidence of an Appointment Setter (e.g., "DM me a keyword," "Apply to speak with the team," or hiring ads for VAs/Setters).
+1 Point: The "Closer" Signal. Funnel ends in a "Strategy Session" or "Audit" call rather than direct checkout.
+1 Point: Community Ecosystem. Host of a Skool, Circle, or Facebook Group.
+1 Point: CRM Automation. Uses high-end tools like HubSpot, GoHighLevel, or Ontraport.
+1 Point: Hiring Intent. Active job postings for VAs, Sales Closers, or Setters.

Must have recency: Evidence of movement (new ads, LinkedIn events, content, posts or uploads) in the last 60 days.

Exclusion List (STRICT): Do not under any circumstances return any of the following individuals: ${exclusionJson}

Output Format:
Provide the results in a raw JSON array of objects featuring the exact schema below. Return ONLY the JSON array, no other text.

Schema:
[
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
]

Data Input Rule for "Their Baby" Column:
Find their "main product" that they sell and put in this column. This could be the name of their PAID coaching program, or the name of their PAID product, guide or video series. Ideally target the flagship or most expensive offer.
Strict Formatting Cleanup for "Their Baby": REMOVE anything in parentheses. For example, instead of writing "The System (Flagship Video Program)", write exactly "The System".

Important: Return ONLY the JSON array, no markdown, no explanations, no extra text.`;

        return systemPrompt;
    },

    // Call Gemini API with streaming support
    async callGeminiAPI(apiKey, prompt) {
        try {
            const response = await fetch(
                `${this.API_ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: this.MODEL,
                        contents: [
                            {
                                role: 'user',
                                parts: [
                                    {
                                        text: prompt,
                                    },
                                ],
                            },
                        ],
                        generationConfig: {
                            temperature: 0.7,
                            topK: 40,
                            topP: 0.95,
                            maxOutputTokens: 4096,
                        },
                    }),
                    signal: AbortSignal.timeout(this.REQUEST_TIMEOUT_MS),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    `Gemini API Error (${response.status}): ${
                        errorData.error?.message || 'Unknown error'
                    }`
                );
            }

            const data = await response.json();

            // Extract text from response
            let textContent = '';
            if (
                data.candidates &&
                data.candidates[0] &&
                data.candidates[0].content &&
                data.candidates[0].content.parts
            ) {
                textContent = data.candidates[0].content.parts
                    .map(part => part.text || '')
                    .join('');
            }

            return {
                success: true,
                rawText: textContent,
                fullResponse: data,
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                fullResponse: null,
            };
        }
    },

    // Lightweight API key verification — minimal prompt, minimal tokens
    async verifyApiKey(apiKey) {
        try {
            const response = await fetch(
                `${this.API_ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: this.MODEL,
                        contents: [
                            {
                                role: 'user',
                                parts: [{ text: 'Reply with exactly: OK' }],
                            },
                        ],
                        generationConfig: {
                            temperature: 0,
                            maxOutputTokens: 5,
                        },
                    }),
                    signal: AbortSignal.timeout(15000),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                const msg = errorData.error?.message || `HTTP ${response.status}`;
                return { valid: false, error: msg, status: response.status };
            }

            return { valid: true, error: null, status: response.status };
        } catch (error) {
            return { valid: false, error: error.message, status: null };
        }
    },

    // Parse JSON response from Gemini
    parseLeadsFromResponse(responseText) {
        try {
            // Try to extract JSON from response (Gemini sometimes includes extra text)
            const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found in response');
            }

            const jsonStr = jsonMatch[0];
            const leads = JSON.parse(jsonStr);

            // Validate and normalize leads
            if (!Array.isArray(leads)) {
                throw new Error('Response is not an array');
            }

            return leads
                .filter(lead => lead.intentScore >= 2) // Filter out scores below 2
                .map(lead => ({
                    fullName: (lead.fullName || '').trim(),
                    firstName: (lead.firstName || '').trim(),
                    lastName: (lead.lastName || '').trim(),
                    company: (lead.company || '').trim(),
                    intentScore: parseInt(lead.intentScore, 10) || 0,
                    webinarVslType: (lead.webinarVslType || 'N/A').trim(),
                    primaryPlatform: (lead.primaryPlatform || 'N/A').trim(),
                    salesTeam: (lead.salesTeam || 'No').trim(),
                    primaryAds: (lead.primaryAds || 'N/A').trim(),
                    hiring: lead.hiring === true || lead.hiring === 'true',
                    theirBaby: (lead.theirBaby || 'N/A').trim(),
                }));
        } catch (error) {
            throw new Error(`Failed to parse leads: ${error.message}`);
        }
    },

    // Check if response indicates exhaustion (empty or all low scores)
    isExhausted(leads) {
        return !leads || leads.length === 0;
    },
};

// ============================================================================
// LAYER 5: RESULTS AGGREGATION & EXPORT
// ============================================================================

const ResultsAggregator = {
    // Combine and deduplicate all batch results
    aggregateResults(allBatchResults) {
        const seenNames = new Set();
        const dedupedLeads = [];

        allBatchResults.forEach(lead => {
            const normalizedName = lead.fullName.toLowerCase().trim();
            if (!seenNames.has(normalizedName)) {
                seenNames.add(normalizedName);
                dedupedLeads.push(lead);
            }
        });

        return dedupedLeads;
    },

    // Export to CSV format
    exportToCSV(leads) {
        const headers = [
            'Full Name',
            'First Name',
            'Last Name',
            'Company/Brand',
            'Intent Score',
            'Webinar/VSL Type',
            'Primary Platform',
            'Sales Team?',
            'Primary Ads',
            'Hiring?',
            'Their Baby',
        ];

        const rows = leads.map(lead => [
            lead.fullName,
            lead.firstName,
            lead.lastName,
            lead.company,
            lead.intentScore,
            lead.webinarVslType,
            lead.primaryPlatform,
            lead.salesTeam,
            lead.primaryAds,
            lead.hiring ? 'Yes' : 'No',
            lead.theirBaby,
        ]);

        const csvContent = [
            headers.map(h => `"${h}"`).join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
        ].join('\n');

        return csvContent;
    },

    // Export to JSON format
    exportToJSON(leads) {
        return JSON.stringify(leads, null, 2);
    },

    // Generate HTML table for display
    generateTableHTML(leads) {
        if (!leads || leads.length === 0) {
            return '<p class="placeholder-text">No leads to display.</p>';
        }

        const headers = [
            'Full Name',
            'Company',
            'Intent Score',
            'Platform',
            'Sales Team',
            'Their Baby',
        ];

        let html = '<table class="results-table">';

        // Header
        html += '<thead><tr>';
        headers.forEach(header => {
            html += `<th>${header}</th>`;
        });
        html += '</tr></thead>';

        // Body
        html += '<tbody>';
        leads.forEach(lead => {
            html += '<tr>';
            html += `<td><strong>${lead.fullName}</strong></td>`;
            html += `<td>${lead.company}</td>`;
            html += `<td class="score-${lead.intentScore}">${lead.intentScore}</td>`;
            html += `<td>${lead.primaryPlatform}</td>`;
            html += `<td>${lead.salesTeam}</td>`;
            html += `<td>${lead.theirBaby}</td>`;
            html += '</tr>';
        });
        html += '</tbody>';

        html += '</table>';

        return html;
    },
};

// ============================================================================
// LAYER 6: UI EVENT MANAGER & ACTIVITY LOGGER
// ============================================================================

const ActivityLogger = {
    MAX_LOG_ENTRIES: 500,
    logEntries: [],

    log(message, type = 'info', data = null) {
        const timestamp = new Date().toLocaleTimeString();
        const entry = {
            timestamp,
            type, // 'info', 'success', 'warning', 'error', 'processing'
            message,
            data,
        };

        this.logEntries.push(entry);

        // Keep log size reasonable
        if (this.logEntries.length > this.MAX_LOG_ENTRIES) {
            this.logEntries.shift();
        }

        this.displayLog();
        console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`, data || '');
    },

    displayLog() {
        const logContainer = document.getElementById('activityLog');
        if (!logContainer) return;

        const html = this.logEntries
            .map(entry => {
                let dataStr = '';
                if (entry.data) {
                    dataStr = `<code>${JSON.stringify(entry.data).substring(0, 100)}...</code>`;
                }
                return `<div class="log-entry log-${entry.type}">
                    <span class="log-time">[${entry.timestamp}]</span>
                    <span class="log-msg">${entry.message}</span>
                    ${dataStr}
                </div>`;
            })
            .join('');

        logContainer.innerHTML = html;
        logContainer.scrollTop = logContainer.scrollHeight;
    },

    clear() {
        this.logEntries = [];
        this.displayLog();
    },
};

// ============================================================================
// MAIN EXECUTION ENGINE
// ============================================================================

const ExecutionEngine = {
    isRunning: false,

    async execute() {
        // Validate configuration
        const config = ConfigManager.getAllConfig();

        if (!ConfigManager.isConfigValid(config)) {
            ActivityLogger.log('Invalid configuration. Please fill all fields.', 'error');
            return;
        }

        if (this.isRunning) {
            ActivityLogger.log('Execution already in progress.', 'warning');
            return;
        }

        this.isRunning = true;
        UIManager.setExecutionState(true);

        try {
            ActivityLogger.log('🚀 Starting lead sourcing process...', 'processing');
            ActivityLogger.log(
                `Target Niche: "${config.targetNiche}" | Target Leads: ${config.targetLeads}`,
                'info'
            );

            // Step 1: Calculate batches
            const batches = BatchCalculator.calculateBatches(config.targetLeads);
            ActivityLogger.log(
                `📊 Batch calculation: ${batches.length} batches | ${BatchCalculator.formatBatchInfo(
                    batches
                )}`,
                'info'
            );

            // Step 2: Get historical exclusion list
            const exclusionList = HistoryManager.getExclusionList(config.targetNiche);
            ActivityLogger.log(
                `📝 Found ${exclusionList.length} previously discovered leads to exclude`,
                'info'
            );

            // Step 3: Execute batch loop
            let allHarvestedLeads = [];
            let batchExecutionHalted = false;

            for (const batch of batches) {
                if (batchExecutionHalted) break;

                ActivityLogger.log(
                    `⏳ Executing Batch ${batch.batchNumber}/${batches.length} (${batch.size} leads)...`,
                    'processing'
                );

                // Build dynamic prompt with current batch context
                const systemPrompt = GeminiIntegration.buildMasterPrompt(
                    config.targetNiche,
                    batch.size,
                    exclusionList
                );

                // Call Gemini API
                const apiResult = await GeminiIntegration.callGeminiAPI(
                    config.geminiApiKey,
                    systemPrompt
                );

                if (!apiResult.success) {
                    ActivityLogger.log(`❌ Batch ${batch.batchNumber} failed: ${apiResult.error}`, 'error');
                    batchExecutionHalted = true;
                    break;
                }

                ActivityLogger.log(
                    `✅ Batch ${batch.batchNumber} API response received`,
                    'success'
                );

                // Parse leads from response
                let batchLeads = [];
                try {
                    batchLeads = GeminiIntegration.parseLeadsFromResponse(apiResult.rawText);
                } catch (parseError) {
                    ActivityLogger.log(
                        `⚠️ Parse error in Batch ${batch.batchNumber}: ${parseError.message}`,
                        'warning'
                    );
                    batchLeads = [];
                }

                // Check for exhaustion
                if (GeminiIntegration.isExhausted(batchLeads)) {
                    ActivityLogger.log(
                        '🛑 Exhaustion trigger fired: No new qualified leads detected',
                        'warning'
                    );
                    batchExecutionHalted = true;
                    break;
                }

                // Add to history and track
                HistoryManager.addLeadsToHistory(config.targetNiche, batchLeads);
                allHarvestedLeads = allHarvestedLeads.concat(batchLeads);

                ActivityLogger.log(
                    `✨ Batch ${batch.batchNumber} complete: ${batchLeads.length} new leads harvested`,
                    'success',
                    {
                        batchNumber: batch.batchNumber,
                        leadsCount: batchLeads.length,
                    }
                );

                // Add small delay between API calls to avoid rate limiting
                if (batch.batchNumber < batches.length && !batchExecutionHalted) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            // Step 4: Final aggregation and deduplication
            ActivityLogger.log('🔄 Running final deduplication pass...', 'processing');
            const finalLeads = ResultsAggregator.aggregateResults(allHarvestedLeads);

            ActivityLogger.log(
                `✅ COMPLETE: ${finalLeads.length} unique leads harvested across all batches`,
                'success',
                {
                    uniqueLeads: finalLeads.length,
                    totalProcessed: allHarvestedLeads.length,
                    duplicatesRemoved: allHarvestedLeads.length - finalLeads.length,
                }
            );

            // Step 5: Display results
            this.displayResults(finalLeads);

            // Step 6: Update UI
            UIManager.enableExportButtons(finalLeads.length > 0);

        } catch (error) {
            ActivityLogger.log(`💥 Execution error: ${error.message}`, 'error');
        } finally {
            this.isRunning = false;
            UIManager.setExecutionState(false);
        }
    },

    displayResults(leads) {
        const resultsContainer = document.getElementById('resultsTable');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = ResultsAggregator.generateTableHTML(leads);

        const leadCountEl = document.getElementById('leadCount');
        if (leadCountEl) {
            leadCountEl.textContent = `${leads.length} lead${leads.length !== 1 ? 's' : ''}`;
        }
    },
};

// ============================================================================
// UI MANAGER
// ============================================================================

const UIManager = {
    async initialize() {
        // Load saved configuration
        const savedNiche = ConfigManager.loadTargetNiche();
        const savedLeads = ConfigManager.loadTargetLeads();
        const savedApiKey = await ConfigManager.loadGeminiApiKey();

        if (document.getElementById('targetNiche')) {
            document.getElementById('targetNiche').value = savedNiche;
        }
        if (document.getElementById('targetLeads')) {
            document.getElementById('targetLeads').value = savedLeads;
        }
        if (document.getElementById('geminiApiKey')) {
            document.getElementById('geminiApiKey').value = savedApiKey;
        }

        this.attachEventListeners();
        this.updateBatchCalculation();
    },

    attachEventListeners() {
        // Start button
        const startBtn = document.getElementById('startBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const targetNiche = document.getElementById('targetNiche').value.trim();
                const targetLeads = parseInt(document.getElementById('targetLeads').value, 10);
                const apiKey = document.getElementById('geminiApiKey').value.trim();

                if (!apiKey) {
                    alert('Please enter your Gemini API Key');
                    return;
                }
                if (!targetNiche) {
                    alert('Please enter a target niche');
                    return;
                }
                if (!targetLeads || targetLeads < 1) {
                    alert('Please enter a valid target lead count');
                    return;
                }

                ConfigManager.saveGeminiApiKey(apiKey);
                ConfigManager.saveTargetNiche(targetNiche);
                ConfigManager.saveTargetLeads(targetLeads);

                ExecutionEngine.execute();
            });
        }

        // Verify API Key button
        const verifyApiKeyBtn = document.getElementById('verifyApiKeyBtn');
        if (verifyApiKeyBtn) {
            verifyApiKeyBtn.addEventListener('click', () => this.verifyApiKey());
        }

        // Save config button
        const saveConfigBtn = document.getElementById('saveConfigBtn');
        if (saveConfigBtn) {
            saveConfigBtn.addEventListener('click', () => {
                const apiKey = document.getElementById('geminiApiKey').value.trim();
                const targetNiche = document.getElementById('targetNiche').value.trim();
                const targetLeads = parseInt(document.getElementById('targetLeads').value, 10);

                if (apiKey) ConfigManager.saveGeminiApiKey(apiKey);
                if (targetNiche) ConfigManager.saveTargetNiche(targetNiche);
                if (targetLeads) ConfigManager.saveTargetLeads(targetLeads);

                ActivityLogger.log('✅ Configuration saved to browser storage', 'success');
            });
        }

        // Clear history button
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                if (confirm('Are you sure? This will clear all historical lead data.')) {
                    HistoryManager.clearHistory();
                    ActivityLogger.log('🗑️ History cleared', 'warning');
                }
            });
        }

        // Clear log button
        const clearLogBtn = document.getElementById('clearLogBtn');
        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', () => {
                ActivityLogger.clear();
            });
        }

        // Export CSV button
        const exportCsvBtn = document.getElementById('exportCsvBtn');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => {
                const currentStats = HistoryManager.getStatistics(
                    document.getElementById('targetNiche').value
                );
                const leads = HistoryManager.getAllDiscoveredLeads(
                    document.getElementById('targetNiche').value
                );

                if (leads.length === 0) {
                    alert('No leads to export');
                    return;
                }

                const csv = ResultsAggregator.exportToCSV(leads);
                this.downloadFile(csv, 'leads-export.csv', 'text/csv');
                ActivityLogger.log(
                    `📥 Exported ${leads.length} leads to CSV`,
                    'success'
                );
            });
        }

        // Export JSON button
        const exportJsonBtn = document.getElementById('exportJsonBtn');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => {
                const leads = HistoryManager.getAllDiscoveredLeads(
                    document.getElementById('targetNiche').value
                );

                if (leads.length === 0) {
                    alert('No leads to export');
                    return;
                }

                const json = ResultsAggregator.exportToJSON(leads);
                this.downloadFile(json, 'leads-export.json', 'application/json');
                ActivityLogger.log(
                    `📥 Exported ${leads.length} leads to JSON`,
                    'success'
                );
            });
        }

        // Target leads input - update batch calculation on change
        const targetLeadsInput = document.getElementById('targetLeads');
        if (targetLeadsInput) {
            targetLeadsInput.addEventListener('change', () => this.updateBatchCalculation());
            targetLeadsInput.addEventListener('input', () => this.updateBatchCalculation());
        }

        // API Key visibility toggle
        const toggleBtn = document.getElementById('toggleApiKeyVisibility');
        const apiKeyInput = document.getElementById('geminiApiKey');
        if (toggleBtn && apiKeyInput) {
            toggleBtn.addEventListener('click', () => {
                const isPassword = apiKeyInput.type === 'password';
                apiKeyInput.type = isPassword ? 'text' : 'password';
                toggleBtn.textContent = isPassword ? '🔒' : '👁️';
            });
        }
    },

    // Verify the Gemini API key with a lightweight test call
    async verifyApiKey() {
        const apiKeyInput = document.getElementById('geminiApiKey');
        const statusEl = document.getElementById('apiKeyStatus');
        const verifyBtn = document.getElementById('verifyApiKeyBtn');

        const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';

        if (!apiKey) {
            ActivityLogger.log('⚠️ API key verification failed: No key entered.', 'warning');
            if (statusEl) {
                statusEl.innerHTML = '<span class="api-status api-status--error">⚠️ No API key entered</span>';
            }
            return;
        }

        // Disable button and show checking state
        if (verifyBtn) {
            verifyBtn.disabled = true;
            verifyBtn.textContent = '⏳ Checking...';
        }
        if (statusEl) {
            statusEl.innerHTML = '<span class="api-status api-status--checking">⏳ Contacting Gemini API...</span>';
        }

        ActivityLogger.log('🔑 Verifying Gemini API key...', 'processing');

        const result = await GeminiIntegration.verifyApiKey(apiKey);

        // Re-enable button
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.textContent = '✓ Verify API Key';
        }

        if (result.valid) {
            ActivityLogger.log('✅ API key verified successfully — Gemini is reachable and accepting requests.', 'success');
            if (statusEl) {
                statusEl.innerHTML = '<span class="api-status api-status--success">✅ API key is valid</span>';
            }
            // Auto-save the verified key
            ConfigManager.saveGeminiApiKey(apiKey);
            ActivityLogger.log('💾 API key saved to browser storage.', 'info');
        } else {
            const errorMsg = result.error || 'Unknown error';
            ActivityLogger.log(`❌ API key verification failed: ${errorMsg}`, 'error');
            if (statusEl) {
                statusEl.innerHTML = `<span class="api-status api-status--error">❌ Invalid key: ${errorMsg}</span>`;
            }
        }
    },

    updateBatchCalculation() {
        const targetLeads = parseInt(document.getElementById('targetLeads').value, 10) || 0;
        const batchCalcEl = document.getElementById('batchCalculation');

        if (targetLeads > 0) {
            const batches = BatchCalculator.calculateBatches(targetLeads);
            const info = BatchCalculator.formatBatchInfo(batches);
            batchCalcEl.textContent = `${batches.length} batch${batches.length !== 1 ? 'es' : ''} | ${info}`;
        } else {
            batchCalcEl.textContent = 'Enter target leads to calculate';
        }
    },

    setExecutionState(isRunning) {
        const startBtn = document.getElementById('startBtn');
        if (startBtn) {
            startBtn.disabled = isRunning;
            startBtn.textContent = isRunning ? '⏸️ Processing...' : '▶️ [ Start ]';
        }
    },

    enableExportButtons(enabled) {
        const csvBtn = document.getElementById('exportCsvBtn');
        const jsonBtn = document.getElementById('exportJsonBtn');

        if (csvBtn) csvBtn.disabled = !enabled;
        if (jsonBtn) jsonBtn.disabled = !enabled;
    },

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    },
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    ActivityLogger.log('🔧 Initializing B2B Lead Generation Engine - Part One', 'info');
    UIManager.initialize();
    ActivityLogger.log('✅ System ready', 'success');
});
