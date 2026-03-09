import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';
import { authenticatedFetch } from '../services/authService';
import { parseJsonOrThrow } from '../utils/apiResponse';

interface PublishPage {
  id: string;
  project_id: string;
  site_url: string;
  source_type: string;
  source_id: string | null;
  title: string;
  slug: string;
  meta_description: string;
  og_image: string;
  html_content: string;
  schema_markup: string;
  page_url: string;
  status: string;
  published_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  publish_method: string | null;
  publish_result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

type Tab = 'queued' | 'published' | 'rejected';

interface Props {
  siteUrl: string;
  projectId: string;
}

export default function PagePublishView({ siteUrl, projectId }: Props) {
  const [pages, setPages] = useState<PublishPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('queued');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', slug: '', metaDescription: '', ogImage: '' });
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [publishing, setPublishing] = useState(false);

  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await authenticatedFetch(
        `${API_ENDPOINTS.db.pagePublish}?projectId=${projectId}`
      );
      const data = await parseJsonOrThrow<{ data: PublishPage[] }>(resp);
      setPages(data.data || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadPages(); }, [loadPages]);

  const filteredPages = pages.filter(p => p.status === activeTab);
  const queuedCount = pages.filter(p => p.status === 'queued').length;
  const publishedCount = pages.filter(p => p.status === 'published').length;
  const rejectedCount = pages.filter(p => p.status === 'rejected').length;

  const updatePageStatus = async (id: string, status: string, extra?: Record<string, unknown>) => {
    try {
      await authenticatedFetch(API_ENDPOINTS.db.pagePublish, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, ...extra }),
      });
      setPages(prev => prev.map(p =>
        p.id === id ? { ...p, status, ...extra } as PublishPage : p
      ));
    } catch { /* silent */ }
  };

  const handlePublish = async (id: string) => {
    setPublishing(true);
    await updatePageStatus(id, 'published', {
      publishedAt: new Date().toISOString(),
      publishMethod: 'manual',
    });
    setPublishing(false);
  };

  const handlePublishAll = async () => {
    setPublishing(true);
    const queued = pages.filter(p => p.status === 'queued' && selectedIds.has(p.id));
    const toPublish = queued.length > 0 ? queued : pages.filter(p => p.status === 'queued');
    for (const page of toPublish) {
      await updatePageStatus(page.id, 'published', {
        publishedAt: new Date().toISOString(),
        publishMethod: 'manual',
      });
    }
    setSelectedIds(new Set());
    setPublishing(false);
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    await updatePageStatus(rejectModal, 'rejected', {
      rejectedAt: new Date().toISOString(),
      rejectionReason: rejectReason || 'Rejected by user',
    });
    setRejectModal(null);
    setRejectReason('');
  };

  const handleRequeue = async (id: string) => {
    await updatePageStatus(id, 'queued');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await authenticatedFetch(API_ENDPOINTS.db.pagePublish, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          title: editForm.title,
          slug: editForm.slug,
          metaDescription: editForm.metaDescription,
          ogImage: editForm.ogImage,
        }),
      });
      setPages(prev => prev.map(p =>
        p.id === editingId ? { ...p, title: editForm.title, slug: editForm.slug, meta_description: editForm.metaDescription, og_image: editForm.ogImage } : p
      ));
      setEditingId(null);
    } catch { /* silent */ }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allQueued = filteredPages.map(p => p.id);
    if (selectedIds.size === allQueued.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allQueued));
    }
  };

  const previewPage = pages.find(p => p.id === previewId);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-apple-text">Publish Pages</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Review, edit, and publish pages to your website.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-apple-fill-secondary rounded-apple p-1">
        {(['queued', 'published', 'rejected'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSelectedIds(new Set()); }}
            className={`flex-1 px-4 py-2 rounded-apple-sm text-apple-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white shadow-sm text-apple-text'
                : 'text-apple-text-secondary hover:text-apple-text'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span className="ml-1.5 text-[10px] font-mono bg-apple-fill-tertiary px-1.5 py-0.5 rounded-full">
              {tab === 'queued' ? queuedCount : tab === 'published' ? publishedCount : rejectedCount}
            </span>
          </button>
        ))}
      </div>

      {/* Actions bar */}
      {activeTab === 'queued' && queuedCount > 0 && (
        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-apple-xs text-apple-text-secondary">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredPages.length && filteredPages.length > 0}
              onChange={toggleSelectAll}
              className="rounded border-apple-border"
            />
            Select all
          </label>
          <button
            onClick={handlePublishAll}
            disabled={publishing}
            className="px-4 py-2 bg-green-600 text-white rounded-apple-sm text-apple-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {selectedIds.size > 0 ? `Publish Selected (${selectedIds.size})` : 'Publish All'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-apple-text-tertiary text-apple-sm">Loading...</div>
      ) : filteredPages.length === 0 ? (
        <div className="text-center py-16 text-apple-text-tertiary">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-apple-sm font-medium">No {activeTab} pages</p>
          <p className="text-apple-xs mt-1">
            {activeTab === 'queued' ? 'Use "Move to Publish" on created pages to add them here.' : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPages.map(page => (
            <div key={page.id} className="bg-white rounded-apple border border-apple-border p-5">
              <div className="flex items-start gap-4">
                {activeTab === 'queued' && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(page.id)}
                    onChange={() => toggleSelect(page.id)}
                    className="rounded border-apple-border mt-1"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                      page.source_type === 'rebuild' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {page.source_type === 'rebuild' ? 'Optimized' : 'New'}
                    </span>
                    <h3 className="text-apple-sm font-semibold text-apple-text truncate">{page.title}</h3>
                  </div>
                  {page.slug && (
                    <p className="text-[10px] text-apple-text-tertiary font-mono">/{page.slug}</p>
                  )}
                  {page.meta_description && (
                    <p className="text-apple-xs text-apple-text-secondary mt-1 line-clamp-2">{page.meta_description}</p>
                  )}
                  <p className="text-[10px] text-apple-text-tertiary mt-1">
                    Added {new Date(page.created_at).toLocaleDateString()}
                    {page.published_at && ` • Published ${new Date(page.published_at).toLocaleDateString()}`}
                    {page.rejected_at && ` • Rejected ${new Date(page.rejected_at).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {page.html_content && (
                    <button
                      onClick={() => setPreviewId(previewId === page.id ? null : page.id)}
                      className="px-2.5 py-1 text-[11px] font-medium rounded border border-apple-border text-apple-text-secondary hover:bg-apple-fill-secondary transition-colors"
                    >
                      Preview
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingId(page.id);
                      setEditForm({
                        title: page.title,
                        slug: page.slug || '',
                        metaDescription: page.meta_description || '',
                        ogImage: page.og_image || '',
                      });
                    }}
                    className="px-2.5 py-1 text-[11px] font-medium rounded border border-apple-border text-apple-text-secondary hover:bg-apple-fill-secondary transition-colors"
                  >
                    Edit SEO
                  </button>
                  {activeTab === 'queued' && (
                    <>
                      <button
                        onClick={() => handlePublish(page.id)}
                        disabled={publishing}
                        className="px-3 py-1 text-[11px] font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        Publish
                      </button>
                      <button
                        onClick={() => setRejectModal(page.id)}
                        className="px-2.5 py-1 text-[11px] font-medium rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {activeTab === 'rejected' && (
                    <button
                      onClick={() => handleRequeue(page.id)}
                      className="px-3 py-1 text-[11px] font-medium rounded bg-apple-blue text-white hover:bg-blue-600 transition-colors"
                    >
                      Re-queue
                    </button>
                  )}
                </div>
              </div>

              {/* Preview */}
              {previewId === page.id && page.html_content && (
                <div className="mt-4 border border-apple-border rounded-lg overflow-hidden">
                  <iframe
                    srcDoc={page.html_content}
                    className="w-full h-[500px] bg-white"
                    title={`Preview: ${page.title}`}
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SEO Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-apple-text">Edit Page SEO Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="text-apple-xs font-medium text-apple-text-secondary block mb-1">Page Title</label>
                <input type="text" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="input w-full text-apple-sm" />
              </div>
              <div>
                <label className="text-apple-xs font-medium text-apple-text-secondary block mb-1">Slug</label>
                <input type="text" value={editForm.slug} onChange={e => setEditForm(f => ({ ...f, slug: e.target.value }))} className="input w-full text-apple-sm" placeholder="/page-slug" />
              </div>
              <div>
                <label className="text-apple-xs font-medium text-apple-text-secondary block mb-1">Meta Description</label>
                <textarea value={editForm.metaDescription} onChange={e => setEditForm(f => ({ ...f, metaDescription: e.target.value }))} className="input w-full text-apple-sm resize-none" rows={3} />
                <p className="text-[10px] text-apple-text-tertiary mt-0.5">{editForm.metaDescription.length}/160 characters</p>
              </div>
              <div>
                <label className="text-apple-xs font-medium text-apple-text-secondary block mb-1">OG Image URL</label>
                <input type="text" value={editForm.ogImage} onChange={e => setEditForm(f => ({ ...f, ogImage: e.target.value }))} className="input w-full text-apple-sm" placeholder="https://..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditingId(null)} className="px-4 py-2 text-apple-sm text-apple-text-secondary hover:bg-apple-fill-secondary rounded-apple-sm transition-colors">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-apple-blue text-white rounded-apple-sm text-apple-sm font-medium hover:bg-blue-600 transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-apple-text">Reject Page</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)"
              className="input w-full text-apple-sm resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="px-4 py-2 text-apple-sm text-apple-text-secondary hover:bg-apple-fill-secondary rounded-apple-sm transition-colors">Cancel</button>
              <button onClick={handleReject} className="px-4 py-2 bg-red-600 text-white rounded-apple-sm text-apple-sm font-medium hover:bg-red-700 transition-colors">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
