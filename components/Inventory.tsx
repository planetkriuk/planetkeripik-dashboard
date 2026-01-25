import React, { useEffect, useState } from 'react';
import { getInventorySummary } from '../services/storage';
import { Package, AlertTriangle, CheckCircle2, Search, ArrowDown, ArrowUp } from 'lucide-react';

const Inventory: React.FC = () => {
  const [summary, setSummary] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSummary(getInventorySummary());
  }, []);

  const filteredSummary = summary.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.specification.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Ringkasan Inventori</h2>
          <p className="text-slate-500 text-sm">Monitor total stok barang di seluruh Purchase Order.</p>
        </div>
        <div className="relative group">
          <Search className="absolute left-3 top-3 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Cari produk..." 
            className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-blue-600">
             <ArrowDown size={20} />
             <h3 className="font-bold">Total Stok Masuk</h3>
          </div>
          <p className="text-3xl font-extrabold text-slate-800">
            {summary.reduce((acc, curr) => acc + curr.totalIn, 0)} <span className="text-sm font-normal text-slate-400">Pcs</span>
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-emerald-600">
             <ArrowUp size={20} />
             <h3 className="font-bold">Total Terkirim</h3>
          </div>
          <p className="text-3xl font-extrabold text-slate-800">
            {summary.reduce((acc, curr) => acc + curr.totalOut, 0)} <span className="text-sm font-normal text-slate-400">Pcs</span>
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-amber-600">
             <Package size={20} />
             <h3 className="font-bold">Sisa Stok Gudang</h3>
          </div>
          <p className="text-3xl font-extrabold text-slate-800">
            {summary.reduce((acc, curr) => acc + curr.remaining, 0)} <span className="text-sm font-normal text-slate-400">Pcs</span>
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Nama Produk</th>
              <th className="px-6 py-4">Spesifikasi</th>
              <th className="px-6 py-4 text-center">Masuk</th>
              <th className="px-6 py-4 text-center">Keluar</th>
              <th className="px-6 py-4 text-center">Sisa Stok</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSummary.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-800">{item.name}</td>
                <td className="px-6 py-4 text-slate-500">{item.specification}</td>
                <td className="px-6 py-4 text-center font-medium text-blue-600">{item.totalIn}</td>
                <td className="px-6 py-4 text-center font-medium text-emerald-600">{item.totalOut}</td>
                <td className="px-6 py-4 text-center">
                   <span className={`inline-block px-3 py-1 rounded-lg font-bold ${item.remaining <= 10 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-700'}`}>
                     {item.remaining}
                   </span>
                </td>
                <td className="px-6 py-4">
                  {item.remaining <= 10 ? (
                    <div className="flex items-center gap-2 text-red-500 text-xs font-bold uppercase">
                      <AlertTriangle size={14} /> Stok Menipis
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold uppercase">
                      <CheckCircle2 size={14} /> Aman
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filteredSummary.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Data inventori tidak ditemukan.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Inventory;