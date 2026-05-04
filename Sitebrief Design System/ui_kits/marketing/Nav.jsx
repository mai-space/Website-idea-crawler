// Top nav for the marketing surface. Paper background, hairline rule on scroll.
const Nav = () => (
  <nav style={{
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'20px 48px', borderBottom:'1px solid var(--rule)', background:'var(--paper)',
    position:'sticky', top:0, zIndex:10,
  }}>
    <a href="#" style={{display:'flex',alignItems:'center',gap:10,textDecoration:'none'}}>
      <img src="../../assets/mark.svg" width={28} height={28} alt=""/>
      <span style={{fontFamily:'var(--font-display)',fontWeight:500,fontSize:22,letterSpacing:'-0.01em',color:'var(--ink)'}}>Sitebrief</span>
    </a>
    <div style={{display:'flex',alignItems:'center',gap:32}}>
      {['Product','How it works','Pricing','Changelog'].map(l=>(
        <a key={l} href="#" style={{fontSize:14,color:'var(--ink-2)',textDecoration:'none'}}>{l}</a>
      ))}
    </div>
    <div style={{display:'flex',alignItems:'center',gap:12}}>
      <a href="#" style={{fontSize:14,color:'var(--ink)',textDecoration:'none'}}>Log in</a>
      <a href="#" style={{
        fontSize:14, fontWeight:500, color:'#fff', background:'var(--accent)',
        padding:'9px 16px', borderRadius:8, textDecoration:'none',
      }}>Start trial</a>
    </div>
  </nav>
);
window.Nav = Nav;
