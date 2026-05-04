const SiteTile = ({ site }) => (
  <div style={{
    background:'var(--paper-2)', border:'1px solid var(--rule)', borderRadius:12,
    padding:18, display:'flex',flexDirection:'column',gap:14, boxShadow:'var(--shadow-1)',
    cursor:'pointer', transition:'all 200ms cubic-bezier(0.2,0.7,0.2,1)',
  }}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
      <div>
        <div style={{fontFamily:'var(--font-display)',fontWeight:500,fontSize:18,letterSpacing:'-0.01em'}}>{site.name}</div>
        <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--ink-3)',marginTop:2}}>{site.cms} · priority {site.priority}</div>
      </div>
      {site.status === 'crawling' ? (
        <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 9px',borderRadius:999,background:'#E2F0E5',color:'#1F5C36',fontSize:11,fontWeight:500}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'#3F8A57',animation:'sb-pulse 1.6s ease-in-out infinite'}}/>
          crawling
        </div>
      ) : site.status === 'idle' ? (
        <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 9px',borderRadius:999,background:'var(--paper-0)',color:'var(--ink-2)',fontSize:11,fontWeight:500}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'var(--ink-3)'}}/>
          idle
        </div>
      ) : (
        <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 9px',borderRadius:999,background:'#F2DCDC',color:'#7A2828',fontSize:11,fontWeight:500}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:'#B23F3F'}}/>
          error
        </div>
      )}
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
      <div><div style={{fontSize:10,fontWeight:500,letterSpacing:'0.04em',textTransform:'uppercase',color:'var(--ink-3)'}}>Pages</div><div style={{fontFamily:'var(--font-display)',fontWeight:500,fontSize:20,marginTop:2}}>{site.pages.toLocaleString()}</div></div>
      <div><div style={{fontSize:10,fontWeight:500,letterSpacing:'0.04em',textTransform:'uppercase',color:'var(--ink-3)'}}>Briefs</div><div style={{fontFamily:'var(--font-display)',fontWeight:500,fontSize:20,marginTop:2}}>{site.briefs}</div></div>
      <div><div style={{fontSize:10,fontWeight:500,letterSpacing:'0.04em',textTransform:'uppercase',color:'var(--ink-3)'}}>Health</div><div style={{fontFamily:'var(--font-display)',fontWeight:500,fontSize:20,marginTop:2}}>{site.health.toFixed(2)}</div></div>
    </div>
    {site.status === 'crawling' && (
      <>
        <div style={{height:4,background:'var(--paper-0)',borderRadius:2,overflow:'hidden'}}>
          <div style={{height:'100%',background:'var(--accent)',width:`${site.progress}%`,transition:'width 360ms'}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--ink-3)'}}>
          <span>{Math.round(site.pages * site.progress/100)} / {site.pages.toLocaleString()} parsed</span>
          <span>{site.progress}%</span>
        </div>
      </>
    )}
    {site.status !== 'crawling' && (
      <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--ink-3)'}}>last sync {site.sync}</div>
    )}
  </div>
);
window.SiteTile = SiteTile;
