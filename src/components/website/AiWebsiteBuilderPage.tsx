import { Link } from 'react-router-dom';
import WebsiteLayout, { SectionCTA, InternalLinks } from './WebsiteLayout';

export default function AiWebsiteBuilderPage({ onOpenApp }: { onOpenApp: () => void }) {
  return (
    <WebsiteLayout
      onOpenApp={onOpenApp}
      title="AI Website Builder — Rebuild or Create Pages with Marketing Intelligence | SEAUTO"
      description="Build conversion-optimized web pages using AI powered by 115+ marketing skills, CRO frameworks, and your existing site design. Rebuild existing pages or generate new ones from scratch."
    >
      <section className="pt-16 pb-20 lg:pt-24 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F0FFF4] via-white to-[#F0F7FF]" />
        <div className="absolute top-10 left-10 w-[500px] h-[500px] bg-emerald-200/20 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-6">AI Website Builder</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              AI That Builds Pages <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">That Actually Convert</span>
            </h1>
            <p className="text-xl text-[#6E6E73] leading-relaxed mb-8">
              Not a generic page builder. SEAUTO's AI analyzes your existing site's design, applies 115+ marketing frameworks, and generates pages optimized for SEO, conversions, and user experience — matching your brand perfectly.
            </p>
            <button onClick={onOpenApp} className="px-8 py-3.5 rounded-full bg-[#0071E3] text-white font-semibold hover:bg-[#0077ED] transition-all shadow-lg cursor-pointer">
              Try the Builder Free
            </button>
          </div>
        </div>
      </section>

      {/* Two Modes */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-14">Two Powerful Modes</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">Rebuild Existing Pages</h3>
              <p className="text-[#6E6E73] leading-relaxed mb-4">Select any page from your sitemap and let AI rebuild it. SEAUTO pulls all existing content, applies <Link to="/features/seo-audit-tool" className="text-[#0071E3] hover:underline">audit recommendations</Link>, and generates an improved version that keeps your design while maximizing conversions.</p>
              <ul className="space-y-2">
                {['Validates URL against your full sitemap', 'Applies all pending audit recommendations', 'Matches your existing site styling automatically', 'Preview before deploying', 'Before/after change tracking'].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#6E6E73]">
                    <svg className="w-4 h-4 shrink-0 mt-0.5 text-[#34C759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">Create New Pages</h3>
              <p className="text-[#6E6E73] leading-relaxed mb-4">AI analyzes your site and suggests 20 pages you're missing — service pages, landing pages, comparison pages, FAQ pages, and more. Each suggestion includes why it's needed and what purpose it serves.</p>
              <ul className="space-y-2">
                {['20 AI-suggested pages based on site gaps', 'Custom page wizard for specific needs', 'Service, landing, product, comparison, FAQ, and more', 'Schema markup and internal linking included', 'Image suggestions with alt text'].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#6E6E73]">
                    <svg className="w-4 h-4 shrink-0 mt-0.5 text-[#34C759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Marketing Skills */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">115+ Marketing Skills Built In</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-3xl mx-auto mb-14">Every page is built using proven marketing frameworks that top agencies charge thousands to apply.</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              { title: 'Copywriting', items: ['AIDA Framework', 'PAS (Problem-Agitate-Solve)', 'Features → Benefits bridging', 'Headline formulas'] },
              { title: 'CRO & Psychology', items: ['Scarcity & urgency signals', 'Social proof placement', 'Trust indicators', 'Decision fatigue reduction'] },
              { title: 'SEO Optimization', items: ['Title & meta optimization', 'Heading hierarchy (H1-H6)', 'Internal linking strategy', 'Schema markup generation'] },
              { title: 'Design Matching', items: ['Home page color extraction', 'Font family detection', 'Spacing & layout patterns', 'CSS variable matching'] },
              { title: 'Content Structure', items: ['Above-fold optimization', 'Scannable formatting', 'Visual hierarchy', 'Mobile-first layout'] },
              { title: 'Conversion Elements', items: ['CTA placement strategy', 'Form optimization', 'Exit intent elements', 'Lead capture design'] },
            ].map((cat) => (
              <div key={cat.title} className="bg-white rounded-xl p-5 border border-gray-100">
                <h3 className="font-bold text-sm mb-3">{cat.title}</h3>
                <ul className="space-y-1.5">
                  {cat.items.map((item, i) => (
                    <li key={i} className="text-xs text-[#6E6E73] flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#0071E3] shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Page types */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Page Types You Can Build</h2>
          <p className="text-lg text-[#6E6E73] max-w-2xl mx-auto mb-10">SEAUTO suggests and builds the page types that matter most for conversions and SEO.</p>
          <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
            {['Landing Pages', 'Service Pages', 'Product Pages', 'Comparison Pages', 'FAQ Pages', 'Case Study Pages', 'Pricing Pages', 'About/Team Pages', 'Industry Pages', 'Location Pages', 'Integration Pages', 'Testimonial Pages', 'Tool/Calculator Pages', 'Resource Hubs'].map((type) => (
              <span key={type} className="px-4 py-2 rounded-full bg-gray-100 text-sm font-medium text-[#1D1D1F]">{type}</span>
            ))}
          </div>
        </div>
      </section>

      <SectionCTA onOpenApp={onOpenApp} />

      <InternalLinks links={[
        { to: '/features/seo-audit-tool', label: 'SEO Audit Tool', desc: 'Audit results feed directly into the page builder for one-click improvements.' },
        { to: '/features/ai-content-generator', label: 'AI Content Generator', desc: 'Build blog posts alongside web pages — same marketing intelligence.' },
        { to: '/features/keyword-rank-tracker', label: 'Keyword Rank Tracker', desc: 'Track how rebuilt pages improve in search rankings over time.' },
        { to: '/solutions/seo-agency-software', label: 'For SEO Agencies', desc: 'Build pages for every client, matching each site\'s unique design.' },
        { to: '/solutions/small-business-seo', label: 'Small Business SEO', desc: 'Build professional pages without hiring a web developer.' },
        { to: '/pricing', label: 'View Pricing', desc: 'Free plan includes 1 page build. Plus includes 5/month.' },
      ]} />
    </WebsiteLayout>
  );
}
