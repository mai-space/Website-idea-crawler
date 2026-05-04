// Logo strip — restraint over fanfare. Wordmarks rendered in ink-3, no real logos faked.
const LogoStrip = () => (
  <section style={{borderTop:'1px solid var(--rule)',borderBottom:'1px solid var(--rule)',padding:'32px 48px',background:'var(--paper-0)'}}>
    <div style={{maxWidth:1280,margin:'0 auto',display:'flex',alignItems:'center',gap:48,flexWrap:'wrap'}}>
      <div style={{fontSize:11,fontWeight:500,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--ink-3)'}}>Used by agencies running</div>
      {['12 TYPO3 sites','40 WordPress sites','200+ generic CMS','1.2M crawled URLs'].map(l => (
        <div key={l} style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:500,letterSpacing:'-0.01em',color:'var(--ink-2)'}}>{l}</div>
      ))}
    </div>
  </section>
);
window.LogoStrip = LogoStrip;
