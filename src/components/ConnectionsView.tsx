import { useState, useEffect, useCallback } from 'react';
import { authenticatedFetch } from '../services/authService';
import { API_ENDPOINTS } from '../config/api';
import { matchesRootDomain } from '../utils/domainMatch';
import { InfoTooltip } from './Tooltip';

interface ConnectionsViewProps {
  siteUrl: string;
  projectId: string;
  projectDomain: string;
  gscProperty: string | null;
  onGscPropertySelected: (property: string) => void;
}

interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

interface ConnectionStatus {
  service: string;
  account_name: string | null;
  account_id: string | null;
  connected_at: string | null;
}

const SERVICES = [
  {
    id: 'google_search_console',
    name: 'Google Search Console',
    description: 'Track keyword rankings, impressions, and clicks from organic search.',
    icon: GoogleIcon,
    ready: true,
  },
  {
    id: 'google_ads',
    name: 'Google Ads',
    description: 'Import campaign performance data and audit your ad account.',
    icon: GoogleAdsIcon,
    ready: true,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Ads',
    description: 'Connect your LinkedIn Campaign Manager for B2B ad audits.',
    icon: LinkedInIcon,
    ready: false,
  },
  {
    id: 'meta',
    name: 'Meta Ads',
    description: 'Import Facebook & Instagram campaign data for creative and audience audits.',
    icon: MetaIcon,
    ready: false,
  },
  {
    id: 'bing_ads',
    name: 'Microsoft Ads',
    description: 'Connect your Bing Ads account for cross-platform campaign analysis.',
    icon: BingIcon,
    ready: false,
  },
  {
    id: 'tiktok',
    name: 'TikTok Ads',
    description: 'Analyze TikTok campaign performance and creative effectiveness.',
    icon: TikTokIcon,
    ready: false,
  },
  {
    id: 'reddit',
    name: 'Reddit Ads',
    description: 'Audit subreddit targeting, bid strategy, and community fit.',
    icon: RedditIcon,
    ready: false,
  },
] as const;

export default function ConnectionsView({ siteUrl, projectId, projectDomain, gscProperty, onGscPropertySelected }: ConnectionsViewProps) {
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [gscSites, setGscSites] = useState<GscSite[]>([]);
  const [gscLoading, setGscLoading] = useState(false);
  const [showGscPicker, setShowGscPicker] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await authenticatedFetch(
        `${API_ENDPOINTS.connections.status}?site_url=${encodeURIComponent(siteUrl)}`
      );
      const data = await res.json();
      setConnections(data.connections || []);
    } catch {
      // Silently fail on status fetch
    } finally {
      setLoading(false);
    }
  }, [siteUrl]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const fetchGscSites = useCallback(async () => {
    setGscLoading(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.google.searchConsole.sites);
      const data = await res.json();
      const all: GscSite[] = data.sites || [];
      const filtered = all.filter((s) => matchesRootDomain(s.siteUrl, projectDomain));
      setGscSites(filtered);
      if (filtered.length > 0 && !gscProperty) {
        setShowGscPicker(true);
      }
    } catch {
      setGscSites([]);
    } finally {
      setGscLoading(false);
    }
  }, [gscProperty, projectDomain]);

  useEffect(() => {
    const gscConn = connections.find((c) => c.service === 'google_search_console');
    if (gscConn && !gscProperty) {
      fetchGscSites();
    }
  }, [connections, gscProperty, fetchGscSites]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'connection-success') {
        setConnecting(null);
        fetchStatus();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [fetchStatus]);

  const handleConnect = async (serviceId: string) => {
    setConnecting(serviceId);
    try {
      const res = await authenticatedFetch(
        `${API_ENDPOINTS.connections.authorize}?service=${serviceId}&site_url=${encodeURIComponent(siteUrl)}`
      );
      const data = await res.json();

      if (data.status === 'coming_soon') {
        setConnecting(null);
        return;
      }

      if (data.authUrl) {
        const width = 520;
        const height = 640;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        const popup = window.open(
          data.authUrl,
          `Connect ${serviceId}`,
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );
        if (!popup) {
          setConnecting(null);
        } else {
          const check = setInterval(() => {
            if (popup.closed) {
              clearInterval(check);
              setConnecting(null);
              fetchStatus();
            }
          }, 1000);
        }
      }
    } catch {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (serviceId: string) => {
    try {
      await authenticatedFetch(API_ENDPOINTS.connections.disconnect, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: serviceId, site_url: siteUrl }),
      });
      fetchStatus();
    } catch {}
  };

  const getConnection = (serviceId: string) =>
    connections.find((c) => c.service === serviceId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-apple-title2 font-bold text-apple-text">Connections</h1>
          <InfoTooltip text="Connect external services to pull data into your project. OAuth tokens are stored server-side and never exposed to the browser." position="right" />
        </div>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Link external platforms to pull data into this project.
        </p>
      </div>

      {/* GSC Property Picker */}
      {showGscPicker && !gscProperty && (
        <div className="mb-8 card p-6 ring-1 ring-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-apple-base font-semibold text-apple-text">Select a Search Console Property</h3>
            <InfoTooltip text="Only properties matching your project's root domain are shown. The selected property determines which data appears in keyword rankings and overview." position="right" />
          </div>
          <p className="text-apple-sm text-apple-text-secondary mb-4">
            Choose which property to use for keyword tracking in this project.
          </p>
          {gscLoading ? (
            <div className="flex items-center gap-2 py-2 text-apple-sm text-apple-text-tertiary">
              <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
              Loading properties...
            </div>
          ) : (
            <div className="space-y-2">
              {gscSites.map((site) => (
                <button
                  key={site.siteUrl}
                  onClick={() => {
                    onGscPropertySelected(site.siteUrl);
                    setShowGscPicker(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-apple-sm border border-apple-border hover:border-apple-blue hover:bg-blue-50 transition-all text-apple-sm text-apple-text"
                >
                  {site.siteUrl}
                </button>
              ))}
              {gscSites.length === 0 && (
                <p className="text-apple-sm text-apple-text-tertiary">
                  No properties found. Make sure you have access in Google Search Console.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {gscProperty && (
        <div className="mb-8 card p-4 flex items-center justify-between">
          <div>
            <span className="text-apple-xs font-medium text-apple-text-secondary uppercase tracking-wider">Search Console Property</span>
            <p className="text-apple-sm text-apple-text font-medium mt-0.5">{gscProperty}</p>
          </div>
          <button
            onClick={() => setShowGscPicker(true)}
            className="text-apple-xs text-apple-blue hover:underline"
          >
            Change
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SERVICES.map((svc) => {
          const conn = getConnection(svc.id);
          const isConnected = !!conn;
          const isConnecting = connecting === svc.id;
          const Icon = svc.icon;

          return (
            <div
              key={svc.id}
              className={`card p-5 flex flex-col gap-4 transition-all duration-200 ${
                isConnected ? 'ring-1 ring-green-200' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-apple-sm bg-apple-fill-secondary flex items-center justify-center shrink-0">
                  <Icon />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-apple-base font-semibold text-apple-text truncate">
                      {svc.name}
                    </h3>
                    {isConnected && (
                      <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-apple-xs text-apple-text-tertiary mt-0.5 line-clamp-2">
                    {svc.description}
                  </p>
                </div>
              </div>

              {isConnected && conn.account_name && (
                <div className="px-3 py-2 rounded-apple-sm bg-green-50 text-apple-xs text-green-700">
                  Connected as {conn.account_name}
                </div>
              )}

              <div className="mt-auto">
                {!svc.ready ? (
                  <span className="inline-block px-3 py-1.5 rounded-apple-sm bg-apple-fill-secondary text-apple-xs text-apple-text-tertiary font-medium">
                    Coming Soon
                  </span>
                ) : isConnected ? (
                  <button
                    onClick={() => handleDisconnect(svc.id)}
                    className="px-3 py-1.5 rounded-apple-sm border border-red-200 text-apple-xs text-apple-red font-medium hover:bg-red-50 transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(svc.id)}
                    disabled={isConnecting}
                    className="px-3 py-1.5 rounded-apple-sm bg-apple-blue text-white text-apple-xs font-medium hover:bg-apple-blue-hover transition-colors disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GoogleAdsIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#FBBC04" d="M3.2 15.3L9.5 4.7c.8-1.3 2.4-1.8 3.7-1l0 0c1.3.8 1.8 2.4 1 3.7L7.9 18c-.8 1.3-2.4 1.8-3.7 1l0 0C2.9 18.2 2.4 16.6 3.2 15.3z" />
      <path fill="#4285F4" d="M14.2 15.3L20.5 4.7c.8-1.3 2.4-1.8 3.7-1l0 0c1.3.8 1.8 2.4 1 3.7l-6.3 10.6c-.8 1.3-2.4 1.8-3.7 1l0 0C13.9 18.2 13.4 16.6 14.2 15.3z" />
      <circle fill="#34A853" cx="6" cy="18" r="3" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function MetaIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function BingIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#008373" d="M5 3v16.5l4.5 2.5 8-4.5v-5L11 9.5V3H5z" />
      <path fill="#00A98F" d="M11 9.5l6.5 3V17l-8 4.5 6.5-3V14L11 9.5z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#25F4EE" d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0115.54 3h-3.09v12.4a2.592 2.592 0 01-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 004.3 1.38V7.3s-1.88.09-3.24-1.48z" />
      <path fill="#FE2C55" d="M17.6 6.82s.51.5 0 0A4.278 4.278 0 0116.54 4h-3.09v12.4a2.592 2.592 0 01-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V10.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V10.01a7.35 7.35 0 004.3 1.38V8.3s-1.88.09-3.24-1.48z" />
    </svg>
  );
}

function RedditIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#FF4500">
      <path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.05 1.604a3.222 3.222 0 01.045.522c0 2.694-3.13 4.874-7.004 4.874-3.874 0-7.004-2.18-7.004-4.874 0-.18.015-.36.046-.534A1.748 1.748 0 014.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 000-.463.33.33 0 00-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 00-.232-.095z" />
    </svg>
  );
}
