// Footer — paper, rule pattern faintly behind, mark + columns.
const Footer = () => {
  const cols = [
    { title:'Product', links:['Features','Pricing','Changelog','Roadmap'] },
    { title:'Resources', links:['Docs','API','Sample brief','Status'] },
    { title:'Company', links:['About','Contact','Imprint','Privacy'] },
  ];
  return (
    <footer style={{
      borderTop:'1px solid var(--rule)', padding:'48px 48px 32px', background:'var(--paper)',
      backgroundImage:'url(../../assets/pattern-rule.svg)', backgroundRepeat:'repeat', backgroundSize:'32px',
    }}>
      <div style={{maxWidth:1280,margin:'0 auto',display:'grid',gridTemplateColumns:'1.4fr 1fr 1fr 1fr',gap:48}}>
        <div>
          <img src="../../assets/logo.svg" style={{height:32}} alt="Sitebrief"/>
          <p style={{fontSize:13,lineHeight:1.55,color:'var(--ink-2)',marginTop:14,maxWidth:280}}>
            Decision-ready briefs for every site you watch.
          </p>
        </div>
        {cols.map(c => (
          <div key={c.title}>
            <div style={{fontSize:11,fontWeight:500,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--ink-3)',marginBottom:14}}>{c.title}</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {c.links.map(l => <a key={l} href="#" style={{fontSize:13,color:'var(--ink)',textDecoration:'none'}}>{l}</a>)}
            </div>
          </div>
        ))}
      </div>
      <div style={{maxWidth:1280,margin:'48px auto 0',paddingTop:24,borderTop:'1px solid var(--rule)',display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--ink-3)',fontFamily:'var(--font-mono)'}}>
        <div>© 2026 Sitebrief — built in Köln</div>
        <div>v0.1 · design preview</div>
      </div>
    </footer>
  );
};
window.Footer = Footer;
