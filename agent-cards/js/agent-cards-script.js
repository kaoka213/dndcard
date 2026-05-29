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

    // ─── Master draw function ───────────────────────────────────────────
    Draw: function (agent, bgImage) {
        const { ctx, W, H } = this;
        ctx.clearRect(0, 0, W, H);

        // 1. Background (image or gradient)
        this.DrawBackground(agent, bgImage);

        // 2. Dark overlay for text readability (always applied)
        this.DrawOverlay(agent);

        // 3. Subtle dot texture
        this.DrawTexture();

        // 4. Header: emoji + name + badge
        let yPos = this.DrawHeader(agent);

        // 5. Separator
        yPos = this.DrawSeparator(yPos);

        // 6. Description
        yPos = this.DrawDescription(agent, yPos);

        // 7. Capabilities
        yPos = this.DrawCapabilities(agent, yPos);

        // 8. Tools
        this.DrawTools(agent, yPos);

        // 9. Footer
        this.DrawFooter(agent);

        // 10. Border glow
        this.DrawBorder(agent);
    },

    // ─── Background ─────────────────────────────────────────────────────
    DrawBackground: function (agent, bgImage) {
        const { ctx, W, H } = this;

        if (bgImage) {
            // Imagen-generated image: fill canvas, cover-style
            const imgAR = bgImage.naturalWidth / bgImage.naturalHeight;
            const canvasAR = W / H;
            let sx = 0, sy = 0, sw = bgImage.naturalWidth, sh = bgImage.naturalHeight;
            if (imgAR > canvasAR) {
                sw = bgImage.naturalHeight * canvasAR;
                sx = (bgImage.naturalWidth - sw) / 2;
            } else {
                sh = bgImage.naturalWidth / canvasAR;
                sy = (bgImage.naturalHeight - sh) / 2;
            }
            ctx.drawImage(bgImage, sx, sy, sw, sh, 0, 0, W, H);
        } else {
            // Gradient fallback
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, this.HexToRgba(agent.accentColor, 0.4));
            grad.addColorStop(0.45, this.HexToRgba(agent.accentColor, 0.1));
            grad.addColorStop(1, "#0a0a12");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            // Radial glow
            const radial = ctx.createRadialGradient(W / 2, 70, 0, W / 2, 70, 280);
            radial.addColorStop(0, this.HexToRgba(agent.accentColor, 0.35));
            radial.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = radial;
            ctx.fillRect(0, 0, W, H);
        }
    },

    // ─── Dark base for entire card ────────────────────────────────────────
    DrawCardBase: function (agent) {
        const { ctx, W, H } = this;
        const g = ctx.createLinearGradient(0, this.IMG_H, 0, H);
        g.addColorStop(0,   "#0d0d18");
        g.addColorStop(1,   "#080810");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // Subtle accent tint at top
        const tint = ctx.createLinearGradient(0, 0, 0, H * 0.5);
        tint.addColorStop(0, this.HexToRgba(agent.accentColor, 0.18));
        tint.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, W, H * 0.5);
    },

    // ─── Dot texture ────────────────────────────────────────────────────
    DrawTexture: function () {
        const { ctx, W, H } = this;
        ctx.fillStyle = "rgba(255,255,255,0.016)";
        for (let x = 20; x < W; x += 28) {
            for (let y = 20; y < H; y += 28) {
                ctx.beginPath();
                ctx.arc(x, y, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },

    // ─── Header ─────────────────────────────────────────────────────────
    DrawHeader: function (agent) {
        const { ctx, W, PAD } = this;
        let yPos = PAD + 10;

        // Emoji glow halo
        const halo = ctx.createRadialGradient(W / 2, yPos + 38, 0, W / 2, yPos + 38, 80);
        halo.addColorStop(0, this.HexToRgba(agent.accentColor, 0.5));
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(W / 2 - 100, yPos - 20, 200, 140);

        // Emoji
        ctx.font = `60px ${this.FONT_FAMILY}`;
        ctx.textAlign = "center";
        ctx.shadowColor = this.HexToRgba(agent.accentColor, 0.9);
        ctx.shadowBlur = 28;
        ctx.fillStyle = this.COLORS.white;
        ctx.fillText(agent.emoji, W / 2, yPos + 58);
        ctx.shadowBlur = 0;
        yPos += 76;

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

    // ─── Separator ──────────────────────────────────────────────────────
    DrawSeparator: function (yPos) {
        const { ctx, W, PAD } = this;
        ctx.strokeStyle = this.COLORS.separator;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD, yPos);
        ctx.lineTo(W - PAD, yPos);
        ctx.stroke();
        return yPos + 24;
    },

    // ─── Description ────────────────────────────────────────────────────
    DrawDescription: function (agent, yPos) {
        const { ctx, W, PAD } = this;
        const maxW = W - PAD * 2;
        ctx.font      = `13px ${this.FONT_FAMILY}`;
        ctx.fillStyle = this.COLORS.textMuted;
        ctx.textAlign = "left";
        const lines = this.WrapText(ctx, agent.description, maxWidth);
        const lineH = 20;
        lines.forEach(line => {
            ctx.fillText(line, PAD, yPos);
            yPos += lineH;
        });
        return yPos + 18;
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
