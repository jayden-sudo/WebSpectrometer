# Web Spectrometer

[English](../README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Italiano](README.it.md) | **Français** | [Português](README.pt.md)

Une application de spectromètre DIY — un fork de [Theremino Spectrometer](https://www.theremino.com/en/downloads/automation#spectrometer) V5.0 qui fonctionne dans le navigateur.

**▶ Essayez-le maintenant : [spectrometer-web.vercel.app](https://spectrometer-web.vercel.app/)** — aucune installation, ouvrez-le simplement dans Chrome.

![Spectre d'émission d'une lampe fluorescente](images/screenshot1.png)

*Spectre d'émission d'une lampe fluorescente : après calibration de l'axe des longueurs d'onde sur les raies du mercure à 436/546 nm, les pics sont étiquetés automatiquement ; la fenêtre Info à droite affiche les paramètres en temps réel*

![Spectre continu d'une LED blanche](images/screenshot2.png)

*Spectre continu d'une LED blanche (interface chinoise) : le pic d'excitation bleu à 450 nm et la large bande des luminophores sont clairement visibles ; en haut, la bande d'image brute du capteur*

## Motivation

Les spectromètres professionnels coûtent cher, aussi de nombreux passionnés de DIY en construisent un avec une caméra CCD et un réseau de diffraction. Le logiciel compagnon le plus réputé est Theremino Spectrometer — mais il ne fonctionne que sous Windows. Ce projet apporte les mêmes capacités au navigateur : ouvrez une page web, branchez une caméra, et utilisez-le sous Linux, macOS ou Windows, pour que davantage de personnes puissent profiter de la spectrométrie DIY.

## À quoi ça sert

Il convertit en temps réel l'image spectrale capturée par une webcam (ou un capteur linéaire TCD1304/TCD1254 via le port série) en une courbe spectrale, utile pour :

- Analyse de sources lumineuses : mesure des raies d'émission des lampes fluorescentes, LED, lasers, etc.
- Calibration en longueur d'onde : calibration multipoint (Trim points) sur les raies du mercure à 436/546 nm d'une lampe fluorescente
- Enregistrement de données : sauvegarde des spectres en CSV/TXT (fichiers compatibles avec Theremino Spectrometer pour Windows), sauvegarde automatique programmée/répétée, export d'images

Fonctionnalités principales : pipeline de filtrage en temps réel (moyenne, vitesse de montée/descente, moyenne spatiale, référence/fond), détection des pics et des creux avec étiquettes, coloration par longueur d'onde, échelle logarithmique, correction d'irradiance et interface en 6 langues. Seule la dernière version de Chrome est requise.

## Démarrage rapide

```bash
npm install
npm run dev      # développement local
npm run build    # sortie de build dans dist/
```

Déploiement : importez le dépôt dans Vercel pour un hébergement sans configuration (l'accès à la caméra nécessite HTTPS, fourni par défaut par Vercel).

Première utilisation : après avoir connecté la caméra, suivez l'invite pour calibrer avec une lampe fluorescente (Outils → Trim points → Fluorescent 436 546, puis faites glisser les étiquettes 436/546 en haut sur les raies du mercure).

## À propos du domaine

Cette application utilise délibérément le domaine gratuit de Vercel — [spectrometer-web.vercel.app](https://spectrometer-web.vercel.app/) — plutôt qu'un domaine personnalisé : je crains que, dans quelques années, j'oublie de renouveler un domaine acheté et que tous les liens vers ce projet cessent silencieusement de fonctionner ; le sous-domaine gratuit, lui, reste actif tant que le projet existe. Cela dit, si quelqu'un souhaite offrir un domaine court, j'en serais ravi — [contactez-moi en DM](https://x.com/jayden_sudo).

## Licence

GNU GPL v3. Ce projet est un fork indépendant, fonctionnant dans le navigateur, de Theremino Spectrometer V5.0 et n'est pas affilié à Theremino System.

## Remerciements

Un grand merci à [www.theremino.com](https://www.theremino.com) — le projet Theremino publie généreusement l'intégralité de son code source et de sa documentation sous une politique « No Copyright ». Sans leur travail remarquable sur les instruments scientifiques open source, ce projet n'existerait pas.
