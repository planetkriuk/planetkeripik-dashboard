
import React, { useState, useEffect } from 'react';
import { generateDONumber, saveDeliveryOrder, getDeliveryOrderById, getPOs, getInvoices } from '../services/storage';
import { submitDeliveryOrderToGoogle } from '../services/googleSheetService';
import { DeliveryOrder, DeliveryStatus, DOItem, POType, InvoiceStatus } from '../types';
import { Plus, Trash2, Save, Calendar, User, Truck, ArrowLeft, Loader2, FileText, MapPin, ChevronDown, Package } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from './Toast';

const DeliveryOrderForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [doNumber, setDoNumber] = useState('');

  // Suggestions
  const [availablePOs, setAvailablePOs] = useState<{id: string, no: string, name: string}[]>([]);
  const [availableInvoices, setAvailableInvoices] = useState<{id: string, no: string, name: string}[]>([]);
  const [productSuggestions, setProductSuggestions] = useState<string[]>([]);
  const [specSuggestions, setSpecSuggestions] = useState<string[]>([]);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [refPONumber, setRefPONumber] = useState('');
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [driverName, setDriverName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [warehouseStaff, setWarehouseStaff] = useState('');
  const [status, setStatus] = useState<DeliveryStatus>(DeliveryStatus.PREPARING);
  const [notes, setNotes] = useState('');
  
  const [items, setItems] = useState<DOItem[]>([{ id: Date.now().toString(), name: '', specification: '', quantity: 1, unit: 'Pcs', notes: '' }]);

  const UNIT_OPTIONS = ['Pcs', 'Dus', 'Bal', 'Pack', 'Kg', 'Lusin', 'Karton', 'Sak'];

  useEffect(() => {
    // Load POs
    const allPos = getPOs();
    
    // Populate Suggestions
    const allItems = allPos.flatMap(p => p.items);
    setProductSuggestions(Array.from(new Set(allItems.map(i => i.name).filter(Boolean))));
    setSpecSuggestions(Array.from(new Set(allItems.map(i => i.specification).filter(Boolean))));

    setAvailablePOs(allPos
      .filter(p => p.type === POType.OUTGOING)
      .map(p => ({ id: p.id, no: p.poNumber, name: p.customerName }))
    );

    // Load Invoices
    const allInvoices = getInvoices();
    setAvailableInvoices(allInvoices
      .filter(i => i.status !== InvoiceStatus.DRAFT)
      .map(i => ({ id: i.id, no: i.invoiceNumber, name: i.customerName }))
    );

    if (id) {
      const data = getDeliveryOrderById(id);
      if (data) {
        setDoNumber(data.doNumber);
        setRefPONumber(data.refPONumber || '');
        setCustomerName(data.customerName);
        setAddress(data.address);
        setContactName(data.contactName || '');
        setContactPhone(data.contactPhone || '');
        setDate(data.date);
        setDriverName(data.driverName);
        setLicensePlate(data.licensePlate);
        setWarehouseStaff(data.warehouseStaff);
        
        // Ensure unit exists
        const patchedItems = data.items.map(i => ({...i, unit: i.unit || 'Pcs'}));
        setItems(patchedItems);
        
        setNotes(data.notes || '');
        setStatus(data.status);
      } else {
        showToast("Data Surat Jalan tidak ditemukan", "error");
        navigate('/surat-jalan');
      }
    } else {
      setDoNumber(generateDONumber());
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
          
          // Import Items (Only Qty & Name)
          const importedItems = po.items.map(item => ({
              id: Date.now().toString() + Math.random(),
              name: item.name,
              specification: item.specification,
              quantity: item.quantity,
              unit: item.unit || 'Pcs',
              notes: ''
          }));
          setItems(importedItems);
          
          showToast("Data diimpor dari PO " + po.poNumber, 'info');
      }
  };

  const handleInvoiceReferenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const invId = e.target.value;
    if (!invId) return;

    const inv = getInvoices().find(i => i.id === invId);
    if (inv) {
        setRefPONumber(inv.refPONumber || ''); 
        setCustomerName(inv.customerName);
        setAddress(inv.address);
        setContactName(inv.contactName || '');
        setContactPhone(inv.contactPhone || '');

        const importedItems = inv.items.map(item => ({
            id: Date.now().toString() + Math.random(),
            name: item.name,
            specification: item.specification,
            quantity: item.quantity,
            unit: item.unit || 'Pcs',
            notes: ''
        }));
        setItems(importedItems);

        showToast("Data diimpor dari Invoice " + inv.invoiceNumber, 'info');
    }
  };

  const updateItem = (index: number, field: keyof DOItem, value: any) => {
    const newItems = [...items];
    const item = newItems[index];
    (item as any)[field] = value;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), name: '', specification: '', quantity: 1, unit: 'Pcs', notes: '' }]);
  };

  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      showToast("Mohon tambahkan minimal 1 item.", "error");
      return;
    }
    
    setLoading(true);
    
    const newDO: DeliveryOrder = {
      id: id || Date.now().toString(),
      doNumber,
      refPONumber,
      customerName,
      address,
      contactName,
      contactPhone,
      date,
      driverName,
      licensePlate,
      warehouseStaff,
      items,
      status,
      notes
    };

    saveDeliveryOrder(newDO);
    
    setSyncingGoogle(true);
    showToast("Menyimpan ke Cloud...", "info");
    const cloudResult = await submitDeliveryOrderToGoogle(newDO);
    setSyncingGoogle(false);

    if (cloudResult.success) {
        showToast("Surat Jalan berhasil disimpan ke Cloud & Lokal!", "success");
    } else {
        showToast("Tersimpan di Lokal. Gagal Sync Cloud.", "warning");
    }

    setLoading(false);
    setTimeout(() => navigate('/surat-jalan'), 1000);
  };

  const SectionTitle = ({ icon, title }: { icon: React.ReactNode, title: string }) => (
    <div className="flex items-center gap-3 mb-5 text-slate-800 pb-3 border-b border-slate-100">
      <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
        {icon}
      </div>
      <h3 className="font-bold text-lg">{title}</h3>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 md:pb-20">
      <datalist id="product-list">{productSuggestions.map((prod, i) => <option key={i} value={prod} />)}</datalist>
      <datalist id="spec-list">{specSuggestions.map((spec, i) => <option key={i} value={spec} />)}</datalist>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-[#F6F8FC] z-30 py-4 border-b border-slate-200/50 -mx-4 px-4 md:-mx-8 md:px-8 shadow-sm">
        <div className="flex items-center gap-4">
           <button type="button" onClick={() => navigate('/surat-jalan')} className="p-2 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 transition-all shadow-sm">
             <ArrowLeft size={20} />
           </button>
           <div>
             <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
               {id ? 'Edit Surat Jalan' : 'Buat Surat Jalan'}
             </h1>
             <p className="text-slate-500 text-xs md:text-sm font-medium">
                {doNumber}
             </p>
           </div>
        </div>
        
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm self-start md:self-auto">
           <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</span>
           <div className="h-4 w-[1px] bg-slate-200"></div>
           <select 
             value={status} 
             onChange={(e) => setStatus(e.target.value as DeliveryStatus)}
             className="text-sm font-bold border-none focus:ring-0 cursor-pointer rounded-lg px-2 py-1 text-slate-700 bg-slate-50"
           >
             <option value={DeliveryStatus.PREPARING}>Diproses</option>
             <option value={DeliveryStatus.SHIPPED}>Dikirim</option>
             <option value={DeliveryStatus.DELIVERED}>Diterima</option>
             <option value={DeliveryStatus.RETURNED}>Retur</option>
           </select>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-12 gap-6">
          
          {/* KOLOM 1 (KIRI) - UTAMA */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Customer Info */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <SectionTitle icon={<User size={18} />} title="Tujuan Pengiriman" />
              
              {!id && (
                  <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* IMPORT PO */}
                      <div className="flex items-center gap-2 bg-amber-50 p-2.5 rounded-lg border border-amber-100">
                          <span className="text-[10px] font-bold text-amber-700 uppercase">Import PO:</span>
                          <select onChange={handlePOReferenceChange} className="bg-white border-amber-200 text-xs rounded px-2 py-1 w-full font-medium">
                              <option value="">-- Pilih PO --</option>
                              {availablePOs.map(po => <option key={po.id} value={po.id}>{po.no} - {po.name}</option>)}
                          </select>
                      </div>
                      {/* IMPORT INVOICE */}
                      <div className="flex items-center gap-2 bg-violet-50 p-2.5 rounded-lg border border-violet-100">
                          <span className="text-[10px] font-bold text-violet-700 uppercase">Import Inv:</span>
                          <select onChange={handleInvoiceReferenceChange} className="bg-white border-violet-200 text-xs rounded px-2 py-1 w-full font-medium">
                              <option value="">-- Pilih Invoice --</option>
                              {availableInvoices.map(inv => <option key={inv.id} value={inv.id}>{inv.no} - {inv.name}</option>)}
                          </select>
                      </div>
                  </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nama Penerima</label>
                    <input type="text" required
                       className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-amber-500 font-semibold"
                       value={customerName} onChange={e => setCustomerName(e.target.value)} />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Alamat Tujuan</label>
                    <textarea rows={2} required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-amber-500 font-medium resize-none"
                      value={address} onChange={e => setAddress(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Kontak PIC</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-amber-500 font-medium"
                      value={contactName} onChange={e => setContactName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">No. HP</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-amber-500 font-medium"
                      value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
                  </div>
              </div>
            </div>

            {/* Logistics Info */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <SectionTitle icon={<Truck size={18} />} title="Armada & Ekspedisi" />
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tanggal Pengiriman</label>
                      <input type="date" required 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                        value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nama Sopir</label>
                      <input type="text" required placeholder="Nama Lengkap"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                        value={driverName} onChange={e => setDriverName(e.target.value)} />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Plat Nomor (Nopol)</label>
                      <input type="text" required placeholder="N - XXXX - XX"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-black tracking-widest uppercase"
                        value={licensePlate} onChange={e => setLicensePlate(e.target.value)} />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Admin Gudang (Pengirim)</label>
                      <input type="text" required
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                        value={warehouseStaff} onChange={e => setWarehouseStaff(e.target.value)} />
                  </div>
               </div>
            </div>

            {/* Items */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
               <div className="flex items-center justify-between mb-6">
                 <SectionTitle icon={<FileText size={18} />} title="Barang yang Dibawa" />
                 <button type="button" onClick={addItem} className="text-sm flex items-center gap-1.5 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 font-bold transition-all shadow-lg shadow-slate-200">
                    <Plus size={16} /> <span className="hidden sm:inline">Tambah Item</span>
                 </button>
               </div>
              
              {/* VERTICAL LIST / CARD VIEW - MATCHING INVOICE/PO STYLE */}
              <div className="space-y-6 mb-8">
                  {items.map((item, index) => (
                      <div key={item.id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 relative shadow-sm hover:shadow-md transition-shadow">
                          <button type="button" onClick={() => removeItem(index)} className="absolute top-3 right-3 p-2 text-slate-400 hover:text-red-500 bg-white rounded-lg shadow-sm border border-slate-100">
                             <Trash2 size={18} />
                          </button>
                          
                          {/* 1. Nama Barang */}
                          <div className="mb-4">
                             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Nama Barang</label>
                             <input type="text" required list="product-list" 
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
                                value={item.name} onChange={e => updateItem(index, 'name', e.target.value)} placeholder="Contoh: Keripik Singkong" />
                          </div>

                          {/* 2. Spesifikasi */}
                          <div className="mb-4">
                             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Varian / Spec</label>
                             <input type="text" list="spec-list" 
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:border-amber-500 font-medium transition-all"
                                value={item.specification} onChange={e => updateItem(index, 'specification', e.target.value)} placeholder="Contoh: Balado 200g" />
                          </div>

                          {/* 3. Jumlah (Qty) & Satuan - SPLIT INPUT (NEW) */}
                          <div className="mb-4">
                             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Jumlah (Qty) & Satuan</label>
                             <div className="flex gap-2">
                               <input type="number" min="1" required
                                  className="w-1/2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-center font-bold text-lg focus:border-amber-500 transition-all"
                                  value={item.quantity} onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 0)} />
                               <div className="w-1/2 relative">
                                  <select 
                                     className="w-full h-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold appearance-none focus:border-amber-500 cursor-pointer"
                                     value={item.unit || 'Pcs'} onChange={e => updateItem(index, 'unit', e.target.value)}
                                  >
                                     {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                                  </select>
                                  <ChevronDown className="absolute right-3 top-4 text-slate-400 pointer-events-none" size={16}/>
                               </div>
                             </div>
                          </div>

                          {/* 4. Keterangan / Kondisi */}
                          <div>
                             <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Keterangan / Kondisi</label>
                             <input type="text" placeholder="Contoh: Dus Penyok, Segel Aman..." 
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:border-amber-500 font-medium transition-all"
                                value={item.notes} onChange={e => updateItem(index, 'notes', e.target.value)} />
                          </div>
                      </div>
                  ))}
                  <button type="button" onClick={addItem} className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-2">
                      <Plus size={18} /> Tambah Item Lain
                  </button>
              </div>
            </div>
          </div>

          {/* KOLOM 2 (KANAN) - CATATAN */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                 <SectionTitle icon={<FileText size={18} />} title="Catatan Tambahan" />
                 <textarea rows={4} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 text-sm focus:bg-white focus:border-amber-500 transition-colors resize-none"
                   value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan khusus untuk sopir..." />
              </div>
          </div>

          {/* KOLOM 3 (BAWAH) - TOMBOL AKSI */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-3 pt-2">
                <button type="submit" disabled={loading || syncingGoogle}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-white font-bold shadow-lg shadow-amber-200 transition-all text-lg ${loading || syncingGoogle ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 active:scale-95'}`}
                >
                  {syncingGoogle ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />} 
                  {syncingGoogle ? 'Menyimpan...' : 'Simpan Surat Jalan'}
                </button>
                <button type="button" onClick={() => navigate('/surat-jalan')} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors">
                  Batal
                </button>
            </div>
        </div>
      </form>
    </div>
  );
};

export default DeliveryOrderForm;
