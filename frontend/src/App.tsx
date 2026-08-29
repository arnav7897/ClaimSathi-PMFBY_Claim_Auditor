function App() {
  return (
    <main className="min-h-screen bg-canvas font-sans text-ink">
      <header className="border-b-2 border-ink bg-white px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight text-navy">
          DavaCheck
        </h1>
        <p className="text-sm text-ink/70">
          PMFBY claim-rejection auditor — evidence-grounded
        </p>
      </header>
      <section className="border-b-2 border-ink p-6">
        <span className="inline-block border-2 border-ink bg-navy px-3 py-1 font-mono text-sm font-bold text-white">
          AUDIT NOT INITIALIZED
        </span>
      </section>
    </main>
  );
}

export default App;
