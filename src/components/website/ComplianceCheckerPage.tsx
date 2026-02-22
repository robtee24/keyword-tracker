import { Link } from 'react-router-dom';
import WebsiteLayout, { SectionCTA, InternalLinks } from './WebsiteLayout';

export default function ComplianceCheckerPage({ onOpenApp }: { onOpenApp: () => void }) {
  return (
    <WebsiteLayout
      onOpenApp={onOpenApp}
      title="Website Compliance Checker — WCAG, GDPR, CCPA, ADA & More | SEAUTO"
      description="Audit your website against 10 compliance standards including WCAG 2.2, GDPR, CCPA, Section 508, HSTS, CSP, and PCI DSS. Get pass/fail verdicts and exact fixes for every page."
    >
      {/* Hero */}
      <section className="pt-16 pb-20 lg:pt-24 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFF0F0] via-white to-[#F0F0FF]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-red-200/20 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider mb-6">Compliance Audit</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Website Compliance. <span className="bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">10 Standards. One Scan.</span>
            </h1>
            <p className="text-xl text-[#6E6E73] leading-relaxed mb-8">
              Non-compliance isn't just a legal risk — it hurts your rankings, alienates users, and opens you to lawsuits. SEAUTO checks every page against 10 critical standards and provides exact code fixes to pass each one.
            </p>
            <button onClick={onOpenApp} className="px-8 py-3.5 rounded-full bg-[#0071E3] text-white font-semibold hover:bg-[#0077ED] transition-all shadow-lg cursor-pointer">
              Check Your Compliance Free
            </button>
          </div>
        </div>
      </section>

      {/* 10 Standards */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-4">10 Standards Checked Per Page</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-2xl mx-auto mb-14">Every page gets a clear pass or fail verdict for each standard, with specific recommendations to fix failures.</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { name: 'WCAG 2.0/2.1/2.2', sub: 'Level A & AA', desc: 'Web Content Accessibility Guidelines covering perceivable, operable, understandable, and robust content.' },
              { name: 'Section 508', sub: 'ADA Compliance', desc: 'Federal accessibility requirements for websites, ensuring usability for people with disabilities.' },
              { name: 'GDPR', sub: 'EU Privacy', desc: 'General Data Protection Regulation covering data collection, consent, and privacy notices.' },
              { name: 'ePrivacy', sub: 'Cookie Directive', desc: 'European cookie consent requirements, tracking disclosure, and opt-in mechanisms.' },
              { name: 'CCPA / CPRA', sub: 'California Privacy', desc: 'California Consumer Privacy Act and California Privacy Rights Act for data handling.' },
              { name: 'TLS', sub: 'Transport Security', desc: 'Transport Layer Security protocol validation for encrypted connections.' },
              { name: 'HSTS', sub: 'Strict Transport', desc: 'HTTP Strict Transport Security headers preventing downgrade attacks.' },
              { name: 'CSP', sub: 'Content Security', desc: 'Content Security Policy headers preventing XSS, injection, and data theft.' },
              { name: 'PCI DSS', sub: 'Payment Security', desc: 'Payment Card Industry Data Security Standard for sites handling payment data.' },
              { name: 'All Standards', sub: 'Combined Report', desc: 'Unified compliance scorecard with aggregate pass/fail across all 10 standards.' },
            ].map((s) => (
              <div key={s.name} className="bg-white rounded-xl p-5 border border-gray-100 hover:border-red-200 hover:shadow-md transition-all">
                <h3 className="font-bold text-sm mb-1">{s.name}</h3>
                <span className="text-xs text-[#86868B] block mb-2">{s.sub}</span>
                <p className="text-xs text-[#6E6E73] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What makes it different */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Not Just Flags — Exact Fixes</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-3xl mx-auto mb-14">
            Most compliance tools show you a list of failures. SEAUTO shows you failures <em>and the exact code, HTML, headers, or configuration changes needed to pass</em>.
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold mb-4 text-red-600">What other tools give you</h3>
              <div className="space-y-3 text-sm text-[#6E6E73]">
                <p className="bg-red-50 rounded-lg p-3">"Image missing alt text" (WCAG 1.1.1)</p>
                <p className="bg-red-50 rounded-lg p-3">"No cookie consent mechanism found" (GDPR)</p>
                <p className="bg-red-50 rounded-lg p-3">"Missing HSTS header" (HSTS)</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold mb-4 text-green-600">What SEAUTO gives you</h3>
              <div className="space-y-3 text-sm text-[#6E6E73]">
                <p className="bg-green-50 rounded-lg p-3">Add <code className="text-xs bg-gray-100 px-1 rounded">alt="Tax attorney reviewing documents in office"</code> to the hero image at line 47</p>
                <p className="bg-green-50 rounded-lg p-3">Deploy cookie consent banner with this exact HTML + JS implementation: [full code provided]</p>
                <p className="bg-green-50 rounded-lg p-3">Add this header to your server config: <code className="text-xs bg-gray-100 px-1 rounded">Strict-Transport-Security: max-age=31536000; includeSubDomains</code></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why compliance matters */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-14">Why Website Compliance Matters for SEO</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { title: 'Search Rankings', desc: 'Google uses Core Web Vitals and accessibility signals as ranking factors. Sites with WCAG compliance, proper HTTPS, and security headers rank higher.', stat: '68%', statLabel: 'of top-10 results are WCAG AA compliant' },
              { title: 'Legal Protection', desc: 'ADA lawsuits increased 300% in 5 years. GDPR fines can reach 4% of global revenue. Proactive compliance protects your business.', stat: '$18K', statLabel: 'average ADA lawsuit settlement' },
              { title: 'User Experience', desc: 'Accessible sites have better UX for everyone — larger touch targets, clearer navigation, faster load times, and better mobile experience.', stat: '15%', statLabel: 'of global population has a disability' },
            ].map((c) => (
              <div key={c.title} className="bg-white rounded-2xl p-7 border border-gray-100">
                <div className="text-3xl font-bold bg-gradient-to-r from-[#0071E3] to-[#00C2FF] bg-clip-text text-transparent mb-1">{c.stat}</div>
                <div className="text-xs text-[#86868B] mb-4">{c.statLabel}</div>
                <h3 className="font-bold mb-2">{c.title}</h3>
                <p className="text-sm text-[#6E6E73] leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Part of Your Complete SEO Toolkit</h2>
          <p className="text-lg text-[#6E6E73] max-w-2xl mx-auto mb-8">
            Compliance auditing is one of <Link to="/features/seo-audit-tool" className="text-[#0071E3] hover:underline">6 specialized audit types</Link> in SEAUTO. Run them all simultaneously with a single crawl, and manage all recommendations in one unified tasklist.
          </p>
        </div>
      </section>

      <SectionCTA onOpenApp={onOpenApp} />

      <InternalLinks links={[
        { to: '/features/seo-audit-tool', label: 'Full SEO Audit Tool', desc: 'Run compliance alongside 5 other audit types in a single site crawl.' },
        { to: '/features/ai-website-builder', label: 'AI Website Builder', desc: 'Automatically fix compliance issues by rebuilding pages with proper markup.' },
        { to: '/solutions/small-business-seo', label: 'Small Business SEO', desc: 'Small businesses face the same compliance requirements — SEAUTO makes it manageable.' },
        { to: '/solutions/seo-agency-software', label: 'For SEO Agencies', desc: 'Offer compliance auditing as a service to your clients with automated reporting.' },
        { to: '/features/keyword-rank-tracker', label: 'Keyword Rank Tracker', desc: 'Better compliance often leads to better rankings — track the improvement.' },
        { to: '/pricing', label: 'View Pricing', desc: 'Compliance auditing is included in all paid plans.' },
      ]} />
    </WebsiteLayout>
  );
}
