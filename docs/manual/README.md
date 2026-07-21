# User Manual

The source for **Dynasty Hub — User Manual.pdf**.

## Files

- `manual.template.html` — the manual's content and styling (the source of truth). Edit this to change the manual. It uses placeholders (`__VERSION__`, `__LOGO_MARK__`, `__INTER400__`…) that the generator fills in.
- `make-manual-pdf.js` — an Electron script that inlines the fonts + logo, stamps the current `package.json` version, and renders the template to PDF.

## Regenerating the PDF

```bash
npm run manual
```

This writes **`Dynasty Hub - User Manual.pdf`** to the repo root. Because the version is read from `package.json` at render time, bumping the app version and re-running is all it takes to keep the manual in sync.

## Notes

- The PDF is fully self-contained: the **Inter** font (`public/assets/fonts`) and the **Logo-mark** (`public/assets/Logo/Logo-mark.png`) are embedded as data URIs, so it renders identically anywhere and needs no network.
- Page size is US **Letter**; the design uses the app's black-and-gold identity and cut-corner motif.
- `manual.rendered.html` is a transient render input written and deleted by the generator — it is gitignored.
