const QueueMonitor = () => {
  const queues = [
    { name:'crawl',  active:3, max:5, depth:42,  color:'var(--accent)' },
    { name:'parse',  active:5, max:8, depth:128, color:'var(--ink)' },
    { name:'ideas',  active:1, max:3, depth:12,  color:'#3F8A57' },
  ];
  return (
    <div style={{background:'var(--paper-2)',border:'1px solid var(--rule)',borderRadius:12,padding:20,boxShadow:'var(--shadow-1)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h3 style={{fontSize:14,fontWeight:600,margin:0}}>Queue monitor</h3>
        <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--ink-3)'}}>live</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {queues.map(q => (
          <div key={q.name}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <span style={{fontSize:13,fontWeight:500}}>{q.name}-queue</span>
              <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--ink-2)'}}>{q.active}/{q.max} workers · {q.depth} queued</span>
            </div>
            <div style={{height:6,background:'var(--paper-0)',borderRadius:3,overflow:'hidden',display:'flex',gap:2}}>
              {Array.from({length:q.max}).map((_,i) => (
                <div key={i} style={{flex:1,background: i<q.active ? q.color : 'transparent'}}/>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
window.QueueMonitor = QueueMonitor;
