# THE CONSULTANT

Business-Simulation: Du baust eine KI- & Automatisierungsberatung in Deutschland auf – vom ersten Lead bis zum Wartungsvertrag.
Alle Unternehmen, Personen, Systeme und Zahlen sind **fiktiv** (Domains `.example`).

* Statische Web-App ohne Build-Schritt (ES-Module). Spielstand in `localStorage` hinter einem Adapter (`js/store.js`), später durch ein Backend ersetzbar.
* `js/arch.js` – Kampagnen, 28 Prozess-Archetypen (versteckte Betriebsmodelle), Persönlichkeiten, Komponentenkatalog, Fragen, Vorfälle
* `js/companies.js` – 39 Unternehmen (31 sichtbar, 8 per Netzwerk/Empfehlung/Jobportal/Inbound freischaltbar) + Generator
* `js/sim.js`, `js/sales.js`, `js/proj.js` – Simulationskern (Zeit, Ereignisse, Ansprache, Discovery, ROI, Angebot, Verhandlung, Projekte)
* `js/sites.js` – prozedurale Websites (7 Stile) · `js/apps/*` – Desktop-Apps
