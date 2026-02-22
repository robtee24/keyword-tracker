import { Link } from 'react-router-dom';
import WebsiteLayout, { SectionCTA, InternalLinks } from './WebsiteLayout';

export default function SmallBusinessSeoPage({ onOpenApp }: { onOpenApp: () => void }) {
  return (
    <WebsiteLayout
      onOpenApp={onOpenApp}
      title="SEO for Small Business — Replace Your Marketing Team with AI | SEAUTO"
      description="Small business SEO automation that replaces an entire marketing team. Get expert-level SEO audits, content creation, keyword tracking, and website optimization without hiring anyone."
    >
      {/* Hero */}
      <section className="pt-16 pb-20 lg:pt-24 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F0F7FF] via-white to-[#F0FFF4]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-200/20 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-6">For Small Businesses</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Expert SEO Without the <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">Expert Price Tag</span>
            </h1>
            <p className="text-xl text-[#6E6E73] leading-relaxed mb-8">
              You don't need a $10,000/month marketing agency or a full-time SEO hire. SEAUTO gives you the same expertise, the same tools, and the same results — powered by AI, starting at $0.
            </p>
            <div className="flex flex-wrap gap-4">
              <button onClick={onOpenApp} className="px-8 py-3.5 rounded-full bg-[#0071E3] text-white font-semibold hover:bg-[#0077ED] transition-all shadow-lg cursor-pointer">
                Start Free — No Credit Card
              </button>
              <Link to="/compare/seauto-vs-hiring" className="px-8 py-3.5 rounded-full border border-gray-200 font-semibold text-[#1D1D1F] hover:bg-gray-50 transition-all">
                See the Cost Comparison
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4">The Small Business SEO Problem</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-3xl mx-auto mb-14">
            Small businesses know they need SEO, but the options have always been expensive, confusing, or both.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Hiring an SEO Specialist', cost: '$4,000-8,000/mo', desc: 'A qualified SEO specialist costs $50-100K/year. For most small businesses, that\'s an entire additional salary — and one person can\'t cover SEO, content, web development, compliance, and advertising.' },
              { title: 'Hiring an Agency', cost: '$2,000-10,000/mo', desc: 'Agencies charge premium rates, often with long contracts and vague deliverables. You\'re paying for their overhead, not just the work. And you\'re competing with their other clients for attention.' },
              { title: 'DIY with Multiple Tools', cost: '$300-500/mo + your time', desc: 'Piecing together Ahrefs, SEMrush, Surfer SEO, Grammarly, WordPress plugins, and more. Even then, you need SEO knowledge to interpret the data and take action.' },
            ].map((option) => (
              <div key={option.title} className="bg-white rounded-2xl p-7 border border-gray-100">
                <h3 className="text-lg font-bold mb-1">{option.title}</h3>
                <span className="text-sm font-bold text-red-500 block mb-3">{option.cost}</span>
                <p className="text-sm text-[#6E6E73] leading-relaxed">{option.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Solution */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4">SEAUTO: Your AI Marketing Team</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-3xl mx-auto mb-14">One platform that does the work of an SEO specialist, content writer, web developer, compliance officer, and advertising manager — for a fraction of the cost.</p>

          <div className="space-y-8 max-w-4xl mx-auto">
            {[
              { title: 'Know Exactly What to Fix', feature: 'SEO Audit Tool', desc: 'Run comprehensive audits across your entire site. SEAUTO checks technical SEO, content quality, AI search readiness, structured data, compliance, and page speed — then gives you exact code-level fixes, not vague suggestions.', link: '/features/seo-audit-tool' },
              { title: 'Track Your Keywords Without Being an Expert', feature: 'Keyword Rank Tracker', desc: 'See which keywords you rank for, which ones you\'re gaining or losing, and get AI recommendations for each. SEAUTO classifies intent automatically and tells you which keywords will drive the most conversions.', link: '/features/keyword-rank-tracker' },
              { title: 'Content That Writes Itself', feature: 'AI Content Generator', desc: 'Generate blog posts that are SEO-optimized from day one. SEAUTO finds the best topics for your business, writes the content, and can even schedule automatic publishing. Every post uses proven copywriting frameworks.', link: '/features/ai-content-generator' },
              { title: 'Build and Improve Pages with AI', feature: 'AI Website Builder', desc: 'Rebuild existing pages or create entirely new ones. SEAUTO analyzes your site\'s design, applies marketing psychology and CRO best practices, and generates pages that look professional and convert visitors.', link: '/features/ai-website-builder' },
              { title: 'Stay Compliant Without a Lawyer', feature: 'Compliance Checker', desc: 'Check your site against WCAG, GDPR, CCPA, and 7 more standards. Get specific fixes with exact code, not legal jargon. Protect your business from ADA lawsuits and GDPR fines.', link: '/features/compliance-checker' },
            ].map((s) => (
              <div key={s.title} className="flex flex-col md:flex-row gap-6 bg-white rounded-2xl p-7 border border-gray-100 hover:shadow-lg transition-all">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1">{s.title}</h3>
                  <Link to={s.link} className="text-sm text-[#0071E3] font-medium hover:underline">{s.feature} &rarr;</Link>
                  <p className="text-[#6E6E73] leading-relaxed mt-3">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cost Comparison */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-14">The Numbers Speak for Themselves</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto text-center">
            {[
              { label: 'SEO Specialist Salary', cost: '$6,000/mo', seauto: 'Included' },
              { label: 'Content Writer', cost: '$3,000/mo', seauto: 'Included' },
              { label: 'Compliance Audit', cost: '$2,000+ one-time', seauto: 'Included' },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-2xl p-6 border border-gray-100">
                <h3 className="text-sm font-bold text-[#86868B] uppercase tracking-wider mb-4">{c.label}</h3>
                <div className="text-2xl font-bold text-red-500 line-through mb-1">{c.cost}</div>
                <div className="text-lg font-bold text-green-600">{c.seauto}</div>
              </div>
            ))}
          </div>
          <p className="text-center mt-8 text-lg">
            <span className="font-bold text-[#1D1D1F]">SEAUTO starts at $0.</span> <span className="text-[#6E6E73]">The Plus plan is $30/month. </span>
            <Link to="/pricing" className="text-[#0071E3] font-medium hover:underline">See all plans &rarr;</Link>
          </p>
        </div>
      </section>

      <SectionCTA onOpenApp={onOpenApp} />

      <InternalLinks links={[
        { to: '/compare/seauto-vs-hiring', label: 'SEAUTO vs Hiring', desc: 'Detailed cost comparison: hiring in-house, agencies, or using SEAUTO.' },
        { to: '/features/seo-audit-tool', label: 'SEO Audit Tool', desc: 'Run a comprehensive audit and get exact fixes for every issue.' },
        { to: '/features/ai-content-generator', label: 'AI Content Generator', desc: 'Write blog posts that rank without hiring a content writer.' },
        { to: '/features/compliance-checker', label: 'Compliance Checker', desc: 'Stay ADA and GDPR compliant without expensive consultants.' },
        { to: '/pricing', label: 'View Pricing', desc: 'Start free. Upgrade when your business grows.' },
        { to: '/resources/automated-seo', label: 'Automated SEO Guide', desc: 'How automated SEO works and why it\'s perfect for small businesses.' },
      ]} />
    </WebsiteLayout>
  );
}
