const BRIEFS = [
  { complexity:'medium', areas:['content','seo'], hours:16, site:'acme.example.com', impact:0.76,
    title:'Blogserie zu Feature X einführen',
    pitch:'The site has strong product-page traffic but no supporting content. A short blog series on Feature X could lift organic reach and conversion without adding dev work.',
    cmsHint:{ cms:'TYPO3', text:'Implementable via EXT:news — no custom dev required.'} },
  { complexity:'low', areas:['seo'], hours:4, site:'kukko-importer.de', impact:0.62,
    title:'Add structured-data to all product pages',
    pitch:'892 product pages have descriptions but no schema.org markup. Adding Product JSON-LD would unlock rich results in 2–4 weeks.',
    cmsHint:{ cms:'WordPress', text:'Yoast SEO Premium covers this with one toggle.'} },
  { complexity:'high', areas:['feature','ux'], hours:60, site:'wsw-energy.de', impact:0.88,
    title:'Energy-savings calculator on landing',
    pitch:'Hero page has 12% bounce, no interactive proof point. A simple calculator that estimates savings from a postal code would convert.',
    cmsHint:null },
  { complexity:'low', areas:['content'], hours:6, site:'jorek-music.com', impact:0.41,
    title:'Add an FAQ block under the booking form',
    pitch:'Booking form has 41% drop-off; the most common questions aren\'t answered nearby. An inline FAQ would recover ~20% of those.',
    cmsHint:{ cms:'TYPO3', text:'EXT:faq fits — accordion variant.'} },
];
const BriefInbox = () => (
  <div>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
      <h2 style={{fontFamily:'var(--font-display)',fontWeight:500,fontSize:22,letterSpacing:'-0.015em',margin:0}}>Brief inbox</h2>
      <div style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--ink-3)'}}>50 total · 28 open</div>
    </div>
    <FilterBar/>
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {BRIEFS.map((b,i) => <PitchCard key={i} brief={b}/>)}
    </div>
  </div>
);
window.BriefInbox = BriefInbox;
