// PARTIAL: mana-gem.js
// Pattern 3: LoR mana gem → agent tool count badge (top-left portrait corner)
//
// Usage: Object.assign(AC, PARTIAL_ManaGem) then call AC.DrawManaGem(agent)
// inside Draw() after DrawPortrait() and before DrawFade() so it sits on the
// portrait layer but beneath the fade gradient.

const PARTIAL_ManaGem = {

    DrawManaGem: function (agent) {
        const { ctx } = this;

        // ── Geometry ────────────────────────────────────────────────────────
        const LEFT   = 28;   // top-left anchor x
        const TOP    = 28;   // top-left anchor y
        const R      = 32;   // outer gem radius
        const cx     = LEFT + R;   // gem centre x
        const cy     = TOP  + R;   // gem centre y

        // ── Resolve display value ────────────────────────────────────────────
        const tools      = agent.tools || [];
        const isWildcard = tools.length === 1 && tools[0] === "*";
        const label      = isWildcard ? "*" : String(tools.length);

        const accent = agent.accentColor;

        // ── 1. Decorative dashed ring (outermost, drawn first) ───────────────
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R + 8, 0, Math.PI * 2);
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = this.HexToRgba(accent, 0.22);
        ctx.lineWidth   = 0.8;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // ── 2. Drop shadow + glow ────────────────────────────────────────────
        ctx.save();
        ctx.shadowColor = accent;
        ctx.shadowBlur  = 16;

        // ── 3. Outer gem circle — radial gradient fill ───────────────────────
        const grad = ctx.createRadialGradient(cx - 8, cy - 8, 4, cx, cy, R);
        grad.addColorStop(0,   this.HexToRgba(accent, 0.90));
        grad.addColorStop(0.6, this.HexToRgba(accent, 0.70));
        grad.addColorStop(1,   this.HexToRgba(accent, 0.50));

        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Gem stroke (border ring)
        ctx.strokeStyle = this.HexToRgba(accent, 0.80);
        ctx.lineWidth   = 2.5;
        ctx.stroke();

        ctx.restore(); // clears shadow so it doesn't bleed into text

        // ── 4. Inner specular / gloss highlight ──────────────────────────────
        // Small off-centre circle simulates a gem's light reflection
        const hx = cx - 8;
        const hy = cy - 10;
        const hR = 10;

        const hGrad = ctx.createRadialGradient(hx - 2, hy - 2, 1, hx, hy, hR);
        hGrad.addColorStop(0,   "rgba(255,255,255,0.42)");
        hGrad.addColorStop(0.5, "rgba(255,255,255,0.18)");
        hGrad.addColorStop(1,   "rgba(255,255,255,0.00)");

        ctx.beginPath();
        ctx.arc(hx, hy, hR, 0, Math.PI * 2);
        ctx.fillStyle = hGrad;
        ctx.fill();

        // Tiny bright pinpoint at the very top of the highlight
        ctx.beginPath();
        ctx.arc(hx - 3, hy - 3, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fill();

        // ── 5. Number / wildcard label ───────────────────────────────────────
        ctx.save();
        ctx.shadowColor  = "rgba(0,0,0,0.85)";
        ctx.shadowBlur   = 6;
        ctx.font         = `bold 28px ${this.FONT_FAMILY}`;
        ctx.fillStyle    = "#FFFFFF";
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, cx, cy + 1); // +1 optical vertical adjustment
        ctx.restore();

        // ── 6. "ARAÇ" micro-label below the gem ─────────────────────────────
        ctx.save();
        ctx.font         = `bold 7px ${this.FONT_FAMILY}`;
        ctx.fillStyle    = accent;
        ctx.textAlign    = "center";
        ctx.textBaseline = "alphabetic";
        ctx.globalAlpha  = 0.85;
        ctx.fillText("ARAÇ", cx, TOP + R + R + 20); // cy + R + 20 = bottom of gem + gap
        ctx.restore();

        // ── 7. Thin separator line below the label ───────────────────────────
        // A tiny horizontal tick under "ARAÇ" grounds the badge visually
        ctx.save();
        ctx.globalAlpha  = 0.30;
        ctx.strokeStyle  = accent;
        ctx.lineWidth    = 1;
        const sepY = TOP + R + R + 24;
        ctx.beginPath();
        ctx.moveTo(cx - 10, sepY);
        ctx.lineTo(cx + 10, sepY);
        ctx.stroke();
        ctx.restore();
    },

};
