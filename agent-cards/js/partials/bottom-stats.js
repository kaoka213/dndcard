// PARTIAL: bottom-stats.js
// Pattern 4: LoR Power/Health corners → capability count (left) + tool count (right)
//
// Rendering order (called after DrawTools, before DrawFooter):
//   DrawBottomStats(agent)
//     ├─ _DrawStatCircle(cx, cy, label, value, accent)   — shared circle renderer
//     ├─ _DrawCapIcon(cx, topY, accent)                  — lightning-bolt path (left)
//     └─ _DrawToolIcon(cx, topY, accent)                 — diamond path (right)
//
// Canvas coordinate reference (W=612, H=792):
//   Footer separator line : H - 38 = 754px
//   Footer text baseline  : H - 20 = 772px
//   Stat circle centres   : x=50 / x=562,  y = H - 24 = 768px
//   The circles (r=22) therefore span y 746–790, overlapping the separator
//   intentionally — same trick LoR uses for its corner stat shields.

const PARTIAL_BottomStats = {

    // ─── Public entry-point ──────────────────────────────────────────────────
    DrawBottomStats: function (agent) {
        const { W, H } = this;

        const CX_LEFT  = 50;
        const CX_RIGHT = W - 50;      // 562
        const CY       = H - 36;      // 756  — circle centre (labels at 756+22+11=789 ✓)
        const accent   = agent.accentColor;

        // Capability count (left)
        const capValue = String(agent.capabilities.length);

        // Tool count (right) — "*" in tools array means unlimited / wildcard
        const toolValue = agent.tools.includes("*") ? "∞" : String(agent.tools.length);

        // Subtle centre divider between the two stat bubbles
        this._DrawStatDivider(CX_LEFT + 22, CX_RIGHT - 22, CY);

        // Left stat — Capabilities
        this._DrawCapIcon(CX_LEFT, CY - 30, accent);
        this._DrawStatCircle(CX_LEFT,  CY, "YTK", capValue,  accent);

        // Right stat — Tools
        this._DrawToolIcon(CX_RIGHT, CY - 30, accent);
        this._DrawStatCircle(CX_RIGHT, CY, "ARC", toolValue, accent);
    },

    // ─── Shared circle renderer ──────────────────────────────────────────────
    // Draws the LoR-style stat medallion: dark fill, accent stroke, glow,
    // large bold number, small label beneath.
    _DrawStatCircle: function (cx, cy, label, value, accent) {
        const { ctx, FONT_FAMILY } = this;
        const R = 22;

        ctx.save();

        // ── Outer glow ring (drawn first so it sits behind everything) ───────
        ctx.beginPath();
        ctx.arc(cx, cy, R + 4, 0, Math.PI * 2);
        ctx.fillStyle = this.HexToRgba(accent, 0.08);
        ctx.fill();

        // ── Main circle background ────────────────────────────────────────────
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle   = "rgba(0,0,0,0.72)";
        ctx.shadowColor = accent;
        ctx.shadowBlur  = 14;
        ctx.fill();
        ctx.shadowBlur  = 0;

        // ── Accent stroke ─────────────────────────────────────────────────────
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.strokeStyle = this.HexToRgba(accent, 0.72);
        ctx.lineWidth   = 2;
        ctx.shadowColor = accent;
        ctx.shadowBlur  = 10;
        ctx.stroke();
        ctx.shadowBlur  = 0;

        // ── Inner decorative ring (thin, very subtle) ─────────────────────────
        ctx.beginPath();
        ctx.arc(cx, cy, R - 5, 0, Math.PI * 2);
        ctx.strokeStyle = this.HexToRgba(accent, 0.18);
        ctx.lineWidth   = 0.75;
        ctx.stroke();

        // ── Stat number ───────────────────────────────────────────────────────
        // Slightly smaller font for double-digit / infinity so it never clips
        const isWide  = value.length > 1 && value !== "∞";
        const numSize = isWide ? 18 : 22;

        ctx.font      = `700 ${numSize}px ${FONT_FAMILY}`;
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Subtle text shadow for depth
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur  = 6;
        ctx.fillText(value, cx, cy + 1);
        ctx.shadowBlur  = 0;

        // ── Label beneath circle ──────────────────────────────────────────────
        ctx.font         = `700 7px ${FONT_FAMILY}`;
        ctx.fillStyle    = this.HexToRgba(accent, 0.85);
        ctx.textAlign    = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(label, cx, cy + R + 11);

        ctx.restore();
    },

    // ─── Centre divider line ─────────────────────────────────────────────────
    // Thin horizontal rule between the two stat circles — matches LoR's
    // visual separation while keeping the footer zone cohesive.
    _DrawStatDivider: function (x1, x2, cy) {
        const { ctx } = this;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x1, cy);
        ctx.lineTo(x2, cy);
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth   = 1;
        ctx.stroke();
        ctx.restore();
    },

    // ─── Left icon — capability / lightning bolt ──────────────────────────────
    // A minimal upward-pointing lightning bolt rendered with a canvas path.
    // Centred at (cx, topY).  Total height ~14px, width ~9px.
    _DrawCapIcon: function (cx, topY, accent) {
        const { ctx } = this;
        ctx.save();

        ctx.fillStyle   = this.HexToRgba(accent, 0.82);
        ctx.shadowColor = accent;
        ctx.shadowBlur  = 8;

        // Lightning bolt path (two-triangle silhouette)
        // Upper half: slants right then back to centre
        // Lower half: continues down then back left
        ctx.beginPath();
        ctx.moveTo(cx + 2,  topY);          // top-right entry
        ctx.lineTo(cx - 3,  topY + 7);      // down-left to midpoint
        ctx.lineTo(cx + 1,  topY + 7);      // small step right at waist
        ctx.lineTo(cx - 2,  topY + 14);     // down-left to tip
        ctx.lineTo(cx + 3,  topY + 7);      // back up-right
        ctx.lineTo(cx - 1,  topY + 7);      // step left at waist
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.restore();
    },

    // ─── Right icon — tool / diamond ──────────────────────────────────────────
    // A small rotated square (diamond) to suggest tools/precision.
    // Centred at (cx, topY + 7) so it sits at the same vertical midpoint
    // as the bolt.
    _DrawToolIcon: function (cx, topY, accent) {
        const { ctx } = this;
        const S = 5;   // half-size of the diamond
        const icY = topY + 7;

        ctx.save();

        ctx.fillStyle   = this.HexToRgba(accent, 0.82);
        ctx.shadowColor = accent;
        ctx.shadowBlur  = 8;

        ctx.beginPath();
        ctx.moveTo(cx,     icY - S);   // top
        ctx.lineTo(cx + S, icY);       // right
        ctx.lineTo(cx,     icY + S);   // bottom
        ctx.lineTo(cx - S, icY);       // left
        ctx.closePath();
        ctx.fill();

        // Inner highlight for a gem-like look
        ctx.fillStyle = this.HexToRgba(accent, 0.22);
        ctx.beginPath();
        ctx.moveTo(cx,         icY - S + 2);
        ctx.lineTo(cx + S - 2, icY);
        ctx.lineTo(cx,         icY + 2);
        ctx.lineTo(cx - S + 2, icY);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.restore();
    },

};
