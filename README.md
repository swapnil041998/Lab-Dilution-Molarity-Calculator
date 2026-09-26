# Lab Dilution & Molarity Calculator

A web calculator for everyday lab work: how much solid to weigh, how much stock
to pipette, and how to dilute a concentrated reagent. It is built for students
and working lab staff across life science, biotech, microbiology, chemistry,
pharma, food, environmental, agriculture and waste-treatment labs.

**Status:** the first version (v1.0 core) is complete. Next up are serial
dilutions, calibration standards, recipes and buffers (v1.1). See
[docs/PLAN.md](docs/PLAN.md) for the full plan and progress.

## What it does

- **Four calculators:**
  - **From a solid:** how much to weigh.
  - **Dilution:** C1·V1 = C2·V2, for any concentration unit (M, mg/mL, ×, %, U/mL, cells/mL).
  - **Serial dilution:** 2-fold, 10-fold, half-log or any factor, with the same volume in every tube, and a table of each tube's dilution and concentration.
  - **Concentrated liquid:** for reagents such as 37% HCl.
- **A library of 232 reagents** across nine fields. Each has its formula weight, the
  forms it comes in (anhydrous or hydrates), CAS number, density and assay for
  liquids, pKa for buffers, hazard flags and practical notes. Any other compound
  can be used by typing its formula.
- **Bench steps for every result** (weigh, dissolve, bring to volume, label),
  plus which pipette or balance to use. It warns about amounts too small to
  measure and plans a two-step dilution when needed.
- **"Show working"** with dimensional analysis for students. **Learn mode** adds
  explanations and common mistakes. **Quick mode** puts results first.
- **Runs entirely in the browser:** nothing you enter leaves your device. It works
  on phones and tablets, in light and dark themes.

## Development

Requires Node.js 22.12 or newer.

```sh
npm install        # install dependencies
npm run dev        # start the dev server
npm test           # run the tests once
npm run build      # type-check and build to dist/
```

Other checks, all run in CI on every push:

```sh
npm run lint          # oxlint
npm run format:check  # Prettier (npm run format to fix)
npm run typecheck     # TypeScript
npm run test:e2e      # end-to-end tests in a real browser (Playwright)
```

The end-to-end tests build the app and drive it in Chromium on desktop and
phone screen sizes, including automated accessibility scans (axe). Run
`npx playwright install chromium` once first, or point
`PLAYWRIGHT_CHROMIUM_PATH` at a Chromium you already have.

The reagent library is also cross-checked against PubChem whenever it
changes (`.github/workflows/verify-reagents.yml`). To run that check yourself
(it needs internet access):

```sh
node scripts/check-pubchem.ts
```

## Deployment

Every push to `main` is built and deployed to GitHub Pages by
`.github/workflows/deploy.yml`. Pages must be enabled once in the repository
settings (**Settings → Pages → Source: GitHub Actions**).

## Disclaimer

This tool is not a validated GMP system. Verify critical preparations
independently and consult the Safety Data Sheet (SDS) for every reagent.
