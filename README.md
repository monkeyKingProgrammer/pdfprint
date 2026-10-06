# PrintCraft PDF

A desktop PDF printing utility for Windows with an accurate visual preview and control over page placement.

## Download

Download the latest Windows installer from the repository's [Releases](https://github.com/monkeyKingProgrammer/pdfprint/releases/latest) page.

## Features

- Fit, fill, actual-size, and custom scaling
- Independent top, right, bottom, and left margins in millimetres
- Horizontal and vertical page alignment, including one-click centring
- A4, A3, A5, Letter, and Legal paper sizes; portrait and landscape
- Page rotation, page ranges, current-page printing, copies, collation, color, and duplex controls
- Printer discovery and either a native print dialog or direct printing
- Draft through 300-DPI output rendering
- Multi-page preview navigation and printable-area guides

## Run it

```powershell
npm install
npm start
```

## Build a Windows installer

```powershell
npm run dist
```

The installer will be written to the `dist` folder. Duplex, color, and direct-print options depend on the selected printer and its driver.
