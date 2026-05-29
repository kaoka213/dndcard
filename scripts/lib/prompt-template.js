/**
 * Standart Prompt Template
 *
 * Her agent için sadece kısa bir "subject" (6-15 kelime) yazılır.
 * buildPrompt() bu subject'i sabit composition + style katmanları arasına
 * yerleştirerek tutarlı bir Imagen prompt'u üretir.
 *
 * Subject örnekleri:
 *   "translucent hooded ghost spirit with soft inner violet glow"
 *   "noir detective in trench coat holding glowing red magnifying glass"
 */

const STANDARD_COMPOSITION =
  "Full body portrait of a single subject, vertical 3:4 frame. " +
  "Subject is centered horizontally. " +
  "CRITICAL FRAMING: leave at least 15 percent empty negative space above the topmost point of the figure " +
  "(top of head, hood, hat, or any element — none of these may touch the top edge). " +
  "Leave at least 10 percent empty space below the lowest point (feet or robe bottom — must not touch bottom edge). " +
  "Subject occupies only the middle 70 percent of the vertical frame, with empty space above and below. " +
  "Nothing in the subject should touch or be clipped by any frame edge.";

const STANDARD_STYLE =
  "Pure solid near-black background, no environment, no props, no scenery, no decorations. " +
  "Dramatic single-source rim lighting, deep shadows, cinematic studio photography. " +
  "Sharp focus, fine art quality, photorealistic.";

// Developer API mode doesn't support a separate negativePrompt field, so we
// embed negative directives directly in the main prompt as a constraint clause.
const STANDARD_CONSTRAINTS =
  "Strictly avoid: any text, letters, words, watermarks, logos. " +
  "Strictly avoid: multiple subjects, crowds, busy backgrounds, cluttered scenes. " +
  "Strictly avoid: cropping the head or feet, top of head touching or near the top edge, " +
  "feet touching or near the bottom edge, off-center composition, deformed anatomy.";

const STANDARD_NEGATIVE =
  "text, letters, words, watermark, logos, signature, " +
  "multiple subjects, crowd, busy background, cluttered scene, " +
  "cropped head, cropped feet, cut off body parts, off-center composition, " +
  "background props, decorations, scenery, environment details, furniture, " +
  "blurry, low quality, distorted face, extra limbs, deformed anatomy";

/**
 * Build a standardised Imagen prompt from a short subject.
 * @param {string} subject - 6-15 word concept (who/what + key visual trait)
 * @returns {string} full prompt
 */
function buildPrompt(subject) {
  if (!subject || typeof subject !== "string") {
    throw new Error("buildPrompt: subject must be a non-empty string");
  }
  const cleaned = subject.trim().replace(/\.$/, "");
  return `${STANDARD_COMPOSITION} Subject: ${cleaned}. ${STANDARD_STYLE} ${STANDARD_CONSTRAINTS}`;
}

module.exports = {
  buildPrompt,
  STANDARD_COMPOSITION,
  STANDARD_STYLE,
  STANDARD_CONSTRAINTS,
  STANDARD_NEGATIVE,
};
