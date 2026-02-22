import { Link } from 'react-router-dom';
import WebsiteLayout, { SectionCTA, InternalLinks } from './WebsiteLayout';

export default function AiContentGeneratorPage({ onOpenApp }: { onOpenApp: () => void }) {
  return (
    <WebsiteLayout
      onOpenApp={onOpenApp}
      title="AI Content Generator — SEO Blog Posts & Web Copy in Minutes | SEAUTO"
      description="Generate publish-ready, SEO-optimized blog posts and website content using AI powered by 115+ marketing skills, copywriting frameworks, and conversion psychology."
    >
      {/* Hero */}
      <section className="pt-16 pb-20 lg:pt-24 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFF8F0] via-white to-[#FFF0F0]" />
        <div className="absolute top-10 right-10 w-[500px] h-[500px] bg-amber-200/20 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wider mb-6">AI Content Generator</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Content That Ranks, <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">Written by AI</span>
            </h1>
            <p className="text-xl text-[#6E6E73] leading-relaxed mb-8">
              SEAUTO's content engine doesn't just write — it strategizes. Every blog post is built on proven marketing frameworks, targeted at high-opportunity keywords, and optimized for both search engines and human readers.
            </p>
            <button onClick={onOpenApp} className="px-8 py-3.5 rounded-full bg-[#0071E3] text-white font-semibold hover:bg-[#0077ED] transition-all shadow-lg cursor-pointer">
              Generate Your First Post Free
            </button>
          </div>
        </div>
      </section>

      {/* What It Creates */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4">Complete Content Operations</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-2xl mx-auto mb-14">From topic discovery to published post — SEAUTO handles the entire content pipeline.</p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Blog Topic Discovery', desc: 'AI analyzes your site, keywords, and business goals to suggest 15-25 high-opportunity blog topics. Each includes target keywords, search volume estimates, difficulty ratings, funnel stage, and a description of how the post drives business value.', color: 'from-amber-500 to-orange-500' },
              { title: 'Full Blog Generation', desc: 'One-click generation of publish-ready blog posts (1,500-2,500 words). Includes meta descriptions, SEO-optimized slugs, suggested images with alt text, and internal linking suggestions — all following proven copywriting and marketing frameworks.', color: 'from-orange-500 to-red-400' },
              { title: 'Blog Auditing', desc: 'Audit individual posts or your entire blog. SEAUTO scores each post on content quality, SEO optimization, engagement potential, and conversion effectiveness. Get specific recommendations with exact text changes.', color: 'from-rose-500 to-pink-500' },
              { title: 'Automated Scheduling', desc: 'Set it and forget it. Schedule blog generation by frequency (daily, weekly, monthly) and posts per batch. SEAUTO continuously creates content optimized for your latest keyword opportunities.', color: 'from-violet-500 to-purple-500' },
              { title: 'Marketing Framework Application', desc: 'Every piece of content is written using proven frameworks: AIDA for attention-grabbing intros, PAS for problem-solution content, features-benefits bridging for product pages, and social proof integration throughout.', color: 'from-indigo-500 to-blue-500' },
              { title: 'Existing Content Detection', desc: 'SEAUTO automatically discovers all blog URLs from your sitemap — including multiple blog sections. Add URLs manually or let auto-detection handle it. Never miss a post that needs optimization.', color: 'from-teal-500 to-emerald-500' },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-7 border border-gray-100 hover:shadow-lg transition-all">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4`}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <h3 className="text-lg font-bold mb-3">{f.title}</h3>
                <p className="text-sm text-[#6E6E73] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Marketing Skills */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Powered by 115+ Marketing Skills</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-3xl mx-auto mb-14">
            SEAUTO doesn't generate generic AI content. Every piece is crafted using imported marketing expertise — the same frameworks used by top agencies charging $5,000+ per month for content strategy.
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {['Copywriting Frameworks', 'CRO Best Practices', 'Marketing Psychology', 'Schema Optimization', 'Content Structure', 'SEO On-Page', 'Conversion Funnels', 'User Intent Mapping', 'Engagement Hooks', 'Call-to-Action Design', 'Internal Linking Strategy', 'Readability Optimization'].map((skill) => (
              <div key={skill} className="bg-white rounded-xl px-4 py-3 border border-gray-100 text-center text-sm font-medium text-[#1D1D1F]">{skill}</div>
            ))}
          </div>
        </div>
      </section>

      {/* How content connects */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Content That Connects to Your Entire SEO Strategy</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-3xl mx-auto mb-14">
            Blog posts don't exist in isolation. SEAUTO's content engine is directly connected to your <Link to="/features/keyword-rank-tracker" className="text-[#0071E3] hover:underline">keyword tracking</Link>, <Link to="/features/seo-audit-tool" className="text-[#0071E3] hover:underline">site audits</Link>, and <Link to="/features/ai-website-builder" className="text-[#0071E3] hover:underline">page builder</Link> — so every piece of content strengthens your overall search presence.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { title: 'Keyword-Driven Topics', desc: 'Blog topics are generated based on your actual keyword data — targeting gaps where you could rank with quality content.' },
              { title: 'Audit-Informed Optimization', desc: 'Blog audit recommendations feed directly into your SEO tasklist and can be auto-fixed by the AI builder.' },
              { title: 'Automated Publishing', desc: 'With the Managed Digital plan, the AI bot can deploy generated content directly to your CMS platform.' },
            ].map((c) => (
              <div key={c.title} className="text-center p-6">
                <h3 className="font-bold mb-2">{c.title}</h3>
                <p className="text-sm text-[#6E6E73] leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionCTA onOpenApp={onOpenApp} />

      <InternalLinks links={[
        { to: '/features/ai-website-builder', label: 'AI Website Builder', desc: 'Build entire web pages with AI — same marketing frameworks, applied to landing pages and service pages.' },
        { to: '/features/keyword-rank-tracker', label: 'Keyword Rank Tracker', desc: 'Track the keywords your content targets and monitor ranking improvements over time.' },
        { to: '/features/seo-audit-tool', label: 'SEO Audit Tool', desc: 'Audit your existing content for technical SEO, content quality, and conversion optimization.' },
        { to: '/solutions/small-business-seo', label: 'Small Business SEO', desc: 'Learn how AI content generation helps small businesses compete without a writing team.' },
        { to: '/pricing', label: 'View Pricing', desc: 'Free plan includes 5 blog posts per month. Plus and Managed plans include more.' },
        { to: '/resources/automated-seo', label: 'Automated SEO Guide', desc: 'How content generation fits into a fully automated SEO workflow.' },
      ]} />
    </WebsiteLayout>
  );
}
