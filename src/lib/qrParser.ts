import type { QRData } from './types';

export function parsePortugueseQR(qrString: string): QRData | null {
    try {
        const parts = qrString.split('*');
        const data: any = {};

        parts.forEach(part => {
            const separatorIndex = part.indexOf(':');
            if (separatorIndex === -1) return;

            const key = part.substring(0, separatorIndex);
            const value = part.substring(separatorIndex + 1);

            switch (key) {
                case 'A': data.A_nif_emitente = value; break;
                case 'B': data.B_nif_adquirente = value; break;
                case 'C': data.C_pais_adquirente = value; break;
                case 'D': data.D_tipo_documento = value; break;
                case 'E': data.E_estado_documento = value; break;
                case 'F': data.F_data = value; break;
                case 'G': data.G_numero_fatura = value; break;
                case 'H': data.H_atcud = value; break;
                case 'O': data.O_total_com_impostos = parseFloat(value); break;
                default:
                    data[key] = value;
            }
        });

        // Basic required fields check
        if (!data.A_nif_emitente || !data.F_data || !data.G_numero_fatura) {
            return null;
        }

        return data as QRData;
    } catch (error) {
        console.error('Error parsing QR string:', error);
        return null;
    }
}
