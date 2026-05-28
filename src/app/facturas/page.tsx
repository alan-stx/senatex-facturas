'use client';


import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import AppShell from '@/components/AppShell';
import Link from 'next/link';

import {
  PAYMENT_METHOD_OPTIONS,
  INCOME_STATUS_OPTIONS,
  INVOICE_LEVEL_OPTIONS,
} from '@/types';

import type {
  UploadStatus,
  UploadResponse,
  HistoryEntry,
  AppConfig,
  BatchItemResult,
  BatchSummary,
  PaymentMethod,
  IncomeStatus,
  InvoiceLevel,
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

const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'Efectivo';
const DEFAULT_INCOME_STATUS: IncomeStatus = 'Ya ingresado';
const DEFAULT_INVOICE_LEVEL: InvoiceLevel = 'Venta en tienda';

function getFileKey(file: File): string {
  return `${file.name}__${file.size}__${file.lastModified}`;
}

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
  const { data: session } = useSession();
  const [config, setConfig] = useState<AppConfig>({
    appName: 'Facturas',
    companyName: 'Servicio Nacional Textil',
    maxPdfMb: 20,
    defaultBranch: '',
    defaultPos: '',
  });

  const [files, setFiles] = useState<File[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Record<string, PaymentMethod>>({});
  const [incomeStatuses, setIncomeStatuses] = useState<Record<string, IncomeStatus>>({});
  const [estimatedIncomeDates, setEstimatedIncomeDates] = useState<Record<string, string>>({});
  const [invoiceLevels, setInvoiceLevels] = useState<Record<string, InvoiceLevel>>({});
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

    setPaymentMethods((prev) => {
      const next: Record<string, PaymentMethod> = {};

      for (const file of incoming) {
        const key = getFileKey(file);
        next[key] = prev[key] || DEFAULT_PAYMENT_METHOD;
      }

      return next;
    });

    setIncomeStatuses((prev) => {
      const next: Record<string, IncomeStatus> = {};

      for (const file of incoming) {
        const key = getFileKey(file);
        next[key] = prev[key] || DEFAULT_INCOME_STATUS;
      }

      return next;
    });

    setEstimatedIncomeDates((prev) => {
      const next: Record<string, string> = {};

      for (const file of incoming) {
        const key = getFileKey(file);
        next[key] = prev[key] || '';
      }

      return next;
    });

    setInvoiceLevels((prev) => {
      const next: Record<string, InvoiceLevel> = {};

      for (const file of incoming) {
        const key = getFileKey(file);
        next[key] = prev[key] || DEFAULT_INVOICE_LEVEL;
      }

      return next;
    });

    setFormError(null);
    setResult(null);
    setBatchResults([]);
  }, []);

  const handleFileRemove = useCallback((index: number) => {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);

      setPaymentMethods((current) => {
        const next: Record<string, PaymentMethod> = {};

        for (const file of updated) {
          const key = getFileKey(file);
          next[key] = current[key] || DEFAULT_PAYMENT_METHOD;
        }

        return next;
      });

      setIncomeStatuses((current) => {
        const next: Record<string, IncomeStatus> = {};

        for (const file of updated) {
          const key = getFileKey(file);
          next[key] = current[key] || DEFAULT_INCOME_STATUS;
        }

        return next;
      });

      setEstimatedIncomeDates((current) => {
        const next: Record<string, string> = {};

        for (const file of updated) {
          const key = getFileKey(file);
          next[key] = current[key] || '';
        }

        return next;
      });

      setInvoiceLevels((current) => {
        const next: Record<string, InvoiceLevel> = {};

        for (const file of updated) {
          const key = getFileKey(file);
          next[key] = current[key] || DEFAULT_INVOICE_LEVEL;
        }

        return next;
      });

      return updated;
    });

    setFormError(null);
  }, []);

  const handleClearAllFiles = useCallback(() => {
    setFiles([]);
    setPaymentMethods({});
    setIncomeStatuses({});
    setEstimatedIncomeDates({});
    setInvoiceLevels({});
    setFormError(null);
    setResult(null);
    setBatchResults([]);
    setCurrentFileName('');
    setCurrentIndex(0);
    setStatus('idle');
  }, []);

  const handlePaymentMethodChange = useCallback(
    (file: File, metodoPago: PaymentMethod) => {
      if (!PAYMENT_METHOD_OPTIONS.includes(metodoPago)) return;

      setPaymentMethods((prev) => ({
        ...prev,
        [getFileKey(file)]: metodoPago,
      }));
    },
    []
  );

  const handleIncomeStatusChange = useCallback(
    (file: File, estadoIngreso: IncomeStatus) => {
      if (!INCOME_STATUS_OPTIONS.includes(estadoIngreso)) return;

      const key = getFileKey(file);

      setIncomeStatuses((prev) => ({
        ...prev,
        [key]: estadoIngreso,
      }));

      if (estadoIngreso === 'Ya ingresado') {
        setEstimatedIncomeDates((prev) => ({
          ...prev,
          [key]: '',
        }));
      }
    },
    []
  );

  const handleEstimatedIncomeDateChange = useCallback(
    (file: File, value: string) => {
      setEstimatedIncomeDates((prev) => ({
        ...prev,
        [getFileKey(file)]: value,
      }));
    },
    []
  );

  const handleInvoiceLevelChange = useCallback(
    (file: File, nivel: InvoiceLevel) => {
      if (!INVOICE_LEVEL_OPTIONS.includes(nivel)) return;

      setInvoiceLevels((prev) => ({
        ...prev,
        [getFileKey(file)]: nivel,
      }));
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    setFormError(null);

    if (!session?.user?.email) {
      setFormError('Debes iniciar sesión para procesar facturas.');
      return;
    }

    const userEmail = session.user.email;
    const userName = session.user.name || session.user.email;

    if (!files.length) {
      setFormError('Selecciona al menos un archivo PDF antes de enviar.');
      return;
    }

    for (const file of files) {
      const key = getFileKey(file);
      const estadoIngreso = incomeStatuses[key] || DEFAULT_INCOME_STATUS;
      const fechaEstimada = estimatedIncomeDates[key] || '';

      if (estadoIngreso === 'Cuenta por cobrar' && !fechaEstimada) {
        setFormError(
          `Debes indicar la fecha estimada de ingreso para: ${file.name}`
        );
        return;
      }
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
          const fileKey = getFileKey(file);

          const metodoPago =
            paymentMethods[fileKey] || DEFAULT_PAYMENT_METHOD;

          const estadoIngreso =
            incomeStatuses[fileKey] || DEFAULT_INCOME_STATUS;

          const fechaEstimadaIngreso =
            estimatedIncomeDates[fileKey] || '';

          const nivel =
            invoiceLevels[fileKey] || DEFAULT_INVOICE_LEVEL;

          const formData = new FormData();
          formData.append('archivo', file);
          formData.append('uploaded_by', userEmail);
          formData.append('uploaded_by_name', userName);
          formData.append('sucursal_usuario', 'central');
          formData.append('punto_venta_usuario', '1');
          formData.append('observacion', '');
          formData.append('metodo_pago', metodoPago);
          formData.append('estado_ingreso', estadoIngreso);
          formData.append('fecha_estimada_ingreso', fechaEstimadaIngreso);
          formData.append('nivel', nivel);

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
            metodo_pago: data.invoice?.metodo_pago || metodoPago,
            estado_ingreso: data.invoice?.estado_ingreso || estadoIngreso,
            fecha_estimada_ingreso:
              data.invoice?.fecha_estimada_ingreso || fechaEstimadaIngreso,
            fecha_ingreso_real: data.invoice?.fecha_ingreso_real,
            nivel: data.invoice?.nivel || nivel,
          };

          localResults.push(batchItem);
          setBatchResults([...localResults]);

          localHistoryEntries.push({
            id: generateId(),
            timestamp: new Date().toISOString(),
            filename: file.name,
            uploaded_by: userEmail,
            sucursal_usuario: 'central',
            metodo_pago: data.invoice?.metodo_pago || metodoPago,
            status: finalStatus,
            nro_factura: data.invoice?.nro_factura,
            items_count: data.invoice?.items_count,
            estado_ingreso: data.invoice?.estado_ingreso || estadoIngreso,
            fecha_estimada_ingreso:
              data.invoice?.fecha_estimada_ingreso || fechaEstimadaIngreso,
            fecha_ingreso_real: data.invoice?.fecha_ingreso_real,
            nivel: data.invoice?.nivel || nivel,
            message: data.message,
          });

          if (i === files.length - 1) {
            setResult(data);
            setStatus(finalStatus);
          }
        } catch (error) {
          console.error(`Error al procesar ${file.name}:`, error);

          const fileKey = getFileKey(file);

          const metodoPagoError =
            paymentMethods[fileKey] || DEFAULT_PAYMENT_METHOD;

          const estadoIngresoError =
            incomeStatuses[fileKey] || DEFAULT_INCOME_STATUS;

          const fechaEstimadaIngresoError =
            estimatedIncomeDates[fileKey] || '';

          const nivelError =
            invoiceLevels[fileKey] || DEFAULT_INVOICE_LEVEL;

          const batchItem: BatchItemResult = {
            id: generateId(),
            filename: file.name,
            status: 'error',
            message: 'No se pudo conectar con el servidor o la factura falló durante el proceso.',
            metodo_pago: metodoPagoError,
            estado_ingreso: estadoIngresoError,
            fecha_estimada_ingreso: fechaEstimadaIngresoError,
            nivel: nivelError,
          };

          localResults.push(batchItem);
          setBatchResults([...localResults]);

          localHistoryEntries.push({
            id: generateId(),
            timestamp: new Date().toISOString(),
            filename: file.name,
            uploaded_by: userEmail,
            sucursal_usuario: 'central',
            metodo_pago: metodoPagoError,
            estado_ingreso: estadoIngresoError,
            fecha_estimada_ingreso: fechaEstimadaIngresoError,
            nivel: nivelError,
            status: 'error',
            message: batchItem.message,
          });

          if (i === files.length - 1) {
            setResult({
              ok: false,
              status: 'error',
              message: batchItem.message,
              invoice: {
                metodo_pago: metodoPagoError,
                estado_ingreso: estadoIngresoError,
                fecha_estimada_ingreso: fechaEstimadaIngresoError,
                nivel: nivelError,
              },
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
  }, [
    files,
    status,
    session,
    paymentMethods,
    incomeStatuses,
    estimatedIncomeDates,
    invoiceLevels,
  ]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setStatus('idle');
    setResult(null);
    setFormError(null);
    setBatchResults([]);
    setCurrentFileName('');
    setCurrentIndex(0);
    setPaymentMethods({});
    setIncomeStatuses({});
    setEstimatedIncomeDates({});
    setInvoiceLevels({});
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
    <AppShell>
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

        <nav className="module-tabs">
          <Link href="/facturas" className="module-tab module-tab--active">
            Carga de facturas
          </Link>

          <Link href="/facturas/cuentas-por-cobrar" className="module-tab">
            Cuentas por cobrar
          </Link>
        </nav>

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
              paymentMethods={paymentMethods}
              incomeStatuses={incomeStatuses}
              estimatedIncomeDates={estimatedIncomeDates}
              invoiceLevels={invoiceLevels}
              onPaymentMethodChange={handlePaymentMethodChange}
              onIncomeStatusChange={handleIncomeStatusChange}
              onEstimatedIncomeDateChange={handleEstimatedIncomeDateChange}
              onInvoiceLevelChange={handleInvoiceLevelChange}
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
                    {item.metodo_pago && (
                      <div className="batch-result-item__meta">
                        Método de pago: {item.metodo_pago}
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
    </AppShell>
  );
}