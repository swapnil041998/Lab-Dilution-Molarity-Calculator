# Lab Dilution & Molarity Calculator: Project Plan

A web calculator for everyday lab work: how much solid to weigh, how much stock
to pipette, and how to set up a dilution series. It is built for students and
working lab staff in life science, biotech, microbiology, chemistry, pharma,
food, environmental, agriculture and waste-treatment labs.

Every result shows its working, so it can be checked and copied into a lab
notebook.

## Principles

1. **Most wrong solutions come from wrong inputs, not wrong arithmetic.** The
   app must catch the wrong chemical form (hydrate vs anhydrous), a concentrated
   acid treated as pure, and a misread dilution ratio.
2. **Output is a procedure, not just a number.** For example: weigh, dissolve in
   about 80% of the final volume, adjust pH, bring to volume, mix, label.
3. **Every number carries its unit type** (amount, mass, volume, molar
   concentration, mass concentration, ratio, cells or activity per volume). The
   engine refuses to combine incompatible values unless an MW or density
   connects them.
4. **One app, two modes.** Quick mode shows results first, compactly, for
   professionals. Learn mode shows the full working, explanations and
   significant-figure rules, for students.
5. **Traceable and private.** Every constant shows its source. Everything runs
   in the browser and no data leaves it.

## Scope

### v1.0 core

- **Molarity from a solid:** `m = C × V × MW`, with purity correction and
  chemical form selection.
- **Dilution:** `C1·V1 = C2·V2` for any concentration type (molar, mass, %, ×,
  U/mL, cells/mL).
  - Default instruction is "bring to final volume"; "about X mL of diluent" is
    an approximation only.
  - Automatic two-step plan when the stock volume is too small to pipette.
  - "1:10" is always spelled out: "1 part stock + 9 parts diluent (dilution
    factor 10)", with a setting to switch convention.
- **Liquid stocks:** % w/w + density → molarity (e.g. 37% HCl ≈ 12.1 M). The
  user confirms the assay and density from the label. The output always
  includes an "add acid to water" step.
- **Molecular weight:** formula parser, curated reagent library, and custom
  reagents.
- **Unit conversions:** M ↔ mg/mL ↔ % ↔ ppm/ppb ↔ ×.
- **Lab-practical warnings:**
  - pipette suggestion, with a warning near the bottom of a pipette's range
  - minimum weighable mass per balance
  - impossible dilutions (C2 > C1, V1 > V2)
- **Show work** using dimensional analysis, with the units cancelling.

### v1.1 workflows

- Serial dilutions: by dilution factor, 2-fold/10-fold/half-log, equal final
  volume per tube.
- Calibration standard series from one stock.
- Recipe builder and scaler with a built-in recipe library (PBS, TBS, TAE, TBE,
  TE, 0.5 M EDTA pH 8, 1 M Tris-HCl, Laemmli, RIPA, LB, SOC, M9, MS medium,
  Hoagland, KHP COD standard, ...).
- Buffer calculator: Henderson–Hasselbalch with a pKa table and temperature
  correction.
- Form swap: "the recipe says anhydrous, I have the heptahydrate" → corrected
  mass.
- Concentration "expressed as": N, P, P₂O₅, K₂O, CaCO₃, available chlorine, and
  metal standards from their salts.

### v1.2 field tools

- Biology/microbiology: CFU/mL from plate counts, cell seeding, 1000× antibiotic
  stocks, DNA/RNA ng ↔ pmol, primer resuspension, ligation ratios, protein
  mg/mL ↔ µM (kDa).
- Chemistry/pharma: normality and mEq, osmolarity, alligation (mixing two
  strengths), ratio strength (1:1000).
- Molality and mole fraction.

### v2 teaching and lab management

- Learn panels (worked example and common mistakes per calculator), practice
  mode, significant-figure teaching mode.
- Printable prep sheets and bottle labels (name, concentration, date, preparer,
  lot, expiry, hazard flag, app and data version).
- Offline mode, 96-well plate layouts, Beer–Lambert.

### Out of scope

GMP / 21 CFR Part 11 validation, inventory or LIMS, user accounts, and writing
our own hazard text (the app links to the SDS instead).

## Reagent library

"Every reagent that exists" can't be shipped: PubChem alone has over 100 million
compounds, and a large unchecked list is dangerous. The library has four layers:

1. **Curated built-in library:** about 500 checked entries at launch, covering
   all fields above.
2. **Formula parser:** any compound with a known formula works.
3. **Online PubChem lookup** by name or CAS, marked "external, confirm the form
   on your bottle".
4. **Custom reagents:** saved by the user; exported and imported as a file so a
   lab can share one list.

**Each entry holds:** name, synonyms, formula, form (anhydrous, hydrate or
salt), MW, CAS number, field tags, physical state, density and assay % for
liquids, pKa for buffers, typical stock and working concentrations, notes
(hygroscopic, light-sensitive, prepare fresh), and a hazard flag with an SDS
link.

**Reagents with no defined MW** (agar, agarose, tryptone, yeast extract,
peptone, PEG, Tween, polyaluminium chloride) are handled in % and g/L only.

**Data checks:** an automated test recalculates every MW from its formula and
fails on any mismatch. CAS numbers and physical data are cross-checked against
PubChem during compilation. A domain expert spot-checks a sample before v1.0.

## Tech stack

- TypeScript + React + Vite: a static single-page app with no backend.
- Vitest for unit tests; Playwright for end-to-end smoke tests (added with the
  first real UI).
- oxlint for linting, Prettier for formatting.
- GitHub Actions: lint, format check, type-check, test and build on every push;
  deploy to GitHub Pages from `main`.
- Standard floating-point numbers, rounded only for display.

## Architecture

```
src/
  core/      pure calculation code, no UI imports
  data/      reagents, recipes, pKa table (typed data files, validated in CI)
  ui/        components and calculator tabs
docs/        this plan
```

All chemistry and unit math lives in `src/core/`, so it is fully unit-testable.

## Testing

- Hand-checked reference problems covering the problem types in standard texts
  (Harris, _Quantitative Chemical Analysis_; Seidman & Moore, _Basic Laboratory
  Methods for Biotechnology_; Adams, _Lab Math_).
- Library integrity: MW recalculated from formula, no duplicate CAS numbers,
  required fields present.
- Known traps:
  - hydrate swaps
  - 37% HCl → 12.1 M
  - both "1:10" conventions
  - 150 colonies at 10⁻⁶ from 0.1 mL → 1.5 × 10⁹ CFU/mL
  - mismatched units rejected
- Round-trip tests: solve for X, feed the result back, recover the inputs.

## Milestones

- [x] **M1 Project setup:** Vite/React/TS scaffold, lint, format, tests, CI,
      Pages deploy workflow, this plan.
- [x] **M2 Calculation engine:** units with unit types, molarity, dilution,
      liquid stocks, formatting, plus tests.
- [x] **M3 Reagent data v0:** schema, formula parser, the ~150 most-used
      reagents, integrity tests.
- [x] **M4 v1.0 app:** core calculators, show work, warnings, procedure output,
      Quick/Learn modes; deploy.
- [ ] **M5 Library to ~500 entries,** custom reagents, PubChem lookup.
- [ ] **M6 v1.1 workflows.**
- [ ] **M7 v1.2 field tools.**
- [ ] **M8 v2 teaching and lab management.**

## Disclaimer

This tool is not a validated GMP system. Verify critical preparations
independently and consult the Safety Data Sheet (SDS) for every reagent.
