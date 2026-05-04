const PitchCard = ({ brief }) => {
  const compColor = { low:['#E2F0E5','#1F5C36'], medium:['#F5EAD0','#6E5118'], high:['#F2DCDC','#7A2828'] }[brief.complexity];
  return (
    <div style={{
      background:'var(--paper-2)', border:'1px solid var(--rule)', borderRadius:12,
      padding:20, boxShadow:'var(--shadow-1)', display:'flex',flexDirection:'column',gap:12,
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{background:compColor[0],color:compColor[1],padding:'3px 9px',borderRadius:4,fontSize:11,fontWeight:600,letterSpacing:'0.04em',textTransform:'uppercase'}}>{brief.complexity}</span>
          {brief.areas.map(a => (
            <span key={a} style={{background:'var(--paper-0)',border:'1px solid var(--rule)',color:'var(--ink-2)',padding:'3px 8px',borderRadius:4,fontSize:11,fontWeight:500,letterSpacing:'0.04em',textTransform:'uppercase'}}>{a}</span>
          ))}
        </div>
        <div style={{fontFamily:'var(--font-mono)',fontSize:13,color:'var(--ink-2)'}}>{brief.hours}h</div>
      </div>
      <div style={{fontFamily:'var(--font-display)',fontWeight:500,fontSize:22,lineHeight:1.2,letterSpacing:'-0.015em'}}>{brief.title}</div>
      <div style={{fontSize:14,lineHeight:1.55,color:'var(--ink)'}}>{brief.pitch}</div>
      {brief.cmsHint && (
        <div style={{background:'#FBE9DC',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#7A2C0E',display:'flex',gap:10}}>
          <span style={{fontWeight:600}}>{brief.cmsHint.cms}</span>
          <span>{brief.cmsHint.text}</span>
        </div>
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:12,borderTop:'1px solid var(--rule)'}}>
        <div style={{display:'flex',gap:8}}>
          <button style={{background:'var(--accent)',color:'#fff',border:'1px solid transparent',borderRadius:6,padding:'7px 12px',fontSize:13,fontWeight:500,fontFamily:'inherit',cursor:'pointer'}}>Accept</button>
          <button style={{background:'var(--paper-2)',color:'var(--ink)',border:'1px solid var(--rule)',borderRadius:6,padding:'7px 12px',fontSize:13,fontWeight:500,fontFamily:'inherit',cursor:'pointer'}}>Defer</button>
          <button style={{background:'transparent',color:'var(--ink-2)',border:'none',borderRadius:6,padding:'7px 10px',fontSize:13,fontFamily:'inherit',cursor:'pointer'}}>Reject</button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:18,fontFamily:'var(--font-mono)',fontSize:11,color:'var(--ink-3)'}}>
          <span>{brief.site}</span>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            Impact
            <div style={{width:64,height:4,background:'var(--paper-0)',borderRadius:2,overflow:'hidden'}}>
              <div style={{height:'100%',background:'var(--ink)',width:`${brief.impact*100}%`}}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
window.PitchCard = PitchCard;
