---
name: project-agent-cards
description: DNDCard reposuna eklenen Agent System Prompt Cards modülünün tasarım ve implementasyon kararları
metadata:
  type: project
---

DNDCard reposuna `agent-cards/` adında yeni bir modül eklendi. Bu modül, Claude Code agent system promptlarını 612×792 HTML Canvas üzerinde modern SaaS dark mode kartlar olarak görselleştirir.

**Why:** Kullanıcı, mevcut D&D kart sisteminin altyapısını (Canvas-based rendering, JSON data source, PNG export) agent kartları için yeniden kullanmak istedi.

**How to apply:** Yeni kart türleri eklenirken bu modül pattern'ini takip et — bağımsız `<feature>/` klasörü, `js/JSON/` altında veri kaynağı, `css/` altında tema, `../dnd/js/jquery-3.4.1.min.js`'e göreli path ile bağlanma.

## Tasarım kararları

- **Görsel yön:** Modern SaaS dark mode (D&D parchment temasından bağımsız)
- **Görüntüleme:** Tek kart modu — dropdown seçimi + canvas render + PNG download
- **Veri kaynağı:** `agent-cards/js/JSON/agents.json` — 15 gerçek agent (CLAUDE.md listesinden)
- **Canvas boyutu:** 612×792 (mevcut D&D kartlarıyla aynı, standart kart boyutu)

## Kart layout — Portrait model (v2)

Referans projeler:
- **DnDGen card-script.js**: backgroundImage + characterImage iki katman sistemi → iki tier image resolution eklendi (agent-specific → category → gradient)
- **lor-card-maker**: unit.js / spell.js / champion.js her kart tipi ayrı component → `switch(category)` dispatch ile 4 farklı template

```
Draw() → DrawCardBase + DrawPortrait + DrawFade (shared)
       → switch(category) → _templateDesign / _templateDev / _templateQA / _templateUtility
       → DrawFooter + DrawBorder (shared)
```

### Template özelliği per kategori

| Kategori | Özel element |
|----------|-------------|
| design   | Diagonal paint-stroke köşesi, sol accent bar, 2-kolon grid capability chips |
| dev      | Terminal header bar (macOS dots + monospace), grid overlay, `// ARAÇLAR` prefix, Consolas font |
| qa       | Diagonal warning stripe, shield arka plan motifi, checkbox-style liste, alert bar |
| utility  | Corner bracket geometry, numbered circle capabilities |

### Image resolution (2 tier — DnD cardsources.json ilhamı)
1. `images/agents/{id}.jpg` — agent-specific portrait
2. `images/categories/{category}.jpg` — category fallback
3. Gradient (radial + linear) — son fallback

### Batch Export
`BatchExport()` metodu eklendi: tüm agentları sırayla render → download (lor-card-maker batch-renderer ilhamı). "⬇ Tümünü İndir" butonu HTML'e eklendi.

## Renk sistemi

Her agent `accentColor` ve `gradientEnd` alanlarına sahip:
- design: `#8B5CF6` (mor)
- dev: `#0EA5E9` / `#10B981` (mavi/yeşil)
- qa: `#EF4444` (kırmızı) / `#A78BFA` (lila)
- utility: `#64748B` / `#F8CA00` / vb.

## Dosya yapısı

```
agent-cards/
├── agent-cards.html
├── css/agent-cards-style.css
├── js/
│   ├── agent-cards-script.js  (AC objesi — Init, Make, Draw, Download)
│   └── JSON/agents.json
└── images/backgrounds/        (henüz boş — CSS gradient ile çalışıyor)
```

## UI dinamizmi

Seçilen agent'ın `accentColor`'u CSS custom property olarak DOM'a yansıtılıyor; download butonu rengi de dinamik değişiyor.

## Bağımlılıklar

- `../dnd/js/jquery-3.4.1.min.js` — mevcut dosyadan referans (kopya yok)
- PNG download: native `canvas.toDataURL()` → `<a>` click (FileSaver kullanılmadı)

## "Tüm promptları karta" genişlemesi (2026-05-29)

Modül 15 küratörlü agent'tan **4.587 scraped prompt**'a ölçeklendi:

- **Scraper** (`scraper/scrape-agents.js`) 12 kaynaktan toplar → `scraped-agents.json`. **normalize.js** kart şemasına çevirir → `normalized-agents.json` (4.587).
- **normalize.js zenginleştirildi:** her agent'a `imagePrompt` (kategori→arketip + isim/tag motif sözlüğü), `gradientEnd` (accent'in HSL-darken hali), `sigLabel`, ve prompt başlıklarından türetilen daha zengin `capabilities`/`tools` eklendi.
- **browse.html** = 4.587 promptluk arama/filtre/pagination kütüphanesi; mini-kartlar premium yapıldı (üstte görsel/prosedürel-gradient art-şeridi + emoji, altta UPPERCASE isim + capability chip). Modaldan `agent-cards.html?agent=ID` köprüsü.
- **Prosedürel fallback:** görseli olmayan kartlar `art-blur-polygon.js`'teki `DrawProceduralBackdrop` ile dolu görünür (accent→gradientEnd diagonal gradient + radial bloom + kategori motifi: dev=grid, design=arc, qa=scan stripe, utility=dot).
- Görsel üretimi için bkz. [[reference-imagen-generation]]. Ayrıca `scripts/lib/derive-subject.js` LLM-tabanlı subject türetici mevcut.
- **On-demand üretim sunucusu:** `scripts/serve.js` (Express) `npx http-server`'ı değiştirir; `/api/generate-card?id=<id>` endpoint'i browse'daki "✨ Kartı Üret" butonundan tetiklenir → cache kontrol → findAgent → withLock (tek seferde 1 üretim) → imagePrompt (curated) veya `deriveSubject` (scraped) → buildPrompt → generateValidated → diske yaz → `agent-cards.html?agent=ID` açılır. browse fetch'inde 180sn AbortController timeout, cache eşiği 8KB, üretilen `.jpg`'lerde uzun Cache-Control.
- **Veri kalitesi QA pass'i:** normalize.js iyileştirildi — `skipTags` daraltıldı (capabilities zenginleşti), `TOOL_KEYWORDS` gevşetildi (default-tool oranı %81→%74), `KEYWORD_MOTIFS`'e utility motifleri + `buildImagePrompt`'a id-seed'li varyasyon eklendi (distinct imagePrompt 124→3526, generic fallback 1119→317). `['System Prompt']` floor'u 12 (yapısız role-play prompt'ları).

[[user-profile]]
