
import React, { useState, useEffect } from 'react';
import { generateInvoiceNumber, saveInvoice, getInvoices, getInvoiceById, getPOs, getAppSettings } from '../services/storage';
import { submitInvoiceToGoogle } from '../services/googleSheetService';
import { Invoice, InvoiceStatus, POItem, POType, POStatus, PaymentDetail } from '../types';
import { Plus, Trash2, Save, Calendar, User, Package, ArrowLeft, Loader2, Lock, Percent, CreditCard, FileText, Wallet, ChevronDown, Clock } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from './Toast';

const InvoiceForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Suggestions from POs
  const [productSuggestions, setProductSuggestions] = useState<string[]>([]);
  const [specSuggestions, setSpecSuggestions] = useState<string[]>([]);
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  
  // Reference POs (Outgoing Only)
  const [availablePOs, setAvailablePOs] = useState<{id: string, no: string, name: string}[]>([]);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [refPONumber, setRefPONumber] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>(InvoiceStatus.UNPAID);
  
  const [dateCreated, setDateCreated] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  
  const [items, setItems] = useState<POItem[]>([{ id: Date.now().toString(), name: '', specification: '', quantity: 1, unit: 'Pcs', unitPrice: 0, totalPrice: 0 }]);
  
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [discountPercent, setDiscountPercent] = useState<string>('');
  const [taxPercent, setTaxPercent] = useState<string>('');

  // MULTI PAYMENT STATE (4 Slots)
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([
    { amount: 0, date: '' },
    { amount: 0, date: '' },
    { amount: 0, date: '' },
    { amount: 0, date: '' }
  ]);

  const [notes, setNotes] = useState('');
  
  // Payment Info Defaults (Now loaded from Settings)
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  const [createdBy, setCreatedBy] = useState('');
  const [approvedBy, setApprovedBy] = useState('');

  const UNIT_OPTIONS = ['Pcs', 'Dus', 'Bal', 'Pack', 'Kg', 'Lusin', 'Karton', 'Sak'];

  useEffect(() => {
    // Load Settings First
    const settings = getAppSettings();

    // Load Suggestions & POs
    const allPos = getPOs();
    const allInvoices = getInvoices();
    
    // Suggestion logic
    const allItems = [...allPos.flatMap(p => p.items), ...allInvoices.flatMap(i => i.items)];
    setProductSuggestions(Array.from(new Set(allItems.map(i => i.name).filter(Boolean))));
    setSpecSuggestions(Array.from(new Set(allItems.map(i => i.specification).filter(Boolean))));
    
    const custNames = Array.from(new Set([...allPos.map(p => p.customerName), ...allInvoices.map(i => i.customerName)]));
    setCustomerSuggestions(custNames);

    // Filter Outgoing POs for reference
    setAvailablePOs(allPos
      .filter(p => p.type === POType.OUTGOING)
      .map(p => ({ id: p.id, no: p.poNumber, name: p.customerName }))
    );

    if (id) {
      const inv = getInvoiceById(id);
      if (inv) {
        if (inv.status === InvoiceStatus.PAID) setIsReadOnly(true);
        
        setInvoiceNumber(inv.invoiceNumber);
        setRefPONumber(inv.refPONumber || '');
        setCustomerName(inv.customerName);
        setAddress(inv.address);
        setContactName(inv.contactName || '');
        setContactPhone(inv.contactPhone || '');
        setDateCreated(inv.dateCreated);
        setDueDate(inv.dueDate);
        
        // Ensure unit exists
        const patchedItems = inv.items.map(i => ({...i, unit: i.unit || 'Pcs'}));
        setItems(patchedItems);

        setDiscount(inv.discount);
        setTax(inv.tax);
        setNotes(inv.notes || '');
        setStatus(inv.status);
        
        // LOAD PAYMENTS
        if (inv.paymentDetails && inv.paymentDetails.length > 0) {
            // Load existing, fill rest with empty
            const loaded: PaymentDetail[] = [...inv.paymentDetails];
            while(loaded.length < 4) loaded.push({ amount: 0, date: '' });
            setPaymentDetails(loaded);
        } else if (inv.totalPaid) {
            // Legacy Support: Move totalPaid to Slot 1
            setPaymentDetails([
                { amount: inv.totalPaid, date: inv.dateCreated },
                { amount: 0, date: '' },
                { amount: 0, date: '' },
                { amount: 0, date: '' }
            ]);
        }
        
        setBankName(inv.bankName);
        setAccountNumber(inv.accountNumber);
        setAccountName(inv.accountName);
        
        setCreatedBy(inv.createdBy);
        setApprovedBy(inv.approvedBy);
      } else {
        showToast("Data Invoice tidak ditemukan", "error");
        navigate('/invoice/history');
      }
    } else {
      // NEW INVOICE: Load Defaults from Settings
      setInvoiceNumber(generateInvoiceNumber());
      setBankName(settings.defaultBankName);
      setAccountNumber(settings.defaultAccountNumber);
      setAccountName(settings.defaultAccountName);
      setCreatedBy(settings.defaultAdminName);
      setApprovedBy(settings.defaultManagerName);

      // Set Default Due Date (7 days from now)
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      setDueDate(nextWeek.toISOString().split('T')[0]);
      
      // Init Payment Date 1 with Today
      const today = new Date().toISOString().split('T')[0];
      setPaymentDetails([
          { amount: 0, date: today },
          { amount: 0, date: '' },
          { amount: 0, date: '' },
          { amount: 0, date: '' }
      ]);
    }
  }, [id, navigate, showToast]);

  const handlePOReferenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const poId = e.target.value;
      if (!poId) return;
      
      const po = getPOs().find(p => p.id === poId);
      if (po) {
          setRefPONumber(po.poNumber);
          setCustomerName(po.customerName);
          setAddress(po.address);
          setContactName(po.contactName || '');
          setContactPhone(po.contactPhone || '');
          
          // Import Items
          const importedItems = po.items.map(item => ({
              ...item,
              id: Date.now().toString() + Math.random(), // Regen ID
              unit: item.unit || 'Pcs'
          }));
          setItems(importedItems);
          
          showToast("Data diimpor dari PO " + po.poNumber, 'info');
      }
  };

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    if (isReadOnly) return;
    const newItems = [...items];
    const item = newItems[index];
    (item as any)[field] = value;
    if (field === 'quantity' || field === 'unitPrice') {
      item.totalPrice = item.quantity * item.unitPrice;
    }
    setItems(newItems);
  };

  const addItem = () => {
    if (isReadOnly) return;
    setItems([...items, { id: Date.now().toString(), name: '', specification: '', quantity: 1, unit: 'Pcs', unitPrice: 0, totalPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    if (isReadOnly) return;
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  // --- PAYMENT HANDLING ---
  const updatePayment = (index: number, field: keyof PaymentDetail, value: any) => {
      if (isReadOnly) return;
      const newPayments = [...paymentDetails];
      (newPayments[index] as any)[field] = value;
      setPaymentDetails(newPayments);
  };

  const calculateFinancials = () => {
    const subTotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const grandTotal = subTotal - discount + tax;
    const totalPaid = paymentDetails.reduce((sum, p) => sum + (p.amount || 0), 0);
    const remainingBalance = grandTotal - totalPaid;
    return { subTotal, grandTotal, totalPaid, remainingBalance };
  };

  const handlePercentageChange = (type: 'tax' | 'discount', percent: string) => {
      if (isReadOnly) return;
      const { subTotal } = calculateFinancials();
      const pct = parseFloat(percent) || 0;
      const value = Math.round(subTotal * (pct / 100));
      if (type === 'tax') { setTaxPercent(percent); setTax(value); } 
      else { setDiscountPercent(percent); setDiscount(value); }
  };

  const handleValueChange = (type: 'tax' | 'discount', value: number) => {
      if (isReadOnly) return;
      if (type === 'tax') { setTax(value); setTaxPercent(''); } 
      else { setDiscount(value); setDiscountPercent(''); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      showToast("Mohon tambahkan minimal 1 item tagihan.", "error");
      return;
    }
    
    setLoading(true);
    const { subTotal, grandTotal, totalPaid, remainingBalance } = calculateFinancials();
    
    // Auto update status based on payment
    let currentStatus = status;
    if (remainingBalance <= 0 && grandTotal > 0) {
        currentStatus = InvoiceStatus.PAID;
    } else if (totalPaid > 0 && remainingBalance > 0) {
        currentStatus = InvoiceStatus.PARTIAL;
    } else if (totalPaid === 0) {
        currentStatus = InvoiceStatus.UNPAID; // Reset to Unpaid if paid cleared
    }

    // Filter payments that have amount > 0
    const validPayments = paymentDetails.filter(p => p.amount > 0);

    const newInvoice: Invoice = {
      id: id || Date.now().toString(),
      invoiceNumber,
      refPONumber,
      customerName,
      address,
      contactName,
      contactPhone,
      dateCreated,
      dueDate,
      items,
      subTotal,
      discount,
      tax,
      grandTotal,
      totalPaid,
      remainingBalance,
      paymentDetails: validPayments, // Save clean array
      bankName,
      accountNumber,
      accountName,
      notes,
      status: currentStatus,
      createdBy,
      approvedBy
    };

    saveInvoice(newInvoice);
    
    // Cloud Sync
    setSyncingGoogle(true);
    showToast("Menyimpan ke Cloud...", "info");
    const cloudResult = await submitInvoiceToGoogle(newInvoice);
    setSyncingGoogle(false);

    if (cloudResult.success) {
        showToast("Invoice berhasil disimpan ke Cloud & Lokal!", "success");
    } else {
        showToast("Tersimpan di Lokal. Gagal Sync Cloud.", "warning");
    }

    setLoading(false);
    setTimeout(() => navigate('/invoice/history'), 1000);
  };

  const SectionTitle = ({ icon, title }: { icon: React.ReactNode, title: string }) => (
    <div className="flex items-center gap-3 mb-5 text-slate-800 pb-3 border-b border-slate-100">
      <div className="p-2 rounded-xl bg-violet-100 text-violet-600">
        {icon}
      </div>
      <h3 className="font-bold text-lg">{title}</h3>
    </div>
  );

  const { subTotal, grandTotal, remainingBalance } = calculateFinancials();

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 md:pb-20">
      <datalist id="product-list">{productSuggestions.map((prod, i) => <option key={i} value={prod} />)}</datalist>
      <datalist id="spec-list">{specSuggestions.map((spec, i) => <option key={i} value={spec} />)}</datalist>
      <datalist id="customer-list">{customerSuggestions.map((cust, i) => <option key={i} value={cust} />)}</datalist>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-[#F6F8FC] z-30 py-4 border-b border-slate-200/50 -mx-4 px-4 md:-mx-8 md:px-8 shadow-sm">
        <div className="flex items-center gap-4">
           <button type="button" onClick={() => navigate('/invoice/history')} className="p-2 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 transition-all shadow-sm">
             <ArrowLeft size={20} />
           </button>
           <div>
             <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
               {id ? 'Edit Invoice' : 'Buat Invoice Baru'}
               {isReadOnly && <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full border border-slate-200 flex items-center gap-1 uppercase tracking-wider"><Lock size={10}/> Paid/Locked</span>}
             </h1>
             <p className="text-slate-500 text-xs md:text-sm font-medium">
                {invoiceNumber}
             </p>
           </div>
        </div>
        
        {!isReadOnly && (
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm self-start md:self-auto">
           <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Bayar</span>
           <div className="h-4 w-[1px] bg-slate-200"></div>
           <select 
             value={status} 
             onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
             className={`text-sm font-bold border-none focus:ring-0 cursor-pointer rounded-lg px-2 py-1 ${
               status === InvoiceStatus.PAID ? 'text-emerald-600 bg-emerald-50' : 
               status === InvoiceStatus.OVERDUE ? 'text-red-600 bg-red-50' : 
               'text-amber-600 bg-amber-50'
             }`}
           >
             <option value={InvoiceStatus.UNPAID}>Belum Lunas</option>
             <option value={InvoiceStatus.PAID}>Lunas</option>
             <option value={InvoiceStatus.OVERDUE}>Jatuh Tempo</option>
             <option value={InvoiceStatus.DRAFT}>Draft</option>
           </select>
        </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-12 gap-6">
          
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Customer Info */}
            <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 ${isReadOnly ? 'opacity-80 pointer-events-none' : ''}`}>
              <SectionTitle icon={<User size={18} />} title="Tagihan Kepada (Pelanggan)" />
              
              {!id && (
                  <div className="mb-4 flex items-center gap-3 bg-violet-50 p-3 rounded-lg border border-violet-100">
                      <span className="text-xs font-bold text-violet-600">Import dari PO:</span>
                      <select onChange={handlePOReferenceChange} className="bg-white border-violet-200 text-xs rounded px-2 py-1">
                          <option value="">-- Pilih PO Keluar --</option>
                          {availablePOs.map(po => <option key={po.id} value={po.id}>{po.no} - {po.name}</option>)}
                      </select>
                  </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nama Pelanggan</label>
                    <input type="text" required readOnly={isReadOnly} list="customer-list"
                       className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all font-semibold"
                       value={customerName} onChange={e => setCustomerName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Kontak PIC</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-amber-500 transition-all font-medium"
                      value={contactName} onChange={e => setContactName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">No. HP / WA</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-amber-500 transition-all font-medium"
                      value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Alamat Lengkap</label>
                    <textarea rows={2} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-amber-500 transition-all font-medium resize-none"
                      value={address} onChange={e => setAddress(e.target.value)} />
                  </div>
              </div>
            </div>

            {/* Items */}
            <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 ${isReadOnly ? 'opacity-90' : ''}`}>
               <div className="flex items-center justify-between mb-6">
                 <SectionTitle icon={<Package size={18} />} title="Rincian Item" />
                 {!isReadOnly && (
                    <button type="button" onClick={addItem} className="text-sm flex items-center gap-1.5 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 font-bold transition-all shadow-lg shadow-slate-200">
                      <Plus size={16} /> <span className="hidden sm:inline">Tambah</span>
                    </button>
                 )}
               </div>
              
              {/* VERTICAL LIST / CARD VIEW */}
              <div className="space-y-6 mb-8">
                {items.map((item, index) => (
                  <div key={item.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 relative shadow-sm hover:shadow-md transition-shadow">
                     {!isReadOnly && (
                        <button type="button" onClick={() => removeItem(index)} className="absolute top-3 right-3 p-2 text-slate-400 hover:text-red-500 bg-white rounded-lg shadow-sm border border-slate-100">
                           <Trash2 size={18} />
                        </button>
                     )}
                     
                     {/* 1. Nama Item */}
                     <div className="mb-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Deskripsi Item</label>
                        <input type="text" required readOnly={isReadOnly} list="product-list"
                           className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
                           value={item.name} onChange={e => updateItem(index, 'name', e.target.value)} placeholder="Nama Barang..." />
                     </div>

                     {/* 2. Spesifikasi */}
                     <div className="mb-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Spec / Varian</label>
                        <input type="text" readOnly={isReadOnly} list="spec-list"
                           className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:border-amber-500 font-medium transition-all"
                           value={item.specification} onChange={e => updateItem(index, 'specification', e.target.value)} placeholder="Contoh: Merah, XL..." />
                     </div>

                     {/* 3. QTY dan Satuan */}
                     <div className="mb-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Jumlah (Qty) & Satuan</label>
                        <div className="flex gap-2">
                           <input type="number" min="1" required readOnly={isReadOnly}
                              className="w-1/2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-center font-bold text-lg focus:border-amber-500 transition-all"
                              value={item.quantity} onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 0)} />
                           <div className="w-1/2 relative">
                              <select 
                                 disabled={isReadOnly}
                                 className="w-full h-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold appearance-none focus:border-amber-500 cursor-pointer"
                                 value={item.unit || 'Pcs'} onChange={e => updateItem(index, 'unit', e.target.value)}
                              >
                                 {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                              <ChevronDown className="absolute right-3 top-4 text-slate-400 pointer-events-none" size={16}/>
                           </div>
                        </div>
                     </div>

                     {/* 4. Harga Satuan */}
                     <div className="mb-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Harga Satuan</label>
                        <div className="relative">
                           <span className="absolute left-4 top-3.5 text-slate-400 font-bold text-sm">Rp</span>
                           <input type="number" min="0" required readOnly={isReadOnly}
                              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold focus:border-amber-500 transition-all"
                              value={item.unitPrice} onChange={e => updateItem(index, 'unitPrice', parseInt(e.target.value) || 0)} />
                        </div>
                     </div>

                     {/* 5. Total */}
                     <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</span>
                        <span className="text-xl font-black text-slate-800">Rp {item.totalPrice.toLocaleString('id-ID')}</span>
                     </div>
                  </div>
                ))}
                 {!isReadOnly && (
                    <button type="button" onClick={addItem} className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-colors flex items-center justify-center gap-2">
                      <Plus size={18} /> Tambah Item Lain
                    </button>
                 )}
              </div>
              
              {/* Calculation */}
              <div className="flex justify-end">
                <div className="w-full md:w-[450px] bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <div className="flex flex-col gap-4 text-sm">
                        <div className="flex justify-between items-center text-slate-600">
                            <span className="font-medium">Subtotal</span>
                            <span className="font-bold text-base">Rp {subTotal.toLocaleString('id-ID')}</span>
                        </div>
                        
                        <div className="flex justify-between items-center text-slate-600">
                            <span className="font-medium">Diskon</span>
                            <div className="flex items-center gap-2">
                                <div className="relative w-20">
                                    <input type="number" min="0" max="100" placeholder="%" readOnly={isReadOnly}
                                        className="w-full pl-3 pr-6 py-1.5 border border-slate-300 rounded-lg text-right text-sm bg-white"
                                        value={discountPercent} onChange={e => handlePercentageChange('discount', e.target.value)} />
                                    <span className="absolute right-3 top-2 text-slate-400 pointer-events-none"><Percent size={12} /></span>
                                </div>
                                <input type="number" min="0" readOnly={isReadOnly}
                                className="w-32 px-3 py-1.5 border border-slate-300 rounded-lg text-right bg-white font-medium"
                                value={discount} onChange={e => handleValueChange('discount', parseInt(e.target.value) || 0)} />
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-slate-600">
                            <span className="font-medium">Pajak (PPN)</span>
                            <div className="flex items-center gap-2">
                                <div className="relative w-20">
                                    <input type="number" min="0" max="100" placeholder="%" readOnly={isReadOnly}
                                        className="w-full pl-3 pr-6 py-1.5 border border-slate-300 rounded-lg text-right text-sm bg-white"
                                        value={taxPercent} onChange={e => handlePercentageChange('tax', e.target.value)} />
                                    <span className="absolute right-3 top-2 text-slate-400 pointer-events-none"><Percent size={12} /></span>
                                </div>
                                <input type="number" min="0" readOnly={isReadOnly}
                                className="w-32 px-3 py-1.5 border border-slate-300 rounded-lg text-right bg-white font-medium"
                                value={tax} onChange={e => handleValueChange('tax', parseInt(e.target.value) || 0)} />
                            </div>
                        </div>

                        <div className="w-full h-[1px] bg-slate-200 my-2"></div>
                        <div className="flex justify-between items-center text-slate-900">
                            <span className="font-extrabold text-lg uppercase">Total Tagihan</span>
                            <span className="font-black text-2xl text-violet-600">Rp {grandTotal.toLocaleString('id-ID')}</span>
                        </div>

                        {/* MULTI PAYMENT SECTION */}
                        <div className="mt-4 space-y-3">
                            <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                                <Wallet size={16} className="text-violet-500" />
                                <span className="font-bold text-xs uppercase text-slate-500">Riwayat Pembayaran (DP/Cicilan)</span>
                            </div>
                            
                            {paymentDetails.map((payment, index) => (
                                <div key={index} className="flex gap-2 items-center">
                                    <div className="w-24 shrink-0">
                                        <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                            {index === 0 ? "Uang Muka 1" : `Pembayaran ${index + 1}`}
                                        </label>
                                        <div className="relative">
                                            <input 
                                                type="date" 
                                                readOnly={isReadOnly}
                                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-[10px] font-medium"
                                                value={payment.date}
                                                onChange={(e) => updatePayment(index, 'date', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-slate-400 block mb-1 text-right">Nominal</label>
                                        <input 
                                            type="number" 
                                            min="0"
                                            readOnly={isReadOnly}
                                            className={`w-full px-3 py-1.5 bg-white border rounded-lg text-right font-bold text-sm focus:ring-2 focus:ring-violet-200 transition-all ${payment.amount > 0 ? 'border-violet-300 text-violet-700' : 'border-slate-300 text-slate-600'}`}
                                            placeholder="0"
                                            value={payment.amount || ''}
                                            onChange={(e) => updatePayment(index, 'amount', parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* SISA TAGIHAN DISPLAY */}
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200">
                            <span className="font-bold text-slate-500 uppercase text-[11px]">Sisa Tagihan</span>
                            <span className={`font-black text-xl ${remainingBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                Rp {remainingBalance.toLocaleString('id-ID')}
                            </span>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-6">
             {/* Right column logic remains the same */}
             <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 ${isReadOnly ? 'opacity-80 pointer-events-none' : ''}`}>
              <SectionTitle icon={<Calendar size={18} />} title="Jadwal" />
               <div className="space-y-5">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tanggal Invoice</label>
                      <input type="date" required 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                        value={dateCreated} onChange={e => setDateCreated(e.target.value)} />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 text-red-500">Jatuh Tempo (Due Date)</label>
                      <input type="date" required 
                        className="w-full px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-slate-900 font-medium"
                        value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">No Referensi PO</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                      value={refPONumber} onChange={e => setRefPONumber(e.target.value)} placeholder="Opsional (PO-OUT-...)" />
                  </div>
               </div>
            </div>

            <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 ${isReadOnly ? 'opacity-80 pointer-events-none' : ''}`}>
               <SectionTitle icon={<CreditCard size={18} />} title="Rekening Pembayaran" />
               <div className="space-y-4">
                 <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Nama Bank</label>
                    <input type="text" required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm font-medium" 
                      value={bankName} onChange={e => setBankName(e.target.value)} />
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">No. Rekening</label>
                    <input type="text" required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm font-bold tracking-wider" 
                      value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Atas Nama</label>
                    <input type="text" required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm font-medium" 
                      value={accountName} onChange={e => setAccountName(e.target.value)} />
                 </div>
               </div>
            </div>

             <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 ${isReadOnly ? 'opacity-80 pointer-events-none' : ''}`}>
               <SectionTitle icon={<FileText size={18} />} title="Tanda Tangan" />
               <div className="space-y-4">
                  <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Dibuat Oleh (Admin)</label>
                     <input type="text" required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm font-medium" 
                       value={createdBy} onChange={e => setCreatedBy(e.target.value)} />
                  </div>
                  <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Disetujui (Manager)</label>
                     <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm font-medium" 
                       value={approvedBy} onChange={e => setApprovedBy(e.target.value)} />
                  </div>
                  <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Catatan</label>
                     <textarea rows={2} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm font-medium resize-none" 
                       value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>
               </div>
            </div>

            {!isReadOnly && (
              <div className="flex flex-col gap-3 pt-2">
                <button type="submit" disabled={loading || syncingGoogle}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-white font-bold shadow-lg shadow-violet-200 transition-all text-lg ${loading || syncingGoogle ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 active:scale-95'}`}
                >
                  {syncingGoogle ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />} 
                  {syncingGoogle ? 'Menyimpan...' : 'Simpan Invoice'}
                </button>
                <button type="button" onClick={() => navigate('/invoice/history')} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors">
                  Batal
                </button>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default InvoiceForm;
