# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Windows-Desktop-App: Electron + TypeScript + React (Vite). Installiert mit Desktop- und Startmenü-Symbol, läuft offline, kein lokaler Server und keine .bat zum Starten. Daten als JSON im Benutzerordner (`%APPDATA%/Vokabeltrainer/db.json`).

## Users

Eine Person (Schüler/in), die am eigenen Windows-PC Vokabeln für Schulfächer lernt, z. B. Englisch, Französisch und Latein.

## Product Purpose

Kostenloser, lokaler Ersatz für Quizlet: Vokabel-Sets anlegen und mit Karteikarten, Lernmodus (Multiple Choice, Richtig/Falsch, Schreiben), Tests und Zuordnen lernen. Erfolg heißt: Vokabeln schnell eingeben und ohne Umgewöhnung so lernen wie bei Quizlet.

## Positioning

Gratis, ohne Konto, offline, mit schneller Eingabe über Excel (Kopieren/Einfügen und Datei-Import) und einem MCP-Server, über den Claude Sets anlegen und bearbeiten kann.

## Operating Context

- Vokabeln werden meist in Excel geschrieben und dann eingefügt oder als .xlsx importiert.
- Lernen am Desktop mit Tastatur (Leertaste umdrehen, Pfeiltasten, Zahlentasten für Antworten).
- Claude (Desktop/Code) greift über den MCP-Server auf dieselbe Datenbank zu; die App muss Änderungen von außen übernehmen.

## Capabilities and Constraints

- Sets: Titel, Beschreibung, Sprache von Begriff und Definition (für Vorlesen), Ordner; Karten mit Begriff, Definition, optional Beispiel, Stern.
- Modi: Karteikarten, Lernen, Test, Zuordnen. Lernfortschritt pro Karte; Testverlauf.
- Import: Text (Tab/Semikolon/Komma/eigenes Trennzeichen), .xlsx/.xls/.ods/.csv; Export: .xlsx, .csv, .txt, .json.
- MCP-Server bleibt Teil des Produkts; Eintrag in Claude-Konfiguration nur per Anleitung, nicht automatisch.
- Oberfläche auf Deutsch.

## Brand Commitments

Aufbau und Anordnung der Hauptfunktionen wie bei Quizlet (vom Nutzer gewünscht), einfach verständlich, kein generischer „KI-Look“. Eigener Name „Vokabeltrainer“, keine Quizlet-Logos oder -Marken.

## Evidence on Hand

Keine echten Vokabeldaten im Projekt; keine Erfolgszahlen oder Testimonials erfinden.

## Product Principles

1. Eingeben muss schneller sein als in Quizlet: Excel einfügen funktioniert überall.
2. Vertraute Anordnung vor Originalität: wer Quizlet kennt, findet sofort alles.
3. Lernen ohne Ablenkung: im Lernmodus nur Frage, Antworten und Fortschritt.
4. Offline und privat: keine Konten, keine Cloud.
