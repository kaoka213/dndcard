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
    { keyword: /\bweb\s*search\b|\bsearch\s+the\s+web\b/i, tool: 'WebSearch' },
    { keyword: /\bbrowse\b|\burl\b|\bwebsite\b|\bfetch\b/i,  tool: 'WebFetch'  },
    { keyword: /\bwrite\s+(to|a)\s+file\b|\bsave\s+(to|a)\s+file\b/i, tool: 'Write' },
    { keyword: /\bread\s+(the\s+)?file\b|\bopen\s+(the\s+)?file\b/i,  tool: 'Read'  },
    { keyword: /\bedit\s+(the\s+)?file\b|\bmodify\s+(the\s+)?file\b/i, tool: 'Edit' },
    { keyword: /\brun\b|\bexecute\b|\bbash\b|\bterminal\b|\bshell\b/i, tool: 'Bash' },
    { keyword: /\bsearch\s+(for\s+)?code\b|\bgrep\b|\bfind\s+(in|files)/i, tool: 'Grep' },
    { keyword: /\bimage\b|\bgenerate.*image\b|\bdall-e\b|\bstable\s*diffusion\b/i, tool: 'Image' },
    { keyword: /\bapi\s+call\b|\bhttp\s+request\b|\brest\s+api\b/i, tool: 'API' },
    { keyword: /\bdatabase\b|\bsql\b|\bquery\b/i, tool: 'Database' },
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
    const capabilities = tagsToCapabilities(raw.tags || [], raw.name);
    const tools = extractTools(raw.prompt);

    return {
        // Core fields (card renderer uses these)
        id:           raw.id,
        name:         raw.name,
        category,
        emoji:        raw.icon || '🤖',
        description:  (raw.description || '').slice(0, 220),
        capabilities: capabilities.length > 0 ? capabilities : ['System Prompt'],
        tools:        tools.length > 0 ? tools : ['Read'],
        accentColor,

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
