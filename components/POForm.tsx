
import React, { useState, useEffect } from 'react';
import { generatePONumber, savePO, getPOs, getPOById, getAppSettings } from '../services/storage';
import { POType, PurchaseOrder, POItem, POStatus } from '../types';
import { Plus, Trash2, Save, Calendar, Search, User, Package, FileText, ArrowLeft, Upload, X, Loader2, AlertCircle, Lock, Percent, ChevronDown } from 'lucide-react';
import { submitPOToGoogle } from '../services/googleSheetService';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from './Toast';

interface POFormProps {
  defaultType?: POType;
}

const POForm: React.FC<POFormProps> = ({ defaultType }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  
  const [type, setType] = useState<POType>(defaultType || POType.INCOMING);
  const [existingPOs, setExistingPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [poNumber, setPoNumber] = useState('');
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Auto-Complete Suggestion Lists
  const [productSuggestions, setProductSuggestions] = useState<string[]>([]);
  const [specSuggestions, setSpecSuggestions] = useState<string[]>([]);
  const [customerHistory, setCustomerHistory] = useState<Map<string, { address: string, contact: string, phone: string }>>(new Map());
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);

  // Form State
  const [selectedPOId, setSelectedPOId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [poStatus, setPoStatus] = useState<POStatus>(POStatus.APPROVED);
  
  const [dateCreated, setDateCreated] = useState(new Date().toISOString().split('T')[0]);
  const [deadline, setDeadline] = useState('');
  const [shippingDate, setShippingDate] = useState('');
  const [items, setItems] = useState<POItem[]>([{ id: Date.now().toString(), name: '', specification: '', quantity: 1, unit: 'Pcs', unitPrice: 0, totalPrice: 0 }]);
  
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [discountPercent, setDiscountPercent] = useState<string>('');
  const [taxPercent, setTaxPercent] = useState<string>('');

  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('COD');
  const [customPaymentTerms, setCustomPaymentTerms] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [attachment, setAttachment] = useState<string | undefined>(undefined);

  const UNIT_OPTIONS = ['Pcs', 'Dus', 'Bal', 'Pack', 'Kg', 'Lusin', 'Karton', 'Sak'];

  useEffect(() => {
    // Load Settings First
    const settings = getAppSettings();

    const allPos = getPOs();
    const allItems = allPos.flatMap(p => p.items);
    setProductSuggestions(Array.from(new Set(allItems.map(i => i.name).filter(Boolean))));
    setSpecSuggestions(Array.from(new Set(allItems.map(i => i.specification).filter(Boolean))));

    const custMap = new Map();
    const custNames: string[] = [];
    allPos.forEach(p => {
        if (p.customerName && !custMap.has(p.customerName)) {
            custMap.set(p.customerName, {
                address: p.address,
                contact: p.contactName || '',
                phone: p.contactPhone || ''
            });
            custNames.push(p.customerName);
        }
    });
    setCustomerHistory(custMap);
    setCustomerSuggestions(custNames);

    if (id) {
      const po = getPOById(id);
      if (po) {
        if (po.status === POStatus.COMPLETED || po.status === POStatus.CANCELLED) {
          setIsReadOnly(true);
        }
        setType(po.type);
        setPoNumber(po.poNumber);
        setCustomerName(po.customerName);
        setAddress(po.address);
        setContactName(po.contactName || '');
        setContactPhone(po.contactPhone || '');
        setDateCreated(po.dateCreated);
        
        // Ensure unit exists for old data
        const patchedItems = po.items.map(i => ({...i, unit: i.unit || 'Pcs'}));
        setItems(patchedItems);

        setDiscount(po.discount || 0);
        setTax(po.tax || 0);
        setNotes(po.notes || '');
        setCreatedBy(po.createdBy);
        setApprovedBy(po.approvedBy);
        setReceivedBy(po.receivedBy);
        setAttachment(po.attachment);
        setPoStatus(po.status);
        
        if (po.deadline) setDeadline(po.deadline);
        if (po.shippingDate) setShippingDate(po.shippingDate);
        if (po.relatedPOId) setSelectedPOId(po.relatedPOId);

        if (po.paymentTerms) {
          const standards = ['COD', 'CBD', 'NET 7', 'NET 14', 'NET 30'];
          if (standards.includes(po.paymentTerms.toUpperCase())) {
            setPaymentTerms(po.paymentTerms.toUpperCase());
          } else {
            setPaymentTerms('OTHER');
            setCustomPaymentTerms(po.paymentTerms);
          }
        }
      } else {
        showToast("Data PO tidak ditemukan", "error");
        navigate('/');
      }
    } else {
      // NEW PO: Load defaults from Settings
      setPoStatus(type === POType.INCOMING ? POStatus.APPROVED : POStatus.COMPLETED);
      setCreatedBy(settings.defaultAdminName);
      setApprovedBy(settings.defaultManagerName);
    }
  }, [id, navigate, showToast, type]);

  useEffect(() => {
    if (type === POType.OUTGOING) {
      const allPos = getPOs();
      setExistingPOs(allPos.filter(p => p.type === POType.INCOMING && p.status === POStatus.APPROVED));
    }
  }, [type]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast("Ukuran file maksimal 5MB", "error");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setCustomerName(val);
      if (customerHistory.has(val) && !id) { 
          const data = customerHistory.get(val);
          if (data) {
              setAddress(data.address);
              setContactName(data.contact);
              setContactPhone(data.phone);
          }
      }
  };

  const handlePOSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const poId = e.target.value;
    setSelectedPOId(poId);
    
    if (!poId) {
      setCustomerName('');
      setAddress('');
      setContactName('');
      setContactPhone('');
      return;
    }

    const selectedPO = existingPOs.find(p => p.id === poId);
    if (selectedPO) {
      setCustomerName(selectedPO.customerName);
      setAddress(selectedPO.address);
      setContactName(selectedPO.contactName || '');
      setContactPhone(selectedPO.contactPhone || '');
      
      // LOGIKA BARU: Copy semua item tanpa validasi stok
      if (!id || items.length === 0) {
        const newItems: POItem[] = selectedPO.items.map(item => ({
             ...item,
             id: Date.now().toString() + Math.random(),
             unit: item.unit || 'Pcs',
             quantity: item.quantity, 
             totalPrice: item.quantity * item.unitPrice
        }));
        setItems(newItems);
        showToast(`Berhasil menyalin ${newItems.length} item dari PO.`, "success");
      }
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

  const calculateFinancials = () => {
    const subTotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const grandTotal = subTotal - discount + tax;
    return { subTotal, grandTotal };
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
      showToast("Mohon tambahkan minimal 1 barang.", "error");
      return;
    }
    
    const { subTotal, grandTotal } = calculateFinancials();
    setLoading(true);
    const finalPONumber = id ? poNumber : generatePONumber(type);
    const finalPaymentTerms = paymentTerms === 'OTHER' ? customPaymentTerms : paymentTerms;

    const newPO: PurchaseOrder = {
      id: id || Date.now().toString(),
      poNumber: finalPONumber,
      type,
      relatedPOId: type === POType.OUTGOING ? selectedPOId : undefined,
      customerName,
      address,
      contactName,
      contactPhone,
      dateCreated,
      deadline: type === POType.INCOMING ? deadline : undefined,
      shippingDate: type === POType.OUTGOING ? shippingDate : undefined,
      items,
      subTotal,
      discount,
      tax,
      grandTotal,
      paymentTerms: finalPaymentTerms,
      notes,
      status: poStatus,
      attachment: type === POType.INCOMING ? attachment : undefined,
      createdBy,
      approvedBy,
      receivedBy,
      isSyncedToCalendar: false,
    };

    savePO(newPO);
    
    setSyncingGoogle(true);
    showToast("Menyimpan ke Lokal & Cloud...", "info");
    const googleResult = await submitPOToGoogle(newPO);
    setSyncingGoogle(false);
    
    if (googleResult.success) {
      showToast("BERHASIL: Data tersimpan!", "success");
    } else {
      showToast("Tersimpan lokal. Gagal Cloud.", "error");
    }

    setLoading(false);
    setTimeout(() => navigate('/history'), 1000);
  };

  const SectionTitle = ({ icon, title }: { icon: React.ReactNode, title: string }) => (
    <div className="flex items-center gap-3 mb-5 text-slate-800 pb-3 border-b border-slate-100">
      <div className={`p-2 rounded-xl ${type === POType.INCOMING ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
        {icon}
      </div>
      <h3 className="font-bold text-lg">{title}</h3>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 md:pb-20">
      <datalist id="product-list">
        {productSuggestions.map((prod, i) => <option key={i} value={prod} />)}
      </datalist>
      <datalist id="spec-list">
        {specSuggestions.map((spec, i) => <option key={i} value={spec} />)}
      </datalist>
      <datalist id="customer-list">
        {customerSuggestions.map((cust, i) => <option key={i} value={cust} />)}
      </datalist>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-[#F6F8FC] z-30 py-4 border-b border-slate-200/50 -mx-4 px-4 md:-mx-8 md:px-8 shadow-sm">
        <div className="flex items-center gap-4">
           <button type="button" onClick={() => navigate('/')} className="p-2 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 transition-all shadow-sm">
             <ArrowLeft size={20} />
           </button>
           <div>
             <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
               {id ? 'Edit Order' : (type === POType.INCOMING ? 'PO Masuk Baru' : 'PO Keluar Baru')}
               {isReadOnly && <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full border border-slate-200 flex items-center gap-1 uppercase tracking-wider"><Lock size={10}/> View Only</span>}
             </h1>
             <p className="text-slate-500 text-xs md:text-sm font-medium">
                {id ? `${poNumber}` : 'Lengkapi formulir di bawah ini.'}
             </p>
           </div>
        </div>
        
        {!isReadOnly && (
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm self-start md:self-auto">
           <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Dokumen</span>
           <div className="h-4 w-[1px] bg-slate-200"></div>
           <select 
             value={poStatus} 
             onChange={(e) => setPoStatus(e.target.value as POStatus)}
             className={`text-sm font-bold border-none focus:ring-0 cursor-pointer rounded-lg px-2 py-1 ${
               poStatus === POStatus.APPROVED ? 'text-blue-600 bg-blue-50' : 
               poStatus === POStatus.COMPLETED ? 'text-emerald-600 bg-emerald-50' : 
               poStatus === POStatus.DRAFT ? 'text-slate-600 bg-slate-100' : 
               poStatus === POStatus.PENDING ? 'text-amber-600 bg-amber-50' : 
               'text-red-600 bg-red-50'
             }`}
           >
             <option value={POStatus.DRAFT}>Draft (Konsep)</option>
             <option value={POStatus.PENDING}>Pending (Menunggu)</option>
             <option value={POStatus.APPROVED}>Approved (Disetujui)</option>
             <option value={POStatus.COMPLETED}>Completed (Selesai)</option>
             <option value={POStatus.CANCELLED}>Cancelled (Batal)</option>
           </select>
        </div>
        )}
      </div>

      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 shadow-sm animate-fade-in-down">
          <div className="p-2 bg-amber-100 text-amber-600 rounded-full shrink-0">
             <AlertCircle size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-amber-800 text-sm">Mode Baca Saja</h3>
            <p className="text-amber-700 text-xs mt-0.5">Ubah status ke "Draft" jika ingin mengedit kembali.</p>
          </div>
          <button type="button" onClick={() => { setPoStatus(POStatus.DRAFT); setIsReadOnly(false); }}
            className="shrink-0 bg-white border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-100 shadow-sm">
            Buka Kunci
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Main Info & Items */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            
            {/* Informasi Pelanggan Card */}
            <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 ${isReadOnly ? 'opacity-80 pointer-events-none' : ''}`}>
              <SectionTitle icon={<User size={18} />} title={type === POType.INCOMING ? "Detail Supplier / Vendor" : "Detail Pelanggan"} />
              
               {type === POType.OUTGOING && !id && (
                <div className="mb-6 bg-blue-50/50 p-5 rounded-xl border border-blue-100 relative">
                  <label className="block text-[11px] font-bold text-blue-500 uppercase tracking-widest mb-2">Ambil dari Data Masuk (Opsional)</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 text-blue-400" size={18} />
                    <select className="w-full pl-10 pr-10 py-3 bg-white rounded-lg border-blue-200 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none shadow-sm font-medium"
                      value={selectedPOId} onChange={handlePOSelect}>
                      <option value="">-- Pilih Referensi PO Masuk --</option>
                      {existingPOs.map(po => (<option key={po.id} value={po.id}>{po.poNumber} — {po.customerName}</option>))}
                    </select>
                    <ChevronDown className="absolute right-3 top-4 text-blue-400 pointer-events-none" size={16} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nama Perusahaan / Perorangan</label>
                    <div className="relative">
                        <input type="text" required readOnly={type === POType.OUTGOING && !!selectedPOId}
                          list="customer-list" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all font-semibold"
                          value={customerName} onChange={handleCustomerNameChange} placeholder="Ketik nama untuk cari otomatis..." />
                        {!id && customerHistory.has(customerName) && (<div className="absolute right-3 top-3 text-emerald-500"><User size={18} /></div>)}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Kontak PIC</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all font-medium"
                      value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nama Orang" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">No. HP / WA</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all font-medium"
                      value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="08..." />
                  </div>
                  
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Alamat Lengkap</label>
                    <textarea rows={2} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all font-medium resize-none"
                      value={address} onChange={e => setAddress(e.target.value)} placeholder="Nama Jalan, Kota, Provinsi..."
                    />
                  </div>
              </div>
            </div>

            {/* Detail Barang Card */}
            <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 ${isReadOnly ? 'opacity-90' : ''}`}>
               <div className="flex items-center justify-between mb-6">
                 <SectionTitle icon={<Package size={18} />} title="Daftar Barang" />
                 {!isReadOnly && (
                    <button type="button" onClick={addItem} className="text-sm flex items-center gap-1.5 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 font-bold transition-all shadow-lg shadow-slate-200">
                      <Plus size={16} /> <span className="hidden sm:inline">Tambah Item</span>
                    </button>
                 )}
               </div>
              
              {/* VERTICAL LIST / CARD VIEW FOR ITEMS */}
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
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Nama Barang</label>
                        <input type="text" required readOnly={isReadOnly} list="product-list"
                           className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
                           value={item.name} onChange={e => updateItem(index, 'name', e.target.value)} placeholder="Contoh: Keripik Singkong" />
                     </div>

                     {/* 2. Spesifikasi */}
                     <div className="mb-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Spesifikasi / Varian</label>
                        <input type="text" readOnly={isReadOnly} list="spec-list"
                           className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:border-amber-500 font-medium transition-all"
                           value={item.specification} onChange={e => updateItem(index, 'specification', e.target.value)} placeholder="Contoh: Balado 200g" />
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
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Harga Satuan (@)</label>
                        <div className="relative">
                           <span className="absolute left-4 top-3.5 text-slate-400 font-bold text-sm">Rp</span>
                           <input type="number" min="0" required readOnly={isReadOnly}
                              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold focus:border-amber-500 transition-all"
                              value={item.unitPrice} onChange={e => updateItem(index, 'unitPrice', parseInt(e.target.value) || 0)} />
                        </div>
                     </div>

                     {/* 5. Total */}
                     <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Item Ini</span>
                        <span className="text-xl font-black text-slate-800">Rp {item.totalPrice.toLocaleString('id-ID')}</span>
                     </div>
                  </div>
                ))}
                 {!isReadOnly && (
                    <button type="button" onClick={addItem} className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-2">
                      <Plus size={18} /> Tambah Item Lain
                    </button>
                 )}
              </div>

              {/* Total Calculation */}
              <div className="flex justify-end">
                <div className="w-full md:w-[400px] bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <div className="flex flex-col gap-4 text-sm">
                        <div className="flex justify-between items-center text-slate-600">
                            <span className="font-medium">Subtotal</span>
                            <span className="font-bold text-base">Rp {calculateFinancials().subTotal.toLocaleString('id-ID')}</span>
                        </div>
                        
                        <div className="flex justify-between items-center text-slate-600">
                            <span className="font-medium">Diskon</span>
                            <div className="flex items-center gap-2">
                                <div className="relative w-20">
                                    <input type="number" min="0" max="100" placeholder="%" readOnly={isReadOnly}
                                        className="w-full pl-3 pr-6 py-1.5 border border-slate-300 rounded-lg text-right focus:border-amber-500 text-sm bg-white"
                                        value={discountPercent} onChange={e => handlePercentageChange('discount', e.target.value)} />
                                    <span className="absolute right-3 top-2 text-slate-400 pointer-events-none"><Percent size={12} /></span>
                                </div>
                                <input type="number" min="0" readOnly={isReadOnly}
                                className="w-32 px-3 py-1.5 border border-slate-300 rounded-lg text-right focus:border-amber-500 bg-white font-medium"
                                value={discount} onChange={e => handleValueChange('discount', parseInt(e.target.value) || 0)} />
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-slate-600">
                            <span className="font-medium">Pajak (PPN)</span>
                            <div className="flex items-center gap-2">
                                <div className="relative w-20">
                                    <input type="number" min="0" max="100" placeholder="%" readOnly={isReadOnly}
                                        className="w-full pl-3 pr-6 py-1.5 border border-slate-300 rounded-lg text-right focus:border-amber-500 text-sm bg-white"
                                        value={taxPercent} onChange={e => handlePercentageChange('tax', e.target.value)} />
                                    <span className="absolute right-3 top-2 text-slate-400 pointer-events-none"><Percent size={12} /></span>
                                </div>
                                <input type="number" min="0" readOnly={isReadOnly}
                                className="w-32 px-3 py-1.5 border border-slate-300 rounded-lg text-right focus:border-amber-500 bg-white font-medium"
                                value={tax} onChange={e => handleValueChange('tax', parseInt(e.target.value) || 0)} />
                            </div>
                        </div>

                        <div className="w-full h-[1px] bg-slate-200 my-2"></div>
                        <div className="flex justify-between items-center text-slate-900">
                            <span className="font-extrabold text-lg uppercase">Total Akhir</span>
                            <span className="font-black text-2xl text-amber-600">Rp {calculateFinancials().grandTotal.toLocaleString('id-ID')}</span>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Schedule, Meta, Actions */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
             {/* ... existing code for right column ... */}
             <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 ${isReadOnly ? 'opacity-80 pointer-events-none' : ''}`}>
              <SectionTitle icon={<Calendar size={18} />} title="Jadwal & Logistik" />
               <div className="space-y-5">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tanggal Dokumen</label>
                      <input type="date" required 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 font-medium"
                        value={dateCreated} onChange={e => setDateCreated(e.target.value)} />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                        {type === POType.INCOMING ? 'Batas Waktu (Deadline)' : 'Rencana Kirim Barang'}
                      </label>
                      <input type="date" required 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 font-medium"
                        value={type === POType.INCOMING ? deadline : shippingDate} 
                        onChange={e => type === POType.INCOMING ? setDeadline(e.target.value) : setShippingDate(e.target.value)} />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Metode Pembayaran</label>
                      <div className="relative">
                        <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 font-medium appearance-none"
                          value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}>
                          <option value="COD">COD (Bayar ditempat)</option>
                          <option value="CBD">CBD (Tunai Sebelum Kirim)</option>
                          <option value="NET 7">Tempo 7 Hari</option>
                          <option value="NET 14">Tempo 14 Hari</option>
                          <option value="NET 30">Tempo 30 Hari</option>
                          <option value="OTHER">Lainnya...</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16}/>
                      </div>
                  </div>
                  {paymentTerms === 'OTHER' && (
                      <input type="text" required placeholder="Tulis detail pembayaran..."
                        className="w-full px-4 py-2.5 bg-white border border-amber-300 rounded-xl text-slate-900 animate-fade-in"
                        value={customPaymentTerms} onChange={e => setCustomPaymentTerms(e.target.value)} />
                  )}
                  
                  <div className="pt-5 border-t border-slate-100 space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Dibuat Oleh (Admin)</label>
                      <input type="text" required className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm font-medium" 
                        value={createdBy} onChange={e => setCreatedBy(e.target.value)} placeholder="Nama Anda" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Disetujui (Manager)</label>
                          <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm font-medium" 
                            value={approvedBy} onChange={e => setApprovedBy(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Diterima Oleh</label>
                          <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm font-medium" 
                            value={receivedBy} onChange={e => setReceivedBy(e.target.value)} />
                        </div>
                    </div>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Catatan Internal</label>
                     <textarea rows={4} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 text-sm focus:bg-white focus:border-amber-500 transition-colors resize-none"
                       value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan khusus untuk gudang/finance..." />
                  </div>
                </div>
            </div>

            {type === POType.INCOMING && (
              <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-200 ${isReadOnly ? 'opacity-80 pointer-events-none' : ''}`}>
                <SectionTitle icon={<FileText size={18} />} title="Lampiran Fisik" />
                <div className="space-y-4">
                    <div className="space-y-2">
                      {!attachment ? (
                        <div className="relative group border-2 border-dashed border-slate-200 rounded-xl p-8 hover:border-amber-400 hover:bg-amber-50 cursor-pointer transition-all text-center">
                          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" accept="image/*,application/pdf" onChange={handleFileUpload} />
                          <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-amber-600">
                             <div className="p-3 bg-slate-100 rounded-full group-hover:bg-white transition-colors">
                                <Upload size={24} />
                             </div>
                             <span className="text-xs font-bold uppercase">Klik untuk Upload Foto/PDF</span>
                          </div>
                        </div>
                      ) : (
                        <div className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                           <div className="h-32 flex flex-col items-center justify-center text-slate-500 gap-2">
                               <FileText size={32} className="text-amber-500"/>
                               <span className="text-xs font-bold">File Terlampir</span>
                               <span className="text-[10px] text-slate-400">(Klik silang untuk hapus)</span>
                           </div>
                          <button type="button" onClick={() => setAttachment(undefined)} className="absolute top-2 right-2 p-1.5 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full shadow-sm border border-slate-100 transition-colors">
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                </div>
              </div>
            )}

            {/* ACTION BUTTONS (DESKTOP) */}
            {!isReadOnly && (
              <div className="hidden md:flex flex-col gap-3 pt-2">
                <button type="submit" disabled={loading || syncingGoogle}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-white font-bold shadow-lg shadow-amber-200 transition-all text-lg ${loading || syncingGoogle ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95'}`}
                >
                  {syncingGoogle ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />} 
                  {syncingGoogle ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
                <button type="button" onClick={() => navigate('/history')} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors">
                  Batal
                </button>
              </div>
            )}
            
            {isReadOnly && (
              <button type="button" onClick={() => navigate('/history')} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors">
                Kembali ke Riwayat
              </button>
            )}
          </div>
        </div>

        {/* MOBILE STICKY ACTION BUTTONS */}
        {!isReadOnly && (
            <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 flex gap-3 pb-safe">
                <button type="button" onClick={() => navigate('/history')} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm">
                  Batal
                </button>
                <button type="submit" disabled={loading || syncingGoogle}
                  className={`flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-bold shadow-lg text-sm ${loading || syncingGoogle ? 'bg-slate-400' : 'bg-gradient-to-r from-amber-500 to-amber-600'}`}
                >
                  {syncingGoogle ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} 
                  {syncingGoogle ? 'Saving...' : 'Simpan'}
                </button>
            </div>
        )}
      </form>
    </div>
  );
};

export default POForm;
