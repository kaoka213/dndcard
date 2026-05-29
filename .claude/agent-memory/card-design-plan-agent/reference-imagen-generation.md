---
name: reference-imagen-generation
description: Agent kart portrelerini Imagen ile üretme — Vertex AI auth, env, script bayrakları ve validation gözlemi
metadata:
  type: reference
---

# Imagen Görsel Üretim Ortamı (agent-cards)

Agent kart portreleri `scripts/generate-agent-images.js` ile üretilir (model `imagen-4.0-generate-001`), `scripts/lib/prompt-template.js` (`buildPrompt`) + `scripts/lib/validate-image.js` (Gemini Vision 6-kriter validation) kullanır. Çıktı: `agent-cards/images/agents/{id}.jpg`.

## Auth — Vertex AI (kullanıcının tercihi)

- `.env`: `GOOGLE_CLOUD_PROJECT=agent-deck-497810`, `GOOGLE_CLOUD_LOCATION=us-central1`. Script `GOOGLE_CLOUD_PROJECT` varsa otomatik Vertex moduna geçer.
- **ADC zaten kurulu** — `%APPDATA%\gcloud\application_default_credentials.json` mevcut, `quota_project_id=agent-deck-497810`, geçerli token dönüyor. Yeni `gcloud auth application-default login` gerekmez.
- `gcloud` PATH'te DEĞİL; tam yol: `C:\Users\Furkan Berk\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd`. PowerShell'den `& $gcloud ...` ile çağrılır.
- Alternatif: `GOOGLE_API_KEY` ile AI Studio modu (Vertex yoksa).

## Script bayrakları (pool-bazlı, resume'lu)

`--source curated|normalized` · `--category` · `--source-repo <substr>` · `--limit N` · `--id` · `--force` · `--no-validate`. Varsayılan sadece görseli eksik olanları işler → tekrar çalıştırınca kaldığı yerden devam.

## Validation gözlemi (önemli)

Gemini Vision validation `topPadding` kriterinde ÇOK katı; Imagen-4 figürün üstünü sık sık üst kenara yakın üretiyor → 3 deneme de FAIL olup "partial" kaydediliyor. Kart üst 370px'i crop'ladığı için partial görseller yine de kullanılabilir. Kalite gerekiyorsa `prompt-template.js`'teki framing direktiflerini güçlendir veya validation'ı gevşet.

[[project-agent-cards]]
