# Web Spectrometer

[English](../README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | **Italiano** | [Français](README.fr.md) | [Português](README.pt.md)

Un'applicazione per spettrometri DIY — un fork di [Theremino Spectrometer](https://www.theremino.com/en/downloads/automation#spectrometer) V5.0 che funziona nel browser.

**▶ Provalo subito: [spectrometer-web.vercel.app](https://spectrometer-web.vercel.app/)** — nessuna installazione, basta aprirlo in un browser basato su Chromium (Chrome, Edge, Opera…).

🔒 **Privacy**: tutta l'elaborazione delle immagini avviene localmente nel tuo browser — nessun dato viene mai caricato.

![Spettro di emissione di una lampada fluorescente](images/screenshot1.png)

*Spettro di emissione di una lampada fluorescente: dopo la calibrazione dell'asse delle lunghezze d'onda con le righe del mercurio a 436/546 nm, i picchi vengono etichettati automaticamente; la finestra Info a destra mostra i parametri in tempo reale*

![Spettro continuo di un LED bianco](images/screenshot2.png)

*Spettro continuo di un LED bianco (interfaccia cinese): il picco di eccitazione blu a 450 nm e la banda larga dei fosfori sono chiaramente visibili; in alto la striscia dell'immagine grezza del sensore*

## Motivazione

Gli spettrometri professionali sono costosi, perciò molti appassionati DIY se ne costruiscono uno con una telecamera CCD e un reticolo di diffrazione. Il software di riferimento più apprezzato è Theremino Spectrometer — ma funziona solo su Windows. Questo progetto porta le stesse funzionalità nel browser: basta aprire una pagina web e collegare una telecamera per usarlo su Linux, macOS o Windows, così che più persone possano divertirsi con la spettrometria DIY.

## A cosa serve

Converte in tempo reale l'immagine spettrale catturata da una webcam (o da un sensore lineare TCD1304/TCD1254 via seriale) in una curva spettrale, utile per:

- Analisi delle sorgenti luminose: misura delle righe di emissione di lampade fluorescenti, LED, laser, ecc.
- Calibrazione delle lunghezze d'onda: calibrazione multipunto (Trim points) sulle righe del mercurio a 436/546 nm di una lampada fluorescente
- Registrazione dati: salvataggio degli spettri in CSV/TXT (file compatibili con Theremino Spectrometer per Windows), salvataggio automatico temporizzato/ripetuto, esportazione immagini

Funzionalità principali: pipeline di filtraggio in tempo reale (media, velocità di salita/discesa, media spaziale, riferimento/fondo), rilevamento di picchi e valli con etichette, colorazione per lunghezza d'onda, scala logaritmica, correzione di irradianza e interfaccia in 6 lingue. Funziona in qualsiasi browser basato su Chromium (Chrome, Edge, Opera…); Firefox e Safari non sono supportati perché privi di Web Serial.

## Avvio rapido

```bash
npm install
npm run dev      # sviluppo locale
npm run build    # output di build in dist/
```

Distribuzione: importa il repository in Vercel per un hosting senza configurazione (l'accesso alla telecamera richiede HTTPS, fornito da Vercel per impostazione predefinita).

Primo utilizzo: dopo aver collegato la telecamera, segui il suggerimento per calibrare con una lampada fluorescente (Strumenti → Trim points → Fluorescent 436 546, poi trascina le etichette 436/546 in alto sulle righe del mercurio).

## Nota sul dominio

Questa app usa deliberatamente il dominio gratuito di Vercel — [spectrometer-web.vercel.app](https://spectrometer-web.vercel.app/) — invece di un dominio personalizzato: temo che tra qualche anno potrei dimenticare di rinnovare un dominio acquistato, e tutti i link a questo progetto smetterebbero silenziosamente di funzionare; il sottodominio gratuito invece resta attivo finché esiste il progetto. Detto questo, se qualcuno volesse offrire un dominio breve, ne sarei felicissimo — [scrivimi in DM](https://x.com/jayden_sudo).

## Licenza

GNU GPL v3. Questo progetto è un fork indipendente, basato su browser, di Theremino Spectrometer V5.0 e non è affiliato a Theremino System.

## Ringraziamenti

Un ringraziamento speciale a [www.theremino.com](https://www.theremino.com) — il progetto Theremino pubblica generosamente tutto il proprio codice sorgente e la documentazione con una politica "No Copyright". Senza il loro straordinario lavoro sugli strumenti scientifici open source, questo progetto non esisterebbe.
