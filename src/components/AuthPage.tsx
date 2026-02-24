import { useState } from 'react';
import { supabase } from '../services/supabaseClient';

type AuthMode = 'signin' | 'signup';

interface AuthPageProps {
  onAuthenticated: () => void;
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        setMessage('Check your email for a confirmation link.');
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
      } else {
        onAuthenticated();
      }
    }
    setLoading(false);
  };

  const handleSocialLogin = async (provider: 'google' | 'azure') => {
    setSocialLoading(provider);
    setError(null);
    const { error: socialError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/app' },
    });
    if (socialError) {
      setError(socialError.message);
      setSocialLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-apple-bg">
      <div className="card p-10 max-w-md w-full">
        <div className="text-center mb-8">
          <img src="/seauto-logo.svg" alt="SEAUTO" className="h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-apple-title2 font-bold text-apple-text">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-apple-sm text-apple-text-secondary mt-1">
            {mode === 'signin' ? 'Sign in to continue to SEAUTO' : 'Get started with SEAUTO'}
          </p>
        </div>

        {/* Social login buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => handleSocialLogin('google')}
            disabled={!!socialLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-apple-sm border border-apple-border bg-white text-apple-text font-medium text-apple-sm transition-all duration-200 hover:shadow-apple-md hover:border-apple-text-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {socialLoading === 'google' ? (
              <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          <button
            onClick={() => handleSocialLogin('azure')}
            disabled={!!socialLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-apple-sm border border-apple-border bg-white text-apple-text font-medium text-apple-sm transition-all duration-200 hover:shadow-apple-md hover:border-apple-text-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {socialLoading === 'azure' ? (
              <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#F25022" d="M1 1h10v10H1z" />
                <path fill="#7FBA00" d="M13 1h10v10H13z" />
                <path fill="#00A4EF" d="M1 13h10v10H1z" />
                <path fill="#FFB900" d="M13 13h10v10H13z" />
              </svg>
            )}
            <span>Continue with Microsoft</span>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-apple-divider" />
          <span className="text-apple-xs text-apple-text-tertiary uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-apple-divider" />
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="input w-full text-apple-sm"
            />
          </div>

          <div>
            <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="At least 6 characters"
              className="input w-full text-apple-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-apple-sm bg-apple-blue text-white font-medium text-apple-sm hover:bg-apple-blue-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            ) : (
              mode === 'signin' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 rounded-apple-sm bg-red-50 text-apple-red text-apple-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-4 p-3 rounded-apple-sm bg-green-50 text-green-700 text-apple-sm">
            {message}
          </div>
        )}

        <div className="mt-6 text-center">
          {mode === 'signin' ? (
            <p className="text-apple-sm text-apple-text-secondary">
              Don&apos;t have an account?{' '}
              <button onClick={() => { setMode('signup'); setError(null); setMessage(null); }} className="text-apple-blue hover:underline font-medium">
                Sign up
              </button>
            </p>
          ) : (
            <p className="text-apple-sm text-apple-text-secondary">
              Already have an account?{' '}
              <button onClick={() => { setMode('signin'); setError(null); setMessage(null); }} className="text-apple-blue hover:underline font-medium">
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
