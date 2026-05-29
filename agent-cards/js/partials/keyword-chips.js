// PARTIAL: keyword-chips.js
// Pattern 5: LoR 3-part keyword chip → tool badge redesign
//
// Each chip mirrors Legends of Runeterra's keyword badge structure:
//   [LEFT-CAP: accent zone + icon dot] [MIDDLE: label text] [RIGHT-CAP: subtle taper]
//
// Usage: Object.assign(AC, PARTIAL_KeywordChips) after AC is defined,
// or merge into AC directly. The DrawTools method signature is identical
// to the original so all three templates (Design, Dev, QA, Utility) work
// without any other changes.

const PARTIAL_KeywordChips = {

    DrawTools: function (agent, yPos, mono) {
        const { ctx, W, PAD } = this;
        const accent   = agent.accentColor;

        // ── Section label ────────────────────────────────────────────────
        // 2px accent-colour left border + uppercase label text
        const labelText = mono ? "// ARAÇLAR" : "ARAÇLAR";
        const labelX    = PAD;
        const barH      = 10;

        ctx.fillStyle = accent;
        ctx.fillRect(labelX, yPos - barH + 1, 2, barH);  // left accent bar

        ctx.font      = `700 8px ${this.FONT_FAMILY}`;
        ctx.fillStyle = accent;
        ctx.textAlign = "left";
        ctx.fillText(labelText.toUpperCase(), labelX + 7, yPos);

        yPos += 16;

        // ── Chip geometry constants ──────────────────────────────────────
        const CHIP_H      = 28;          // total chip height (taller for better card fill)
        const CHIP_R      = CHIP_H / 2;  // fully-rounded left/right ends
        const LEFT_CAP_W  = 20;          // width of icon zone
        const RIGHT_CAP_W = 8;           // width of right taper zone
        const TEXT_PAD_L  = 7;           // gap between left-cap edge and text
        const TEXT_PAD_R  = 10;          // right text padding
        const GAP_X       = 6;           // horizontal gap between chips
        const GAP_Y       = 6;           // vertical gap on wrap

        const fontFamily = mono ? this.MONO_FAMILY : this.FONT_FAMILY;
        const fontSize   = 10;
        ctx.font = `${fontSize}px ${fontFamily}`;

        let x = PAD;

        agent.tools.forEach(tool => {
            const textW = ctx.measureText(tool).width;
            const chipW = LEFT_CAP_W + TEXT_PAD_L + textW + TEXT_PAD_R + RIGHT_CAP_W;

            // Wrap to next line if chip overflows right edge
            if (x + chipW > W - PAD) {
                x    = PAD;
                yPos += CHIP_H + GAP_Y;
            }

            const cy   = yPos;            // top of chip (after potential wrap)
            const cmid = cy + CHIP_H / 2; // vertical centre

            ctx.save();

            // ── Layer 1: full chip base (very subtle white fill) ─────────
            ctx.fillStyle = "rgba(255,255,255,0.07)";
            this.RoundRect(ctx, x, cy, chipW, CHIP_H, CHIP_R);
            ctx.fill();

            // ── Layer 2: left-cap accent fill (clipped to left zone) ─────
            // Clip to the chip shape first, then fill a rect covering the
            // left-cap zone so it stays within the rounded boundary.
            ctx.save();
            this.RoundRect(ctx, x, cy, chipW, CHIP_H, CHIP_R);
            ctx.clip();

            ctx.fillStyle = this.HexToRgba(accent, 0.40);
            ctx.fillRect(x, cy, LEFT_CAP_W, CHIP_H);

            // ── Layer 3: right-cap accent fill (clipped, inside chip) ────
            ctx.fillStyle = this.HexToRgba(accent, 0.12);
            ctx.fillRect(x + chipW - RIGHT_CAP_W, cy, RIGHT_CAP_W, CHIP_H);

            ctx.restore(); // release clip

            // ── Layer 4: chip border ──────────────────────────────────────
            ctx.strokeStyle = this.HexToRgba(accent, 0.32);
            ctx.lineWidth   = 1;
            this.RoundRect(ctx, x, cy, chipW, CHIP_H, CHIP_R);
            ctx.stroke();

            // ── Left-cap divider line (separates icon zone from content) ──
            ctx.strokeStyle = this.HexToRgba(accent, 0.28);
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.moveTo(x + LEFT_CAP_W, cy + 3);
            ctx.lineTo(x + LEFT_CAP_W, cy + CHIP_H - 3);
            ctx.stroke();

            // ── Left-cap icon: filled dot in accent colour ────────────────
            ctx.fillStyle = accent;
            ctx.beginPath();
            ctx.arc(x + LEFT_CAP_W / 2, cmid, 3, 0, Math.PI * 2);
            ctx.fill();

            // Small cross/plus inside the dot for a more LoR-like icon feel
            ctx.strokeStyle = "rgba(0,0,0,0.45)";
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.moveTo(x + LEFT_CAP_W / 2 - 2, cmid);
            ctx.lineTo(x + LEFT_CAP_W / 2 + 2, cmid);
            ctx.moveTo(x + LEFT_CAP_W / 2,     cmid - 2);
            ctx.lineTo(x + LEFT_CAP_W / 2,     cmid + 2);
            ctx.stroke();

            // ── Tool name text (middle zone) ──────────────────────────────
            ctx.font      = `${fontSize}px ${fontFamily}`;
            ctx.fillStyle = this.COLORS.white;
            ctx.textAlign = "left";
            ctx.fillText(tool, x + LEFT_CAP_W + TEXT_PAD_L, cmid + fontSize / 2 - 1);

            ctx.restore(); // restore from outer save

            x += chipW + GAP_X;
        });

        // Return the y position past the last row of chips
        return yPos + CHIP_H + 4;
    },

};
