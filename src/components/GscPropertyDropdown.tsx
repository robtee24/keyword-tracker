import { useState, useEffect } from 'react';
import { authenticatedFetch } from '../services/authService';
import { API_ENDPOINTS } from '../config/api';
import { matchesRootDomain } from '../utils/domainMatch';

interface GscPropertyDropdownProps {
  projectDomain: string;
  currentProperty: string | null;
  onPropertyChange: (property: string) => void;
}

interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

export default function GscPropertyDropdown({
  projectDomain,
  currentProperty,
  onPropertyChange,
}: GscPropertyDropdownProps) {
  const [sites, setSites] = useState<GscSite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authenticatedFetch(API_ENDPOINTS.google.searchConsole.sites)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const all: GscSite[] = data.sites || [];
        const filtered = all.filter((s) => matchesRootDomain(s.siteUrl, projectDomain));
        setSites(filtered);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectDomain]);

  if (loading) return null;
  if (sites.length <= 1) return null;

  return (
    <select
      value={currentProperty || ''}
      onChange={(e) => {
        if (e.target.value && e.target.value !== currentProperty) {
          onPropertyChange(e.target.value);
        }
      }}
      className="px-2 py-1 rounded-apple-sm border border-apple-border text-apple-xs text-apple-text bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-apple-blue/30 focus:border-apple-blue"
    >
      {sites.map((s) => (
        <option key={s.siteUrl} value={s.siteUrl}>
          {s.siteUrl}
        </option>
      ))}
    </select>
  );
}
