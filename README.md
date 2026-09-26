# Meine Vercel-Webseiten

Private, responsive Übersicht für iPhone, iPad und PC. Projekte aus dem persönlichen Vercel-Konto und erreichbaren Teams werden bei jedem Öffnen neu geladen. Neue Projekte erscheinen ohne Aktualisierung des Codes. Die Kacheln führen zur verifizierten Produktionsdomain. Ohne Produktionsdomain wird ein Projekt ohne Link angezeigt. Die Kurzbeschreibung stammt aus dem Framework-Typ, denn die Vercel-Projektliste liefert keine redaktionellen Beschreibungen.

## Bereitstellung

Den Ordner als Vercel-Projekt mit Framework-Preset „Other“ bereitstellen. Unter Project Settings → Environment Variables für Production setzen:

- `VERCEL_TOKEN`: Vercel Access Token mit Leserechten auf alle gewünschten Projekte und Teams; nur serverseitig.
- `PORTAL_PASSWORD`: langes eigenes Passwort für diese private Übersicht.
- Optional `VERCEL_TEAM_IDS`: kommagetrennte Team-IDs, falls die Teamliste nicht automatisch verfügbar ist.

Nach dem Setzen der Variablen neu deployen. Die Anmeldung verwendet ein signiertes, sieben Tage gültiges HttpOnly-Cookie. Die Übersicht wird bei jedem Laden und per Knopf neu abgefragt. Private Zielseiten können zusätzlich ihre eigene Vercel-Anmeldung verlangen.
