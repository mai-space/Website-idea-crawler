// Closing CTA band — paper-2 surface, single accent action.
const CTASection = () => (
  <section style={{padding:'96px 48px',background:'var(--ink)',color:'var(--paper)'}}>
    <div style={{maxWidth:880,margin:'0 auto',textAlign:'center'}}>
      <h2 style={{fontFamily:'var(--font-display)',fontWeight:400,fontSize:48,lineHeight:1.1,letterSpacing:'-0.02em',margin:0,color:'var(--paper)'}}>
        Twenty briefs by tomorrow morning.
      </h2>
      <p style={{fontSize:18,lineHeight:1.55,color:'#B8BCC4',marginTop:18,marginBottom:32}}>
        Add your first site in under a minute. The first crawl finishes while you read this paragraph.
      </p>
      <a href="#" style={{
        display:'inline-block',background:'var(--accent)',color:'#fff',
        padding:'14px 26px',borderRadius:8,fontSize:15,fontWeight:500,textDecoration:'none',
      }}>Start a 14-day trial</a>
      <div style={{marginTop:14,fontSize:13,color:'#8A8F97'}}>No credit card · 3 sites · 500 pages each</div>
    </div>
  </section>
);
window.CTASection = CTASection;
