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
        <p className="notice">
          The calculators are under construction. See the project plan in{' '}
          <code>docs/PLAN.md</code>.
        </p>
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
