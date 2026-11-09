# Fanta 26/27

App personale per la rosa **Mantra** (Atletico Dalanus): rosa, formazione consigliata, partite, statistiche.
È una web app (PWA) pubblicata su GitHub Pages: **https://fedethe7-dot.github.io/FANTACALCIO-/**.
Esiste anche come app Android **Fanta** (APK costruito nel repository LeMieApp).

## Dati
I dati stanno solo nel foglio Google (Apps Script pubblicato come App web), mai in questo repository.
Al primo avvio: *Altro → Collegamento* → URL dello script (`…/exec`) e chiave.

## Funzioni principali
- **Carica voti**: file Excel di fantacalcio.it (`Voti_Fantacalcio_…_Giornata_N.xlsx`), anche più giornate insieme.
  I giocatori si abbinano per codice; il nome si usa solo la prima volta (poi il codice resta).
- **Formazione**: undici consigliato per ogni modulo Mantra, esclusi infortunati e squalificati.
- **Disponibilità**: dalla scheda giocatore (Disponibile / In dubbio / Infortunato / Squalificato);
  rossi e squalifiche per somma di gialli sono dedotti dai voti caricati.
- **Partite**: l'esito si calcola dai punti (soglia 66, un gol ogni 6: modificabili in Altro → Lega).
- **Bonus**: gol diverso per reparto, portiere imbattuto, malus fuori ruolo (Altro → Lega).
- **Backup**: Altro → Esporta backup Excel.

## File
`index.html`, `style.css`, `app.js` (tutta l'app), `sw.js` (funzionamento offline),
`xlsx.core.min.js` (SheetJS 0.20.3 per leggere/scrivere Excel), icone e `manifest.json`.

Ad ogni aggiornamento cambiare `CACHE` in `sw.js` e `VERSION` in `app.js`.
