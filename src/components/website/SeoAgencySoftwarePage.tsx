import { Link } from 'react-router-dom';
import WebsiteLayout, { SectionCTA, InternalLinks } from './WebsiteLayout';

export default function SeoAgencySoftwarePage({ onOpenApp }: { onOpenApp: () => void }) {
  return (
    <WebsiteLayout
      onOpenApp={onOpenApp}
      title="SEO Agency Software — Manage 10x More Clients with AI Automation | SEAUTO"
      description="The SEO agency platform that scales with you. Automate audits, content, keyword tracking, and website improvements across all client projects. Handle 10x more clients with the same team."
    >
      {/* Hero */}
      <section className="pt-16 pb-20 lg:pt-24 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F5F0FF] via-white to-[#F0F7FF]" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider mb-6">For SEO Agencies</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Take on <span className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent">10x More Clients.</span> Same Team.
            </h1>
            <p className="text-xl text-[#6E6E73] leading-relaxed mb-8">
              SEAUTO automates the grunt work — audits, content, keyword tracking, and execution — so your team can focus on strategy and client relationships. At $30/project/month, the math changes everything.
            </p>
            <button onClick={onOpenApp} className="px-8 py-3.5 rounded-full bg-[#0071E3] text-white font-semibold hover:bg-[#0077ED] transition-all shadow-lg cursor-pointer">
              Start Your First Project Free
            </button>
          </div>
        </div>
      </section>

      {/* The Agency Problem */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">The Agency Scaling Problem</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-3xl mx-auto mb-14">Every SEO agency hits the same wall: more clients = more work = more hires. SEAUTO breaks that equation.</p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-7 border border-red-100">
              <h3 className="text-lg font-bold text-red-600 mb-4">Without SEAUTO</h3>
              <ul className="space-y-3">
                {['1 SEO specialist per 5-8 clients', 'Manual site audits: 2-4 hours each', 'Content creation: outsource or hire writers', 'Keyword tracking across 5 different tools', 'Client reports take hours to compile', 'New client onboarding takes weeks'].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#6E6E73]">
                    <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-7 border border-green-100">
              <h3 className="text-lg font-bold text-green-600 mb-4">With SEAUTO</h3>
              <ul className="space-y-3">
                {['1 account manager per 30-50 clients', 'Automated site audits: minutes per site', 'AI content generation with marketing frameworks', 'All keyword tracking in one platform', 'Automated activity logs and task tracking', 'New client onboarding in a single session'].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#6E6E73]">
                    <svg className="w-4 h-4 shrink-0 mt-0.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Agency Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-14">Everything an Agency Needs</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Multi-Project Management', desc: 'Each client is a separate project with its own keywords, audits, content, and task list. Switch between projects instantly. No data bleed between accounts.' },
              { title: 'Comprehensive Auditing', desc: 'Run 6 simultaneous audit types across every client site. Technical SEO, content, AEO, schema, compliance, and speed — all in one crawl. Delivers the depth clients expect from premium agencies.', link: '/features/seo-audit-tool' },
              { title: 'Automated Content Pipeline', desc: 'Generate blog posts, audit existing content, and schedule publishing — all per client. Stop outsourcing to freelance writers who miss your SEO requirements.', link: '/features/ai-content-generator' },
              { title: 'Keyword Intelligence', desc: 'Track every keyword across every client. AI-powered intent classification and optimization recommendations mean your team spends time on strategy, not spreadsheets.', link: '/features/keyword-rank-tracker' },
              { title: 'Ad Account Auditing', desc: 'Audit Google Ads, Meta Ads, LinkedIn, and Reddit ad accounts. Identify wasted spend, optimize budgets, and generate keyword lists for PPC campaigns — all from one platform.', link: '/features/google-ads-optimization' },
              { title: 'Activity Logging', desc: 'Every action across every section is logged. Audits run, keywords scanned, pages built, tasks completed — a complete audit trail for client transparency and reporting.' },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-7 border border-gray-100 hover:shadow-lg transition-all">
                <h3 className="text-lg font-bold mb-3">{f.title}</h3>
                <p className="text-sm text-[#6E6E73] leading-relaxed mb-3">{f.desc}</p>
                {f.link && <Link to={f.link} className="text-sm text-[#0071E3] font-medium hover:underline">Learn more &rarr;</Link>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Revenue math */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">The Revenue Math</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-3xl mx-auto mb-14">At $30/project/month for SEAUTO, every additional client is almost pure profit.</p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto text-center">
            {[
              { label: 'You charge per client', val: '$1,500-5,000/mo', sub: 'Industry-standard SEO retainer' },
              { label: 'SEAUTO costs you', val: '$30/client/mo', sub: 'Plus plan, per project' },
              { label: 'Your margin per client', val: '97-99%', sub: 'Near-total automation' },
            ].map((r) => (
              <div key={r.label} className="bg-white rounded-2xl p-7 border border-gray-100">
                <div className="text-sm font-bold text-[#86868B] uppercase tracking-wider mb-3">{r.label}</div>
                <div className="text-3xl font-bold text-[#1D1D1F] mb-1">{r.val}</div>
                <div className="text-sm text-[#6E6E73]">{r.sub}</div>
              </div>
            ))}
          </div>
          <p className="text-center mt-10 text-[#6E6E73]">
            An agency managing 50 clients at $2,000/month = <span className="font-bold text-[#1D1D1F]">$100,000/month revenue</span> with <span className="font-bold text-[#1D1D1F]">$1,500/month</span> in SEAUTO costs.
          </p>
        </div>
      </section>

      {/* AI Bot future */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-[#0071E3]/10 text-[#0071E3] text-xs font-bold uppercase tracking-wider mb-6">Coming Soon</span>
          <h2 className="text-3xl font-bold mb-4">The Autonomous Execution Bot</h2>
          <p className="text-lg text-[#6E6E73] max-w-3xl mx-auto mb-8">
            The next evolution: an AI bot that connects to your clients' websites and <strong>automatically implements every recommendation</strong>. Meta tag updates, schema additions, content deployments, compliance fixes — all executed without manual intervention. Your team reviews; the bot executes.
          </p>
          <Link to="/pricing" className="text-[#0071E3] font-medium hover:underline">Available on the Managed Digital plan &rarr;</Link>
        </div>
      </section>

      <SectionCTA onOpenApp={onOpenApp} />

      <InternalLinks links={[
        { to: '/features/seo-audit-tool', label: 'SEO Audit Tool', desc: 'Run 6 audit types simultaneously across every client site.' },
        { to: '/features/ai-content-generator', label: 'AI Content Generator', desc: 'Automated content creation for every client, every month.' },
        { to: '/features/keyword-rank-tracker', label: 'Keyword Rank Tracker', desc: 'Track keywords across all client projects in one platform.' },
        { to: '/compare/seauto-vs-hiring', label: 'SEAUTO vs Hiring', desc: 'See how SEAUTO compares to expanding your team.' },
        { to: '/pricing', label: 'View Pricing', desc: '$30/project/month — designed for agency economics.' },
        { to: '/solutions/small-business-seo', label: 'Small Business SEO', desc: 'Many of your clients are small businesses — show them the value.' },
      ]} />
    </WebsiteLayout>
  );
}
