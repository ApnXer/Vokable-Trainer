# Vocab Trainer

A free, offline, Quizlet-style vocabulary trainer for Windows. No account, no cloud, with a fast Excel import and an MCP server so Claude can create and edit your study sets.

*Deutsch weiter unten. The app is available in English and German. Switch the language in **Settings**.*

## Features

- **Same layout as Quizlet:** a sidebar (Home, Your library, folders) and a set page with four study modes on top, a large flashcard preview and the term list below.
- **Flashcards:** flip with <kbd>Space</kbd>, <kbd>W</kbd>/<kbd>S</kbd> or <kbd>↑</kbd>/<kbd>↓</kbd>. With "Track progress", <kbd>A</kbd>/<kbd>←</kbd> means *still learning* and <kbd>D</kbd>/<kbd>→</kbd> means *know*. Afterwards you can keep practicing only the cards you missed. <kbd>R</kbd> reads aloud and <kbd>Ctrl+Z</kbd> undoes.
- **Learn:** multiple choice, true/false and written questions, which you can combine freely. A term counts as mastered only after passing every selected type. You get a checkpoint after each round. Typos are detected ("Almost – watch the spelling"), and there is an "I was right" override.
- **Test:** choose the number of questions, the answer direction and the question types (true/false, multiple choice, matching, written). The results show corrections, and you can study the missed terms directly.
- **Match:** a timed game with a personal best time.
- **Customizable:** accent color (mint by default, 8 presets plus any custom color), light, dark or follow Windows, flashcard text size, and English or German.
- Progress per card, star cards, text-to-speech per language, and search across all sets and terms.

## Install

Download `Vokabeltrainer Setup x.y.z.exe` from the Releases page, or build it yourself (see below). The installer is per-user. It adds desktop and Start menu shortcuts and starts the app. Windows SmartScreen may warn because the app is not code-signed. Click **More info → Run anyway**.

Your data lives in `%APPDATA%\Vokabeltrainer\db.json`. To back it up, copy that file.

## Adding vocabulary

1. **Create (+):** type terms and definitions. To fill many cards at once, **copy cells from Excel and press <kbd>Ctrl+V</kbd> in a card**. Rows and columns are spread across the cards. <kbd>Enter</kbd> jumps to the next card and <kbd>Ctrl+S</kbd> saves.
2. **Import:** paste text (separator between term and definition: auto, tab, comma or custom; between cards: new line, semicolon or custom), or open or drop an Excel file (`.xlsx`, `.xls`, `.ods`, `.csv`). Column A is the term, B the definition and C an optional example sentence. An Excel template can be saved from the import dialog.
3. **Export** from the "…" menu on a set: Excel, CSV, text or JSON.

## MCP server (give Claude access to your sets)

The installer ships `resources\mcp-server.cjs`. It uses the same data as the app, and changes show up in the open app immediately.

**Claude Desktop**: add this to `%APPDATA%\Claude\claude_desktop_config.json` (replace `YOURNAME`):

```json
{
  "mcpServers": {
    "vocab-trainer": {
      "command": "C:\\Users\\YOURNAME\\AppData\\Local\\Programs\\Vokabeltrainer\\Vokabeltrainer.exe",
      "args": ["C:\\Users\\YOURNAME\\AppData\\Local\\Programs\\Vokabeltrainer\\resources\\mcp-server.cjs"],
      "env": { "ELECTRON_RUN_AS_NODE": "1" }
    }
  }
}
```

This needs no separate Node.js. If Node.js is installed, `"command": "node"` with the same script path works too.

**Claude Code**:

```bash
claude mcp add vocab-trainer -- node "C:/Users/YOURNAME/AppData/Local/Programs/Vokabeltrainer/resources/mcp-server.cjs"
```

Tools: `list_sets`, `get_set`, `create_set`, `update_set`, `delete_set`, `add_cards`, `import_text`, `update_card`, `delete_card`, `search_cards`, `study_stats`, `export_set`.

## Development

```bash
npm install
npm run dev        # app with hot reload
npm test           # tests: text import, answer checking, data layer, Excel, MCP
npm run typecheck
npm run dist       # build the Windows installer into release/
```

Structure: `src/main` (Electron main process, file dialogs), `src/preload` (safe bridge), `src/renderer` (React UI, translations in `src/renderer/src/lib/i18n-de.ts`), `src/shared` (data store, Excel, text import, shared with the MCP server) and `src/mcp` (MCP server, bundled to `dist-mcp/mcp-server.cjs`).

Built with Electron, React, TypeScript, Vite, SheetJS and the Model Context Protocol SDK. Font: Figtree (OFL). Icons: Lucide (ISC).

---

## Deutsch

Kostenlose Quizlet-Alternative für Windows, offline und ohne Konto. **Sprache umstellen:** Einstellungen (unten links) → Sprache → Deutsch.

- **Installieren:** `Vokabeltrainer Setup x.y.z.exe` ausführen. Bei der SmartScreen-Warnung auf „Weitere Informationen → Trotzdem ausführen“ klicken.
- **Vokabeln eingeben:** Zellen in Excel kopieren und mit <kbd>Strg+V</kbd> in eine Karte einfügen, oder über „Importieren“ Text bzw. eine Excel-Datei laden. Spalte A ist der Begriff, B die Definition, C ein Beispielsatz.
- **Karteikarten:** Leertaste, W/S oder ↑/↓ drehen um. A/← heißt „noch am Lernen“ und D/→ heißt „gewusst“.
- **Anpassen:** Akzentfarbe (Standard Minzgrün), Hell/Dunkel/Wie Windows, Kartenschriftgröße, Sprache.
- **MCP-Server für Claude:** siehe Abschnitt „MCP server“ oben.

## License

MIT
