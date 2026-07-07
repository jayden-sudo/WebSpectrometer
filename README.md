# Web Spectrometer

**English** | [简体中文](docs/README.zh-CN.md) | [繁體中文](docs/README.zh-TW.md) | [Italiano](docs/README.it.md) | [Français](docs/README.fr.md) | [Português](docs/README.pt.md)

A DIY spectrometer application — a fork of [Theremino Spectrometer](https://www.theremino.com/en/downloads/automation#spectrometer) V5.0 that runs in your browser.

**▶ Try it now: [spectrometer-web.vercel.app](https://spectrometer-web.vercel.app/)** — no installation, just open it in Chrome.

![Fluorescent lamp emission spectrum](docs/images/screenshot1.png)

*Fluorescent lamp emission spectrum: after calibrating the wavelength axis with the 436/546 nm mercury lines, peak positions are labeled automatically; the Info window on the right shows live parameters*

![White LED continuous spectrum](docs/images/screenshot2.png)

*White LED continuous spectrum (Chinese UI): the 450 nm blue excitation peak and the broad phosphor band are clearly visible; the sensor's raw image strip is shown at the top*

## Motivation

Professional spectrometers are expensive, so many DIY enthusiasts build their own from a CCD camera and a diffraction grating. The most acclaimed companion software is Theremino Spectrometer — but it only runs on Windows. This project brings the same capabilities to the browser: open a web page, connect a camera, and use it on Linux, macOS, or Windows, so more people can enjoy DIY spectrometry.

## What it does

It converts the spectral image captured by a webcam (or a TCD1304/TCD1254 linear sensor over serial) into a live spectrum curve, useful for:

- Light source analysis: measuring emission lines of fluorescent lamps, LEDs, lasers, etc.
- Wavelength calibration: multi-point calibration (Trim points) against the 436/546 nm mercury lines of a fluorescent lamp
- Data logging: save spectra as CSV/TXT (file-compatible with the Windows Theremino Spectrometer), timed/repeated auto-save, image export

Main features: real-time filtering pipeline (averaging, rising/falling speed, spatial averaging, reference/background), peak/dip detection with labels, wavelength coloring, logarithmic scale, irradiance correction, and a 6-language UI. Only the latest Chrome is required.

## Quick start

```bash
npm install
npm run dev      # local development
npm run build    # build output in dist/
```

Deployment: import the repo into Vercel for zero-config hosting (camera access requires HTTPS, which Vercel provides by default).

First use: after connecting the camera, follow the prompt to calibrate with a fluorescent lamp (Tools → Trim points → Fluorescent 436 546, then drag the 436/546 labels at the top onto the mercury lines).

## About the domain

This app deliberately lives on Vercel's free domain — [spectrometer-web.vercel.app](https://spectrometer-web.vercel.app/) — instead of a custom one. My concern is that years from now I might forget to renew a purchased domain, and every link to this project would silently die; the free subdomain stays alive as long as the project does. That said, if anyone would like to offer a short domain, I'd be very happy to use it — [DM me](https://x.com/jayden_sudo).

## License

GNU GPL v3. This project is an independent, browser-based fork of Theremino Spectrometer V5.0 and is not affiliated with Theremino System.

## Acknowledgements

Special thanks to [www.theremino.com](https://www.theremino.com) — the Theremino project generously publishes all of its source code and documentation under a "No Copyright" policy. Without their outstanding work on open-source scientific instruments, this project would not exist.
