// Fixed 240px sidebar. Active item gets accent-bg + ink text.
const Sidebar = () => {
  const items = [
    { icon:'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10', label:'Overview', active:true },
    { icon:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', label:'Briefs', count:28 },
    { icon:'M2 3h20v14H2z M8 21h8 M12 17v4', label:'Sites', count:12 },
    { icon:'M22 12h-4l-3 9L9 3l-3 9H2', label:'Activity' },
    { icon:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3', label:'Exports' },
    { icon:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z', label:'Settings' },
  ];
  return (
    <aside style={{
      width:240, flexShrink:0, height:'100vh', borderRight:'1px solid var(--rule)',
      background:'var(--paper)', display:'flex', flexDirection:'column',
      position:'sticky', top:0,
    }}>
      <div style={{padding:'18px 20px',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid var(--rule)'}}>
        <img src="../../assets/mark.svg" width={26} height={26} alt=""/>
        <span style={{fontFamily:'var(--font-display)',fontWeight:500,fontSize:18,letterSpacing:'-0.01em'}}>Sitebrief</span>
      </div>
      <div style={{padding:'12px 8px',flex:1,display:'flex',flexDirection:'column',gap:2}}>
        <div style={{fontSize:11,fontWeight:500,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--ink-3)',padding:'10px 12px'}}>Workspace</div>
        {items.map(it => (
          <a key={it.label} href="#" style={{
            display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:6,
            textDecoration:'none', color: it.active ? 'var(--ink)' : 'var(--ink-2)',
            background: it.active ? 'var(--accent-bg)' : 'transparent',
            fontSize:14, fontWeight: it.active ? 500 : 400,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={it.active?'var(--accent-ink)':'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {it.icon.split(' M').map((d,i)=>(<path key={i} d={i===0?d:'M'+d}/>))}
            </svg>
            <span style={{flex:1}}>{it.label}</span>
            {it.count!=null && <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--ink-3)'}}>{it.count}</span>}
          </a>
        ))}
      </div>
      <div style={{padding:14,borderTop:'1px solid var(--rule)',display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:30,height:30,borderRadius:'50%',background:'var(--ink)',color:'var(--paper)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:600}}>JM</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:500,color:'var(--ink)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>Joel Maximilian</div>
          <div style={{fontSize:11,color:'var(--ink-3)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>mai-space</div>
        </div>
      </div>
    </aside>
  );
};
window.Sidebar = Sidebar;
