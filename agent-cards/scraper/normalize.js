/**
 * normalize.js
 * ============
 * Scraped agent schema → Card renderer schema dönüşümü
 *
 * Input:  ../js/JSON/scraped-agents.json
 * Output: ../js/JSON/normalized-agents.json
 *
 * Usage: node normalize.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const IN_FILE  = path.join(__dirname, '..', 'js', 'JSON', 'scraped-agents.json');
const OUT_FILE = path.join(__dirname, '..', 'js', 'JSON', 'normalized-agents.json');

// ─── Category inference ───────────────────────────────────────────────────────

const CATEGORY_PATTERNS = {
    design: /design|ui\b|ux\b|visual|artist|art\b|image|photo|creative|color|colour|figma|illustrat|brand|logo|style|aesthetic|graphic|typography|layout|icon/i,
    dev:    /code|coding|develop|engineer|program|debug|git|docker|api\b|backend|frontend|sql|database|script|deploy|devops|architecture|refactor|review\s+code|software|tech\b|terminal|bash|cli\b|compiler|test.+code|javascript|python|typescript|react|flutter/i,
    qa:     /test\b|qa\b|quality|review\b|audit|check\b|security|bug\b|monitor|analysis|analys|inspect|validat|verify|evaluat|benchmark|diagnos|assess/i,
};

function inferCategory(tags, name, desc, sourceRepo) {
    const text = [tags.join(' '), name, desc || ''].join(' ');

    // Source-based overrides
    if (/piebald|claude-code/.test(sourceRepo)) return 'dev';
    if (/fabric/.test(sourceRepo)) return 'utility';
    if (/chatgpt/.test(sourceRepo)) {
        // chatgpt prompts: check name + tags for category hints
    }

    for (const [cat, re] of Object.entries(CATEGORY_PATTERNS)) {
        if (re.test(text)) return cat;
    }
    return 'utility';
}

// ─── Accent colour assignment ─────────────────────────────────────────────────

const SOURCE_PALETTES = {
    'lobehub':                    ['#8B5CF6', '#EC4899', '#0EA5E9', '#10B981', '#F59E0B', '#6366F1'],
    'danielmiessler/fabric':      ['#22D3EE', '#0891B2', '#06B6D4'],
    'f/awesome-chatgpt':          ['#10A37F', '#1A7F5A', '#059669'],
    'danielrosehill':             ['#F97316', '#EA580C', '#FB923C'],
    'piebald':                    ['#C084FC', '#A855F7', '#9333EA'],
    'dontriskit':                 ['#EF4444', '#DC2626', '#F87171'],
    'tallesborges':               ['#34D399', '#10B981'],
    'onamfc':                     ['#60A5FA', '#3B82F6'],
    'langgptai':                  ['#FBBF24', '#F59E0B'],
    'x1xhlol':                    ['#A78BFA', '#7C3AED'],
};

const CATEGORY_FALLBACK_COLORS = {
    design:  ['#EC4899', '#DB2777', '#F472B6'],
    dev:     ['#0EA5E9', '#0284C7', '#38BDF8'],
    qa:      ['#EF4444', '#DC2626', '#F87171'],
    utility: ['#64748B', '#475569', '#94A3B8'],
};

function pickAccentColor(sourceRepo, category, index) {
    // Try source-based palette
    const srcKey = Object.keys(SOURCE_PALETTES).find(k => sourceRepo.includes(k));
    if (srcKey) {
        const pal = SOURCE_PALETTES[srcKey];
        return pal[index % pal.length];
    }
    // Fall back to category color
    const catPal = CATEGORY_FALLBACK_COLORS[category] || CATEGORY_FALLBACK_COLORS.utility;
    return catPal[index % catPal.length];
}

// ─── Tool extraction from prompt text ─────────────────────────────────────────

const TOOL_KEYWORDS = [
    { keyword: /\bweb\s*search\b|\bsearch\s+the\s+web\b|\bgoogle\s+(it|for)\b/i, tool: 'WebSearch' },
    { keyword: /\bbrowse\b|\bweb\s*page\b|\bwebsite\b|\bfetch\s+(the\s+)?(url|page|content)\b/i,  tool: 'WebFetch'  },
    { keyword: /\bwrite\s+(to|a|the)\s+file\b|\bsave\s+(to|a)\s+file\b|\bcreate\s+(a\s+)?file\b/i, tool: 'Write' },
    { keyword: /\bread\s+(the\s+)?file\b|\bopen\s+(the\s+)?file\b|\bread\s+the\s+code\b/i,  tool: 'Read'  },
    { keyword: /\bedit\s+(the\s+)?file\b|\bmodify\s+(the\s+)?file\b|\brefactor\b|\bpatch\b/i, tool: 'Edit' },
    { keyword: /\brun\b|\bexecute\b|\bbash\b|\bterminal\b|\bshell\b|\bcommand\s*line\b|\bcli\b/i, tool: 'Bash' },
    { keyword: /\bsearch\s+(for\s+)?code\b|\bgrep\b|\bfind\s+(in|files|the)\b|\bsearch\s+the\s+codebase\b/i, tool: 'Grep' },
    { keyword: /\bglob\b|\bfile\s+pattern\b|\blist\s+files\b/i, tool: 'Glob' },
    { keyword: /\bgenerate\s+(an?\s+)?image\b|\bdall-?e\b|\bstable\s*diffusion\b|\bmidjourney\b|\bimagen\b/i, tool: 'Image' },
    { keyword: /\bapi\s+call\b|\bhttp\s+request\b|\brest\s+api\b|\bendpoint\b/i, tool: 'API' },
    { keyword: /\bdatabase\b|\bsql\b|\bsql\s+query\b|\bpostgres\b|\bmongo\b/i, tool: 'Database' },
];

function extractTools(prompt) {
    if (!prompt) return [];
    const found = [];
    for (const { keyword, tool } of TOOL_KEYWORDS) {
        if (keyword.test(prompt) && !found.includes(tool)) {
            found.push(tool);
            if (found.length >= 5) break;
        }
    }
    return found;
}

/** Category-based default toolset when prompt yields no signal */
const CATEGORY_DEFAULT_TOOLS = {
    design:  ['Read', 'Write', 'Image'],
    dev:     ['Read', 'Edit', 'Bash'],
    qa:      ['Read', 'Grep', 'Bash'],
    utility: ['Read', 'Write'],
};

// ─── Colour helpers (gradientEnd derivation) ──────────────────────────────────

function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
    if (!m) return { r: 100, g: 116, b: 139 }; // slate fallback
    let h = m[1];
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            default: h = (r - g) / d + 4;
        }
        h /= 6;
    }
    return { h, s, l };
}

function hslToHex(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = v => Math.round(Math.max(0, Math.min(255, v * 255))).toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

/** Deep dark shadow tone keeping the accent hue — used as card background end + Imagen palette */
function gradientEndFromAccent(accentHex) {
    const { h, s } = rgbToHsl(hexToRgb(accentHex));
    return hslToHex(h, Math.min(s, 0.7), 0.11);
}

/** Approximate accent hex to a human colour word for the image prompt */
function colorName(accentHex) {
    const { h, s, l } = rgbToHsl(hexToRgb(accentHex));
    if (s < 0.15) return l < 0.4 ? 'dark silver' : 'silver';
    const deg = h * 360;
    if (deg < 15)  return 'red';
    if (deg < 40)  return 'orange';
    if (deg < 65)  return 'amber';
    if (deg < 95)  return 'lime green';
    if (deg < 160) return 'emerald green';
    if (deg < 195) return 'teal';
    if (deg < 215) return 'cyan';
    if (deg < 255) return 'blue';
    if (deg < 290) return 'violet';
    if (deg < 330) return 'magenta';
    return 'red';
}

// ─── imagePrompt generation (subject for Imagen) ──────────────────────────────

// Name/tag keyword → iconic subject motif. {C} is replaced with the colour word.
const KEYWORD_MOTIFS = [
    { re: /ghost|spirit|phantom|haunt/i,                    subject: 'a translucent hooded ghost spirit with soft inner {C} glow, arms outstretched' },
    { re: /clean|janitor|sweep|tidy|declutter/i,            subject: 'a hooded figure sweeping away glowing {C} embers with a luminous broom' },
    { re: /architect|blueprint|lead\b|system\s+design/i,    subject: 'a commanding architect holding a luminous {C} holographic blueprint scroll' },
    { re: /bug|debug|detective|hunt|tracker/i,              subject: 'a noir detective in a trench coat holding a glowing {C} magnifying glass' },
    { re: /security|guard|sentinel|defen[sc]|shield|threat/i, subject: 'an armored sentinel holding a radiant {C} energy shield' },
    { re: /audit|consisten|inspect|review|valid|verify/i,   subject: 'a focused analyst in a coat holding a glowing {C} inspection lens' },
    { re: /test|qa\b|quality/i,                             subject: 'a lab scientist in a coat holding a glowing {C} checklist orb' },
    { re: /writ|author|content|copy|blog|essay|story/i,     subject: 'a robed scribe writing with a glowing {C} quill' },
    { re: /teach|tutor|mentor|guide|coach|learn|educat/i,   subject: 'a wise hooded elder holding an open glowing {C} ancient book' },
    { re: /data|analy|research|scien|statistic/i,           subject: 'a focused researcher holding a glowing {C} data orb' },
    { re: /market|sales|growth|seo|advertis|brand/i,        subject: 'a sharp suited strategist holding a glowing {C} upward arrow' },
    { re: /translat|language|lingu|grammar/i,               subject: 'a robed linguist surrounded by floating glowing {C} script glyphs' },
    { re: /ui\b|ux\b|interface|wireframe/i,                 subject: 'a futuristic robed designer holding a luminous {C} interface panel' },
    { re: /image|photo|paint|illustrat|draw|art\b|artist/i, subject: 'a futuristic robed artist holding a luminous {C} colour palette' },
    { re: /gamif|game|play|rpg|quest/i,                     subject: 'a heroic figure holding a glowing {C} orb of light' },
    { re: /finance|money|invest|account|budget|trading/i,   subject: 'a composed figure holding a glowing {C} coin of light' },
    { re: /law|legal|attorney|contract|compliance/i,        subject: 'a robed figure holding glowing {C} scales of justice' },
    { re: /health|medic|doctor|therap|fitness|nutrition/i,  subject: 'a serene healer holding a glowing {C} medical emblem' },
    { re: /chef|cook|recipe|food|culinary/i,                subject: 'a chef holding a glowing {C} cooking utensil' },
    { re: /music|audio|sound|compose/i,                     subject: 'a robed musician holding a glowing {C} sound wave orb' },
    { re: /devops|deploy|docker|cloud|infrastructure|kubernet/i, subject: 'an engineer holding a glowing {C} server cube' },
    { re: /code|develop|engineer|program|backend|frontend|software|api\b/i, subject: 'a focused hooded developer holding a glowing {C} circuit cube' },
];

const CATEGORY_ARCHETYPE = {
    design:  'a robed creative artist holding a luminous {C} colour palette',
    dev:     'a focused hooded developer holding a glowing {C} circuit cube',
    qa:      'a meticulous analyst in a coat holding a glowing {C} inspection lens',
    utility: 'a versatile humanoid figure made of flowing {C} light',
};

function buildImagePrompt(name, tags, description, category, accentHex) {
    const C = colorName(accentHex);
    const haystack = [name, (tags || []).join(' '), description || ''].join(' ');
    let template = null;
    for (const { re, subject } of KEYWORD_MOTIFS) {
        if (re.test(haystack)) { template = subject; break; }
    }
    if (!template) template = CATEGORY_ARCHETYPE[category] || CATEGORY_ARCHETYPE.utility;
    return template.replace(/\{C\}/g, C);
}

// ─── Capability extraction from prompt (when tags are weak) ───────────────────

function extractCapabilitiesFromPrompt(prompt) {
    if (!prompt) return [];
    const caps = [];
    const lines = prompt.split('\n');
    for (const raw of lines) {
        const line = raw.trim();
        // Markdown headings (## Title) and list items (- item / 1. item)
        let m = line.match(/^#{2,4}\s+(.{3,48})$/) ||
                line.match(/^[-*]\s+(.{3,48})$/) ||
                line.match(/^\d+[.)]\s+(.{3,48})$/);
        if (!m) continue;
        let text = m[1].replace(/[*_`:#]+/g, '').replace(/\(.*?\)/g, '').trim();
        // Skip noise / overly generic headings
        if (/^(overview|introduction|notes?|examples?|important|warning|context|summary|about)$/i.test(text)) continue;
        if (text.split(/\s+/).length > 6) text = text.split(/\s+/).slice(0, 5).join(' ');
        text = text.replace(/\b\w/g, c => c.toUpperCase());
        if (text.length >= 3 && !caps.includes(text)) caps.push(text);
        if (caps.length >= 4) break;
    }
    return caps;
}

// ─── Capability generation from tags ─────────────────────────────────────────

function tagsToCapabilities(tags, name) {
    // Prefer tags that read like capabilities (skip generic meta-tags)
    const skipTags = new Set(['chatgpt-prompts', 'role-play', 'general', 'dev', 'danielrosehill',
                               'fabric', 'pattern', 'leaked', 'system-prompt', 'agent', 'curated',
                               'claude-code', 'agent-prompt', 'anthropic', 'agentic', 'coding-agent',
                               'system-prompt-library', 'agent-library']);

    const meaningful = tags
        .filter(t => !skipTags.has(t) && t.length > 2)
        .slice(0, 4)
        .map(t => t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

    // If we got fewer than 2 meaningful tags, derive from name words
    if (meaningful.length < 2) {
        const nameWords = name.split(/\s+/).filter(w => w.length > 3).slice(0, 2);
        return [...meaningful, ...nameWords].slice(0, 4);
    }
    return meaningful;
}

// ─── Main normalization ───────────────────────────────────────────────────────

function normalizeAgent(raw, index) {
    const category = inferCategory(
        raw.tags || [], raw.name, raw.description, raw.source_repo || ''
    );
    const accentColor = pickAccentColor(raw.source_repo || '', category, index);
    const gradientEnd = gradientEndFromAccent(accentColor);

    // Capabilities: prefer meaningful tags, fall back to prompt headings, then generic
    let capabilities = tagsToCapabilities(raw.tags || [], raw.name);
    if (capabilities.length < 2) {
        const fromPrompt = extractCapabilitiesFromPrompt(raw.prompt);
        capabilities = [...new Set([...capabilities, ...fromPrompt])].slice(0, 4);
    }
    if (capabilities.length === 0) capabilities = ['System Prompt'];

    // Tools: prompt signal first, else category-based default
    let tools = extractTools(raw.prompt);
    if (tools.length === 0) tools = CATEGORY_DEFAULT_TOOLS[category] || ['Read'];

    const sigLabel = (raw.source_repo || '').split('/').pop() || '';
    const imagePrompt = buildImagePrompt(raw.name, raw.tags, raw.description, category, accentColor);

    return {
        // Core fields (card renderer uses these)
        id:           raw.id,
        name:         raw.name,
        category,
        emoji:        raw.icon || '🤖',
        description:  (raw.description || '').slice(0, 220),
        capabilities,
        tools,
        accentColor,
        gradientEnd,
        sigLabel,
        imagePrompt,

        // Extended fields (browse UI + prompt viewer use these)
        prompt:       raw.prompt || '',
        tags:         raw.tags || [],
        source_url:   raw.source_url || '',
        source_repo:  raw.source_repo || '',
    };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
    console.log('🔄 Normalizing scraped agents…');

    if (!fs.existsSync(IN_FILE)) {
        console.error('✗ scraped-agents.json not found. Run scrape-agents.js first.');
        process.exit(1);
    }

    const raw = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));
    console.log(`  Input:  ${raw.agents.length} agents from ${Object.keys(raw.meta.sources || {}).length} sources`);

    const normalized = raw.agents.map((agent, i) => normalizeAgent(agent, i));

    // Stats
    const catCounts = {};
    normalized.forEach(a => { catCounts[a.category] = (catCounts[a.category] || 0) + 1; });

    const output = {
        meta: {
            ...raw.meta,
            normalized_at: new Date().toISOString().slice(0, 10),
            total: normalized.length,
            categories: catCounts,
        },
        agents: normalized,
    };

    fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');

    const sizeMB = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(1);
    console.log(`\n✅ Done!`);
    console.log(`   Output:     ${OUT_FILE}`);
    console.log(`   File size:  ${sizeMB} MB`);
    console.log(`   Total:      ${normalized.length} agents`);
    console.log('   Categories:', catCounts);
    console.log('\n   Sample:');
    const sample = normalized.find(a => a.prompt.length > 200) || normalized[0];
    console.log(`   ${sample.name} [${sample.category}] ${sample.accentColor}`);
    console.log(`   caps: ${sample.capabilities.join(', ')}`);
    console.log(`   tools: ${sample.tools.join(', ')}`);
}

main();
