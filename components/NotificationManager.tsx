
import React, { useEffect } from 'react';
import { getPOs } from '../services/storage';
import { POType, POStatus } from '../types';
import { useToast } from './Toast';

const NotificationManager: React.FC = () => {
  const { showToast } = useToast();

  useEffect(() => {
    // 1. Request Permission saat aplikasi dimuat
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    // 2. Cek Deadline
    checkDeadlines();
  }, []);

  const checkDeadlines = () => {
    const pos = getPOs();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingPOs = pos.filter(po => {
      // Filter hanya PO Keluar yang belum Selesai/Batal
      if (po.type !== POType.OUTGOING || po.status === POStatus.CANCELLED || po.status === POStatus.COMPLETED) {
        return false;
      }
      if (!po.shippingDate) return false;

      const shippingDate = new Date(po.shippingDate);
      shippingDate.setHours(0, 0, 0, 0);

      // Hitung selisih hari (dalam miliseconds -> hari)
      const diffTime = shippingDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // LOGIKA NOTIFIKASI:
      // Munculkan notifikasi jika H-4, H-3, H-2, H-1, atau Hari H (0)
      return diffDays >= 0 && diffDays <= 4;
    });

    if (upcomingPOs.length > 0) {
      // Tampilkan Toast di dalam App
      showToast(`Peringatan: Ada ${upcomingPOs.length} pengiriman dalam 4 hari ke depan!`, 'info');

      // Tampilkan Browser Notification (Bisa muncul di status bar HP jika app di background tapi tidak di kill)
      if ('Notification' in window && Notification.permission === 'granted') {
        upcomingPOs.forEach(po => {
          const shipDate = new Date(po.shippingDate || '').toLocaleDateString('id-ID');
          
          // Mencegah spam notifikasi berulang kali dalam satu sesi (opsional, disini kita biarkan agar admin sadar)
          new Notification(`⚠️ Pengingat Pengiriman: ${po.customerName}`, {
            body: `No PO: ${po.poNumber}\nTgl Kirim: ${shipDate}\nSiapkan barang sekarang!`,
            icon: 'https://raw.githubusercontent.com/habibiegl/planetkeripiklogo/f138730adcd58a09fc5cd7ffb9d65a7fa314b96b/Logo%20Planet%20Keripik%20P.png',
            tag: po.id // Tag mencegah notifikasi duplikat menumpuk
          });
        });
      }
    }
  };

  return null; // Komponen ini tidak me-render UI, hanya logika background
};

export default NotificationManager;
