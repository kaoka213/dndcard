# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A static HTML + CSS + JavaScript collection of D&D 5e tools and a Fire Emblem: Awakening quote generator. No server-side logic — everything runs in the browser. JSON files under `dnd/js/JSON/` are the data source for all D&D generators.

## Running Locally

Open `index.html` directly in a browser, or start a local server to avoid browser JSON fetch restrictions:

```powershell
# Node.js
npx http-server -p 8080

# Python 3
py -3 -m http.server 8080
```

Then navigate to `http://localhost:8080/index.html`.

## Linting and Formatting

```powershell
npm run lint          # ESLint check
npm run lint:fix      # ESLint auto-fix
npm run prettier      # Prettier format all files
```

ESLint is configured for ES2015 modules in browser environments (`dnd/js/*.js`) and Node.js for config files. Extends `eslint:recommended`, `prettier`, and `plugin:import/recommended`.

## Architecture

Each tool is a self-contained HTML page with its own script file:

| Page | Script | Purpose |
|------|--------|---------|
| `dnd/dnd-char-gen.html` | `dnd/js/char-gen-script.js` + `dnd/js/card-script.js` | Character generator with visual card output |
| `dnd/dnd-magic-items.html` | `dnd/js/magic-item-script.js` | Magic item generator |
| `dnd/dnd-reference.html` | `dnd/js/reference-script.js` | Content reference browser |
| `dnd/dnd-statblock.html` | `dnd/js/statblock-script.js` | NPC statblock generator |
| `fea-quote-gen/fea-quote-gen.html` | `fea-quote-gen/quotegen-script.js` | FE:A quote generator |

All D&D scripts use jQuery (`dnd/js/jquery-3.4.1.min.js`) and load JSON data via `$.getJSON()` at page init. Global variables hold loaded data; generation functions pick from these pools using weighted or random selection.

## Data Files (`dnd/js/JSON/`)

- `races.json`, `classes.json`, `backgrounds.json` — character options with `_special` tags for book filtering
- `books.json` — controls which sourcebooks are available; scripts check `BookFunctions.CheckSpecial()` against user-selected books
- `names.json`, `life.json`, `other.json` — name tables and life event data used by char-gen
- `npcs.json`, `statblockdata.json` — NPC personality/statblock pools
- `magic-items.json`, `magic-item-homebrews.json`, `magic-item-specials.json` — magic item tables split by rarity/type
- `cardsources.json` — maps race+class combinations to card background and character portrait images

## Card Image Conventions

Character card images follow `dnd/dndimages/cardimages/characters/{race}/{class}.jpg`. Card backgrounds are at `dnd/dndimages/cardimages/cardbackgrounds/{class}.jpg`. When adding new races or classes, both the JSON data and corresponding image assets must be added.
