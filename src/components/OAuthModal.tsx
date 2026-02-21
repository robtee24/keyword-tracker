import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { setTokens } from '../services/authService';

interface OAuthModalProps {
  onAuthenticated: () => void;
}

export default function OAuthModal({ onAuthenticated }: OAuthModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen for postMessage from the OAuth popup
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) return;

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'oauth-tokens') {
        setTokens(data.accessToken, data.refreshToken, data.expiresIn);
        setLoading(false);
        setError(null);
        onAuthenticated();
      }

      if (data.type === 'oauth-error') {
        setLoading(false);
        setError(data.error || 'Authorization failed. Please try again.');
      }
    },
    [onAuthenticated]
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.google.oauth.authorize);
      if (!response.ok) throw new Error('Failed to get authorization URL');

      const { authUrl } = await response.json();

      // Open OAuth in popup
      const width = 520;
      const height = 640;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        authUrl,
        'Google Sign In',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        setError('Popup was blocked. Please allow popups for this site.');
        setLoading(false);
        return;
      }

      // Poll for popup closure (fallback if postMessage doesn't fire)
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setLoading(false);
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to start sign-in flow');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card p-12 max-w-md w-full text-center">
        {/* Logo / Icon */}
        <div className="mb-8">
          <div className="mx-auto mb-6">
            <img src="/seauto-logo.svg" alt="SEAUTO" className="h-16 mx-auto object-contain" />
          </div>
          <h1 className="text-apple-title1 font-bold text-apple-text tracking-tight mb-2">
            SEAUTO
          </h1>
          <p className="text-apple-base text-apple-text-secondary">
            Connect your Google Search Console to track keyword rankings, impressions, and clicks.
          </p>
        </div>

        {/* Sign In Button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-apple-sm border border-apple-border bg-white text-apple-text font-medium text-apple-base transition-all duration-200 hover:shadow-apple-md hover:border-apple-text-tertiary active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          <span>{loading ? 'Connecting...' : 'Sign in with Google'}</span>
        </button>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-apple-sm bg-red-50 text-apple-red text-apple-sm">
            {error}
          </div>
        )}

        {/* Footer */}
        <p className="mt-8 text-apple-xs text-apple-text-tertiary">
          We only request read access to your Search Console data. You can revoke access at any time from your{' '}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-apple-blue hover:underline"
          >
            Google Account
          </a>.
        </p>
      </div>
    </div>
  );
}
