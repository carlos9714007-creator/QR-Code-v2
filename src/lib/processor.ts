import * as pdfjs from 'pdfjs-dist';
import { BrowserQRCodeReader } from '@zxing/library';
import { createWorker } from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';
import { parsePortugueseQR } from './qrParser';
import type { FileResult, QRData, OCRData, ValidationStatus } from './types';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export class FileProcessor {
    private qrReader = new BrowserQRCodeReader();

    async processFile(file: File): Promise<FileResult> {
        const isPDF = file.type === 'application/pdf';
        const processedAt = new Date().toISOString();

        let qrData: QRData | undefined;
        let ocrData: OCRData | undefined;
        let status: ValidationStatus = 'DESCARTADO';
        let divergences: string[] = [];
        let canvas: HTMLCanvasElement | null = null;

        try {
            if (isPDF) {
                // Process PDF
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
                const page = await pdf.getPage(1); // Usually QR is on 1st page
                const viewport = page.getViewport({ scale: 2.0 });

                canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                if (context) {
                    await page.render({
                        canvasContext: context as any,
                        viewport,
                        // @ts-ignore
                        canvas: canvas as any
                    } as any).promise;
                    qrData = await this.scanQR(canvas);

                    if (qrData) {
                        ocrData = await this.runOCR(canvas);
                        const validation = this.validate(qrData, ocrData);
                        status = validation.status;
                        divergences = validation.divergences;
                    }
                }
            } else {
                // Process Image
                const img = await this.loadImage(file);
                canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    qrData = await this.scanQR(canvas);

                    if (qrData) {
                        ocrData = await this.runOCR(canvas);
                        const validation = this.validate(qrData, ocrData);
                        status = validation.status;
                        divergences = validation.divergences;
                    }
                }
            }

            let newName = file.name;
            if (status === 'VALIDATED') {
                const ext = file.name.split('.').pop();
                const base = file.name.substring(0, file.name.lastIndexOf('.'));
                newName = `${base}_OK.${ext}`;
            }

            return {
                id: Math.random().toString(36).substr(2, 9),
                fileName: file.name,
                originalName: file.name,
                processedAt,
                status,
                qrData,
                ocrData,
                divergences,
                newName: status === 'VALIDATED' ? newName : undefined
            };

        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            return {
                id: Math.random().toString(36).substr(2, 9),
                fileName: file.name,
                originalName: file.name,
                processedAt,
                status: 'DESCARTADO',
                divergences: ['Erro no processamento técnico do ficheiro']
            };
        }
    }

    private async scanQR(canvas: HTMLCanvasElement): Promise<QRData | undefined> {
        try {
            // @ts-ignore - BrowserQRCodeReader has the method but types might be outdated or different
            const result = await this.qrReader.decodeFromCanvas(canvas);
            if (result) {
                return parsePortugueseQR(result.getText()) || undefined;
            }
        } catch (e) {
            // No QR found
        }
        return undefined;
    }

    private async runOCR(canvas: HTMLCanvasElement): Promise<OCRData> {
        const worker = await createWorker('por');
        const { data: { text } } = await worker.recognize(canvas);
        await worker.terminate();

        // Very basic semantic extraction (to be improved)
        const nifRegex = /\b[125-9]\d{8}\b/g;
        const nifs = text.match(nifRegex) || [];

        // Total regex (looking for standard Portuguese formats like 123,45 or 123.45)
        // This is tricky and needs more robust logic usually
        const totalRegex = /\b\d+[,.]\d{2}\b/g;
        const totals = text.match(totalRegex) || [];

        return {
            nif_emitente: nifs.length > 0 ? nifs[0] : undefined,
            total_documento: totals.length > 0 ? parseFloat(totals[totals.length - 1].replace(',', '.')) : undefined,
            // Date and number extraction would go here
        };
    }

    private validate(qr: QRData, ocr: OCRData): { status: ValidationStatus; divergences: string[] } {
        const divergences: string[] = [];

        // Normalize and compare
        if (qr.A_nif_emitente !== ocr.nif_emitente) {
            divergences.push(`NIF Emitente: QR=${qr.A_nif_emitente}, OCR=${ocr.nif_emitente || 'Não detetado'}`);
        }

        // Comparison of total (allowing some fuzzy logic/normalization)
        if (ocr.total_documento !== undefined) {
            const qrTotal = Math.round(qr.O_total_com_impostos * 100) / 100;
            const ocrTotal = Math.round(ocr.total_documento * 100) / 100;

            if (Math.abs(qrTotal - ocrTotal) > 0.01) {
                divergences.push(`Total: QR=${qrTotal}, OCR=${ocrTotal}`);
            }
        } else {
            divergences.push('Total: Não detetado no documento via OCR');
        }

        return {
            status: divergences.length === 0 ? 'VALIDATED' : 'PARA AVERIGUAÇÃO',
            divergences
        };
    }

    private loadImage(file: File): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async injectMetadata(file: File, result: FileResult): Promise<Blob> {
        if (file.type !== 'application/pdf') return file;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);

            // We can add metadata as custom properties or use standard fields
            pdfDoc.setTitle(`VALIDATED: ${result.fileName}`);
            pdfDoc.setSubject(`Validation Date: ${result.processedAt}`);
            pdfDoc.setProducer('PWA QR Validator PT');

            const pdfBytes = await pdfDoc.save();
            return new Blob([pdfBytes as any], { type: 'application/pdf' });
        } catch (e) {
            console.error('Error injecting metadata:', e);
            return file;
        }
    }
}
