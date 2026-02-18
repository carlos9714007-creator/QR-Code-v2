import * as pdfjs from 'pdfjs-dist';
import { BrowserQRCodeReader } from '@zxing/library';
import { createWorker } from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';
import { parsePortugueseQR } from './qrParser';
import type { FileResult, QRData, OCRData, ValidationStatus } from './types';

// Set up PDF.js worker using a more robust CDN link or local reference
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export class FileProcessor {
    private qrReader = new BrowserQRCodeReader();

    async processFile(file: File, tolerance: number = 5): Promise<FileResult> {
        const isPDF = file.type === 'application/pdf';
        const processedAt = new Date().toISOString();

        const result: FileResult = {
            id: Math.random().toString(36).substr(2, 9),
            fileName: file.name,
            originalName: file.name,
            processedAt,
            status: 'DESCARTADO',
            ocrStatus: 'NOT_STARTED',
            qrStatus: 'NOT_STARTED',
            errorMargin: tolerance
        };

        try {
            const canvases: HTMLCanvasElement[] = [];

            if (isPDF) {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
                const numPages = pdf.numPages;
                const pagesToCheck = numPages > 1 ? [1, numPages] : [1];

                for (const pageNum of pagesToCheck) {
                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 2.5 });
                    const cvs = document.createElement('canvas');
                    const ctx = cvs.getContext('2d');
                    cvs.height = viewport.height;
                    cvs.width = viewport.width;
                    if (ctx) {
                        await page.render({
                            canvasContext: ctx as any,
                            viewport,
                            // @ts-ignore
                            canvas: cvs as any
                        } as any).promise;
                        canvases.push(cvs);
                    }
                }
            } else {
                const img = await this.loadImage(file);
                const cvs = document.createElement('canvas');
                cvs.width = img.width;
                cvs.height = img.height;
                const ctx = cvs.getContext('2d');
                if (ctx) ctx.drawImage(img, 0, 0);
                canvases.push(cvs);
            }

            if (canvases.length > 0) {
                // Phase 1: Semantic (OCR)
                result.ocrData = await this.runOCR(canvases[0]);
                result.ocrStatus = 'SUCCESS';

                // Phase 2: QR
                for (const cvs of canvases) {
                    result.qrData = await this.scanQR(cvs);
                    if (result.qrData) {
                        result.qrStatus = 'SUCCESS';
                        break;
                    }
                }

                if (!result.qrData) {
                    result.qrStatus = 'NOT_FOUND';
                    result.status = 'QR CODE NÃO VISIVEL';
                } else if (result.ocrData) {
                    const val = this.validate(result.qrData, result.ocrData, tolerance);
                    result.status = val.status;
                    result.divergences = val.divergences;
                    result.isWithinTolerance = val.isWithinTolerance;
                }
            }

            if (result.status === 'VALIDATED') {
                const ext = file.name.split('.').pop();
                const base = file.name.substring(0, file.name.lastIndexOf('.'));
                result.newName = `${base}_OK.${ext}`;
            }

            return result;

        } catch (error: any) {
            console.error(`Error processing ${file.name}:`, error);
            result.status = 'DESCARTADO';
            result.ocrStatus = 'FAILED';
            result.qrStatus = 'FAILED';
            result.divergences = [`Erro técnico: ${error.message || 'Erro desconhecido'}`];
            return result;
        }
    }

    private async scanQR(canvas: HTMLCanvasElement): Promise<QRData | undefined> {
        try {
            // @ts-ignore
            const result = await this.qrReader.decodeFromCanvas(canvas);
            if (result) {
                return parsePortugueseQR(result.getText()) || undefined;
            }
        } catch (e) {
            // No QR found on this attempt
        }
        return undefined;
    }

    private async runOCR(canvas: HTMLCanvasElement): Promise<OCRData> {
        const worker = await createWorker('por');
        const { data: { text } } = await worker.recognize(canvas);
        await worker.terminate();

        const cleanText = text.replace(/\s+/g, ' ');
        const nifRegex = /\b[125-9]\d{8}\b/g;
        const nifs = cleanText.match(nifRegex) || [];

        const totalRegex = /\b\d{1,7}(?:[.,]\d{2})\b/g;
        const totals = cleanText.match(totalRegex) || [];

        return {
            nif_emitente: nifs.length > 0 ? nifs[0] : undefined,
            total_documento: totals.length > 0 ? parseFloat(totals[totals.length - 1].replace(',', '.')) : undefined,
            extractedText: cleanText.substring(0, 800)
        };
    }

    private validate(qr: QRData, ocr: OCRData, tolerance: number): { status: ValidationStatus; divergences: string[]; isWithinTolerance: boolean } {
        const divergences: string[] = [];
        let isWithinTolerance = true;

        if (qr.A_nif_emitente !== ocr.nif_emitente) {
            divergences.push(`NIF: QR=${qr.A_nif_emitente}, OCR=${ocr.nif_emitente || 'N/D'}`);
            isWithinTolerance = false;
        }

        if (ocr.total_documento !== undefined) {
            const qrTotal = Math.round(qr.O_total_com_impostos * 100) / 100;
            const ocrTotal = Math.round(ocr.total_documento * 100) / 100;
            const diff = Math.abs(qrTotal - ocrTotal);
            const margin = (qrTotal * tolerance) / 100;

            if (diff > margin) {
                divergences.push(`Total: QR=${qrTotal}, OCR=${ocrTotal} (Dif: ${diff.toFixed(2)}€ > Margem ${tolerance}%: ${margin.toFixed(2)}€)`);
                isWithinTolerance = false;
            }
        } else {
            divergences.push('Total: Não detetado no OCR');
            isWithinTolerance = false;
        }

        return {
            status: isWithinTolerance ? 'VALIDATED' : 'PARA AVERIGUAÇÃO',
            divergences,
            isWithinTolerance
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
