/**
 * DNDCard Local Server — replaces `npx http-server`
 *
 * Serves static files AND exposes /api/generate-card for on-demand
 * Imagen generation when browse.html requests a card for a scraped agent.
 *
 * Usage:
 *   node scripts/serve.js
 *   → http://localhost:8080
 */

require("dotenv").config({ override: true });
const express = require("express");
const fs      = require("fs");
const path    = require("path");

const { GoogleGenAI } = require("@google/genai");
const { buildPrompt } = require("./lib/prompt-template");
const { deriveSubject } = require("./lib/derive-subject");
const { generateValidated } = require("./generate-agent-images");

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT          = process.env.PORT || 8080;
const ROOT_DIR      = path.join(__dirname, "..");
const IMAGES_DIR    = path.join(ROOT_DIR, "agent-cards", "images", "agents");
const CURATED_JSON  = path.join(ROOT_DIR, "agent-cards", "js", "JSON", "agents.json");
const SCRAPED_JSON  = path.join(ROOT_DIR, "agent-cards", "js", "JSON", "normalized-agents.json");

const GCP_PROJECT  = process.env.GOOGLE_CLOUD_PROJECT;
const GCP_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
const API_KEY      = process.env.GOOGLE_API_KEY;

if (!GCP_PROJECT && !API_KEY) {
    console.error("❌ Auth eksik. .env'de GOOGLE_CLOUD_PROJECT veya GOOGLE_API_KEY olmalı.");
    process.exit(1);
}

const ai = GCP_PROJECT
    ? new GoogleGenAI({ vertexai: true, project: GCP_PROJECT, location: GCP_LOCATION })
    : new GoogleGenAI({ apiKey: API_KEY });

// ─── Lazy agent pool cache ───────────────────────────────────────────────────
let curatedAgents = null;
let scrapedAgents = null;

function loadCurated() {
    if (!curatedAgents) {
        const data = JSON.parse(fs.readFileSync(CURATED_JSON, "utf-8"));
        curatedAgents = data.agents || [];
    }
    return curatedAgents;
}

function loadScraped() {
    if (!scrapedAgents) {
        const data = JSON.parse(fs.readFileSync(SCRAPED_JSON, "utf-8"));
        scrapedAgents = Array.isArray(data) ? data : (data.agents || data);
    }
    return scrapedAgents;
}

function findAgent(id) {
    return loadCurated().find(a => a.id === id)
        || loadScraped().find(a => a.id === id);
}

// ─── Simple in-process semaphore — one generation at a time ──────────────────
let generationLock = Promise.resolve();
async function withLock(fn) {
    const prev = generationLock;
    let release;
    generationLock = new Promise(r => { release = r; });
    await prev.catch(() => {});
    try {
        return await fn();
    } finally {
        release();
    }
}

// ─── Express app ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Quick request log
app.use((req, _res, next) => {
    if (req.path.startsWith("/api/")) {
        console.log(`→ ${req.method} ${req.path}${req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : ""}`);
    }
    next();
});

// ─── /api/generate-card ──────────────────────────────────────────────────────
app.all("/api/generate-card", async (req, res) => {
    const id = req.query.id || req.body?.id;
    if (!id) return res.status(400).json({ success: false, error: "missing id" });

    const safeId = String(id).replace(/[^a-z0-9_-]/gi, "");
    if (!safeId) return res.status(400).json({ success: false, error: "invalid id" });

    const outPath = path.join(IMAGES_DIR, `${safeId}.jpg`);
    const publicUrl = `/agent-cards/images/agents/${safeId}.jpg`;

    // ── Cache hit
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 8192) {
        return res.json({ success: true, cached: true, imageUrl: publicUrl });
    }

    // ── Find agent in either pool
    const agent = findAgent(safeId);
    if (!agent) {
        return res.status(404).json({ success: false, error: `agent '${safeId}' not found` });
    }

    // ── Serialize to one generation at a time (Imagen quota friendly)
    try {
        const result = await withLock(async () => {
            // Subject: use imagePrompt if curated, else derive via Gemini
            let subject = agent.imagePrompt;
            if (!subject) {
                console.log(`   deriving subject for "${agent.name}"…`);
                subject = await deriveSubject(ai, agent);
                console.log(`   subject: "${subject}"`);
            }

            const prompt = buildPrompt(subject);
            console.log(`   generating image for ${safeId}…`);
            const gen = await generateValidated(ai, prompt, agent.name);

            if (!gen.buffer) {
                throw new Error("All attempts failed, no buffer returned");
            }

            fs.mkdirSync(IMAGES_DIR, { recursive: true });
            fs.writeFileSync(outPath, gen.buffer);

            return {
                attempts: gen.attempts,
                passed:   gen.passed,
                subject,
                kb: Math.round(gen.buffer.length / 1024),
            };
        });

        console.log(`✅ ${safeId} — ${result.kb} KB in ${result.attempts} attempt(s), validated=${result.passed}`);
        return res.json({
            success:  true,
            cached:   false,
            imageUrl: publicUrl,
            attempts: result.attempts,
            passed:   result.passed,
            subject:  result.subject,
        });
    } catch (e) {
        console.error(`❌ ${safeId} failed:`, e.message);
        return res.status(500).json({
            success: false,
            error:   e.message || "generation failed",
            imageUrl: publicUrl, // client may still try fallback render
        });
    }
});

// ─── Static file serving (root = project dir) ────────────────────────────────
app.use(express.static(ROOT_DIR, {
    extensions: ["html"],
    cacheControl: false, // we set Cache-Control ourselves in setHeaders
    setHeaders: (res, filePath) => {
        // Disable cache for code/data during development — generated images can cache
        const noCacheExts = [".json", ".js", ".html", ".css"];
        if (noCacheExts.some(ext => filePath.endsWith(ext))) {
            res.setHeader("Cache-Control", "no-store, must-revalidate");
            res.setHeader("Pragma", "no-cache");
        } else if (filePath.endsWith(".jpg")) {
            // Generated agent images are immutable per id — cache aggressively
            res.setHeader("Cache-Control", "public, max-age=31536000");
        }
    },
}));

// ─── Friendly 404 ────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).send("Not found");
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 DNDCard server listening at  http://localhost:${PORT}`);
    console.log(`   index            → http://localhost:${PORT}/index.html`);
    console.log(`   browse           → http://localhost:${PORT}/agent-cards/browse.html`);
    console.log(`   cards            → http://localhost:${PORT}/agent-cards/agent-cards.html`);
    console.log(`   API              → POST /api/generate-card?id=<agent-id>`);
    console.log(`   Auth mode        : ${GCP_PROJECT ? "Vertex AI ("+GCP_PROJECT+")" : "AI Studio API Key"}\n`);
});
