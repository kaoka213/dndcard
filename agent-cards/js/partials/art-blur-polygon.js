// PARTIAL: art-blur-polygon.js
// Patterns 1+2: LoR polygon clip art + double-layer blur technique
// Drop-in replacements for DrawPortrait and DrawPortraitVignette on the AC object
//
// HOW TO INTEGRATE:
//   Object.assign(AC, PARTIAL_ArtBlurPolygon);
// Call this line AFTER the AC object is defined but BEFORE AC.Init() runs,
// or reassign inside $(document).ready before AC.Init().

const PARTIAL_ArtBlurPolygon = {

    // ─── Pattern 1+2: Polygon clip + double-layer art blur ───────────────────
    // LoR clips its unit art with a hexagonal/polygon silhouette instead of a
    // plain rectangle, then composites a blurred "dissolve" layer on top so the
    // portrait melts into the dark card body.  We replicate that here.
    DrawPortrait: function (agent, img) {
        const { ctx, W, IMG_H } = this;

        // ── Shared polygon builder ──────────────────────────────────────────
        // Produces a V-notch bottom: art area tapers inward at the bottom centre,
        // matching LoR's unit frame silhouette.
        //
        //   TL (0,0) ─────────────────── TR (W, 0)
        //    │                                   │
        //    │                                   │
        //   BL (0, IMG_H-30) ── notch ── BR (W, IMG_H-30)
        //                  \             /
        //            (W/2-40, IMG_H)──(W/2+40, IMG_H)
        //
        const buildPolygon = () => {
            ctx.beginPath();
            ctx.moveTo(0,           0);
            ctx.lineTo(W,           0);
            ctx.lineTo(W,           IMG_H - 30);
            ctx.lineTo(W / 2 + 40,  IMG_H);
            ctx.lineTo(W / 2 - 40,  IMG_H);
            ctx.lineTo(0,           IMG_H - 30);
            ctx.closePath();
        };

        // ── Cover-fit math (shared between both passes) ─────────────────────
        // Returns { offX, offY, dW, dH } — the destination rect that centre-
        // crops img to fill the entire W × IMG_H area.
        const coverFit = (image) => {
            const iW    = image.naturalWidth;
            const iH    = image.naturalHeight;
            const scale = Math.max(W / iW, IMG_H / iH);
            const dW    = iW * scale;
            const dH    = iH * scale;
            return {
                scale,
                dW,
                dH,
                offX: (W    - dW) / 2,
                offY: (IMG_H - dH) / 2,
            };
        };

        // ════════════════════════════════════════════════════════════════════
        // PASS 1 — Clean art draw, clipped to polygon
        // ════════════════════════════════════════════════════════════════════
        ctx.save();
        buildPolygon();
        ctx.clip();

        if (img) {
            const { offX, offY, dW, dH } = coverFit(img);
            ctx.drawImage(img, offX, offY, dW, dH);
        } else {
            // Gradient fallback — rich accent-tinted panel
            const g = ctx.createLinearGradient(0, 0, 0, IMG_H);
            g.addColorStop(0, this.HexToRgba(agent.accentColor, 0.55));
            g.addColorStop(1, this.HexToRgba(agent.accentColor, 0.12));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, IMG_H);

            // Large centred emoji as the "portrait figure"
            ctx.font        = `96px ${this.FONT_FAMILY}`;
            ctx.textAlign   = "center";
            ctx.shadowColor = this.HexToRgba(agent.accentColor, 0.90);
            ctx.shadowBlur  = 42;
            ctx.fillStyle   = this.COLORS.white;
            ctx.fillText(agent.emoji, W / 2, IMG_H / 2 + 36);
            ctx.shadowBlur  = 0;
        }

        ctx.restore();

        // ════════════════════════════════════════════════════════════════════
        // PASS 2 — LoR double-layer blur: art dissolves into dark at bottom
        //
        // LoR renders the champion/unit art twice:
        //   • Layer A — the raw art (Pass 1 above).
        //   • Layer B — the SAME art, slightly scaled up (softness illusion)
        //               and composited with a top→bottom gradient mask that
        //               is transparent at the top and fully opaque dark at
        //               the bottom.  This fakes a "depth-of-field blur" and
        //               makes the frame edge look like the art is dissolving.
        //
        // We replicate with three sub-layers inside the same polygon clip:
        //   2a. Slightly-enlarged, semi-transparent redraw (blur softness)
        //   2b. Dark gradient overlay (top 45% clear → bottom fully dark)
        //   2c. Pure accent colour bottom-fill at very low alpha (colour bleed)
        // ════════════════════════════════════════════════════════════════════
        ctx.save();
        buildPolygon();
        ctx.clip();

        if (img) {
            const { scale, dW, dH, offX, offY } = coverFit(img);

            // ── 2a. Blurred redraw in the lower 45% of the portrait ─────────
            // Scale the image up slightly (×1.05) and shift down so the same
            // portion is visible — this creates a subtle "zoom blur" where
            // the bottom-of-frame art appears marginally larger/softer than
            // the clean layer underneath.
            const blurScale  = scale * 1.05;
            const bDW        = img.naturalWidth  * blurScale;
            const bDH        = img.naturalHeight * blurScale;
            // Keep horizontal centre the same; push vertical centre down by
            // the extra height so the subject's face doesn't drift.
            const bOffX      = (W    - bDW) / 2;
            const bOffY      = offY  - (bDH - dH) * 0.35; // anchor near top

            // Only paint the blurred layer in the bottom 45% of the portrait
            // (y from IMG_H * 0.55 downward) — above that the clean art shows.
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, IMG_H * 0.55, W, IMG_H * 0.45 + 30); // +30 covers notch
            ctx.clip();
            ctx.globalAlpha = 0.60;
            ctx.drawImage(img, bOffX, bOffY, bDW, bDH);
            ctx.globalAlpha = 1;
            ctx.restore();

            // ── 2b. Dark gradient mask — transparent at top, opaque at bottom ──
            // Stops:
            //   0%   at y = IMG_H * 0.45  → fully transparent (clean art visible)
            //   100% at y = IMG_H          → rgba(8,8,16,1)   (matches card base)
            const fadeY0 = IMG_H * 0.45;
            const fadeG  = ctx.createLinearGradient(0, fadeY0, 0, IMG_H);
            fadeG.addColorStop(0,    "rgba(8,8,16,0)");
            fadeG.addColorStop(0.55, "rgba(8,8,16,0.72)");
            fadeG.addColorStop(1,    "rgba(8,8,16,1)");
            ctx.fillStyle = fadeG;
            ctx.fillRect(0, fadeY0, W, IMG_H - fadeY0 + 30);

        } else {
            // No image — just deepen the gradient at the bottom so the emoji
            // panel merges cleanly with the card body.
            const g2 = ctx.createLinearGradient(0, IMG_H * 0.5, 0, IMG_H);
            g2.addColorStop(0, "rgba(8,8,16,0)");
            g2.addColorStop(1, "rgba(8,8,16,0.92)");
            ctx.fillStyle = g2;
            ctx.fillRect(0, IMG_H * 0.5, W, IMG_H * 0.5 + 30);
        }

        // ── 2c. Accent colour bleed from the bottom (LoR "tint bleed") ────
        // A narrow band of the card's accent colour at very low alpha rises
        // up from the polygon bottom, so the card feels colour-coherent even
        // before the name overlay is painted.
        const accentBleedH = IMG_H * 0.28;
        const accentG      = ctx.createLinearGradient(0, IMG_H - accentBleedH, 0, IMG_H);
        accentG.addColorStop(0, this.HexToRgba(agent.accentColor, 0));
        accentG.addColorStop(1, this.HexToRgba(agent.accentColor, 0.14));
        ctx.fillStyle = accentG;
        ctx.fillRect(0, IMG_H - accentBleedH, W, accentBleedH + 30);

        ctx.restore();

        // Finally, apply the vignette (edge darkening + accent bottom glow)
        this.DrawPortraitVignette(agent);
    },

    // ─── Enhanced vignette: edge darkening + accent bottom radial glow ───────
    // Keeps the original left/right/top dark-edge behaviour from the base script
    // and adds a LoR-style "accent tint bleed" — a radial glow in the card's
    // accent colour that bleeds upward from the bottom of the portrait, creating
    // the warm halo that makes LoR champion art feel so atmospheric.
    DrawPortraitVignette: function (agent) {
        const { ctx, W, IMG_H } = this;

        // ── Left edge darkening ─────────────────────────────────────────────
        const lG = ctx.createLinearGradient(0, 0, 70, 0);
        lG.addColorStop(0, "rgba(0,0,0,0.50)");
        lG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = lG;
        ctx.fillRect(0, 0, 70, IMG_H);

        // ── Right edge darkening ────────────────────────────────────────────
        const rG = ctx.createLinearGradient(W, 0, W - 70, 0);
        rG.addColorStop(0, "rgba(0,0,0,0.50)");
        rG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rG;
        ctx.fillRect(W - 70, 0, 70, IMG_H);

        // ── Top edge darkening ──────────────────────────────────────────────
        const tG = ctx.createLinearGradient(0, 0, 0, 55);
        tG.addColorStop(0, "rgba(0,0,0,0.55)");
        tG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = tG;
        ctx.fillRect(0, 0, W, 55);

        // ── NEW: Bottom-centre radial accent glow (LoR "accent tint bleed") ─
        // A radial gradient centred at the bottom midpoint of the portrait
        // radiates the card's accent colour upward with a soft alpha of 0.22.
        // This colour bloom is what gives LoR cards their iconic "warm light
        // rising from beneath the champion" look.
        //
        // Centre: (W/2, IMG_H)  — anchored to the very bottom of the polygon
        // Radius: 120px         — wide enough to softly flood the lower art
        // Alpha:  0.22          — subtle; sits below the dark gradient fade
        const glowRadius = 120;
        const glowX      = W / 2;
        const glowY      = IMG_H;          // bottom of portrait

        const radialG = ctx.createRadialGradient(
            glowX, glowY, 0,              // inner circle: point at centre
            glowX, glowY, glowRadius      // outer circle: fade-out ring
        );
        radialG.addColorStop(0,    this.HexToRgba(agent.accentColor, 0.22));
        radialG.addColorStop(0.60, this.HexToRgba(agent.accentColor, 0.08));
        radialG.addColorStop(1,    this.HexToRgba(agent.accentColor, 0));

        ctx.fillStyle = radialG;
        // fillRect must cover the full glow area; shift up by radius so the
        // ellipse doesn't get clipped at the top.
        ctx.fillRect(
            glowX - glowRadius,
            glowY - glowRadius,
            glowRadius * 2,
            glowRadius
        );
    },

};
