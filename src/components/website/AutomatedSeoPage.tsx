import { Link } from 'react-router-dom';
import WebsiteLayout, { SectionCTA, InternalLinks } from './WebsiteLayout';

export default function AutomatedSeoPage({ onOpenApp }: { onOpenApp: () => void }) {
  return (
    <WebsiteLayout
      onOpenApp={onOpenApp}
      title="Automated SEO Platform — AI-Powered Search Engine Optimization | SEAUTO"
      description="Learn how automated SEO works and why AI-powered SEO automation is replacing manual processes. SEAUTO automates audits, content, keyword optimization, and execution."
    >
      <section className="pt-16 pb-20 lg:pt-24 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F0F7FF] via-white to-[#F5F0FF]" />
        <div className="absolute top-10 left-0 w-[600px] h-[600px] bg-blue-200/15 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-6">SEO Automation Guide</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              What Is <span className="bg-gradient-to-r from-[#0071E3] to-[#00C2FF] bg-clip-text text-transparent">Automated SEO?</span>
            </h1>
            <p className="text-xl text-[#6E6E73] leading-relaxed mb-8">
              Automated SEO uses artificial intelligence to perform the tasks traditionally done by SEO specialists, content writers, and web developers — faster, more consistently, and at a fraction of the cost. Here's how it works and why it's the future of digital marketing.
            </p>
            <button onClick={onOpenApp} className="px-8 py-3.5 rounded-full bg-[#0071E3] text-white font-semibold hover:bg-[#0077ED] transition-all shadow-lg cursor-pointer">
              Try Automated SEO Free
            </button>
          </div>
        </div>
      </section>

      {/* What gets automated */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4">What Can Be Automated in SEO?</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-3xl mx-auto mb-14">Almost everything. The key insight is that most SEO work follows patterns — and patterns are exactly what AI excels at.</p>

          <div className="space-y-6 max-w-4xl mx-auto">
            {[
              { title: 'Site Auditing', manual: '4-8 hours per site, repeated quarterly', automated: 'Complete in minutes, run anytime', desc: 'Traditional SEO audits require manually crawling pages, checking meta tags, validating schema, testing accessibility, and measuring speed. SEAUTO runs 6 specialized audits simultaneously with a single crawl.', link: '/features/seo-audit-tool', linkLabel: 'See the SEO Audit Tool' },
              { title: 'Keyword Research & Tracking', manual: 'Multiple tools, daily manual checks', automated: 'Automatic discovery, daily updates, AI analysis', desc: 'Instead of juggling SEMrush, Ahrefs, and Google Search Console, SEAUTO tracks every keyword automatically, classifies intent with AI, detects new and lost keywords, and generates optimization recommendations.', link: '/features/keyword-rank-tracker', linkLabel: 'See Keyword Tracking' },
              { title: 'Content Creation', manual: '$200-500 per blog post, 2-5 day turnaround', automated: 'Generated in minutes, SEO-optimized from the start', desc: 'AI content generation has advanced dramatically. SEAUTO writes blog posts using copywriting frameworks (AIDA, PAS), targets specific keywords with real search volume data, and can schedule automatic publishing.', link: '/features/ai-content-generator', linkLabel: 'See the Content Generator' },
              { title: 'Page Building & Optimization', manual: 'Designer + developer, $500-2,000 per page', automated: 'Built in minutes, matches your existing design', desc: 'SEAUTO\'s AI website builder analyzes your site\'s styling, applies 115+ marketing frameworks, and generates conversion-optimized pages. It can rebuild existing pages or create entirely new ones.', link: '/features/ai-website-builder', linkLabel: 'See the AI Builder' },
              { title: 'Compliance Checking', manual: 'Specialized consultants, $2,000+ per audit', automated: '10 standards checked per page, automatically', desc: 'WCAG, GDPR, CCPA, ADA — compliance requirements are complex and constantly changing. SEAUTO checks against 10 standards and provides exact fixes with specific code changes.', link: '/features/compliance-checker', linkLabel: 'See Compliance Checking' },
              { title: 'Task Execution', manual: 'Developers implementing changes one by one', automated: 'AI bot implements changes automatically (coming soon)', desc: 'The final frontier: SEAUTO\'s upcoming execution bot will connect to your CMS and automatically implement every recommendation — meta tag updates, schema additions, content deployments, and compliance fixes.' },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-2xl p-7 border border-gray-100">
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div className="bg-red-50 rounded-xl p-4">
                    <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Manual</span>
                    <p className="text-sm text-[#6E6E73] mt-1">{item.manual}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4">
                    <span className="text-xs font-bold text-green-600 uppercase tracking-wider">Automated</span>
                    <p className="text-sm text-[#6E6E73] mt-1">{item.automated}</p>
                  </div>
                </div>
                <p className="text-[#6E6E73] leading-relaxed">{item.desc}</p>
                {item.link && <Link to={item.link} className="inline-block mt-3 text-sm text-[#0071E3] font-medium hover:underline">{item.linkLabel} &rarr;</Link>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who benefits */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-14">Who Benefits from Automated SEO?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Small Businesses', desc: 'Get enterprise-level SEO without enterprise-level budgets. SEAUTO replaces the marketing team you can\'t afford to hire.', link: '/solutions/small-business-seo', linkLabel: 'Small business guide' },
              { title: 'Enterprise Marketing Teams', desc: 'Let your team focus on strategy while AI handles the execution. One person can manage what used to require 10.', link: '/compare/seauto-vs-hiring', linkLabel: 'See the comparison' },
              { title: 'SEO Agencies', desc: 'Take on dramatically more clients without hiring. Automate audits, content, and reporting across your entire client base.', link: '/solutions/seo-agency-software', linkLabel: 'Agency platform' },
            ].map((w) => (
              <div key={w.title} className="bg-white rounded-2xl p-7 border border-gray-100">
                <h3 className="text-lg font-bold mb-3">{w.title}</h3>
                <p className="text-[#6E6E73] leading-relaxed mb-3">{w.desc}</p>
                <Link to={w.link} className="text-sm text-[#0071E3] font-medium hover:underline">{w.linkLabel} &rarr;</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The future */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">The Future: Fully Autonomous SEO</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-3xl mx-auto mb-8">
            Today, SEAUTO automates analysis, recommendations, and content generation. Tomorrow, it will automate execution too. The AI bot will connect to any web platform and implement every improvement automatically — auditing, optimizing, building, and deploying without human intervention.
          </p>
          <p className="text-lg text-[#6E6E73] text-center max-w-3xl mx-auto mb-8">
            This isn't replacing human judgment — it's amplifying it. You set the strategy, objectives, and priorities. SEAUTO handles the rest.
          </p>
          <div className="text-center">
            <button onClick={onOpenApp} className="px-8 py-3.5 rounded-full bg-[#0071E3] text-white font-semibold hover:bg-[#0077ED] transition-all shadow-lg cursor-pointer">
              Start Automating Today
            </button>
          </div>
        </div>
      </section>

      <SectionCTA onOpenApp={onOpenApp} />

      <InternalLinks links={[
        { to: '/features/seo-audit-tool', label: 'SEO Audit Tool', desc: 'The first step in automation: comprehensive site auditing with exact fixes.' },
        { to: '/features/keyword-rank-tracker', label: 'Keyword Rank Tracker', desc: 'Automated keyword monitoring with AI-powered optimization.' },
        { to: '/features/ai-content-generator', label: 'AI Content Generator', desc: 'Automated content creation using proven marketing frameworks.' },
        { to: '/features/ai-website-builder', label: 'AI Website Builder', desc: 'Automated page building and optimization.' },
        { to: '/solutions/small-business-seo', label: 'Small Business SEO', desc: 'How automation makes expert SEO accessible to every business.' },
        { to: '/pricing', label: 'View Pricing', desc: 'Start automating for free, upgrade as you grow.' },
      ]} />
    </WebsiteLayout>
  );
}
