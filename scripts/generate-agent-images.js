/**
 * Standartlaştırılmış Agent Image Generator — Gemini Image + Vision Validation
 *
 * Pipeline:
 *   agents.json (imagePrompt subject)
 *     → buildPrompt(subject)        [standardised template]
 *     → gemini-2.5-flash-image      [generateContent + responseModalities:["IMAGE"]]
 *     → Gemini Vision validation    [4 binary criteria]
 *     → PASS  → save
 *     → FAIL  → retry (max 3 attempts)
 *
 * Usage:
 *   node scripts/generate-agent-images.js
 *   node scripts/generate-agent-images.js --id ghost-code-cleaner
 *   node scripts/generate-agent-images.js --force
 *   node scripts/generate-agent-images.js --no-validate
 */

require("dotenv").config({ override: true });
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

const { buildPrompt } = require("./lib/prompt-template");
const { validateImage } = require("./lib/validate-image");

// ─── Config ───────────────────────────────────────────────────────────────────

const API_KEY      = process.env.GOOGLE_API_KEY;
const GCP_PROJECT  = process.env.GOOGLE_CLOUD_PROJECT;
const GCP_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
const USE_VERTEX   = Boolean(GCP_PROJECT);          // auto-detect: project var ise Vertex moduna geç

const MODEL = "imagen-4.0-generate-001";
const OUTPUT_DIR = path.join(__dirname, "..", "agent-cards", "images", "agents");
const AGENTS_JSON = path.join(__dirname, "..", "agent-cards", "js", "JSON", "agents.json");
const NORMALIZED_JSON = path.join(__dirname, "..", "agent-cards", "js", "JSON", "normalized-agents.json");
const DELAY_MS = 2500;
const MAX_ATTEMPTS = 3;

// ─── CLI flags ─────────────────────────────────────────────────────────────────

function flagValue(name) {
    const idx = process.argv.indexOf(name);
    return idx !== -1 ? process.argv[idx + 1] : null;
}

const FORCE = process.argv.includes("--force");
const NO_VALIDATE = process.argv.includes("--no-validate");
const SINGLE_ID = flagValue("--id");
// --source curated (default, 15 agents) | normalized (4587 scraped pool)
const SOURCE = (flagValue("--source") || "curated").toLowerCase();
const FILTER_CATEGORY = flagValue("--category");       // design | dev | qa | utility
const FILTER_SOURCE_REPO = flagValue("--source-repo"); // substring match on source_repo
const LIMIT = (() => {
    const v = flagValue("--limit");
    return v ? parseInt(v, 10) : null;
})();

if (!USE_VERTEX && !API_KEY) {
    console.error("❌ Auth missing. Set EITHER:");
    console.error("    • GOOGLE_API_KEY=...  (AI Studio mode)");
    console.error("    • GOOGLE_CLOUD_PROJECT=... + run `gcloud auth application-default login` (Vertex mode)");
    process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

async function generateImage(ai, prompt) {
    // Dispatch by model family:
    //   imagen-*  → generateImages() endpoint
    //   gemini-*  → generateContent() with responseModalities:["IMAGE"]
    if (MODEL.startsWith("imagen-")) {
        const response = await ai.models.generateImages({
            model: MODEL,
            prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: "3:4",
                outputMimeType: "image/jpeg",
            },
        });
        const imgBytes = response.generatedImages?.[0]?.image?.imageBytes;
        if (!imgBytes) throw new Error("Imagen: no image bytes returned");
        return Buffer.from(imgBytes, "base64");
    }

    // Gemini image models
    const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: "3:4" },
        },
    });
    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith("image/"));
    if (!imagePart) throw new Error("Gemini Image: no image part in response");
    return Buffer.from(imagePart.inlineData.data, "base64");
}

/**
 * Generate one validated image. Retries up to MAX_ATTEMPTS with new seeds.
 * Returns { buffer, attempts, finalDetail, passed }.
 */
async function generateValidated(ai, prompt, agentName) {
    let lastBuf = null, lastDetail = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        process.stdout.write(`     attempt ${attempt}/${MAX_ATTEMPTS} … `);

        let buf;
        try {
            buf = await generateImage(ai, prompt);
        } catch (e) {
            const msg = e.message || "";
            const isQuota = msg.includes("RESOURCE_EXHAUSTED") || msg.includes("Quota exceeded") || msg.includes("429");
            if (isQuota) {
                console.log(`✗ quota — 65 sn bekleniyor…`);
                await sleep(65000);
                attempt--; // bu denemeyi yeniden say
                continue;
            }
            console.log(`✗ gen error: ${msg.substring(0, 120)}`);
            await sleep(1500);
            continue;
        }

        if (NO_VALIDATE) {
            console.log(`✅ (validation skipped)`);
            return { buffer: buf, attempts: attempt, finalDetail: null, passed: true };
        }

        let detail;
        try {
            const result = await validateImage(ai, buf);
            detail = result.detail;
            if (result.pass) {
                console.log(`✅ validated`);
                return { buffer: buf, attempts: attempt, finalDetail: detail, passed: true };
            }
            console.log(`✗ ${detail.reason || "validation failed"}`);
        } catch (e) {
            const msg = e.message || "";
            if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
                console.log(`✗ validate quota — 30 sn bekleniyor…`);
                await sleep(30000);
                attempt--;
                continue;
            }
            console.log(`✗ validate error: ${msg.substring(0, 120)}`);
        }

        lastBuf = buf;
        lastDetail = detail;
        if (attempt < MAX_ATTEMPTS) await sleep(1200);
    }

    console.log(`     ⚠ 3 deneme başarısız — son denemeyi yine de kaydediyorum`);
    return { buffer: lastBuf, attempts: MAX_ATTEMPTS, finalDetail: lastDetail, passed: false };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    // Pick the source pool: curated 15 (agents.json) or scraped 4587 (normalized-agents.json)
    const sourceFile = SOURCE === "normalized" ? NORMALIZED_JSON : AGENTS_JSON;
    if (!fs.existsSync(sourceFile)) {
        console.error(`❌ Source file not found: ${sourceFile}`);
        if (SOURCE === "normalized") console.error("    Run: node agent-cards/scraper/normalize.js");
        process.exit(1);
    }
    const agentsData = JSON.parse(fs.readFileSync(sourceFile, "utf-8"));
    let agents = agentsData.agents || [];

    if (SINGLE_ID) {
        agents = agents.filter((a) => a.id === SINGLE_ID);
        if (agents.length === 0) {
            console.error(`❌ Agent '${SINGLE_ID}' not found in ${path.basename(sourceFile)}`);
            process.exit(1);
        }
    }

    // Optional filters (skip when targeting a single id)
    if (!SINGLE_ID && FILTER_CATEGORY) {
        agents = agents.filter((a) => a.category === FILTER_CATEGORY);
    }
    if (!SINGLE_ID && FILTER_SOURCE_REPO) {
        agents = agents.filter((a) => (a.source_repo || "").includes(FILTER_SOURCE_REPO));
    }

    // Prioritise agents that still need an image (resume-friendly ordering),
    // then cap with --limit. --force keeps original order since nothing is skipped.
    if (!FORCE) {
        agents = agents.filter((a) => !fs.existsSync(path.join(OUTPUT_DIR, `${a.id}.jpg`)));
    }
    if (LIMIT && agents.length > LIMIT) {
        agents = agents.slice(0, LIMIT);
    }

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Vertex AI mode uses Application Default Credentials (gcloud login)
    // API Key mode uses AI Studio's generativelanguage endpoint
    const ai = USE_VERTEX
        ? new GoogleGenAI({ vertexai: true, project: GCP_PROJECT, location: GCP_LOCATION })
        : new GoogleGenAI({ apiKey: API_KEY });

    console.log(`\n🎨 Agent Image Generator — Vision-Validated Pipeline`);
    console.log(`   Auth mode   : ${USE_VERTEX ? `Vertex AI (project=${GCP_PROJECT}, location=${GCP_LOCATION})` : "AI Studio API Key"}`);
    console.log(`   Model       : ${MODEL}`);
    console.log(`   Validation  : ${NO_VALIDATE ? "DISABLED" : "ENABLED (Gemini 2.5 Flash)"}`);
    console.log(`   Max attempts: ${MAX_ATTEMPTS}`);
    console.log(`   Source      : ${SOURCE} (${path.basename(sourceFile)})`);
    if (FILTER_CATEGORY)    console.log(`   Category    : ${FILTER_CATEGORY}`);
    if (FILTER_SOURCE_REPO) console.log(`   SourceRepo  : *${FILTER_SOURCE_REPO}*`);
    if (LIMIT)              console.log(`   Limit       : ${LIMIT}`);
    console.log(`   Output      : ${OUTPUT_DIR}`);
    console.log(`   Agents      : ${agents.length}${FORCE ? "" : " (missing-only)"}`);
    console.log(`   Force       : ${FORCE}`);
    console.log("─".repeat(60));

    if (agents.length === 0) {
        console.log("✅ Üretilecek agent yok (hepsinin görseli zaten var ya da filtre boş döndü).");
        return;
    }

    let success = 0, skipped = 0, partial = 0, failed = 0;

    for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const outputPath = path.join(OUTPUT_DIR, `${agent.id}.jpg`);

        console.log(`\n[${i + 1}/${agents.length}] ${agent.emoji}  ${agent.name}`);

        if (!agent.imagePrompt) {
            console.log(`   ⚠ imagePrompt yok — atlandı`);
            skipped++;
            continue;
        }

        if (!FORCE && fs.existsSync(outputPath)) {
            console.log(`   ⏭ Zaten var — atlandı (--force ile yenile)`);
            skipped++;
            continue;
        }

        console.log(`   subject: "${agent.imagePrompt}"`);
        const fullPrompt = buildPrompt(agent.imagePrompt);

        try {
            const result = await generateValidated(ai, fullPrompt, agent.name);

            if (!result.buffer) {
                console.log(`   ❌ Hiç görsel üretilemedi`);
                failed++;
                if (i < agents.length - 1) await sleep(DELAY_MS);
                continue;
            }

            fs.writeFileSync(outputPath, result.buffer);
            const kb = Math.round(result.buffer.length / 1024);

            if (result.passed) {
                console.log(`   ✅ ${kb} KB — ${result.attempts} denemede validated`);
                success++;
            } else {
                console.log(`   ⚠  ${kb} KB — validation FAIL ama kaydedildi (manuel kontrol et)`);
                partial++;
            }

        } catch (err) {
            console.log(`   ❌ Beklenmedik hata: ${err.message}`);
            failed++;
        }

        if (i < agents.length - 1) await sleep(DELAY_MS);
    }

    console.log("\n" + "─".repeat(60));
    console.log(`✅ Validated     : ${success}`);
    console.log(`⚠  Partial (fail): ${partial}`);
    console.log(`⏭  Atlandı       : ${skipped}`);
    console.log(`❌ Başarısız     : ${failed}`);
    console.log(`\n💡 http://localhost:8080/agent-cards/agent-cards.html\n`);
}

// Run main() only if executed as CLI (not when require'd by serve.js)
if (require.main === module) {
    main().catch((err) => {
        console.error("\n❌ Beklenmedik hata:", err.message);
        console.error(err.stack);
        process.exit(1);
    });
}

// Export for server reuse
module.exports = {
    generateValidated,
    generateImage,
    MODEL,
    sleep,
};
