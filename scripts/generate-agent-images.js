/**
 * Agent Image Generator — Google Imagen 3
 *
 * Usage:
 *   GOOGLE_API_KEY=your_key node scripts/generate-agent-images.js
 *   GOOGLE_API_KEY=your_key node scripts/generate-agent-images.js --force   (regenerate existing)
 *   GOOGLE_API_KEY=your_key node scripts/generate-agent-images.js --id card-design-plan-agent
 */

require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

// ─── Config ───────────────────────────────────────────────────────────────────

const API_KEY = process.env.GOOGLE_API_KEY;
const MODEL = "imagen-4.0-generate-001";
const OUTPUT_DIR = path.join(__dirname, "..", "agent-cards", "images", "agents");
const AGENTS_JSON = path.join(__dirname, "..", "agent-cards", "js", "JSON", "agents.json");
const DELAY_MS = 2500; // Delay between API calls to respect rate limits

const FORCE = process.argv.includes("--force");
const SINGLE_ID = (() => {
    const idx = process.argv.indexOf("--id");
    return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ─── Imagen Prompts — Sinematik / Soyut stil ─────────────────────────────────
// Her prompt: koyu arka plan, kavramsal sahne, yüksek kalite, aspect ratio 3:4

// ─── Iconic Figure Prompts ────────────────────────────────────────────────────
// Style guide: single centred iconic figure/character, portrait orientation,
// dramatic cinematic lighting, dark background, subject clearly silhouetted,
// photorealistic or painterly fine-art style, no text or letters in image.

const AGENT_PROMPTS = {
    "card-design-plan-agent":
        "Bust portrait of a solitary hooded figure, subject fills the entire frame from chin to top of hood, hands holding a single luminous playing card that glows violet-gold, pure black background, one dramatic side rim light in deep purple, face in shadow except glowing eyes, studio photography, ultra sharp, minimal, no props, no text, no decorations",

    "ui-designer":
        "An elegant figure in flowing iridescent robes holding a large glowing colour palette like a paintbrush of light, pink and white neon glow, dark studio background, paint strokes of light swirling around them, fine-art cinematic portrait, no text",

    "gamification-ux-advisor":
        "A triumphant figure raising a glowing golden trophy overhead, warm amber and gold light radiating outward, achievement badges orbiting like satellites, dark background, heroic game-art style, dramatic upward lighting, cinematic portrait, no text",

    "presentation-designer":
        "A confident suited presenter silhouette standing before a towering glowing holographic slide deck, cool cyan and white light, dramatic backlit pose, executive boardroom darkness, cinematic wide portrait, no text",

    "flutter-univercity-dev":
        "A young developer in a hoodie surrounded by glowing mobile phone screens showing a university app, sky-blue light reflecting on their face, code streams in the air, night-time tech atmosphere, cinematic portrait, no text",

    "backend-flutter-univercity":
        "A powerful engineer figure standing inside a giant glowing server room, green circuit-board light illuminating their face from below, holographic microservice nodes floating around them, matrix aesthetic, dramatic cinematic portrait, no text",

    "univercity-lead-architect":
        "A commanding architect figure standing before a vast holographic blueprint of a university campus, electric blue light, long coat, arms slightly spread as if conducting, dark background, leadership aesthetic, cinematic portrait, no text",

    "bug-hunter":
        "Close-up bust portrait of a noir detective, subject tightly fills the frame from shoulders to top of hat, wearing a dark trench coat and wide-brim fedora, holding a magnifying glass close to one eye, glass emits a single sharp red glow, pure black background, strong single-source red rim light from the side, deep shadows, cinematic noir, no text, no background elements, ultra minimal",

    "ghost-code-cleaner":
        "Full-frame close portrait of a single translucent ghost, subject fills entire canvas top to bottom, ghost body is semi-transparent pale white-violet, simple flowing robe shape, arms slightly raised, pure black background, soft inner glow only light source, minimal wispy smoke at edges, no code fragments, no text, no background details, ultra clean and minimal",

    "ux-consistency-auditor":
        "A focused scientist in a lab coat examining a glowing UI panel with an orange-lit magnifying instrument, precision and detail, interface grid patterns reflected in their glasses, dark laboratory background, warm analytical orange light, cinematic portrait, no text",

    "general-purpose":
        "A versatile figure made of layered light silhouettes — multiple translucent versions of itself overlapping, each performing a different task, silver-blue glow, dark background, omnipotent energy, abstract heroic cinematic portrait, no text",

    "claude-code-guide":
        "A wise elder figure in a hooded robe sitting before a glowing open ancient tome, golden light from the pages illuminating their face, floating code runes rising like fireflies, warm amber lantern light, mystical tech-wizard aesthetic, cinematic portrait, no text",

    "plan":
        "A strategic thinker standing at a holographic war-table, cyan light plans and flowcharts floating in the air around them, calm focused expression, dark background, architect-of-systems aesthetic, dramatic cool-toned cinematic portrait, no text",

    "explore":
        "An explorer figure in a long coat standing on the edge of a dark digital cosmos, holding a glowing compass that radiates teal-green aurora light, star map trails stretching behind them, discovery aesthetic, cinematic portrait, no text",

    "claude":
        "A transcendent figure composed of flowing silver light and neural network patterns, standing at the centre of a radiant star-crystal formation, omnidirectional glow, serene expression, sacred geometry, AI consciousness embodied, cinematic fine-art portrait, no text",
};

// ─── Validation ───────────────────────────────────────────────────────────────

if (!API_KEY) {
    console.error("❌ GOOGLE_API_KEY environment variable not set.");
    console.error("   Usage: GOOGLE_API_KEY=your_key node scripts/generate-agent-images.js");
    process.exit(1);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

async function generateImage(ai, agentId, prompt, count = 1) {
    const response = await ai.models.generateImages({
        model: MODEL,
        prompt,
        config: {
            numberOfImages: count,
            aspectRatio: "3:4",
            outputMimeType: "image/jpeg",
        },
    });

    const images = response.generatedImages;
    if (!images || images.length === 0) throw new Error("No image bytes in response");

    // Return all generated images as buffers
    return images.map(img => Buffer.from(img.image.imageBytes, "base64"));
}

async function main() {
    // Read agents
    const agentsData = JSON.parse(fs.readFileSync(AGENTS_JSON, "utf-8"));
    let agents = agentsData.agents;

    // Filter by --id if specified
    if (SINGLE_ID) {
        agents = agents.filter((a) => a.id === SINGLE_ID);
        if (agents.length === 0) {
            console.error(`❌ Agent '${SINGLE_ID}' not found in agents.json`);
            process.exit(1);
        }
    }

    // Ensure output dir exists
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    console.log(`\n🎨 Agent Image Generator — Imagen 4`);
    console.log(`   Model  : ${MODEL}`);
    console.log(`   Output : ${OUTPUT_DIR}`);
    console.log(`   Agents : ${agents.length}`);
    console.log(`   Force  : ${FORCE}`);
    console.log("─".repeat(50));

    let success = 0, skipped = 0, failed = 0;

    for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const prompt = AGENT_PROMPTS[agent.id];
        const outputPath = path.join(OUTPUT_DIR, `${agent.id}.jpg`);

        process.stdout.write(`[${i + 1}/${agents.length}] ${agent.emoji} ${agent.name.padEnd(30)}`);

        if (!prompt) {
            console.log("⚠  Prompt tanımsız — atlandı");
            skipped++;
            continue;
        }

        if (!FORCE && fs.existsSync(outputPath)) {
            console.log("⏭  Zaten var — atlandı (--force ile yenile)");
            skipped++;
            continue;
        }

        try {
            // Generate 3 variations, save all, keep main as {id}.jpg
            const VARIATIONS = 3;
            const buffers = await generateImage(ai, agent.id, prompt, VARIATIONS);

            // Save main (first variation) as canonical
            fs.writeFileSync(outputPath, buffers[0]);

            // Save all variations as {id}-v1.jpg, {id}-v2.jpg, {id}-v3.jpg
            buffers.forEach((buf, vi) => {
                const vPath = path.join(OUTPUT_DIR, `${agent.id}-v${vi + 1}.jpg`);
                fs.writeFileSync(vPath, buf);
            });

            const kb = Math.round(buffers[0].length / 1024);
            console.log(`✅ ${kb} KB  (${buffers.length} varyasyon kaydedildi: -v1 -v2 -v3)`);
            success++;

            if (i < agents.length - 1) await sleep(DELAY_MS);

        } catch (err) {
            console.log(`❌ HATA: ${err.message}`);
            failed++;
            if (i < agents.length - 1) await sleep(DELAY_MS);
        }
    }

    console.log("─".repeat(50));
    console.log(`\n✅ Başarılı : ${success}`);
    console.log(`⏭  Atlandı  : ${skipped}`);
    console.log(`❌ Başarısız : ${failed}`);
    console.log(`\n💡 Kartları görmek için: http://localhost:8080/agent-cards/agent-cards.html\n`);
}

main().catch((err) => {
    console.error("\n❌ Beklenmedik hata:", err.message);
    process.exit(1);
});
