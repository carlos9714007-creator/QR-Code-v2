import { useState, useCallback, useMemo } from 'react';
import {
  FileSearch,
  Upload,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  FileX,
  Download,
  Trash2,
  ClipboardList
} from 'lucide-react';
import { FileProcessor } from './lib/processor';
import type { FileResult, DashboardStats } from './lib/types';
import { exportToJSON, exportToCSV } from './lib/exportUtils';

const processor = new FileProcessor();

function App() {
  const [results, setResults] = useState<FileResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const stats = useMemo<DashboardStats>(() => {
    return {
      total: results.length,
      validated: results.filter(r => r.status === 'VALIDATED').length,
      pending: results.filter(r => r.status === 'PARA AVERIGUAÇÃO').length,
      discarded: results.filter(r => r.status === 'DESCARTADO').length,
    };
  }, [results]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setIsProcessing(true);
    const newResults: FileResult[] = [];
    const filesArray = Array.from(files);

    for (let i = 0; i < filesArray.length; i++) {
      const result = await processor.processFile(filesArray[i]);

      // If validated, inject metadata and prepare for download
      if (result.status === 'VALIDATED') {
        await processor.injectMetadata(filesArray[i], result);
        console.log(`Metadata injected for ${result.fileName}`);
      }

      newResults.push(result);
      setProgress(Math.round(((i + 1) / filesArray.length) * 100));
    }

    setResults(prev => [...prev, ...newResults]);
    setIsProcessing(false);
    setProgress(0);
  }, []);

  const handleDirectorySelect = async () => {
    try {
      // @ts-ignore - Support for showDirectoryPicker (Chrome/Edge)
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
        alert('O seu browser não suporta seleção de pastas diretamente. Por favor use a seleção de ficheiros.');
      }
    } catch (err) {
      console.error('Directory access denied or failed', err);
    }
  };

  const clearResults = () => {
    if (confirm('Deseja limpar todos os resultados?')) {
      setResults([]);
    }
  };

  return (
    <div className="animate-fade-in">
      <header>
        <h1>Validador de QR Code <span style={{ fontSize: '0.4em', verticalAlign: 'middle', opacity: 0.7 }}>v2</span></h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '3rem' }}>
          Faturas de Portugal • Validação QR vs OCR • PWA Local
        </p>
      </header>

      <div className="grid-dashboard">
        <div className="glass-panel stat-card">
          <div className="stat-label">Total Analisados</div>
          <div className="stat-value">{stats.total}</div>
          <FileSearch size={24} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', opacity: 0.2 }} />
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-label">Validados</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.validated}</div>
          <CheckCircle2 size={24} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', opacity: 0.2 }} />
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="stat-label">Averiguação Manual</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.pending}</div>
          <AlertCircle size={24} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', opacity: 0.2 }} />
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--error)' }}>
          <div className="stat-label">Sem QR / Descartados</div>
          <div className="stat-value" style={{ color: 'var(--error)' }}>{stats.discarded}</div>
          <FileX size={24} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', opacity: 0.2 }} />
        </div>
      </div>

      <div className="glass-panel card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="btn" onClick={handleDirectorySelect} disabled={isProcessing}>
            <FolderOpen size={20} />
            Selecionar Pasta
          </button>

          <label className={`btn btn-secondary ${isProcessing ? 'disabled' : ''}`} style={{ cursor: 'pointer' }}>
            <Upload size={20} />
            Selecionar Ficheiros
            <input
              type="file"
              multiple
              accept=".pdf,image/*"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              disabled={isProcessing}
            />
          </label>

          {results.length > 0 && (
            <>
              <button className="btn btn-secondary" onClick={() => exportToCSV(results)}>
                <Download size={20} />
                Exportar CSV
              </button>
              <button className="btn btn-secondary" onClick={() => exportToJSON(results)}>
                <ClipboardList size={20} />
                Exportar JSON
              </button>
              <button className="btn btn-secondary" onClick={clearResults} style={{ borderColor: 'rgba(248, 113, 113, 0.3)' }}>
                <Trash2 size={20} color="var(--error)" />
              </button>
            </>
          )}
        </div>

        {isProcessing && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              <span>Processando documentos...</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: '8px', background: 'var(--surface)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, transition: 'width 0.3s ease', background: 'linear-gradient(to right, var(--primary), var(--secondary))' }}></div>
            </div>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="glass-panel file-list animate-fade-in" style={{ padding: '0 1rem' }}>
          <table>
            <thead>
              <tr>
                <th>Ficheiro</th>
                <th>Estado</th>
                <th>QR Detetado</th>
                <th>Divergências</th>
                <th>Novo Nome</th>
              </tr>
            </thead>
            <tbody>
              {results.slice().reverse().map((result) => (
                <tr key={result.id}>
                  <td style={{ fontWeight: 500 }}>{result.originalName}</td>
                  <td>
                    <span className={`badge ${result.status === 'VALIDATED' ? 'badge-success' :
                      result.status === 'PARA AVERIGUAÇÃO' ? 'badge-warning' : 'badge-error'
                      }`}>
                      {result.status}
                    </span>
                  </td>
                  <td>{result.qrData ? result.qrData.G_numero_fatura : 'Não'}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {result.divergences?.map((d: string, i: number) => <div key={i}>{d}</div>)}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {result.newName || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer style={{ marginTop: '4rem', padding: '2rem', opacity: 0.5, fontSize: '0.875rem' }}>
        &copy; 2024 PWA QR Code PT • Desenvolvido com foco em conformidade e privacidade local.
      </footer>
    </div>
  );
}

export default App;
