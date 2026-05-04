// Three-up feature row. Caption / title / body, no icons (icons would over-decorate).
const FeatureGrid = () => {
  const features = [
    { eyebrow:'Crawl', title:'Many sites, one console.', body:'Add a site, hit run. Sitebrief respects robots.txt, rate-limits per domain, and re-crawls only the pages that changed.' },
    { eyebrow:'Read', title:'Structured, not scraped.', body:'Pages are cleaned, classified by type, and embedded — so the model sees an article, not a div soup.' },
    { eyebrow:'Brief', title:'Decision-ready, every time.', body:'Each idea is a 5-second-readable pitch with a complexity badge, hour estimate, and a CMS-aware build hint.' },
  ];
  return (
    <section style={{padding:'48px 48px 96px', maxWidth:1280, margin:'0 auto'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:48}}>
        {features.map(f => (
          <div key={f.title}>
            <div style={{fontSize:11,fontWeight:500,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--accent-ink)',marginBottom:14}}>{f.eyebrow}</div>
            <h3 style={{fontFamily:'var(--font-display)',fontWeight:500,fontSize:24,lineHeight:1.2,letterSpacing:'-0.015em',margin:'0 0 12px'}}>{f.title}</h3>
            <p style={{fontSize:15,lineHeight:1.55,color:'var(--ink-2)',margin:0}}>{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
window.FeatureGrid = FeatureGrid;
