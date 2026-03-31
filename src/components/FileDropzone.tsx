'use client';

import { useCallback, useRef, useState } from 'react';

interface FileDropzoneProps {
  files: File[];
  onFilesSelect: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  onClearAll: () => void;
  maxMb: number;
  disabled?: boolean;
}

export default function FileDropzone({
  files,
  onFilesSelect,
  onFileRemove,
  onClearAll,
  maxMb,
  disabled = false,
}: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;

  const processFiles = useCallback(
    (incomingFiles: FileList | File[]) => {
      setError(null);

      const list = Array.from(incomingFiles || []);
      if (!list.length) return;

      const maxBytes = maxMb * 1024 * 1024;
      const validFiles: File[] = [];
      const rejected: string[] = [];

      for (const f of list) {
        const isPdf =
          f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');

        if (!isPdf) {
          rejected.push(`${f.name}: no es PDF`);
          continue;
        }

        if (f.size === 0) {
          rejected.push(`${f.name}: está vacío`);
          continue;
        }

        if (f.size > maxBytes) {
          rejected.push(`${f.name}: supera ${maxMb} MB`);
          continue;
        }

        validFiles.push(f);
      }

      const existingKeys = new Set(files.map(getFileKey));
      const dedupedNewFiles = validFiles.filter((f) => !existingKeys.has(getFileKey(f)));

      if (!dedupedNewFiles.length && rejected.length === 0) {
        setError('Los archivos seleccionados ya estaban en la lista.');
        return;
      }

      if (rejected.length > 0) {
        setError(`Algunos archivos no se agregaron: ${rejected.slice(0, 4).join(' | ')}`);
      }

      if (dedupedNewFiles.length > 0) {
        onFilesSelect([...files, ...dedupedNewFiles]);
      }
    },
    [files, maxMb, onFilesSelect]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled) return;
      processFiles(e.dataTransfer.files);
    },
    [disabled, processFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        processFiles(e.target.files);
      }
      e.target.value = '';
    },
    [processFiles]
  );

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  return (
    <div>
      <div
        id="dropzone"
        className={`dropzone${isDragActive ? ' dropzone--active' : ''}${files.length ? ' dropzone--has-file' : ''}`}
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label="Zona para soltar archivos PDF"
      >
        <div className="dropzone__icon">
          {files.length ? '✅' : isDragActive ? '📥' : '📄'}
        </div>

        <div className="dropzone__text">
          {files.length ? (
            <strong>{files.length} archivo(s) listos para procesar</strong>
          ) : isDragActive ? (
            <strong>Suelta los archivos aquí</strong>
          ) : (
            <>
              <strong>Arrastra tus facturas PDF aquí</strong> o haz clic para seleccionar varias
            </>
          )}
        </div>

        <div className="dropzone__hint">
          {files.length
            ? 'Puedes agregar más PDFs o quitar algunos antes de procesar'
            : `Solo PDF • Máximo ${maxMb} MB por archivo`}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={handleInputChange}
          style={{ display: 'none' }}
          id="file-input"
          aria-label="Seleccionar archivos PDF"
          disabled={disabled}
        />
      </div>

      {files.length > 0 && (
        <div className="file-info animate-fade-in" style={{ display: 'block' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <strong>Archivos en cola: {files.length}</strong>

            <button
              className="file-info__remove"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setError(null);
                onClearAll();
              }}
              disabled={disabled}
            >
              ✕ Vaciar lista
            </button>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {files.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="file-info__name" title={file.name}>
                    {index + 1}. {file.name}
                  </div>
                  <div className="file-info__size">{formatSize(file.size)}</div>
                </div>

                <button
                  className="file-info__remove"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileRemove(index);
                  }}
                  disabled={disabled}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="error-message" role="alert">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}