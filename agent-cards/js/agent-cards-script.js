// Agent Cards Script
// Canvas renderer — portrait layout (image top, text bottom)
// Category templates: design / dev / qa / utility
// Partial system: art-blur-polygon, keyword-chips, mana-gem, bottom-stats, visual-elements

const AC = {
    W:      612,
    H:      792,
    PAD:    32,
    IMG_H:  370,   // Portrait takes upper 370px

    FONT_FAMILY: "'Segoe UI', 'Arial', sans-serif",
    MONO_FAMILY: "'Consolas', 'Courier New', monospace",

    COLORS: {
        white:     "#F8FAFC",
        textMuted: "#9BA8BB",
        separator: "rgba(255,255,255,0.13)",
        footer:    "rgba(255,255,255,0.25)"
    },

    CAT_LABELS: {
        design:  "Tasarım",
        dev:     "Geliştirme",
        qa:      "Kalite & Test",
        utility: "Yardımcı"
    },

    agents:         [],
    currentAgent:   null,
    canvas:         null,
    ctx:            null,
    bgImages:       {},
    catImages:      {},
    isBatchRunning: false,

    // ─── Init ────────────────────────────────────────────────────────────
    Init: function () {
        this.canvas = document.getElementById("agentCanvas");
        this.ctx    = this.canvas.getContext("2d");

        // URL'den ?agent=ID parametresini oku (browse.html'den geldiyse)
        const params  = new URLSearchParams(window.location.search);
        const reqId   = params.get("agent");

        $.getJSON("js/JSON/agents.json", (data) => {
            this.agents = data.agents;
            this.PopulateSelector();

            // 1) Curated 15 agent içinde mi?
            if (reqId && this.agents.find(a => a.id === reqId)) {
                this.Make(reqId);
                $("#agentCountChip").text(this.agents.length + " agent");
                return;
            }

            // 2) Yok ise scraped pool'a bak
            if (reqId) {
                this.LoadScrapedAgent(reqId);
                return;
            }

            // 3) Param yok — ilkini render et
            if (this.agents.length > 0) this.Make(this.agents[0].id);
            $("#agentCountChip").text(this.agents.length + " agent");
        }).fail(() => console.error("agents.json yüklenemedi."));
    },

    // ─── Scraped pool'dan tek agent yükle ────────────────────────────────
    LoadScrapedAgent: function (id) {
        $.getJSON("js/JSON/normalized-agents.json", (data) => {
            const pool = Array.isArray(data) ? data : (data.agents || data);
            const agent = pool.find(a => a.id === id);
            if (!agent) {
                console.error(`Scraped agent '${id}' not found in normalized pool`);
                if (this.agents.length > 0) this.Make(this.agents[0].id);
                return;
            }
            // Scraped agent'ı curated listeye geçici olarak ekle ki dropdown'da görünsün
            this.agents.unshift(agent);
            this.PopulateSelector();
            this.Make(agent.id);
            $("#agentCountChip").text(`${this.agents.length} agent (1 prompt browser'dan)`);
        }).fail(() => {
            console.error("normalized-agents.json yüklenemedi");
            if (this.agents.length > 0) this.Make(this.agents[0].id);
        });
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
        const catLabels = {
            design:  "🎨 Tasarım",
            dev:     "⚙️ Geliştirme",
            qa:      "🔍 Kalite & Test",
            utility: "🤖 Yardımcı"
        };
        Object.keys(catLabels).forEach(cat => {
            if (!cats[cat]) return;
            const g = document.createElement("optgroup");
            g.label = catLabels[cat];
            cats[cat].forEach(a => {
                const o = document.createElement("option");
                o.value       = a.id;
                o.textContent = `${a.emoji}  ${a.name}`;
                g.appendChild(o);
            });
            sel.appendChild(g);
        });
    },

    // ─── Make — 2-tier image resolution ──────────────────────────────────
    Make: function (agentId) {
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;
        this.currentAgent = agent;
        document.getElementById("agentSelect").value = agentId;

        if (this.bgImages.hasOwnProperty(agentId)) {
            this.Draw(agent, this.bgImages[agentId]);
            return;
        }
        const img = new Image();
        img.onload = () => {
            this.bgImages[agentId] = img;
            this.Draw(agent, img);
        };
        img.onerror = () => {
            this.bgImages[agentId] = null;
            this._loadCatImage(agent, catImg => this.Draw(agent, catImg));
        };
        img.src = `images/agents/${agentId}.jpg`;
    },

    _loadCatImage: function (agent, cb) {
        const cat = agent.category;
        if (this.catImages.hasOwnProperty(cat)) return cb(this.catImages[cat]);
        const img = new Image();
        img.onload  = () => { this.catImages[cat] = img;  cb(img);  };
        img.onerror = () => { this.catImages[cat] = null; cb(null); };
        img.src = `images/categories/${cat}.jpg`;
    },

    // ─── Draw — dispatches to category template ───────────────────────────
    Draw: function (agent, img) {
        const { ctx, W, H } = this;
        ctx.clearRect(0, 0, W, H);

        // 1. Shared base
        this.DrawCardBase(agent);
        this.DrawPortrait(agent, img);
        this.DrawFade(agent);

        // 2. Portrait overlays (from partials)
        if (typeof this.DrawManaGem    === "function") this.DrawManaGem(agent);
        if (typeof this.DrawRegionStack === "function") this.DrawRegionStack(agent);

        // 3. Category template
        switch (agent.category) {
            case "design":  this._templateDesign(agent);  break;
            case "dev":     this._templateDev(agent);     break;
            case "qa":      this._templateQA(agent);      break;
            default:        this._templateUtility(agent); break;
        }

        // 4. Bottom elements (drawn last → overlay footer)
        this.DrawFooter(agent);
        if (typeof this.DrawBottomStats === "function") this.DrawBottomStats(agent);
        if (typeof this.DrawRarityGem   === "function") this.DrawRarityGem(agent);
        this.DrawBorder(agent);
    },

    // ─── DrawCardBase ─────────────────────────────────────────────────────
    DrawCardBase: function (agent) {
        const { ctx, W, H } = this;
        const g = ctx.createLinearGradient(0, this.IMG_H, 0, H);
        g.addColorStop(0, "#0d0d18");
        g.addColorStop(1, "#080810");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    },

    // ─── DrawPortrait (overridden by PARTIAL_ArtBlurPolygon) ─────────────
    DrawPortrait: function (agent, img) {
        const { ctx, W, IMG_H } = this;
        if (img) {
            const iW = img.naturalWidth, iH = img.naturalHeight;
            const scale = Math.max(W / iW, IMG_H / iH);
            const dW = iW * scale, dH = iH * scale;
            const offX = (W - dW) / 2, offY = (IMG_H - dH) / 2;
            ctx.save();
            ctx.beginPath(); ctx.rect(0, 0, W, IMG_H); ctx.clip();
            ctx.drawImage(img, offX, offY, dW, dH);
            ctx.restore();
            this.DrawPortraitVignette(agent);
        } else {
            const g = ctx.createLinearGradient(0, 0, 0, IMG_H);
            g.addColorStop(0, this.HexToRgba(agent.accentColor, 0.5));
            g.addColorStop(1, this.HexToRgba(agent.accentColor, 0.15));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, IMG_H);
            ctx.font        = `96px ${this.FONT_FAMILY}`;
            ctx.textAlign   = "center";
            ctx.shadowColor = this.HexToRgba(agent.accentColor, 0.9);
            ctx.shadowBlur  = 40;
            ctx.fillStyle   = this.COLORS.white;
            ctx.fillText(agent.emoji, W / 2, IMG_H / 2 + 36);
            ctx.shadowBlur  = 0;
        }
    },

    DrawPortraitVignette: function (agent) {
        const { ctx, W, IMG_H } = this;
        const lG = ctx.createLinearGradient(0, 0, 80, 0);
        lG.addColorStop(0, "rgba(0,0,0,0.30)"); lG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = lG; ctx.fillRect(0, 0, 80, IMG_H);
        const rG = ctx.createLinearGradient(W, 0, W - 80, 0);
        rG.addColorStop(0, "rgba(0,0,0,0.30)"); rG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rG; ctx.fillRect(W - 80, 0, 80, IMG_H);
        const tG = ctx.createLinearGradient(0, 0, 0, 70);
        tG.addColorStop(0, "rgba(0,0,0,0.35)"); tG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = tG; ctx.fillRect(0, 0, W, 70);
    },

    // ─── DrawFade ─────────────────────────────────────────────────────────
    DrawFade: function (agent) {
        const { ctx, W, IMG_H } = this;
        const fadeH = 110;
        const g = ctx.createLinearGradient(0, IMG_H - fadeH, 0, IMG_H + 20);
        g.addColorStop(0,   "rgba(0,0,0,0)");
        g.addColorStop(0.6, "rgba(8,8,16,0.85)");
        g.addColorStop(1,   "rgba(8,8,16,1)");
        ctx.fillStyle = g;
        ctx.fillRect(0, IMG_H - fadeH, W, fadeH + 20);
        const tint = ctx.createLinearGradient(0, IMG_H - 60, 0, IMG_H + 30);
        tint.addColorStop(0, "rgba(0,0,0,0)");
        tint.addColorStop(1, this.HexToRgba(agent.accentColor, 0.18));
        ctx.fillStyle = tint;
        ctx.fillRect(0, IMG_H - 60, W, 90);
    },

    // ─── DrawNameOverlay (overridden by PARTIAL_VisualElements) ──────────
    DrawNameOverlay: function (agent) {
        const { ctx, W, IMG_H, PAD } = this;
        const nameY  = IMG_H - 38;
        const badgeY = IMG_H - 68;
        this.DrawBadge(this.CAT_LABELS[agent.category] || agent.category, PAD, badgeY, agent.accentColor, false);
        let fs = 28;
        ctx.font = `700 ${fs}px ${this.FONT_FAMILY}`;
        while (ctx.measureText(agent.name).width > W - PAD * 2 && fs > 16) {
            fs--; ctx.font = `700 ${fs}px ${this.FONT_FAMILY}`;
        }
        ctx.textAlign   = "left";
        ctx.fillStyle   = this.COLORS.white;
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur  = 14;
        ctx.fillText(agent.name, PAD, nameY);
        ctx.shadowBlur  = 0;
    },

    // ─── DrawBadge ────────────────────────────────────────────────────────
    DrawBadge: function (text, x, topY, accentColor, centred) {
        const { ctx, W } = this;
        const fs = 10;
        ctx.font = `600 ${fs}px ${this.FONT_FAMILY}`;
        const tw = ctx.measureText(text).width;
        const pH = 8, pV = 4;
        const bW = tw + pH * 2, bH = fs + pV * 2;
        const bX = centred ? W / 2 - bW / 2 : x;
        ctx.fillStyle = this.HexToRgba(accentColor, 0.30);
        this.RoundRect(ctx, bX, topY, bW, bH, bH / 2); ctx.fill();
        ctx.strokeStyle = this.HexToRgba(accentColor, 0.70);
        ctx.lineWidth   = 1;
        this.RoundRect(ctx, bX, topY, bW, bH, bH / 2); ctx.stroke();
        ctx.fillStyle = accentColor;
        ctx.textAlign = "left";
        ctx.fillText(text, bX + pH, topY + bH / 2 + fs / 2 - 1);
        return topY + bH;
    },

    // ─── Content measurement (DnDGen bottom-justify pattern) ─────────────
    _measureContent: function (agent, ctx, maxW) {
        const LINE_H = 24, LABEL_H = 23, CHIP_H = 28, CHIP_GAP = 6;
        ctx.font = `13px ${this.FONT_FAMILY}`;
        const descLines = this.WrapText(ctx, agent.description, maxW);
        const descH = descLines.length * LINE_H + 8;
        const chipW_avg = 72;
        const chipsPerRow = Math.max(1, Math.floor(maxW / (chipW_avg + CHIP_GAP)));
        const toolCount = (agent.tools.length === 1 && agent.tools[0] === "*") ? 1 : agent.tools.length;
        const toolRows  = Math.ceil(toolCount / chipsPerRow);
        const toolsH    = LABEL_H + toolRows * (CHIP_H + CHIP_GAP);
        const capGridH  = LABEL_H + Math.ceil(agent.capabilities.length / 2) * 44;
        const capListH  = LABEL_H + agent.capabilities.length * 25;
        return { descH, toolsH, capGridH, capListH, LABEL_H };
    },

    _sectionGap: function (agent, ctx, contentH) {
        const available = (this.H - 80) - (this.IMG_H + 16);
        const extra = Math.max(0, available - contentH);
        return Math.min(40, Math.max(8, extra / 3));
    },

    // ─── TEMPLATE: Design ─────────────────────────────────────────────────
    _templateDesign: function (agent) {
        const { ctx, W, IMG_H, PAD } = this;

        ctx.save();
        ctx.globalAlpha = 0.13;
        ctx.beginPath();
        ctx.moveTo(W * 0.60, 0); ctx.lineTo(W, 0);
        ctx.lineTo(W, IMG_H * 0.38); ctx.lineTo(W * 0.28, 0);
        ctx.closePath();
        ctx.fillStyle = agent.accentColor; ctx.fill();
        ctx.restore();

        ctx.fillStyle = this.HexToRgba(agent.accentColor, 0.70);
        ctx.fillRect(0, IMG_H * 0.12, 3, IMG_H * 0.76);

        this.DrawNameOverlay(agent);

        const maxW = W - PAD * 2;
        const m    = this._measureContent(agent, ctx, maxW);
        const gap  = this._sectionGap(agent, ctx, m.descH + m.capGridH + m.toolsH);

        let y = IMG_H + 16 + gap * 0.25;
        y = this.DrawDescription(agent, y);
        y += gap;

        ctx.font = `700 9px ${this.FONT_FAMILY}`;
        ctx.fillStyle = agent.accentColor; ctx.textAlign = "left";
        ctx.fillText("YETENEKLER", PAD, y);
        y += 14;

        const CELL_H = 44, colW = (W - PAD * 2 - 8) / 2;
        agent.capabilities.forEach((cap, i) => {
            const col = i % 2, row = Math.floor(i / 2);
            const cx = PAD + col * (colW + 8), cy = y + row * CELL_H;
            ctx.fillStyle   = "rgba(255,255,255,0.06)";
            this.RoundRect(ctx, cx, cy - CELL_H * 0.5, colW, CELL_H - 4, 7); ctx.fill();
            ctx.strokeStyle = this.HexToRgba(agent.accentColor, 0.28);
            ctx.lineWidth   = 1;
            this.RoundRect(ctx, cx, cy - CELL_H * 0.5, colW, CELL_H - 4, 7); ctx.stroke();
            ctx.font = `12px ${this.FONT_FAMILY}`; ctx.fillStyle = this.COLORS.white; ctx.textAlign = "center";
            ctx.fillText(this._truncate(ctx, cap, colW - 16), cx + colW / 2, cy + 4);
        });

        const capRows = Math.ceil(agent.capabilities.length / 2);
        y += capRows * CELL_H + gap;
        this.DrawTools(agent, y);
    },

    // ─── TEMPLATE: Dev ────────────────────────────────────────────────────
    _templateDev: function (agent) {
        const { ctx, W, IMG_H, PAD } = this;
        const barH = 32;
        const barG = ctx.createLinearGradient(0, 0, W, 0);
        barG.addColorStop(0, this.HexToRgba(agent.accentColor, 0.88));
        barG.addColorStop(1, this.HexToRgba(agent.accentColor, 0.12));
        ctx.fillStyle = barG; ctx.fillRect(0, 0, W, barH);

        [14, 26, 38].forEach((x, i) => {
            ctx.beginPath(); ctx.arc(x, barH / 2, 5, 0, Math.PI * 2);
            ctx.fillStyle = ["#FF5F57","#FEBC2E","#28C840"][i]; ctx.fill();
        });
        ctx.font = `600 11px ${this.MONO_FAMILY}`;
        ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.textAlign = "left";
        ctx.fillText(`~ ${agent.id}`, 58, barH / 2 + 4);

        ctx.fillStyle = this.HexToRgba(agent.accentColor, 0.55);
        ctx.fillRect(W - 3, barH, 3, IMG_H - barH);

        ctx.save(); ctx.globalAlpha = 0.035; ctx.strokeStyle = agent.accentColor; ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 28) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, IMG_H); ctx.stroke();
        }
        ctx.restore();

        this.DrawNameOverlay(agent);

        const maxW = W - PAD * 2;
        const m    = this._measureContent(agent, ctx, maxW);
        const gap  = this._sectionGap(agent, ctx, m.descH + m.capListH + m.toolsH);

        let y = IMG_H + 16 + gap * 0.25;
        y = this.DrawDescription(agent, y);
        y += gap;

        ctx.font = `700 9px ${this.FONT_FAMILY}`;
        ctx.fillStyle = agent.accentColor; ctx.textAlign = "left";
        ctx.fillText("// YETENEKLER", PAD, y);
        y += 14;

        agent.capabilities.forEach(cap => {
            ctx.font = `12px ${this.MONO_FAMILY}`;
            ctx.fillStyle = this.HexToRgba(agent.accentColor, 0.65);
            ctx.fillText("  › ", PAD, y);
            const prefW = ctx.measureText("  › ").width;
            ctx.font = `12px ${this.FONT_FAMILY}`; ctx.fillStyle = this.COLORS.white;
            ctx.fillText(cap, PAD + prefW, y);
            y += 25;
        });
        y += gap;
        this.DrawTools(agent, y, true);
    },

    // ─── TEMPLATE: QA ─────────────────────────────────────────────────────
    _templateQA: function (agent) {
        const { ctx, W, IMG_H, PAD } = this;

        ctx.save(); ctx.globalAlpha = 0.055;
        for (let i = -IMG_H; i < W + IMG_H; i += 38) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + IMG_H, IMG_H);
            ctx.lineWidth = 14; ctx.strokeStyle = agent.accentColor; ctx.stroke();
        }
        ctx.restore();

        ctx.save(); ctx.globalAlpha = 0.07;
        const sX = W/2, sY = IMG_H*0.48, sW = 75, sH = 90;
        ctx.beginPath();
        ctx.moveTo(sX, sY-sH); ctx.lineTo(sX+sW, sY-sH*0.45); ctx.lineTo(sX+sW, sY+sH*0.25);
        ctx.quadraticCurveTo(sX+sW, sY+sH, sX, sY+sH);
        ctx.quadraticCurveTo(sX-sW, sY+sH, sX-sW, sY+sH*0.25);
        ctx.lineTo(sX-sW, sY-sH*0.45); ctx.closePath();
        ctx.fillStyle = agent.accentColor; ctx.fill();
        ctx.restore();

        this.DrawNameOverlay(agent);

        const maxW = W - PAD * 2;
        const alertH = 28;
        const m    = this._measureContent(agent, ctx, maxW);
        const totalH = m.descH + m.capListH + alertH + 14 + m.toolsH;
        const gap  = this._sectionGap(agent, ctx, totalH);

        let y = IMG_H + 16 + gap * 0.25;
        y = this.DrawDescription(agent, y);
        y += gap;

        ctx.font = `700 9px ${this.FONT_FAMILY}`;
        ctx.fillStyle = agent.accentColor; ctx.textAlign = "left";
        ctx.fillText("KONTROL LİSTESİ", PAD, y);
        y += 14;

        agent.capabilities.forEach(cap => {
            ctx.strokeStyle = this.HexToRgba(agent.accentColor, 0.65);
            ctx.lineWidth = 1; ctx.strokeRect(PAD, y - 12, 12, 12);
            ctx.font = `9px ${this.FONT_FAMILY}`; ctx.fillStyle = agent.accentColor;
            ctx.fillText("✓", PAD + 1.5, y - 0.5);
            ctx.font = `12px ${this.FONT_FAMILY}`; ctx.fillStyle = this.COLORS.white;
            ctx.fillText(cap, PAD + 20, y);
            y += 25;
        });

        y += gap * 0.5;
        ctx.fillStyle   = this.HexToRgba(agent.accentColor, 0.10);
        ctx.fillRect(PAD, y, W - PAD * 2, alertH);
        ctx.strokeStyle = this.HexToRgba(agent.accentColor, 0.28); ctx.lineWidth = 1;
        ctx.strokeRect(PAD, y, W - PAD * 2, alertH);
        ctx.font = `10px ${this.FONT_FAMILY}`;
        ctx.fillStyle = this.HexToRgba(agent.accentColor, 0.8); ctx.textAlign = "center";
        ctx.fillText("⚠  Kalite güvencesi aktif", W / 2, y + alertH / 2 + 3.5);
        y += alertH + gap * 0.5;
        this.DrawTools(agent, y);
    },

    // ─── TEMPLATE: Utility ───────────────────────────────────────────────
    _templateUtility: function (agent) {
        const { ctx, W, IMG_H, PAD } = this;

        ctx.save(); ctx.globalAlpha = 0.09; ctx.strokeStyle = agent.accentColor; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, 55); ctx.lineTo(0, 0); ctx.lineTo(55, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W, IMG_H-55); ctx.lineTo(W, IMG_H); ctx.lineTo(W-55, IMG_H); ctx.stroke();
        ctx.restore();

        this.DrawNameOverlay(agent);

        const maxW = W - PAD * 2;
        const m    = this._measureContent(agent, ctx, maxW);
        const gap  = this._sectionGap(agent, ctx, m.descH + m.capListH + m.toolsH);

        let y = IMG_H + 16 + gap * 0.25;
        y = this.DrawDescription(agent, y);
        y += gap;

        ctx.font = `700 9px ${this.FONT_FAMILY}`;
        ctx.fillStyle = agent.accentColor; ctx.textAlign = "left";
        ctx.fillText("YETENEKLER", PAD, y);
        y += 14;

        agent.capabilities.forEach((cap, i) => {
            ctx.beginPath(); ctx.arc(PAD+8, y-5, 8, 0, Math.PI*2);
            ctx.fillStyle = this.HexToRgba(agent.accentColor, 0.20); ctx.fill();
            ctx.strokeStyle = this.HexToRgba(agent.accentColor, 0.45); ctx.lineWidth = 1; ctx.stroke();
            ctx.font = `600 9px ${this.FONT_FAMILY}`; ctx.fillStyle = agent.accentColor; ctx.textAlign = "center";
            ctx.fillText(String(i+1), PAD+8, y-0.5);
            ctx.font = `12px ${this.FONT_FAMILY}`; ctx.fillStyle = this.COLORS.white; ctx.textAlign = "left";
            ctx.fillText(cap, PAD+22, y);
            y += 25;
        });
        y += gap;
        this.DrawTools(agent, y);
    },

    // ─── DrawDescription ─────────────────────────────────────────────────
    DrawDescription: function (agent, yPos) {
        const { ctx, W, PAD } = this;
        const maxW = W - PAD * 2;
        ctx.font      = `13px ${this.FONT_FAMILY}`;
        ctx.fillStyle = this.COLORS.textMuted;
        ctx.textAlign = "left";
        const lines = this.WrapText(ctx, agent.description, maxW);
        lines.forEach(l => { ctx.fillText(l, PAD, yPos); yPos += 24; });
        return yPos + 8;
    },

    // ─── DrawTools (overridden by PARTIAL_KeywordChips) ───────────────────
    DrawTools: function (agent, yPos, mono) {
        const { ctx, W, PAD } = this;
        ctx.font      = `700 9px ${this.FONT_FAMILY}`;
        ctx.fillStyle = agent.accentColor; ctx.textAlign = "left";
        ctx.fillText(mono ? "// ARAÇLAR" : "ARAÇLAR", PAD, yPos);
        yPos += 15;

        const cfs = 10, cPH = 9, cPV = 3;
        ctx.font = mono ? `${cfs}px ${this.MONO_FAMILY}` : `${cfs}px ${this.FONT_FAMILY}`;
        const cH = cfs + cPV * 2;
        let x = PAD;
        agent.tools.forEach(tool => {
            const tw = ctx.measureText(tool).width, cW = tw + cPH * 2;
            if (x + cW > W - PAD) { x = PAD; yPos += cH + 6; }
            ctx.fillStyle   = "rgba(255,255,255,0.08)";
            this.RoundRect(ctx, x, yPos - cfs, cW, cH, cH/2); ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.11)"; ctx.lineWidth = 1;
            this.RoundRect(ctx, x, yPos - cfs, cW, cH, cH/2); ctx.stroke();
            ctx.fillStyle = this.COLORS.textMuted; ctx.textAlign = "left";
            ctx.fillText(tool, x + cPH, yPos);
            x += cW + 5;
        });
        return yPos;
    },

    // ─── DrawFooter ───────────────────────────────────────────────────────
    DrawFooter: function (agent) {
        const { ctx, W, H, PAD } = this;
        ctx.strokeStyle = this.COLORS.separator; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD, H-38); ctx.lineTo(W-PAD, H-38); ctx.stroke();
        ctx.font = `8px ${this.FONT_FAMILY}`; ctx.fillStyle = this.COLORS.footer;
        ctx.textAlign = "center";
        ctx.fillText(`@${agent.id}  ·  Claude Code Agent`, W/2, H-20);
    },

    // ─── DrawBorder ───────────────────────────────────────────────────────
    DrawBorder: function (agent) {
        const { ctx, W, H } = this;
        ctx.strokeStyle = this.HexToRgba(agent.accentColor, 0.45);
        ctx.lineWidth   = 1.5;
        ctx.strokeRect(0.75, 0.75, W-1.5, H-1.5);
    },

    // ─── Download ─────────────────────────────────────────────────────────
    Download: function () {
        if (!this.currentAgent) return;
        const a = document.createElement("a");
        a.download = `${this.currentAgent.id}-card.png`;
        a.href     = this.canvas.toDataURL("image/png");
        a.click();
    },

    // ─── Batch Export ─────────────────────────────────────────────────────
    // opts = { category?: "design"|"dev"|"qa"|"utility"|"all", limit?: number }
    // Filtre verilmezse (veya category "all" ise) TÜM agent'lar indirilir — geriye dönük uyumlu.
    BatchExport: function (opts) {
        if (this.isBatchRunning) return;
        opts = opts || {};

        // Kategori filtresi: "all" / boş → hepsi, aksi halde sadece eşleşen kategori
        let list = this.agents;
        if (opts.category && opts.category !== "all") {
            list = list.filter(a => a.category === opts.category);
        }
        // Opsiyonel limit: pozitif sayı verilirse ilk N agent
        const limit = parseInt(opts.limit, 10);
        if (!isNaN(limit) && limit > 0) {
            list = list.slice(0, limit);
        }
        if (list.length === 0) return;

        this.isBatchRunning = true;
        const btn = document.getElementById("batchBtn");
        if (btn) btn.disabled = true;
        const total = list.length;
        let index = 0;

        const step = () => {
            if (index >= total) {
                this.isBatchRunning = false;
                if (btn) { btn.disabled = false; btn.textContent = "⬇ İndir"; }
                if (this.currentAgent) this.Make(this.currentAgent.id);
                return;
            }
            const agent = list[index];
            if (btn) btn.textContent = `⟳ ${index+1} / ${total} hazırlanıyor…`;
            const bgImg = this.bgImages.hasOwnProperty(agent.id)
                ? this.bgImages[agent.id]
                : (this.catImages[agent.category] !== undefined ? this.catImages[agent.category] : null);
            this.Draw(agent, bgImg);
            setTimeout(() => {
                const a = document.createElement("a");
                a.download = `${agent.id}-card.png`;
                a.href = this.canvas.toDataURL("image/png");
                a.click();
                index++;
                setTimeout(step, 350);
            }, 100);
        };
        step();
    },

    // ─── Helpers ──────────────────────────────────────────────────────────
    _truncate: function (ctx, text, maxW) {
        if (ctx.measureText(text).width <= maxW) return text;
        let t = text;
        while (ctx.measureText(t+"…").width > maxW && t.length > 0) t = t.slice(0,-1);
        return t + "…";
    },

    WrapText: function (ctx, text, maxW) {
        const words = text.split(" "), lines = []; let cur = "";
        words.forEach(w => {
            const t = cur ? cur+" "+w : w;
            if (ctx.measureText(t).width > maxW) { if (cur) lines.push(cur); cur = w; }
            else cur = t;
        });
        if (cur) lines.push(cur);
        return lines;
    },

    RoundRect: function (ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x+r, y);
        ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
        ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
        ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
        ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
        ctx.closePath();
    },

    HexToRgba: function (hex, alpha) {
        const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!r) return `rgba(100,100,100,${alpha})`;
        return `rgba(${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)},${alpha})`;
    }
};

// ─── Page init ────────────────────────────────────────────────────────────────
$(document).ready(function () {
    AC.Init();
    $("#agentSelect").on("change", function () { AC.Make($(this).val()); });
    $("#downloadBtn").on("click",  function () { AC.Download(); });
    $("#batchBtn").on("click",     function () {
        const category = $("#batchCategory").val() || "all";
        const limit    = $("#batchLimit").val();
        AC.BatchExport({ category, limit });
    });
});
