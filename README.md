# Burracando

Segnapunti per il Burraco, in italiano, pensato per il telefono.

- **Regole**: riassunto dei due Codici di Gara FIBUR 2018 (italiano e internazionale, testi completi in `regolamento-italiano.md` e `regolamento-internazionale.md`) più la variante casalinga senza semipulito, con articoli ed esempi.
- **Chiedi**: chat sul regolamento con Claude (modello `claude-opus-5-5`, SDK ufficiale caricato da CDN). Serve la chiave API dell'utente, salvata solo nel browser e inviata solo ad api.anthropic.com; i regolamenti sono nel prompt di sistema con prompt caching.
- **Partite** a 2 (uno contro uno), 3 (tutti contro tutti) o 4 giocatori (due coppie).
- **Manche**: calcolatrice guidata (burrachi, punti a terra e in mano, chiusura, pozzetto, conta carte) oppure totale a mano; storico modificabile e totali.
- **Traguardo**: 2005 di default, scelta rapida 1005/1505/2005/3005 o valore libero, modificabile anche a partita iniziata.

App a file singolo (`index.html`), dati salvati sul dispositivo. È una PWA installabile: se aggiungi o rinomini file, aggiorna `FILE_APP` e `VERSIONE` in `sw.js`.

Link: https://marcopap73.github.io/Burracando/
