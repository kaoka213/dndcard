/**
 * Agent System Prompt Scraper
 * ===========================
 * Collects agent system prompts from GitHub repositories into a unified JSON.
 *
 * Output: ../js/JSON/scraped-agents.json
 *
 * Usage:
 *   node scrape-agents.js
 *   GITHUB_TOKEN=ghp_xxx node scrape-agents.js   (faster, 5000 req/hr vs 60)
 *
 * Sources:
 *   1. lobehub/lobe-chat-agents        — 500+ agents, perfect schema match
 *   2. dontriskit/awesome-ai-system-prompts — leaked real-tool system prompts
 *   3. Piebald-AI/claude-code-system-prompts — Claude Code internal prompts
 *   4. langgptai/awesome-system-prompts — curated agent prompts
 *   5. asgeirtj/system_prompts_leaks    — leaked prompts
 *   6. x1xhlol/system-prompts-and-models-of-ai-tools — AI tool prompts
 */

'use strict';

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

// ─── Load .env (no external dependency needed) ───────────────────────────────

(function loadEnv() {
    const envPath = path.join(__dirname, '..', '..', '.env');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
        const m = line.match(/^\s*([\w]+)\s*=\s*["']?([^"'\r\n]+)["']?\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
})();

// ─── Config ──────────────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const DELAY_MS     = GITHUB_TOKEN ? 80 : 1100; // ~750/hr unauthenticated is safe
const OUT_FILE     = path.join(__dirname, '..', 'js', 'JSON', 'scraped-agents.json');

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function request(url, isJson = true) {
    return new Promise((resolve, reject) => {
        const opts = {
            headers: {
                'User-Agent': 'agent-scraper/1.0',
                'Accept': isJson ? 'application/vnd.github.v3+json' : 'text/plain',
            },
        };
        if (GITHUB_TOKEN) opts.headers['Authorization'] = `token ${GITHUB_TOKEN}`;

        https.get(url, opts, (res) => {
            // Follow redirects
            if (res.statusCode === 301 || res.statusCode === 302) {
                return resolve(request(res.headers.location, isJson));
            }
            if (res.statusCode === 403 || res.statusCode === 429) {
                const retry = parseInt(res.headers['x-ratelimit-reset'] || '0', 10);
                const wait  = retry ? Math.max(0, retry * 1000 - Date.now()) + 2000 : 60000;
                console.warn(`  ⚠ Rate limited. Waiting ${Math.ceil(wait / 1000)}s…`);
                return setTimeout(() => resolve(request(url, isJson)), wait);
            }
            if (res.statusCode === 404) {
                return resolve(null);
            }
            if (res.statusCode !== 200) {
                console.warn(`  ⚠ HTTP ${res.statusCode} for ${url}`);
                return resolve(null);
            }

            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => (body += chunk));
            res.on('end', () => {
                if (!isJson) return resolve(body);
                try { resolve(JSON.parse(body)); }
                catch (e) { console.warn(`  ⚠ JSON parse error for ${url}`); resolve(null); }
            });
        }).on('error', reject);
    });
}

const githubApi  = (path) => request(`https://api.github.com${path}`, true);
const rawContent = (url)  => request(url, false);

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Text helpers ─────────────────────────────────────────────────────────────

function slugify(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

function titleCase(slug) {
    return slug
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/** Return the first meaningful paragraph from markdown text */
function firstParagraph(text, maxLen = 180) {
    if (!text) return '';
    const lines = text.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#') && !l.startsWith('```') && !l.startsWith('|'));
    const para = (lines[0] || '').replace(/\*\*|__|`/g, '').trim();
    return para.length > maxLen ? para.slice(0, maxLen).replace(/\s+\S*$/, '…') : para;
}

/** Sanitise prompt: remove BOM, fix Mojibake common cases */
function cleanPrompt(text) {
    if (!text) return '';
    return text
        .replace(/^﻿/, '')                     // BOM
        .replace(/â€™/g, "'").replace(/â€œ/g, '"').replace(/â€\x9D/g, '"')
        .replace(/â€"/g, '–').replace(/â€"/g, '—')
        .replace(/\r\n/g, '\n')
        .trim();
}

// ─── Source 1: lobehub/lobe-chat-agents ──────────────────────────────────────

async function scrapeLobehub() {
    console.log('\n📦 Source 1: lobehub/lobe-chat-agents');
    const files = await githubApi('/repos/lobehub/lobe-chat-agents/contents/src');
    if (!files || !Array.isArray(files)) {
        console.log('  ✗ Could not list src/');
        return [];
    }

    // Skip locale variants — keep only English (no ".zh-CN." ".ko." etc.)
    const englishFiles = files.filter(f =>
        f.name.endsWith('.json') && !/\.[a-z]{2}(-[A-Z]{2})?\.json$/.test(f.name)
    );
    console.log(`  Found ${files.length} files, ${englishFiles.length} English`);

    const results = [];
    for (let i = 0; i < englishFiles.length; i++) {
        const file = englishFiles[i];
        if (i % 50 === 0) process.stdout.write(`  Fetching ${i + 1}/${englishFiles.length}…\r`);

        const data = await request(file.download_url, true);
        await delay(DELAY_MS);

        if (!data || !data.meta) continue;

        const prompt = cleanPrompt(data.config?.systemRole || '');
        if (!prompt) continue; // skip agents with no system prompt

        results.push({
            id:          data.identifier || slugify(data.meta.title),
            name:        data.meta.title || '',
            description: data.meta.description || data.summary || '',
            icon:        data.meta.avatar || '🤖',
            tags:        data.meta.tags || (data.meta.category ? [data.meta.category] : []),
            prompt,
            source_url:  `https://github.com/lobehub/lobe-chat-agents/blob/main/src/${file.name}`,
            source_repo: 'lobehub/lobe-chat-agents',
        });
    }
    console.log(`  ✓ ${results.length} agents collected`);
    return results;
}

// ─── Source 2: dontriskit/awesome-ai-system-prompts ──────────────────────────

async function scrapeAwesomeAiSystemPrompts() {
    console.log('\n📦 Source 2: dontriskit/awesome-ai-system-prompts');
    const root = await githubApi('/repos/dontriskit/awesome-ai-system-prompts/contents');
    if (!root) return [];

    const dirs = root.filter(f => f.type === 'dir' && !['security', '.github'].includes(f.name));
    console.log(`  Found ${dirs.length} tool folders`);

    const results = [];
    for (const dir of dirs) {
        const contents = await githubApi(`/repos/dontriskit/awesome-ai-system-prompts/contents/${encodeURIComponent(dir.name)}`);
        await delay(DELAY_MS);
        if (!contents) continue;

        // Priority: System.md > README.md > first .md > first .txt > System.js
        const priority = ['System.md', 'README.md'];
        let promptFile = null;
        for (const name of priority) {
            promptFile = contents.find(f => f.name === name);
            if (promptFile) break;
        }
        if (!promptFile) {
            promptFile = contents.find(f => f.name.endsWith('.md')) ||
                         contents.find(f => f.name.endsWith('.txt')) ||
                         contents.find(f => f.name === 'System.js');
        }
        if (!promptFile) continue;

        const raw = await rawContent(promptFile.download_url);
        await delay(DELAY_MS);
        if (!raw) continue;

        const prompt = cleanPrompt(raw);
        if (prompt.length < 50) continue; // skip stubs

        const name = dir.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const desc  = firstParagraph(raw);

        results.push({
            id:          slugify(dir.name),
            name,
            description: desc,
            icon:        '🔓',
            tags:        [dir.name.toLowerCase(), 'system-prompt', 'leaked'],
            prompt,
            source_url:  `https://github.com/dontriskit/awesome-ai-system-prompts/tree/main/${dir.name}`,
            source_repo: 'dontriskit/awesome-ai-system-prompts',
        });
    }
    console.log(`  ✓ ${results.length} agents collected`);
    return results;
}

// ─── Source 3: Piebald-AI/claude-code-system-prompts ─────────────────────────

async function scrapePiebaldAI() {
    console.log('\n📦 Source 3: Piebald-AI/claude-code-system-prompts');

    // Fetch agent-prompt-*.md files from system-prompts/ folder
    const files = await githubApi('/repos/Piebald-AI/claude-code-system-prompts/contents/system-prompts');
    if (!files) return [];

    const agentFiles = files.filter(f =>
        f.type === 'file' && f.name.startsWith('agent-prompt-') && f.name.endsWith('.md')
    );
    console.log(`  Found ${agentFiles.length} agent-prompt files`);

    const results = [];
    for (let i = 0; i < agentFiles.length; i++) {
        const file = agentFiles[i];
        if (i % 20 === 0) process.stdout.write(`  Fetching ${i + 1}/${agentFiles.length}…\r`);

        const raw = await rawContent(file.download_url);
        await delay(DELAY_MS);
        if (!raw || raw.trim().length < 30) continue;

        const slug = file.name.replace('agent-prompt-', '').replace('.md', '');
        const name = titleCase(slug);
        const prompt = cleanPrompt(raw);
        const desc   = firstParagraph(raw, 160);

        results.push({
            id:          `cc-${slug}`,
            name:        `[CC] ${name}`,
            description: desc,
            icon:        '🦊',
            tags:        ['claude-code', 'agent-prompt', 'anthropic'],
            prompt,
            source_url:  `https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/${file.name}`,
            source_repo: 'Piebald-AI/claude-code-system-prompts',
        });
    }
    console.log(`  ✓ ${results.length} agents collected`);
    return results;
}

// ─── Source 4: langgptai/awesome-system-prompts — Agents folder ───────────────

async function scrapeLanggptAgents() {
    console.log('\n📦 Source 4: langgptai/awesome-system-prompts (Agents/)');
    const dirs = await githubApi('/repos/langgptai/awesome-system-prompts/contents/Agents');
    if (!dirs) return [];

    const results = [];
    for (const dir of dirs.filter(f => f.type === 'dir')) {
        const contents = await githubApi(`/repos/langgptai/awesome-system-prompts/contents/Agents/${encodeURIComponent(dir.name)}`);
        await delay(DELAY_MS);
        if (!contents) continue;

        const mdFile = contents.find(f => f.name.endsWith('.md'));
        if (!mdFile) continue;

        const raw = await rawContent(mdFile.download_url);
        await delay(DELAY_MS);
        if (!raw || raw.length < 50) continue;

        const prompt = cleanPrompt(raw);
        const name   = dir.name.replace(/([A-Z])/g, ' $1').trim();
        const desc   = firstParagraph(raw);

        results.push({
            id:          slugify(dir.name),
            name,
            description: desc,
            icon:        '⚡',
            tags:        ['agent', dir.name.toLowerCase(), 'curated'],
            prompt,
            source_url:  `https://github.com/langgptai/awesome-system-prompts/tree/main/Agents/${dir.name}`,
            source_repo: 'langgptai/awesome-system-prompts',
        });
    }
    console.log(`  ✓ ${results.length} agents collected`);
    return results;
}

// ─── Source 5: asgeirtj/system_prompts_leaks ─────────────────────────────────

async function scrapeSystemPromptsLeaks() {
    console.log('\n📦 Source 5: asgeirtj/system_prompts_leaks');
    const root = await githubApi('/repos/asgeirtj/system_prompts_leaks/contents');
    if (!root) return [];

    const mdFiles = root.filter(f => f.type === 'file' && f.name.endsWith('.md') && f.name !== 'README.md');
    console.log(`  Found ${mdFiles.length} markdown files`);

    const results = [];
    for (const file of mdFiles) {
        const raw = await rawContent(file.download_url);
        await delay(DELAY_MS);
        if (!raw || raw.length < 100) continue;

        const slug = file.name.replace('.md', '');
        const name = titleCase(slug);
        const prompt = cleanPrompt(raw);

        results.push({
            id:          `leak-${slugify(slug)}`,
            name:        `[Leaked] ${name}`,
            description: firstParagraph(raw),
            icon:        '🔐',
            tags:        ['leaked', 'system-prompt', slug.toLowerCase()],
            prompt,
            source_url:  `https://github.com/asgeirtj/system_prompts_leaks/blob/main/${file.name}`,
            source_repo: 'asgeirtj/system_prompts_leaks',
        });
    }
    console.log(`  ✓ ${results.length} agents collected`);
    return results;
}

// ─── Source 6: x1xhlol/system-prompts-and-models-of-ai-tools ────────────────

async function scrapeX1Xlol() {
    console.log('\n📦 Source 6: x1xhlol/system-prompts-and-models-of-ai-tools');
    const root = await githubApi('/repos/x1xhlol/system-prompts-and-models-of-ai-tools/contents');
    if (!root) return [];

    // Only grab top-level .txt or .md files (skip sub-dirs, README)
    const promptFiles = root.filter(f =>
        f.type === 'file' &&
        (f.name.endsWith('.txt') || f.name.endsWith('.md')) &&
        !f.name.startsWith('README')
    );

    // Also check first-level dirs for .txt / .md
    const topDirs = root.filter(f => f.type === 'dir').slice(0, 10);
    for (const dir of topDirs) {
        const contents = await githubApi(`/repos/x1xhlol/system-prompts-and-models-of-ai-tools/contents/${encodeURIComponent(dir.name)}`);
        await delay(DELAY_MS);
        if (!contents) continue;
        const sub = contents.filter(f => f.type === 'file' && (f.name.endsWith('.txt') || f.name.endsWith('.md')));
        promptFiles.push(...sub);
    }

    console.log(`  Found ${promptFiles.length} prompt files`);

    const results = [];
    for (const file of promptFiles.slice(0, 60)) { // cap at 60 to avoid rate limits
        const raw = await rawContent(file.download_url);
        await delay(DELAY_MS);
        if (!raw || raw.length < 80) continue;

        const slug = path.basename(file.name, path.extname(file.name));
        const name = titleCase(slug);
        const prompt = cleanPrompt(raw);

        results.push({
            id:          `x1x-${slugify(slug)}`,
            name,
            description: firstParagraph(raw),
            icon:        '🛠️',
            tags:        ['ai-tool', slug.toLowerCase(), 'system-prompt'],
            prompt,
            source_url:  `https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools/blob/main/${file.path}`,
            source_repo: 'x1xhlol/system-prompts-and-models-of-ai-tools',
        });
    }
    console.log(`  ✓ ${results.length} agents collected`);
    return results;
}

// ─── Source 7: danielmiessler/fabric — patterns ──────────────────────────────

async function scrapeFabric() {
    console.log('\n📦 Source 7: danielmiessler/fabric (patterns/)');

    // Get full recursive tree to find all data/patterns/{name}/system.md
    const tree = await githubApi('/repos/danielmiessler/fabric/git/trees/HEAD?recursive=1');
    if (!tree || !tree.tree) return [];

    const systemFiles = tree.tree.filter(x =>
        x.type === 'blob' &&
        x.path.startsWith('data/patterns/') &&
        x.path.endsWith('/system.md')
    );
    console.log(`  Found ${systemFiles.length} pattern system.md files`);

    const results = [];
    for (let i = 0; i < systemFiles.length; i++) {
        const item = systemFiles[i];
        if (i % 50 === 0) process.stdout.write(`  Fetching ${i + 1}/${systemFiles.length}…\r`);

        const rawUrl = `https://raw.githubusercontent.com/danielmiessler/fabric/main/${item.path}`;
        const raw = await rawContent(rawUrl);
        await delay(DELAY_MS);
        if (!raw || raw.trim().length < 30) continue;

        // Pattern name from path: "data/patterns/analyze_claims/system.md" → "analyze_claims"
        const patternName = item.path.split('/')[2];
        const name  = titleCase(patternName);
        const prompt = cleanPrompt(raw);
        const desc   = firstParagraph(raw, 160);

        results.push({
            id:          `fabric-${slugify(patternName)}`,
            name,
            description: desc,
            icon:        '🧵',
            tags:        ['fabric', 'pattern', patternName.replace(/_/g, '-')],
            prompt,
            source_url:  `https://github.com/danielmiessler/fabric/blob/main/${item.path}`,
            source_repo: 'danielmiessler/fabric',
        });
    }
    console.log(`  ✓ ${results.length} agents collected`);
    return results;
}

// ─── Source 8: f/awesome-chatgpt-prompts — CSV ───────────────────────────────

async function scrapeAwesomeChatGPTPrompts() {
    console.log('\n📦 Source 8: f/awesome-chatgpt-prompts (prompts.csv)');

    const csvUrl = 'https://raw.githubusercontent.com/f/awesome-chatgpt-prompts/main/prompts.csv';
    const raw = await rawContent(csvUrl);
    if (!raw) return [];

    // Simple CSV parser (handles quoted fields with embedded newlines/commas)
    const rows = parseCSV(raw);
    console.log(`  Parsed ${rows.length} prompts from CSV`);

    const results = rows
        .filter(r => r.act && r.prompt && r.prompt.length > 30)
        .map(r => ({
            id:          `chatgpt-${slugify(r.act)}`,
            name:        r.act.trim(),
            description: r.prompt.slice(0, 160).replace(/\s+\S*$/, '…'),
            icon:        '💬',
            tags:        ['chatgpt-prompts', 'role-play', r.for_devs === 'TRUE' ? 'dev' : 'general'].filter(Boolean),
            prompt:      cleanPrompt(r.prompt),
            source_url:  'https://github.com/f/awesome-chatgpt-prompts',
            source_repo: 'f/awesome-chatgpt-prompts',
        }));

    console.log(`  ✓ ${results.length} agents collected`);
    return results;
}

/** Minimal RFC 4180 CSV parser */
function parseCSV(text) {
    const rows = [];
    let headers = null;
    let i = 0;

    while (i < text.length) {
        const row = [];
        while (i < text.length) {
            let field = '';
            if (text[i] === '"') {
                i++; // skip opening quote
                while (i < text.length) {
                    if (text[i] === '"' && text[i + 1] === '"') { field += '"'; i += 2; }
                    else if (text[i] === '"') { i++; break; }
                    else { field += text[i++]; }
                }
            } else {
                while (i < text.length && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
                    field += text[i++];
                }
            }
            row.push(field);
            if (i < text.length && text[i] === ',') { i++; continue; }
            break;
        }
        // skip \r\n or \n
        if (i < text.length && text[i] === '\r') i++;
        if (i < text.length && text[i] === '\n') i++;

        if (!headers) { headers = row; continue; }
        if (row.length === 1 && row[0] === '') continue;
        const obj = {};
        headers.forEach((h, idx) => obj[h] = row[idx] || '');
        rows.push(obj);
    }
    return rows;
}

// ─── Source 9: onamfc/agent-prompt-library ───────────────────────────────────

async function scrapeOnamfc() {
    console.log('\n📦 Source 9: onamfc/agent-prompt-library');

    const meta = await request('https://raw.githubusercontent.com/onamfc/agent-prompt-library/main/agents.json', true);
    if (!meta || !meta.agents) return [];

    console.log(`  Found ${meta.agents.length} agents in agents.json`);
    const results = [];

    for (const agent of meta.agents) {
        const promptUrl = `https://raw.githubusercontent.com/onamfc/agent-prompt-library/main/${agent.path}`;
        const raw = await rawContent(promptUrl);
        await delay(DELAY_MS);
        if (!raw) continue;

        // Strip YAML frontmatter (--- ... ---)
        const promptBody = raw.replace(/^---[\s\S]*?---\n?/, '').trim();
        if (promptBody.length < 30) continue;

        results.push({
            id:          `onamfc-${slugify(agent.id || agent.name)}`,
            name:        agent.name,
            description: agent.description || firstParagraph(promptBody),
            icon:        '🤝',
            tags:        [...(agent.tags || []), agent.category, 'agent-library'].filter(Boolean),
            prompt:      cleanPrompt(promptBody),
            source_url:  `https://github.com/onamfc/agent-prompt-library/tree/main/${agent.path.split('/')[0]}`,
            source_repo: 'onamfc/agent-prompt-library',
        });
    }
    console.log(`  ✓ ${results.length} agents collected`);
    return results;
}

// ─── Source 10: tallesborges/agentic-system-prompts ──────────────────────────

async function scrapeTallesborges() {
    console.log('\n📦 Source 10: tallesborges/agentic-system-prompts');

    const dirs = await githubApi('/repos/tallesborges/agentic-system-prompts/contents/agents');
    if (!dirs) return [];

    const results = [];
    for (const dir of dirs.filter(f => f.type === 'dir')) {
        // Each agent dir has system-prompt.md (sometimes system-prompt.j2)
        const files = await githubApi(`/repos/tallesborges/agentic-system-prompts/contents/agents/${dir.name}`);
        await delay(DELAY_MS);
        if (!files) continue;

        const promptFile = files.find(f => f.name === 'system-prompt.md') ||
                           files.find(f => f.name.endsWith('.md') && f.name !== 'README.md');
        if (!promptFile) continue;

        const raw = await rawContent(promptFile.download_url);
        await delay(DELAY_MS);
        if (!raw || raw.length < 50) continue;

        const name = dir.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        results.push({
            id:          `agentic-${slugify(dir.name)}`,
            name:        `${name} Agent`,
            description: firstParagraph(raw),
            icon:        '⚙️',
            tags:        [dir.name, 'agentic', 'coding-agent', 'system-prompt'],
            prompt:      cleanPrompt(raw),
            source_url:  `https://github.com/tallesborges/agentic-system-prompts/tree/main/agents/${dir.name}`,
            source_repo: 'tallesborges/agentic-system-prompts',
        });
    }
    console.log(`  ✓ ${results.length} agents collected`);
    return results;
}

// ─── Source 11: prompts.danielrosehill.com — single JSON ─────────────────────

async function scrapeDanielRosehillSite() {
    console.log('\n📦 Source 11: prompts.danielrosehill.com');
    const data = await request('https://prompts.danielrosehill.com/data/prompts.json', true);
    if (!data || !data.prompts) { console.log('  ✗ Could not fetch prompts.json'); return []; }

    console.log(`  Found ${data.prompts.length} prompts`);

    const results = data.prompts
        .filter(p => p.agentname && p.systemprompt && p.systemprompt.length > 20)
        .map(p => {
            const tags = ['danielrosehill'];
            if (p['is-agent'] === true || p['is-agent'] === 'true') tags.push('agent');
            if (p['structured-output-generation'] === 'true') tags.push('structured-output');
            if (p['image-generation'] === 'true') tags.push('image-generation');
            if (p['data-utility'] === 'true') tags.push('data-utility');
            if (p['personalised-system-prompt'] === 'true') tags.push('personalised');
            return {
                id:          `dr-site-${slugify(p.agentname)}`,
                name:        p.agentname,
                description: p.description || '',
                icon:        '📋',
                tags,
                prompt:      cleanPrompt(p.systemprompt),
                source_url:  p.chatgptlink || 'https://prompts.danielrosehill.com',
                source_repo: 'danielrosehill/prompts-site',
            };
        });

    console.log(`  ✓ ${results.length} agents collected`);
    return results;
}

// ─── Source 12: danielrosehill/System-Prompt-Library (GitHub JSON files) ─────

async function scrapeDanielRosehillGitHub() {
    console.log('\n📦 Source 12: danielrosehill/System-Prompt-Library');

    // Use CSV index for the list of agents + json_link field
    const csvRaw = await rawContent(
        'https://raw.githubusercontent.com/danielrosehill/System-Prompt-Library/main/index/index.csv'
    );
    if (!csvRaw) { console.log('  ✗ Could not fetch index.csv'); return []; }

    const rows = parseCSV(csvRaw).filter(r => r.agent_name && r.json_link);
    console.log(`  Found ${rows.length} rows in index.csv`);

    const results = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (i % 100 === 0) process.stdout.write(`  Fetching ${i + 1}/${rows.length}…\r`);

        // json_link is a relative path like "system-prompts/json/SomeFile.json"
        const filename = row.json_link.split('/').pop();
        const rawUrl = `https://raw.githubusercontent.com/danielrosehill/System-Prompt-Library/main/system-prompts/json/${filename}`;
        const json = await request(rawUrl, true);
        await delay(DELAY_MS);

        if (!json) continue;
        const prompt = cleanPrompt(json['System Prompt'] || '');
        if (prompt.length < 20) continue;

        const tags = ['danielrosehill', 'system-prompt-library'];
        if (json['Is Agent'])                                  tags.push('agent');
        if (json['Autonomous'])                                tags.push('autonomous');
        if (json['Structured Output (Workflow Type)'])         tags.push('structured-output');
        if (json['Image Generation (Workflow Type)'])          tags.push('image-generation');
        if (json['Deep Research'])                             tags.push('deep-research');
        if (json['Data Utility (Category)'])                   tags.push('data-utility');
        if (json['Writing Assistant'])                         tags.push('writing');
        if (json['Conversational'])                            tags.push('conversational');

        results.push({
            id:          `dr-gh-${slugify(json.agent_name || row.agent_name)}`,
            name:        json.agent_name || row.agent_name,
            description: (json.Description || json['One Line Summary'] || row.description || '').slice(0, 200),
            icon:        '🌿',
            tags,
            prompt,
            source_url:  json['ChatGPT Access URL'] || 'https://github.com/danielrosehill/System-Prompt-Library',
            source_repo: 'danielrosehill/System-Prompt-Library',
        });
    }
    console.log(`  ✓ ${results.length} agents collected`);
    return results;
}

// ─── Dedup & merge ────────────────────────────────────────────────────────────

function deduplicate(agents) {
    const seen = new Set();
    return agents.filter(a => {
        const key = a.id;
        if (seen.has(key)) {
            // Make id unique by appending source prefix
            a.id = `${a.source_repo.split('/')[0]}-${a.id}`;
        }
        seen.add(a.id);
        return true;
    });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const startTime = Date.now();
    console.log('🚀 Agent Scraper Starting');
    console.log(`   Auth: ${GITHUB_TOKEN ? '✓ Token set (5000 req/hr)' : '✗ No token (60 req/hr — slower)'}`);
    console.log(`   Delay: ${DELAY_MS}ms between requests`);
    console.log(`   Output: ${OUT_FILE}`);

    const allAgents = [];

    try {
        const lobehub  = await scrapeLobehub();
        allAgents.push(...lobehub);
    } catch (e) { console.error('  ✗ Lobehub failed:', e.message); }

    try {
        const dontriskit = await scrapeAwesomeAiSystemPrompts();
        allAgents.push(...dontriskit);
    } catch (e) { console.error('  ✗ dontriskit failed:', e.message); }

    try {
        const piebald = await scrapePiebaldAI();
        allAgents.push(...piebald);
    } catch (e) { console.error('  ✗ Piebald-AI failed:', e.message); }

    try {
        const langgpt = await scrapeLanggptAgents();
        allAgents.push(...langgpt);
    } catch (e) { console.error('  ✗ langgptai failed:', e.message); }

    try {
        const leaks = await scrapeSystemPromptsLeaks();
        allAgents.push(...leaks);
    } catch (e) { console.error('  ✗ asgeirtj leaks failed:', e.message); }

    try {
        const x1x = await scrapeX1Xlol();
        allAgents.push(...x1x);
    } catch (e) { console.error('  ✗ x1xhlol failed:', e.message); }

    try {
        const fabric = await scrapeFabric();
        allAgents.push(...fabric);
    } catch (e) { console.error('  ✗ fabric failed:', e.message); }

    try {
        const chatgpt = await scrapeAwesomeChatGPTPrompts();
        allAgents.push(...chatgpt);
    } catch (e) { console.error('  ✗ awesome-chatgpt-prompts failed:', e.message); }

    try {
        const onamfc = await scrapeOnamfc();
        allAgents.push(...onamfc);
    } catch (e) { console.error('  ✗ onamfc failed:', e.message); }

    try {
        const talles = await scrapeTallesborges();
        allAgents.push(...talles);
    } catch (e) { console.error('  ✗ tallesborges failed:', e.message); }

    try {
        const drSite = await scrapeDanielRosehillSite();
        allAgents.push(...drSite);
    } catch (e) { console.error('  ✗ danielrosehill site failed:', e.message); }

    try {
        const drGh = await scrapeDanielRosehillGitHub();
        allAgents.push(...drGh);
    } catch (e) { console.error('  ✗ danielrosehill GitHub failed:', e.message); }

    // Deduplicate and clean
    const unique = deduplicate(allAgents);

    // Collect source stats
    const sourceStats = {};
    for (const a of unique) {
        sourceStats[a.source_repo] = (sourceStats[a.source_repo] || 0) + 1;
    }

    const output = {
        meta: {
            scraped_at: new Date().toISOString().slice(0, 10),
            duration_sec: Math.round((Date.now() - startTime) / 1000),
            total: unique.length,
            sources: sourceStats,
        },
        agents: unique,
    };

    // Ensure output dir exists
    const outDir = path.dirname(OUT_FILE);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');

    console.log('\n✅ Done!');
    console.log(`   Total agents: ${unique.length}`);
    console.log('   By source:');
    for (const [src, count] of Object.entries(sourceStats)) {
        console.log(`     ${src}: ${count}`);
    }
    console.log(`   Duration: ${output.meta.duration_sec}s`);
    console.log(`   Output: ${OUT_FILE}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
