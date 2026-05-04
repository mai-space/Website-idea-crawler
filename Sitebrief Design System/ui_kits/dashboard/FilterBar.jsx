const FilterBar = () => {
  const [active, setActive] = React.useState('All');
  const filters = ['All','Open · 28','Accepted · 12','Deferred · 3','Rejected · 7'];
  const facets = [
    { label:'Site', value:'All sites' },
    { label:'Complexity', value:'Any' },
    { label:'Area', value:'Any' },
    { label:'Sort', value:'Impact' },
  ];
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:24,marginBottom:14,flexWrap:'wrap'}}>
      <div style={{display:'flex',gap:4,padding:3,background:'var(--paper-0)',borderRadius:8}}>
        {filters.map(f => (
          <button key={f} onClick={()=>setActive(f)} style={{
            border:'none',background: active===f ? 'var(--paper-2)' : 'transparent',
            boxShadow: active===f ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            color: active===f ? 'var(--ink)' : 'var(--ink-2)',
            fontFamily:'inherit',fontSize:13,fontWeight:500,padding:'6px 12px',borderRadius:5,cursor:'pointer',
          }}>{f}</button>
        ))}
      </div>
      <div style={{display:'flex',gap:8}}>
        {facets.map(f => (
          <button key={f.label} style={{
            display:'inline-flex',alignItems:'center',gap:6,
            background:'var(--paper-2)',border:'1px solid var(--rule)',borderRadius:6,
            padding:'6px 10px',fontSize:12,fontFamily:'inherit',color:'var(--ink-2)',cursor:'pointer',
          }}>
            <span style={{color:'var(--ink-3)'}}>{f.label}</span>
            <span style={{color:'var(--ink)',fontWeight:500}}>{f.value}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        ))}
      </div>
    </div>
  );
};
window.FilterBar = FilterBar;
