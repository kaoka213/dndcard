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

## Kart layout (canvas render sırası)
1. Gradient background (accent rengi → koyu alt)
2. Radial glow (üst merkez)
3. Nokta doku overlay
4. Header: emoji (64px) + agent adı (bold, ~34px) + kategori badge (pill)
5. Separator line
6. Description (word-wrapped, ~13px, gri)
7. YETENEKLER section (label + bullet points)
8. ARAÇLAR section (label + pill chips, satır wrap'li)
9. Footer (@agent-id + "Claude Code Agent")
10. Border (accent rengi, yarı saydam)

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

[[user-profile]]
