import { useState } from 'react';
import MediaGenerationModal from './MediaGenerationModal';
import type { GenerationSettings } from './MediaGenerationModal';
import { authenticatedFetch } from '../services/authService';
import { API_ENDPOINTS } from '../config/api';
import { useCredits } from '../contexts/CreditsContext';

type EditAction = 'edit' | 'removeBackground' | 'upscale' | 'imageToVideo';

interface MediaEditButtonProps {
  imageUrl: string;
  projectId: string;
  onImageUpdated?: (newUrl: string) => void;
  onVideoCreated?: (videoUrl: string) => void;
  className?: string;
  showVideoOption?: boolean;
}

export default function MediaEditButton({
  imageUrl, projectId, onImageUpdated, onVideoCreated,
  className = '', showVideoOption = true,
}: MediaEditButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalMode, setModalMode] = useState<EditAction | null>(null);
  const [processing, setProcessing] = useState(false);
  const { refreshCredits } = useCredits();

  const handleAction = async (action: EditAction) => {
    setMenuOpen(false);

    if (action === 'edit' || action === 'imageToVideo') {
      setModalMode(action);
      return;
    }

    setProcessing(true);
    try {
      const endpoint = action === 'removeBackground'
        ? API_ENDPOINTS.media.backgroundRemove
        : API_ENDPOINTS.media.upscale;

      const resp = await authenticatedFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, projectId }),
      });

      if (!resp.ok) throw new Error('Operation failed');
      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      if (data.imageUrl && onImageUpdated) {
        onImageUpdated(data.imageUrl);
      }
      await refreshCredits();
    } catch (err) {
      console.error(`[MediaEdit] ${action} error:`, err);
    } finally {
      setProcessing(false);
    }
  };

  const handleModalGenerate = async (settings: GenerationSettings) => {
    setProcessing(true);
    try {
      if (modalMode === 'edit') {
        const resp = await authenticatedFetch(API_ENDPOINTS.media.editImage, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl,
            editPrompt: settings.prompt,
            model: settings.model,
            projectId,
          }),
        });

        if (!resp.ok) throw new Error('Edit failed');
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        if (data.imageUrl && onImageUpdated) onImageUpdated(data.imageUrl);
      } else if (modalMode === 'imageToVideo') {
        const resp = await authenticatedFetch(API_ENDPOINTS.media.imageToVideo, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl,
            prompt: settings.prompt,
            model: settings.model,
            duration: settings.duration,
            aspectRatio: settings.aspectRatio,
            resolution: settings.resolution,
            generateAudio: settings.generateAudio,
            projectId,
          }),
        });

        if (!resp.ok) throw new Error('I2V failed');
        const data = await resp.json();
        if (data.error) throw new Error(data.error);
        if (data.videoUrl && onVideoCreated) onVideoCreated(data.videoUrl);
      }
      await refreshCredits();
    } catch (err) {
      console.error(`[MediaEdit] modal action error:`, err);
    } finally {
      setProcessing(false);
      setModalMode(null);
    }
  };

  return (
    <>
      <div className={`relative inline-block ${className}`}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          disabled={processing}
          className="p-1.5 bg-black/50 hover:bg-black/70 rounded-apple text-white transition-colors backdrop-blur-sm"
          title="Edit media"
        >
          {processing ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
            </svg>
          )}
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white rounded-apple shadow-lg border border-apple-divider py-1">
              <button
                onClick={() => handleAction('edit')}
                className="w-full text-left px-3 py-2 text-apple-sm text-apple-text hover:bg-apple-fill-secondary transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                </svg>
                Edit with AI
              </button>
              <button
                onClick={() => handleAction('removeBackground')}
                className="w-full text-left px-3 py-2 text-apple-sm text-apple-text hover:bg-apple-fill-secondary transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Remove Background
              </button>
              <button
                onClick={() => handleAction('upscale')}
                className="w-full text-left px-3 py-2 text-apple-sm text-apple-text hover:bg-apple-fill-secondary transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                Upscale
              </button>
              {showVideoOption && (
                <button
                  onClick={() => handleAction('imageToVideo')}
                  className="w-full text-left px-3 py-2 text-apple-sm text-apple-text hover:bg-apple-fill-secondary transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-apple-text-tertiary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  Animate to Video
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {modalMode === 'edit' && (
        <MediaGenerationModal
          isOpen
          onClose={() => setModalMode(null)}
          mode="imageEdit"
          projectId={projectId}
          onGenerate={handleModalGenerate}
          defaultImageUrl={imageUrl}
        />
      )}

      {modalMode === 'imageToVideo' && (
        <MediaGenerationModal
          isOpen
          onClose={() => setModalMode(null)}
          mode="imageToVideo"
          projectId={projectId}
          onGenerate={handleModalGenerate}
          defaultImageUrl={imageUrl}
        />
      )}
    </>
  );
}
