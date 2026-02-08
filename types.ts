
export enum POStatus {
  DRAFT = 'Draft',
  PENDING = 'Pending',
  APPROVED = 'Disetujui',
  COMPLETED = 'Selesai',
  CANCELLED = 'Dibatalkan'
}

export enum POType {
  INCOMING = 'Masuk',
  OUTGOING = 'Keluar'
}

export enum InvoiceStatus {
  UNPAID = 'Belum Lunas',
  PARTIAL = 'Sebagian',
  PAID = 'Lunas',
  OVERDUE = 'Jatuh Tempo',
  DRAFT = 'Draft'
}

export enum DeliveryStatus {
  PREPARING = 'Diproses',
  SHIPPED = 'Dikirim',
  DELIVERED = 'Diterima',
  RETURNED = 'Retur'
}

export interface AppSettings {
  defaultAdminName: string;
  defaultManagerName: string; // Yang menyetujui
  defaultBankName: string;
  defaultAccountNumber: string;
  defaultAccountName: string;
  companyAddress: string;
  companyPhone: string;
}

export interface POItem {
  id: string;
  name: string;
  specification: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// Item Surat Jalan (Tanpa Harga)
export interface DOItem {
  id: string;
  name: string;
  specification: string;
  quantity: number;
  notes?: string; // Kondisi barang dll
}

export interface PurchaseOrder {
  id: string;
  poNumber: string; // e.g., PO-IN-2023-001
  type: POType;
  relatedPOId?: string; // For Outgoing POs linking to Incoming
  
  // Parties
  customerName: string;
  address: string;
  contactName?: string; 
  contactPhone?: string; 
  
  // Dates
  dateCreated: string; // ISO Date
  deadline?: string; // For Incoming
  shippingDate?: string; // For Outgoing

  // Items
  items: POItem[];
  
  // Financials
  subTotal: number; // New: Sum of items before tax/discount
  discount: number; // New: Discount value
  tax: number;      // New: Tax value
  grandTotal: number;
  paymentTerms?: string; 

  // Meta
  notes?: string;
  status: POStatus;
  attachment?: string; // Base64 string for file attachment
  
  // Signatures
  createdBy: string;
  approvedBy: string;
  receivedBy: string;
  
  // Calendar Integration
  googleEventId?: string;
  isSyncedToCalendar: boolean;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g., INV/2023/001
  refPONumber?: string; // Optional reference to a PO
  
  // Parties
  customerName: string;
  address: string;
  contactName?: string;
  contactPhone?: string;

  // Dates
  dateCreated: string;
  dueDate: string;

  // Items
  items: POItem[];

  // Financials
  subTotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  totalPaid?: number;
  remainingBalance?: number;
  
  // Payment Info
  bankName: string;
  accountNumber: string;
  accountName: string;

  notes?: string;
  status: InvoiceStatus;
  
  // Signatures
  createdBy: string; // Admin
  approvedBy: string; // Manager
}

export interface DeliveryOrder {
  id: string;
  doNumber: string; // e.g., SJ/2023/001
  refPONumber?: string; // Link ke PO
  
  // Recipient
  customerName: string;
  address: string;
  contactName?: string;
  contactPhone?: string;
  
  // Logistics
  date: string;
  driverName: string;
  licensePlate: string; // Plat Nomor
  vehicleType?: string; // Truck, PickUp, dll
  
  // Items
  items: DOItem[];
  
  status: DeliveryStatus;
  notes?: string;
  
  // Signatures
  warehouseStaff: string; // Admin Gudang
  driverSignName?: string; // Nama Jelas Sopir
}

export interface ShippingLabel {
  id: string;
  dateCreated: string;
  customerName: string;
  address: string;
  phone: string;
  senderName: string; // Default: Planet Keripik
  qrContent: string; // URL Website
}

export interface DashboardStats {
  totalIncoming: number;
  totalOutgoing: number;
  revenuePotential: number; // Sum of Incoming
  pendingDeadlines: number;
}
