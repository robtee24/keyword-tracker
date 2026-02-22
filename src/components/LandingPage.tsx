import { useState } from 'react';

interface LandingPageProps {
  onOpenApp: () => void;
}

export default function LandingPage({ onOpenApp }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white text-[#1D1D1F]" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* ─── HEADER ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => scrollTo('hero')}>
            <img src="/seauto-logo.svg" alt="SEAUTO" className="h-8 w-auto" />
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-[#0071E3] to-[#00C2FF] bg-clip-text text-transparent">SEAUTO</span>
          </div>

          <nav className="hidden lg:flex items-center gap-8">
            {['Features', 'Pricing', 'How It Works', 'FAQ'].map((item) => (
              <button key={item} onClick={() => scrollTo(item.toLowerCase().replace(/\s+/g, '-'))} className="text-sm font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer">
                {item}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button onClick={onOpenApp} className="hidden sm:inline-flex text-sm font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer">
              Login
            </button>
            <button onClick={onOpenApp} className="px-5 py-2 rounded-full bg-[#0071E3] text-white text-sm font-semibold hover:bg-[#0077ED] transition-all shadow-sm hover:shadow-md cursor-pointer">
              Try Free
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 cursor-pointer">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileMenuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100 px-6 py-4 space-y-3">
            {['Features', 'Pricing', 'How It Works', 'FAQ'].map((item) => (
              <button key={item} onClick={() => scrollTo(item.toLowerCase().replace(/\s+/g, '-'))} className="block text-base font-medium text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer w-full text-left">
                {item}
              </button>
            ))}
            <button onClick={onOpenApp} className="block text-base font-medium text-[#1D1D1F] cursor-pointer w-full text-left">Login</button>
          </div>
        )}
      </header>

      {/* ─── HERO ─── */}
      <section id="hero" className="relative pt-32 pb-20 lg:pt-44 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F0F7FF] via-white to-[#F5F0FF]" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-[#0071E3]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#00C2FF]/5 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0071E3]/5 border border-[#0071E3]/10 mb-8">
            <span className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" />
            <span className="text-sm font-medium text-[#0071E3]">AI-Powered Digital Marketing Automation</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6 max-w-4xl mx-auto">
            Your Entire Marketing Team,{' '}
            <span className="bg-gradient-to-r from-[#0071E3] to-[#00C2FF] bg-clip-text text-transparent">Automated</span>
          </h1>

          <p className="text-xl lg:text-2xl text-[#6E6E73] max-w-2xl mx-auto mb-10 leading-relaxed">
            SEAUTO replaces entire marketing departments with AI that audits, optimizes, builds, and executes — automatically. Expert SEO, content, and advertising at a fraction of the cost.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button onClick={onOpenApp} className="px-8 py-3.5 rounded-full bg-[#0071E3] text-white text-base font-semibold hover:bg-[#0077ED] transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 cursor-pointer">
              Create Free Account
            </button>
            <button onClick={() => scrollTo('features')} className="px-8 py-3.5 rounded-full border border-gray-200 text-base font-semibold text-[#1D1D1F] hover:bg-gray-50 transition-all cursor-pointer">
              See All Features
            </button>
          </div>

          {/* Social Proof */}
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-[#86868B] uppercase tracking-wider font-medium">Trusted by agencies and businesses everywhere</p>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0071E3] to-[#00C2FF] border-2 border-white flex items-center justify-center text-white text-xs font-bold">
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  ))}
                </div>
                <p className="text-xs text-[#6E6E73]">Loved by marketing teams</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── WHO IT'S FOR ─── */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4">Built for Everyone Who Needs Marketing</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-2xl mx-auto mb-14">Whether you're a solo founder, enterprise team, or SEO agency — SEAUTO scales to match your needs.</p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'Small Businesses', desc: 'Replace an entire marketing team. Get expert-level SEO, content, and advertising recommendations without the $10K+/month payroll. One tool, zero marketing hires needed.', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />, color: 'from-blue-500 to-cyan-500' },
              { title: 'Enterprise Teams', desc: 'One person doing the work of 10. Eliminate redundant roles, automate repetitive tasks, and let your team focus on strategy while SEAUTO handles execution.', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />, color: 'from-violet-500 to-purple-500' },
              { title: 'SEO Agencies', desc: 'Exponentially increase your client capacity. Automate all website audits, improvements, and maintenance. Take on 10x more clients with the same team.', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />, color: 'from-emerald-500 to-teal-500' },
            ].map((audience) => (
              <div key={audience.title} className="bg-white rounded-2xl p-8 border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all cursor-pointer group">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${audience.color} flex items-center justify-center mb-5`}>
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{audience.icon}</svg>
                </div>
                <h3 className="text-xl font-bold mb-3">{audience.title}</h3>
                <p className="text-[#6E6E73] leading-relaxed">{audience.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Everything You Need to Dominate Search</h2>
            <p className="text-lg text-[#6E6E73] max-w-2xl mx-auto">Every feature is a full product in itself. Together, they form the most comprehensive digital marketing platform ever built.</p>
          </div>

          <div className="space-y-24">
            {/* Organic Tracking */}
            <FeatureRow
              title="Organic Keyword Intelligence"
              description="Track every keyword your site ranks for with daily position updates, historical trends, and intelligent alerts. See exactly which pages rank, how positions change over time, and get AI-powered recommendations for each keyword."
              features={['Real-time keyword position tracking', 'Historical ranking trends with comparison', 'Per-keyword page-level analysis', 'Automated intent classification (informational, transactional, navigational, branded)', 'New & lost keyword detection', 'Search volume integration with daily caching', 'Keyword grouping with group-level recommendations']}
              gradient="from-blue-500 to-cyan-500"
              icon={<path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />}
              reverse={false}
            />

            {/* SEO Audit */}
            <FeatureRow
              title="Comprehensive SEO Auditing"
              description="Run 6 specialized audits across every page of your site — simultaneously. Each audit provides specific, actionable recommendations with exact code changes, not vague suggestions."
              features={['SEO Audit — Title tags, meta descriptions, heading hierarchy, internal linking, canonical tags', 'Content Audit — Copy quality, conversion optimization, marketing psychology analysis', 'AEO Audit — AI search engine optimization for ChatGPT, Perplexity, Google AI Overviews', 'Schema Audit — Structured data validation, missing schema detection, rich snippet opportunities', 'Compliance Audit — WCAG, GDPR, CCPA, HSTS, CSP, PCI DSS with pass/fail per standard', 'Speed Audit — Core Web Vitals, render-blocking resources, image optimization, third-party scripts']}
              gradient="from-violet-500 to-purple-500"
              icon={<path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />}
              reverse={true}
            />

            {/* Blog */}
            <FeatureRow
              title="Intelligent Blog Engine"
              description="Automatically detect your blog, audit every post, discover high-opportunity topics, and generate publish-ready content — all optimized with proven marketing frameworks."
              features={['Auto-detect blog URLs from your sitemap', 'Full blog audit with per-post scoring and recommendations', 'AI topic opportunity engine — targeted keywords, search volumes, funnel stage', 'One-click AI blog generation with SEO optimization built in', 'Automated blog scheduling — set frequency and posts per batch', 'Marketing psychology and copywriting best practices applied to every post']}
              gradient="from-amber-500 to-orange-500"
              icon={<path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />}
              reverse={false}
            />

            {/* Build */}
            <FeatureRow
              title="AI Website Builder"
              description="Rebuild existing pages or generate entirely new ones using 115+ marketing skills, proven copywriting frameworks, and your site's existing design. Every page is conversion-optimized from the ground up."
              features={['Rebuild any page — AI applies CRO, SEO, copywriting, and psychology frameworks', 'Auto-matches your site styling (colors, fonts, spacing) from the home page', '20 AI-suggested new pages based on your site gaps and business goals', 'Custom page wizard — purpose, audience, style, then AI builds it', 'Before/after change tracking for every rebuild', 'Schema markup, image suggestions, and internal linking included']}
              gradient="from-emerald-500 to-teal-500"
              icon={<path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />}
              reverse={true}
            />

            {/* Advertising */}
            <FeatureRow
              title="Advertising Intelligence"
              description="Generate expert-level keyword lists for Google Ads with broad, phrase, and exact match terms — plus an extensive negative keyword list. Full ad account auditing across platforms."
              features={['AI keyword generation — broad match, phrase match, exact match lists', 'Expansive negative keyword list generation', 'Google Ads, Meta Ads, LinkedIn Ads, Reddit Ads auditing', 'Budget & spend optimization across channels', 'Creative & copy performance analysis', 'Attribution model comparison and conversion path analysis', 'Account structure review and naming conventions']}
              gradient="from-rose-500 to-pink-500"
              icon={<path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />}
              reverse={false}
            />

            {/* Bot Automation */}
            <FeatureRow
              title="Autonomous Execution Bot"
              badge="Coming Soon"
              description="The game-changer. SEAUTO's integrated AI bot connects to your website platform and automatically executes every recommendation, task, and improvement — without human intervention."
              features={['Connects to any web platform (WordPress, Shopify, Webflow, custom CMS)', 'Automatically implements all SEO recommendations', 'Executes content changes, schema updates, meta tag fixes', 'Deploys blog posts and new pages directly to your site', 'Runs compliance fixes and performance optimizations', 'Full audit trail of every change made', 'Expert SEO — fully managed, fully automated']}
              gradient="from-[#0071E3] to-[#00C2FF]"
              icon={<path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />}
              reverse={true}
            />
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="py-24 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-2xl mx-auto mb-16">From setup to fully automated marketing in three steps.</p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Connect Your Site', desc: 'Link your Google Search Console and add your website. SEAUTO automatically discovers your sitemap, keywords, and content structure.' },
              { step: '02', title: 'Audit Everything', desc: 'Run comprehensive audits across SEO, content, compliance, speed, advertising, and blog. Get exact recommendations with specific code changes.' },
              { step: '03', title: 'Automate & Execute', desc: 'Let the AI bot implement every recommendation automatically. Build new pages, publish blog posts, and optimize continuously — hands-free.' },
            ].map((item) => (
              <div key={item.step} className="text-center group">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0071E3] to-[#00C2FF] flex items-center justify-center mx-auto mb-6 text-white text-xl font-bold shadow-lg group-hover:scale-110 transition-transform">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-[#6E6E73] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4">Simple, Transparent Pricing</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-2xl mx-auto mb-14">Start free. Upgrade when you're ready. Per-project pricing so you only pay for what you use.</p>

          <div className="grid lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free */}
            <PricingCard
              name="Free"
              price="$0"
              period=""
              description="Perfect for getting started and exploring what SEAUTO can do."
              features={[
                { text: '1 project', included: true },
                { text: '5 page audits / month', included: true, note: 'Specific page & type only' },
                { text: '100 keyword tracking', included: true },
                { text: 'Weekly keyword refresh', included: true },
                { text: '20 keyword scans / month', included: true },
                { text: '5 blog posts / month', included: true },
                { text: '1 web page build', included: true },
                { text: 'Full site audit', included: false },
                { text: 'AI bot automation', included: false },
                { text: 'Advertising features', included: false },
              ]}
              cta="Get Started Free"
              onCta={onOpenApp}
              highlighted={false}
            />

            {/* Plus */}
            <PricingCard
              name="Plus"
              price="$30"
              period="/ project / month"
              description="For businesses serious about growth. Everything you need to compete."
              features={[
                { text: 'Unlimited projects', included: true },
                { text: '20 page audits / month', included: true, note: 'All types including full audit' },
                { text: 'All keyword tracking', included: true },
                { text: 'Daily keyword refresh', included: true },
                { text: '50 keyword scans / month', included: true },
                { text: '20 blog posts / month', included: true },
                { text: '5 web page builds / month', included: true },
                { text: 'Full site audit', included: true },
                { text: 'AI bot automation', included: false },
                { text: 'Advertising features', included: true },
              ]}
              cta="Start Plus Trial"
              onCta={onOpenApp}
              highlighted={true}
            />

            {/* Managed Digital */}
            <PricingCard
              name="Managed Digital"
              price="$200"
              period="/ project / month"
              description="Fully managed, fully automated. Your entire marketing department in one platform."
              features={[
                { text: 'Unlimited projects', included: true },
                { text: 'Unlimited page audits', included: true },
                { text: 'All keyword tracking', included: true },
                { text: 'Real-time keyword refresh', included: true },
                { text: 'Unlimited keyword scans', included: true },
                { text: 'Unlimited blog posts', included: true },
                { text: 'Unlimited page builds', included: true },
                { text: 'Full site audit', included: true },
                { text: 'AI bot automation', included: true, note: 'Auto-executes all tasks' },
                { text: 'Full advertising suite', included: true },
              ]}
              cta="Go Managed"
              onCta={onOpenApp}
              highlighted={false}
            />
          </div>
        </div>
      </section>

      {/* ─── BIG CTA ─── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0071E3] to-[#00C2FF]" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6">Stop Paying for Marketing Teams.{'\n'}Start Automating.</h2>
          <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto">
            Join businesses and agencies who've replaced $10,000/month marketing departments with SEAUTO. Create your free account in 30 seconds.
          </p>
          <button onClick={onOpenApp} className="px-10 py-4 rounded-full bg-white text-[#0071E3] text-base font-bold hover:bg-gray-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 cursor-pointer">
            Create Free Account
          </button>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-24 bg-[#FAFAFA]">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-14">Frequently Asked Questions</h2>

          <div className="space-y-3">
            {[
              { q: 'How does SEAUTO replace a marketing team?', a: 'SEAUTO automates the work of SEO specialists, content writers, web developers, compliance officers, and advertising managers. It audits your entire site, generates specific recommendations with exact code changes, writes and publishes blog posts, builds new pages, and (with Managed Digital) executes everything automatically through an AI bot.' },
              { q: 'What is the AI bot and how does it work?', a: 'The AI bot (available on the Managed Digital plan) connects to your website platform — WordPress, Shopify, Webflow, or any custom CMS. It reads the task list of recommendations and automatically implements them: updating meta tags, fixing accessibility issues, publishing blog posts, deploying new pages, and more. Every change is logged in the activity feed.' },
              { q: 'Can SEO agencies use this for multiple clients?', a: 'Absolutely — that\'s our ideal customer. Each client is a separate project. On the Plus plan at $30/project/month, you can manage unlimited clients. Agencies typically report handling 10x more clients with the same team size after switching to SEAUTO.' },
              { q: 'How are the audits different from other SEO tools?', a: 'Most SEO tools give you vague suggestions like "improve your title tag." SEAUTO gives you the exact replacement text, the specific HTML to add, the precise header configuration — down to copy-paste code. We run 6 specialized audit types (SEO, Content, AEO, Schema, Compliance, Speed) and check against 10 compliance standards with pass/fail verdicts.' },
              { q: 'What does "per project" pricing mean?', a: 'Each website you add to SEAUTO is a project. If you manage 3 client websites, that\'s 3 projects. The Free plan includes 1 project, and paid plans are priced per project per month.' },
              { q: 'Is there a contract or commitment?', a: 'No contracts, no commitments. Cancel anytime. Your data and audit history are preserved even if you downgrade.' },
            ].map((faq, i) => {
              const isOpen = expandedFaq === i;
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <button onClick={() => setExpandedFaq(isOpen ? null : i)} className="w-full flex items-center justify-between p-5 text-left cursor-pointer hover:bg-gray-50 transition-colors">
                    <span className="text-base font-semibold text-[#1D1D1F] pr-4">{faq.q}</span>
                    <svg className={`w-5 h-5 text-[#86868B] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-[#6E6E73] leading-relaxed">{faq.a}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="py-16 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/seauto-logo.svg" alt="SEAUTO" className="h-7" />
                <span className="text-lg font-bold bg-gradient-to-r from-[#0071E3] to-[#00C2FF] bg-clip-text text-transparent">SEAUTO</span>
              </div>
              <p className="text-sm text-[#6E6E73] leading-relaxed">AI-powered digital marketing automation. Replace entire teams with intelligent automation.</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider text-[#86868B]">Product</h4>
              <div className="space-y-2.5">
                {['Organic Tracking', 'SEO Audits', 'Blog Engine', 'Website Builder', 'Advertising', 'AI Bot'].map((item) => (
                  <button key={item} onClick={() => scrollTo('features')} className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer">{item}</button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider text-[#86868B]">Company</h4>
              <div className="space-y-2.5">
                {['Pricing', 'FAQ', 'Privacy Policy', 'Terms of Service'].map((item) => (
                  <button key={item} onClick={() => scrollTo(item.toLowerCase().replace(/\s+/g, '-'))} className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer">{item}</button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider text-[#86868B]">Get Started</h4>
              <p className="text-sm text-[#6E6E73] mb-4">Create your free account and start automating your marketing today.</p>
              <button onClick={onOpenApp} className="px-5 py-2 rounded-full bg-[#0071E3] text-white text-sm font-semibold hover:bg-[#0077ED] transition-colors cursor-pointer">
                Try Free
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-8 text-center text-sm text-[#86868B]">
            &copy; {new Date().getFullYear()} SEAUTO. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Sub-components ─── */

function FeatureRow({ title, description, features, gradient, icon, reverse, badge }: {
  title: string;
  description: string;
  features: string[];
  gradient: string;
  icon: React.ReactNode;
  reverse: boolean;
  badge?: string;
}) {
  return (
    <div className={`flex flex-col ${reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-20`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{icon}</svg>
          </div>
          <h3 className="text-2xl lg:text-3xl font-bold">{title}</h3>
          {badge && <span className="px-3 py-1 rounded-full bg-[#0071E3]/10 text-[#0071E3] text-xs font-bold uppercase tracking-wider">{badge}</span>}
        </div>
        <p className="text-lg text-[#6E6E73] leading-relaxed mb-6">{description}</p>
        <ul className="space-y-3">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-3">
              <svg className={`w-5 h-5 shrink-0 mt-0.5 bg-gradient-to-br ${gradient} rounded-full p-0.5 text-white`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-[#1D1D1F]">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1 min-w-0 w-full">
        <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-1`}>
          <div className="bg-white rounded-[14px] p-6 lg:p-8">
            <div className="space-y-3">
              {features.slice(0, 4).map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-[#1D1D1F] truncate">{f.split(' — ')[0].split(' – ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PricingCard({ name, price, period, description, features, cta, onCta, highlighted }: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: { text: string; included: boolean; note?: string }[];
  cta: string;
  onCta: () => void;
  highlighted: boolean;
}) {
  return (
    <div className={`relative rounded-2xl p-8 flex flex-col ${
      highlighted
        ? 'bg-[#1D1D1F] text-white ring-2 ring-[#0071E3] shadow-2xl scale-[1.02] lg:scale-105'
        : 'bg-white border border-gray-200'
    }`}>
      {highlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#0071E3] text-white text-xs font-bold uppercase tracking-wider">
          Most Popular
        </div>
      )}

      <div className="mb-6">
        <h3 className={`text-lg font-bold mb-2 ${highlighted ? 'text-white' : 'text-[#1D1D1F]'}`}>{name}</h3>
        <div className="flex items-baseline gap-1">
          <span className={`text-4xl font-bold ${highlighted ? 'text-white' : 'text-[#1D1D1F]'}`}>{price}</span>
          {period && <span className={`text-sm ${highlighted ? 'text-gray-400' : 'text-[#6E6E73]'}`}>{period}</span>}
        </div>
        <p className={`text-sm mt-2 ${highlighted ? 'text-gray-400' : 'text-[#6E6E73]'}`}>{description}</p>
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3">
            {f.included ? (
              <svg className="w-5 h-5 shrink-0 text-[#34C759] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className={`w-5 h-5 shrink-0 mt-0.5 ${highlighted ? 'text-gray-600' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className={`text-sm ${!f.included ? (highlighted ? 'text-gray-500' : 'text-gray-400') : highlighted ? 'text-gray-200' : 'text-[#1D1D1F]'}`}>
              {f.text}
              {f.note && <span className={`block text-xs mt-0.5 ${highlighted ? 'text-gray-500' : 'text-[#86868B]'}`}>{f.note}</span>}
            </span>
          </li>
        ))}
      </ul>

      <button
        onClick={onCta}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
          highlighted
            ? 'bg-[#0071E3] text-white hover:bg-[#0077ED]'
            : 'bg-[#1D1D1F] text-white hover:bg-[#2D2D2F]'
        }`}
      >
        {cta}
      </button>
    </div>
  );
}
