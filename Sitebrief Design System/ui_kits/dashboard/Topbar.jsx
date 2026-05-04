const Topbar = () => (
  <header style={{
    display:'flex',alignItems:'center',justifyContent:'space-between',
    padding:'14px 32px',borderBottom:'1px solid var(--rule)',background:'var(--paper)',
    position:'sticky',top:0,zIndex:5,
  }}>
    <div style={{display:'flex',alignItems:'center',gap:10,fontSize:14,color:'var(--ink-2)'}}>
      <span>Workspace</span>
      <span style={{color:'var(--ink-3)'}}>/</span>
      <span style={{color:'var(--ink)',fontWeight:500}}>Overview</span>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:12}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',background:'var(--paper-2)',border:'1px solid var(--rule)',borderRadius:8,minWidth:280,fontSize:13,color:'var(--ink-3)'}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span style={{flex:1}}>Search briefs, sites, pages…</span>
        <span style={{fontFamily:'var(--font-mono)',fontSize:11,padding:'1px 5px',background:'var(--paper-0)',borderRadius:3}}>⌘K</span>
      </div>
      <button style={{background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,padding:'9px 14px',fontSize:13,fontWeight:500,fontFamily:'inherit',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        Run all crawls
      </button>
    </div>
  </header>
);
window.Topbar = Topbar;
