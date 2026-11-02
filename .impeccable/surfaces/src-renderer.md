---
version: 1
slug: "src-renderer"
primary_target: "src/renderer"
related_targets: []
---

# Surface: Vokabeltrainer Desktop-App (alle Screens)

Mode: Operate. Audience: eine Schülerin/ein Schüler am eigenen Windows-PC, lernt Schulvokabeln, oft abends. Task: Sets anlegen (meist per Excel einfügen/importieren) und mit Karteikarten, Lernen, Test, Zuordnen lernen. Constraint: Anordnung wie Quizlet (vom Nutzer gepinnt), Deutsch, offline, Electron + React + TypeScript. Build path: code-led (keine Bildgenerierung verfügbar). Direction is brief-pinned (Quizlet-Anordnung), concept-seed not run because a user-pinned direction beats the roll.

## Direction contract

THESIS: Quizlets vertraute Anordnung, ohne Umgewöhnung: linke Navigationsleiste, Set-Seite mit Modus-Kacheln oben, großer Karteikarten-Vorschau darunter und Begriffsliste; Lernmodi als ablenkungsfreie Vollbild-Screens mit Modus-Umschalter oben links und Schließen oben rechts. Verweigert: generisches Karten-Dashboard mit Emoji-Kacheln und farbigen Seitenrändern.

OWN-WORLD: Kühles Off-White (#f6f7fb) mit weißen Flächen und weichen, versetzten Schatten; Navy-Text (#282e3e/#2e3856), Sekundär #586380; ein kräftiges Blau (#4255ff) für Primäraktionen, Fokus und Fortschritt; Orange (#ff983a) = „noch lernen“, Grün (#18ae79) = „gewusst“, Koralle für Fehler. Nachtmodus: tiefes Indigo (#0a092d) mit Navy-Flächen (#2e3856). Schrift: Figtree (selbst gehostet), geometrisch, freundlich. Lucide-Icons in einheitlicher Strichstärke. Radien 8px, Karten-Radius 8–12px.

STORY: Öffnen → „Zuletzt“ sehen → Set anklicken → Modus wählen oder direkt in der Vorschau blättern → lernen → Fortschritt (Orange/Grün-Zähler) sehen. Neue Vokabeln: „Erstellen“ → Excel einfügen oder Datei importieren → speichern.

FIRST VIEWPORT: Set-Seite: links 240px Sidebar (Start, Bibliothek, Ordner, Erstellen-Button). Oben Titel 32px fett. Darunter Reihe aus vier gleich hohen Modus-Buttons (Icon + Label) über volle Breite. Darunter die Vorschau-Karteikarte ~ 420px hoch, weiß, Begriff zentriert groß; darunter Steuerleiste: Pfeile mit Zähler „1 / 24“ mittig, Mischen/Vollbild rechts. Darunter „Begriffe in diesem Set (24)“ mit Zeilen Begriff | Definition, Stern und Lautsprecher rechts. Primäraktion: Modus-Buttons.

FORM: Quizlet-Kanon (vom Nutzer gepinnt), Position 1 von 1 (pinned), seed key: none (pinned direction). Signature move: die 3D-Flip-Karteikarte mit den Orange/Grün-Zählern im Fortschrittsmodus.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
