// Editorial left-anchored hero. Headline 60% column width, brief specimen on the right.
const Hero = () => (
  <section style={{
    padding:'96px 48px 64px', maxWidth:1280, margin:'0 auto',
    display:'grid', gridTemplateColumns:'1.05fr 1fr', gap:64, alignItems:'center',
  }}>
    <div>
      <div style={{
        fontSize:11, fontWeight:500, letterSpacing:'0.08em', textTransform:'uppercase',
        color:'var(--accent-ink)', marginBottom:24,
      }}>For agencies managing many sites</div>
      <h1 style={{
        fontFamily:'var(--font-display)', fontWeight:400, fontSize:64, lineHeight:1.05,
        letterSpacing:'-0.025em', margin:0, color:'var(--ink)',
      }}>
        Stop guessing what to build next.
      </h1>
      <p style={{
        fontSize:19, lineHeight:1.55, color:'var(--ink-2)', marginTop:24, marginBottom:32, maxWidth:520,
      }}>
        Sitebrief crawls every site you manage and writes the next twenty things worth doing — with
        hours, complexity, and a one-paragraph pitch a client can read in five seconds.
      </p>
      <div style={{display:'flex',gap:12,alignItems:'center'}}>
        <a href="#" style={{
          background:'var(--accent)', color:'#fff', padding:'13px 22px', borderRadius:8,
          fontSize:15, fontWeight:500, textDecoration:'none',
        }}>Start a 14-day trial</a>
        <a href="#" style={{
          color:'var(--ink)', padding:'13px 18px', fontSize:15,
          textDecoration:'underline', textDecorationThickness:1, textUnderlineOffset:4,
        }}>See a sample brief →</a>
      </div>
      <div style={{
        marginTop:40, display:'flex', gap:32, fontFamily:'var(--font-mono)', fontSize:12, color:'var(--ink-3)',
      }}>
        <div><span style={{color:'var(--ink)'}}>1,240</span> pages crawled / minute</div>
        <div><span style={{color:'var(--ink)'}}>0.92</span> dedup similarity</div>
        <div><span style={{color:'var(--ink)'}}>TYPO3 · WP · Generic</span></div>
      </div>
    </div>
    <div>
      <BriefSpecimen/>
      <div style={{
        marginTop:14, fontSize:12, color:'var(--ink-3)', fontFamily:'var(--font-ui)',
        display:'flex', alignItems:'center', gap:6,
      }}>
        <span style={{width:6,height:6,borderRadius:'50%',background:'#3F8A57',display:'inline-block'}}/>
        A real brief from acme.example.com — generated 14 minutes ago
      </div>
    </div>
  </section>
);
window.Hero = Hero;
