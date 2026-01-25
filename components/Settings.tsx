
import React, { useState, useEffect } from 'react';
import { Calendar, User, Save, Database, AlertTriangle, Download, Upload, Trash2, CreditCard, Building } from 'lucide-react';
import { useToast } from './Toast';
import { getAppSettings, saveAppSettings, getAllDataJSON, restoreDataJSON, clearAllData } from '../services/storage';
import { AppSettings } from '../types';

const Settings: React.FC = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(getAppSettings());
  const [activeTab, setActiveTab] = useState<'profile' | 'data'>('profile');

  useEffect(() => {
    setSettings(getAppSettings());
  }, []);

  const handleChange = (field: keyof AppSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    saveAppSettings(settings);
    showToast('Pengaturan profil berhasil disimpan!', 'success');
  };

  // --- BACKUP & RESTORE ---
  const handleBackup = () => {
    const dataStr = getAllDataJSON();
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `Backup_PlanetKeripik_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    showToast('File backup berhasil didownload.', 'success');
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files.length > 0) {
       fileReader.readAsText(e.target.files[0], "UTF-8");
       fileReader.onload = (event) => {
           if(event.target && typeof event.target.result === "string") {
               const success = restoreDataJSON(event.target.result);
               if(success) {
                   showToast('Data berhasil dipulihkan! Halaman akan dimuat ulang...', 'success');
                   setTimeout(() => window.location.reload(), 2000);
               } else {
                   showToast('File backup tidak valid / rusak.', 'error');
               }
           }
       };
    }
  };

  const handleReset = () => {
      if(confirm("PERINGATAN BAHAYA!\n\nSemua data di aplikasi ini (Invoice, PO, Surat Jalan) akan DIHAPUS PERMANEN dari browser ini.\n\nPastikan Anda sudah BACKUP atau data sudah ada di Google Sheets.\n\nLanjutkan reset?")) {
          clearAllData();
          showToast('Aplikasi direset ke pengaturan awal.', 'warning');
          setTimeout(() => window.location.reload(), 1500);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Pengaturan Aplikasi</h2>
           <p className="text-slate-500 text-sm">Kelola profil bisnis, default bank, dan keamanan data.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button 
            onClick={() => setActiveTab('profile')}
            className={`pb-3 px-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'profile' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
            <Building size={16} /> Profil & Rekening
        </button>
        <button 
            onClick={() => setActiveTab('data')}
            className={`pb-3 px-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'data' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
            <Database size={16} /> Database & Backup
        </button>
      </div>

      {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-6 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Default Signatures */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
                    <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">
                        <User size={18} className="text-blue-500"/> Default Tanda Tangan
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nama Admin (Dibuat Oleh)</label>
                            <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:border-amber-500"
                                value={settings.defaultAdminName} onChange={e => handleChange('defaultAdminName', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nama Manager (Disetujui Oleh)</label>
                            <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:border-amber-500"
                                value={settings.defaultManagerName} onChange={e => handleChange('defaultManagerName', e.target.value)} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-3 italic">* Nama ini akan otomatis muncul saat membuat Invoice/PO baru.</p>
                </div>

                {/* 2. Default Bank */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
                     <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">
                        <CreditCard size={18} className="text-emerald-500"/> Default Rekening Bank (Invoice)
                    </h3>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nama Bank</label>
                            <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:border-amber-500"
                                value={settings.defaultBankName} onChange={e => handleChange('defaultBankName', e.target.value)} placeholder="BCA / Mandiri" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">No. Rekening</label>
                            <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold tracking-wider focus:bg-white focus:border-amber-500"
                                value={settings.defaultAccountNumber} onChange={e => handleChange('defaultAccountNumber', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Atas Nama</label>
                            <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:border-amber-500"
                                value={settings.defaultAccountName} onChange={e => handleChange('defaultAccountName', e.target.value)} />
                        </div>
                    </div>
                </div>
             </div>

             <div className="flex justify-end pt-4">
                 <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-amber-200 flex items-center gap-2 transition-all active:scale-95">
                     <Save size={20} /> Simpan Pengaturan
                 </button>
             </div>
          </form>
      )}

      {activeTab === 'data' && (
          <div className="space-y-6 animate-fade-in">
              {/* Backup & Restore */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-100">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Database size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">Backup & Restore</h3>
                        <p className="text-slate-500 text-xs">Amankan data Anda ke komputer lokal.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col items-start gap-4">
                        <div className="flex items-center gap-2 text-slate-800 font-bold">
                            <Download size={20} className="text-blue-600"/> Backup Data
                        </div>
                        <p className="text-sm text-slate-600">
                            Download semua data (PO, Invoice, Surat Jalan, Pengaturan) menjadi file <code>.json</code>. Simpan file ini di tempat aman.
                        </p>
                        <button onClick={handleBackup} className="mt-auto px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-100 shadow-sm transition-colors text-sm">
                            Download Backup
                        </button>
                    </div>

                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col items-start gap-4">
                        <div className="flex items-center gap-2 text-slate-800 font-bold">
                            <Upload size={20} className="text-emerald-600"/> Restore Data
                        </div>
                        <p className="text-sm text-slate-600">
                            Kembalikan data dari file backup <code>.json</code>. 
                            <span className="text-red-500 font-bold ml-1">Perhatian: Data saat ini akan tertimpa!</span>
                        </p>
                        <label className="mt-auto px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-sm transition-colors text-sm cursor-pointer inline-flex items-center gap-2">
                            <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
                            Pilih File Backup
                        </label>
                    </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                 <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle size={24} className="text-red-600" />
                    <h3 className="font-bold text-lg text-red-700">Danger Zone</h3>
                 </div>
                 <p className="text-red-600 text-sm mb-4">
                     Tindakan ini akan menghapus seluruh data di Local Storage browser ini. Gunakan jika aplikasi mengalami error fatal atau ingin memulai dari awal.
                 </p>
                 <button onClick={handleReset} className="px-5 py-2.5 bg-white border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-600 hover:text-white transition-colors shadow-sm text-sm flex items-center gap-2">
                     <Trash2 size={16} /> Reset Aplikasi
                 </button>
              </div>

               {/* Calendar Info (Existing) */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-8 opacity-75">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                      <Calendar size={20} />
                    </div>
                    <h3 className="font-bold text-base text-slate-800">Info Google Calendar</h3>
                  </div>
                  <p className="text-slate-500 text-xs">
                    Fitur "Add to Calendar" di detail PO Keluar menggunakan <em>Direct Link</em>. Tidak perlu login di aplikasi ini.
                  </p>
              </div>
          </div>
      )}
    </div>
  );
};

export default Settings;
