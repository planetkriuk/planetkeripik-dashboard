
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Printer, Image as ImageIcon, Loader2, RefreshCw, User, MapPin, Phone, StickyNote } from 'lucide-react';
import { ShippingLabel, POType } from '../types';
import { saveShippingLabel, getPOs, getInvoices } from '../services/storage';
import { useToast } from './Toast';
import html2canvas from 'html2canvas';

const LOGO_URL = "https://raw.githubusercontent.com/habibiegl/planetkeripiklogo/f138730adcd58a09fc5cd7ffb9d65a7fa314b96b/Logo%20Planet%20Keripik%20P.png";

const StickerForm: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [senderName] = useState('Planet Keripik'); // Fixed
  
  // Data Import Suggestion
  const [availableSources, setAvailableSources] = useState<{id: string, name: string, type: string, data: any}[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Combine Customers from POs (Outgoing) and Invoices
    const pos = getPOs().filter(p => p.type === POType.OUTGOING);
    const invoices = getInvoices();
    
    const sources = [
        ...pos.map(p => ({ id: `PO-${p.id}`, name: `${p.customerName} (PO: ${p.poNumber})`, type: 'PO', data: p })),
        ...invoices.map(i => ({ id: `INV-${i.id}`, name: `${i.customerName} (INV: ${i.invoiceNumber})`, type: 'INV', data: i }))
    ];
    setAvailableSources(sources);
  }, []);

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setSelectedSourceId(val);
      if (!val) return;

      const source = availableSources.find(s => s.id === val);
      if (source && source.data) {
          const d = source.data;
          setCustomerName(d.customerName);
          setAddress(d.address);
          setPhone(d.contactPhone || '');
          showToast(`Data diimpor dari ${source.type}`, 'info');
      }
  };

  const handleSave = () => {
    if (!customerName || !address) {
        showToast('Nama dan Alamat wajib diisi.', 'error');
        return;
    }

    const newLabel: ShippingLabel = {
        id: Date.now().toString(),
        dateCreated: new Date().toISOString(),
        customerName,
        address,
        phone,
        senderName,
        qrContent: 'https://www.planetkeripik.com'
    };

    saveShippingLabel(newLabel);
    showToast('Stiker berhasil disimpan ke Riwayat.', 'success');
    navigate('/stiker/history');
  };

  const handleDownload = async () => {
    if (!previewRef.current) return;
    setIsGenerating(true);
    try {
        const canvas = await html2canvas(previewRef.current, {
            scale: 3, // High Res
            backgroundColor: null
        });
        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = image;
        link.download = `Stiker-${customerName.replace(/\s+/g, '-')}.png`;
        link.click();
        showToast('Stiker berhasil didownload.', 'success');
    } catch (e) {
        showToast('Gagal generate gambar.', 'error');
    } finally {
        setIsGenerating(false);
    }
  };

  const handlePrint = () => {
     window.print();
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row gap-6 mb-8 no-print">
         <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <StickyNote className="text-red-600" /> Buat Stiker Pengiriman
            </h1>
            <p className="text-slate-500 text-sm mt-1">Isi form di bawah atau import dari data Invoice/PO.</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: FORM */}
        <div className="lg:col-span-5 space-y-6 no-print">
            
            {/* Import Box */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col gap-2">
                <label className="text-xs font-bold text-blue-600 uppercase">Import Data Pelanggan</label>
                <div className="relative">
                    <select 
                        value={selectedSourceId} 
                        onChange={handleSourceChange}
                        className="w-full pl-3 pr-8 py-2 bg-white border border-blue-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">-- Pilih Sumber Data --</option>
                        {availableSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <RefreshCw size={14} className="absolute right-3 top-3 text-blue-400 pointer-events-none"/>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1.5">
                        <User size={14}/> Nama Penerima
                    </label>
                    <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-red-500 transition-colors" placeholder="Nama Lengkap..." />
                </div>
                <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1.5">
                        <MapPin size={14}/> Alamat Lengkap
                    </label>
                    <textarea rows={3} value={address} onChange={e => setAddress(e.target.value)} 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-red-500 transition-colors resize-none" placeholder="Jalan, RT/RW, Kota, Kode Pos..." />
                </div>
                <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1.5">
                        <Phone size={14}/> Telepon / WA
                    </label>
                    <input type="text" value={phone} onChange={e => setPhone(e.target.value)} 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-red-500 transition-colors" placeholder="08..." />
                </div>
                <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Pengirim (Otomatis)</label>
                    <input type="text" value={senderName} readOnly
                        className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-sm font-bold cursor-not-allowed" />
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <button onClick={handleSave} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-200 flex items-center justify-center gap-2 transition-transform active:scale-95">
                    <Save size={18}/> Simpan ke Riwayat
                </button>
                 <div className="flex gap-3">
                    <button onClick={handleDownload} disabled={isGenerating} className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold shadow-sm flex items-center justify-center gap-2">
                        {isGenerating ? <Loader2 size={18} className="animate-spin"/> : <ImageIcon size={18}/>} Download PNG
                    </button>
                    <button onClick={handlePrint} className="flex-1 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold shadow-sm flex items-center justify-center gap-2">
                        <Printer size={18}/> Print
                    </button>
                 </div>
            </div>
        </div>

        {/* RIGHT COLUMN: PREVIEW */}
        <div className="lg:col-span-7 flex flex-col items-center">
             <div className="no-print mb-4 flex items-center gap-2 text-sm text-slate-400 uppercase font-bold tracking-widest">
                 Live Preview
             </div>
             
             {/* STICKER CONTAINER - EXACT REPLICA OF IMAGE */}
             <div className="bg-slate-200 p-8 rounded-2xl overflow-auto w-full flex justify-center shadow-inner">
                 <div ref={previewRef} 
                      className="bg-white border-[8px] border-[#dc2626] w-[600px] aspect-[1.5/1] relative flex flex-col shadow-2xl shrink-0 print:border-[8px] print:w-[600px] print:shadow-none"
                 >
                     {/* HEADER */}
                     <div className="text-center pt-2 pb-1">
                         <h1 className="text-[#dc2626] font-black text-5xl uppercase tracking-tighter scale-y-110" style={{ fontFamily: 'Arial, sans-serif' }}>
                             JANGAN DIBANTING
                         </h1>
                     </div>

                     {/* BODY CONTENT */}
                     <div className="flex-1 px-8 py-2 flex flex-col justify-center space-y-5">
                         {/* Field: Nama */}
                         <div className="flex items-end">
                             <span className="w-24 font-bold text-slate-600 text-xl">Nama :</span>
                             <div className="flex-1 border-b-2 border-slate-800 text-2xl font-bold text-slate-900 px-2 pb-1 leading-none">
                                 {customerName}
                             </div>
                         </div>
                         {/* Field: Alamat */}
                         <div className="flex items-start">
                             <span className="w-24 font-bold text-slate-600 text-xl pt-1">Alamat :</span>
                             <div className="flex-1 border-b-2 border-slate-800 text-lg font-bold text-slate-900 px-2 pb-1 leading-tight min-h-[3rem] break-words whitespace-pre-wrap">
                                 {address}
                             </div>
                         </div>
                         {/* Field: Telepon */}
                         <div className="flex items-end">
                             <span className="w-24 font-bold text-slate-600 text-xl">Telepon :</span>
                             <div className="flex-1 border-b-2 border-slate-800 text-2xl font-bold text-slate-900 px-2 pb-1 leading-none">
                                 {phone}
                             </div>
                         </div>
                     </div>

                     {/* FOOTER */}
                     <div className="mt-auto px-4 pb-3 pt-2 flex items-center justify-between gap-2">
                         
                         {/* Left: Sender & Logo */}
                         <div className="flex flex-col w-[30%]">
                             <span className="text-xs font-bold text-slate-500 mb-0.5">Pengirim:</span>
                             <div className="flex items-center gap-1">
                                 <img src={LOGO_URL} className="h-10 object-contain" alt="Logo" />
                                 <div className="flex flex-col leading-none">
                                     <span className="font-black text-slate-900 text-lg tracking-tight">PLANET</span>
                                     <span className="font-black text-slate-900 text-lg tracking-tight">KRIPIK!</span>
                                 </div>
                             </div>
                         </div>

                         {/* Middle: Address Box (Red Background) */}
                         <div className="flex-1 bg-[#d9480f] text-white px-3 py-2 text-[10px] font-bold leading-tight flex items-center justify-center text-center h-full rounded-sm">
                             Jalan Tempean IV Rt/Rw :<br/>
                             04/06 Madyorenggo Talok<br/>
                             Turen Malang ,082338247777
                         </div>

                         {/* Right: QR Code & Website */}
                         <div className="flex items-center gap-2 pl-2 w-[25%] justify-end">
                             <img 
                                src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://www.planetkeripik.com" 
                                className="w-12 h-12 border border-slate-300" 
                                alt="QR"
                             />
                             <div className="flex flex-col leading-tight">
                                 <span className="font-black text-slate-900 text-sm">WEBSITE</span>
                                 <span className="text-xs font-bold text-slate-600">Scan sini</span>
                             </div>
                         </div>
                         
                         {/* Bottom URL Text */}
                         <div className="absolute bottom-1 left-0 right-0 text-center">
                            <span className="text-[10px] font-bold text-slate-800 tracking-wide">www.planetkeripik.com</span>
                         </div>
                     </div>
                 </div>
             </div>
             
             <div className="mt-4 text-center no-print">
                 <p className="text-xs text-slate-400">Tips: Gunakan kertas stiker A5 atau A6 Landscape untuk hasil terbaik.</p>
             </div>
        </div>

      </div>
      
      {/* CSS untuk menyembunyikan elemen lain saat Print */}
      <style>{`
        @media print {
            body * {
                visibility: hidden;
            }
            .no-print {
                display: none !important;
            }
            #root {
                background: white;
            }
            /* Hanya tampilkan Sticker Container */
            .lg\\:col-span-7, .lg\\:col-span-7 * {
                visibility: visible;
            }
            .lg\\:col-span-7 {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                margin: 0;
                padding: 0;
            }
            /* Hilangkan border container luar saat print */
            .bg-slate-200 {
                background: white !important;
                box-shadow: none !important;
                padding: 0 !important;
            }
        }
      `}</style>
    </div>
  );
};

export default StickerForm;
