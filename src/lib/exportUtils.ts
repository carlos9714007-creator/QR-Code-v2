import type { FileResult } from './types';

export function exportToJSON(results: FileResult[]) {
    const data = JSON.stringify(results, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_validacao_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function exportToCSV(results: FileResult[]) {
    const headers = ['Ficheiro Original', 'Novo Nome', 'Estado', 'NIF Emitente', 'Total QR', 'Total OCR', 'Divergências', 'Data Processamento'];
    const rows = results.map(r => [
        r.originalName,
        r.newName || '',
        r.status,
        r.qrData?.A_nif_emitente || '',
        r.qrData?.O_total_com_impostos || '',
        r.ocrData?.total_documento || '',
        (r.divergences || []).join('; '),
        r.processedAt
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_validacao_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export function exportToHTMLRelatorio(results: FileResult[]) {
    const date = new Date().toLocaleString();
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Relatório Detalhado de Validação</title>
        <style>
            body { font-family: sans-serif; padding: 20px; color: #333; line-height: 1.5; }
            h1 { color: #2563eb; }
            .summary { display: flex; gap: 20px; margin-bottom: 30px; }
            .stat { padding: 15px; border-radius: 8px; background: #f3f4f6; flex: 1; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f9fafb; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; }
            td { padding: 12px; border-bottom: 1px solid #eee; font-size: 0.9em; }
            .validated { color: #059669; font-weight: bold; background: #ecfdf5; }
            .manual { color: #d97706; background: #fffbeb; }
            .not-found { color: #dc2626; background: #fef2f2; }
            footer { margin-top: 50px; font-size: 0.8em; opacity: 0.6; }
            .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; }
        </style>
    </head>
    <body>
        <h1>Relatório de Análise - QR Code PT</h1>
        <p>Gerado em: ${date}</p>
        
        <div class="summary">
            <div class="stat">Total: ${results.length}</div>
            <div class="stat">Validados: ${results.filter(r => r.status === 'VALIDATED').length}</div>
            <div class="stat">Manuais/Erros: ${results.filter(r => r.status !== 'VALIDATED').length}</div>
        </div>

        <h2>Detallhe da Auditoria</h2>
        <table>
            <thead>
                <tr>
                    <th>Ficheiro</th>
                    <th>NIF (QR/OCR)</th>
                    <th>Total QR</th>
                    <th>Total OCR</th>
                    <th>Estado</th>
                    <th>Diferença</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(r => `
                    <tr class="${r.status === 'VALIDATED' ? 'validated' : (r.status === 'PARA AVERIGUAÇÃO' ? 'manual' : 'not-found')}">
                        <td>${r.originalName}</td>
                        <td>${r.qrData?.A_nif_emitente || '---'} / ${r.ocrData?.nif_emitente || '---'}</td>
                        <td>${r.qrData?.O_total_com_impostos || '---'}€</td>
                        <td>${r.ocrData?.total_documento || '---'}€</td>
                        <td>${r.status}</td>
                        <td>${r.qrData && r.ocrData ? Math.abs(r.qrData.O_total_com_impostos - (r.ocrData.total_documento || 0)).toFixed(2) + '€' : '---'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <footer>Relatório gerado localmente pelo sistema QR Code v2.1.</footer>
    </body>
    </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_analise_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
}
