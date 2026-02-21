import { useState } from 'react';
import type { SearchConsoleSite } from '../types';

export interface Project {
  id: string;
  name: string;
  siteUrl: string;
  createdAt: string;
}

interface ProjectsViewProps {
  projects: Project[];
  sites: SearchConsoleSite[];
  sitesLoading: boolean;
  onCreateProject: (name: string, siteUrl: string) => void;
  onDeleteProject: (id: string) => void;
  onSelectProject: (project: Project) => void;
}

export default function ProjectsView({
  projects,
  sites,
  sitesLoading,
  onCreateProject,
  onDeleteProject,
  onSelectProject,
}: ProjectsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.siteUrl.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => {
    if (!newName.trim() || !newSiteUrl) return;
    onCreateProject(newName.trim(), newSiteUrl);
    setNewName('');
    setNewSiteUrl('');
    setShowCreate(false);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-apple-title1 font-bold text-apple-text tracking-tight">
            Projects
          </h2>
          <p className="text-apple-base text-apple-text-secondary mt-1">
            Manage your keyword tracking projects
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input w-full pl-10"
          />
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-apple shadow-apple-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-apple-title3 font-semibold text-apple-text mb-4">
              Create New Project
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-apple-sm font-medium text-apple-text-secondary mb-1.5">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. My Website SEO"
                  className="input w-full"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') setShowCreate(false);
                  }}
                />
              </div>

              <div>
                <label className="block text-apple-sm font-medium text-apple-text-secondary mb-1.5">
                  Search Console Property
                </label>
                {sitesLoading ? (
                  <div className="flex items-center gap-2 py-2 text-apple-sm text-apple-text-tertiary">
                    <div className="w-4 h-4 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
                    Loading properties...
                  </div>
                ) : (
                  <select
                    value={newSiteUrl}
                    onChange={(e) => setNewSiteUrl(e.target.value)}
                    className="input w-full cursor-pointer"
                  >
                    <option value="" disabled>Select a property...</option>
                    {sites.map((site) => (
                      <option key={site.siteUrl} value={site.siteUrl}>
                        {site.siteUrl}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowCreate(false); setNewName(''); setNewSiteUrl(''); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || !newSiteUrl}
                className="btn-primary"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Cards */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <div
              key={project.id}
              onClick={() => onSelectProject(project)}
              className="group relative card p-5 cursor-pointer hover:shadow-apple-md transition-all duration-200 hover:-translate-y-0.5"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete project "${project.name}"?`)) {
                    onDeleteProject(project.id);
                  }
                }}
                className="absolute top-3 right-3 p-1.5 rounded-apple-sm text-apple-text-tertiary opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-apple-red transition-all duration-150"
                title="Delete project"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-apple-sm bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-apple-base shrink-0">
                  {project.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-apple-base font-semibold text-apple-text truncate">
                    {project.name}
                  </h3>
                  <p className="text-apple-xs text-apple-text-tertiary truncate mt-0.5">
                    {project.siteUrl}
                  </p>
                </div>
              </div>

              <div className="text-apple-xs text-apple-text-tertiary">
                Created {new Date(project.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-apple-fill-secondary mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h3 className="text-apple-title3 font-semibold text-apple-text mb-2">
            No projects yet
          </h3>
          <p className="text-apple-base text-apple-text-secondary max-w-sm mx-auto mb-6">
            Create your first project to start tracking keyword rankings.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Project
          </button>
        </div>
      ) : (
        <div className="card p-12 text-center">
          <p className="text-apple-base text-apple-text-secondary">
            No projects match "{searchTerm}"
          </p>
        </div>
      )}
    </div>
  );
}
