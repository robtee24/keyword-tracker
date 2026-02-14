import { useState, useEffect } from 'react';
import type { SearchConsoleSite } from '../types';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';

interface PropertySelectorProps {
  selectedSite: string | null;
  onSiteChange: (siteUrl: string) => void;
}

export default function PropertySelector({ selectedSite, onSiteChange }: PropertySelectorProps) {
  const [sites, setSites] = useState<SearchConsoleSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch(API_ENDPOINTS.google.searchConsole.sites);

      if (!response.ok) {
        throw new Error('Failed to load properties');
      }

      const data = await response.json();
      const siteList: SearchConsoleSite[] = data.sites || [];
      setSites(siteList);

      // Auto-select if only one site, or restore previous selection
      const storedSite = localStorage.getItem('gsc_selected_site');
      if (storedSite && siteList.some((s) => s.siteUrl === storedSite)) {
        onSiteChange(storedSite);
      } else if (siteList.length === 1) {
        const url = siteList[0].siteUrl;
        localStorage.setItem('gsc_selected_site', url);
        onSiteChange(url);
      }
    } catch (err: any) {
      console.error('Error fetching sites:', err);
      setError(err.message || 'Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const url = e.target.value;
    localStorage.setItem('gsc_selected_site', url);
    onSiteChange(url);
  };

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <div className="inline-block w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-apple-text-secondary text-apple-base">Loading your properties...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-apple-red text-apple-base mb-4">{error}</p>
        <button onClick={fetchSites} className="btn-primary">
          Retry
        </button>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="text-4xl mb-4">🔍</div>
        <h3 className="text-apple-title3 font-semibold text-apple-text mb-2">
          No Properties Found
        </h3>
        <p className="text-apple-text-secondary text-apple-base max-w-md mx-auto">
          No Google Search Console properties were found for your account.
          Make sure you have verified at least one property in{' '}
          <a
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noopener noreferrer"
            className="text-apple-blue hover:underline"
          >
            Google Search Console
          </a>.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6 mb-6">
      <label className="block text-apple-sm font-medium text-apple-text-secondary mb-2 uppercase tracking-wide">
        Search Console Property
      </label>
      <select
        value={selectedSite || ''}
        onChange={handleChange}
        className="input w-full max-w-md cursor-pointer"
      >
        <option value="" disabled>
          Select a property...
        </option>
        {sites.map((site) => (
          <option key={site.siteUrl} value={site.siteUrl}>
            {site.siteUrl}
          </option>
        ))}
      </select>
    </div>
  );
}
