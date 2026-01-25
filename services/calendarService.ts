
import { PurchaseOrder } from '../types';

/**
 * DEPRECATED:
 * Fungsi ini sudah digantikan oleh Cloud Automation via Google Apps Script.
 * Lihat: googleSheetService.ts -> syncCalendarToCloud
 * 
 * Kami membiarkan file ini kosong atau minimal agar tidak memecah dependensi lama.
 */

export const downloadICSFile = (po: PurchaseOrder) => {
  console.warn("Function Deprecated. Use Cloud Sync.");
};

export const generateCalendarUrl = (po: PurchaseOrder) => '';
export const addEventToGoogleCalendar = async (po: PurchaseOrder) => ({ success: false });
