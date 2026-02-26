import { useState, useEffect, useCallback } from 'react';
import { authenticatedFetch } from '../services/authService';
import { API_ENDPOINTS } from '../config/api';
import { InfoTooltip } from './Tooltip';

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

export default function SettingsView({ projectId, projectName, isOwner }: SettingsViewProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleAddMember = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    setError('');
    setSuccess('');

    try {
      const res = await authenticatedFetch(API_ENDPOINTS.projects.members, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          email: newEmail.trim(),
          role: newRole,
        }),
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
      if (res.ok) {
        fetchMembers();
      }
    } catch { /* silently fail */ }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-apple-title2 font-bold text-apple-text">Settings</h1>
        <p className="text-apple-sm text-apple-text-secondary mt-1">
          Manage team access for {projectName}
        </p>
      </div>

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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMember();
                }}
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

          {error && (
            <p className="mt-3 text-apple-sm text-apple-red">{error}</p>
          )}
          {success && (
            <p className="mt-3 text-apple-sm text-green-600">{success}</p>
          )}
        </div>
      )}
    </div>
  );
}
