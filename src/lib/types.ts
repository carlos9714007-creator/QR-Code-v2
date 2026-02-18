export type ValidationStatus = 'VALIDATED' | 'PARA AVERIGUAÇÃO' | 'DESCARTADO';

export interface QRData {
    A_nif_emitente: string;
    B_nif_adquirente?: string;
    C_pais_adquirente?: string;
    D_tipo_documento: string;
    E_estado_documento: string;
    F_data: string;
    G_numero_fatura: string;
    H_atcud?: string;
    O_total_com_impostos: number;
    [key: string]: any;
}

export interface OCRData {
    nif_emitente?: string;
    data?: string;
    numero_fatura?: string;
    total_documento?: number;
    total_iva?: number;
    extractedText?: string;
}

export interface FileResult {
    id: string;
    fileName: string;
    originalName: string;
    status: ValidationStatus | 'QR CODE NÃO VISIVEL';
    ocrStatus: 'SUCCESS' | 'FAILED' | 'NOT_STARTED';
    qrStatus: 'SUCCESS' | 'FAILED' | 'NOT_FOUND' | 'NOT_STARTED';
    qrData?: QRData;
    ocrData?: OCRData;
    divergences?: string[];
    processedAt: string;
    newName?: string;
    toleranceUsed?: number;
    errorMargin?: number; // Configurable margin used for this result
    isWithinTolerance?: boolean;
}

export interface DashboardStats {
    total: number;
    validated: number;
    pending: number;
    discarded: number;
}
