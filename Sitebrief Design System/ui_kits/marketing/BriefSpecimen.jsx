// Static pitch-card specimen — used as the visual proof beside the hero copy.
const BriefSpecimen = () => (
  <div style={{
    background:'var(--paper-2)', border:'1px solid var(--rule)', borderRadius:12,
    padding:22, boxShadow:'var(--shadow-1)', display:'flex', flexDirection:'column', gap:14,
    fontFamily:'var(--font-ui)',
  }}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        <span style={{background:'#F5EAD0',color:'#6E5118',padding:'3px 9px',borderRadius:4,fontSize:11,fontWeight:600,letterSpacing:'0.04em',textTransform:'uppercase'}}>medium</span>
        <span style={{background:'var(--paper-0)',border:'1px solid var(--rule)',color:'var(--ink-2)',padding:'3px 8px',borderRadius:4,fontSize:11,fontWeight:500,letterSpacing:'0.04em',textTransform:'uppercase'}}>content</span>
        <span style={{background:'var(--paper-0)',border:'1px solid var(--rule)',color:'var(--ink-2)',padding:'3px 8px',borderRadius:4,fontSize:11,fontWeight:500,letterSpacing:'0.04em',textTransform:'uppercase'}}>seo</span>
      </div>
      <div style={{fontFamily:'var(--font-mono)',fontSize:13,color:'var(--ink-2)'}}>16h</div>
    </div>
    <div style={{fontFamily:'var(--font-display)',fontWeight:500,fontSize:24,lineHeight:1.2,letterSpacing:'-0.015em'}}>Blogserie zu Feature X einführen</div>
    <div style={{fontSize:15,lineHeight:1.55,color:'var(--ink)'}}>
      The site has strong product-page traffic but no supporting content. A short blog series on Feature X could lift organic reach and conversion without adding dev work.
    </div>
    <div style={{background:'#FBE9DC',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#7A2C0E',display:'flex',gap:10}}>
      <span style={{fontWeight:600}}>TYPO3</span>
      <span>Implementable via EXT:news — no custom dev required.</span>
    </div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:14,borderTop:'1px solid var(--rule)'}}>
      <div style={{display:'flex',gap:8}}>
        <button style={{background:'var(--accent)',color:'#fff',border:'1px solid transparent',borderRadius:6,padding:'7px 12px',fontSize:13,fontWeight:500,fontFamily:'inherit',cursor:'pointer'}}>Accept</button>
        <button style={{background:'var(--paper-2)',color:'var(--ink)',border:'1px solid var(--rule)',borderRadius:6,padding:'7px 12px',fontSize:13,fontWeight:500,fontFamily:'inherit',cursor:'pointer'}}>Defer</button>
        <button style={{background:'var(--paper-2)',color:'var(--ink)',border:'1px solid var(--rule)',borderRadius:6,padding:'7px 12px',fontSize:13,fontWeight:500,fontFamily:'inherit',cursor:'pointer'}}>Reject</button>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'var(--ink-2)'}}>
        Impact
        <div style={{width:80,height:4,background:'var(--paper-0)',borderRadius:2,overflow:'hidden'}}>
          <div style={{height:'100%',background:'var(--ink)',width:'76%'}}/>
        </div>
      </div>
    </div>
  </div>
);
window.BriefSpecimen = BriefSpecimen;
