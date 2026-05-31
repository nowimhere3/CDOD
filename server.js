/**
 * ============================================================================
 * B2B Lead Generation Engine — Backend Proxy Server
 * ============================================================================
 *
 * This server acts as a secure proxy between the browser frontend and the
 * Google Gemini API.  It authenticates using Application Default Credentials
 * (ADC) so no API key ever reaches the browser.
 *
 * Setup:
 *   1. Install deps:  npm install
 *   2. Authenticate:  gcloud auth application-default login
 *      OR set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   3. Start server:  npm start
 *   4. Open browser:  http://localhost:3000
 *
 * Environment variables (all optional):
 *   PORT                          — HTTP port (default: 3000)
 *   GEMINI_MODEL                  — Gemini model ID (default: gemini-2.0-flash)
 *   GOOGLE_APPLICATION_CREDENTIALS — Path to service-account JSON key file
 */

'use strict';

const express = require('express');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const app = express();
app.use(express.json({ limit: '1mb' }));

// Serve the static frontend from the same directory
app.use(express.static(path.join(__dirname)));

// ─── Configuration ───────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_ENDPOINT =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ─── Google Auth ──────────────────────────────────────────────────────────────

const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

/** Returns a short-lived access token via ADC. */
async function getAccessToken() {
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    if (!tokenResponse.token) {
        throw new Error(
            'ADC returned no token. Run "gcloud auth application-default login" or ' +
            'set GOOGLE_APPLICATION_CREDENTIALS to a service-account key file.'
        );
    }
    return tokenResponse.token;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Call the Gemini REST API using an access token obtained via ADC.
 * Returns the full parsed JSON response or throws on error.
 */
async function callGemini(requestBody, timeoutMs = 60000) {
    const token = await getAccessToken();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
        response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
            const errData = await response.json();
            errorMsg = errData.error?.message || errorMsg;
        } catch (_) {
            // ignore parse failure
        }
        const err = new Error(`Gemini API Error (${response.status}): ${errorMsg}`);
        err.status = response.status;
        throw err;
    }

    return response.json();
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/health
 * Verifies that ADC credentials are valid and Gemini is reachable.
 */
app.get('/api/health', async (_req, res) => {
    try {
        await callGemini(
            {
                contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: OK' }] }],
                generationConfig: { temperature: 0, maxOutputTokens: 5 },
            },
            15000
        );
        return res.json({ ok: true, model: GEMINI_MODEL });
    } catch (err) {
        console.error('[health]', err.message);
        return res.status(err.status || 500).json({ ok: false, error: err.message });
    }
});

/**
 * POST /api/generate
 * Body: { prompt: string }
 * Forwards the prompt to Gemini and returns { success, rawText }.
 */
app.post('/api/generate', async (req, res) => {
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ success: false, error: 'Missing or empty prompt' });
    }

    try {
        const data = await callGemini({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 4096,
            },
        });

        // Extract text content from Gemini response
        let rawText = '';
        if (data.candidates?.[0]?.content?.parts) {
            rawText = data.candidates[0].content.parts
                .map(p => p.text || '')
                .join('');
        }

        return res.json({ success: true, rawText });
    } catch (err) {
        console.error('[generate]', err.message);
        return res
            .status(err.status || 500)
            .json({ success: false, error: err.message });
    }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`   Model : ${GEMINI_MODEL}`);
    console.log(`   Auth  : Application Default Credentials (ADC)`);
    console.log('');
    console.log('If auth fails, run:');
    console.log('  gcloud auth application-default login');
    console.log(
        '  — or set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json'
    );
});
