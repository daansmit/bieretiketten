# 🍺 Bieretiketten

**Bieretiketten** is een desktop-applicatie voor Sjef — een enthousiaste Nederlandse bieretikettenverzamelaar — om zijn collectie bij te houden en te bekijken.

De app is gebouwd met [Electron](https://www.electronjs.org/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) en [Vite](https://vitejs.dev/).

---

## ✨ Functies

- 📂 **Bestand openen** — laad een Excel-bestand (`.xlsx` / `.xls`) met bieretiketten
- 💾 **Onthoud laatste bestand** — het laatste bestand wordt automatisch heropend bij het starten
- 📊 **Tabel met filters** — bekijk alle etiketten in een sorteerbare tabel met vrije-tekst zoekfilters per kolom
- 🖼️ **Afbeeldingen per etiket** — klik op een rij om bijpassende afbeeldingen (JPG/PNG) en PDF-bestanden te bekijken die in dezelfde map staan als het Excel-bestand
- 🔍 **Lightbox** — klik op een afbeelding om hem vergroot te bekijken
- 🔄 **Automatische updates** — de app controleert op nieuwe versies via GitHub Releases

---

## 📋 Excel-bestandsstructuur

Het Excel-bestand bevat de volgende kolommen (in deze volgorde):

| naam | soort | brouwerij | plaatsnaam | land | alcohol | pagina | letter |
|------|-------|-----------|------------|------|---------|--------|--------|

### Koppeling afbeeldingen

Afbeeldingen worden gekoppeld op basis van het `pagina`-nummer. Bestanden waarvan de naam het paginanummer bevat (bijv. `042.jpg`, `42.jpg`, `p42.pdf`) worden automatisch getoond bij de betreffende rij.

---

## 🚀 Ontwikkeling

### Vereisten

- [Node.js](https://nodejs.org/) ≥ 18
- npm ≥ 9

### Installeren

```bash
npm install
```

### Starten (ontwikkelmodus)

```bash
npm run dev
```

### Bouwen

```bash
npm run build
```

### Distributie-pakket maken (macOS / Windows)

```bash
npm run dist
```

---

## 📦 Technologieën

| Pakket | Doel |
|--------|------|
| [electron](https://www.electronjs.org/) | Desktop-app raamwerk |
| [electron-vite](https://electron-vite.org/) | Vite-integratie voor Electron |
| [React](https://react.dev/) | UI-library |
| [TanStack Table](https://tanstack.com/table) | Tabelcomponent met sortering & filteren |
| [SheetJS (xlsx)](https://sheetjs.com/) | Lezen van Excel-bestanden |
| [electron-updater](https://www.electron.build/auto-update) | Automatische updates via GitHub |
| [electron-builder](https://www.electron.build/) | Pakkettering voor macOS en Windows |

---

## 📝 Licentie

Privégebruik — voor Sjef 🍺