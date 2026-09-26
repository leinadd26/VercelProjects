# Meine Webseiten

Private, responsive Übersicht im hellen Vercel-Stil für iPhone, iPad und PC. Vercel-Projekte, aktivierte GitHub-Pages-Sites und Firebase-Hosting-Sites werden bei jedem Öffnen live geladen. Die Listen werden nicht im Frontend fest eingetragen. Die Kacheln verlinken auf die jeweiligen Produktions-URLs; Favoriten bleiben lokal im Browser gespeichert.

## Bereitstellung

Den Ordner als Vercel-Projekt mit Framework-Preset „Other“ bereitstellen. Unter **Project Settings → Environment Variables** für Production setzen:

- `VERCEL_TOKEN`: Vercel Access Token mit Leserechten auf alle gewünschten Projekte und Teams; nur serverseitig.
- `PORTAL_PASSWORD`: langes eigenes Passwort für diese private Übersicht.
- `GITHUB_USERNAME`: GitHub-Konto, standardmäßig `leinadd26`. Aktivierte GitHub-Pages-Sites in öffentlichen Repositories werden automatisch erkannt.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: optionaler JSON-Schlüssel eines Google Service Account mit nur lesenden Berechtigungen. Damit erscheinen Firebase-Hosting-Sites aus allen erreichbaren Firebase-Projekten. Erteile dem Dienstkonto Zugriff zum Auflisten der Firebase-Projekte und die Berechtigung `firebasehosting.sites.list` auf den Hosting-Projekten.
- `GITHUB_TOKEN`: optionales Fine-grained GitHub Token, wenn auch private GitHub-Repositories geprüft werden sollen. Erteile nur **Metadata: read** und **Pages: read** für die gewünschten Repositories.
- `VERCEL_TEAM_IDS`: optional kommagetrennte Team-IDs, falls die Teamliste nicht automatisch verfügbar ist.

Die beiden JSON-/Token-Werte bleiben serverseitige Vercel-Umgebungsvariablen und gehören weder in den Quellcode noch in den Browser. Nach dem Ändern von Umgebungsvariablen in Vercel neu deployen. Ohne Firebase-Zugang zeigt das Dashboard die Vercel- und öffentlichen GitHub-Pages-Sites und markiert, dass Firebase noch verbunden werden muss.

Die Anmeldung verwendet ein signiertes, sieben Tage gültiges HttpOnly-Cookie. Jede Abfrage und der Refresh-Knopf laden die Quellen erneut.
