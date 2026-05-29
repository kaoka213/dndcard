/**
 * Image Validator — Gemini 2.5 Flash Vision
 *
 * Üretilen görseli 6 binary kriterle değerlendirir:
 *   topPadding, bottomPadding, fullBodyVisible, cleanBackground, centered, noText
 * Hepsi true ise pass; aksi halde fail (reason ile birlikte).
 */

const VALIDATION_MODEL = "gemini-2.5-flash";

const VALIDATION_PROMPT = `Bu görseli bir agent kartı için portre olarak STRICT şekilde değerlendir.
Görsel 3:4 dikey çerçeve. STRICT ol — şüphede ise false dön.

Sadece JSON cevap ver:

{
  "topPadding": boolean,
  "bottomPadding": boolean,
  "fullBodyVisible": boolean,
  "cleanBackground": boolean,
  "centered": boolean,
  "noText": boolean,
  "reason": string
}

Kriterler (her biri bağımsız, STRICT):

- topPadding: Subject'in EN ÜST noktası (saç, baş, kapüşon, şapka, herhangi bir element) ile çerçevenin üst kenarı arasında NET siyah/karanlık boşluk var mı? Element çerçevenin üst kenarına TEMAS ediyorsa veya çerçevenin üst %10'una giriyorsa false dön.

- bottomPadding: Subject'in EN ALT noktası (ayak, robe alt, herhangi bir element) ile çerçevenin alt kenarı arasında net boşluk var mı? Element alt kenara temas ediyorsa false dön.

- fullBodyVisible: Subject'in tüm vücudu (baş + ayaklar/alt kısım) GÖRÜNÜR mü? Vücut parçası kesilmişse, baş yoksa, ayaklar gizliyse false dön.

- cleanBackground: Arka plan SAF koyu/siyah mı? Çevre, eşya, mimari, doku veya başka detay varsa false dön (hafif gradient OK).

- centered: Subject yatay olarak kabaca merkezde mi (sola/sağa kaymamış)?

- noText: Görselde HİÇBİR yazı, harf, kelime, logo, watermark, sayı YOK mu?

- reason: Eğer herhangi biri false ise tek cümleyle HANGİ kriterin neden başarısız olduğunu açıkla. Hepsi true ise "ok".`;

/**
 * Validate a generated image against quality criteria.
 * @param {Object} ai - GoogleGenAI instance
 * @param {Buffer} imageBuffer - JPEG image buffer
 * @returns {Promise<{pass: boolean, detail: object}>}
 */
async function validateImage(ai, imageBuffer) {
  const response = await ai.models.generateContent({
    model: VALIDATION_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBuffer.toString("base64"),
            },
          },
          { text: VALIDATION_PROMPT },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0.1, // deterministic-ish
    },
  });

  const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Validation response empty");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from markdown/code fence
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`Validation response not JSON: ${text.slice(0, 200)}`);
    parsed = JSON.parse(m[0]);
  }

  const pass =
    parsed.topPadding      === true &&
    parsed.bottomPadding   === true &&
    parsed.fullBodyVisible === true &&
    parsed.cleanBackground === true &&
    parsed.centered        === true &&
    parsed.noText          === true;

  return { pass, detail: parsed };
}

module.exports = { validateImage, VALIDATION_MODEL };
