
import { PurchaseOrder, Invoice, DeliveryOrder } from '../types';

// ============================================================================
// PENTING: GANTI URL DI BAWAH INI DENGAN URL DEPLOYMENT BARU ANDA
// ============================================================================
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyF-gNWvVwHO60prZR44nBhGIP4I2p_OFdJxKIfq9U95CIixfVlwsRsVZjH7VY4R9SP/exec';

export const getScriptUrl = () => {
  return APPS_SCRIPT_URL;
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- CALENDAR SYNC ---
export const syncCalendarToCloud = async (po: PurchaseOrder): Promise<{ success: boolean; message: string }> => {
  const scriptUrl = getScriptUrl();
  const payload = JSON.stringify({
    action: 'sync_calendar',
    data: po
  });

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'text/plain' },
      redirect: 'follow',
    });

    if (response.ok) {
        const textResult = await response.text();
        try {
            const json = JSON.parse(textResult);
            if (json.result === 'success') {
                return { success: true, message: json.message || 'Jadwal Otomatis Terpasang!' };
            } else {
                const msg = json.message ? json.message.toLowerCase() : '';
                if (msg.includes('action unknown')) return { success: false, message: 'Apps Script belum di-update!' };
                return { success: false, message: json.message || 'Gagal sinkronisasi kalender.' };
            }
        } catch (e) {
            return { success: true, message: 'Perintah dikirim ke server.' };
        }
    }
    return { success: false, message: 'Server tidak merespon.' };
  } catch (error) {
    try {
        await fetch(scriptUrl, {
            method: 'POST',
            body: payload,
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            redirect: 'follow',
        });
        return { success: true, message: 'Request dikirim (Mode Kompatibilitas).' };
    } catch (e) {
        return { success: false, message: 'Gagal koneksi internet.' };
    }
  }
};

// --- PO FUNCTIONS ---

export const submitPOToGoogle = async (po: PurchaseOrder): Promise<{ success: boolean; message: string }> => {
  return sendToGoogle('create', po);
};

export const fetchPOsFromGoogle = async (): Promise<{ success: boolean; data?: PurchaseOrder[]; message?: string }> => {
  return fetchFromGoogle('po');
};

export const deletePOFromGoogle = async (id: string): Promise<{ success: boolean; message: string }> => {
  return sendDeleteToGoogle('delete', id);
};

// --- INVOICE FUNCTIONS ---

export const submitInvoiceToGoogle = async (invoice: Invoice): Promise<{ success: boolean; message: string }> => {
  return sendToGoogle('create_invoice', invoice);
};

export const fetchInvoicesFromGoogle = async (): Promise<{ success: boolean; data?: Invoice[]; message?: string }> => {
  return fetchFromGoogle('invoice');
};

export const deleteInvoiceFromGoogle = async (id: string): Promise<{ success: boolean; message: string }> => {
  return sendDeleteToGoogle('delete_invoice', id);
};

// --- DELIVERY ORDER (SURAT JALAN) FUNCTIONS ---

export const submitDeliveryOrderToGoogle = async (doData: DeliveryOrder): Promise<{ success: boolean; message: string }> => {
  return sendToGoogle('create_do', doData);
};

export const fetchDeliveryOrdersFromGoogle = async (): Promise<{ success: boolean; data?: DeliveryOrder[]; message?: string }> => {
  return fetchFromGoogle('do');
};

export const deleteDeliveryOrderFromGoogle = async (id: string): Promise<{ success: boolean; message: string }> => {
  return sendDeleteToGoogle('delete_do', id);
};

// --- GENERIC HELPERS ---

const sendToGoogle = async (action: string, data: any): Promise<{ success: boolean; message: string }> => {
  const scriptUrl = getScriptUrl();
  try {
    const payload = JSON.stringify({ action, data });
    
    // Fallback if file too large (Apps Script limit is ~10MB payload usually, safer at 9MB)
    if (payload.length > 9 * 1024 * 1024) {
        return { success: false, message: 'Gagal: Ukuran data terlalu besar.' };
    }

    try {
      const response = await fetch(scriptUrl, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'text/plain' },
        redirect: 'follow',
      });

      if (response.ok) {
        const textResult = await response.text();
        try {
            const json = JSON.parse(textResult);
            if (json.result === 'success') {
                return { success: true, message: 'Data tersimpan di Cloud.' };
            }
        } catch (e) {
            return { success: true, message: 'Data terkirim (Respon Server OK).' };
        }
      }
    } catch (primaryError) {
      throw primaryError; 
    }
    return { success: false, message: 'Gagal memproses respons server.' };
  } catch (error) {
    try {
      // Fallback no-cors
      const payloadFallback = JSON.stringify({ action, data });
      await fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: payloadFallback,
          headers: { 'Content-Type': 'text/plain' },
          redirect: 'follow',
      });
      return { success: true, message: 'Data terkirim (Mode Kompatibilitas).' };
    } catch (fallbackError) {
      return { success: false, message: 'Gagal koneksi internet. Data tersimpan di LOKAL saja.' };
    }
  }
};

const sendDeleteToGoogle = async (action: string, id: string): Promise<{ success: boolean; message: string }> => {
    const scriptUrl = getScriptUrl();
    const payload = JSON.stringify({ action, id });

    try {
        await fetch(scriptUrl, {
            method: 'POST',
            body: payload,
            headers: { 'Content-Type': 'text/plain' },
            mode: 'no-cors',
            redirect: 'follow',
        });
        return { success: true, message: 'Perintah hapus dikirim.' };
    } catch (error) {
        return { success: false, message: 'Gagal menghapus di server.' };
    }
};

const fetchFromGoogle = async (type: 'po' | 'invoice' | 'do'): Promise<{ success: boolean; data?: any[]; message?: string }> => {
  const scriptUrl = getScriptUrl();
  const maxRetries = 3;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add type parameter to distinguish between PO and Invoice and DO
      const url = `${scriptUrl}?action=read&type=${type}&_t=${Date.now()}`; 
      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      const textResult = await response.text();
      let result;
      try {
          result = JSON.parse(textResult);
      } catch (e) {
          if (textResult.includes("<!DOCTYPE html>")) {
             throw new Error("Server Script Error");
          }
          throw new Error("Invalid JSON format");
      }

      if (result.result === 'success' && Array.isArray(result.data)) {
          return { success: true, data: result.data };
      } else {
          return { success: false, message: result.message || 'Gagal mengambil data.' };
      }
    } catch (error) {
        console.error(`Sync Attempt ${attempt + 1} Failed:`, error);
        if (attempt === maxRetries - 1) {
             let msg = 'Gagal mengambil data dari Cloud.';
             if (error instanceof Error && error.message.includes("Failed to fetch")) {
                 msg = 'Koneksi gagal. Cek Internet.';
             }
             return { success: false, message: msg };
        }
        await wait(1500);
    }
  }
  return { success: false, message: 'Unknown error.' };
};
