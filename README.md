# Platzhirsch

Mandantenfähiges Reservierungssystem für Restaurants (Teams, Rollen, Raumplan, Zeitleiste, Einbindung auf der eigenen Seite).

- App: Vite + React + TypeScript, Daten und Anmeldung über Supabase (Projekt `platzhirsch`, Frankfurt)
- Datenbank: `supabase/migrations/` (Zeilen pro Team durch Row Level Security getrennt)
- Start: `npm install`, `npm run dev` (URL und öffentlicher Schlüssel von Supabase stehen in `.env`, der Schlüssel ist für den Browser gedacht)

Die klickbare Design-Vorschau (Raumplan, Zeitleiste) liegt als Artifact außerhalb dieses Repos.
