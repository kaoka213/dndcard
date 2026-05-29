---
name: feedback-parallel-fanout
description: Kullanıcı çok-parçalı işlerde paralel fan-out subagent takımı istiyor — dosya-ayrık workstream'lere böl
metadata:
  type: feedback
---

Çok-parçalı/çok-fazlı işlerde kullanıcı, işin **paralel fan-out subagent takımı** ile yürütülmesini açıkça tercih ediyor ("fazları paralel takım halinde yap, fan out subagents").

**Why:** Hız ve eşzamanlı ilerleme istiyor; tek tek sıralı çalışmaktansa fazları aynı anda ilerletmeyi seviyor.

**How to apply:** İşi **dosya-ayrık (file-disjoint) workstream'lere** böl ki aynı working tree'de çakışmadan paralel çalışsınlar. Her workstream'i tek mesajda eşzamanlı `general-purpose` subagent'lara dağıt (Edit/Write gerekiyorsa Explore yetmez). Her agent'a KESIN dosya sahipliği sınırı ver ("sadece şu dosyalar, başkasına dokunma"). Orkestratör olarak sen sonunda topla + çapraz doğrula (`node --check`, çakışma kontrolü, smoke test). Bu agent-cards modülünde işe yaradı: normalize.js / agent-cards-script.js+html / serve.js+browse-script.js olarak 3 ayrık workstream → sıfır çakışma.

Not: API/quota-bağımlı işleri (ör. tek Vertex quota'sını paylaşan toplu Imagen üretimi) paralelleştirme — hız kazandırmaz, 429 riskini artırır. Paralelliği CPU/IO-bağımsız kod workstream'lerine uygula.

[[project-agent-cards]] [[reference-imagen-generation]]
