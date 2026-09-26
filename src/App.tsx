import { useState } from 'react'
import { DilutionCalculator } from './ui/calculators/DilutionCalculator.tsx'
import { LiquidCalculator } from './ui/calculators/LiquidCalculator.tsx'
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
