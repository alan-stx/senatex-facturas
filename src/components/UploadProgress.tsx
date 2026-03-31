'use client';

import type { UploadStatus } from '@/types';

interface UploadProgressProps {
  status: UploadStatus;
  currentFileName?: string;
  currentIndex?: number;
  totalFiles?: number;
}

const STATUS_LABELS: Record<string, string> = {
  uploading: 'Subiendo archivo al servidor...',
  processing: 'Procesando factura en el servidor...',
};

export default function UploadProgress({
  status,
  currentFileName,
  currentIndex = 0,
  totalFiles = 0,
}: UploadProgressProps) {
  const label = STATUS_LABELS[status];
  if (!label) return null;

  const batchProgress =
    totalFiles > 0 ? Math.round((currentIndex / totalFiles) * 100) : 0;

  return (
    <div className="animate-fade-in" id="upload-progress" role="progressbar">
      <div className="progress-bar">
        <div
          className="progress-bar__fill"
          style={{ width: `${Math.max(batchProgress, status === 'uploading' ? 10 : 15)}%` }}
        />
      </div>

      <div className="progress-label animate-pulse">
        {label}
        {totalFiles > 0 ? ` (${currentIndex} de ${totalFiles})` : ''}
      </div>

      {currentFileName && (
        <div className="dropzone__hint" style={{ marginTop: 8 }}>
          Archivo actual: <strong>{currentFileName}</strong>
        </div>
      )}
    </div>
  );
}