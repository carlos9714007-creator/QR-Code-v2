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
