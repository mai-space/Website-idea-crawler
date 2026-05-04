const SITES = [
  { name:'acme.example.com', cms:'TYPO3', priority:7, status:'crawling', pages:1240, briefs:28, health:0.84, progress:62, sync:'14 min ago' },
  { name:'jorek-music.com', cms:'TYPO3', priority:5, status:'idle', pages:312, briefs:8, health:0.91, progress:0, sync:'2 hours ago' },
  { name:'kukko-importer.de', cms:'WordPress', priority:6, status:'idle', pages:892, briefs:14, health:0.76, progress:0, sync:'yesterday' },
  { name:'wsw-energy.de', cms:'Generic', priority:8, status:'crawling', pages:2104, briefs:42, health:0.68, progress:24, sync:'now' },
  { name:'maispace-demo.de', cms:'TYPO3', priority:3, status:'error', pages:42, briefs:0, health:0.32, progress:0, sync:'3 days ago' },
  { name:'sag-onepager.com', cms:'Generic', priority:5, status:'idle', pages:6, briefs:3, health:0.97, progress:0, sync:'1 hour ago' },
];
const SiteFleet = () => (
  <div>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
      <h2 style={{fontFamily:'var(--font-display)',fontWeight:500,fontSize:22,letterSpacing:'-0.015em',margin:0}}>Site fleet</h2>
      <div style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--ink-3)'}}>6 sites · 2 crawling · 4,596 pages</div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
      {SITES.map(s => <SiteTile key={s.name} site={s}/>)}
    </div>
  </div>
);
window.SiteFleet = SiteFleet;
