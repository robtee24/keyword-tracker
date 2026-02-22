import { Link } from 'react-router-dom';
import WebsiteLayout, { SectionCTA, InternalLinks } from './WebsiteLayout';

export default function SeautoVsHiringPage({ onOpenApp }: { onOpenApp: () => void }) {
  return (
    <WebsiteLayout
      onOpenApp={onOpenApp}
      title="SEAUTO vs Hiring a Marketing Team — Cost Comparison & ROI Analysis"
      description="Compare the cost of hiring SEO specialists, content writers, and marketing agencies versus using SEAUTO's AI-powered automation. See the real numbers and ROI breakdown."
    >
      <section className="pt-16 pb-20 lg:pt-24 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFF8F0] via-white to-[#F0F7FF]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-amber-200/15 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wider mb-6">Cost Comparison</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              SEAUTO vs Hiring: <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">The Real Numbers</span>
            </h1>
            <p className="text-xl text-[#6E6E73] leading-relaxed mb-8">
              A fully staffed marketing department costs $15,000-30,000/month. An SEO agency charges $2,000-10,000/month. SEAUTO starts at $0 and the full platform is $200/month. Here's exactly what you get at each price point.
            </p>
            <button onClick={onOpenApp} className="px-8 py-3.5 rounded-full bg-[#0071E3] text-white font-semibold hover:bg-[#0077ED] transition-all shadow-lg cursor-pointer">
              Try SEAUTO Free
            </button>
          </div>
        </div>
      </section>

      {/* The Comparison Table */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-14">Side-by-Side Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full max-w-5xl mx-auto text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-4 px-4 font-semibold text-[#1D1D1F]">Role / Capability</th>
                  <th className="text-center py-4 px-4 font-semibold text-[#6E6E73]">In-House Hire</th>
                  <th className="text-center py-4 px-4 font-semibold text-[#6E6E73]">SEO Agency</th>
                  <th className="text-center py-4 px-4 font-semibold text-[#0071E3]">SEAUTO</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['SEO Specialist', '$5,000-8,000/mo', '$1,500-3,000/mo', 'Included'],
                  ['Content Writer', '$3,000-5,000/mo', '$1,000-2,000/mo', 'Included'],
                  ['Web Developer', '$6,000-10,000/mo', '$2,000-5,000/mo', 'Included'],
                  ['Compliance Auditor', '$2,000+ (one-time)', '$1,500+ (one-time)', 'Included'],
                  ['PPC Manager', '$4,000-7,000/mo', '$1,000-3,000/mo', 'Included'],
                  ['Data Analyst', '$4,000-7,000/mo', 'Limited', 'Included'],
                  ['Total Monthly Cost', '$24,000-45,000', '$7,000-16,000', '$0 - $200'],
                  ['Annual Cost', '$288,000-540,000', '$84,000-192,000', '$0 - $2,400'],
                  ['Time to Results', '3-6 months to hire + ramp', '1-3 months onboarding', 'Immediate'],
                  ['Scalability', 'Hire more people', 'Pay more retainer', 'Add projects ($30 each)'],
                ].map(([label, inhouse, agency, seauto], i) => (
                  <tr key={i} className={`border-b border-gray-100 ${i >= 6 ? 'bg-gray-50 font-medium' : ''}`}>
                    <td className="py-3 px-4 text-[#1D1D1F]">{label}</td>
                    <td className="text-center py-3 px-4 text-[#6E6E73]">{inhouse}</td>
                    <td className="text-center py-3 px-4 text-[#6E6E73]">{agency}</td>
                    <td className="text-center py-3 px-4 text-[#0071E3] font-medium">{seauto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* What SEAUTO replaces */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">What SEAUTO Actually Replaces</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-3xl mx-auto mb-14">This isn't about replacing people — it's about what those people <em>do</em>. SEAUTO automates the tasks, not the strategy.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { role: 'SEO Specialist', tasks: ['Site auditing (technical, content, schema)', 'Keyword research and tracking', 'On-page optimization recommendations', 'Competitor analysis', 'Ranking reports and tracking'], replacement: 'SEO Audit Tool + Keyword Tracker', link: '/features/seo-audit-tool' },
              { role: 'Content Writer', tasks: ['Blog post creation', 'Landing page copy', 'Meta description writing', 'Content strategy and topic research', 'Content optimization'], replacement: 'AI Content Generator + Blog Engine', link: '/features/ai-content-generator' },
              { role: 'Web Developer', tasks: ['Page building and optimization', 'Schema markup implementation', 'Speed optimization', 'Compliance fixes (accessibility)', 'Technical SEO implementation'], replacement: 'AI Website Builder', link: '/features/ai-website-builder' },
              { role: 'PPC Manager', tasks: ['Keyword list generation', 'Negative keyword management', 'Ad account auditing', 'Budget optimization', 'Cross-platform strategy'], replacement: 'Advertising Intelligence', link: '/features/google-ads-optimization' },
              { role: 'Compliance Officer', tasks: ['WCAG accessibility testing', 'GDPR/CCPA compliance checks', 'Security header validation', 'Cookie consent verification', 'Regular compliance audits'], replacement: 'Compliance Checker', link: '/features/compliance-checker' },
              { role: 'Marketing Analyst', tasks: ['Keyword performance analysis', 'Content ROI tracking', 'Activity logging and reporting', 'Recommendation prioritization', 'Progress tracking'], replacement: 'Built-in Analytics & Activity Log' },
            ].map((r) => (
              <div key={r.role} className="bg-white rounded-2xl p-6 border border-gray-100">
                <h3 className="font-bold mb-3">{r.role}</h3>
                <ul className="space-y-1.5 mb-4">
                  {r.tasks.map((t, i) => (
                    <li key={i} className="text-xs text-[#6E6E73] flex items-start gap-2">
                      <svg className="w-3 h-3 shrink-0 mt-0.5 text-[#34C759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="bg-blue-50 rounded-lg px-3 py-2">
                  <span className="text-xs font-bold text-[#0071E3]">Replaced by: </span>
                  {r.link
                    ? <Link to={r.link} className="text-xs text-[#0071E3] hover:underline">{r.replacement}</Link>
                    : <span className="text-xs text-[#0071E3]">{r.replacement}</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Calculator concept */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">The ROI Is Overwhelming</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-3xl mx-auto mb-14">Even at the Managed Digital plan ($200/month), SEAUTO costs less than a single day of an SEO specialist's salary.</p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto text-center">
            {[
              { metric: '99%', label: 'Cost Reduction', desc: 'Compared to hiring a full marketing team' },
              { metric: '10x', label: 'Client Capacity', desc: 'For SEO agencies using SEAUTO' },
              { metric: 'Minutes', label: 'Not Months', desc: 'Time from setup to first actionable insights' },
            ].map((m) => (
              <div key={m.label} className="bg-white rounded-2xl p-7 border border-gray-100">
                <div className="text-4xl font-bold bg-gradient-to-r from-[#0071E3] to-[#00C2FF] bg-clip-text text-transparent mb-2">{m.metric}</div>
                <div className="font-bold text-[#1D1D1F] mb-1">{m.label}</div>
                <div className="text-sm text-[#6E6E73]">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* When you still need humans */}
      <section className="py-20 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">When You Still Need a Human</h2>
          <p className="text-lg text-[#6E6E73] text-center max-w-3xl mx-auto mb-14">SEAUTO is honest about what AI can and can't do. Here's where human expertise still matters.</p>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { title: 'Brand Strategy & Positioning', desc: 'AI can execute strategy, but defining your brand voice, market positioning, and competitive differentiation requires human creativity and market understanding.' },
              { title: 'Client Relationships', desc: 'For agencies, building trust and managing client expectations requires human communication. SEAUTO handles the work; you handle the relationship.' },
              { title: 'Novel Creative Concepts', desc: 'While SEAUTO applies proven frameworks, breakthrough creative campaigns still benefit from human imagination and cultural awareness.' },
              { title: 'Business Decision Making', desc: 'SEAUTO provides data, recommendations, and analysis. The strategic decisions about where to invest and which markets to target remain human.' },
            ].map((h) => (
              <div key={h.title} className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="font-bold mb-2">{h.title}</h3>
                <p className="text-sm text-[#6E6E73] leading-relaxed">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionCTA onOpenApp={onOpenApp} />

      <InternalLinks links={[
        { to: '/solutions/small-business-seo', label: 'Small Business SEO', desc: 'How SEAUTO replaces an entire marketing team for small businesses.' },
        { to: '/solutions/seo-agency-software', label: 'For SEO Agencies', desc: 'Handle 10x more clients without growing your team.' },
        { to: '/pricing', label: 'View Pricing', desc: 'Free, Plus ($30/mo), and Managed Digital ($200/mo) plans.' },
        { to: '/features/seo-audit-tool', label: 'SEO Audit Tool', desc: 'What an SEO specialist does manually — automated.' },
        { to: '/features/ai-content-generator', label: 'AI Content Generator', desc: 'What a content writer does manually — automated.' },
        { to: '/resources/automated-seo', label: 'Automated SEO Guide', desc: 'Deep dive into how automated SEO works.' },
      ]} />
    </WebsiteLayout>
  );
}
