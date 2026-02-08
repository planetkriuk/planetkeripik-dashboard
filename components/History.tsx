
import React, { useState, useEffect, useRef } from 'react';
import { getPOs, deletePO, saveAllPOs } from '../services/storage';
import { fetchPOsFromGoogle, deletePOFromGoogle, syncCalendarToCloud } from '../services/googleSheetService';
import { PurchaseOrder, POType, POStatus } from '../types';
import { Search, Printer, Trash2, ArrowUpRight, ArrowDownLeft, ChevronLeft, ChevronRight, FileSpreadsheet, User, Phone, Paperclip, Pencil, Image as ImageIcon, X, Loader2, RefreshCw, BellRing } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import html2canvas from 'html2canvas';

const ITEMS_PER_PAGE = 10;
const LOGO_URL = "https://raw.githubusercontent.com/habibiegl/planetkeripiklogo/f138730adcd58a09fc5cd7ffb9d65a7fa314b96b/Logo%20Planet%20Keripik%20P.png";
const STEMPEL_URL = "https://raw.githubusercontent.com/habibiegl/planetkeripiklogo/f138730adcd58a09fc5cd7ffb9d65a7fa314b96b/Stempel%20Planet%20Keripik.png";
const TTD_URL = "https://raw.githubusercontent.com/habibiegl/planetkeripiklogo/f138730adcd58a09fc5cd7ffb9d65a7fa314b96b/TTD%20Pak%20Misdi.png";

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showAttachment, setShowAttachment] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCalendarSyncing, setIsCalendarSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Responsive Scale State
  const [previewScale, setPreviewScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const localData = getPOs();
    setPos(localData);
    handleSync();
  }, []);

  // Effect untuk menghitung scale preview
  useEffect(() => {
    const handleResize = () => {
       if (containerRef.current && selectedPO) {
          const containerWidth = containerRef.current.offsetWidth;
          // Lebar asli dokumen A4 Landscape = 1123px.
          const targetScale = (containerWidth - 32) / 1123;
          // Cap scale maksimal di 1
          setPreviewScale(Math.min(targetScale, 1)); 
       }
    };
    
    // Panggil saat load dan resize
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedPO]);

  const handleSync = async () => {
      setIsSyncing(true);
      try {
          const result = await fetchPOsFromGoogle();
          if (result.success && result.data) {
              setPos(result.data);
              saveAllPOs(result.data); 
              if (result.data.length > 0) {
                 showToast(`Sinkronisasi Selesai: ${result.data.length} data dimuat.`, 'success');
              }
          } else {
              showToast("Gagal mengambil data Cloud. Menampilkan data lokal.", "info");
          }
      } catch (e) {
          showToast("Kesalahan jaringan saat sinkronisasi.", "error");
      } finally {
          setIsSyncing(false);
      }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus data ini?')) {
      deletePO(id);
      setPos(getPOs());
      if (selectedPO?.id === id) setSelectedPO(null);
      
      showToast('Menghapus dari cloud...', 'info');
      const remoteResult = await deletePOFromGoogle(id);
      
      if (remoteResult.success) {
          showToast('Data terhapus permanen.', 'success');
          handleSync();
      } else {
          showToast('Terhapus lokal. Server gagal merespon.', 'info');
      }
    }
  };

  const handleEdit = (id: string) => navigate(`/edit/${id}`);

  const filteredPOs = pos.filter(po => {
    const matchesSearch = po.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          po.poNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'ALL' || 
                        (filterType === 'IN' && po.type === POType.INCOMING) ||
                        (filterType === 'OUT' && po.type === POType.OUTGOING);
    return matchesSearch && matchesType;
  });

  const totalPages = Math.ceil(filteredPOs.length / ITEMS_PER_PAGE);
  const paginatedPOs = filteredPOs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePrint = () => window.print();

  // --- LOGIKA SIMPAN GAMBAR (DIPERBAIKI UNTUK MENGHINDARI POTONGAN) ---
  const handleSaveImage = async () => {
    const originalElement = document.getElementById('po-print-area');
    if (!originalElement) return;
    
    setIsGeneratingImage(true);

    // 1. Buat Container Terisolasi di Luar Layar
    const cloneContainer = document.createElement('div');
    cloneContainer.style.position = 'absolute';
    cloneContainer.style.top = '-10000px';
    cloneContainer.style.left = '-10000px';
    // Set lebar tetap A4 Landscape, tapi biarkan tinggi AUTO (grow)
    cloneContainer.style.width = '1123px'; 
    cloneContainer.style.zIndex = '-9999';
    cloneContainer.style.backgroundColor = '#ffffff';
    document.body.appendChild(cloneContainer);

    try {
        // 2. Clone Elemen
        const clonedElement = originalElement.cloneNode(true) as HTMLElement;
        
        // 3. Reset Transformasi & Paksa Ukuran Penuh
        clonedElement.style.transform = 'none';
        clonedElement.style.margin = '0';
        clonedElement.style.width = '1123px'; 
        // PENTING: Jangan set height fix! Gunakan min-height A4, tapi biarkan auto agar footer turun ke bawah
        clonedElement.style.minHeight = '794px'; 
        clonedElement.style.height = 'auto'; 
        clonedElement.style.padding = '15mm';
        clonedElement.style.boxShadow = 'none';
        clonedElement.style.border = 'none';
        clonedElement.style.whiteSpace = 'normal'; 
        
        cloneContainer.appendChild(clonedElement);

        // 4. Tunggu Render Browser sebentar
        await new Promise(resolve => setTimeout(resolve, 500));

        // 5. Hitung tinggi konten sesungguhnya + Buffer yang cukup besar
        // Menggunakan offsetHeight kadang lebih akurat termasuk border/padding
        const contentHeight = clonedElement.scrollHeight; 

        // 6. Capture dengan tinggi dinamis
        const canvas = await html2canvas(clonedElement, { 
            scale: 2, // High Quality
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            width: 1123,
            height: contentHeight + 100, // Buffer 100px di bawah
            windowWidth: 1123,
            windowHeight: contentHeight + 200, // Window virtual lebih tinggi
            scrollY: 0,
            scrollX: 0
        });
        
        // 7. Download
        const image = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = image;
        link.download = `PO-${selectedPO?.poNumber || 'Dokumen'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Gambar HD tersimpan sempurna!', 'success');

    } catch (err) {
        console.error("Image Gen Error:", err);
        showToast('Gagal menyimpan gambar.', 'error');
    } finally {
        // Bersihkan DOM
        if (document.body.contains(cloneContainer)) {
            document.body.removeChild(cloneContainer);
        }
        setIsGeneratingImage(false);
    }
  };

  const handleAddToCalendar = async () => {
    if (!selectedPO) return;
    
    // Validasi Tanggal Kirim
    if (!selectedPO.shippingDate) {
        showToast("Tanggal pengiriman (Shipping Date) wajib diisi untuk Alarm.", "error");
        return;
    }

    setIsCalendarSyncing(true);
    showToast("Mengirim perintah Auto-Alarm ke Cloud...", "info");

    try {
        const result = await syncCalendarToCloud(selectedPO);
        
        if (result.success) {
            showToast(result.message, "success");
        } else {
            showToast(`Gagal: ${result.message}`, "error");
        }
    } catch (error) {
        console.error(error);
        showToast("Kesalahan koneksi saat sinkronisasi kalender.", "error");
    } finally {
        setIsCalendarSyncing(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredPOs.length === 0) return;
    const headers = ["No PO", "Tipe", "Pelanggan", "Tanggal", "Total", "Status"];
    const rows = filteredPOs.map(po => [
      po.poNumber, po.type, `"${po.customerName}"`, po.dateCreated, po.grandTotal, po.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_PO_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: POStatus) => {
    let classes = '';
    switch(status) {
      case POStatus.APPROVED: classes = 'bg-blue-100 text-blue-700 border border-blue-200'; break;
      case POStatus.COMPLETED: classes = 'bg-emerald-100 text-emerald-700 border border-emerald-200'; break;
      case POStatus.PENDING: classes = 'bg-amber-100 text-amber-700 border border-amber-200'; break;
      case POStatus.DRAFT: classes = 'bg-slate-100 text-slate-600 border border-slate-200'; break;
      case POStatus.CANCELLED: classes = 'bg-red-50 text-red-600 border border-red-100'; break;
      default: classes = 'bg-slate-100 text-slate-600';
    }
    return <span className={`inline-flex items-center justify-center px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest whitespace-nowrap min-w-[80px] h-6 ${classes}`}>{status}</span>;
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Top Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Riwayat PO</h2>
            {isSyncing && <Loader2 size={16} className="animate-spin text-blue-500"/>}
          </div>
          <p className="text-slate-500 text-sm mt-1">Kelola arsip dokumen masuk dan keluar.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
           <button onClick={handleSync} disabled={isSyncing} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 font-medium disabled:opacity-70 text-sm">
            <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} /> 
            <span className="">Refresh</span>
           </button>
           <button onClick={handleExportCSV} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200 font-medium text-sm">
            <FileSpreadsheet size={18} /> <span className="">CSV</span>
          </button>
          
          <div className="relative group flex-1 sm:flex-none">
            <Search className="absolute left-3 top-3 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={18} />
            <input type="text" placeholder="Cari PO / Nama..." className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm text-sm"
              value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
          <select className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm text-sm"
              value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}>
              <option value="ALL">Semua Tipe</option>
              <option value="IN">PO Masuk</option>
              <option value="OUT">PO Keluar</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* LIST SECTION */}
        <div className={`bg-white md:rounded-2xl md:shadow-sm md:border md:border-slate-200 overflow-hidden flex flex-col no-print transition-all duration-300 ${selectedPO ? 'hidden lg:flex lg:w-1/3' : 'w-full'}`}>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50/80 text-slate-500 font-bold sticky top-0 z-10 border-b border-slate-200 backdrop-blur-sm">
                        <tr>
                            <th className="px-5 py-4 w-1/3">PO Detail</th>
                            {(!selectedPO || window.innerWidth > 1024) && (
                                <th className="px-5 py-4 hidden sm:table-cell">Customer</th>
                            )}
                            <th className="px-5 py-4 text-right">Info</th>
                            <th className="px-4 py-4 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedPOs.map(po => (
                            <tr key={po.id} className={`hover:bg-amber-50/50 cursor-pointer transition-colors ${selectedPO?.id === po.id ? 'bg-amber-50 border-l-4 border-l-amber-500' : 'border-l-4 border-l-transparent'}`} onClick={() => setSelectedPO(po)}>
                                <td className="px-5 py-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                            {po.type === POType.INCOMING ? <ArrowDownLeft size={16} className="text-blue-500"/> : <ArrowUpRight size={16} className="text-emerald-500"/>}
                                            {po.poNumber}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-semibold">{po.dateCreated}</span>
                                        {/* Mobile Only Customer Name */}
                                        <span className="sm:hidden text-xs font-medium text-slate-600 truncate max-w-[120px]">{po.customerName}</span>
                                    </div>
                                </td>
                                {(!selectedPO || window.innerWidth > 1024) && (
                                    <td className="px-5 py-4 text-slate-700 hidden sm:table-cell align-top font-medium">
                                        {po.customerName}
                                        <div className="mt-1">{getStatusBadge(po.status)}</div>
                                    </td>
                                )}
                                <td className="px-5 py-4 text-right align-top">
                                    <div className="font-bold text-slate-700 text-xs sm:text-sm">Rp {po.grandTotal.toLocaleString('id-ID', {notation:'compact'})}</div>
                                    <div className="sm:hidden mt-1 justify-end flex">{getStatusBadge(po.status)}</div>
                                </td>
                                <td className="px-4 py-4 text-center">
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(po.id); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {paginatedPOs.length === 0 && (
                    <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                        <FileSpreadsheet size={48} className="mb-2 opacity-20"/>
                        <p className="text-sm">Tidak ada data ditemukan.</p>
                    </div>
                )}
            </div>
             {filteredPOs.length > 0 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-[10px] font-bold text-slate-400">{currentPage} / {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={16} /></button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>

        {/* PREVIEW SECTION */}
        {selectedPO && (
          <div className="fixed inset-0 z-50 bg-slate-100/90 backdrop-blur-md lg:static lg:bg-transparent lg:backdrop-blur-none flex flex-col lg:flex-row lg:w-2/3 h-full animate-fade-in overflow-hidden">
             
             {/* Mobile Header for Preview */}
             <div className="lg:hidden bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between shadow-sm z-50 shrink-0">
               <button onClick={() => setSelectedPO(null)} className="flex items-center gap-2 text-slate-600 font-bold text-sm"><ChevronLeft size={20} /> Kembali</button>
               <span className="font-bold text-slate-800 text-sm truncate max-w-[150px]">{selectedPO.poNumber}</span>
            </div>

            <div className="flex-1 flex flex-col gap-4 h-full overflow-hidden w-full max-w-7xl mx-auto lg:max-w-none">
                {/* Action Bar */}
                <div className="bg-white p-3 rounded-none lg:rounded-xl shadow-sm border-b lg:border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print shrink-0">
                   <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                      <button onClick={() => handleEdit(selectedPO.id)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-2 whitespace-nowrap"><Pencil size={14}/> Edit</button>
                      {selectedPO.type === POType.OUTGOING && (
                          <button 
                            onClick={handleAddToCalendar} 
                            disabled={isCalendarSyncing}
                            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 text-white shadow-sm shadow-blue-200 whitespace-nowrap ${isCalendarSyncing ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                          >
                              {isCalendarSyncing ? <Loader2 size={14} className="animate-spin"/> : <BellRing size={14} fill="currentColor"/>} 
                              {isCalendarSyncing ? 'Syncing...' : 'Auto Alarm'}
                          </button>
                      )}
                      {selectedPO.attachment && (
                        <button onClick={() => setShowAttachment(!showAttachment)} className="px-3 py-2 bg-amber-100 hover:bg-amber-200 rounded-lg text-xs font-bold text-amber-700 flex items-center gap-2 whitespace-nowrap">
                            <Paperclip size={14}/> {showAttachment ? 'Lihat Surat' : 'Lampiran'}
                        </button>
                      )}
                   </div>
                   <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={handleSaveImage} disabled={isGeneratingImage} className="flex-1 sm:flex-none justify-center px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm shadow-emerald-200 whitespace-nowrap">
                          {isGeneratingImage ? <Loader2 size={14} className="animate-spin"/> : <ImageIcon size={14}/>} Simpan HD
                      </button>
                      <button onClick={handlePrint} className="flex-1 sm:flex-none justify-center px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm whitespace-nowrap">
                          <Printer size={14}/> Print
                      </button>
                      <button onClick={() => setSelectedPO(null)} className="hidden lg:block p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
                   </div>
                </div>

                {/* Preview Container */}
                <div ref={containerRef} className="flex-1 bg-slate-200/50 overflow-auto w-full relative flex flex-col items-center p-4 lg:p-8">
                    {showAttachment && selectedPO.attachment ? (
                        <div className="bg-white w-full max-w-xl p-2 shadow-xl mx-auto rounded-lg">
                            <img src={selectedPO.attachment} alt="Lampiran" className="w-full h-auto rounded" />
                        </div>
                    ) : (
                        // RESPONSIVE WRAPPER FOR A4
                        <div 
                           className="transition-transform duration-300 origin-top-left"
                           style={{ 
                             transform: `scale(${previewScale})`,
                             width: '1123px', // Fixed A4 Landscape Width
                             height: 'auto', // Biarkan auto agar tidak terpotong saat preview normal
                             minHeight: '794px',
                             marginBottom: `${(794 * previewScale) - 794}px`, 
                             marginRight: `${(1123 * previewScale) - 1123}px` 
                           }}
                        >
                            <div 
                              id="po-print-area" 
                              className="bg-white shadow-2xl print:shadow-none text-slate-900 relative flex flex-col text-sm box-border"
                              style={{ width: '1123px', minHeight: '794px', padding: '15mm', boxSizing: 'border-box' }}
                            >
                                {/* HEADER SECTION */}
                                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6 mb-8">
                                    {/* Left: Logo & Company Info */}
                                    {/* LOGIKA KOP SURAT: HANYA MUNCUL JIKA PO KELUAR */}
                                    <div className="flex items-center gap-5 w-[40%]">
                                        {selectedPO.type === POType.OUTGOING ? (
                                            <>
                                                <img src={LOGO_URL} alt="Logo" className="h-20 w-auto object-contain shrink-0" />
                                                <div className="flex flex-col">
                                                    <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">
                                                        Planet Keripik
                                                    </h1>
                                                    <p className="text-sm font-semibold text-slate-600 leading-tight">
                                                        Jl. Tempean Utara Gang 1, RT.4/RW.6 Madyorenggo<br/>
                                                        Talok, Kec. Turen, Kabupaten Malang, Jawa Timur 65175
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            /* JIKA PO MASUK, TAMPILKAN NAMA VENDOR SEBAGAI HEADER (DOKUMEN EKSTERNAL) */
                                            <div className="flex flex-col">
                                                <h1 className="text-sm font-bold text-slate-400 tracking-widest uppercase mb-1">
                                                    DARI (PENGIRIM):
                                                </h1>
                                                <h2 className="text-2xl font-black text-slate-800 leading-none mb-2">
                                                    {selectedPO.customerName}
                                                </h2>
                                                <p className="text-sm text-slate-600 leading-tight max-w-sm">
                                                    {selectedPO.address}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Center: Document Title */}
                                    <div className="flex flex-col items-center justify-center pt-2">
                                        <h2 className="text-4xl font-extrabold text-slate-900 uppercase tracking-tighter leading-none mb-2">
                                            PURCHASE<br/>ORDER
                                        </h2>
                                        <div className="flex gap-2">
                                            <span className="bg-slate-900 text-white text-[10px] font-bold px-3 py-1 uppercase tracking-widest rounded-sm">
                                                {selectedPO.type === POType.INCOMING ? 'Dokumen Masuk' : 'Dokumen Keluar'}
                                            </span>
                                            <span className="border border-slate-300 text-slate-500 text-[10px] font-bold px-3 py-1 uppercase tracking-widest rounded-sm">
                                                {selectedPO.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Right: Meta Data */}
                                    <div className="w-[25%] flex flex-col items-end text-right pt-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nomor PO</span>
                                        <span className="text-xl font-bold text-slate-900 font-mono mb-3">{selectedPO.poNumber}</span>
                                        
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tanggal</span>
                                        <span className="text-lg font-medium text-slate-800">{new Date(selectedPO.dateCreated).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</span>
                                    </div>
                                </div>

                                {/* INFO GRID SECTION */}
                                <div className="grid grid-cols-12 gap-8 mb-8">
                                    {/* Column 1: Recipient/Vendor */}
                                    <div className="col-span-4 border-t border-slate-200 pt-3">
                                        {/* LOGIKA PENERIMA/TUJUAN */}
                                        {selectedPO.type === POType.OUTGOING ? (
                                            <>
                                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                                                    Kepada Yth. (Customer)
                                                </h3>
                                                <p className="font-bold text-xl text-slate-900 mb-2">{selectedPO.customerName}</p>
                                                <p className="text-sm text-slate-600 leading-relaxed mb-3">{selectedPO.address}</p>
                                                {(selectedPO.contactName || selectedPO.contactPhone) && (
                                                    <div className="flex items-center gap-3 text-sm text-slate-500 bg-slate-50 p-2 rounded w-fit">
                                                        <div className="flex items-center gap-1.5"><User size={14}/> {selectedPO.contactName || '-'}</div>
                                                        <div className="h-3 w-[1px] bg-slate-300"></div>
                                                        <div className="flex items-center gap-1.5"><Phone size={14}/> {selectedPO.contactPhone || '-'}</div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            /* JIKA PO MASUK, MAKA PENERIMANYA ADALAH PLANET KERIPIK */
                                            <>
                                                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                                                    Kepada / Tujuan
                                                </h3>
                                                <p className="font-bold text-xl text-slate-900 mb-2">PT. PLANET KERIPIK</p>
                                                <p className="text-sm text-slate-600 leading-relaxed mb-3">
                                                    Jl. Tempean Utara Gang 1, RT.4/RW.6 Madyorenggo<br/>
                                                    Talok, Kec. Turen, Kabupaten Malang
                                                </p>
                                                <div className="flex items-center gap-3 text-sm text-slate-500 bg-slate-50 p-2 rounded w-fit">
                                                    <div className="flex items-center gap-1.5"><User size={14}/> Admin Gudang</div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Column 2: Schedule */}
                                    <div className="col-span-4 border-t border-slate-200 pt-3">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Detail Jadwal</h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between border-b border-dotted border-slate-200 pb-1">
                                                <span className="text-slate-500 text-sm">Tgl Dokumen</span>
                                                <span className="font-bold text-slate-800 text-sm">{selectedPO.dateCreated}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-dotted border-slate-200 pb-1">
                                                <span className="text-slate-500 text-sm">{selectedPO.type === POType.INCOMING ? 'Tgl Pengiriman' : 'Tgl Pengiriman'}</span>
                                                <span className="font-bold text-amber-600 text-sm">{selectedPO.shippingDate || selectedPO.deadline || '-'}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-dotted border-slate-200 pb-1">
                                                <span className="text-slate-500 text-sm">Pembayaran</span>
                                                <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">{selectedPO.paymentTerms || 'COD'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 3: Internal Note */}
                                    <div className="col-span-4">
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 h-full relative">
                                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Internal Note</h3>
                                            <p className="text-sm italic text-slate-700 mb-6">"{selectedPO.notes || 'Tidak ada catatan khusus.'}"</p>
                                            
                                            {selectedPO.type === POType.OUTGOING && (
                                                <div className="absolute bottom-4 left-4 text-[10px] text-slate-400 leading-tight">
                                                    <p className="font-bold text-slate-600 uppercase">PT. PLANET KERIPIK</p>
                                                    <p>Jl. Tempean Utara Gang 1</p>
                                                    <p>Malang, Jawa Timur</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* ITEMS TABLE */}
                                <div className="flex-1 mb-8">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-[#0f172a] text-white">
                                                <th className="py-3 px-4 text-center w-12 font-bold border-r border-slate-700">#</th>
                                                <th className="py-3 px-4 text-left font-bold border-r border-slate-700">Deskripsi Barang</th>
                                                <th className="py-3 px-4 text-left w-1/4 font-bold border-r border-slate-700">Spesifikasi</th>
                                                <th className="py-3 px-4 text-center w-28 font-bold border-r border-slate-700">Qty</th>
                                                <th className="py-3 px-4 text-right w-32 font-bold border-r border-slate-700">Harga Satuan</th>
                                                <th className="py-3 px-4 text-right w-40 font-bold">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 border-b border-slate-200">
                                            {selectedPO.items.map((item, idx) => (
                                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                    <td className="py-4 px-4 text-center font-bold text-slate-500">{idx + 1}</td>
                                                    <td className="py-4 px-4 font-bold text-slate-800">{item.name}</td>
                                                    <td className="py-4 px-4 text-slate-600">{item.specification}</td>
                                                    <td className="py-4 px-4 text-center font-bold text-slate-900">
                                                        {item.quantity} <span className="text-xs font-normal text-slate-500 ml-1">{item.unit || 'Pcs'}</span>
                                                    </td>
                                                    <td className="py-4 px-4 text-right text-slate-600">{item.unitPrice.toLocaleString('id-ID')}</td>
                                                    <td className="py-4 px-4 text-right font-bold text-slate-900">{item.totalPrice.toLocaleString('id-ID')}</td>
                                                </tr>
                                            ))}
                                            {/* Empty rows filler if less than 5 items */}
                                            {[...Array(Math.max(0, 5 - selectedPO.items.length))].map((_, idx) => (
                                                <tr key={`empty-${idx}`} className="bg-white h-12">
                                                    <td colSpan={6}></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* FOOTER SECTION */}
                                <div className="mt-auto pt-6 border-t-2 border-slate-200 flex items-start justify-between">
                                    
                                    {/* Signatures */}
                                    <div className="flex gap-10">
                                        <div className="w-32 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">DIBUAT</p>
                                            <div className="h-16 flex items-end justify-center relative">
                                                {/* PO Keluar: Dibuat oleh Admin Kita (Ada TTD) */}
                                                {selectedPO.type === POType.OUTGOING && (
                                                    <img src={TTD_URL} className="absolute bottom-0 h-16 opacity-80" alt="TTD"/>
                                                )}
                                                {/* PO Masuk: Dibuat oleh Vendor (Kosong/Text) */}
                                            </div>
                                            <div className="border-t border-slate-400 pt-2">
                                                <p className="font-bold text-xs uppercase text-slate-800">{selectedPO.type === POType.INCOMING ? selectedPO.customerName.substring(0, 15) : (selectedPO.createdBy || 'ADMIN')}</p>
                                            </div>
                                        </div>

                                        <div className="w-32 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">DISETUJUI</p>
                                            <div className="h-16 flex items-end justify-center relative">
                                                 {/* PO Keluar: Disetujui oleh Manager Kita (Ada TTD + Stempel) */}
                                                {selectedPO.type === POType.OUTGOING && (
                                                    <>
                                                        <img src={TTD_URL} className="absolute bottom-0 h-16 opacity-80" alt="TTD"/>
                                                        <img src={STEMPEL_URL} className="absolute bottom-[-10px] h-24 opacity-60 mix-blend-multiply rotate-[-10deg]" alt="Stempel"/>
                                                    </>
                                                )}
                                                {/* PO Masuk: Disetujui oleh Manager Vendor (Kosong/Text) */}
                                            </div>
                                            <div className="border-t border-slate-400 pt-2">
                                                <p className="font-bold text-xs uppercase text-slate-800">{selectedPO.type === POType.INCOMING ? '-' : (selectedPO.approvedBy || 'MANAGER')}</p>
                                            </div>
                                        </div>

                                        <div className="w-32 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">DITERIMA</p>
                                            <div className="h-16 flex items-end justify-center relative">
                                                {/* PO Keluar: Diterima oleh Customer (Kosong untuk TTD mereka) */}
                                                
                                                {/* PO Masuk: Diterima oleh Kita (Ada TTD + Stempel Kita) */}
                                                {selectedPO.type === POType.INCOMING && (
                                                    <>
                                                        <img src={TTD_URL} className="absolute bottom-0 h-16 opacity-80" alt="TTD"/>
                                                        <img src={STEMPEL_URL} className="absolute bottom-[-10px] h-24 opacity-60 mix-blend-multiply rotate-[-10deg]" alt="Stempel"/>
                                                    </>
                                                )}
                                            </div>
                                            <div className="border-t border-slate-400 pt-2">
                                                <p className="font-bold text-xs uppercase text-slate-800">{selectedPO.receivedBy || (selectedPO.type === POType.INCOMING ? 'PT. PLANET KERIPIK' : 'PENERIMA')}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Financial Totals */}
                                    <div className="w-[350px] bg-slate-50 rounded-xl p-5 border border-slate-200">
                                        <div className="flex justify-between items-center mb-3 text-sm text-slate-600">
                                            <span className="font-medium">Subtotal</span>
                                            <span className="font-bold text-slate-800">Rp {selectedPO.subTotal ? selectedPO.subTotal.toLocaleString('id-ID') : '-'}</span>
                                        </div>
                                        {(selectedPO.tax || 0) > 0 && (
                                            <div className="flex justify-between items-center mb-3 text-sm text-slate-600">
                                                <span className="font-medium">Pajak (PPN)</span>
                                                <span className="font-bold text-slate-800">{selectedPO.tax.toLocaleString('id-ID')}</span>
                                            </div>
                                        )}
                                        <div className="border-t border-slate-300 my-3"></div>
                                        <div className="flex justify-between items-center">
                                            <span className="font-black text-slate-900 text-lg uppercase">TOTAL AKHIR</span>
                                            <span className="font-black text-3xl text-slate-900">Rp {selectedPO.grandTotal.toLocaleString('id-ID')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
