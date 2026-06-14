// Throwaway page — delete before production (see NOTES.md)
const COLORS = [
  { name: 'board', hex: '#f0e8d8', bg: 'bg-board' },
  { name: 'board-deep', hex: '#e4d8c2', bg: 'bg-board-deep' },
  { name: 'paper', hex: '#fffdf8', bg: 'bg-paper' },
  { name: 'paper-edge', hex: '#e8dcc6', bg: 'bg-paper-edge' },
  { name: 'paper-bright', hex: '#ffffff', bg: 'bg-paper-bright' },
  { name: 'ink', hex: '#2b1f14', bg: 'bg-ink' },
  { name: 'ink-soft', hex: '#7a6652', bg: 'bg-ink-soft' },
  { name: 'pin-red', hex: '#c94e2a', bg: 'bg-pin-red' },
  { name: 'pin-teal', hex: '#2a7d5f', bg: 'bg-pin-teal' },
  { name: 'pin-gold', hex: '#b8891a', bg: 'bg-pin-gold' },
]

export default function StyleguidePage() {
  return (
    <div className="min-h-screen bg-board p-10 text-ink">
      <h1 className="font-display font-bold text-4xl mb-2">Corkbored styleguide</h1>
      <p className="font-mono text-sm text-ink-soft mb-10">Task 0.2 — visual verification only</p>

      <section className="mb-10">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink-soft mb-4">Colors</h2>
        <div className="grid grid-cols-5 gap-4">
          {COLORS.map(({ name, hex, bg }) => (
            <div key={name}>
              <div className={`${bg} h-14 rounded border border-paper-edge`} />
              <p className="font-mono text-xs mt-1.5 text-ink">{name}</p>
              <p className="font-mono text-xs text-ink-soft">{hex}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink-soft mb-6">Typography</h2>
        <div className="space-y-6">
          <div>
            <p className="font-mono text-xs text-ink-soft mb-1">font-display · Bricolage Grotesque</p>
            <p className="font-display font-bold text-4xl">Pin your project. Build a real team.</p>
            <p className="font-display font-semibold text-2xl text-ink-soft mt-1">Side projects die solo.</p>
          </div>
          <div>
            <p className="font-mono text-xs text-ink-soft mb-1">font-sans · IBM Plex Sans</p>
            <p className="font-sans text-base">Collaborators by application, not drive-by PRs. When the project wins, the people who built it share the upside.</p>
          </div>
          <div>
            <p className="font-mono text-xs text-ink-soft mb-1">font-mono · IBM Plex Mono</p>
            <p className="font-mono text-sm">github.com/mira/ledgerline · TypeScript · Postgres · launched</p>
            <p className="font-mono text-sm italic text-ink-soft mt-0.5">italic variant — needs: mobile dev · ~5 hrs/wk</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink-soft mb-4">Accent spots</h2>
        <div className="flex gap-3">
          <button className="font-mono text-sm bg-pin-red text-paper-bright px-4 py-2 rounded-md">pin-red button</button>
          <button className="font-mono text-sm bg-pin-teal text-paper-bright px-4 py-2 rounded-md">pin-teal button</button>
          <button className="font-mono text-sm bg-pin-gold text-ink px-4 py-2 rounded-md">pin-gold button</button>
          <span className="font-mono text-sm border border-ink/30 text-ink px-4 py-2 rounded-md">ghost</span>
        </div>
      </section>
    </div>
  )
}
