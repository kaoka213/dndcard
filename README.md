# DNDCard Proje Dokumantasyonu

## Genel Bakis
Bu proje, tarayicida calisan birden fazla mini araci bir araya getiren statik bir koleksiyondur. Ana sayfadan D&D 5e icerikleri ve Fire Emblem: Awakening alinti ureticisine erisim verilir.
1
## Proje Mimarisi
Bu depo, statik HTML + CSS + JavaScript uzerine kurulu, sayfa odakli bir yapidir. Her arac kendi HTML sayfasina, ilgili stil dosyalarina ve kendi JavaScript dosyasina sahiptir.

- Sunucu tarafi yoktur; tum mantik tarayicida calisir.
- D&D icerikleri JSON veri dosyalarindan beslenir.
- Varliklar (gorseller, fontlar, css) ortak dizinlerde saklanir.

## Sayfa Bazli Moduller
- D&D icerik referansi: [dnd/dnd-reference.html](dnd/dnd-reference.html)
- D&D karakter uretici: [dnd/dnd-char-gen.html](dnd/dnd-char-gen.html)
- D&D buyulu esya uretici: [dnd/dnd-magic-items.html](dnd/dnd-magic-items.html)
- D&D statblock uretici: [dnd/dnd-statblock.html](dnd/dnd-statblock.html)
- Fire Emblem alinti uretici: [fea-quote-gen/fea-quote-gen.html](fea-quote-gen/fea-quote-gen.html)

## D&D Sayfalari Is Akisi (Adim Adim)
### Icerik Referansi
1) Kullanici [dnd/dnd-reference.html](dnd/dnd-reference.html) sayfasini acar.
2) Sayfanin JS dosyasi icerik listelerini JSON kaynaklarindan okur.
3) Filtreleme ve arama kontrolleri hazirlanir.
4) Secilen kategoriye gore icerik listesi DOM uzerinde guncellenir.

### Karakter Uretici
1) Kullanici [dnd/dnd-char-gen.html](dnd/dnd-char-gen.html) sayfasini acar.
2) JS katmani irk, sinif, arkaplan ve isim listelerini JSON dosyalarindan yukler.
3) Uretim kurallari calisir ve rastgele karakter verisi olusturulur.
4) Karakter ozeti ve varsa gorsel kart DOM uzerinde guncellenir.
5) Kullanici yeni uretim icin aksiyon alir; akış tekrarlar.

### Buyulu Esya Uretici
1) Kullanici [dnd/dnd-magic-items.html](dnd/dnd-magic-items.html) sayfasini acar.
2) JS katmani buyulu esya havuzlarini JSON dosyalarindan yukler.
3) Secim/uretme kurallari calisir ve esya olusturulur.
4) Uretilen esya detaylari DOM uzerinde guncellenir.
5) Kullanici yeni uretim icin aksiyon alir; akış tekrarlar.

### Statblock Uretici
1) Kullanici [dnd/dnd-statblock.html](dnd/dnd-statblock.html) sayfasini acar.
2) JS katmani NPC ve statblock verilerini JSON dosyalarindan yukler.
3) Uretim kurallari calisir ve statblock olusturulur.
4) Statblock gorevleri ve ozellikleri DOM uzerinde guncellenir.
5) Kullanici yeni uretim icin aksiyon alir; akış tekrarlar.

## Giris Noktasi ve Sayfalar
- Ana giris sayfasi: [index.html](index.html)
- Bilgi sayfasi: [info.html](info.html)
- D&D 5e icerikleri:
  - Icerik referansi: [dnd/dnd-reference.html](dnd/dnd-reference.html)
  - Karakter uretici: [dnd/dnd-char-gen.html](dnd/dnd-char-gen.html)
  - Buyulu esya uretici: [dnd/dnd-magic-items.html](dnd/dnd-magic-items.html)
  - Statblock uretici: [dnd/dnd-statblock.html](dnd/dnd-statblock.html)
- Fire Emblem: Awakening alinti uretici: [fea-quote-gen/fea-quote-gen.html](fea-quote-gen/fea-quote-gen.html)

## Dizin Yapisi
- D&D sayfalari ve varliklari:
  - HTML dosyalari: [dnd/](dnd/)
  - Stil dosyalari: [dnd/css/](dnd/css/)
  - JavaScript dosyalari: [dnd/js/](dnd/js/)
  - Kart ve karakter gorselleri: [dnd/dndimages/](dnd/dndimages/)
  - Web fontlari: [dnd/webfonts/](dnd/webfonts/)
- Fire Emblem araci:
  - Sayfa: [fea-quote-gen/fea-quote-gen.html](fea-quote-gen/fea-quote-gen.html)
  - Stil: [fea-quote-gen/quotegen-style.css](fea-quote-gen/quotegen-style.css)
  - Script: [fea-quote-gen/quotegen-script.js](fea-quote-gen/quotegen-script.js)

## Bilesenler ve Sorumluluklar
- HTML sayfalari: Arayuz iskeleti, sayfa yerlesimi ve statik icerik.
- CSS dosyalari: Tema, tipografi ve responsive davranislar.
- JavaScript dosyalari: Veri okuma, uretim mantigi ve DOM guncellemeleri.
- JSON verileri: Secim listeleri ve icerik kaynagi.

## Veri Akisi
1) Kullanici sayfayi acar.
2) Ilgili sayfa JS dosyasi JSON verilerini yukler.
3) Uretim mantigi calisir ve DOM guncellenir.
4) Gorsel ve font varliklari sayfa tarafindan kullanilir.

## Veri Dosyalari
D&D icerikleri icin JSON verileri [dnd/js/JSON/](dnd/js/JSON/) altinda tutulur. Bu dosyalar irklar, siniflar, buyulu esyalar, NPC verileri ve benzeri listeleri icerir.

## Varliklar
- Kart arka planlari ve karakter gorselleri: [dnd/dndimages/](dnd/dndimages/)
- Fontlar: [dnd/webfonts/](dnd/webfonts/)

## Calistirma
Bu proje statik HTML oldugu icin dogrudan tarayicida acabilirsiniz:
- [index.html](index.html) dosyasini acin.

Isterseniz basit bir yerel sunucu ile de calistirabilirsiniz. Bu, tarayicinin JSON okuma izinleriyle ilgili sorunlari azaltir.

### Yerel Sunucu Kurulumu ve Ornek Komutlar
Asagidaki ornekler Windows PowerShell icindir.

Secekler:
- Node.js `npx` ile baslatma:
  - `npx http-server -p 8080`
- Python 3 ile baslatma:
  - `py -3 -m http.server 8080`

Sunucu basladiktan sonra tarayicida su adresi acin:
- `http://localhost:8080/index.html`

## Paket ve Script Bilgisi
Depoda [package.json](package.json) mevcut. Buradaki scriptler gelistirme ihtiyaclariniz icin kullanilabilir. Ornek scriptler:
- `lint`
- `lint:fix`
- `prettier`

Not: Scriptler proje yapisindan bagimsiz olabilir. Kullanmadan once gerekli araclarin kurulu oldugunu dogrulayin.

## Gelistirme Notlari
- D&D sayfalari icin ortak stiller [dnd/css/](dnd/css/) altinda bulunur.
- D&D uretim mantigi sayfa bazli JS dosyalarinda yer alir.
- JSON verileri guncellendikce uretim icerigi degisir; degisiklikler sayfaya yansir.
