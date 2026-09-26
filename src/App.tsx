import { SolidCalculator } from './ui/calculators/SolidCalculator.tsx'

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
        <section aria-labelledby="solid-heading">
          <h2 id="solid-heading">Make a solution from a solid</h2>
          <p className="section-intro">
            How much to weigh, what volume to make, or what concentration you
            get: mass = concentration × volume × molar mass.
          </p>
          <SolidCalculator />
        </section>
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
