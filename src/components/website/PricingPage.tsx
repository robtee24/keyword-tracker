import { useState } from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout, { SectionCTA, InternalLinks } from './WebsiteLayout';

export default function PricingPage({ onOpenApp }: { onOpenApp: () => void }) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <WebsiteLayout
      onOpenApp={onOpenApp}
      title="Pricing — Free, Plus & Managed Digital Plans | SEAUTO"
      description="Start free with 1 project, 100 keywords, and 5 audits. Plus is $30/project/month. Managed Digital at $200/month includes unlimited everything plus the AI execution bot."
    >
      <section className="pt-16 pb-8 lg:pt-24 lg:pb-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F0F7FF] via-white to-[#F5F0FF]" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            Simple, <span className="bg-gradient-to-r from-[#0071E3] to-[#00C2FF] bg-clip-text text-transparent">Transparent</span> Pricing
          </h1>
          <p className="text-xl text-[#6E6E73] leading-relaxed">
            Start free. Upgrade when you're ready. Per-project pricing so you only pay for what you use. No contracts, no hidden fees, cancel anytime.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 relative">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Free */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 flex flex-col">
              <h3 className="text-lg font-bold mb-2">Free</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold">$0</span>
              </div>
              <p className="text-sm text-[#6E6E73] mb-6">Perfect for getting started and exploring what SEAUTO can do.</p>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  { text: '1 project', ok: true },
                  { text: '5 page audits / month', ok: true, note: 'Specific page & type only' },
                  { text: '100 keyword tracking', ok: true },
                  { text: 'Weekly keyword refresh', ok: true },
                  { text: '20 keyword scans / month', ok: true },
                  { text: 'Keyword recommendations', ok: true },
                  { text: '5 blog posts / month', ok: true },
                  { text: '1 web page build', ok: true },
                  { text: 'Full site audit', ok: false },
                  { text: 'AI bot automation', ok: false },
                  { text: 'Advertising features', ok: false },
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    {f.ok ? <svg className="w-5 h-5 shrink-0 text-[#34C759] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      : <svg className="w-5 h-5 shrink-0 text-gray-300 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
                    <span className={f.ok ? 'text-[#1D1D1F]' : 'text-gray-400'}>
                      {f.text}
                      {f.note && <span className="block text-xs text-[#86868B] mt-0.5">{f.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <button onClick={onOpenApp} className="w-full py-3 rounded-xl bg-[#1D1D1F] text-white text-sm font-semibold hover:bg-[#2D2D2F] transition-all cursor-pointer">
                Get Started Free
              </button>
            </div>

            {/* Plus */}
            <div className="relative bg-[#1D1D1F] text-white rounded-2xl p-8 ring-2 ring-[#0071E3] shadow-2xl scale-[1.02] lg:scale-105 flex flex-col">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#0071E3] text-white text-xs font-bold uppercase tracking-wider">Most Popular</div>
              <h3 className="text-lg font-bold mb-2">Plus</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold">$30</span>
                <span className="text-sm text-gray-400">/ project / month</span>
              </div>
              <p className="text-sm text-gray-400 mb-6">For businesses serious about growth. Everything you need to compete.</p>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  { text: 'Unlimited projects', ok: true },
                  { text: '20 page audits / month', ok: true, note: 'All types including full audit' },
                  { text: 'All keyword tracking', ok: true },
                  { text: 'Daily keyword refresh', ok: true },
                  { text: '50 keyword scans / month', ok: true },
                  { text: 'Full keyword recommendations', ok: true },
                  { text: '20 blog posts / month', ok: true },
                  { text: '5 web page builds / month', ok: true },
                  { text: 'Full site audit', ok: true },
                  { text: 'AI bot automation', ok: false },
                  { text: 'Advertising features', ok: true },
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    {f.ok ? <svg className="w-5 h-5 shrink-0 text-[#34C759] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      : <svg className="w-5 h-5 shrink-0 text-gray-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
                    <span className={f.ok ? 'text-gray-200' : 'text-gray-500'}>
                      {f.text}
                      {f.note && <span className="block text-xs text-gray-500 mt-0.5">{f.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <button onClick={onOpenApp} className="w-full py-3 rounded-xl bg-[#0071E3] text-white text-sm font-semibold hover:bg-[#0077ED] transition-all cursor-pointer">
                Start Plus Trial
              </button>
            </div>

            {/* Managed Digital */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 flex flex-col">
              <h3 className="text-lg font-bold mb-2">Managed Digital</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold">$200</span>
                <span className="text-sm text-[#6E6E73]">/ project / month</span>
              </div>
              <p className="text-sm text-[#6E6E73] mb-6">Fully managed, fully automated. Your entire marketing department in one platform.</p>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  { text: 'Unlimited projects', ok: true },
                  { text: 'Unlimited page audits', ok: true },
                  { text: 'All keyword tracking', ok: true },
                  { text: 'Real-time keyword refresh', ok: true },
                  { text: 'Unlimited keyword scans', ok: true },
                  { text: 'Unlimited recommendations', ok: true },
                  { text: 'Unlimited blog posts', ok: true },
                  { text: 'Unlimited page builds', ok: true },
                  { text: 'Full site audit', ok: true },
                  { text: 'AI bot automation', ok: true, note: 'Auto-executes all tasks' },
                  { text: 'Full advertising suite', ok: true },
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <svg className="w-5 h-5 shrink-0 text-[#34C759] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span className="text-[#1D1D1F]">
                      {f.text}
                      {f.note && <span className="block text-xs text-[#86868B] mt-0.5">{f.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <button onClick={onOpenApp} className="w-full py-3 rounded-xl bg-[#1D1D1F] text-white text-sm font-semibold hover:bg-[#2D2D2F] transition-all cursor-pointer">
                Go Managed
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-14">Pricing FAQ</h2>
          <div className="space-y-3">
            {[
              { q: 'What does "per project" mean?', a: 'Each website you manage in SEAUTO is a project. If you manage 3 client websites, that\'s 3 projects. The Free plan includes 1 project. Paid plans are priced per project per month — add as many as you need.' },
              { q: 'Can I switch plans anytime?', a: 'Yes. Upgrade or downgrade at any time with no penalties. If you downgrade, you\'ll keep access to your existing data and audit history — you just won\'t be able to run new audits beyond the lower plan\'s limits.' },
              { q: 'Is there a free trial for paid plans?', a: 'The Free plan is itself a generous trial — 1 project, 5 audits, 100 keywords, and 5 blog posts per month. Most users can fully evaluate SEAUTO before deciding to upgrade.' },
              { q: 'What is the AI bot automation?', a: 'Available on the Managed Digital plan, the AI bot connects to your website platform (WordPress, Shopify, Webflow, etc.) and automatically implements every recommendation — meta tag updates, schema additions, content deployments, compliance fixes, and more. It\'s coming soon and will be the industry\'s first fully autonomous SEO execution engine.' },
              { q: 'Do you offer agency pricing for multiple projects?', a: 'The per-project pricing is already designed for agencies. At $30/project/month on Plus, managing 50 clients costs $1,500/month — a fraction of what you charge each client. For high-volume agencies, contact us about custom enterprise pricing.' },
              { q: 'Are there any hidden fees?', a: 'No. The price you see is the price you pay. No setup fees, no overage charges, no surprise add-ons. Cancel anytime.' },
            ].map((faq, i) => {
              const isOpen = expandedFaq === i;
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <button onClick={() => setExpandedFaq(isOpen ? null : i)} className="w-full flex items-center justify-between p-5 text-left cursor-pointer hover:bg-gray-50 transition-colors">
                    <span className="text-base font-semibold text-[#1D1D1F] pr-4">{faq.q}</span>
                    <svg className={`w-5 h-5 text-[#86868B] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {isOpen && <div className="px-5 pb-5 text-[#6E6E73] leading-relaxed">{faq.a}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <SectionCTA onOpenApp={onOpenApp} />

      <InternalLinks links={[
        { to: '/features/seo-audit-tool', label: 'SEO Audit Tool', desc: 'Included in all plans — 6 specialized audit types with exact fixes.' },
        { to: '/features/keyword-rank-tracker', label: 'Keyword Rank Tracker', desc: 'Free plan tracks 100 keywords. Plus and Managed track unlimited.' },
        { to: '/compare/seauto-vs-hiring', label: 'SEAUTO vs Hiring', desc: 'Compare the cost of SEAUTO against hiring a marketing team or agency.' },
        { to: '/solutions/seo-agency-software', label: 'For SEO Agencies', desc: 'Per-project pricing designed for agency economics.' },
        { to: '/solutions/small-business-seo', label: 'Small Business SEO', desc: 'Start free, upgrade when your business grows.' },
        { to: '/resources/automated-seo', label: 'Automated SEO Guide', desc: 'Learn what\'s included and how each feature works.' },
      ]} />
    </WebsiteLayout>
  );
}
