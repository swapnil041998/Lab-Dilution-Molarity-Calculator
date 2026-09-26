# Lab Dilution & Molarity Calculator

A web calculator for everyday lab work: how much solid to weigh, how much stock
to pipette, and how to set up a dilution series. It is built for students and
working lab staff across life science, biotech, microbiology, chemistry, pharma,
food, environmental, agriculture and waste-treatment labs.

**Status:** early development. The project setup is done; the calculators are
being built milestone by milestone. See [docs/PLAN.md](docs/PLAN.md) for the
full plan and progress.

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
```

## Deployment

Every push to `main` is built and deployed to GitHub Pages by
`.github/workflows/deploy.yml`. Pages must be enabled once in the repository
settings (**Settings → Pages → Source: GitHub Actions**).

## Disclaimer

This tool is not a validated GMP system. Verify critical preparations
independently and consult the Safety Data Sheet (SDS) for every reagent.
