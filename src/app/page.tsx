'use client';


import { useState, useCallback, useEffect } from 'react';
import type {
  UploadStatus,
  UploadResponse,
  HistoryEntry,
  AppConfig,
  BatchItemResult,
  BatchSummary,
} from '@/types';
import FileDropzone from '@/components/FileDropzone';
import UploadProgress from '@/components/UploadProgress';
import ResultCard from '@/components/ResultCard';
import HistoryTable from '@/components/HistoryTable';
import Image from 'next/image';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const HISTORY_STORAGE_KEY = 'senatex-history';

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch { }
}

function mapResponseToStatus(data: UploadResponse): UploadStatus {
  if (data.ok) {
    if (data.status === 'duplicate_invoice') return 'duplicate_invoice';
    if (data.status === 'duplicate_file') return 'duplicate_file';
    return 'completed';
  }
  return 'error';
}

export default function HomePage() {
  const [config, setConfig] = useState<AppConfig>({
    appName: 'Facturas',
    companyName: 'Servicio Nacional Textil',
    maxPdfMb: 20,
    defaultBranch: '',
    defaultPos: '',
  });

  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [batchResults, setBatchResults] = useState<BatchItemResult[]>([]);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data: AppConfig) => {
        setConfig(data);
      })
      .catch(() => { });

    setHistory(loadHistory());
  }, []);

  const handleFilesSelect = useCallback((incoming: File[]) => {
    setFiles(incoming);
    setFormError(null);
    setResult(null);
    setBatchResults([]);
  }, []);

  const handleFileRemove = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFormError(null);
  }, []);

  const handleClearAllFiles = useCallback(() => {
    setFiles([]);
    setFormError(null);
    setResult(null);
    setBatchResults([]);
    setCurrentFileName('');
    setCurrentIndex(0);
    setStatus('idle');
  }, []);

  const handleSubmit = useCallback(async () => {
    setFormError(null);

    if (!files.length) {
      setFormError('Selecciona al menos un archivo PDF antes de enviar.');
      return;
    }

    if (status === 'uploading' || status === 'processing') return;

    setStatus('uploading');
    setResult(null);
    setBatchResults([]);
    setCurrentIndex(0);

    const localResults: BatchItemResult[] = [];
    const localHistoryEntries: HistoryEntry[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        setCurrentIndex(i + 1);
        setCurrentFileName(file.name);
        setStatus('uploading');

        try {
          const formData = new FormData();
          formData.append('archivo', file);
          formData.append('uploaded_by', 'usuario_web');
          formData.append('sucursal_usuario', 'central');
          formData.append('punto_venta_usuario', '1');
          formData.append('observacion', '');

          setStatus('processing');

          const response = await fetch('/api/upload-factura', {
            method: 'POST',
            body: formData,
          });

          const data: UploadResponse = await response.json();
          const finalStatus = mapResponseToStatus(data);

          const batchItem: BatchItemResult = {
            id: generateId(),
            filename: file.name,
            status: finalStatus,
            message: data.message,
            nro_factura: data.invoice?.nro_factura,
            invoice_uid: data.invoice?.invoice_uid,
          };

          localResults.push(batchItem);
          setBatchResults([...localResults]);

          localHistoryEntries.push({
            id: generateId(),
            timestamp: new Date().toISOString(),
            filename: file.name,
            uploaded_by: 'usuario_web',
            sucursal_usuario: 'central',
            status: finalStatus,
            nro_factura: data.invoice?.nro_factura,
            items_count: data.invoice?.items_count,
            message: data.message,
          });

          if (i === files.length - 1) {
            setResult(data);
            setStatus(finalStatus);
          }
        } catch (error) {
          console.error(`Error al procesar ${file.name}:`, error);

          const batchItem: BatchItemResult = {
            id: generateId(),
            filename: file.name,
            status: 'error',
            message: 'No se pudo conectar con el servidor o la factura falló durante el proceso.',
          };

          localResults.push(batchItem);
          setBatchResults([...localResults]);

          localHistoryEntries.push({
            id: generateId(),
            timestamp: new Date().toISOString(),
            filename: file.name,
            uploaded_by: 'usuario_web',
            sucursal_usuario: 'central',
            status: 'error',
            message: batchItem.message,
          });

          if (i === files.length - 1) {
            setResult({
              ok: false,
              status: 'error',
              message: batchItem.message,
            });
            setStatus('error');
          }
        }
      }

      setHistory((prev) => {
        const updated = [...localHistoryEntries.reverse(), ...prev].slice(0, 100);
        saveHistory(updated);
        return updated;
      });
    } finally {
      setCurrentFileName('');
    }
  }, [files, status]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setStatus('idle');
    setResult(null);
    setFormError(null);
    setBatchResults([]);
    setCurrentFileName('');
    setCurrentIndex(0);
  }, []);

  const batchSummary: BatchSummary = {
    total: batchResults.length,
    processed: batchResults.length,
    completed: batchResults.filter((r) => r.status === 'completed').length,
    duplicate_invoice: batchResults.filter((r) => r.status === 'duplicate_invoice').length,
    duplicate_file: batchResults.filter((r) => r.status === 'duplicate_file').length,
    error: batchResults.filter((r) => r.status === 'error').length,
  };

  const isProcessing = status === 'uploading' || status === 'processing';
  const hasFinishedBatch =
    batchResults.length > 0 &&
    !isProcessing &&
    files.length > 0;

  const showProcessButton =
    !hasFinishedBatch &&
    (status === 'idle' || status === 'error');

  const showResult =
    result &&
    (status === 'completed' ||
      status === 'duplicate_invoice' ||
      status === 'duplicate_file' ||
      status === 'error');

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-header__brand">
          <Image
            src="/Logo_Senatex.png"
            alt="Logo SENATEX"
            width={320}
            height={118}
            className="app-header__logo"
            priority
          />
        </div>
        <h1 className="app-header__title">{config.appName}</h1>
        <p className="app-header__subtitle">{config.companyName}</p>
      </header>

      <main>
        <section className="card" aria-labelledby="section-upload">
          <h2 className="card__title" id="section-upload">
            <span className="card__title-icon">📤</span>
            Cargar Facturas PDF
          </h2>

          <FileDropzone
            files={files}
            onFilesSelect={handleFilesSelect}
            onFileRemove={handleFileRemove}
            onClearAll={handleClearAllFiles}
            maxMb={config.maxPdfMb}
            disabled={isProcessing}
          />
        </section>

        {formError && (
          <div className="error-message section-gap" role="alert">
            ⚠️ {formError}
          </div>
        )}

        {showProcessButton && (
          <button
            className="btn-primary section-gap"
            onClick={handleSubmit}
            disabled={isProcessing || files.length === 0}
            type="button"
            id="btn-submit"
          >
            {isProcessing ? (
              <>
                <span className="spinner" />
                Procesando lote...
              </>
            ) : (
              <>📤 Procesar {files.length > 0 ? `${files.length} factura(s)` : 'facturas'}</>
            )}
          </button>
        )}

        {isProcessing && (
          <div className="section-gap">
            <UploadProgress
              status={status}
              currentFileName={currentFileName}
              currentIndex={currentIndex}
              totalFiles={files.length}
            />
          </div>
        )}

        {batchResults.length > 0 && (
          <section className="card section-gap">
            <h2 className="card__title">
              <span className="card__title-icon">📦</span>
              Resumen del lote
            </h2>

            <div className="batch-summary-grid">
              <div className="batch-summary-stat">
                <span className="batch-summary-stat__label">Total</span>
                <strong className="batch-summary-stat__value">{batchSummary.total}</strong>
              </div>

              <div className="batch-summary-stat">
                <span className="batch-summary-stat__label">Correctas</span>
                <strong className="batch-summary-stat__value">{batchSummary.completed}</strong>
              </div>

              <div className="batch-summary-stat">
                <span className="batch-summary-stat__label">Dup. factura</span>
                <strong className="batch-summary-stat__value">{batchSummary.duplicate_invoice}</strong>
              </div>

              <div className="batch-summary-stat">
                <span className="batch-summary-stat__label">Dup. archivo</span>
                <strong className="batch-summary-stat__value">{batchSummary.duplicate_file}</strong>
              </div>

              <div className="batch-summary-stat">
                <span className="batch-summary-stat__label">Errores</span>
                <strong className="batch-summary-stat__value">{batchSummary.error}</strong>
              </div>
            </div>

            <div className="batch-results-list">
              {batchResults.map((item, index) => (
                <div key={item.id} className="batch-result-item">
                  <div className="batch-result-item__top">
                    <strong className="batch-result-item__filename">
                      {index + 1}. {item.filename}
                    </strong>
                    <span className={`status-badge status-badge--${item.status.startsWith('duplicate') ? 'duplicate' : item.status}`}>
                      {item.status === 'completed'
                        ? '✓ Procesada'
                        : item.status === 'duplicate_invoice'
                          ? '⚠ Factura duplicada'
                          : item.status === 'duplicate_file'
                            ? '⚠ Archivo duplicado'
                            : '✕ Error'}
                    </span>
                  </div>

                  <div className="batch-result-item__message">{item.message}</div>

                  {item.nro_factura && (
                    <div className="batch-result-item__meta">
                      Factura: {item.nro_factura}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {showResult && result && (
          <div className="section-gap">
            <ResultCard result={result} onReset={handleReset} />
          </div>
        )}

        <section className="card history-section" aria-labelledby="section-history">
          <h2 className="card__title" id="section-history">
            <span className="card__title-icon">📋</span>
            Últimos Envíos de la Sesión
          </h2>

          <HistoryTable entries={history} />
        </section>
      </main>

      <footer className="app-footer">
        {config.companyName} — {config.appName} · Sistema Interno
      </footer>
    </div>
  );
}