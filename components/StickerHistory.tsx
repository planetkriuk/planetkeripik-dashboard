
import React, { useState, useEffect } from 'react';
import { getShippingLabels, deleteShippingLabel } from '../services/storage';
import { ShippingLabel } from '../types';
import { Search, Trash2, StickyNote, User, MapPin } from 'lucide-react';
import { useToast } from './Toast';

const StickerHistory: React.FC = () => {
  const { showToast } = useToast();
  const [labels, setLabels] = useState<ShippingLabel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLabels(getShippingLabels());
  }, []);

  const handleDelete = (id: string) => {
      if(confirm('Hapus stiker ini?')) {
          deleteShippingLabel(id);
          setLabels(getShippingLabels());
          showToast('Stiker dihapus.', 'info');
      }
  };

  const filtered = labels.filter(l => l.customerName.toLowerCase().includes(searchTerm.toLowerCase()));

  // Reverse agar yang terbaru diatas
  const sorted = [...filtered].reverse();

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Riwayat Stiker</h2>
          <p className="text-slate-500 text-sm">Daftar label pengiriman yang pernah dibuat.</p>
        </div>
        <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input type="text" placeholder="Cari Nama..." className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sorted.map(label => (
              <div key={label.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                  <button onClick={() => handleDelete(label.id)} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={18}/>
                  </button>
                  
                  <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 bg-red-50 text-red-600 rounded-lg">
                          <StickyNote size={20}/>
                      </div>
                      <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(label.dateCreated).toLocaleDateString()}</p>
                          <h3 className="font-bold text-slate-800">{label.customerName}</h3>
                      </div>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex gap-2">
                          <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400"/>
                          <p className="leading-tight line-clamp-2">{label.address}</p>
                      </div>
                  </div>
              </div>
          ))}

          {sorted.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400">
                  Belum ada riwayat stiker.
              </div>
          )}
      </div>
    </div>
  );
};

export default StickerHistory;
