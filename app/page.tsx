import Link from "next/link";
import Script from "next/script";

const launched = process.env.LAUNCH_MODE === "true";

// ── CSS ──────────────────────────────────────────────────────────────────────
// Scoped to this page via a class so it coexists with the app's Tailwind styles.
const css = `
.lp *{margin:0;padding:0;box-sizing:border-box}
.lp{
  font-family:var(--font-ibm-plex-sans),system-ui,sans-serif;
  color:#2b1f14;
  background:#f0e8d8;
  background-image:
    radial-gradient(900px 600px at 80% 0%,rgba(230,200,150,.25),transparent 55%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .04 0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E");
  min-height:100vh;
  line-height:1.6;
}
.lp a{color:inherit}
.lp .wrap{max-width:1080px;margin:0 auto;padding:0 24px}
.lp :focus-visible{outline:2.5px solid #b8891a;outline-offset:3px;border-radius:4px}
.lp ::selection{background:#b8891a;color:#fff}

/* hero band */
.lp .hero-band{position:relative;overflow:hidden}
.lp .hero-band::before{content:"";position:absolute;inset:-24px;background:url('/cork.webp') left top/100px 100px repeat;filter:blur(5px);pointer-events:none}
.lp .hero-band::after{content:"";position:absolute;inset:0;background:linear-gradient(160deg,rgba(255,245,225,.28) 0%,rgba(210,175,120,.32) 100%);pointer-events:none}
.lp .hero-band > *{position:relative;z-index:1}

/* header */
.lp header{padding:26px 0}
.lp header .wrap{display:flex;justify-content:space-between;align-items:center}
.lp .logo{font-family:var(--font-bricolage),system-ui,sans-serif;font-weight:800;font-size:1.35rem;letter-spacing:-.02em;text-decoration:none;display:flex;align-items:center;gap:.45em;color:#2b1f14}
.lp .logo .pin{width:.62em;height:.62em;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff8a72,#c94e2a 60%,#7c2d14);box-shadow:0 2px 3px rgba(0,0,0,.35);display:inline-block}
.lp header nav{display:flex;gap:4px}
.lp header nav a{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.82rem;text-decoration:none;opacity:.7;padding:8px 12px;border-radius:6px;color:#2b1f14}
.lp header nav a:hover{opacity:1;background:rgba(60,30,10,.1)}

/* hero */
.lp .hero{padding:54px 0 40px}
.lp .hero .wrap{display:grid;grid-template-columns:1fr 1fr;gap:54px;align-items:center}
.lp .kicker{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.76rem;letter-spacing:.14em;text-transform:uppercase;color:#c94e2a;margin-bottom:20px;display:flex;align-items:center;gap:10px}
.lp .kicker::before{content:"";width:26px;height:1px;background:#c94e2a}
.lp h1{font-family:var(--font-bricolage),system-ui,sans-serif;font-weight:800;font-size:clamp(2.5rem,5.4vw,3.9rem);line-height:1.02;letter-spacing:-.028em;margin-bottom:22px;color:#2b1f14}
.lp h1 .mark{display:inline-block;white-space:nowrap;color:#fff;background:linear-gradient(100deg,#c94e2a,#a83a1e);padding:.06em .28em .1em;margin:.06em 0;transform:rotate(-1.6deg);box-shadow:0 4px 14px rgba(0,0,0,.25);clip-path:polygon(1.2% 0,99% 3%,100% 14%,99% 32%,100% 52%,99.2% 74%,100% 90%,98.4% 100%,1.6% 97%,0 86%,1% 62%,0 38%,1.1% 16%)}
.lp .lede{font-size:1.08rem;color:rgba(43,31,20,.8);max-width:36ch;margin-bottom:30px}
.lp .lede b{color:#2b1f14;font-weight:600}
.lp .cta-row{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.lp .btn{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-weight:500;font-size:.95rem;text-decoration:none;border:none;cursor:pointer;border-radius:7px;padding:14px 24px;transition:transform .12s ease,box-shadow .12s ease;display:inline-block}
.lp .btn-primary{background:#c94e2a;color:#fff;box-shadow:0 3px 0 #7c2d14,0 8px 18px rgba(0,0,0,.2)}
.lp .btn-primary:hover{transform:translateY(-2px);box-shadow:0 5px 0 #7c2d14,0 12px 22px rgba(0,0,0,.25)}
.lp .btn-primary:active{transform:translateY(1px);box-shadow:0 1px 0 #7c2d14}
.lp .btn-ghost{background:rgba(43,31,20,.08);color:#2b1f14;border:1.5px solid rgba(43,31,20,.3)}
.lp .btn-ghost:hover{border-color:#2b1f14;background:rgba(43,31,20,.14)}
.lp .drag-hint{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.68rem;color:rgba(43,31,20,.45);margin-top:18px;display:none}

/* cards */
.lp .board{position:relative;min-height:460px;touch-action:pan-y}
.lp .card{position:absolute;background:linear-gradient(178deg,#fff,#fffdf8 70%);color:#2b1f14;width:236px;padding:20px 17px 14px;border-radius:3px;box-shadow:0 10px 28px rgba(0,0,0,.22),0 2px 5px rgba(0,0,0,.12);--r:0deg;transform:rotate(var(--r))}
.lp .card.grabbable{cursor:grab}
.lp .card.dragging{cursor:grabbing;box-shadow:0 22px 40px rgba(0,0,0,.3);z-index:10}
.lp .card::before{content:"";position:absolute;top:-9px;left:50%;transform:translateX(-50%);width:17px;height:17px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff8a72,#c94e2a 60%,#7c2d14);box-shadow:0 4px 5px rgba(0,0,0,.4)}
.lp .card.teal::before{background:radial-gradient(circle at 35% 30%,#6fd4b8,#2a7d5f 60%,#0e5a47)}
.lp .card.gold::before{background:radial-gradient(circle at 35% 30%,#ffd97a,#b8891a 60%,#7a5c0a)}
.lp .card .repo{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.74rem;color:#7a6652;margin-bottom:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lp .card h3{font-family:var(--font-bricolage),system-ui,sans-serif;font-weight:600;font-size:1.04rem;line-height:1.25;margin-bottom:9px}
.lp .card .meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:11px}
.lp .tag{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.64rem;background:#e8dcc6;border-radius:3px;padding:2px 7px;color:#7a6652}
.lp .card .role{font-size:.8rem;border-top:1px dashed #e8dcc6;padding-top:9px}
.lp .card .role strong{color:#c94e2a}
.lp .card.teal .role strong{color:#2a7d5f}
.lp .card.gold .role strong{color:#8a6312}
.lp .card.ghost{background:rgba(255,253,248,.82);border:2px dashed rgba(43,31,20,.3);color:rgba(43,31,20,.65);box-shadow:none;text-align:center;padding:34px 17px;text-decoration:none;transition:border-color .15s ease,background .15s ease;backdrop-filter:blur(2px)}
.lp .card.ghost::before{display:none}
.lp .card.ghost:hover{border-color:#b8891a;background:rgba(255,253,248,.95)}
.lp .card.ghost .big{font-family:var(--font-bricolage),system-ui,sans-serif;font-weight:600;font-size:1.05rem;display:block;margin-bottom:6px}
.lp .card.ghost .small{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.7rem;color:rgba(43,31,20,.45)}
.lp .c1{top:6px;left:2%;--r:-3deg}
.lp .c2{top:108px;right:0;--r:2.2deg}
.lp .c3{bottom:84px;left:14%;--r:1.5deg;z-index:2}
.lp .c4{bottom:0;right:8%;--r:-1.6deg}
@keyframes lp-pindrop{0%{opacity:0;transform:translateY(-26px) rotate(var(--r)) scale(1.04)}70%{opacity:1;transform:translateY(3px) rotate(var(--r))}100%{opacity:1;transform:translateY(0) rotate(var(--r))}}
.lp .pinning .card{animation:lp-pindrop .5s cubic-bezier(.2,.8,.3,1.1) both}
.lp .pinning .c1{animation-delay:.05s}.lp .pinning .c2{animation-delay:.18s}
.lp .pinning .c3{animation-delay:.32s}.lp .pinning .c4{animation-delay:.48s}

/* sections */
.lp section h2{font-family:var(--font-bricolage),system-ui,sans-serif;font-weight:800;font-size:clamp(1.7rem,3.4vw,2.4rem);letter-spacing:-.022em;line-height:1.12;margin-bottom:14px}
.lp .section-kicker{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:#c94e2a;margin-bottom:14px}
.lp .strip{background:#e4d8c2;padding:72px 0;border-top:1px solid rgba(43,31,20,.1);border-bottom:1px solid rgba(43,31,20,.08)}
.lp .strip .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:38px;margin-top:38px}
.lp .strip h3{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.92rem;color:#c94e2a;margin-bottom:10px}
.lp .strip p{color:#7a6652;font-size:.95rem;max-width:38ch}
.lp .how{padding:78px 0 10px}
.lp .how ol{list-style:none;counter-reset:step;display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:36px}
.lp .how li{counter-increment:step;background:rgba(43,31,20,.05);border:1px solid rgba(43,31,20,.12);border-radius:10px;padding:22px 19px;position:relative}
.lp .how li::before{content:counter(step,decimal-leading-zero);font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;color:#c94e2a;font-size:.78rem;display:block;margin-bottom:12px}
.lp .how h3{font-family:var(--font-bricolage),system-ui,sans-serif;font-weight:600;font-size:1.06rem;margin-bottom:7px}
.lp .how p{font-size:.88rem;color:#7a6652}
.lp .workspace{padding:78px 0 30px}
.lp .workspace .wrap{display:grid;grid-template-columns:1fr 1.1fr;gap:50px;align-items:center}
.lp .workspace p.body{color:#7a6652;font-size:.97rem;max-width:42ch;margin-bottom:14px}
.lp .ws-panel{background:#fffdf8;color:#2b1f14;border-radius:5px;padding:20px;box-shadow:0 16px 34px rgba(0,0,0,.2);transform:rotate(.6deg)}
.lp .ws-tabs{display:flex;gap:2px;border-bottom:1.5px solid #e8dcc6;margin-bottom:14px;font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.66rem;flex-wrap:wrap}
.lp .ws-tabs span{padding:7px 10px;color:#7a6652}
.lp .ws-tabs .on{color:#2b1f14;border-bottom:2px solid #c94e2a;font-weight:500}
.lp .kan{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.lp .kan .col{background:#e8dcc6;border-radius:7px;padding:9px}
.lp .kan h4{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;color:#7a6652;margin-bottom:8px}
.lp .kan .note{background:#fff;border:1px solid #ddcfb5;border-radius:5px;padding:7px 9px;font-size:.7rem;line-height:1.4;margin-bottom:7px;box-shadow:0 1px 2px rgba(0,0,0,.07)}
.lp .kan .note .who{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.58rem;color:#7a6652;display:block;margin-top:3px}
.lp .kan .note.done{opacity:.62;text-decoration:line-through}
.lp .kan .note.done .who{text-decoration:none}
.lp .ws-caption{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.66rem;color:#7a6652;margin-top:12px;border-top:1px dashed #e8dcc6;padding-top:10px}
.lp .rules{padding:70px 0 10px}
.lp .rules .note{background:#fffdf8;color:#2b1f14;max-width:580px;margin:34px auto 0;padding:30px 32px;border-radius:2px;transform:rotate(-.9deg);box-shadow:0 14px 30px rgba(0,0,0,.18);position:relative}
.lp .rules .note::before,.lp .rules .note::after{content:"";position:absolute;width:86px;height:26px;background:rgba(220,200,160,.6);backdrop-filter:blur(1px);box-shadow:0 1px 3px rgba(0,0,0,.1)}
.lp .rules .note::before{top:-12px;left:-26px;transform:rotate(-38deg)}
.lp .rules .note::after{top:-12px;right:-26px;transform:rotate(38deg)}
.lp .rules .note h3{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:#7a6652;margin-bottom:16px;text-align:center}
.lp .rules .note ul{list-style:none}
.lp .rules .note li{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.94rem;padding:11px 0;border-bottom:1px dashed #e8dcc6}
.lp .rules .note li:last-child{border-bottom:none}
.lp .rules .note li::before{content:"→ ";color:#c94e2a}

/* CTA section */
.lp .cta-section{padding:60px 0 100px;text-align:center}
.lp .signup-card{background:linear-gradient(178deg,#fff,#fffdf8 75%);color:#2b1f14;max-width:470px;margin:36px auto 0;padding:32px 30px 26px;border-radius:3px;transform:rotate(1deg);box-shadow:0 16px 34px rgba(0,0,0,.22);position:relative;text-align:left}
.lp .signup-card::before{content:"";position:absolute;top:-9px;left:50%;transform:translateX(-50%);width:17px;height:17px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffd97a,#b8891a 60%,#7a5c0a);box-shadow:0 4px 5px rgba(0,0,0,.4)}
.lp .signup-card h3{font-family:var(--font-bricolage),system-ui,sans-serif;font-weight:600;font-size:1.22rem;margin-bottom:6px}
.lp .signup-card p{font-size:.88rem;color:#7a6652;margin-bottom:18px}
.lp .signup-card form{display:flex;gap:10px;flex-wrap:wrap}
.lp .signup-card input[type=email]{flex:1;min-width:200px;font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.92rem;padding:13px 14px;border:1.5px solid #e8dcc6;border-radius:7px;background:#fff;color:#2b1f14}
.lp .signup-card input[type=email]:focus{outline:2px solid #b8891a;outline-offset:1px;border-color:transparent}
.lp .hp{position:absolute;left:-9999px;opacity:0;height:0;width:0}
.lp .form-msg{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.78rem;margin-top:12px;display:none}
.lp .form-msg.ok{display:block;color:#2a7d5f}
.lp .form-msg.err{display:block;color:#c94e2a}
.lp .signup-card .fine{font-size:.72rem;color:#7a6652;margin-top:12px;margin-bottom:0}
.lp .launch-card{text-align:center}
.lp .launch-card .btn-primary{font-size:1.05rem;padding:16px 32px;display:inline-block;margin-bottom:12px}
.lp .launch-card .sublink{font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.8rem;color:#7a6652;display:block;margin-top:8px;text-decoration:none}
.lp .launch-card .sublink:hover{color:#2b1f14}

footer.lp-footer{border-top:1px solid rgba(43,31,20,.12);padding:28px 0;font-family:var(--font-ibm-plex-mono),ui-monospace,monospace;font-size:.76rem;color:#7a6652;background:#f0e8d8}
footer.lp-footer .wrap{max-width:1080px;margin:0 auto;padding:0 24px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}
footer.lp-footer .foot-links{display:flex;gap:18px}
footer.lp-footer .foot-links a{color:#7a6652}
footer.lp-footer .foot-links a:hover{color:#2b1f14}

@media (min-width:881px) and (pointer:fine){.lp .drag-hint{display:block}}
@media (max-width:880px){
  .lp .hero .wrap{grid-template-columns:1fr;gap:44px}
  .lp .board{min-height:520px;max-width:540px;margin:0 auto;width:100%}
  .lp .strip .grid{grid-template-columns:1fr}
  .lp .how ol{grid-template-columns:1fr 1fr}
  .lp .workspace .wrap{grid-template-columns:1fr}
}
@media (max-width:560px){
  .lp .how ol{grid-template-columns:1fr}
  .lp .card{width:204px}
  .lp .c2{right:-2%}.lp .c4{right:0}
  .lp .rules .note::before,.lp .rules .note::after{width:64px}
}
@media (prefers-reduced-motion:reduce){
  .lp *{transition:none !important;animation:none !important}
  .lp .pinning .card{opacity:1;transform:rotate(var(--r))}
}
`;

export default function LandingPage() {
  const joinHref = launched ? "/board" : "#waitlist";
  const ghostHref = launched ? "/board" : "#waitlist";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="lp">
        <div className="hero-band">
          <header>
            <div className="wrap">
              <Link className="logo" href="/">
                <span className="pin" aria-hidden="true" />
                corkbored
              </Link>
              <nav aria-label="Main">
                <a href="#how">how it works</a>
                <a href="#workspace">the workspace</a>
                <a href="#rules">house rules</a>
                <a href={joinHref}>{launched ? "go to the board" : "join"}</a>
              </nav>
            </div>
          </header>

          <section className="hero">
            <div className="wrap">
              <div>
                <p className="kicker">For developers done with working solo</p>
                <h1>
                  Stop developing alone.<br />
                  <span className="mark">Pin your project.</span><br />
                  Build a real team.
                </h1>
                <p className="lede">
                  Side projects die solo. Corkbored is where you find the people who actually build with you — your team, maybe your cofounders — and where everyone who ships <b>shares in what it becomes.</b>
                </p>
                <div className="cta-row">
                  {launched ? (
                    <a className="btn btn-primary" href="/board">Go to the board →</a>
                  ) : (
                    <a className="btn btn-primary" href="#waitlist">Join the waitlist</a>
                  )}
                  <a className="btn btn-ghost" href="#how">How it works</a>
                </div>
                <p className="drag-hint">psst — the cards move. it&apos;s a corkboard.</p>
              </div>

              <div className="board pinning" id="board" aria-label="Example pinned projects">
                <article className="card c1" data-drag="">
                  <p className="repo">github.com/mira/ledgerline</p>
                  <h3>Open-source budgeting for freelancers</h3>
                  <div className="meta">
                    <span className="tag">TypeScript</span>
                    <span className="tag">Postgres</span>
                    <span className="tag">launched</span>
                  </div>
                  <p className="role"><strong>Needs:</strong> mobile dev · ~5 hrs/wk</p>
                </article>
                <article className="card c2 teal" data-drag="">
                  <p className="repo">github.com/dev-sara/trailcache</p>
                  <h3>Offline maps for backcountry hikers</h3>
                  <div className="meta">
                    <span className="tag">Rust</span>
                    <span className="tag">React Native</span>
                    <span className="tag">building</span>
                  </div>
                  <p className="role"><strong>Needs:</strong> Rust dev · backend</p>
                </article>
                <article className="card c3 gold" data-drag="">
                  <p className="repo">github.com/jq-dev/promptpit</p>
                  <h3>Self-hosted eval harness for LLM apps</h3>
                  <div className="meta">
                    <span className="tag">Python</span>
                    <span className="tag">prototype</span>
                  </div>
                  <p className="role"><strong>Needs:</strong> frontend · design eng</p>
                </article>
                <a className="card ghost c4" href={ghostHref}>
                  <span className="big">Your repo here</span>
                  <span className="small">real commits required — no ideas guys</span>
                </a>
              </div>
            </div>
          </section>
        </div>

        <main>
          <section className="strip">
            <div className="wrap">
              <p className="section-kicker">For builders between things</p>
              <h2>Find your team. Ship your thing.</h2>
              <div className="grid">
                <div>
                  <h3>{"// the team feeling, again"}</h3>
                  <p>Million-dollar ideas sit abandoned because one person ran out of steam. Find builders who actually want to be there — people who chose your project, not just anyone with a GitHub account.</p>
                </div>
                <div>
                  <h3>{"// the builders pledge"}</h3>
                  <p>Everyone who joins agrees to treat each other with honesty and integrity. No ego, no politics, no spam PRs — just builders working together on something they believe in.</p>
                </div>
                <div>
                  <h3>{"// share what you make"}</h3>
                  <p>If it takes off, everyone who built it is already on the record — code, tasks, decisions, all of it. The spoils go to the people who earned them.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="how" id="how">
            <div className="wrap">
              <p className="section-kicker">From repo to team</p>
              <h2>How it works</h2>
              <ol>
                <li>
                  <h3>Pin a project</h3>
                  <p>Link a real GitHub repo with real commits. Verified automatically — no vaporware on the board.</p>
                </li>
                <li>
                  <h3>Say who you need</h3>
                  <p>Collaborators, not employees: &quot;React dev, great with tailwind!&quot; Set the expectation up front.</p>
                </li>
                <li>
                  <h3>Choose your team</h3>
                  <p>Devs apply with a short pitch and their actual GitHub history. You decide who gets in.</p>
                </li>
                <li>
                  <h3>Build &amp; share the upside</h3>
                  <p>Accepted members get repo access. If the project takes off, the contribution record is already there.</p>
                </li>
              </ol>
            </div>
          </section>

          <section className="workspace" id="workspace">
            <div className="wrap">
              <div>
                <p className="section-kicker">After the match</p>
                <h2>More than matchmaking — a place the team actually works.</h2>
                <p className="body">Every project gets a shared workspace: a task board, async discussion threads, an announcements feed, and a live activity stream synced from GitHub.</p>
                <p className="body">And here&apos;s the part that matters later: tasks finished, threads decided, commits merged — it all lands on the contribution record. Design and docs count, not just code. When the project wins, nobody argues about who built it.</p>
              </div>
              <div className="ws-panel" aria-label="Workspace preview">
                <div className="ws-tabs">
                  <span>Applications</span><span className="on">Tasks</span>
                  <span>Discussion</span><span>Announcements</span><span>Activity</span>
                </div>
                <div className="kan">
                  <div className="col">
                    <h4>To do</h4>
                    <div className="note">Results dashboard wireframe<span className="who">unassigned</span></div>
                    <div className="note">Rubric scoring edge cases<span className="who">@jq-dev</span></div>
                  </div>
                  <div className="col">
                    <h4>Doing</h4>
                    <div className="note">CSV export for eval runs<span className="who">@ana-builds</span></div>
                  </div>
                  <div className="col">
                    <h4>Done</h4>
                    <div className="note done">SQLite migration<span className="who">@jq-dev</span></div>
                    <div className="note done">Diff view fix<span className="who">@jq-dev</span></div>
                  </div>
                </div>
                <p className="ws-caption">done + assigned = logged as a contribution</p>
              </div>
            </div>
          </section>

          <section className="rules" id="rules">
            <div className="wrap">
              <h2 style={{ textAlign: "center" }}>House rules</h2>
              <div className="note">
                <h3>Pinned to the board</h3>
                <ul>
                  <li>No ideas guys. Code first, then collaborators.</li>
                  <li>No drive-by PRs. Apply, get accepted, contribute.</li>
                  <li>Builders share the spoils. Contribution is on the record.</li>
                </ul>
              </div>
            </div>
          </section>

          {launched ? (
            <section className="cta-section" id="waitlist">
              <div className="wrap">
                <h2>The board is open.</h2>
                <div className="signup-card launch-card">
                  <h3>Start building with people who care</h3>
                  <p>Sign in with GitHub to pin a project or apply to collaborate.</p>
                  <Link className="btn btn-primary" href="/signin?callbackUrl=/board">
                    Sign in with GitHub →
                  </Link>
                  <a className="sublink" href="/board">Browse the board first</a>
                </div>
              </div>
            </section>
          ) : (
            <section className="cta-section" id="waitlist">
              <div className="wrap">
                <h2>The board opens soon.</h2>
                <div className="signup-card">
                  <h3>Pin yourself to the board</h3>
                  <p>Get early access at launch. Waitlist devs get first look.</p>
                  <form id="waitlist-form" noValidate>
                    <label htmlFor="email" style={{ position: "absolute", left: "-9999px" }}>
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      name="email"
                      placeholder="you@example.dev"
                      required
                      autoComplete="email"
                    />
                    <input
                      className="hp"
                      type="text"
                      name="nickname"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                    />
                    <button className="btn btn-primary" type="submit" id="submit-btn">
                      Join waitlist
                    </button>
                  </form>
                  <p className="form-msg" id="form-msg" role="status" />
                  <p className="fine">No spam — that&apos;s kind of our whole thing.</p>
                </div>
              </div>
            </section>
          )}
        </main>

        <footer className="lp-footer">
          <div className="wrap">
            <span>© 2026 corkbored.com</span>
            <nav className="foot-links">
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/cookies">Cookies</Link>
              <Link href="/dmca">DMCA</Link>
            </nav>
            <span>built by a dev, for devs</span>
          </div>
        </footer>
      </div>

      {/* Draggable cards — desktop fine-pointer only */}
      <Script id="lp-drag" strategy="afterInteractive">{`
        (function(){
          var finePointer = window.matchMedia('(pointer:fine)').matches;
          var reduced = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
          var board = document.getElementById('board');
          if(!finePointer || !board) return;
          setTimeout(function(){ board.classList.remove('pinning'); }, reduced ? 0 : 1200);
          var cards = board.querySelectorAll('[data-drag]');
          cards.forEach(function(card){
            card.classList.add('grabbable');
            var ox=0,oy=0,baseRot=parseFloat((getComputedStyle(card).getPropertyValue('--r')||'0').replace('deg',''))||0;
            var dragging=false,startX=0,startY=0,lastX=0;
            card.addEventListener('pointerdown',function(e){
              if(e.button!==0) return;
              dragging=true;startX=e.clientX-ox;startY=e.clientY-oy;lastX=e.clientX;
              card.classList.add('dragging');card.setPointerCapture(e.pointerId);
            });
            card.addEventListener('pointermove',function(e){
              if(!dragging) return;
              ox=e.clientX-startX;oy=e.clientY-startY;
              var swing=Math.max(-7,Math.min(7,(e.clientX-lastX)*0.6));lastX=e.clientX;
              card.style.transform='translate('+ox+'px,'+oy+'px) rotate('+(baseRot+swing)+'deg)';
            });
            function release(){
              if(!dragging) return;dragging=false;card.classList.remove('dragging');
              card.style.transform='translate('+ox+'px,'+oy+'px) rotate('+baseRot+'deg)';
            }
            card.addEventListener('pointerup',release);card.addEventListener('pointercancel',release);
          });
        })();
      `}</Script>

      {/* Waitlist form — only in pre-launch mode */}
      {!launched && (
        <Script id="lp-form" strategy="afterInteractive">{`
          (function(){
            var ENDPOINT = "https://formspree.io/f/mzdqkawp";
            var form = document.getElementById('waitlist-form');
            var msg = document.getElementById('form-msg');
            var btn = document.getElementById('submit-btn');
            if(!form) return;
            function show(kind,text){ msg.className='form-msg '+kind; msg.textContent=text; }
            form.addEventListener('submit',function(e){
              e.preventDefault();
              var email=form.email.value.trim();
              if(form.nickname.value){ show('ok','Pinned. See you at launch.'); form.reset(); return; }
              if(!email||email.indexOf('@')<1){ show('err',"That email doesn't look right."); return; }
              btn.disabled=true; btn.textContent='Pinning…';
              fetch(ENDPOINT,{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},body:JSON.stringify({email:email})})
                .then(function(res){ if(res.ok){ show('ok','Pinned. See you at launch.'); form.reset(); } else { show('err','Something went wrong — try again in a minute.'); } })
                .catch(function(){ show('err','Network hiccup — try again in a minute.'); })
                .finally(function(){ btn.disabled=false; btn.textContent='Join waitlist'; });
            });
          })();
        `}</Script>
      )}
    </>
  );
}
