// Agent Cards Script
// Canvas renderer — iconic figure portrait layout (image top, text bottom)
// Category-specific templates inspired by lor-card-maker (JSON→template dispatch)
// Dual image fallback system inspired by DnDGen card-script (agent image → category image → gradient)

const AC = {
    W: 612,
    H: 792,
    PAD: 32,
    IMG_H: 370,   // Portrait image takes upper 370px

    FONT_FAMILY: "'Segoe UI', 'Arial', sans-serif",
    MONO_FAMILY: "'Consolas', 'Courier New', monospace",

    COLORS: {
        white:     "#F8FAFC",
        textMuted: "#9BA8BB",
        separator: "rgba(255,255,255,0.13)",
        footer:    "rgba(255,255,255,0.25)"
    },

    // Category labels — used across templates
    CAT_LABELS: {
        design:  "Tasarım",
        dev:     "Geliştirme",
        qa:      "Kalite & Test",
        utility: "Yardımcı"
    },

    agents:        [],
    currentAgent:  null,
    canvas:        null,
    ctx:           null,
    bgImages:      {}, // agent-specific image cache (id → img|null)
    catImages:     {}, // category fallback image cache (category → img|null)
    isBatchRunning: false,

    // ─── Init ────────────────────────────────────────────────────────────
    Init: function () {
        this.canvas = document.getElementById("agentCanvas");
        this.ctx    = this.canvas.getContext("2d");

        $.getJSON("js/JSON/agents.json", (data) => {
            this.agents = data.agents;
            this.PopulateSelector();
            if (this.agents.length > 0) this.Make(this.agents[0].id);
        }).fail(() => console.error("agents.json yüklenemedi."));
    },

    // ─── Dropdown ────────────────────────────────────────────────────────
    PopulateSelector: function () {
        const sel = document.getElementById("agentSelect");
        sel.innerHTML = "";
        const cats = {};
        this.agents.forEach(a => {
            if (!cats[a.category]) cats[a.category] = [];
            cats[a.category].push(a);
        });
        const catLabels = { design:"🎨 Tasarım", dev:"⚙️ Geliştirme", qa:"🔍 Kalite & Test", utility:"🤖 Yardımcı" };
        Object.keys(catLabels).forEach(cat => {
            if (!cats[cat]) return;
            const g = document.createElement("optgroup");
            g.label = catLabels[cat];
            cats[cat].forEach(a => {
                const o = document.createElement("option");
                o.value = a.id;
                o.textContent = `${a.emoji}  ${a.name}`;
                g.appendChild(o);
            });
            sel.appendChild(g);
        });
    },

    // ─── Make ─────────────────────────────────────────────────────────────
    // Two-tier image resolution: agent-specific → category → gradient
    // Inspired by DnDGen card-script layering: backgroundImage + characterImage
    Make: function (agentId) {
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;
        this.currentAgent = agent;
        document.getElementById("agentSelect").value = agentId;

        if (this.bgImages.hasOwnProperty(agentId)) {
            this.Draw(agent, this.bgImages[agentId]);
            return;
        }
        // Tier 1: agent-specific portrait (images/agents/{id}.jpg)
        const img = new Image();
        img.onload = () => {
            this.bgImages[agentId] = img;
            this.Draw(agent, img);
        };
        img.onerror = () => {
            this.bgImages[agentId] = null;
            // Tier 2: category image (images/categories/{category}.jpg)
            this._loadCatImage(agent, (catImg) => this.Draw(agent, catImg));
        };
        img.src = `images/agents/${agentId}.jpg`;
    },

    // Load category-level fallback image (like DnD's cardsources.json category grouping)
    _loadCatImage: function (agent, cb) {
        const cat = agent.category;
        if (this.catImages.hasOwnProperty(cat)) return cb(this.catImages[cat]);
        const img = new Image();
        img.onload  = () => { this.catImages[cat] = img;  cb(img);  };
        img.onerror = () => { this.catImages[cat] = null; cb(null); };
        img.src = `images/categories/${cat}.jpg`;
    },

    // ─── Draw — dispatches to category template ───────────────────────────
    // Inspired by lor-card-maker: each card *type* has its own render component
    // (unit.js, spell.js, champion.js). Here: category → template function.
    Draw: function (agent, img) {
        const { ctx, W, H } = this;
        ctx.clearRect(0, 0, W, H);

        // Shared layers: base + portrait + fade (same for all templates)
        this.DrawCardBase(agent);
        this.DrawPortrait(agent, img);
        this.DrawFade(agent);

        // Category-specific template from here on
        switch (agent.category) {
            case "design":  this._templateDesign(agent);  break;
            case "dev":     this._templateDev(agent);     break;
            case "qa":      this._templateQA(agent);      break;
            case "utility":
            default:        this._templateUtility(agent); break;
        }

        this.DrawFooter(agent);
        this.DrawBorder(agent);
    },

    // ─── TEMPLATE: Design ─ artistic, creative, centred ──────────────────
    _templateDesign: function (agent) {
        const { ctx, W, IMG_H, PAD } = this;

        // Diagonal paint-stroke accent at portrait top-right corner
        ctx.save();
        ctx.globalAlpha = 0.13;
        ctx.beginPath();
        ctx.moveTo(W * 0.60, 0);
        ctx.lineTo(W, 0);
        ctx.lineTo(W, IMG_H * 0.38);
        ctx.lineTo(W * 0.28, 0);
        ctx.closePath();
        ctx.fillStyle = agent.accentColor;
        ctx.fill();
        ctx.restore();

        // Left accent bar
        ctx.fillStyle = this.HexToRgba(agent.accentColor, 0.70);
        ctx.fillRect(0, IMG_H * 0.12, 3, IMG_H * 0.76);

        // Name + badge (left-aligned, overlaid on portrait)
        this.DrawNameOverlay(agent);

        // Lower text section
        let y = IMG_H + 16;
        y = this.DrawDescription(agent, y);

        // Capabilities — 2-column grid cards (like lor-card-maker keyword chips)
        ctx.font = `700 8px ${this.FONT_FAMILY}`;
        ctx.fillStyle = agent.accentColor;
        ctx.textAlign = "left";
        ctx.fillText("YETENEKLER", PAD, y);
        y += 14;

        const colW = (W - PAD * 2 - 8) / 2;
        agent.capabilities.forEach((cap, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cx  = PAD + col * (colW + 8);
            const cy  = y + row * 30;

            ctx.fillStyle   = "rgba(255,255,255,0.06)";
            this.RoundRect(ctx, cx, cy - 12, colW, 24, 6); ctx.fill();
            ctx.strokeStyle = this.HexToRgba(agent.accentColor, 0.28);
            ctx.lineWidth   = 1;
            this.RoundRect(ctx, cx, cy - 12, colW, 24, 6); ctx.stroke();

            ctx.font = `11px ${this.FONT_FAMILY}`;
            ctx.fillStyle = this.COLORS.white;
            ctx.textAlign = "center";
            const truncated = this._truncate(ctx, cap, colW - 14);
            ctx.fillText(truncated, cx + colW / 2, cy + 3);
        });

        const capRows = Math.ceil(agent.capabilities.length / 2);
        y += capRows * 30 + 14;
        this.DrawTools(agent, y);
    },

    // ─── TEMPLATE: Dev ─ terminal aesthetic, code-block style ────────────
    _templateDev: function (agent) {
        const { ctx, W, IMG_H, PAD } = this;

        // Terminal header bar at very top of portrait
        const barH = 32;
        const barG = ctx.createLinearGradient(0, 0, W, 0);
        barG.addColorStop(0, this.HexToRgba(agent.accentColor, 0.88));
        barG.addColorStop(1, this.HexToRgba(agent.accentColor, 0.12));
        ctx.fillStyle = barG;
        ctx.fillRect(0, 0, W, barH);

        // macOS-style traffic dots
        [14, 26, 38].forEach((x, i) => {
            ctx.beginPath();
            ctx.arc(x, barH / 2, 5, 0, Math.PI * 2);
            ctx.fillStyle = ["#FF5F57", "#FEBC2E", "#28C840"][i];
            ctx.fill();
        });
        ctx.font      = `600 11px ${this.MONO_FAMILY}`;
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.textAlign = "left";
        ctx.fillText(`~ ${agent.id}`, 58, barH / 2 + 4);

        // Right-side vertical accent line on portrait
        ctx.fillStyle = this.HexToRgba(agent.accentColor, 0.55);
        ctx.fillRect(W - 3, barH, 3, IMG_H - barH);

        // Grid overlay on portrait
        ctx.save();
        ctx.globalAlpha = 0.035;
        ctx.strokeStyle = agent.accentColor;
        ctx.lineWidth   = 1;
        for (let x = 0; x < W; x += 28) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, IMG_H); ctx.stroke();
        }
        ctx.restore();

        // Name + badge
        this.DrawNameOverlay(agent);

        // Lower section
        let y = IMG_H + 16;
        y = this.DrawDescription(agent, y);

        // Capabilities — code-block style with monospace prefix
        ctx.font = `700 8px ${this.FONT_FAMILY}`;
        ctx.fillStyle = agent.accentColor;
        ctx.textAlign = "left";
        ctx.fillText("// YETENEKLER", PAD, y);
        y += 14;

        agent.capabilities.forEach(cap => {
            ctx.font = `11px ${this.MONO_FAMILY}`;
            ctx.fillStyle = this.HexToRgba(agent.accentColor, 0.65);
            ctx.fillText("  › ", PAD, y);
            const prefW = ctx.measureText("  › ").width;
            ctx.font = `11px ${this.FONT_FAMILY}`;
            ctx.fillStyle = this.COLORS.white;
            ctx.fillText(cap, PAD + prefW, y);
            y += 20;
        });

        y += 8;
        this.DrawTools(agent, y, true); // monospace tool chips
    },

    // ─── TEMPLATE: QA ─ shield motif, checklist style ────────────────────
    _templateQA: function (agent) {
        const { ctx, W, IMG_H, PAD } = this;

        // Diagonal warning stripe on portrait
        ctx.save();
        ctx.globalAlpha = 0.055;
        for (let i = -IMG_H; i < W + IMG_H; i += 38) {
            ctx.beginPath();
            ctx.moveTo(i, 0); ctx.lineTo(i + IMG_H, IMG_H);
            ctx.lineWidth   = 14;
            ctx.strokeStyle = agent.accentColor;
            ctx.stroke();
        }
        ctx.restore();

        // Shield outline in portrait centre
        ctx.save();
        ctx.globalAlpha = 0.07;
        const sX = W / 2, sY = IMG_H * 0.48, sW = 75, sH = 90;
        ctx.beginPath();
        ctx.moveTo(sX, sY - sH);
        ctx.lineTo(sX + sW, sY - sH * 0.45);
        ctx.lineTo(sX + sW, sY + sH * 0.25);
        ctx.quadraticCurveTo(sX + sW, sY + sH, sX, sY + sH);
        ctx.quadraticCurveTo(sX - sW, sY + sH, sX - sW, sY + sH * 0.25);
        ctx.lineTo(sX - sW, sY - sH * 0.45);
        ctx.closePath();
        ctx.fillStyle = agent.accentColor;
        ctx.fill();
        ctx.restore();

        this.DrawNameOverlay(agent);

        let y = IMG_H + 16;
        y = this.DrawDescription(agent, y);

        // Capabilities — checklist with checkbox style
        ctx.font = `700 8px ${this.FONT_FAMILY}`;
        ctx.fillStyle = agent.accentColor;
        ctx.textAlign = "left";
        ctx.fillText("KONTROL LİSTESİ", PAD, y);
        y += 14;

        agent.capabilities.forEach(cap => {
            ctx.strokeStyle = this.HexToRgba(agent.accentColor, 0.65);
            ctx.lineWidth   = 1;
            ctx.strokeRect(PAD, y - 11, 11, 11);
            ctx.font = `9px ${this.FONT_FAMILY}`;
            ctx.fillStyle = agent.accentColor;
            ctx.fillText("✓", PAD + 1.5, y - 0.5);
            ctx.font = `11px ${this.FONT_FAMILY}`;
            ctx.fillStyle = this.COLORS.white;
            ctx.fillText(cap, PAD + 18, y);
            y += 21;
        });

        // Alert bar
        y += 4;
        const alertH = 22;
        ctx.fillStyle   = this.HexToRgba(agent.accentColor, 0.10);
        ctx.fillRect(PAD, y, W - PAD * 2, alertH);
        ctx.strokeStyle = this.HexToRgba(agent.accentColor, 0.28);
        ctx.lineWidth   = 1;
        ctx.strokeRect(PAD, y, W - PAD * 2, alertH);
        ctx.font = `9px ${this.FONT_FAMILY}`;
        ctx.fillStyle = this.HexToRgba(agent.accentColor, 0.8);
        ctx.textAlign = "center";
        ctx.fillText("⚠  Kalite güvencesi aktif", W / 2, y + alertH / 2 + 3.5);
        y += alertH + 10;

        this.DrawTools(agent, y);
    },

    // ─── TEMPLATE: Utility ─ clean, minimal, corner brackets ─────────────
    _templateUtility: function (agent) {
        const { ctx, W, IMG_H, PAD } = this;

        // Corner bracket geometry on portrait
        ctx.save();
        ctx.globalAlpha = 0.09;
        ctx.strokeStyle = agent.accentColor;
        ctx.lineWidth   = 1.5;
        ctx.beginPath(); ctx.moveTo(0, 55); ctx.lineTo(0, 0); ctx.lineTo(55, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W, IMG_H - 55); ctx.lineTo(W, IMG_H); ctx.lineTo(W - 55, IMG_H); ctx.stroke();
        ctx.restore();

        this.DrawNameOverlay(agent);

        let y = IMG_H + 16;
        y = this.DrawDescription(agent, y);

        // Capabilities — numbered circles
        ctx.font = `700 8px ${this.FONT_FAMILY}`;
        ctx.fillStyle = agent.accentColor;
        ctx.textAlign = "left";
        ctx.fillText("YETENEKLER", PAD, y);
        y += 14;

        agent.capabilities.forEach((cap, i) => {
            ctx.beginPath();
            ctx.arc(PAD + 7, y - 4, 7, 0, Math.PI * 2);
            ctx.fillStyle   = this.HexToRgba(agent.accentColor, 0.20); ctx.fill();
            ctx.strokeStyle = this.HexToRgba(agent.accentColor, 0.45);
            ctx.lineWidth   = 1; ctx.stroke();

            ctx.font = `600 8px ${this.FONT_FAMILY}`;
            ctx.fillStyle = agent.accentColor;
            ctx.textAlign = "center";
            ctx.fillText(String(i + 1), PAD + 7, y - 0.5);

            ctx.font = `11px ${this.FONT_FAMILY}`;
            ctx.fillStyle = this.COLORS.white;
            ctx.textAlign = "left";
            ctx.fillText(cap, PAD + 20, y);
            y += 21;
        });

        y += 8;
        this.DrawTools(agent, y);
    },

    // ─── Dark base for entire card ────────────────────────────────────────
    DrawCardBase: function (agent) {
        const { ctx, W, H } = this;
        const g = ctx.createLinearGradient(0, this.IMG_H, 0, H);
        g.addColorStop(0,   "#0d0d18");
        g.addColorStop(1,   "#080810");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    },

    // ─── Portrait image — cover crop, upper IMG_H px ──────────────────────
    DrawPortrait: function (agent, img) {
        const { ctx, W, IMG_H } = this;

        if (img) {
            // Cover-fit: centre-crop to fill 612 × IMG_H
            const iW = img.naturalWidth, iH = img.naturalHeight;
            const scale  = Math.max(W / iW, IMG_H / iH);
            const dW     = iW * scale, dH = iH * scale;
            const offX   = (W  - dW) / 2;
            const offY   = (IMG_H - dH) / 2;
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, W, IMG_H);
            ctx.clip();
            ctx.drawImage(img, offX, offY, dW, dH);
            ctx.restore();

            // Very subtle vignette around the portrait edges (not too dark)
            this.DrawPortraitVignette(agent);
        } else {
            // Gradient fallback portrait panel
            const g = ctx.createLinearGradient(0, 0, 0, IMG_H);
            g.addColorStop(0, this.HexToRgba(agent.accentColor, 0.5));
            g.addColorStop(1, this.HexToRgba(agent.accentColor, 0.15));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, IMG_H);

            // Big emoji centred as fallback figure
            ctx.font = `96px ${this.FONT_FAMILY}`;
            ctx.textAlign = "center";
            ctx.shadowColor = this.HexToRgba(agent.accentColor, 0.9);
            ctx.shadowBlur  = 40;
            ctx.fillStyle   = this.COLORS.white;
            ctx.fillText(agent.emoji, W / 2, IMG_H / 2 + 36);
            ctx.shadowBlur = 0;
        }
    },

    // ─── Light vignette on portrait ──────────────────────────────────────
    DrawPortraitVignette: function (agent) {
        const { ctx, W, IMG_H } = this;

        // Left & right darkening
        const lG = ctx.createLinearGradient(0, 0, 60, 0);
        lG.addColorStop(0, "rgba(0,0,0,0.45)");
        lG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = lG; ctx.fillRect(0, 0, 60, IMG_H);

        const rG = ctx.createLinearGradient(W, 0, W - 60, 0);
        rG.addColorStop(0, "rgba(0,0,0,0.45)");
        rG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rG; ctx.fillRect(W - 60, 0, 60, IMG_H);

        // Top darkening
        const tG = ctx.createLinearGradient(0, 0, 0, 50);
        tG.addColorStop(0, "rgba(0,0,0,0.5)");
        tG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = tG; ctx.fillRect(0, 0, W, 50);
    },

    // ─── Gradient fade — image dissolves into dark section ───────────────
    DrawFade: function (agent) {
        const { ctx, W, IMG_H } = this;
        const fadeH = 110;
        const g = ctx.createLinearGradient(0, IMG_H - fadeH, 0, IMG_H + 20);
        g.addColorStop(0,   "rgba(0,0,0,0)");
        g.addColorStop(0.6, "rgba(8,8,16,0.85)");
        g.addColorStop(1,   "rgba(8,8,16,1)");
        ctx.fillStyle = g;
        ctx.fillRect(0, IMG_H - fadeH, W, fadeH + 20);

        // Accent colour tint bleed upward from text section
        const tint = ctx.createLinearGradient(0, IMG_H - 60, 0, IMG_H + 30);
        tint.addColorStop(0, "rgba(0,0,0,0)");
        tint.addColorStop(1, this.HexToRgba(agent.accentColor, 0.18));
        ctx.fillStyle = tint;
        ctx.fillRect(0, IMG_H - 60, W, 90);
    },

    // ─── Name + badge overlaid at bottom of portrait ─────────────────────
    DrawNameOverlay: function (agent) {
        const { ctx, W, IMG_H, PAD } = this;
        const nameY  = IMG_H - 38;
        const badgeY = IMG_H - 68;

        // Badge first (above name)
        const catLabels = { design:"Tasarım", dev:"Geliştirme", qa:"Kalite & Test", utility:"Yardımcı" };
        this.DrawBadge(catLabels[agent.category] || agent.category, PAD, badgeY, agent.accentColor, false);

        // Agent name
        let fs = 28;
        ctx.font = `700 ${fs}px ${this.FONT_FAMILY}`;
        while (ctx.measureText(agent.name).width > W - PAD * 2 && fs > 16) {
            fs--;
            ctx.font = `700 ${fs}px ${this.FONT_FAMILY}`;
        }
        ctx.textAlign   = "left";
        ctx.fillStyle   = this.COLORS.white;
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur  = 14;
        ctx.fillText(agent.name, PAD, nameY);
        ctx.shadowBlur  = 0;
    },

    // ─── Badge pill ──────────────────────────────────────────────────────
    DrawBadge: function (text, x, topY, accentColor, centred = true) {
        const { ctx, W } = this;
        const fs = 10;
        ctx.font = `600 ${fs}px ${this.FONT_FAMILY}`;
        const tw  = ctx.measureText(text).width;
        const pH = 8, pV = 4;
        const bW  = tw + pH * 2, bH = fs + pV * 2;
        const bX  = centred ? W / 2 - bW / 2 : x;

        ctx.fillStyle = this.HexToRgba(accentColor, 0.30);
        this.RoundRect(ctx, bX, topY, bW, bH, bH / 2); ctx.fill();

        ctx.strokeStyle = this.HexToRgba(accentColor, 0.70);
        ctx.lineWidth   = 1;
        this.RoundRect(ctx, bX, topY, bW, bH, bH / 2); ctx.stroke();

        ctx.fillStyle  = accentColor;
        ctx.textAlign  = "left";
        ctx.fillText(text, bX + pH, topY + bH / 2 + fs / 2 - 1);

        return topY + bH;
    },

    // ─── Description ─────────────────────────────────────────────────────
    DrawDescription: function (agent, yPos) {
        const { ctx, W, PAD } = this;
        const maxW = W - PAD * 2;
        ctx.font      = `13px ${this.FONT_FAMILY}`;
        ctx.fillStyle = this.COLORS.textMuted;
        ctx.textAlign = "left";
        const lines = this.WrapText(ctx, agent.description, maxW);
        lines.forEach(l => { ctx.fillText(l, PAD, yPos); yPos += 19; });
        return yPos + 14;
    },

    // ─── Capabilities ────────────────────────────────────────────────────
    DrawCapabilities: function (agent, yPos) {
        const { ctx, PAD } = this;

        ctx.font      = `700 8px ${this.FONT_FAMILY}`;
        ctx.fillStyle = agent.accentColor;
        ctx.textAlign = "left";
        ctx.fillText("YETENEKLER", PAD, yPos);
        yPos += 15;

        ctx.font = `12px ${this.FONT_FAMILY}`;
        agent.capabilities.forEach(cap => {
            ctx.fillStyle = agent.accentColor;
            ctx.beginPath(); ctx.arc(PAD + 4, yPos - 3.5, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = this.COLORS.white;
            ctx.fillText(cap, PAD + 14, yPos);
            yPos += 20;
        });
        return yPos + 8;
    },

    // ─── Tools ───────────────────────────────────────────────────────────
    // mono param: true → Consolas font (Dev template)
    DrawTools: function (agent, yPos, mono) {
        const { ctx, W, PAD } = this;

        ctx.font      = `700 8px ${this.FONT_FAMILY}`;
        ctx.fillStyle = agent.accentColor;
        ctx.textAlign = "left";
        ctx.fillText(mono ? "// ARAÇLAR" : "ARAÇLAR", PAD, yPos);
        yPos += 15;

        const cfs  = 10, cPH = 9, cPV = 3;
        const font = mono ? `${cfs}px ${this.MONO_FAMILY}` : `${cfs}px ${this.FONT_FAMILY}`;
        ctx.font    = font;
        const cH    = cfs + cPV * 2;
        let x       = PAD;

        agent.tools.forEach(tool => {
            const tw   = ctx.measureText(tool).width;
            const cW   = tw + cPH * 2;
            if (x + cW > W - PAD) { x = PAD; yPos += cH + 6; }

            ctx.fillStyle   = "rgba(255,255,255,0.08)";
            this.RoundRect(ctx, x, yPos - cfs, cW, cH, cH / 2); ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.11)";
            ctx.lineWidth   = 1;
            this.RoundRect(ctx, x, yPos - cfs, cW, cH, cH / 2); ctx.stroke();

            ctx.fillStyle = this.COLORS.textMuted;
            ctx.textAlign = "left";
            ctx.fillText(tool, x + cPH, yPos);
            x += cW + 5;
        });

        return yPos;
    },

    // ─── Footer ──────────────────────────────────────────────────────────
    DrawFooter: function (agent) {
        const { ctx, W, H, PAD } = this;
        ctx.strokeStyle = this.COLORS.separator;
        ctx.lineWidth   = 1;
        ctx.beginPath(); ctx.moveTo(PAD, H - 38); ctx.lineTo(W - PAD, H - 38); ctx.stroke();

        ctx.font      = `8px ${this.FONT_FAMILY}`;
        ctx.fillStyle = this.COLORS.footer;
        ctx.textAlign = "left";  ctx.fillText(`@${agent.id}`, PAD,   H - 20);
        ctx.textAlign = "right"; ctx.fillText("Claude Code Agent",   W - PAD, H - 20);
    },

    // ─── Border ───────────────────────────────────────────────────────────
    DrawBorder: function (agent) {
        const { ctx, W, H } = this;
        ctx.strokeStyle = this.HexToRgba(agent.accentColor, 0.45);
        ctx.lineWidth   = 1.5;
        ctx.strokeRect(0.75, 0.75, W - 1.5, H - 1.5);
    },

    // ─── Download (single card) ───────────────────────────────────────────
    Download: function () {
        if (!this.currentAgent) return;
        const a = document.createElement("a");
        a.download = `${this.currentAgent.id}-card.png`;
        a.href     = this.canvas.toDataURL("image/png");
        a.click();
    },

    // ─── Batch Export — render every agent card and download sequentially ─
    // Inspired by lor-card-maker's batch-renderer component
    BatchExport: function () {
        if (this.isBatchRunning) return;
        this.isBatchRunning = true;

        const btn = document.getElementById("batchBtn");
        if (btn) btn.disabled = true;

        const total = this.agents.length;
        let index   = 0;

        const step = () => {
            if (index >= total) {
                this.isBatchRunning = false;
                if (btn) { btn.disabled = false; btn.textContent = "⬇ Tümünü İndir"; }
                // Restore currently selected card
                if (this.currentAgent) this.Make(this.currentAgent.id);
                return;
            }

            const agent = this.agents[index];
            if (btn) btn.textContent = `⟳ ${index + 1} / ${total} hazırlanıyor…`;

            // Use cached image if already loaded; otherwise gradient fallback
            const bgImg = this.bgImages.hasOwnProperty(agent.id)
                ? this.bgImages[agent.id]
                : (this.catImages[agent.category] !== undefined ? this.catImages[agent.category] : null);

            this.Draw(agent, bgImg);

            setTimeout(() => {
                const a    = document.createElement("a");
                a.download = `${agent.id}-card.png`;
                a.href     = this.canvas.toDataURL("image/png");
                a.click();
                index++;
                setTimeout(step, 350); // small gap to avoid browser throttle
            }, 100);
        };

        step();
    },

    // ─── Helpers ──────────────────────────────────────────────────────────

    // Truncate text to fit maxW, appending ellipsis
    _truncate: function (ctx, text, maxW) {
        if (ctx.measureText(text).width <= maxW) return text;
        let t = text;
        while (ctx.measureText(t + "…").width > maxW && t.length > 0) t = t.slice(0, -1);
        return t + "…";
    },

    WrapText: function (ctx, text, maxW) {
        const words = text.split(" "); const lines = []; let cur = "";
        words.forEach(w => {
            const t = cur ? cur + " " + w : w;
            if (ctx.measureText(t).width > maxW) { if (cur) lines.push(cur); cur = w; }
            else cur = t;
        });
        if (cur) lines.push(cur);
        return lines;
    },

    RoundRect: function (ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
        ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h,    x, y + h - r);
        ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y,            x + r, y);
        ctx.closePath();
    },

    HexToRgba: function (hex, alpha) {
        const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!r) return `rgba(100,100,100,${alpha})`;
        return `rgba(${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)},${alpha})`;
    }
};

$(document).ready(function () {
    AC.Init();
    $("#agentSelect").on("change", function () { AC.Make($(this).val()); });
    $("#downloadBtn").on("click",  function () { AC.Download(); });
    $("#batchBtn").on("click",     function () { AC.BatchExport(); });
});
