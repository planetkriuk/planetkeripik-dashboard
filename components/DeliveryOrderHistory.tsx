
import React, { useState, useEffect, useRef } from 'react';
import { getDeliveryOrders, deleteDeliveryOrder, saveDeliveryOrder } from '../services/storage';
import { fetchDeliveryOrdersFromGoogle, deleteDeliveryOrderFromGoogle } from '../services/googleSheetService';
import { DeliveryOrder, DeliveryStatus } from '../types';
import { Search, Printer, Trash2, ChevronLeft, ChevronRight, Truck, Pencil, Image as ImageIcon, X, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import html2canvas from 'html2canvas';

const ITEMS_PER_PAGE = 10;
const LOGO_URL = "https://raw.githubusercontent.com/habibiegl/planetkeripiklogo/f138730adcd58a09fc5cd7ffb9d65a7fa314b96b/Logo%20Planet%20Keripik%20P.png";
const TTD_URL = "https://raw.githubusercontent.com/habibiegl/planetkeripiklogo/f138730adcd58a09fc5cd7ffb9d65a7fa314b96b/TTD%20Pak%20Misdi.png";
const STEMPEL_URL = "https://raw.githubusercontent.com/habibiegl/planetkeripiklogo/f138730adcd58a09fc5cd7ffb9d65a7fa314b96b/Stempel%20Planet%20Keripik.png";

const DeliveryOrderHistory: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewScale, setPreviewScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load local
    setOrders(getDeliveryOrders());
    // Sync Cloud
    handleSync();
  }, []);

  useEffect(() => {
    const handleResize = () => {
       if (containerRef.current && selectedOrder) {
          const containerWidth = containerRef.current.offsetWidth;
          const targetScale = (containerWidth - 32) / 1123;
          setPreviewScale(Math.min(targetScale, 1)); 
       }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedOrder]);

  const handleSync = async () => {
      setIsSyncing(true);
      try {
          const result = await fetchDeliveryOrdersFromGoogle();
          if (result.success && result.data) {
              setOrders(result.data);
              // Save to local
              result.data.forEach(d => saveDeliveryOrder(d));
              if (result.data.length > 0) {
                 showToast(`Sync Surat Jalan: ${result.data.length} data dimuat.`, 'success');
              }
          } else {
              showToast("Gagal mengambil data Surat Jalan dari Cloud.", "info");
          }
      } catch (e) {
          showToast("Gagal sinkronisasi.", "error");
      } finally {
          setIsSyncing(false);
      }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Hapus Surat Jalan ini?')) {
      deleteDeliveryOrder(id);
      setOrders(getDeliveryOrders());
      if (selectedOrder?.id === id) setSelectedOrder(null);
      
      showToast('Menghapus dari cloud...', 'info');
      const res = await deleteDeliveryOrderFromGoogle(id);
      
      if (res.success) {
          showToast('Surat Jalan terhapus permanen.', 'success');
          handleSync();
      } else {
          showToast('Terhapus lokal. Server gagal merespon.', 'warning');
      }
    }
  };

  const handleEdit = (id: string) => navigate(`/surat-jalan/edit/${id}`);
  const handlePrint = () => window.print();

  const handleSaveImage = async () => {
    const originalElement = document.getElementById('sj-print-area');
    if (!originalElement) return;
    setIsGeneratingImage(true);
    const cloneContainer = document.createElement('div');
    cloneContainer.style.position = 'absolute';
    cloneContainer.style.top = '-10000px';
    cloneContainer.style.left = '-10000px';
    cloneContainer.style.width = '1123px'; 
    cloneContainer.style.zIndex = '-9999';
    cloneContainer.style.backgroundColor = '#ffffff';
    document.body.appendChild(cloneContainer);

    try {
        const clonedElement = originalElement.cloneNode(true) as HTMLElement;
        clonedElement.style.transform = 'none';
        clonedElement.style.margin = '0';
        clonedElement.style.width = '1123px'; 
        clonedElement.style.minHeight = '794px'; 
        clonedElement.style.height = 'auto'; 
        clonedElement.style.padding = '15mm';
        cloneContainer.appendChild(clonedElement);
        await new Promise(resolve => setTimeout(resolve, 500));
        const contentHeight = clonedElement.scrollHeight; 
        const canvas = await html2canvas(clonedElement, { 
            scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
            width: 1123, height: contentHeight + 100, windowWidth: 1123, windowHeight: contentHeight + 200
        });
        const image = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = image;
        link.download = `${selectedOrder?.doNumber.replace(/\//g,'-')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Gambar disimpan!', 'success');
    } catch (err) {
        showToast('Gagal menyimpan gambar.', 'error');
    } finally {
        if (document.body.contains(cloneContainer)) document.body.removeChild(cloneContainer);
        setIsGeneratingImage(false);
    }
  };

  const filtered = orders.filter(o => 
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.doNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-3">
             <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Surat Jalan</h2>
             {isSyncing && <Loader2 size={16} className="animate-spin text-amber-500"/>}
          </div>
          <p className="text-slate-500 text-sm mt-1">Kelola pengiriman barang dan cetak dokumen jalan.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleSync} disabled={isSyncing} className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors shadow-sm font-bold text-sm disabled:opacity-70">
            <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} /> 
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={() => navigate('/surat-jalan/create')} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm shadow-amber-200 flex items-center gap-2">
             <Truck size={18} /> + Buat Surat Jalan
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input type="text" placeholder="Cari..." className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* LIST */}
        <div className={`bg-white md:rounded-2xl md:shadow-sm md:border md:border-slate-200 overflow-hidden flex flex-col no-print transition-all duration-300 ${selectedOrder ? 'hidden lg:flex lg:w-1/3' : 'w-full'}`}>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50/80 text-slate-500 font-bold sticky top-0 z-10 border-b border-slate-200 backdrop-blur-sm">
                        <tr>
                            <th className="px-5 py-4 w-1/3">Detail Pengiriman</th>
                            <th className="px-5 py-4 text-right">Tanggal</th>
                            <th className="px-4 py-4 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginated.map(order => (
                            <tr key={order.id} className={`hover:bg-amber-50 cursor-pointer ${selectedOrder?.id === order.id ? 'bg-amber-50 border-l-4 border-l-amber-500' : ''}`} onClick={() => setSelectedOrder(order)}>
                                <td className="px-5 py-4">
                                    <div className="font-bold text-slate-800 text-xs">{order.doNumber}</div>
                                    <div className="text-[10px] text-slate-500 font-medium">{order.customerName}</div>
                                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 bg-slate-100 w-fit px-1.5 py-0.5 rounded">
                                        <Truck size={10} /> {order.driverName}
                                    </div>
                                </td>
                                <td className="px-5 py-4 text-right font-bold text-slate-700 text-xs">
                                    {order.date}
                                </td>
                                <td className="px-4 py-4 text-center">
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(order.id); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filtered.length === 0 && (
                    <div className="p-8 text-center text-slate-400">Belum ada Surat Jalan.</div>
                )}
            </div>
            {filtered.length > 0 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                <span className="text-[10px] font-bold text-slate-400">{currentPage} / {totalPages}</span>
                <div className="flex gap-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg bg-white border border-slate-200"><ChevronLeft size={16} /></button>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg bg-white border border-slate-200"><ChevronRight size={16} /></button>
                </div>
                </div>
            )}
        </div>

        {/* PREVIEW */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-slate-100/90 backdrop-blur-md lg:static lg:bg-transparent lg:backdrop-blur-none flex flex-col lg:flex-row lg:w-2/3 h-full animate-fade-in overflow-hidden">
             
             <div className="lg:hidden bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between shadow-sm z-50 shrink-0">
               <button onClick={() => setSelectedOrder(null)} className="flex items-center gap-2 text-slate-600 font-bold text-sm"><ChevronLeft size={20} /> Kembali</button>
            </div>

            <div className="flex-1 flex flex-col gap-4 h-full overflow-hidden w-full max-w-7xl mx-auto lg:max-w-none">
                <div className="bg-white p-3 rounded-none lg:rounded-xl shadow-sm border-b lg:border border-slate-200 flex items-center justify-between gap-3 no-print shrink-0">
                   <div className="flex gap-2">
                      <button onClick={() => handleEdit(selectedOrder.id)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-2"><Pencil size={14}/> Edit</button>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={handleSaveImage} disabled={isGeneratingImage} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm shadow-emerald-200">
                          {isGeneratingImage ? <Loader2 size={14} className="animate-spin"/> : <ImageIcon size={14}/>} Simpan
                      </button>
                      <button onClick={handlePrint} className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm">
                          <Printer size={14}/> Print
                      </button>
                      <button onClick={() => setSelectedOrder(null)} className="hidden lg:block p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
                   </div>
                </div>

                {/* SURAT JALAN PREVIEW */}
                <div ref={containerRef} className="flex-1 bg-slate-200/50 overflow-auto w-full relative flex flex-col items-center p-4 lg:p-8">
                    <div 
                        className="transition-transform duration-300 origin-top-left"
                        style={{ 
                            transform: `scale(${previewScale})`,
                            width: '1123px', minHeight: '794px',
                            marginBottom: `${(794 * previewScale) - 794}px`, 
                            marginRight: `${(1123 * previewScale) - 1123}px` 
                        }}
                    >
                        <div id="sj-print-area" className="bg-white shadow-2xl print:shadow-none text-slate-900 relative flex flex-col text-sm box-border"
                            style={{ width: '1123px', minHeight: '794px', padding: '15mm', boxSizing: 'border-box' }}>
                            
                            {/* HEADER */}
                            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6 mb-8">
                                <div className="flex items-center gap-5 w-[40%]">
                                    <img src={LOGO_URL} alt="Logo" className="h-20 w-auto object-contain shrink-0" />
                                    <div className="flex flex-col">
                                        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">Planet Keripik</h1>
                                        <p className="text-sm font-semibold text-slate-600 leading-tight">
                                            Jl. Tempean Utara Gang 1, RT.4/RW.6 Madyorenggo<br/>
                                            Talok, Kec. Turen, Kabupaten Malang, Jawa Timur 65175
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center justify-center pt-2">
                                    <h2 className="text-4xl font-extrabold text-slate-900 uppercase tracking-tighter leading-none mb-2">SURAT JALAN</h2>
                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">DELIVERY ORDER</span>
                                </div>
                                <div className="w-[25%] flex flex-col items-end text-right pt-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">No Surat Jalan</span>
                                    <span className="text-xl font-bold text-slate-900 font-mono mb-3">{selectedOrder.doNumber}</span>
                                    
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tanggal Kirim</span>
                                    <span className="text-lg font-medium text-slate-800">{new Date(selectedOrder.date).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</span>
                                </div>
                            </div>

                            {/* DETAILS GRID */}
                            <div className="grid grid-cols-12 gap-8 mb-8">
                                <div className="col-span-5 border-t border-slate-200 pt-3">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tujuan / Penerima</h3>
                                    <p className="font-bold text-xl text-slate-900 mb-2">{selectedOrder.customerName}</p>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-3">{selectedOrder.address}</p>
                                    <div className="flex gap-2 text-sm text-slate-500">
                                        {selectedOrder.contactName && <span>UP: {selectedOrder.contactName}</span>}
                                        {selectedOrder.contactPhone && <span>({selectedOrder.contactPhone})</span>}
                                    </div>
                                </div>
                                <div className="col-span-4 border-t border-slate-200 pt-3">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Armada & Logistik</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between border-b border-dotted border-slate-200 pb-1">
                                            <span className="text-slate-500">Sopir</span>
                                            <span className="font-bold text-slate-800 uppercase">{selectedOrder.driverName}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-dotted border-slate-200 pb-1">
                                            <span className="text-slate-500">Plat Nomor</span>
                                            <span className="font-black text-slate-800 tracking-wider uppercase border border-slate-800 px-1 rounded bg-amber-100">{selectedOrder.licensePlate}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-dotted border-slate-200 pb-1">
                                            <span className="text-slate-500">Ref PO</span>
                                            <span className="font-bold text-slate-800">{selectedOrder.refPONumber || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-3 border-t border-slate-200 pt-3">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Catatan</h3>
                                    <p className="text-sm text-slate-600 italic leading-relaxed">
                                        "{selectedOrder.notes || 'Harap diterima dengan baik.'}"
                                    </p>
                                </div>
                            </div>

                            {/* TABLE */}
                            <div className="flex-1 mb-8">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-[#0f172a] text-white">
                                            <th className="py-3 px-4 text-center w-12 font-bold">#</th>
                                            <th className="py-3 px-4 text-left font-bold w-[40%]">Nama Barang</th>
                                            <th className="py-3 px-4 text-left font-bold w-[25%]">Spesifikasi / Varian</th>
                                            <th className="py-3 px-4 text-center w-20 font-bold">Qty</th>
                                            <th className="py-3 px-4 text-left font-bold w-[20%]">Keterangan</th>
                                            <th className="py-3 px-4 text-center w-24 font-bold border-l border-slate-600">Cek Fisik</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 border-b border-slate-200">
                                        {selectedOrder.items.map((item, idx) => (
                                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                <td className="py-3 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                                                <td className="py-3 px-4 font-bold text-slate-800">{item.name}</td>
                                                <td className="py-3 px-4 text-slate-600">{item.specification}</td>
                                                <td className="py-3 px-4 text-center font-bold text-slate-900 text-lg">{item.quantity} {item.unit && <span className="text-xs font-normal text-slate-500 ml-1">{item.unit}</span>}</td>
                                                <td className="py-3 px-4 text-slate-500 text-xs italic">{item.notes}</td>
                                                <td className="py-3 px-4 text-center border-l border-slate-200">
                                                    <div className="w-5 h-5 border-2 border-slate-300 rounded mx-auto"></div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* FOOTER */}
                            <div className="mt-auto pt-6 border-t-2 border-slate-200 flex items-start justify-between">
                                <div className="flex gap-6 w-full justify-between px-8">
                                    <div className="w-40 text-center">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">Hormat Kami (Admin)</p>
                                        <div className="h-20 flex items-end justify-center relative">
                                            {/* Tanda Tangan */}
                                            <img src={TTD_URL} className="absolute bottom-0 left-1/2 transform -translate-x-1/2 h-20 opacity-80 z-10" alt="TTD"/>
                                            {/* Stempel */}
                                            <img src={STEMPEL_URL} className="absolute bottom-[-5px] left-1/2 transform -translate-x-1/2 h-24 opacity-60 mix-blend-multiply rotate-[-6deg] z-0" alt="Stempel"/>
                                        </div>
                                        <div className="border-t border-slate-400 pt-2 relative z-20">
                                            <p className="font-bold text-xs uppercase text-slate-800">{selectedOrder.warehouseStaff || 'Admin Gudang'}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="w-40 text-center">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">Sopir / Driver</p>
                                        <div className="h-20 flex items-end justify-center">
                                        </div>
                                        <div className="border-t border-slate-400 pt-2">
                                            <p className="font-bold text-xs uppercase text-slate-800">{selectedOrder.driverName}</p>
                                        </div>
                                    </div>

                                    <div className="w-40 text-center">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">Penerima</p>
                                        <div className="h-20 flex items-end justify-center">
                                            <p className="text-[10px] text-slate-300 mb-2">Tanda Tangan & Stempel</p>
                                        </div>
                                        <div className="border-t border-slate-400 pt-2">
                                            <p className="font-bold text-xs uppercase text-slate-800">( ........................... )</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 text-center text-[10px] text-slate-400 italic">
                                Dokumen ini adalah bukti serah terima barang yang sah. Harap diperiksa kondisi barang saat diterima.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryOrderHistory;
