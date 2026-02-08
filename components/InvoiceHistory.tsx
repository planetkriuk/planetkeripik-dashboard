
import React, { useState, useEffect, useRef } from 'react';
import { getInvoices, deleteInvoice, saveInvoice } from '../services/storage';
import { fetchInvoicesFromGoogle, deleteInvoiceFromGoogle } from '../services/googleSheetService';
import { Invoice, InvoiceStatus } from '../types';
import { Search, Printer, Trash2, ChevronLeft, ChevronRight, FileText, Pencil, Image as ImageIcon, X, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import html2canvas from 'html2canvas';

const ITEMS_PER_PAGE = 10;
const LOGO_URL = "https://raw.githubusercontent.com/habibiegl/planetkeripiklogo/f138730adcd58a09fc5cd7ffb9d65a7fa314b96b/Logo%20Planet%20Keripik%20P.png";
const STEMPEL_URL = "https://raw.githubusercontent.com/habibiegl/planetkeripiklogo/f138730adcd58a09fc5cd7ffb9d65a7fa314b96b/Stempel%20Planet%20Keripik.png";
const TTD_URL = "https://raw.githubusercontent.com/habibiegl/planetkeripiklogo/f138730adcd58a09fc5cd7ffb9d65a7fa314b96b/TTD%20Pak%20Misdi.png";

export const InvoiceHistory: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewScale, setPreviewScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load local first
    const local = getInvoices();
    setInvoices(local);
    // Sync Cloud
    handleSync();
  }, []);

  useEffect(() => {
    const handleResize = () => {
       if (containerRef.current && selectedInvoice) {
          const containerWidth = containerRef.current.offsetWidth;
          // Invoice Portrait width logic (A4 Portrait is approx 794px at 96dpi)
          const targetScale = (containerWidth - 32) / 794;
          setPreviewScale(Math.min(targetScale, 1)); 
       }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedInvoice]);

  const handleSync = async () => {
      setIsSyncing(true);
      try {
          const result = await fetchInvoicesFromGoogle();
          if (result.success && result.data) {
              setInvoices(result.data);
              // Save to local storage to keep them in sync
              result.data.forEach(inv => saveInvoice(inv));
              if (result.data.length > 0) {
                 showToast(`Sync Invoice: ${result.data.length} data dimuat.`, 'success');
              }
          } else {
              showToast("Gagal mengambil data Invoice dari Cloud.", "info");
          }
      } catch (e) {
          showToast("Gagal sinkronisasi.", "error");
      } finally {
          setIsSyncing(false);
      }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Hapus invoice ini selamanya?')) {
      deleteInvoice(id);
      setInvoices(getInvoices());
      if (selectedInvoice?.id === id) setSelectedInvoice(null);
      
      showToast('Menghapus dari cloud...', 'info');
      const res = await deleteInvoiceFromGoogle(id);
      if (res.success) {
          showToast('Invoice terhapus permanen.', 'success');
          handleSync();
      } else {
          showToast('Terhapus lokal. Server gagal merespon.', 'warning');
      }
    }
  };

  const handleEdit = (id: string) => navigate(`/invoice/edit/${id}`);
  const handlePrint = () => window.print();

  const handleSaveImage = async () => {
    const originalElement = document.getElementById('inv-print-area');
    if (!originalElement) return;
    setIsGeneratingImage(true);
    const cloneContainer = document.createElement('div');
    cloneContainer.style.position = 'absolute';
    cloneContainer.style.top = '-10000px';
    cloneContainer.style.left = '-10000px';
    cloneContainer.style.width = '794px'; // A4 Portrait Width
    cloneContainer.style.zIndex = '-9999';
    cloneContainer.style.backgroundColor = '#ffffff';
    document.body.appendChild(cloneContainer);

    try {
        const clonedElement = originalElement.cloneNode(true) as HTMLElement;
        clonedElement.style.transform = 'none';
        clonedElement.style.margin = '0';
        clonedElement.style.width = '794px'; 
        clonedElement.style.minHeight = '1123px'; // A4 Portrait Height
        clonedElement.style.height = 'auto'; 
        clonedElement.style.padding = '10mm'; // Slightly reduced padding for receipt look
        cloneContainer.appendChild(clonedElement);
        await new Promise(resolve => setTimeout(resolve, 500));
        const contentHeight = clonedElement.scrollHeight; 
        const canvas = await html2canvas(clonedElement, { 
            scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
            width: 794, height: contentHeight + 50, windowWidth: 794, windowHeight: contentHeight + 100
        });
        const image = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = image;
        link.download = `INV-${selectedInvoice?.invoiceNumber.replace(/\//g,'-')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Invoice disimpan!', 'success');
    } catch (err) {
        showToast('Gagal menyimpan gambar.', 'error');
    } finally {
        if (document.body.contains(cloneContainer)) document.body.removeChild(cloneContainer);
        setIsGeneratingImage(false);
    }
  };

  const filtered = invoices.filter(inv => 
    inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const getStatusBadge = (status: InvoiceStatus) => {
    let classes = '';
    switch(status) {
      case InvoiceStatus.PAID: classes = 'bg-emerald-100 text-emerald-700 border border-emerald-200'; break;
      case InvoiceStatus.PARTIAL: classes = 'bg-blue-100 text-blue-700 border border-blue-200'; break;
      case InvoiceStatus.OVERDUE: classes = 'bg-red-50 text-red-600 border border-red-100'; break;
      default: classes = 'bg-amber-100 text-amber-700 border border-amber-200';
    }
    return <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${classes}`}>{status}</span>;
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-3">
             <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Riwayat Invoice</h2>
             {isSyncing && <Loader2 size={16} className="animate-spin text-violet-500"/>}
          </div>
          <p className="text-slate-500 text-sm mt-1">Daftar tagihan keluar kepada pelanggan.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleSync} disabled={isSyncing} className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors shadow-sm font-bold text-sm disabled:opacity-70">
            <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} /> 
            <span className="hidden sm:inline">Refresh</span>
           </button>
          <button onClick={() => navigate('/invoice/create')} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm shadow-violet-200">
             + Buat Invoice
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input type="text" placeholder="Cari..." className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* LIST */}
        <div className={`bg-white md:rounded-2xl md:shadow-sm md:border md:border-slate-200 overflow-hidden flex flex-col no-print transition-all duration-300 ${selectedInvoice ? 'hidden lg:flex lg:w-1/3' : 'w-full'}`}>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50/80 text-slate-500 font-bold sticky top-0 z-10 border-b border-slate-200 backdrop-blur-sm">
                        <tr>
                            <th className="px-5 py-4 w-1/3">Detail</th>
                            {(!selectedInvoice || window.innerWidth > 1024) && <th className="px-5 py-4">Status</th>}
                            <th className="px-5 py-4 text-right">Tagihan</th>
                            <th className="px-4 py-4 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginated.map(inv => (
                            <tr key={inv.id} className={`hover:bg-violet-50 cursor-pointer ${selectedInvoice?.id === inv.id ? 'bg-violet-50 border-l-4 border-l-violet-500' : ''}`} onClick={() => setSelectedInvoice(inv)}>
                                <td className="px-5 py-4">
                                    <div className="font-bold text-slate-800 text-xs">{inv.invoiceNumber}</div>
                                    <div className="text-[10px] text-slate-500 font-medium">{inv.customerName}</div>
                                    <div className="text-[10px] text-slate-400">{inv.dateCreated}</div>
                                </td>
                                {(!selectedInvoice || window.innerWidth > 1024) && (
                                    <td className="px-5 py-4">{getStatusBadge(inv.status)}</td>
                                )}
                                <td className="px-5 py-4 text-right">
                                    <div className="font-bold text-slate-700 text-xs">
                                        Rp {inv.grandTotal.toLocaleString('id-ID', {notation:'compact'})}
                                    </div>
                                    {/* Jika Partial atau Unpaid, tampilkan sisa */}
                                    {inv.status !== InvoiceStatus.PAID && inv.status !== InvoiceStatus.DRAFT && (inv.remainingBalance || 0) > 0 && (
                                        <div className="text-[10px] text-red-500 font-bold mt-1">
                                            Sisa: Rp {(inv.remainingBalance || 0).toLocaleString('id-ID', {notation:'compact'})}
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-4 text-center">
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(inv.id); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 bg-slate-100/90 backdrop-blur-md lg:static lg:bg-transparent lg:backdrop-blur-none flex flex-col lg:flex-row lg:w-2/3 h-full animate-fade-in overflow-hidden">
             
             {/* Mobile Header */}
             <div className="lg:hidden bg-white px-4 py-3 border-b border-slate-200 flex items-center justify-between shadow-sm z-50 shrink-0">
               <button onClick={() => setSelectedInvoice(null)} className="flex items-center gap-2 text-slate-600 font-bold text-sm"><ChevronLeft size={20} /> Kembali</button>
            </div>

            <div className="flex-1 flex flex-col gap-4 h-full overflow-hidden w-full max-w-7xl mx-auto lg:max-w-none">
                {/* Actions */}
                <div className="bg-white p-3 rounded-none lg:rounded-xl shadow-sm border-b lg:border border-slate-200 flex items-center justify-between gap-3 no-print shrink-0">
                   <div className="flex gap-2">
                      <button onClick={() => handleEdit(selectedInvoice.id)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-2"><Pencil size={14}/> Edit</button>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={handleSaveImage} disabled={isGeneratingImage} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm shadow-emerald-200">
                          {isGeneratingImage ? <Loader2 size={14} className="animate-spin"/> : <ImageIcon size={14}/>} Simpan
                      </button>
                      <button onClick={handlePrint} className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm">
                          <Printer size={14}/> Print
                      </button>
                      <button onClick={() => setSelectedInvoice(null)} className="hidden lg:block p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
                   </div>
                </div>

                {/* VISUAL INVOICE - PORTRAIT RECEIPT STYLE */}
                <div ref={containerRef} className="flex-1 bg-slate-200/50 overflow-auto w-full relative flex flex-col items-center p-4 lg:p-8">
                    <div 
                        className="transition-transform duration-300 origin-top-left bg-white shadow-2xl print:shadow-none"
                        style={{ 
                            transform: `scale(${previewScale})`,
                            width: '794px', // A4 Portrait Width
                            minHeight: '1123px', // A4 Portrait Height
                            marginBottom: `${(1123 * previewScale) - 1123}px`, 
                            marginRight: `${(794 * previewScale) - 794}px` 
                        }}
                    >
                        <div id="inv-print-area" className="relative flex flex-col text-sm box-border font-sans"
                            style={{ width: '794px', minHeight: '1123px', padding: '40px 50px', boxSizing: 'border-box' }}>
                            
                            {/* HEADER */}
                            <div className="flex flex-col items-center justify-center mb-6">
                                <img src={LOGO_URL} alt="Logo" className="h-20 w-auto object-contain mb-2" />
                                <div className="text-center">
                                    <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">Planet Keripik</h1>
                                    <p className="text-sm font-medium text-slate-500">
                                        No. WA: 082338247777
                                    </p>
                                    <p className="text-sm font-medium text-slate-400">
                                       No: {selectedInvoice.invoiceNumber} | {new Date(selectedInvoice.dateCreated).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}
                                    </p>
                                </div>
                            </div>
                            
                            {/* DIVIDER */}
                            <div className="w-full h-px bg-slate-100 mb-6"></div>

                            {/* STATUS BADGE */}
                            <div className="flex justify-center mb-8">
                                <span className={`px-6 py-2 rounded-full text-base font-bold uppercase tracking-widest ${
                                    selectedInvoice.status === InvoiceStatus.PAID 
                                    ? 'bg-emerald-100 text-emerald-600' 
                                    : selectedInvoice.status === InvoiceStatus.PARTIAL 
                                    ? 'bg-blue-100 text-blue-600'
                                    : 'bg-slate-100 text-slate-500'
                                }`}>
                                    {selectedInvoice.status === InvoiceStatus.PAID ? 'LUNAS' : selectedInvoice.status}
                                </span>
                            </div>

                            {/* CUSTOMER */}
                            <div className="mb-6">
                                <p className="text-sm text-slate-500 mb-1">Keterangan:</p>
                                <h3 className="text-lg font-bold text-slate-800">{selectedInvoice.customerName}</h3>
                                <p className="text-sm text-slate-600">{selectedInvoice.address}</p>
                            </div>

                            {/* ITEMS LIST (Receipt Style) */}
                            <div className="flex-1 mb-6">
                                <div className="space-y-4">
                                    {selectedInvoice.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-start pb-4 border-b border-dashed border-slate-200">
                                            <div className="pr-4">
                                                <p className="font-bold text-slate-800 text-base mb-1">{item.name}</p>
                                                <p className="text-sm text-slate-500 font-medium">
                                                    {item.quantity} {item.unit} x @{item.unitPrice.toLocaleString('id-ID')}
                                                </p>
                                                {item.specification && <p className="text-xs text-slate-400 mt-0.5">{item.specification}</p>}
                                            </div>
                                            <div className="text-right whitespace-nowrap">
                                                <p className="font-bold text-slate-800 text-base">{item.totalPrice.toLocaleString('id-ID')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* FINANCIAL SUMMARY */}
                            <div className="mb-8">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-slate-500">Subtotal</span>
                                    <span className="font-bold text-slate-800 text-right">
                                        {selectedInvoice.subTotal.toLocaleString('id-ID')}
                                    </span>
                                </div>
                                {selectedInvoice.discount > 0 && (
                                     <div className="flex justify-between items-center mb-2">
                                        <span className="text-red-500">Diskon</span>
                                        <span className="font-bold text-red-500 text-right">
                                            - {selectedInvoice.discount.toLocaleString('id-ID')}
                                        </span>
                                    </div>
                                )}
                                {selectedInvoice.tax > 0 && (
                                     <div className="flex justify-between items-center mb-4">
                                        <span className="text-slate-500">Pajak (PPN)</span>
                                        <span className="font-bold text-slate-800 text-right">
                                            {selectedInvoice.tax.toLocaleString('id-ID')}
                                        </span>
                                    </div>
                                )}

                                {/* TOTAL BAR */}
                                <div className="bg-slate-100 rounded-lg p-4 flex justify-between items-center mt-2">
                                    <span className="font-bold text-slate-800 text-lg">Total ({selectedInvoice.items.length} Produk)</span>
                                    <span className="font-black text-slate-900 text-2xl">{selectedInvoice.grandTotal.toLocaleString('id-ID')}</span>
                                </div>
                                
                                {/* PAYMENT BREAKDOWN */}
                                <div className="mt-4 space-y-2">
                                    {selectedInvoice.paymentDetails && selectedInvoice.paymentDetails.length > 0 ? (
                                        selectedInvoice.paymentDetails.filter(p => p.amount > 0).map((payment, idx) => (
                                            <div key={idx} className="flex justify-between items-center px-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-emerald-600">
                                                        {idx === 0 ? "Uang Muka 1" : `Pembayaran ${idx + 1}`}
                                                    </span>
                                                    {payment.date && <span className="text-[10px] text-emerald-500 font-medium">{new Date(payment.date).toLocaleDateString('id-ID')}</span>}
                                                </div>
                                                <span className="text-sm font-bold text-emerald-600">- {payment.amount.toLocaleString('id-ID')}</span>
                                            </div>
                                        ))
                                    ) : (selectedInvoice.totalPaid || 0) > 0 && selectedInvoice.status !== InvoiceStatus.PAID && (
                                        <div className="flex justify-between items-center px-4">
                                            <span className="text-sm font-bold text-emerald-600">Sudah Dibayar</span>
                                            <span className="text-sm font-bold text-emerald-600">- {(selectedInvoice.totalPaid || 0).toLocaleString('id-ID')}</span>
                                        </div>
                                    )}
                                </div>

                                {(selectedInvoice.remainingBalance || 0) > 0 && (
                                     <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center px-4">
                                        <span className="text-sm font-bold text-red-600 uppercase">Sisa Tagihan</span>
                                        <span className="text-base font-black text-red-600">{(selectedInvoice.remainingBalance || 0).toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                            </div>

                            {/* QR CODE PLACEHOLDER */}
                            <div className="flex justify-center mb-12">
                                <div className="bg-white p-2 border-2 border-slate-900 rounded-lg">
                                    <img 
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(selectedInvoice.invoiceNumber + ' - ' + selectedInvoice.grandTotal)}`}
                                        alt="QR Code" 
                                        className="w-24 h-24"
                                    />
                                    <p className="text-[9px] text-center font-bold bg-black text-white mt-1 py-0.5 uppercase tracking-wider">Scan Invoice</p>
                                </div>
                            </div>

                            {/* SIGNATURES */}
                            <div className="grid grid-cols-2 gap-8 mt-auto">
                                <div className="text-center">
                                    <p className="text-slate-500 mb-16">Penerima,</p>
                                    <div className="border-t border-slate-300 w-3/4 mx-auto"></div>
                                    <p className="text-slate-800 font-bold mt-2">{selectedInvoice.contactName || selectedInvoice.customerName}</p>
                                </div>
                                <div className="text-center relative">
                                    <p className="text-slate-500 mb-16">Hormat kami,</p>
                                    
                                    {/* STAMP & TTD OVERLAY */}
                                    <img src={TTD_URL} className="absolute bottom-6 left-1/2 transform -translate-x-1/2 h-20 opacity-90 z-10" alt="TTD"/>
                                    <img src={STEMPEL_URL} className="absolute bottom-2 left-1/2 transform -translate-x-1/2 h-24 opacity-60 mix-blend-multiply rotate-[-10deg]" alt="Stempel"/>

                                    <div className="border-t border-slate-300 w-3/4 mx-auto relative z-20"></div>
                                    <p className="text-slate-800 font-bold mt-2 relative z-20">Planet Keripik</p>
                                </div>
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
