import { useState, useCallback, useMemo } from 'react';
import {
  FolderOpen,
  Download,
  Trash2,
} from 'lucide-react';
import { FileProcessor } from './lib/processor';
import type { FileResult, DashboardStats } from './lib/types';
import { exportToHTMLRelatorio } from './lib/exportUtils';

const processor = new FileProcessor();

function App() {
  const [results, setResults] = useState<FileResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [tolerance, setTolerance] = useState(5);

  const stats = useMemo<DashboardStats>(() => {
    return {
      total: results.length,
      validated: results.filter((r: FileResult) => r.status === 'VALIDATED').length,
      pending: results.filter((r: FileResult) => r.status === 'PARA AVERIGUAÇÃO').length,
      discarded: results.filter((r: FileResult) => r.status === 'DESCARTADO' || r.status === 'QR CODE NÃO VISIVEL').length,
    };
  }, [results]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setIsProcessing(true);
    setCurrentStep(1);
    const newResults: FileResult[] = [];
    const filesArray = Array.from(files);

    for (let i = 0; i < filesArray.length; i++) {
      const result = await processor.processFile(filesArray[i], tolerance);

      if (result.status === 'VALIDATED') {
        await processor.injectMetadata(filesArray[i], result);
      }

      newResults.push(result);
      setProgress(Math.round(((i + 1) / filesArray.length) * 100));
    }

    setResults(newResults);
    setIsProcessing(false);
    setProgress(0);
  }, [tolerance]);

  const handleDirectorySelect = async () => {
    try {
      // @ts-ignore
      if (window.showDirectoryPicker) {
        // @ts-ignore
        const directoryHandle = await window.showDirectoryPicker();
        const files: File[] = [];

        async function scan(handle: any) {
          for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
              const file = await entry.getFile();
              if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
                files.push(file);
              }
            } else if (entry.kind === 'directory') {
              await scan(entry);
            }
          }
        }

        await scan(directoryHandle);
        if (files.length > 0) handleFiles(files);
      } else {
        alert('O seu browser não suporta seleção de pastas.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const clearResults = () => {
    if (confirm('Deseja limpar todos os resultados?')) {
      setResults([]);
      setCurrentStep(1);
    }
  };

  return (
    <div className="animate-fade-in">
      <header>
        <h1>Validador de QR Code <span style={{ fontSize: '0.4em', opacity: 0.7 }}>v2.1</span></h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Workflow de 3 Fases • Tolerância Configurável • PWA Local
        </p>
      </header>

      {/* Stats Summary */}
      <div className="grid-dashboard">
        <div className="glass-panel stat-card">
          <div className="stat-label">Total Analisados</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-label">Validados</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.validated}</div>
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="stat-label">Averiguação</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.pending}</div>
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--error)' }}>
          <div className="stat-label">Sem QR / Erros</div>
          <div className="stat-value" style={{ color: 'var(--error)' }}>{stats.discarded}</div>
        </div>
      </div>

      {/* Step Selector & Global Controls */}
      <div className="glass-panel card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={`btn ${currentStep === 1 ? '' : 'btn-secondary'}`} onClick={() => setCurrentStep(1)}>1. Semântica</button>
            <button className={`btn ${currentStep === 2 ? '' : 'btn-secondary'}`} onClick={() => setCurrentStep(2)} disabled={results.length === 0}>2. Comparativo</button>
            <button className={`btn ${currentStep === 3 ? '' : 'btn-secondary'}`} onClick={() => setCurrentStep(3)} disabled={results.length === 0}>3. Conclusão</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.9rem' }}>Margem de Erro: <strong>{tolerance}%</strong></span>
            <input
              type="range" min="0" max="20" step="1"
              value={tolerance}
              onChange={(e) => setTolerance(parseInt(e.target.value))}
              style={{ width: '100px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={handleDirectorySelect} disabled={isProcessing}>
              <FolderOpen size={18} /> Pasta
            </button>
            <button className="btn btn-secondary" onClick={clearResults}>
              <Trash2 size={18} /> Limpar
            </button>
          </div>
        </div>

        {isProcessing && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
              <span>A processar ficheiros...</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: '4px', background: 'var(--surface)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, transition: 'width 0.3s ease', background: 'var(--primary)' }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Step Content */}
      {results.length > 0 && (
        <div className="glass-panel file-list animate-fade-in" style={{ padding: '1rem' }}>
          {currentStep === 1 && (
            <>
              <h3>Fase 1: Leitura Semântica (OCR)</h3>
              <table>
                <thead>
                  <tr>
                    <th>Ficheiro</th>
                    <th>Estado OCR</th>
                    <th>NIF Detetado</th>
                    <th>Total Detetado</th>
                    <th>Amostra Texto</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice().reverse().map((r: FileResult) => (
                    <tr key={r.id}>
                      <td>{r.originalName}</td>
                      <td><span className={`badge ${r.ocrStatus === 'SUCCESS' ? 'badge-success' : 'badge-error'}`}>{r.ocrStatus}</span></td>
                      <td>{r.ocrData?.nif_emitente || '---'}</td>
                      <td>{r.ocrData?.total_documento ? `${r.ocrData.total_documento}€` : '---'}</td>
                      <td style={{ fontSize: '0.7rem', opacity: 0.6 }}>{r.ocrData?.extractedText?.substring(0, 50)}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {currentStep === 2 && (
            <>
              <h3>Fase 2: Comparativo QR vs OCR</h3>
              <table>
                <thead>
                  <tr>
                    <th>Ficheiro</th>
                    <th>Estado</th>
                    <th>QR Total</th>
                    <th>OCR Total</th>
                    <th>Diferença/Margem</th>
                    <th>Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice().reverse().map((r: FileResult) => (
                    <tr key={r.id}>
                      <td>{r.originalName}</td>
                      <td>
                        <span className={`badge ${r.status === 'VALIDATED' ? 'badge-success' :
                          r.status === 'QR CODE NÃO VISIVEL' ? 'badge-error' : 'badge-warning'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>{r.qrData?.O_total_com_impostos ? `${r.qrData.O_total_com_impostos}€` : '---'}</td>
                      <td>{r.ocrData?.total_documento ? `${r.ocrData.total_documento}€` : '---'}</td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {r.qrData && r.ocrData ? (
                          <span style={{ color: r.isWithinTolerance ? 'var(--success)' : 'var(--warning)' }}>
                            {Math.abs(r.qrData.O_total_com_impostos - (r.ocrData.total_documento || 0)).toFixed(2)}€ / {r.errorMargin}%
                          </span>
                        ) : '---'}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {r.divergences?.join(' | ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {currentStep === 3 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Fase 3: Conclusão da Análise</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn" onClick={() => exportToHTMLRelatorio(results)}>
                    <Download size={18} /> Relatório Completo
                  </button>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Ficheiro Original</th>
                    <th>Dados Verificados (QR/OCR)</th>
                    <th>Resultado</th>
                    <th>Novo Nome Final</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice().reverse().map((r: FileResult) => (
                    <tr key={r.id}>
                      <td>{r.originalName}</td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {r.qrData ? `QR: ${r.qrData.O_total_com_impostos}€ | NIF: ${r.qrData.A_nif_emitente}` : '---'}
                      </td>
                      <td>
                        <span style={{ color: r.status === 'VALIDATED' ? 'var(--success)' : (r.status === 'PARA AVERIGUAÇÃO' ? 'var(--warning)' : 'var(--error)') }}>
                          {r.status === 'VALIDATED' ? '✓ VALIDADO' : r.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: r.status === 'VALIDATED' ? 600 : 400 }}>{r.newName || '---'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      <footer style={{ marginTop: '4rem', padding: '2rem', opacity: 0.5, fontSize: '0.8rem' }}>
        &copy; 2024 PWA QR Code PT • Validador de Facturas Avançado
      </footer>
    </div>
  );
}

export default App;
