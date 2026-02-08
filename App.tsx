
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import POForm from './components/POForm';
import { HistoryPage } from './components/History';
import Settings from './components/Settings';
import InvoiceForm from './components/InvoiceForm';
import { InvoiceHistory } from './components/InvoiceHistory';
import DeliveryOrderForm from './components/DeliveryOrderForm';
import DeliveryOrderHistory from './components/DeliveryOrderHistory';
// Inventory import removed
import StickerForm from './components/StickerForm';
import StickerHistory from './components/StickerHistory';

import { ToastProvider } from './components/Toast';
import NotificationManager from './components/NotificationManager';
import { POType } from './types';
import { Loader2 } from 'lucide-react';

// Services for Global Sync
import { fetchPOsFromGoogle, fetchInvoicesFromGoogle, fetchDeliveryOrdersFromGoogle } from './services/googleSheetService';
import { saveAllPOs, saveAllInvoices, saveAllDeliveryOrders } from './services/storage';

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [loadingText, setLoadingText] = useState('Menghubungkan ke Server...');

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoadingText('Sinkronisasi PO, Invoice & Surat Jalan...');
        
        // Fetch all data in parallel for speed
        const [posResult, invResult, doResult] = await Promise.all([
          fetchPOsFromGoogle(),
          fetchInvoicesFromGoogle(),
          fetchDeliveryOrdersFromGoogle()
        ]);

        // Save POs if success
        if (posResult.success && posResult.data) {
          saveAllPOs(posResult.data);
        }

        // Save Invoices if success
        if (invResult.success && invResult.data) {
          saveAllInvoices(invResult.data);
        }

        // Save Delivery Orders if success
        if (doResult.success && doResult.data) {
          saveAllDeliveryOrders(doResult.data);
        }

        setLoadingText('Memuat Dashboard...');
        // Small delay to ensure smooth transition
        await new Promise(resolve => setTimeout(resolve, 800));

      } catch (error) {
        console.error("Global Sync Error:", error);
        // Even if it fails, we let the app load with local data
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, []);

  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center z-50">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 flex flex-col items-center max-w-sm w-full mx-4">
           <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg shadow-orange-200 flex items-center justify-center p-2 mb-6 animate-bounce">
              <img 
                src="https://raw.githubusercontent.com/habibiegl/planetkeripiklogo/f138730adcd58a09fc5cd7ffb9d65a7fa314b96b/Logo%20Planet%20Keripik%20P.png" 
                alt="Logo" 
                className="w-full h-full object-contain brightness-0 invert"
              />
           </div>
           <h2 className="text-xl font-extrabold text-slate-800 mb-2">Planet Keripik</h2>
           <div className="flex items-center gap-2 text-amber-600 font-medium text-sm mb-4">
              <Loader2 size={16} className="animate-spin" />
              <span>{loadingText}</span>
           </div>
           <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 animate-pulse w-full rounded-full"></div>
           </div>
           <p className="text-xs text-slate-400 mt-4 text-center">
             Mohon tunggu sebentar, sedang mengambil data terbaru...
           </p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <NotificationManager /> 
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            
            {/* Invoice Routes */}
            <Route path="/invoice/create" element={<InvoiceForm />} />
            <Route path="/invoice/edit/:id" element={<InvoiceForm />} />
            <Route path="/invoice/history" element={<InvoiceHistory />} />

            {/* Sticker Routes */}
            <Route path="/stiker/create" element={<StickerForm />} />
            <Route path="/stiker/history" element={<StickerHistory />} />

            {/* PO Routes */}
            <Route path="/po-masuk" element={<POForm defaultType={POType.INCOMING} />} />
            <Route path="/po-keluar" element={<POForm defaultType={POType.OUTGOING} />} />
            <Route path="/edit/:id" element={<POForm />} />
            <Route path="/history" element={<HistoryPage />} />

            {/* Surat Jalan Routes */}
            <Route path="/surat-jalan" element={<DeliveryOrderHistory />} />
            <Route path="/surat-jalan/create" element={<DeliveryOrderForm />} />
            <Route path="/surat-jalan/edit/:id" element={<DeliveryOrderForm />} />
            
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </HashRouter>
    </ToastProvider>
  );
};

export default App;
