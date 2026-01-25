
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { getPOs, getInvoices, getDeliveryOrders } from '../services/storage';
import { POType, PurchaseOrder, POStatus, Invoice, InvoiceStatus, DeliveryStatus, DeliveryOrder } from '../types';
import { TrendingUp, Package, AlertCircle, Wallet, ArrowUpRight, ArrowRight, FileText, ArrowDownLeft, Truck, Calendar, Clock, ChevronRight, AlertTriangle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState(0);

  // Actionable Data States
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [upcomingDeliveries, setUpcomingDeliveries] = useState<DeliveryOrder[]>([]);

  useEffect(() => {
    const poData = getPOs();
    const invoiceData = getInvoices();
    const doData = getDeliveryOrders();
    setPos(poData);
    setInvoices(invoiceData);
    
    // 1. Hitung pengiriman aktif (Status Diproses/Dikirim)
    const activeDOs = doData.filter(d => d.status === DeliveryStatus.PREPARING || d.status === DeliveryStatus.SHIPPED).length;
    setActiveDeliveries(activeDOs);

    // 2. Filter & Sort Tagihan Belum Lunas (Prioritas: Jatuh Tempo -> Terdekat)
    const unpaid = invoiceData
        .filter(i => i.status === InvoiceStatus.UNPAID || i.status === InvoiceStatus.OVERDUE)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 5); // Ambil 5 teratas
    setUnpaidInvoices(unpaid);

    // 3. Filter & Sort Pengiriman Terdekat (Prioritas: Tanggal terdekat)
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const upcoming = doData
        .filter(d => d.status === DeliveryStatus.PREPARING)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5); // Ambil 5 teratas
    setUpcomingDeliveries(upcoming);

    // 4. Logika Grafik Pendapatan
    const revenueMap: Record<string, number> = {};
    const validInvoices = [...invoiceData]
      .filter(inv => inv.status !== InvoiceStatus.DRAFT)
      .sort((a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime());

    validInvoices.forEach(inv => {
      const date = new Date(inv.dateCreated).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      revenueMap[date] = (revenueMap[date] || 0) + inv.grandTotal;
    });

    const chartData = Object.keys(revenueMap).map(key => ({
      name: key,
      revenue: revenueMap[key]
    })).slice(-7);

    setRevenueData(chartData);
  }, []);

  // --- STATISTIK UTAMA ---
  const stats = {
    incoming: pos.filter(p => p.type === POType.INCOMING && p.status !== POStatus.CANCELLED).length,
    outgoing: pos.filter(p => p.type === POType.OUTGOING && p.status !== POStatus.CANCELLED).length,
    totalRevenue: invoices
      .filter(i => i.status !== InvoiceStatus.DRAFT)
      .reduce((acc, curr) => acc + curr.grandTotal, 0),
    unpaidAmount: invoices
      .filter(i => i.status === InvoiceStatus.UNPAID || i.status === InvoiceStatus.OVERDUE)
      .reduce((acc, curr) => acc + curr.grandTotal, 0),
  };

  const StatCard = ({ title, value, subtext, icon, colorClass, gradientClass, linkTo }: { title: string, value: string | number, subtext?: string, icon: React.ReactNode, colorClass: string, gradientClass: string, linkTo?: string }) => {
    const Content = (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300 group h-full cursor-pointer relative overflow-hidden">
        <div className={`absolute top-0 right-0 p-8 opacity-5 transform rotate-12 scale-150 transition-transform group-hover:scale-125 ${colorClass}`}>
           {icon}
        </div>
        <div className="flex items-start justify-between mb-4 relative z-10">
          <div className={`p-3.5 rounded-2xl text-white ${gradientClass} shadow-lg shadow-gray-200 group-hover:scale-110 transition-transform duration-300`}>
            {icon}
          </div>
          {subtext && (
            <span className={`flex items-center text-[10px] font-bold border px-2 py-1 rounded-full ${colorClass.replace('text-', 'bg-').replace('600', '50')} ${colorClass.replace('text-', 'border-').replace('600', '100')} ${colorClass}`}>
              {subtext}
            </span>
          )}
        </div>
        <div className="relative z-10">
          <h3 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">{value}</h3>
          <p className="text-sm font-medium text-slate-500 mt-1">{title}</p>
        </div>
      </div>
    );

    return linkTo ? <Link to={linkTo} className="block h-full">{Content}</Link> : Content;
  };

  return (
    <div className="space-y-8 animate-fade-in-up pb-10">
      {/* Header Dashboard */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Dashboard</h2>
          <p className="text-slate-500 mt-1 text-sm md:text-base">Ringkasan performa bisnis & operasional harian.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 text-sm font-bold text-slate-600 shadow-sm self-start md:self-auto">
          <Calendar size={16} className="text-amber-500"/>
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Grid Statistik Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="Omset (Invoiced)" 
          value={`Rp ${stats.totalRevenue.toLocaleString('id-ID', { notation: 'compact' })}`} 
          subtext="Gross"
          icon={<Wallet size={22} />} 
          colorClass="text-violet-600"
          gradientClass="bg-gradient-to-br from-violet-500 to-violet-600"
          linkTo="/invoice/history"
        />
        <StatCard 
          title="Piutang (Unpaid)" 
          value={`Rp ${stats.unpaidAmount.toLocaleString('id-ID', { notation: 'compact' })}`} 
          icon={<AlertCircle size={22} />} 
          colorClass="text-rose-600"
          gradientClass="bg-gradient-to-br from-rose-500 to-rose-600"
          linkTo="/invoice/history"
        />
        <StatCard 
          title="Pengiriman Aktif" 
          value={activeDeliveries} 
          subtext="On Process"
          icon={<Truck size={22} />} 
          colorClass="text-amber-600"
          gradientClass="bg-gradient-to-br from-amber-500 to-amber-600"
          linkTo="/surat-jalan"
        />
        <StatCard 
          title="PO Masuk (Restock)" 
          value={stats.incoming} 
          icon={<ArrowDownLeft size={22} />} 
          colorClass="text-blue-600"
          gradientClass="bg-gradient-to-br from-blue-500 to-blue-600"
          linkTo="/po-masuk"
        />
      </div>

      {/* ACTIONABLE SECTION: TAGIHAN & PENGIRIMAN */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* KOLOM KIRI: TAGIHAN BELUM LUNAS */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-rose-50/30">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Tagihan Belum Lunas</h3>
                        <p className="text-xs text-slate-500">Segera lakukan penagihan</p>
                    </div>
                </div>
                <Link to="/invoice/history" className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1">
                    Lihat Semua <ChevronRight size={14} />
                </Link>
            </div>
            <div className="flex-1 overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                            <th className="px-6 py-3">Customer</th>
                            <th className="px-6 py-3">Jatuh Tempo</th>
                            <th className="px-6 py-3 text-right">Nilai</th>
                            <th className="px-6 py-3 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {unpaidInvoices.length > 0 ? unpaidInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800">{inv.customerName}</div>
                                    <div className="text-[10px] text-slate-400">{inv.invoiceNumber}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className={`flex items-center gap-1.5 font-bold ${new Date(inv.dueDate) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                                        <Clock size={14} />
                                        {new Date(inv.dueDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                                    </div>
                                    {new Date(inv.dueDate) < new Date() && <span className="text-[10px] text-red-500 font-bold">Terlambat!</span>}
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-slate-700">
                                    Rp {inv.grandTotal.toLocaleString('id-ID', {notation: 'compact'})}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button onClick={() => navigate(`/invoice/edit/${inv.id}`)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-bold transition-colors">
                                        Detail
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="p-3 bg-emerald-50 text-emerald-500 rounded-full"><TrendingUp size={24}/></div>
                                        <span>Tidak ada tagihan tertunggak. Bagus!</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* KOLOM KANAN: JADWAL PENGIRIMAN */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/30">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                        <Truck size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Jadwal Pengiriman</h3>
                        <p className="text-xs text-slate-500">Persiapkan barang segera</p>
                    </div>
                </div>
                <Link to="/surat-jalan" className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1">
                    Lihat Semua <ChevronRight size={14} />
                </Link>
            </div>
            <div className="flex-1 overflow-x-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                            <th className="px-6 py-3">Tujuan</th>
                            <th className="px-6 py-3">Tgl Kirim</th>
                            <th className="px-6 py-3">Driver</th>
                            <th className="px-6 py-3 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {upcomingDeliveries.length > 0 ? upcomingDeliveries.map((d) => (
                            <tr key={d.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate(`/surat-jalan/edit/${d.id}`)}>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800">{d.customerName}</div>
                                    <div className="text-[10px] text-slate-400">{d.doNumber}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-700">
                                        {new Date(d.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                     <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                        {d.driverName}
                                     </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                                        <Clock size={10} /> Diproses
                                    </span>
                                </td>
                            </tr>
                        )) : (
                             <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="p-3 bg-slate-50 text-slate-400 rounded-full"><Package size={24}/></div>
                                        <span>Tidak ada jadwal pengiriman dekat.</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

      </div>

      {/* GRAFIK PENDAPATAN */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Tren Pendapatan</h3>
                  <p className="text-xs text-slate-400">7 Hari Terakhir (Berdasarkan Invoice)</p>
                </div>
             </div>
          </div>
          <div className="w-full h-[300px] md:h-[350px]">
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `Rp${(value / 1000000).toFixed(0)}jt`} />
                  <Tooltip 
                    cursor={{ stroke: '#8b5cf6', strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                    formatter={(value: number) => [`Rp ${value.toLocaleString('id-ID')}`, 'Tagihan']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <FileText size={32} className="mb-2 opacity-30"/>
                <p className="text-xs">Belum ada data transaksi.</p>
              </div>
            )}
          </div>
        </div>
    </div>
  );
};

export default Dashboard;
