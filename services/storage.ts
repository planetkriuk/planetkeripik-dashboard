
import { PurchaseOrder, POType, POStatus, POItem, Invoice, InvoiceStatus, DeliveryOrder, DeliveryStatus, AppSettings, ShippingLabel } from '../types';

const STORAGE_KEY = 'planet_keripik_pos';
const INVOICE_STORAGE_KEY = 'planet_keripik_invoices';
const DO_STORAGE_KEY = 'planet_keripik_dos';
const LABEL_STORAGE_KEY = 'planet_keripik_labels';
const SETTINGS_KEY = 'planet_keripik_settings';

// CLEAN STATE: Tidak ada data dummy awal. Data akan diambil dari LocalStorage atau Google Sheets.
const INITIAL_DATA: PurchaseOrder[] = [];
const INITIAL_INVOICES: Invoice[] = [];
const INITIAL_DOS: DeliveryOrder[] = [];
const INITIAL_LABELS: ShippingLabel[] = [];

const INITIAL_SETTINGS: AppSettings = {
  defaultAdminName: 'Admin Staff',
  defaultManagerName: 'Pak Misdi',
  defaultBankName: 'BCA',
  defaultAccountNumber: '1234567890',
  defaultAccountName: 'Planet Keripik',
  companyAddress: 'Jl. Tempean Utara Gang 1, RT.4/RW.6 Madyorenggo, Talok, Kec. Turen, Kabupaten Malang',
  companyPhone: '082338247777'
};

// --- SETTINGS FUNCTIONS ---
export const getAppSettings = (): AppSettings => {
  const data = localStorage.getItem(SETTINGS_KEY);
  if (!data) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(INITIAL_SETTINGS));
    return INITIAL_SETTINGS;
  }
  return JSON.parse(data);
};

export const saveAppSettings = (settings: AppSettings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// --- DATA MANAGEMENT (BACKUP/RESTORE) ---
export const getAllDataJSON = () => {
  return JSON.stringify({
    pos: getPOs(),
    invoices: getInvoices(),
    deliveryOrders: getDeliveryOrders(),
    shippingLabels: getShippingLabels(),
    settings: getAppSettings(),
    timestamp: new Date().toISOString()
  });
};

export const restoreDataJSON = (jsonString: string): boolean => {
  try {
    const data = JSON.parse(jsonString);
    if (data.pos) localStorage.setItem(STORAGE_KEY, JSON.stringify(data.pos));
    if (data.invoices) localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(data.invoices));
    if (data.deliveryOrders) localStorage.setItem(DO_STORAGE_KEY, JSON.stringify(data.deliveryOrders));
    if (data.shippingLabels) localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(data.shippingLabels));
    if (data.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
    return true;
  } catch (e) {
    console.error("Restore Failed", e);
    return false;
  }
};

export const clearAllData = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(INVOICE_STORAGE_KEY);
  localStorage.removeItem(DO_STORAGE_KEY);
  localStorage.removeItem(LABEL_STORAGE_KEY);
  // Keep settings usually, but for hard reset we remove it too
  localStorage.removeItem(SETTINGS_KEY); 
};

// --- EXISTING FUNCTIONS ---

export const getPOs = (): PurchaseOrder[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATA));
    return INITIAL_DATA;
  }
  return JSON.parse(data);
};

export const saveAllPOs = (pos: PurchaseOrder[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
};

export const getPOById = (id: string): PurchaseOrder | undefined => {
  const pos = getPOs();
  return pos.find(p => p.id === id);
};

export const savePO = (po: PurchaseOrder): void => {
  const pos = getPOs();
  const existingIndex = pos.findIndex(p => p.id === po.id);
  
  if (existingIndex >= 0) {
    pos[existingIndex] = po;
  } else {
    pos.push(po);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
};

export const deletePO = (id: string): void => {
  const pos = getPOs();
  const newPos = pos.filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newPos));
};

export const generatePONumber = (type: POType): string => {
  const pos = getPOs();
  const prefix = type === POType.INCOMING ? 'IN' : 'OUT';
  const year = new Date().getFullYear();
  
  let count = pos.filter(p => p.type === type).length + 1;
  let newPO = '';
  let isUnique = false;

  while (!isUnique) {
    newPO = `PO-${prefix}-${year}-${count.toString().padStart(3, '0')}`;
    const exists = pos.some(p => p.poNumber === newPO);
    if (exists) {
      count++;
    } else {
      isUnique = true;
    }
  }
  
  return newPO;
};

export const getInventorySummary = () => {
  const pos = getPOs();
  const summary: Record<string, { name: string, specification: string, totalIn: number, totalOut: number, remaining: number }> = {};

  pos.forEach(po => {
    if (po.status === POStatus.CANCELLED) return;

    po.items.forEach(item => {
      const key = `${item.name.toLowerCase().trim()}-${item.specification.toLowerCase().trim()}`;
      
      if (!summary[key]) {
        summary[key] = {
          name: item.name,
          specification: item.specification,
          totalIn: 0,
          totalOut: 0,
          remaining: 0
        };
      }

      if (po.type === POType.INCOMING) {
        summary[key].totalIn += item.quantity;
      } else if (po.type === POType.OUTGOING) {
        summary[key].totalOut += item.quantity;
      }
    });
  });

  return Object.values(summary).map(item => ({
    ...item,
    remaining: item.totalIn - item.totalOut
  }));
};

// --- INVOICE FUNCTIONS ---

export const getInvoices = (): Invoice[] => {
  const data = localStorage.getItem(INVOICE_STORAGE_KEY);
  if (!data) {
    localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(INITIAL_INVOICES));
    return INITIAL_INVOICES;
  }
  return JSON.parse(data);
};

export const saveAllInvoices = (invoices: Invoice[]): void => {
  localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(invoices));
};

export const getInvoiceById = (id: string): Invoice | undefined => {
  const invoices = getInvoices();
  return invoices.find(inv => inv.id === id);
};

export const saveInvoice = (invoice: Invoice): void => {
  const invoices = getInvoices();
  const existingIndex = invoices.findIndex(i => i.id === invoice.id);
  
  if (existingIndex >= 0) {
    invoices[existingIndex] = invoice;
  } else {
    invoices.push(invoice);
  }
  
  localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(invoices));
};

export const deleteInvoice = (id: string): void => {
  const invoices = getInvoices();
  const newInvoices = invoices.filter(i => i.id !== id);
  localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(newInvoices));
};

export const generateInvoiceNumber = (): string => {
  const invoices = getInvoices();
  const year = new Date().getFullYear();
  let count = invoices.length + 1;
  let newInv = '';
  let isUnique = false;

  while (!isUnique) {
    newInv = `INV/${year}/${count.toString().padStart(3, '0')}`;
    const exists = invoices.some(i => i.invoiceNumber === newInv);
    if (exists) {
      count++;
    } else {
      isUnique = true;
    }
  }
  return newInv;
};

// --- DELIVERY ORDER (SURAT JALAN) FUNCTIONS ---

export const getDeliveryOrders = (): DeliveryOrder[] => {
  const data = localStorage.getItem(DO_STORAGE_KEY);
  if (!data) {
    localStorage.setItem(DO_STORAGE_KEY, JSON.stringify(INITIAL_DOS));
    return INITIAL_DOS;
  }
  return JSON.parse(data);
};

export const saveAllDeliveryOrders = (dos: DeliveryOrder[]): void => {
  localStorage.setItem(DO_STORAGE_KEY, JSON.stringify(dos));
};

export const getDeliveryOrderById = (id: string): DeliveryOrder | undefined => {
  const dos = getDeliveryOrders();
  return dos.find(d => d.id === id);
};

export const saveDeliveryOrder = (doData: DeliveryOrder): void => {
  const dos = getDeliveryOrders();
  const existingIndex = dos.findIndex(d => d.id === doData.id);
  
  if (existingIndex >= 0) {
    dos[existingIndex] = doData;
  } else {
    dos.push(doData);
  }
  
  localStorage.setItem(DO_STORAGE_KEY, JSON.stringify(dos));
};

export const deleteDeliveryOrder = (id: string): void => {
  const dos = getDeliveryOrders();
  const newDos = dos.filter(d => d.id !== id);
  localStorage.setItem(DO_STORAGE_KEY, JSON.stringify(newDos));
};

export const generateDONumber = (): string => {
  const dos = getDeliveryOrders();
  const year = new Date().getFullYear();
  let count = dos.length + 1;
  let newDO = '';
  let isUnique = false;

  while (!isUnique) {
    newDO = `SJ/${year}/${count.toString().padStart(3, '0')}`;
    const exists = dos.some(d => d.doNumber === newDO);
    if (exists) {
      count++;
    } else {
      isUnique = true;
    }
  }
  return newDO;
};

// --- SHIPPING LABEL (STIKER) FUNCTIONS ---

export const getShippingLabels = (): ShippingLabel[] => {
  const data = localStorage.getItem(LABEL_STORAGE_KEY);
  if (!data) {
    localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(INITIAL_LABELS));
    return INITIAL_LABELS;
  }
  return JSON.parse(data);
};

export const saveShippingLabel = (label: ShippingLabel): void => {
  const labels = getShippingLabels();
  const existingIndex = labels.findIndex(l => l.id === label.id);
  
  if (existingIndex >= 0) {
    labels[existingIndex] = label;
  } else {
    labels.push(label);
  }
  localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(labels));
};

export const deleteShippingLabel = (id: string): void => {
  const labels = getShippingLabels();
  const newLabels = labels.filter(l => l.id !== id);
  localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(newLabels));
};
