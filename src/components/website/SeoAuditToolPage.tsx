import { Link } from 'react-router-dom';
import WebsiteLayout, { SectionCTA, InternalLinks } from './WebsiteLayout';

export default function SeoAuditToolPage({ onOpenApp }: { onOpenApp: () => void }) {
  return (
    <WebsiteLayout
      onOpenApp={onOpenApp}
      title="Free SEO Audit Tool — 6 Specialized Website Audits | SEAUTO"
      description="Run comprehensive SEO audits across your entire website. 6 specialized audit types: technical SEO, content, AEO, schema, compliance, and page speed. Get exact fixes, not vague suggestions."
    >
      {/* Hero */}
      <section className="pt-16 pb-20 lg:pt-24 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F0F0FF] via-white to-[#F0F7FF]" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-violet-200/20 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-bold uppercase tracking-wider mb-6">SEO Audit Tool</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              The Most Comprehensive <span className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent">SEO Audit Tool</span> Ever Built
            </h1>
            <p className="text-xl text-[#6E6E73] leading-relaxed mb-8">
              Most SEO audit tools tell you <em>"your title tag needs improvement."</em> SEAUTO tells you exactly what to replace it with, the specific HTML to add, and the precise configuration to deploy — down to copy-paste code.
            </p>
            <div className="flex flex-wrap gap-4">
              <button onClick={onOpenApp} className="px-8 py-3.5 rounded-full bg-[#0071E3] text-white font-semibold hover:bg-[#0077ED] transition-all shadow-lg cursor-pointer">
                Run Your Free Audit
              </button>
              <Link to="/pricing" className="px-8 py-3.5 rounded-full border border-gray-200 font-semibold text-[#1D1D1F] hover:bg-gray-50 transition-all">
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6 Audit Types */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4">6 Specialized Audits, One Crawl</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-2xl mx-auto mb-14">Select which audits to run, and SEAUTO crawls each page only once — saving time while delivering the deepest analysis possible.</p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Technical SEO Audit', color: 'from-blue-500 to-cyan-500', items: ['Title tag optimization with exact replacement text', 'Meta description analysis and rewrites', 'Heading hierarchy validation (H1-H6)', 'Internal linking opportunities with specific anchor text', 'Canonical tag verification and fixes', 'Crawlability and indexation issues'] },
              { title: 'Content Audit', color: 'from-amber-500 to-orange-500', items: ['Copy quality scoring with AI analysis', 'Conversion rate optimization recommendations', 'Marketing psychology framework application', 'Content gap identification', 'Readability and engagement scoring', 'Call-to-action placement and effectiveness'] },
              { title: 'AEO Audit', color: 'from-emerald-500 to-teal-500', items: ['AI search engine optimization analysis', 'ChatGPT, Perplexity, and Google AI Overview readiness', 'Featured snippet optimization', 'Question-based content structure', 'Entity and topic authority mapping', 'Conversational search readiness'] },
              { title: 'Schema Audit', color: 'from-rose-500 to-pink-500', items: ['Structured data validation and error detection', 'Missing schema type identification', 'Rich snippet opportunity analysis', 'JSON-LD generation with exact code', 'Organization, Product, FAQ, How-To schema', 'Breadcrumb and sitelinks schema'] },
              { title: 'Compliance Audit', color: 'from-red-500 to-rose-500', items: ['WCAG 2.0/2.1/2.2 Level A & AA testing', 'GDPR and CCPA cookie consent validation', 'Section 508 accessibility verification', 'TLS, HSTS, and CSP header checks', 'PCI DSS security assessment', 'Pass/fail verdict for each of 10 standards'] },
              { title: 'Page Speed Audit', color: 'from-indigo-500 to-violet-500', items: ['Core Web Vitals analysis (LCP, FID, CLS)', 'Render-blocking resource identification', 'Image optimization recommendations', 'Third-party script impact analysis', 'CSS and JavaScript optimization', 'Lazy loading and preload opportunities'] },
            ].map((audit) => (
              <div key={audit.title} className="bg-white rounded-2xl p-7 border border-gray-100 hover:shadow-lg transition-all">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${audit.color} flex items-center justify-center mb-4`}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-3">{audit.title}</h3>
                <ul className="space-y-2">
                  {audit.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#6E6E73]">
                      <svg className="w-4 h-4 shrink-0 mt-0.5 text-[#34C759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Differs */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-14">What Makes SEAUTO's SEO Audit Different</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-8 border border-red-100">
              <h3 className="text-lg font-bold text-red-600 mb-4">Other SEO Audit Tools</h3>
              <ul className="space-y-3 text-[#6E6E73]">
                {['"Your title tag could be improved"', '"Consider adding structured data"', '"Page speed needs work"', '"Add alt text to images"', 'Generic checklist with no context'].map((item, i) => (
                  <li key={i} className="flex items-start gap-2"><svg className="w-4 h-4 shrink-0 mt-1 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg><span className="text-sm">{item}</span></li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-8 border border-green-100">
              <h3 className="text-lg font-bold text-green-600 mb-4">SEAUTO's SEO Audit</h3>
              <ul className="space-y-3 text-[#6E6E73]">
                {['"Replace your title with: \'Best Tax Attorney in Dallas | Free Consultation | Smith Law\'"', '"Add this exact JSON-LD: {\"@type\":\"LocalBusiness\"...}"', '"Defer these 3 scripts: analytics.js, chat-widget.js, tracking.min.js"', '"Add alt=\'Tax attorney reviewing documents with client\' to hero image"', 'Page-specific recommendations with copy-paste code'].map((item, i) => (
                  <li key={i} className="flex items-start gap-2"><svg className="w-4 h-4 shrink-0 mt-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span className="text-sm">{item}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Scale */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Audit Your Entire Site in Minutes</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-2xl mx-auto mb-14">SEAUTO automatically discovers every page in your sitemap and audits them all simultaneously. Whether you have 10 pages or 10,000 — results come back fast.</p>
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto text-center">
            {[
              { stat: '6', label: 'Audit Types', sub: 'Run simultaneously' },
              { stat: '10', label: 'Compliance Standards', sub: 'Checked per page' },
              { stat: '100%', label: 'Actionable', sub: 'Every recommendation is specific' },
            ].map((s) => (
              <div key={s.label} className="p-6">
                <div className="text-4xl font-bold bg-gradient-to-r from-[#0071E3] to-[#00C2FF] bg-clip-text text-transparent mb-2">{s.stat}</div>
                <div className="font-semibold text-[#1D1D1F] mb-1">{s.label}</div>
                <div className="text-sm text-[#6E6E73]">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow integration */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">From Audit to Execution — Fully Integrated</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-2xl mx-auto mb-14">
            Every recommendation from your SEO audit flows directly into your <Link to="/features/ai-website-builder" className="text-[#0071E3] hover:underline">AI Website Builder</Link> and task management system. Fix issues with one click, or let the <strong>AI bot execute them automatically</strong>.
          </p>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Audit', desc: 'Run 6 specialized audits across your entire site' },
              { step: '2', title: 'Prioritize', desc: 'Recommendations are ranked by impact and effort' },
              { step: '3', title: 'Tasklist', desc: 'Add to your integrated task management system' },
              { step: '4', title: 'Execute', desc: 'Fix manually, rebuild with AI, or let the bot handle it' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0071E3] to-[#00C2FF] flex items-center justify-center mx-auto mb-4 text-white font-bold">{s.step}</div>
                <h3 className="font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-[#6E6E73]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionCTA onOpenApp={onOpenApp} />

      <InternalLinks links={[
        { to: '/features/keyword-rank-tracker', label: 'Keyword Rank Tracker', desc: 'Monitor every keyword your site ranks for with daily updates and AI-powered recommendations.' },
        { to: '/features/compliance-checker', label: 'Website Compliance Checker', desc: 'Test against WCAG, GDPR, CCPA, and 7 more standards with pass/fail verdicts.' },
        { to: '/features/ai-website-builder', label: 'AI Website Builder', desc: 'Rebuild pages or create new ones using 115+ marketing skills and your existing design.' },
        { to: '/features/ai-content-generator', label: 'AI Content Generator', desc: 'Generate SEO-optimized blog posts and web pages with proven marketing frameworks.' },
        { to: '/solutions/seo-agency-software', label: 'For SEO Agencies', desc: 'Handle 10x more clients with automated audits, reporting, and execution.' },
        { to: '/resources/automated-seo', label: 'What is Automated SEO?', desc: 'Learn how AI-powered SEO automation works and why it\'s replacing manual processes.' },
      ]} />
    </WebsiteLayout>
  );
}
