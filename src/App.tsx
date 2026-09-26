import { useState } from 'react'
import { BufferCalculator } from './ui/calculators/BufferCalculator.tsx'
import { ConvertCalculator } from './ui/calculators/ConvertCalculator.tsx'
import { DilutionCalculator } from './ui/calculators/DilutionCalculator.tsx'
import { LiquidCalculator } from './ui/calculators/LiquidCalculator.tsx'
import { RecipeCalculator } from './ui/calculators/RecipeCalculator.tsx'
import { SerialCalculator } from './ui/calculators/SerialCalculator.tsx'
import { StandardsCalculator } from './ui/calculators/StandardsCalculator.tsx'
import { SolidCalculator } from './ui/calculators/SolidCalculator.tsx'
import { LearnPanel } from './ui/components/LearnPanel.tsx'
import { ModeSwitch } from './ui/components/ModeSwitch.tsx'
import { Tabs, type Tab } from './ui/components/Tabs.tsx'
import { ModeContext, loadMode, saveMode, type Mode } from './ui/mode.ts'

const TABS: readonly Tab[] = [
  {
    id: 'solid',
    label: 'From a solid',
    content: (
      <>
        <h2>Make a solution from a solid</h2>
        <p className="section-intro">
          How much to weigh, what volume to make, or what concentration you get:
          mass = concentration × volume × molar mass.
        </p>
        <LearnPanel
          ideas={[
            'Molarity (M) is moles of solute per litre of solution. Moles = mass ÷ molar mass, so mass = concentration × volume × molar mass.',
            'Use the formula weight (FW) of the exact form on your bottle: hydrates weigh more per mole, e.g. MgCl₂ is 95.21 g/mol but MgCl₂·6H₂O is 203.30 g/mol.',
            'The final volume is the volume of the whole solution, so dissolve the solid in less water first and then bring it to volume.',
          ]}
          mistakes={[
            'Using the anhydrous FW for a hydrate, or the other way round.',
            'Adding the solid to the full final volume of water, which gives a lower concentration than intended.',
            'Mixing up mM (millimolar, a molar concentration) and mg/mL (a mass concentration).',
          ]}
        />
        <SolidCalculator />
      </>
    ),
  },
  {
    id: 'dilution',
    label: 'Dilution',
    content: (
      <>
        <h2>Dilute a stock solution</h2>
        <p className="section-intro">
          How much stock to take, or what you end up with: C1 × V1 = C2 × V2.
        </p>
        <LearnPanel
          ideas={[
            'Diluting does not change the amount of solute, only the volume it is spread through, so C1 × V1 = C2 × V2.',
            'Put both concentrations in the same unit, and both volumes in the same unit, before you calculate.',
            'The dilution factor is C1 ÷ C2. A 1 in 10 dilution is 1 part stock in 10 parts total: 1 part stock + 9 parts diluent.',
          ]}
          mistakes={[
            'Adding V2 of diluent instead of bringing the total volume to V2.',
            'Reading "1:10" as 1 + 10 parts when the protocol means 1 in 10, or the reverse. Check how the protocol defines it.',
            'Pipetting volumes under 2 µL, which are imprecise: dilute in two steps instead.',
          ]}
        />
        <DilutionCalculator />
      </>
    ),
  },
  {
    id: 'serial',
    label: 'Serial dilution',
    content: (
      <>
        <h2>Make a serial dilution</h2>
        <p className="section-intro">
          A row of tubes, each diluted from the one before by the same factor:
          two-fold, ten-fold, half-log or any other. Every tube ends with the
          same volume.
        </p>
        <LearnPanel
          ideas={[
            'Each tube is diluted by the same factor from the one before, so the dilutions multiply: three 1 in 10 steps make 1 in 1000 (10⁻³).',
            'To leave V in every tube with a step factor F, put V of diluent in each tube and move T = V ÷ (F − 1) along the row. For 1 in 10 with 900 µL per tube, T is 100 µL.',
            'Half-log steps (a factor of √10, about 3.16) give two points for every tenfold change, a common spacing for dose–response curves.',
          ]}
          mistakes={[
            'Not mixing each tube well before the next transfer, so the error carries down the whole series.',
            'Using the same tip for every transfer, which carries extra material into the next tube.',
            'Forgetting to remove one transfer volume from the last tube, so it holds more than the others.',
          ]}
        />
        <SerialCalculator />
      </>
    ),
  },
  {
    id: 'standards',
    label: 'Calibration standards',
    content: (
      <>
        <h2>Make calibration standards</h2>
        <p className="section-intro">
          Standards at the concentrations you choose, each made directly from
          one stock. The lowest go through an intermediate standard when they
          would need too little stock to pipette accurately.
        </p>
        <LearnPanel
          ideas={[
            'Each standard is made separately from the stock (or one intermediate), so an error in one does not carry into the others, unlike a serial dilution.',
            'Volume of stock for each standard = standard concentration × final volume ÷ stock concentration.',
            'Make the standards in the same diluent as your samples (the same matrix, for example the same acid strength for metals), so they behave the same in the instrument.',
          ]}
          mistakes={[
            'Pipetting tiny volumes of a concentrated stock, which makes the lowest standards the least accurate. Use an intermediate standard instead.',
            'Leaving out the blank (0), which most methods need to set or check the baseline.',
            'Mixing units: a 1000 ppm stock is 1000 mg/L, so a 10 µg/L standard is a 1 in 100 000 dilution.',
          ]}
        />
        <StandardsCalculator />
      </>
    ),
  },
  {
    id: 'liquid',
    label: 'Concentrated liquid',
    content: (
      <>
        <h2>Dilute a concentrated liquid</h2>
        <p className="section-intro">
          Acids, bases and neat liquids sold as % w/w: what the bottle's
          concentration is, and how much to take for the solution you want.
        </p>
        <LearnPanel
          ideas={[
            'Concentrated reagents are labelled in % w/w: grams of solute per 100 g of solution. To get a molarity you also need the density.',
            'mol/L = assay × density (in g/L) ÷ molar mass. For 37% HCl at 1.18 g/mL: 0.37 × 1180 g/L ÷ 36.46 g/mol ≈ 12 M.',
            'Concentrated acids and bases release heat when diluted. Always add them to water, never water to them.',
          ]}
          mistakes={[
            'Treating 37% HCl as 37 M, or as if it were pure HCl.',
            "Using the density of water (1 g/mL) instead of the reagent's own density.",
            'Adding water to concentrated acid, which can boil and spatter.',
          ]}
        />
        <LiquidCalculator />
      </>
    ),
  },
  {
    id: 'buffer',
    label: 'Buffer',
    content: (
      <>
        <h2>Make a buffer</h2>
        <p className="section-intro">
          How much of each form, or how much acid or base, gives the pH you
          want. It corrects the pKa for temperature and ionic strength.
        </p>
        <LearnPanel
          ideas={[
            'A buffer resists pH change best within about 1 unit of its pKa, where useful amounts of both the acid and base forms are present.',
            'Henderson–Hasselbalch: pH = pKa + log(base ÷ acid). At pH = pKa the two forms are equal.',
            "pKa values shift with temperature (Tris by about −0.03 per °C) and with ionic strength (phosphate's pKa2 is about 6.8 in a 0.1 M buffer, not 7.2). The calculator corrects for both, but always finish with a calibrated pH meter.",
          ]}
          mistakes={[
            'Setting the pH at room temperature and using the buffer cold or warm: Tris set to pH 8.0 at 25 °C is about pH 8.6 at 4 °C.',
            'Bringing to the final volume before adjusting the pH, or overshooting and adding acid and base back and forth, which adds salt.',
            'Using the formula weight of the wrong hydrate, e.g. Na₂HPO₄ (141.96) instead of Na₂HPO₄·7H₂O (268.07).',
          ]}
        />
        <BufferCalculator />
      </>
    ),
  },
  {
    id: 'recipes',
    label: 'Recipes',
    content: (
      <>
        <h2>Recipes</h2>
        <p className="section-intro">
          Common buffers, media and standards, scaled to any volume and
          strength, in whichever hydrate you have. Each recipe cites its source.
        </p>
        <LearnPanel
          ideas={[
            'Recipes list each ingredient at its working (1×) concentration. A 10× stock has ten times each amount, and is diluted 1 in 10 to use.',
            'Swapping a hydrate keeps the same number of moles: 10 mM Na₂HPO₄ is 1.42 g/L anhydrous, or 2.68 g/L as the heptahydrate.',
            'Dissolve in less water than the final volume, adjust the pH, then bring to volume: adjusting the pH adds liquid.',
          ]}
          mistakes={[
            'Weighing a different hydrate from the one the recipe names, without correcting the mass.',
            'Making stocks stronger than they can hold: 10× TBE and 10× PBS can precipitate, especially in the cold.',
            'Autoclaving glucose, magnesium or calcium together with phosphate, which can caramelise or precipitate. Add them from separate sterile stocks.',
          ]}
        />
        <RecipeCalculator />
      </>
    ),
  },
  {
    id: 'convert',
    label: 'Convert',
    content: (
      <>
        <h2>Convert concentrations</h2>
        <p className="section-intro">
          Between molar, normal, mass and percent units, and between the forms
          results are expressed as: nitrate as N, hardness as CaCO₃, P₂O₅ as P,
          bleach as available chlorine.
        </p>
        <LearnPanel
          ideas={[
            'A conversion changes how a solution is described, never the solution. Within one kind (mg/L to µg/L) it is a power of ten; between kinds it needs a bridge: the molar mass (M and g/L), n (M and N), or a density (% w/w and % v/v).',
            'Normality counts reacting units: N = M × n, where n is the charge of an ion or the H⁺ or OH⁻ one molecule gives. 1 M H₂SO₄ is 2 N, and 40 mg/L of Ca²⁺ is 2 meq/L.',
            '"As N" or "as CaCO₃" reports a substance by what it has in common with another. 50 mg/L of nitrate contains 11.3 mg/L of nitrogen, so it is 11.3 mg/L as N.',
          ]}
          mistakes={[
            'Comparing a result as N with a limit as nitrate: they differ by a factor of 4.4.',
            'Treating ppm as mg/L for solids or dense solutions: ppm by weight (mg/kg) equals mg/L only when the density is close to 1 g/mL.',
            'Mixing up % w/v, % w/w and % v/v: 70% v/v ethanol is about 62% w/w.',
          ]}
        />
        <ConvertCalculator />
      </>
    ),
  },
]

function App() {
  const [mode, setMode] = useState<Mode>(loadMode)
  const changeMode = (next: Mode) => {
    setMode(next)
    saveMode(next)
  }

  return (
    <ModeContext.Provider value={mode}>
      <div className="app">
        <header className="app-header">
          <div>
            <h1>Lab Dilution &amp; Molarity Calculator</h1>
            <p className="tagline">
              Molarity, dilutions and solution prep for students and lab
              professionals.
            </p>
          </div>
          <ModeSwitch mode={mode} onChange={changeMode} />
        </header>

        <main className="app-main">
          <Tabs label="Calculators" tabs={TABS} />
        </main>

        <footer className="app-footer">
          <p>
            Not a validated GMP system. Verify critical preparations
            independently and consult the Safety Data Sheet (SDS) for every
            reagent.
          </p>
        </footer>
      </div>
    </ModeContext.Provider>
  )
}

export default App
