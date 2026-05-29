---
name: reference-lor-card-anatomy
description: Legends of Runeterra kart görsel anatomisi — RuneterraFire + lor-card-maker kaynak kodundan öğrenilen tüm tasarım detayları
metadata:
  type: reference
---

# LoR Kart Görsel Anatomisi (RuneterraFire + lor-card-maker kaynak kodu)

RuneterraFire sitesi esas olarak bir veri tabanı/tablo arayüzü sunar (kart görsellerinden ziyade istatistikler). Asıl kart tasarım anatomisi **lor-card-maker kaynak kodundan** (unit.css, spell.css, keyword-renderer.css, unit.js) elde edildi.

## 1. Kart Boyutları

| Tip     | Tuval    | Notlar |
|---------|----------|--------|
| Unit/Champion/Follower | ~680 × ~1024px | card-text-wrapper: 680px wide |
| Spell   | ~680px   | Farklı iç layout |

## 2. Katman Sistemi (alt → üst)

```
1. Art       — tam karta yayılan veya dairesel resim, polygon clip
2. Art-blur  — aynı resmin altı bulanık kopyası (gradient mask ile)
3. Frame PNG — kart çerçevesi overlay (champion/frame1.png vb.)
4. Content   — mana, bölge ikonu, isim, keyword, efekt metni, güç/sağlık, nadirlik
```

## 3. Koordinat Haritası — Unit/Champion

| Element          | Left   | Top     | Width  | Height | Notlar |
|-----------------|--------|---------|--------|--------|--------|
| Cost gem         | 31px   | 44px    | 120px  | 120px  | Daire, font: 90px |
| Region frame     | 550px  | 37px    | 120px  | 360px  | Sağ kolon |
| Region icon      | auto   | —       | 80px   | 80px   | Her biri `margin-bottom: 10px` |
| Clan/Type badge  | 206px  | 56px    | 268px  | ≥69px  | Üst merkez, typing.png arka plan |
| Power (Attack)   | 44px   | 866px   | 86px   | 76px   | Alt-sol, font: 70px |
| Health           | 552px  | 866px   | 86px   | 76px   | Alt-sağ, font: 70px |
| Rarity gem       | 215px  | 942px   | 250px  | 90px   | Alt-merkez |
| Card name        | center | —       | 520px  | ≤70px  | UPPERCASE, font: 55px |
| Keyword row      | center | below name | 520px | — | |
| Effect text      | center | below kw  | 520px | — | |

## 4. Art Clip Polygon (Unit)

```js
clipPathPolygon = [
    [25, 50],    // üst-sol
    [655, 50],   // üst-sağ
    [655, 950],  // alt-sağ
    [340, 965],  // alt-merkez (V çentik)
    [25, 950],   // alt-sol
]
```
→ Alt kısmında hafif V şekli oluşturur.

## 5. Art Blur Tekniği

```css
.art.blur {
    filter: blur(15px) brightness(0.75);
    mask-image: linear-gradient(to bottom, transparent 50%, black 75%);
}
```
Aynı görsel iki kez render edilir: üst kısım netken, alt kısım (50%→75%) yavaşça bulanıklaşır ve karaya geçer. Bu sayede kart çerçevesi altındaki metin okunabilir olur.

## 6. Spell Kartı Farklılıkları

- Art: dikdörtgen değil, **480×480px DAIRESEL crop** (border-radius: 240px)
- Konum: left: 100px, top: 54px
- Text background: özel clip-path polygon (V-şekilli kesim üstte)
- Region icons: farklı konum ve dizilim (üst-sağ, çapraz)
- Power/Health: 429px yükseklikten (alt değil, orta-alt)

## 7. Keyword Badge Anatomisi (3-parçalı)

```
[left-cap 26.6×98.8px] [middle (var-width)×98.8px] [right-cap 26.6×98.8px]
         |                      |                           |
   keywordleft.png      keywordmiddle.png          keywordright.png
                    icon (52px) + text (48px, UPPERCASE, --effect-orange-text)
```

Keyword ikonları: `/Assets/keyword/{keywordName}.png` (quickattack, challenger, elusive vb.)

## 8. Tipografi

| Font | Kullanım |
|------|---------|
| `BeaufortforLOL-Bold` | Başlıklar, kart adı |
| `UniversforRiotGames-UltCond` | Keyword metinleri |
| `UniversforRiotGames-Regular` | Efekt metni |

Tüm başlıklar UPPERCASE.

## 9. Renk Değişkenleri

| Değişken | Kullanım |
|----------|---------|
| `--effect-white-text` | Kart adı, power/health rakamları |
| `--effect-blue-text` | Keyword arka plan rengi |
| `--effect-orange-text` | Keyword metin rengi |

## 10. Kart Tipleri ve Frame Varlıkları

| Tip | Frame | Region Box | Typing |
|-----|-------|------------|--------|
| Champion Lv1 | `champion/frame1.png` | `champion/lvl1regionbox{1-3}.png` | `typing.png` |
| Champion Lv2 | `champion/frame2.png` | `champion/lvl2regionbox{1-3}.png` | `typing-2.png` |
| Follower | `follower/frame.png` | `follower/regionbox{1-3}.png` | `follower/typing.png` |
| Spell (Burst) | `spell/frameburst.png` | `spell/regionbox{1-3}.png` | — |
| Spell (Fast)  | `spell/framefast.png` | ... | — |
| Spell (Slow)  | `spell/frameslow.png` | ... | — |
| Landmark | landmark frame | | |

## 11. Nadirlik İkonları

`/Assets/shared/gem{rarity}.png` → `gemcommon`, `gemrare`, `gemepic`, `gemchampion`

## 12. Bölge İkonları (9 bölge)

Noxus, Demacia, Freljord, Ionia, Piltover & Zaun, Shadow Isles, Bilgewater, Shurima, Targon, Bandle City, Runeterra (Runeterralı şampiyonlar için)

---

## Agent-Cards İçin Çıkarımlar

Şu an mevcut agent-cards sisteminden **öğrenilip uygulanabilecek LoR pattern'leri**:

1. **İki katmanlı art blur** — Portrait'ı iki kez çiz: üst netliken, alt kısım bulanık (LoR art.blur tekniği)
2. **Polygon art clip** — Portrait'ı dikdörtgen yerine V-çentikli polygon ile kırp (LoR clipPathPolygon)
3. **Cost gem** → Agent kartına "araç sayısı" veya "öncelik seviyesi" için sol-üst köşe gem'i
4. **Bottom stats köşeleri** → Sol-alt: yetenek sayısı, Sağ-alt: araç sayısı (LoR power/health)
5. **3-parçalı keyword chip** → Tool chip'lerini left-cap + content + right-cap şeklinde daha zengin yap
6. **Region icon stack** → Sağ kolona araç ikonları (küçük, dikey sıralı)
7. **Rarity gem bottom-center** → Agent kategorisini alt-merkez gem/rozet ile vurgula
8. **UPPERCASE tipografi** — Kart adı ve bölüm başlıkları tamamen büyük harf

[[project-agent-cards]]
