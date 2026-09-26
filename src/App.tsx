import { DilutionCalculator } from './ui/calculators/DilutionCalculator.tsx'
import { SolidCalculator } from './ui/calculators/SolidCalculator.tsx'
import { Tabs, type Tab } from './ui/components/Tabs.tsx'

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
        <DilutionCalculator />
      </>
    ),
  },
]

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Lab Dilution &amp; Molarity Calculator</h1>
        <p className="tagline">
          Molarity, dilutions and solution prep for students and lab
          professionals.
        </p>
      </header>

      <main className="app-main">
        <Tabs label="Calculators" tabs={TABS} />
      </main>

      <footer className="app-footer">
        <p>
          Not a validated GMP system. Verify critical preparations independently
          and consult the Safety Data Sheet (SDS) for every reagent.
        </p>
      </footer>
    </div>
  )
}

export default App
