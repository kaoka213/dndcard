/**
 * browse-script.js
 * ================
 * Agent Prompt Library — arama, filtreleme, grid render, modal
 */

'use strict';

const Browse = {
    // ─── State ──────────────────────────────────────────────────────────
    allAgents:   [],
    filtered:    [],
    page:        1,
    PAGE_SIZE:   48,
    filters: {
        search:   '',
        source:   '',
        category: '',
        length:   '',
    },
    activeModal: null,

    // ─── Init ────────────────────────────────────────────────────────────
    async init() {
        this.showLoading(true);
        try {
            const res  = await fetch('js/JSON/normalized-agents.json');
            const data = await res.json();
            this.allAgents = data.agents || [];
        } catch (e) {
            console.error('normalized-agents.json yüklenemedi:', e);
            document.getElementById('cardGrid').innerHTML =
                '<div class="empty-state">⚠️ Veri yüklenemedi. <p>normalize.js çalıştırıldı mı?</p></div>';
            return;
        }
        this.showLoading(false);
        this.buildFilters();
        this.applyFilters();
        this.bindEvents();
    },

    // ─── Filter sidebar ──────────────────────────────────────────────────
    buildFilters() {
        this.buildSourceFilter();
        this.buildCategoryFilter();
        this.updateTotalBadge();
    },

    buildSourceFilter() {
        const counts = {};
        this.allAgents.forEach(a => {
            const src = a.source_repo || 'unknown';
            counts[src] = (counts[src] || 0) + 1;
        });
        const container = document.getElementById('sourceFilters');
        const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
        container.innerHTML = sorted.map(([src, cnt]) => {
            const label = src.split('/').pop(); // just repo name
            return `<div class="filter-option" data-filter="source" data-value="${src}">
                <span class="filter-dot"></span>
                <span>${label}</span>
                <span class="filter-count">${cnt}</span>
            </div>`;
        }).join('');
    },

    buildCategoryFilter() {
        const cats = { design:'🎨 Tasarım', dev:'⚙️ Geliştirme', qa:'🔍 Kalite & Test', utility:'🤖 Yardımcı' };
        const counts = {};
        this.allAgents.forEach(a => { counts[a.category] = (counts[a.category]||0)+1; });
        const container = document.getElementById('categoryFilters');
        container.innerHTML = Object.entries(cats).map(([key, label]) =>
            `<div class="filter-option" data-filter="category" data-value="${key}">
                <span class="filter-dot"></span>
                <span>${label}</span>
                <span class="filter-count">${counts[key]||0}</span>
            </div>`
        ).join('');
    },

    updateTotalBadge() {
        const el = document.getElementById('totalBadge');
        if (el) el.textContent = this.allAgents.length.toLocaleString() + ' agent';
    },

    // ─── Apply filters ───────────────────────────────────────────────────
    applyFilters() {
        const { search, source, category, length } = this.filters;
        const q = search.toLowerCase().trim();

        this.filtered = this.allAgents.filter(a => {
            if (source   && a.source_repo !== source)    return false;
            if (category && a.category    !== category)  return false;
            if (length) {
                const len = a.prompt.length;
                if (length === 'short'  && len >= 200)   return false;
                if (length === 'medium' && (len < 200 || len >= 2000)) return false;
                if (length === 'long'   && len < 2000)   return false;
            }
            if (q) {
                const text = [a.name, a.description, a.tags.join(' ')].join(' ').toLowerCase();
                if (!text.includes(q)) return false;
            }
            return true;
        });

        this.page = 1;
        this.render();
    },

    // ─── Render grid ─────────────────────────────────────────────────────
    render() {
        const grid = document.getElementById('cardGrid');
        const start = (this.page - 1) * this.PAGE_SIZE;
        const pageAgents = this.filtered.slice(start, start + this.PAGE_SIZE);

        // Count label
        const countEl = document.getElementById('resultsCount');
        if (countEl) {
            countEl.innerHTML = `<strong>${this.filtered.length.toLocaleString()}</strong> sonuç` +
                (this.filters.search ? ` "<em>${this.filters.search}</em>"` : '');
        }

        if (this.filtered.length === 0) {
            grid.innerHTML = '<div class="empty-state">🔍 Sonuç bulunamadı.<p>Farklı bir arama terimi deneyin.</p></div>';
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        grid.innerHTML = pageAgents.map(a => this.cardHTML(a)).join('');
        this.renderPagination();

        // Click handlers
        grid.querySelectorAll('.mini-card').forEach(el => {
            const id = el.dataset.id;
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('mini-card-btn')) return;
                const agent = this.allAgents.find(a => a.id === id);
                if (agent) this.openModal(agent);
            });
            el.querySelector('.mini-card-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const agent = this.allAgents.find(a => a.id === id);
                if (agent) this.openModal(agent);
            });
        });
    },

    cardHTML(agent) {
        const catLabels = { design:'Tasarım', dev:'Geliştirme', qa:'QA', utility:'Yardımcı' };
        const badge   = catLabels[agent.category] || agent.category;
        const tags    = (agent.tags || []).slice(0, 3);
        const src     = (agent.source_repo || '').split('/').pop();
        const accent  = agent.accentColor || '#64748B';
        return `<div class="mini-card" data-id="${this.esc(agent.id)}" style="--card-accent:${accent}">
            <div class="mini-card-header">
                <span class="mini-card-emoji">${agent.emoji || '🤖'}</span>
                <span class="mini-card-badge">${badge}</span>
            </div>
            <div class="mini-card-name">${this.esc(agent.name)}</div>
            ${agent.description ? `<div class="mini-card-desc">${this.esc(agent.description)}</div>` : ''}
            <div class="mini-card-tags">
                ${tags.map(t => `<span class="mini-tag">${this.esc(t)}</span>`).join('')}
            </div>
            <div class="mini-card-footer">
                <span class="mini-card-source">${this.esc(src)}</span>
                <button class="mini-card-btn">Görüntüle ↗</button>
            </div>
        </div>`;
    },

    // ─── Pagination ──────────────────────────────────────────────────────
    renderPagination() {
        const total = Math.ceil(this.filtered.length / this.PAGE_SIZE);
        if (total <= 1) { document.getElementById('pagination').innerHTML = ''; return; }

        const cur  = this.page;
        const pages = [];

        // Always show first, last, cur-1, cur, cur+1
        const show = new Set([1, total, cur, cur-1, cur+1].filter(p => p >= 1 && p <= total));
        const sorted = [...show].sort((a,b) => a-b);

        // Build with ellipsis
        let html = `<button class="page-btn" id="pgPrev" ${cur===1?'disabled':''}>‹</button>`;
        let prev = 0;
        for (const p of sorted) {
            if (p - prev > 1) html += `<span style="color:var(--text-muted);padding:0 4px">…</span>`;
            html += `<button class="page-btn${p===cur?' active':''}" data-page="${p}">${p}</button>`;
            prev = p;
        }
        html += `<button class="page-btn" id="pgNext" ${cur===total?'disabled':''}>›</button>`;

        document.getElementById('pagination').innerHTML = html;

        document.getElementById('pgPrev')?.addEventListener('click', () => { this.page--; this.render(); window.scrollTo(0,200); });
        document.getElementById('pgNext')?.addEventListener('click', () => { this.page++; this.render(); window.scrollTo(0,200); });
        document.querySelectorAll('[data-page]').forEach(btn => {
            btn.addEventListener('click', () => { this.page = +btn.dataset.page; this.render(); window.scrollTo(0,200); });
        });
    },

    // ─── Modal ───────────────────────────────────────────────────────────
    openModal(agent) {
        this.activeModal = agent;
        const overlay = document.getElementById('modalOverlay');
        const accent  = agent.accentColor || '#64748B';

        document.getElementById('modalEmoji').textContent    = agent.emoji || '🤖';
        document.getElementById('modalName').textContent     = agent.name;
        document.getElementById('modalSource').innerHTML     =
            `<a href="${agent.source_url || '#'}" target="_blank" rel="noopener">${agent.source_repo || ''}</a>`;
        document.getElementById('modalDesc').textContent     = agent.description || '';
        document.getElementById('modalPrompt').textContent   = agent.prompt || '(prompt yok)';

        const tagsEl = document.getElementById('modalTags');
        tagsEl.innerHTML = (agent.tags || []).slice(0, 8)
            .map(t => `<span class="modal-tag">${this.esc(t)}</span>`).join('');

        // Accent on modal header top border
        document.querySelector('.modal').style.setProperty('--card-accent', accent);

        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    closeModal() {
        document.getElementById('modalOverlay').classList.remove('open');
        document.body.style.overflow = '';
        this.activeModal = null;
    },

    copyPrompt() {
        if (!this.activeModal) return;
        navigator.clipboard.writeText(this.activeModal.prompt || '').then(() => {
            const fb = document.getElementById('copyFeedback');
            fb.classList.add('show');
            setTimeout(() => fb.classList.remove('show'), 1800);
        });
    },

    openCardView() {
        if (!this.activeModal) return;
        window.open(`agent-cards.html?agent=${encodeURIComponent(this.activeModal.id)}`, '_blank');
    },

    // ─── Loading ─────────────────────────────────────────────────────────
    showLoading(state) {
        const grid = document.getElementById('cardGrid');
        if (state) grid.innerHTML = '<div class="loading-state">⏳ Yükleniyor…</div>';
    },

    // ─── Events ──────────────────────────────────────────────────────────
    bindEvents() {
        // Search input
        const searchEl = document.getElementById('searchInput');
        let searchTimer;
        searchEl?.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                this.filters.search = searchEl.value;
                this.applyFilters();
            }, 220);
        });

        // Filter options (source, category, length)
        document.addEventListener('click', e => {
            const opt = e.target.closest('.filter-option');
            if (!opt) return;
            const type  = opt.dataset.filter;
            const value = opt.dataset.value;

            // Toggle: click active → deselect
            if (this.filters[type] === value) {
                this.filters[type] = '';
                opt.classList.remove('active');
            } else {
                // Deactivate siblings
                opt.closest('#sourceFilters, #categoryFilters, #lengthFilters')
                    ?.querySelectorAll('.filter-option').forEach(el => el.classList.remove('active'));
                this.filters[type] = value;
                opt.classList.add('active');
            }
            this.applyFilters();
        });

        // Reset
        document.getElementById('resetBtn')?.addEventListener('click', () => {
            this.filters = { search:'', source:'', category:'', length:'' };
            document.querySelectorAll('.filter-option').forEach(el => el.classList.remove('active'));
            if (searchEl) searchEl.value = '';
            this.applyFilters();
        });

        // Sort
        document.getElementById('sortSelect')?.addEventListener('change', e => {
            this.sortAgents(e.target.value);
        });

        // Modal close
        document.getElementById('modalClose')?.addEventListener('click', () => this.closeModal());
        document.getElementById('modalOverlay')?.addEventListener('click', e => {
            if (e.target === e.currentTarget) this.closeModal();
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') this.closeModal();
        });

        // Modal buttons
        document.getElementById('copyBtn')?.addEventListener('click',    () => this.copyPrompt());
        document.getElementById('cardBtn')?.addEventListener('click',    () => this.openCardView());
    },

    sortAgents(mode) {
        if (mode === 'name-az') {
            this.filtered.sort((a,b) => a.name.localeCompare(b.name));
        } else if (mode === 'prompt-long') {
            this.filtered.sort((a,b) => b.prompt.length - a.prompt.length);
        } else if (mode === 'prompt-short') {
            this.filtered.sort((a,b) => a.prompt.length - b.prompt.length);
        }
        this.page = 1;
        this.render();
    },

    // ─── Escape HTML ─────────────────────────────────────────────────────
    esc(str) {
        return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                          .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    },
};

document.addEventListener('DOMContentLoaded', () => Browse.init());
