// Agent Cards Script
// Canvas-based modern SaaS card renderer for agent system prompts
// Supports Imagen-generated background images with gradient fallback

const AC = {
    // Canvas dimensions
    W: 612,
    H: 792,
    PAD: 36,

    FONT_FAMILY: "'Segoe UI', 'Arial', sans-serif",

    COLORS: {
        white: "#F8FAFC",
        textMuted: "#94A3B8",
        textDim: "#475569",
        separator: "rgba(255,255,255,0.14)",
        footer: "rgba(255,255,255,0.28)"
    },

    agents: [],
    currentAgent: null,
    canvas: null,
    ctx: null,
    bgImages: {}, // Cache: agentId → HTMLImageElement (or null if failed)

    // ─── Init ───────────────────────────────────────────────────────────
    Init: function () {
        this.canvas = document.getElementById("agentCanvas");
        this.ctx = this.canvas.getContext("2d");

        $.getJSON("js/JSON/agents.json", (data) => {
            this.agents = data.agents;
            this.PopulateSelector();
            if (this.agents.length > 0) {
                this.Make(this.agents[0].id);
            }
        }).fail(() => {
            console.error("agents.json yüklenemedi.");
        });
    },

    // ─── Populate dropdown ──────────────────────────────────────────────
    PopulateSelector: function () {
        const sel = document.getElementById("agentSelect");
        sel.innerHTML = "";

        const categories = {};
        this.agents.forEach(a => {
            if (!categories[a.category]) categories[a.category] = [];
            categories[a.category].push(a);
        });

        const catLabels = {
            design: "🎨 Tasarım",
            dev: "⚙️ Geliştirme",
            qa: "🔍 Kalite & Test",
            utility: "🤖 Yardımcı"
        };

        Object.keys(catLabels).forEach(cat => {
            if (!categories[cat]) return;
            const group = document.createElement("optgroup");
            group.label = catLabels[cat] || cat;
            categories[cat].forEach(agent => {
                const opt = document.createElement("option");
                opt.value = agent.id;
                opt.textContent = `${agent.emoji}  ${agent.name}`;
                group.appendChild(opt);
            });
            sel.appendChild(group);
        });
    },

    // ─── Main render entry ──────────────────────────────────────────────
    Make: function (agentId) {
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;
        this.currentAgent = agent;
        document.getElementById("agentSelect").value = agentId;

        // Check cache first
        if (this.bgImages.hasOwnProperty(agentId)) {
            // Already resolved (image or null)
            this.Draw(agent, this.bgImages[agentId]);
            return;
        }

        // Try to load agent-specific background image
        const img = new Image();
        const imgPath = `images/agents/${agentId}.jpg`;

        img.onload = () => {
            this.bgImages[agentId] = img;
            this.Draw(agent, img);
        };
        img.onerror = () => {
            // Image not found — use gradient fallback
            this.bgImages[agentId] = null;
            this.Draw(agent, null);
        };
        img.src = imgPath;
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

    // ─── Overlay — darkens image for text readability ───────────────────
    DrawOverlay: function (agent) {
        const { ctx, W, H } = this;

        // Full card dark vignette
        const darkGrad = ctx.createLinearGradient(0, 0, 0, H);
        darkGrad.addColorStop(0, "rgba(0,0,0,0.45)");
        darkGrad.addColorStop(0.38, "rgba(0,0,0,0.35)");
        darkGrad.addColorStop(0.5, "rgba(0,0,0,0.72)");
        darkGrad.addColorStop(1, "rgba(0,0,0,0.90)");
        ctx.fillStyle = darkGrad;
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
        yPos += 16;
        let nameFontSize = 32;
        ctx.font = `700 ${nameFontSize}px ${this.FONT_FAMILY}`;
        while (ctx.measureText(agent.name).width > W - PAD * 2 - 20 && nameFontSize > 18) {
            nameFontSize--;
            ctx.font = `700 ${nameFontSize}px ${this.FONT_FAMILY}`;
        }
        ctx.fillStyle = this.COLORS.white;
        ctx.shadowColor = "rgba(0,0,0,0.7)";
        ctx.shadowBlur = 12;
        ctx.textAlign = "center";
        ctx.fillText(agent.name, W / 2, yPos);
        ctx.shadowBlur = 0;
        yPos += 14;

        // Category badge
        yPos += 10;
        const catLabels = {
            design: "Tasarım",
            dev: "Geliştirme",
            qa: "Kalite & Test",
            utility: "Yardımcı"
        };
        const badgeText = catLabels[agent.category] || agent.category;
        yPos = this.DrawBadge(badgeText, W / 2, yPos, agent.accentColor);

        return yPos + 18;
    },

    // ─── Pill badge ─────────────────────────────────────────────────────
    DrawBadge: function (text, centerX, topY, accentColor) {
        const { ctx } = this;
        const fontSize = 11;
        ctx.font = `600 ${fontSize}px ${this.FONT_FAMILY}`;
        const textW = ctx.measureText(text).width;
        const padH = 10, padV = 5;
        const bW = textW + padH * 2;
        const bH = fontSize + padV * 2;
        const bX = centerX - bW / 2;
        const bY = topY;

        ctx.fillStyle = this.HexToRgba(accentColor, 0.28);
        this.RoundRect(ctx, bX, bY, bW, bH, bH / 2);
        ctx.fill();

        ctx.strokeStyle = this.HexToRgba(accentColor, 0.65);
        ctx.lineWidth = 1;
        this.RoundRect(ctx, bX, bY, bW, bH, bH / 2);
        ctx.stroke();

        ctx.fillStyle = accentColor;
        ctx.textAlign = "center";
        ctx.fillText(text, centerX, bY + bH / 2 + fontSize / 2 - 1);

        return bY + bH;
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
        const maxWidth = W - PAD * 2;
        const fontSize = 13;
        ctx.font = `${fontSize}px ${this.FONT_FAMILY}`;
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

    // ─── Capabilities ───────────────────────────────────────────────────
    DrawCapabilities: function (agent, yPos) {
        const { ctx, PAD } = this;

        ctx.font = `700 9px ${this.FONT_FAMILY}`;
        ctx.fillStyle = agent.accentColor;
        ctx.textAlign = "left";
        ctx.fillText("YETENEKLER", PAD, yPos);
        yPos += 16;

        ctx.font = `13px ${this.FONT_FAMILY}`;
        agent.capabilities.forEach(cap => {
            // Dot
            ctx.fillStyle = agent.accentColor;
            ctx.beginPath();
            ctx.arc(PAD + 4, yPos - 4, 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = this.COLORS.white;
            ctx.fillText(cap, PAD + 16, yPos);
            yPos += 22;
        });

        return yPos + 10;
    },

    // ─── Tools ──────────────────────────────────────────────────────────
    DrawTools: function (agent, yPos) {
        const { ctx, W, PAD } = this;
        const maxWidth = W - PAD * 2;

        ctx.font = `700 9px ${this.FONT_FAMILY}`;
        ctx.fillStyle = agent.accentColor;
        ctx.textAlign = "left";
        ctx.fillText("ARAÇLAR", PAD, yPos);
        yPos += 16;

        const chipFontSize = 11;
        const chipPadH = 10, chipPadV = 4;
        ctx.font = `${chipFontSize}px ${this.FONT_FAMILY}`;
        const chipH = chipFontSize + chipPadV * 2;
        const lineH = chipH + 8;
        let x = PAD;

        agent.tools.forEach(tool => {
            const tw = ctx.measureText(tool).width;
            const chipW = tw + chipPadH * 2;

            if (x + chipW > W - PAD) {
                x = PAD;
                yPos += lineH;
            }

            ctx.fillStyle = "rgba(255,255,255,0.09)";
            this.RoundRect(ctx, x, yPos - chipFontSize, chipW, chipH, chipH / 2);
            ctx.fill();

            ctx.strokeStyle = "rgba(255,255,255,0.12)";
            ctx.lineWidth = 1;
            this.RoundRect(ctx, x, yPos - chipFontSize, chipW, chipH, chipH / 2);
            ctx.stroke();

            ctx.fillStyle = this.COLORS.textMuted;
            ctx.textAlign = "left";
            ctx.fillText(tool, x + chipPadH, yPos);
            x += chipW + 6;
        });

        return yPos + lineH + 8;
    },

    // ─── Footer ─────────────────────────────────────────────────────────
    DrawFooter: function (agent) {
        const { ctx, W, H, PAD } = this;

        ctx.strokeStyle = this.COLORS.separator;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD, H - 42);
        ctx.lineTo(W - PAD, H - 42);
        ctx.stroke();

        ctx.font = `9px ${this.FONT_FAMILY}`;
        ctx.fillStyle = this.COLORS.footer;
        ctx.textAlign = "left";
        ctx.fillText(`@${agent.id}`, PAD, H - 22);

        ctx.textAlign = "right";
        ctx.fillText("Claude Code Agent", W - PAD, H - 22);
    },

    // ─── Card border glow ────────────────────────────────────────────────
    DrawBorder: function (agent) {
        const { ctx, W, H } = this;
        ctx.strokeStyle = this.HexToRgba(agent.accentColor, 0.4);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(0.75, 0.75, W - 1.5, H - 1.5);
    },

    // ─── PNG Download ────────────────────────────────────────────────────
    Download: function () {
        if (!this.currentAgent) return;
        const link = document.createElement("a");
        link.download = `${this.currentAgent.id}-card.png`;
        link.href = this.canvas.toDataURL("image/png");
        link.click();
    },

    // ─── Helpers ─────────────────────────────────────────────────────────

    WrapText: function (ctx, text, maxWidth) {
        const words = text.split(" ");
        const lines = [];
        let current = "";
        words.forEach(word => {
            const test = current ? current + " " + word : word;
            if (ctx.measureText(test).width > maxWidth) {
                if (current) lines.push(current);
                current = word;
            } else {
                current = test;
            }
        });
        if (current) lines.push(current);
        return lines;
    },

    RoundRect: function (ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    },

    HexToRgba: function (hex, alpha) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return `rgba(100,100,100,${alpha})`;
        const r = parseInt(result[1], 16);
        const g = parseInt(result[2], 16);
        const b = parseInt(result[3], 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
};

// ─── Page init ──────────────────────────────────────────────────────────────
$(document).ready(function () {
    AC.Init();

    $("#agentSelect").on("change", function () {
        AC.Make($(this).val());
    });

    $("#downloadBtn").on("click", function () {
        AC.Download();
    });
});
