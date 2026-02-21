import { useState, useEffect, useRef } from 'react';
import { API_ENDPOINTS } from '../config/api';

interface LostKeyword {
  keyword: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface LostKeywordsViewProps {
  siteUrl: string;
}

export default function LostKeywordsView({ siteUrl }: LostKeywordsViewProps) {
  const [lostKeywords, setLostKeywords] = useState<LostKeyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'keyword' | 'firstSeen' | 'lastSeen'>('lastSeen');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const fetched = useRef(false);

  useEffect(() => {
    if (!siteUrl || fetched.current) return;
    fetched.current = true;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_ENDPOINTS.db.keywords}?siteUrl=${encodeURIComponent(siteUrl)}`)
      .then((resp) => {
        if (!resp.ok) throw new Error('Failed to fetch keywords');
        return resp.json();
      })
      .then(({ keywords }) => {
        if (cancelled) return;
        if (!keywords || keywords.length === 0) {
          setLostKeywords([]);
          setLoading(false);
          return;
        }

        const maxLastSeen = keywords.reduce(
          (max: string, k: any) => (k.last_seen_at > max ? k.last_seen_at : max),
          ''
        );

        setLostKeywords(
          keywords
            .filter((k: any) => k.last_seen_at < maxLastSeen)
            .map((k: any) => ({
              keyword: k.keyword,
              firstSeenAt: k.first_seen_at,
              lastSeenAt: k.last_seen_at,
            }))
        );
        setLoading(false);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err.message || 'Error loading lost keywords');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [siteUrl]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'keyword' ? 'asc' : 'desc');
    }
  };

  const sortIcon = (field: typeof sortField) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const sorted = [...lostKeywords].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'keyword') return a.keyword.localeCompare(b.keyword) * dir;
    if (sortField === 'firstSeen') return (a.firstSeenAt > b.firstSeenAt ? 1 : -1) * dir;
    return (a.lastSeenAt > b.lastSeenAt ? 1 : -1) * dir;
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-apple-text mb-1">Lost Keywords</h2>
        <p className="text-apple-sm text-apple-text-secondary">
          Keywords that were previously indexed by Google Search Console for your site but are no
          longer appearing in the latest data.
        </p>
      </div>

      <div className="rounded-apple border border-amber-200 bg-amber-50/40 px-4 py-3 mb-6 flex items-start gap-3">
        <svg
          className="w-5 h-5 text-amber-500 mt-0.5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="text-apple-sm text-amber-800">
          <span className="font-semibold">Note:</span> Lost keywords require several months of
          monitoring before they appear here. A keyword is marked as "lost" only when it is no
          longer present in your Google Search Console data during a refresh. Short-term
          fluctuations are normal — keywords may temporarily disappear and return.
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-apple-sm text-apple-text-secondary">Loading lost keywords…</span>
        </div>
      ) : error ? (
        <div className="rounded-apple border border-apple-red/20 bg-red-50/30 px-4 py-3 text-apple-sm text-apple-red">
          {error}
        </div>
      ) : lostKeywords.length === 0 ? (
        <div className="rounded-apple border border-apple-divider bg-white px-6 py-12 text-center">
          <svg
            className="w-10 h-10 mx-auto mb-3 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-apple-body font-medium text-apple-text mb-1">No lost keywords</p>
          <p className="text-apple-sm text-apple-text-secondary">
            All previously tracked keywords are still appearing in your Search Console data.
          </p>
        </div>
      ) : (
        <div className="rounded-apple border border-apple-divider bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-apple-divider bg-apple-fill-secondary flex items-center justify-between">
            <span className="text-apple-sm font-semibold text-apple-text-secondary">
              {lostKeywords.length} lost keyword{lostKeywords.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-apple-divider bg-apple-fill-secondary/50">
                  <th
                    className="px-6 py-3 text-left text-apple-xs font-semibold text-apple-text-secondary uppercase tracking-wider cursor-pointer select-none hover:text-apple-text"
                    onClick={() => handleSort('keyword')}
                  >
                    Keyword{sortIcon('keyword')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-apple-xs font-semibold text-apple-text-secondary uppercase tracking-wider cursor-pointer select-none hover:text-apple-text"
                    onClick={() => handleSort('firstSeen')}
                  >
                    First Seen{sortIcon('firstSeen')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-apple-xs font-semibold text-apple-text-secondary uppercase tracking-wider cursor-pointer select-none hover:text-apple-text"
                    onClick={() => handleSort('lastSeen')}
                  >
                    Last Seen{sortIcon('lastSeen')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((lk) => (
                  <tr
                    key={lk.keyword}
                    className="border-b border-apple-divider hover:bg-apple-fill-secondary/30 transition-colors"
                  >
                    <td className="px-6 py-3 text-apple-sm text-apple-text font-medium">
                      {lk.keyword}
                    </td>
                    <td className="px-6 py-3 text-apple-sm text-apple-text-secondary">
                      {new Date(lk.firstSeenAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-apple-sm text-apple-text-secondary">
                      {new Date(lk.lastSeenAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
