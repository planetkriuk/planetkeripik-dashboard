import React, { useState, useRef, useEffect } from 'react';
import { Download, Plus, Trash2, Printer, X, Save } from 'lucide-react';
import html2canvas from 'html2canvas';
import { PriceListItem } from '../types';
import { getPriceList, savePriceListItem, deletePriceListItem, getAppSettings } from '../services/storage';
import { useToast } from './Toast';
import { submitPriceListToGoogle, deletePriceListFromGoogle } from '../services/googleSheetService';

const PriceList: React.FC = () => {
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addToast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const settings = getAppSettings();

  // Form State
  const [itemName, setItemName] = useState('');
  const [packagingContent, setPackagingContent] = useState('');
  const [priceTier1, setPriceTier1] = useState<number | ''>('');
  const [priceTier2, setPriceTier2] = useState<number | ''>('');
  const [priceTier3, setPriceTier3] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setItems(getPriceList());
  }, []);

  const formatRupiah = (number: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(number);
  };

  const handleDownloadImage = async () => {
    if (!printRef.current) return;
    
    // Temporarily expand width to prevent cropping on mobile
    const originalWidth = printRef.current.style.width;
    const tableContainer = printRef.current.querySelector('.overflow-x-auto') as HTMLElement;
    const originalOverflow = tableContainer ? tableContainer.style.overflow : '';
    
    printRef.current.style.width = 'fit-content';
    printRef.current.style.minWidth = '100%';
    if (tableContainer) tableContainer.style.overflow = 'visible';

    try {
      const canvas = await html2canvas(printRef.current, { 
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `PriceList-${new Date().toISOString().split('T')[0]}.png`;
      link.click();
      addToast('success', 'Gambar Price List berhasil diunduh');
    } catch (error) {
      console.error(error);
      addToast('error', 'Gagal membuat gambar');
    } finally {
      // Restore original styles
      printRef.current.style.width = originalWidth;
      printRef.current.style.minWidth = '';
      if (tableContainer) tableContainer.style.overflow = originalOverflow;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !packagingContent || priceTier1 === '' || priceTier2 === '' || priceTier3 === '') {
      addToast('error', 'Harap isi semua kolom');
      return;
    }

    setIsSubmitting(true);
    const newItem: PriceListItem = {
      id: `PL-${Date.now()}`,
      itemName,
      packagingContent,
      priceTier1: Number(priceTier1),
      priceTier2: Number(priceTier2),
      priceTier3: Number(priceTier3),
      lastUpdated: new Date().toISOString()
    };

    try {
      // Save locally first for fast UI update
      savePriceListItem(newItem);
      setItems(getPriceList());
      
      // Try sync to cloud
      const syncResult = await submitPriceListToGoogle(newItem);
      if (syncResult.success) {
        addToast('success', 'Berhasil disimpan ke Cloud');
      } else {
        addToast('warning', syncResult.message + ' (Disimpan di Lokal)');
      }
      
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      addToast('error', 'Terjadi kesalahan sistem');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus item ini?')) return;
    
    // Optimistic delete
    deletePriceListItem(id);
    setItems(getPriceList());
    
    try {
      const res = await deletePriceListFromGoogle(id);
      if(res.success) {
        addToast('success', 'Item dihapus dari server');
      } else {
        addToast('warning', res.message);
      }
    } catch (e) {
      addToast('error', 'Gagal menghapus dari server');
    }
  };

  const resetForm = () => {
    setItemName('');
    setPackagingContent('');
    setPriceTier1('');
    setPriceTier2('');
    setPriceTier3('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Price List</h1>
          <p className="text-slate-500 text-sm">Kelola daftar harga produk premium Planet Keripik</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-amber-200"
          >
            <Plus size={16} /> Tambah Item
          </button>
          <button
            onClick={handleDownloadImage}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-slate-200 shadow-sm"
          >
            <Download size={16} /> Unduh Gambar
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <Printer size={16} /> Cetak PDF
          </button>
        </div>
      </div>

      {/* Printable Area */}
      <div 
        ref={printRef} 
        className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
      >
        <div className="p-6 bg-white">
          
          {/* KOP SURAT */}
          <div className="border-b-[3px] border-slate-800 pb-6 mb-6 flex justify-center">
            <img 
              src="https://raw.githubusercontent.com/habibiegl/planetkeripiklogo/f138730adcd58a09fc5cd7ffb9d65a7fa314b96b/Kop%20Planet%20Keripik.png" 
              alt="Kop Planet Keripik" 
              crossOrigin="anonymous"
              className="max-w-full max-h-40 object-contain object-center" 
            />
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-6 uppercase print:text-2xl text-center">
            PRICE LIST Produk Premium
          </h2>
          
          <div className="overflow-x-auto pb-4">
            <table className="w-full min-w-[800px] border-collapse border border-slate-800 table-fixed">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-800 px-2 py-3 text-center text-sm font-bold text-slate-800 uppercase align-middle" style={{ width: '5%' }}>NO</th>
                  <th className="border border-slate-800 px-4 py-3 text-left text-sm font-bold text-slate-800 uppercase align-middle" style={{ width: '28%' }}>NAMA BARANG</th>
                  <th className="border border-slate-800 px-4 py-3 text-left text-sm font-bold text-slate-800 uppercase align-middle" style={{ width: '15%' }}>ISI PER BAL/FOIL/DUS</th>
                  <th className="border border-slate-800 p-0 text-center text-sm font-bold text-slate-800 uppercase align-top" colSpan={3} style={{ width: '45%' }}>
                    <div className="border-b border-slate-800 py-3">HARGA PEMBELIAN (KG)</div>
                    <div className="grid grid-cols-3 w-full h-full">
                        <div className="py-2 border-r border-slate-800 flex items-center justify-center">1-50 KG</div>
                        <div className="py-2 border-r border-slate-800 flex items-center justify-center">51-290 KG</div>
                        <div className="py-2 flex items-center justify-center">300 KG UP</div>
                    </div>
                  </th>
                  <th data-html2canvas-ignore="true" className="border border-slate-800 px-2 py-3 text-center text-sm font-bold text-slate-800 uppercase no-print align-middle" style={{ width: '7%' }}>AKSI</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-slate-800 px-4 py-8 text-center text-slate-500">
                      Belum ada data Price List
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="border border-slate-800 px-2 py-3 text-center text-sm text-slate-700 font-medium" style={{ width: '5%' }}>{index + 1}</td>
                      <td className="border border-slate-800 px-4 py-3 text-sm text-slate-800 font-medium" style={{ width: '28%' }}>{item.itemName}</td>
                      <td className="border border-slate-800 px-4 py-3 text-sm text-slate-700" style={{ width: '15%' }}>{item.packagingContent}</td>
                      <td className="border border-slate-800 px-4 py-3 text-sm text-slate-800 font-semibold text-right" style={{ width: '15%' }}>{formatRupiah(item.priceTier1)}</td>
                      <td className="border border-slate-800 px-4 py-3 text-sm text-slate-800 font-semibold text-right" style={{ width: '15%' }}>{formatRupiah(item.priceTier2)}</td>
                      <td className="border border-slate-800 px-4 py-3 text-sm text-slate-800 font-semibold text-right" style={{ width: '15%' }}>{formatRupiah(item.priceTier3)}</td>
                      <td data-html2canvas-ignore="true" className="border border-slate-800 px-2 py-2 text-center no-print" style={{ width: '7%' }}>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Tambah Data */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Tambah Item Price List</h3>
                <p className="text-xs text-slate-500 mt-1">Masukkan data produk dan harga tier</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="pricelist-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Nama Barang</label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Contoh: Keripik Singkong Pedas"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Isi Per-Bal/Foil/Dus</label>
                  <input
                    type="text"
                    required
                    value={packagingContent}
                    onChange={(e) => setPackagingContent(e.target.value)}
                    placeholder="Contoh: 10 kg, 8 kg, 5 kg"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Harga 1-50 kg</label>
                    <input
                      type="number"
                      required
                      value={priceTier1}
                      onChange={(e) => setPriceTier1(Number(e.target.value))}
                      placeholder="Rp..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Harga 51-290 kg</label>
                    <input
                      type="number"
                      required
                      value={priceTier2}
                      onChange={(e) => setPriceTier2(Number(e.target.value))}
                      placeholder="Rp..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Harga 300 kg up</label>
                    <input
                      type="number"
                      required
                      value={priceTier3}
                      onChange={(e) => setPriceTier3(Number(e.target.value))}
                      placeholder="Rp..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all text-sm"
                    />
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                form="pricelist-form"
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-sm shadow-amber-200 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  'Menyimpan...'
                ) : (
                  <>
                    <Save size={16} /> Simpan Item
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          .print\\:text-2xl {
            font-size: 1.5rem !important;
          }
          .print\\:mb-6 {
            margin-bottom: 1.5rem !important;
          }
          
          /* The element to print and all its children */
          #root > div > main > div > div > div:nth-child(2),
          #root > div > main > div > div > div:nth-child(2) * {
            visibility: visible;
          }
          
          /* Position the element to print at the top left */
          #root > div > main > div > div > div:nth-child(2) {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            box-shadow: none;
          }

          @page {
            size: A4 portrait;
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
};

export default PriceList;
