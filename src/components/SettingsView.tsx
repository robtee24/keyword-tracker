import { useState, useEffect, useCallback } from 'react';
import { authenticatedFetch } from '../services/authService';
import { API_ENDPOINTS } from '../config/api';
import { InfoTooltip } from './Tooltip';
import {
  TEXT_TO_IMAGE_MODELS, IMAGE_EDIT_MODELS, TEXT_TO_VIDEO_MODELS, IMAGE_TO_VIDEO_MODELS,
  CONTENT_GENERATION_MODELS, ANALYSIS_AUDIT_MODELS, IDEA_GENERATION_MODELS,
  getModelPreferences, setModelPreferences, formatModelOption,
} from '../config/models';
import type { ModelOption } from '../config/models';

interface SettingsViewProps {
  projectId: string;
  projectName: string;
  isOwner: boolean;
}

interface Member {
  id: string;
  email: string;
  role: string;
  invited_at: string;
  user_id: string | null;
}

interface ModelDropdownProps {
  label: string;
  hint?: string;
  models: ModelOption[];
  selected: string;
  onChange: (id: string) => void;
}

function ModelDropdown({ label, hint, models, selected, onChange }: ModelDropdownProps) {
  const selectedModel = models.find(m => m.id === selected);
  const hasRoutes = selectedModel?.routes && selectedModel.routes.length > 1;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-apple-sm font-medium text-apple-text">{label}</label>
        {hint && <span className="text-[10px] text-apple-text-tertiary">{hint}</span>}
      </div>
      <div className="flex gap-2">
        <select
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          className="input flex-1 text-apple-sm cursor-pointer"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {formatModelOption(m)}
            </option>
          ))}
        </select>
        {hasRoutes && (
          <select
            value={selectedModel.routes!.find(r => r.modelId === selected)?.provider || selectedModel.routes![0].provider}
            onChange={(e) => {
              const route = selectedModel.routes!.find(r => r.provider === e.target.value);
              if (route) onChange(route.modelId);
            }}
            className="input w-28 text-apple-xs cursor-pointer"
            title="Choose API provider"
          >
            {selectedModel.routes!.map((r) => (
              <option key={r.provider} value={r.provider}>{r.label}</option>
            ))}
          </select>
        )}
      </div>
      {selectedModel?.description && (
        <p className="text-[11px] text-apple-text-tertiary mt-1 ml-0.5">{selectedModel.description}</p>
      )}
    </div>
  );
}

export default function SettingsView({ projectId, projectName, isOwner }: SettingsViewProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const prefs = getModelPreferences(projectId);
  const [textToImage, setTextToImage] = useState(prefs.textToImage);
  const [imageEdit, setImageEdit] = useState(prefs.imageEdit);
  const [textToVideo, setTextToVideo] = useState(prefs.textToVideo);
  const [imageToVideo, setImageToVideo] = useState(prefs.imageToVideo);
  const [contentGeneration, setContentGeneration] = useState(prefs.contentGeneration);
  const [analysisAudit, setAnalysisAudit] = useState(prefs.analysisAudit);
  const [ideaGeneration, setIdeaGeneration] = useState(prefs.ideaGeneration);
  const [modelSaved, setModelSaved] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await authenticatedFetch(
        `${API_ENDPOINTS.projects.members}?project_id=${projectId}`
      );
      const data = await res.json();
      setMembers(data.members || []);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  useEffect(() => {
    const p = getModelPreferences(projectId);
    setTextToImage(p.textToImage);
    setImageEdit(p.imageEdit);
    setTextToVideo(p.textToVideo);
    setImageToVideo(p.imageToVideo);
    setContentGeneration(p.contentGeneration);
    setAnalysisAudit(p.analysisAudit);
    setIdeaGeneration(p.ideaGeneration);
  }, [projectId]);

  const showSaved = () => {
    setModelSaved(true);
    setTimeout(() => setModelSaved(false), 2000);
  };

  const handleChange = (category: string, model: string) => {
    const update: Record<string, string> = { [category]: model };
    switch (category) {
      case 'textToImage': setTextToImage(model); update.imageModel = model; break;
      case 'imageEdit': setImageEdit(model); break;
      case 'textToVideo': setTextToVideo(model); update.videoModel = model; break;
      case 'imageToVideo': setImageToVideo(model); break;
      case 'contentGeneration': setContentGeneration(model); break;
      case 'analysisAudit': setAnalysisAudit(model); break;
      case 'ideaGeneration': setIdeaGeneration(model); break;
    }
    setModelPreferences(projectId, update);
    showSaved();
  };

  const handleAddMember = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    setError('');
    setSuccess('');

    try {
      const res = await authenticatedFetch(API_ENDPOINTS.projects.members, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, email: newEmail.trim(), role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`${newEmail.trim()} has been added to the project.`);
        setNewEmail('');
        setNewRole('viewer');
        fetchMembers();
      } else {
        setError(data.error || 'Failed to add member');
      }
    } catch {
      setError('Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (memberId: string, email: string) => {
    if (!confirm(`Remove ${email} from this project?`)) return;
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.projects.members, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, member_id: memberId }),
      });
      if (res.ok) fetchMembers();
    } catch { /* silently fail */ }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-apple-title2 font-bold text-apple-text">Settings</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Manage project settings for {projectName}
        </p>
      </div>

      {/* AI Models — Media */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-apple-title3 font-semibold text-apple-text">Media Models</h2>
          <InfoTooltip text="Default models for image and video generation. Override per-generation in the settings modal." position="right" />
          {modelSaved && (
            <span className="text-apple-xs text-green-600 font-medium ml-2 animate-fade-in">Saved</span>
          )}
        </div>
        <p className="text-apple-xs text-apple-text-tertiary mb-4">
          Prices include 30% service markup. Costs are estimated.
        </p>

        <div className="space-y-4">
          <ModelDropdown
            label="Image Generation"
            hint="Blog images, social media, ads"
            models={TEXT_TO_IMAGE_MODELS}
            selected={textToImage}
            onChange={(m) => handleChange('textToImage', m)}
          />
          <ModelDropdown
            label="Image Editing"
            hint="Prompt-based edits, style transfer"
            models={IMAGE_EDIT_MODELS}
            selected={imageEdit}
            onChange={(m) => handleChange('imageEdit', m)}
          />
          <ModelDropdown
            label="Video Generation"
            hint="Text-to-video for ads, social"
            models={TEXT_TO_VIDEO_MODELS}
            selected={textToVideo}
            onChange={(m) => handleChange('textToVideo', m)}
          />
          <ModelDropdown
            label="Image to Video"
            hint="Animate images into video clips"
            models={IMAGE_TO_VIDEO_MODELS}
            selected={imageToVideo}
            onChange={(m) => handleChange('imageToVideo', m)}
          />
        </div>
      </div>

      {/* AI Models — LLM */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-apple-title3 font-semibold text-apple-text">AI Writing & Analysis Models</h2>
          <InfoTooltip text="Models used for content writing, audits, keyword analysis, and idea generation across the platform." position="right" />
          {modelSaved && (
            <span className="text-apple-xs text-green-600 font-medium ml-2 animate-fade-in">Saved</span>
          )}
        </div>
        <p className="text-apple-xs text-apple-text-tertiary mb-4">
          Estimated cost per task. Actual cost varies by content length.
        </p>

        <div className="space-y-4">
          <ModelDropdown
            label="Content Generation"
            hint="Blog articles, page content, ad copy, social posts"
            models={CONTENT_GENERATION_MODELS}
            selected={contentGeneration}
            onChange={(m) => handleChange('contentGeneration', m)}
          />
          <ModelDropdown
            label="Analysis & Audits"
            hint="Page audits, keyword analysis, SEO recommendations"
            models={ANALYSIS_AUDIT_MODELS}
            selected={analysisAudit}
            onChange={(m) => handleChange('analysisAudit', m)}
          />
          <ModelDropdown
            label="Idea Generation"
            hint="Social ideas, blog opportunities, video concepts"
            models={IDEA_GENERATION_MODELS}
            selected={ideaGeneration}
            onChange={(m) => handleChange('ideaGeneration', m)}
          />
        </div>
      </div>

      {/* Team Members Section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-apple-title3 font-semibold text-apple-text">Team Members</h2>
          <InfoTooltip text="Owner has full control. Editors can run audits and manage content. Viewers have read-only access." position="right" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-apple-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between py-3 px-4 rounded-apple-sm bg-apple-fill-secondary"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {member.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-apple-sm font-medium text-apple-text">{member.email}</p>
                    <p className="text-apple-xs text-apple-text-tertiary">
                      Added {new Date(member.invited_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    member.role === 'owner'
                      ? 'bg-blue-100 text-blue-700'
                      : member.role === 'editor'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {member.role}
                  </span>
                  {isOwner && member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(member.id, member.email)}
                      className="p-1 rounded text-apple-text-tertiary hover:text-apple-red hover:bg-red-50 transition-colors"
                      title="Remove member"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isOwner && (
        <div className="card p-6">
          <h2 className="text-apple-title3 font-semibold text-apple-text mb-4">Add Team Member</h2>

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="input w-full"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember(); }}
              />
            </div>
            <div className="w-32">
              <label className="block text-apple-xs font-medium text-apple-text-secondary mb-1.5">
                Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="input w-full cursor-pointer"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </div>
            <button
              onClick={handleAddMember}
              disabled={adding || !newEmail.trim()}
              className="btn-primary shrink-0"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>

          {error && <p className="mt-3 text-apple-sm text-apple-red">{error}</p>}
          {success && <p className="mt-3 text-apple-sm text-green-600">{success}</p>}
        </div>
      )}
    </div>
  );
}
