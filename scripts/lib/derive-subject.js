/**
 * Subject Deriver — agent.description → 8-15 word visual subject
 *
 * Scraped agent'larda `imagePrompt` alanı yoktur. Bu modül agent'ın
 * description'ından Gemini 2.5 Flash ile fotoğraf çekilebilir bir
 * subject çıkarır, sonra `buildPrompt(subject)` ile birleşir.
 */

const MODEL = "gemini-2.5-flash";

const SUBJECT_PROMPT = `Aşağıdaki agent için 8-15 kelimelik, fotoğraf çekilebilir bir "visual subject" cümlesi üret.

KURALLAR:
- TEK karakter/figür tarif et (örn: "a wise scholar", "a noir detective")
- Karakter ne tutuyor / ne giyiyor / parıldayan obje gibi 1-2 niteliği ekle
- Sahne/arka plan/composition ANLATMA (template otomatik halleder)
- Soyut kavram değil, somut bir figür olsun
- İngilizce yaz
- Sadece subject döndür, başka açıklama, başka cümle, kalın yazı, prefix YOK

İYİ ÖRNEKLER:
- "A wise blue-robed scholar holding an open glowing tome"
- "A young hooded developer holding a luminous smartphone"
- "A noir detective in trench coat with a glowing red magnifying glass"

AGENT BİLGİSİ:
Adı: {{name}}
Kategori: {{category}}
Açıklama: {{description}}

ŞİMDİ SADECE SUBJECT'İ YAZ:`;

/**
 * Derive a visual subject from agent metadata.
 * @param {Object} ai - GoogleGenAI instance
 * @param {Object} agent - agent object with name, description, category
 * @returns {Promise<string>} 8-15 word visual subject
 */
async function deriveSubject(ai, agent) {
    const text = SUBJECT_PROMPT
        .replace("{{name}}",        agent.name        || "")
        .replace("{{category}}",    agent.category    || "utility")
        .replace("{{description}}", agent.description || agent.prompt?.substring(0, 400) || "");

    const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text }] }],
        config: { temperature: 0.4 },
    });

    let raw = response.text
        || response.candidates?.[0]?.content?.parts?.[0]?.text
        || "";

    // Temizle: alıntı işaretleri, kalın işaretler, satır sonu, baştaki "Subject:" gibi
    let subject = raw
        .trim()
        .replace(/^["'`]+|["'`]+$/g, "")
        .replace(/^subject:\s*/i, "")
        .replace(/^\*+|\*+$/g, "")
        .split("\n")[0]
        .trim();

    if (!subject || subject.length < 5) {
        // Fallback: emoji + agent adı
        subject = `A character representing ${agent.name}, ${agent.emoji || ""} themed`;
    }

    return subject;
}

module.exports = { deriveSubject };
