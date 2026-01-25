
import React from 'react';
import { LayoutDashboard, FileInput, FileOutput, History, Settings, Menu, X, ChevronRight, LogOut, FileText, ListOrdered, Package, Truck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const LOGO_URL = "https://raw.githubusercontent.com/habibiegl/planetkeripiklogo/f138730adcd58a09fc5cd7ffb9d65a7fa314b96b/Logo%20Planet%20Keripik%20P.png";

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const NavItem = ({ name, path, icon }: { name: string; path: string; icon: React.ReactNode }) => {
    const active = isActive(path);
    return (
      <Link
        to={path}
        className={`group flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-300 ${
          active
            ? 'bg-amber-50 text-amber-700 shadow-sm shadow-amber-100 translate-x-1'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 hover:translate-x-1'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <span className={`transition-colors duration-300 ${active ? 'text-amber-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
            {icon}
          </span>
          {name}
        </div>
        {active && <ChevronRight size={16} className="text-amber-500 animate-pulse" />}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 flex items-center gap-3 border-b border-slate-100/50">
        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-orange-200 flex items-center justify-center p-1.5 overflow-hidden shrink-0">
          <img 
            src={LOGO_URL} 
            alt="Logo Planet Keripik" 
            className="w-full h-full object-contain brightness-0 invert"
          />
        </div>
        <div>
          <h1 className="text-base font-extrabold text-slate-800 leading-tight tracking-tight">Planet Keripik</h1>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Management</p>
        </div>
      </div>
      
      <div className="flex-1 px-3 py-6 space-y-6 overflow-y-auto custom-scrollbar">
        
        {/* DASHBOARD */}
        <div>
           <NavItem name="Dashboard" path="/" icon={<LayoutDashboard size={20} />} />
        </div>

        {/* SURAT PO */}
        <div>
           <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">SURAT PO</p>
           <div className="space-y-1">
              <NavItem name="PO Masuk" path="/po-masuk" icon={<FileInput size={20} />} />
              <NavItem name="PO Keluar" path="/po-keluar" icon={<FileOutput size={20} />} />
              <NavItem name="Riwayat PO" path="/history" icon={<History size={20} />} />
           </div>
        </div>

        {/* INVOICE */}
        <div>
           <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">INVOICE</p>
           <div className="space-y-1">
              <NavItem name="Buat Invoice" path="/invoice/create" icon={<FileText size={20} />} />
              <NavItem name="Riwayat Invoice" path="/invoice/history" icon={<ListOrdered size={20} />} />
           </div>
        </div>

        {/* SURAT JALAN */}
        <div>
           <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">SURAT JALAN</p>
           <div className="space-y-1">
              <NavItem name="Buat Surat Jalan" path="/surat-jalan/create" icon={<Truck size={20} />} />
              <NavItem name="Riwayat Surat Jalan" path="/surat-jalan" icon={<ListOrdered size={20} />} />
           </div>
        </div>

        {/* PENGATURAN */}
        <div>
           <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">LAINNYA</p>
           <div className="space-y-1">
              <NavItem name="Pengaturan" path="/settings" icon={<Settings size={20} />} />
           </div>
        </div>

      </div>

      <div className="p-4 mt-auto">
        <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-xl shadow-slate-200 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <img src={LOGO_URL} className="w-24 h-24 transform rotate-12 translate-x-8 -translate-y-8 brightness-0 invert" alt="" />
           </div>
           <div className="flex items-center gap-3 relative z-10">
             <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center text-xs font-bold text-slate-300 overflow-hidden shrink-0">
               <span className="text-lg">A</span>
             </div>
             <div className="flex-1 overflow-hidden">
               <p className="text-sm font-bold text-white truncate">Admin Staff</p>
               <p className="text-[10px] text-slate-400 truncate">Online</p>
             </div>
             <button className="text-slate-400 hover:text-white transition-colors"><LogOut size={18}/></button>
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F6F8FC] overflow-hidden font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[280px] bg-white border-r border-slate-200/60 z-30 no-print">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-lg border-b border-slate-200/60 flex items-center justify-between px-4 z-40 transition-all no-print shadow-sm">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center p-1.5 shadow-md shadow-orange-100">
            <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
          </div>
          <span className="font-extrabold text-slate-800 text-lg tracking-tight">Planet Keripik</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <div 
        className={`md:hidden fixed inset-0 z-50 transition-all duration-500 ease-in-out no-print ${
          isMobileMenuOpen ? 'visible' : 'invisible pointer-events-none'
        }`}
      >
        <div 
          className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-500 ${
             isMobileMenuOpen ? 'opacity-100' : 'opacity-0'
          }`} 
          onClick={() => setIsMobileMenuOpen(false)}
        />
        <div 
          className={`absolute top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-white shadow-2xl transform transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <SidebarContent />
          <button 
            onClick={() => setIsMobileMenuOpen(false)} 
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-50 text-slate-400 hover:text-slate-600"
          >
             <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto w-full relative scroll-smooth">
        <div className="max-w-7xl mx-auto p-4 md:p-8 pt-24 md:pt-8 min-h-full pb-20 md:pb-8">
           {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
