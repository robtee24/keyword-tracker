import { Link } from 'react-router-dom';
import WebsiteLayout, { SectionCTA, InternalLinks } from './WebsiteLayout';

export default function KeywordRankTrackerPage({ onOpenApp }: { onOpenApp: () => void }) {
  return (
    <WebsiteLayout
      onOpenApp={onOpenApp}
      title="Keyword Rank Tracker — Daily Position Monitoring & AI Recommendations | SEAUTO"
      description="Track every keyword your website ranks for with daily position updates, historical trend analysis, intent classification, and AI-powered optimization recommendations."
    >
      {/* Hero */}
      <section className="pt-16 pb-20 lg:pt-24 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F0F7FF] via-white to-[#F0FFFA]" />
        <div className="absolute top-20 left-0 w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-6">Keyword Tracking</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Track Every Keyword. <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">See Every Opportunity.</span>
            </h1>
            <p className="text-xl text-[#6E6E73] leading-relaxed mb-8">
              SEAUTO doesn't just track rankings — it analyzes search intent, detects new and lost keywords, groups them strategically, and generates AI-powered recommendations to improve every position.
            </p>
            <button onClick={onOpenApp} className="px-8 py-3.5 rounded-full bg-[#0071E3] text-white font-semibold hover:bg-[#0077ED] transition-all shadow-lg cursor-pointer">
              Start Tracking for Free
            </button>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-14">Complete Keyword Intelligence</h2>
          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {[
              { title: 'Real-Time Position Tracking', desc: 'See where you rank for every keyword across Google Search Console. Daily updates with historical comparison so you can track progress over any time period. Compare week-over-week, month-over-month, or any custom date range.', color: 'from-blue-500 to-cyan-500' },
              { title: 'Intent Classification', desc: 'Every keyword is automatically classified by search intent — informational, transactional, navigational, branded, or competitor. SEAUTO uses AI and your business objectives to determine which keywords matter most for your conversion goals.', color: 'from-violet-500 to-purple-500' },
              { title: 'New & Lost Keyword Detection', desc: 'Instantly know when you start ranking for new keywords or lose positions on existing ones. "New" keywords are those appearing for the first time with no prior history. "Lost" keywords haven\'t been seen in over 30 days — tracked in a dedicated section.', color: 'from-emerald-500 to-teal-500' },
              { title: 'Search Volume Integration', desc: 'See estimated monthly search volume for every keyword. Volumes are refreshed monthly and cached daily so they load instantly. Numbers are parsed intelligently — "4.4K" displays as 4,400 with proper formatting.', color: 'from-amber-500 to-orange-500' },
              { title: 'Keyword Grouping', desc: 'Organize keywords into strategic groups. View group-level metrics, run group-level recommendation scans, and manage your keyword strategy across related terms. Add or remove keywords from groups with a single click.', color: 'from-rose-500 to-pink-500' },
              { title: 'AI-Powered Recommendations', desc: 'For every keyword, SEAUTO generates specific optimization recommendations. Not "improve your content" — but exactly what to change, what to add, and what to fix on the specific page that ranks. Recommendations are prioritized to avoid keyword cannibalization.', color: 'from-indigo-500 to-blue-500' },
            ].map((f) => (
              <div key={f.title} className="flex gap-5">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center shrink-0 mt-1`}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                  <p className="text-[#6E6E73] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* vs competitors */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">More Than a Rank Tracker</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-3xl mx-auto mb-14">
            Traditional rank trackers show you positions. SEAUTO shows you positions <em>and tells you exactly how to improve them</em>. Every keyword connects to our <Link to="/features/seo-audit-tool" className="text-[#0071E3] hover:underline">SEO audit engine</Link>, <Link to="/features/ai-content-generator" className="text-[#0071E3] hover:underline">content generator</Link>, and <Link to="/features/ai-website-builder" className="text-[#0071E3] hover:underline">website builder</Link>.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full max-w-3xl mx-auto">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#1D1D1F]">Capability</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-[#6E6E73]">Basic Trackers</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-[#0071E3]">SEAUTO</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ['Daily position tracking', true, true],
                  ['Search volume data', true, true],
                  ['Intent classification', false, true],
                  ['AI optimization recommendations', false, true],
                  ['Keyword grouping & strategy', false, true],
                  ['Direct integration with page builder', false, true],
                  ['Automated execution of improvements', false, true],
                ].map(([label, basic, seauto], i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-3 px-4 text-[#1D1D1F]">{label as string}</td>
                    <td className="text-center py-3 px-4">{basic ? <span className="text-green-500">Yes</span> : <span className="text-gray-300">No</span>}</td>
                    <td className="text-center py-3 px-4"><span className="text-green-500 font-medium">Yes</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-14">Built for How You Actually Work</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Small Business Owners', desc: 'See which keywords bring traffic, which need attention, and let AI handle the optimization. No SEO expertise required.', link: '/solutions/small-business-seo', linkLabel: 'Learn about small business SEO' },
              { title: 'In-House Marketing Teams', desc: 'Replace 3 different tools with one platform. Track keywords, get recommendations, and execute improvements — all in one place.', link: '/compare/seauto-vs-hiring', linkLabel: 'See the cost comparison' },
              { title: 'SEO Agencies', desc: 'Track keywords across all client projects. Run bulk recommendation scans. Generate reports that show exactly what was improved and why.', link: '/solutions/seo-agency-software', linkLabel: 'Built for agencies' },
            ].map((u) => (
              <div key={u.title} className="bg-white rounded-2xl p-7 border border-gray-100 hover:shadow-lg transition-all">
                <h3 className="text-lg font-bold mb-3">{u.title}</h3>
                <p className="text-[#6E6E73] mb-4 leading-relaxed">{u.desc}</p>
                <Link to={u.link} className="text-sm font-medium text-[#0071E3] hover:underline">{u.linkLabel} &rarr;</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionCTA onOpenApp={onOpenApp} />

      <InternalLinks links={[
        { to: '/features/seo-audit-tool', label: 'SEO Audit Tool', desc: 'Run 6 specialized audits and get exact code-level fixes for every page.' },
        { to: '/features/ai-content-generator', label: 'AI Content Generator', desc: 'Generate SEO-optimized blog posts targeting your highest-opportunity keywords.' },
        { to: '/features/google-ads-optimization', label: 'Google Ads Optimization', desc: 'Turn your organic keyword data into high-converting ad campaigns.' },
        { to: '/pricing', label: 'View Pricing', desc: 'Start tracking keywords for free. Upgrade for unlimited scans and AI recommendations.' },
        { to: '/resources/automated-seo', label: 'Automated SEO Guide', desc: 'Learn how keyword tracking fits into a fully automated SEO strategy.' },
        { to: '/solutions/small-business-seo', label: 'Small Business SEO', desc: 'How SEAUTO helps small businesses compete with big-budget competitors.' },
      ]} />
    </WebsiteLayout>
  );
}
