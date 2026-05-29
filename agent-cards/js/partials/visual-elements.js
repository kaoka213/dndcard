// PARTIAL: visual-elements.js
// Patterns 6+7+8: LoR region icon stack + rarity gem + UPPERCASE typography
//
// HOW TO INTEGRATE:
//   Object.assign(AC, PARTIAL_VisualElements);
// Call this AFTER the AC object is defined, BEFORE AC.Init() runs.
// DrawNameOverlay replaces the built-in version of the same name on AC.
// DrawRegionStack and DrawRarityGem are additive — call them from Draw()
// after DrawPortrait() / DrawFade() and before DrawFooter() respectively.

const PARTIAL_VisualElements = {

    // ─── Pattern 6: LoR Region Icon Stack ────────────────────────────────────
    // LoR stacks region icons in a vertical column on the right edge of the
    // portrait (think Freljord, Noxus, Piltover stacked shields). We adapt this
    // into a vertical stack of tool-initial badges pinned to the right portrait
    // edge, giving a quick at-a-glance read of which tools the agent has access
    // to — exactly how LoR communicates multi-region champions.
    DrawRegionStack: function (agent) {
        const { ctx } = this;
        const W     = this.W;
        const IMG_H = this.IMG_H;

        const tools      = agent.tools || [];
        const isWildcard = tools.length === 1 && tools[0] === "*";
        const accent     = agent.accentColor;

        // ── Tool initial / symbol map ────────────────────────────────────────
        // Matches LoR's region icon mapping: each tool has a consistent glyph.
        const TOOL_GLYPHS = {
            "Read":       "R",
            "Write":      "W",
            "Edit":       "E",
            "Bash":       "B",
            "Glob":       "G",
            "Grep":       "Gr",
            "WebSearch":  "🌐",
            "Agent":      "A",
            "*":          "★",
        };

        // Resolve which tools to display (cap at 5)
        const MAX_SHOWN   = 5;
        const displayList = isWildcard ? ["*"] : tools.slice(0, MAX_SHOWN);
        const overflow    = isWildcard ? 0 : Math.max(0, tools.length - MAX_SHOWN);

        // ── Layout constants ─────────────────────────────────────────────────
        const ICON_SIZE  = 18;   // width and height of each badge square
        const RADIUS     = 4;    // corner radius on each badge
        const SPACING    = 26;   // centre-to-centre vertical distance
        const EDGE_X     = W - 26;  // right-edge anchor (centre x of each badge)
        const START_Y    = 60;   // top of portrait column

        displayList.forEach((tool, i) => {
            const cx = EDGE_X;
            const cy = START_Y + i * SPACING;
            const bx = cx - ICON_SIZE / 2;
            const by = cy - ICON_SIZE / 2;

            // ── Connecting line between icons (drawn first, beneath badges) ──
            // LoR draws thin lines linking region icons into a unified column.
            if (i > 0) {
                ctx.save();
                ctx.strokeStyle = this.HexToRgba(accent, 0.15);
                ctx.lineWidth   = 1;
                ctx.beginPath();
                ctx.moveTo(cx, by);                       // top of current badge
                ctx.lineTo(cx, cy - SPACING + ICON_SIZE / 2); // bottom of previous badge
                ctx.stroke();
                ctx.restore();
            }

            // ── Badge background ─────────────────────────────────────────────
            // Semi-transparent dark fill + subtle accent stroke
            ctx.save();

            // Glow behind the badge (LoR region icons have a faint halo)
            ctx.shadowColor = accent;
            ctx.shadowBlur  = 6;

            ctx.fillStyle = "rgba(0,0,0,0.5)";
            this.RoundRect(ctx, bx, by, ICON_SIZE, ICON_SIZE, RADIUS);
            ctx.fill();

            ctx.shadowBlur  = 0;
            ctx.strokeStyle = this.HexToRgba(accent, 0.40);
            ctx.lineWidth   = 1;
            this.RoundRect(ctx, bx, by, ICON_SIZE, ICON_SIZE, RADIUS);
            ctx.stroke();

            ctx.restore();

            // ── Tool glyph centred in badge ──────────────────────────────────
            const glyph    = TOOL_GLYPHS[tool] || tool.charAt(0).toUpperCase();
            const isEmoji  = /\p{Emoji}/u.test(glyph);
            const fontSize = isEmoji ? 9 : 8;

            ctx.save();
            ctx.font         = `bold ${fontSize}px ${this.FONT_FAMILY}`;
            ctx.fillStyle    = accent;
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(glyph, cx, cy + 0.5); // +0.5 optical centring
            ctx.restore();
        });

        // ── Overflow indicator "+N more" ─────────────────────────────────────
        // LoR sometimes shows a "..." or count when a champion belongs to many
        // regions. We do the same: if tools were clipped, show a count below.
        if (overflow > 0) {
            const oy = START_Y + displayList.length * SPACING + 4;

            ctx.save();
            ctx.font         = `bold 7px ${this.FONT_FAMILY}`;
            ctx.fillStyle    = this.HexToRgba(accent, 0.60);
            ctx.textAlign    = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(`+${overflow}`, EDGE_X, oy);
            ctx.restore();
        }
    },

    // ─── Pattern 7: LoR Rarity Gem ───────────────────────────────────────────
    // LoR places a rarity gem (common=grey, rare=blue, epic=purple, champion=gold)
    // at the bottom-centre of every card, just above the footer line. It is the
    // single most iconic micro-element of the LoR card frame.
    //
    // We repurpose it as a "category gem" — four categories map to four gem
    // colours / emoji, with a radial gradient fill and decorative flanking dots
    // that give it the same jewel-like quality.
    DrawRarityGem: function (agent) {
        const { ctx } = this;
        const W = this.W;
        const H = this.H;

        const accent  = agent.accentColor;
        const catEmoji = { design: "🎨", dev: "⚙️", qa: "🔍", utility: "🤖" };
        const emoji   = catEmoji[agent.category] || "✦";

        // ── Geometry ─────────────────────────────────────────────────────────
        const cx      = W / 2;           // horizontal centre of card
        const cy      = H - 52;          // just above footer separator (H-38)
        const HALF    = 10;              // half-size of the diamond (20×20 total)

        // ── 1. Glow (drawn first, behind everything) ─────────────────────────
        ctx.save();
        ctx.shadowColor = accent;
        ctx.shadowBlur  = 14;

        // ── 2. Diamond path ──────────────────────────────────────────────────
        // Four cardinal points: top, right, bottom, left — classic LoR gem shape.
        ctx.beginPath();
        ctx.moveTo(cx,          cy - HALF); // top
        ctx.lineTo(cx + HALF,   cy);        // right
        ctx.lineTo(cx,          cy + HALF); // bottom
        ctx.lineTo(cx - HALF,   cy);        // left
        ctx.closePath();

        // ── Radial gradient fill: bright accent at centre, fades to near-transparent ──
        const radG = ctx.createRadialGradient(cx, cy, 0, cx, cy, HALF * 1.4);
        radG.addColorStop(0,    this.HexToRgba(accent, 0.90));
        radG.addColorStop(0.55, this.HexToRgba(accent, 0.55));
        radG.addColorStop(1,    this.HexToRgba(accent, 0.20));
        ctx.fillStyle   = radG;
        ctx.fill();

        // ── Diamond stroke ───────────────────────────────────────────────────
        ctx.strokeStyle = this.HexToRgba(accent, 0.70);
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        ctx.restore(); // clears shadow

        // ── 3. Inner specular highlight (tiny gloss, top-left of gem) ────────
        ctx.save();
        const hGrad = ctx.createRadialGradient(cx - 3, cy - 3, 0, cx - 3, cy - 3, 5);
        hGrad.addColorStop(0,   "rgba(255,255,255,0.40)");
        hGrad.addColorStop(0.6, "rgba(255,255,255,0.12)");
        hGrad.addColorStop(1,   "rgba(255,255,255,0)");
        ctx.beginPath();
        ctx.moveTo(cx,          cy - HALF);
        ctx.lineTo(cx + HALF,   cy);
        ctx.lineTo(cx,          cy + HALF);
        ctx.lineTo(cx - HALF,   cy);
        ctx.closePath();
        ctx.fillStyle = hGrad;
        ctx.fill();
        ctx.restore();

        // ── 4. Category emoji centred inside diamond ──────────────────────────
        ctx.save();
        ctx.font         = `10px ${this.FONT_FAMILY}`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(emoji, cx, cy + 0.5);
        ctx.restore();

        // ── 5. Decorative flanking dots ──────────────────────────────────────
        // LoR flanks its gem with small ornamental dots that feel like jewel
        // settings. Two dots each side at different distances gives depth.
        //
        //  ●  ●  ◆  ●  ●
        //  ^28 ^18   18^ 28^
        const DOT_OFFSETS = [28, 18]; // px left/right from centre
        const DOT_R       = 3;        // dot radius

        DOT_OFFSETS.forEach(offset => {
            [-1, 1].forEach(dir => {
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx + dir * offset, cy, DOT_R, 0, Math.PI * 2);
                ctx.fillStyle = this.HexToRgba(accent, 0.40);
                ctx.fill();
                ctx.restore();
            });
        });

        // Tiny hairline connecting the dots through the gem (LoR ornamental line)
        ctx.save();
        ctx.strokeStyle = this.HexToRgba(accent, 0.18);
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(cx - DOT_OFFSETS[0] - DOT_R, cy);
        ctx.lineTo(cx + DOT_OFFSETS[0] + DOT_R, cy);
        ctx.stroke();
        ctx.restore();
    },

    // ─── Pattern 8: DrawNameOverlay — UPPERCASE + Enhanced (replaces base) ────
    // LoR renders card names in ALL CAPS with a weighted font and uses a
    // coloured glow rather than a plain black drop-shadow so the name feels
    // part of the card's colour identity, not just legibility glue.
    //
    // Changes vs the base DrawNameOverlay:
    //  • agent.name forced to toUpperCase()
    //  • Two-pass shadow: accent-coloured glow first, then hard dark shadow —
    //    this is how LoR achieves the "name has its own light source" effect.
    //  • agent.id displayed as tiny "@id" subtitle below the category badge,
    //    giving the card a permanent machine-readable identifier visible at
    //    production scale.
    DrawNameOverlay: function (agent) {
        const { ctx } = this;
        const W     = this.W;
        const IMG_H = this.IMG_H;
        const PAD   = this.PAD;

        const nameY  = IMG_H - 38;
        const badgeY = IMG_H - 68;

        // ── Category badge (above the name) ──────────────────────────────────
        // Use CAT_LABELS for localised label; text already set by base script.
        const label = this.CAT_LABELS[agent.category] || agent.category;
        const badgeBottom = this.DrawBadge(label, PAD, badgeY, agent.accentColor, false);

        // ── "@id" subtitle — tiny identifier below the badge ─────────────────
        // LoR shows the card's collector ID in a whisper-weight font in the
        // same zone. We use agent.id prefixed with "@" as the equivalent.
        ctx.save();
        ctx.font         = `9px ${this.FONT_FAMILY}`;
        ctx.fillStyle    = this.HexToRgba(agent.accentColor, 0.50);
        ctx.textAlign    = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(`@${agent.id}`, PAD, badgeBottom + 11);
        ctx.restore();

        // ── Agent name — ALL CAPS, dual-shadow render ────────────────────────

        // Step 1: Size the font to fit within card width
        let fs = 28;
        ctx.font = `700 ${fs}px ${this.FONT_FAMILY}`;
        const nameUpper = agent.name.toUpperCase();
        while (ctx.measureText(nameUpper).width > W - PAD * 2 && fs > 16) {
            fs--;
            ctx.font = `700 ${fs}px ${this.FONT_FAMILY}`;
        }

        // Step 2: PASS A — Accent-coloured glow
        // Painted first (below) so the hard dark shadow in Pass B sits on top.
        // Net visual: name has a warm halo in the card's accent colour, then
        // a tight black shadow that keeps it readable on any portrait.
        ctx.save();
        ctx.font         = `700 ${fs}px ${this.FONT_FAMILY}`;
        ctx.textAlign    = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle    = this.COLORS.white;
        ctx.shadowColor  = this.HexToRgba(agent.accentColor, 0.40);
        ctx.shadowBlur   = 16;
        ctx.fillText(nameUpper, PAD, nameY);
        ctx.restore();

        // Step 3: PASS B — Hard dark shadow over the glow, then final text
        ctx.save();
        ctx.font         = `700 ${fs}px ${this.FONT_FAMILY}`;
        ctx.textAlign    = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle    = this.COLORS.white;
        ctx.shadowColor  = "rgba(0,0,0,0.9)";
        ctx.shadowBlur   = 12;
        ctx.fillText(nameUpper, PAD, nameY);
        ctx.restore();
    },

};
