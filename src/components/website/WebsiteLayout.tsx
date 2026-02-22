import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface WebsiteLayoutProps {
  children: React.ReactNode;
  onOpenApp: () => void;
  title?: string;
  description?: string;
}

export default function WebsiteLayout({ children, onOpenApp, title, description }: WebsiteLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
    if (title) document.title = title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && description) metaDesc.setAttribute('content', description);
  }, [location.pathname, title, description]);

  const navLinks = [
    { label: 'Features', to: '/features/seo-audit-tool' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Solutions', to: '/solutions/small-business-seo' },
    { label: 'Resources', to: '/resources/automated-seo' },
  ];

  return (
    <div className="min-h-screen bg-white text-[#1D1D1F]" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center cursor-pointer">
            <img src="/seauto-logo.svg" alt="SEAUTO" className="h-10 w-auto" />
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((item) => (
              <Link key={item.label} to={item.to} className="text-sm font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">
                {item.label}
              </Link>
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
            {navLinks.map((item) => (
              <Link key={item.label} to={item.to} className="block text-base font-medium text-[#6E6E73] hover:text-[#1D1D1F]">
                {item.label}
              </Link>
            ))}
            <button onClick={onOpenApp} className="block text-base font-medium text-[#1D1D1F] cursor-pointer w-full text-left">Login</button>
          </div>
        )}
      </header>

      <main className="pt-16">{children}</main>

      <footer className="py-16 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-10 mb-12">
            <div className="md:col-span-1">
              <Link to="/" className="inline-block mb-4">
                <img src="/seauto-logo.svg" alt="SEAUTO" className="h-9 w-auto" />
              </Link>
              <p className="text-sm text-[#6E6E73] leading-relaxed">AI-powered digital marketing automation. Replace entire teams with intelligent automation.</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider text-[#86868B]">Features</h4>
              <div className="space-y-2.5">
                <Link to="/features/seo-audit-tool" className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">SEO Audit Tool</Link>
                <Link to="/features/keyword-rank-tracker" className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">Keyword Rank Tracker</Link>
                <Link to="/features/ai-content-generator" className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">AI Content Generator</Link>
                <Link to="/features/ai-website-builder" className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">AI Website Builder</Link>
                <Link to="/features/compliance-checker" className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">Compliance Checker</Link>
                <Link to="/features/google-ads-optimization" className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">Google Ads Optimization</Link>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider text-[#86868B]">Solutions</h4>
              <div className="space-y-2.5">
                <Link to="/solutions/small-business-seo" className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">Small Business SEO</Link>
                <Link to="/solutions/seo-agency-software" className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">SEO Agency Software</Link>
                <Link to="/compare/seauto-vs-hiring" className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">SEAUTO vs Hiring</Link>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-4 uppercase tracking-wider text-[#86868B]">Resources</h4>
              <div className="space-y-2.5">
                <Link to="/resources/automated-seo" className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">Automated SEO Guide</Link>
                <Link to="/pricing" className="block text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">Pricing</Link>
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

          <div className="border-t border-gray-100 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#86868B]">
            <span>&copy; {new Date().getFullYear()} SEAUTO. All rights reserved.</span>
            <div className="flex gap-6">
              <Link to="/pricing" className="hover:text-[#1D1D1F] transition-colors">Pricing</Link>
              <Link to="/resources/automated-seo" className="hover:text-[#1D1D1F] transition-colors">Resources</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function SectionCTA({ onOpenApp }: { onOpenApp: () => void }) {
  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0071E3] to-[#00C2FF]" />
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
      </div>
      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl lg:text-4xl font-bold text-white mb-5">Ready to Automate Your Marketing?</h2>
        <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">Create your free account in 30 seconds. No credit card required.</p>
        <button onClick={onOpenApp} className="px-10 py-4 rounded-full bg-white text-[#0071E3] text-base font-bold hover:bg-gray-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 cursor-pointer">
          Create Free Account
        </button>
      </div>
    </section>
  );
}

export function InternalLinks({ links, title = 'Explore More' }: { links: { to: string; label: string; desc: string }[]; title?: string }) {
  return (
    <section className="py-16 bg-[#FAFAFA]">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-2xl font-bold text-center mb-10">{title}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className="bg-white rounded-xl p-6 border border-gray-100 hover:border-[#0071E3]/30 hover:shadow-md transition-all group cursor-pointer">
              <h3 className="font-semibold text-[#1D1D1F] group-hover:text-[#0071E3] transition-colors mb-2">{link.label}</h3>
              <p className="text-sm text-[#6E6E73] leading-relaxed">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
