import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, canStock, canBill, canClose, isManager } from '../context/AuthContext';
import {
  LayoutDashboard, PackagePlus, ShoppingCart, Package,
  CreditCard, ClipboardCheck, Sprout, FileText, LogOut,
  Fish, Menu, X, ChevronRight, Users,
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.FC<any>;
  show: (role: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/',              label: 'Dashboard',       icon: LayoutDashboard, show: () => true },
  { path: '/stock-inward', label: 'Stock Inward',     icon: PackagePlus,     show: canStock },
  { path: '/products',     label: 'Products',         icon: Package,         show: () => true },
  { path: '/invoice',      label: 'Create Bill',      icon: ShoppingCart,    show: canBill },
  { path: '/payments',     label: 'Payments',         icon: CreditCard,      show: canBill },
  { path: '/farmers',      label: 'Farmer Register',  icon: Users,           show: () => true },
  { path: '/day-close',    label: 'Day Close',        icon: ClipboardCheck,  show: canClose },
  { path: '/harvest-draft',label: 'Harvest Draft',    icon: Sprout,          show: isManager },
  { path: '/statement',    label: 'Statement',        icon: FileText,        show: isManager },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = user?.role || '';
  const visibleItems = NAV_ITEMS.filter(item => item.show(role));
  const initials = (user?.name ?? 'S').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex flex-col gap-0.5">
      {visibleItems.map(({ path, label, icon: Icon }) => {
        const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
        return (
          <Link
            key={path}
            to={path}
            onClick={onClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              active
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-white/8'
            }`}
          >
            <Icon size={17} className="shrink-0" />
            {label}
            {active && <ChevronRight size={14} className="ml-auto" />}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-white/8 bg-zinc-900">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/8">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-md">
            <Fish size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm text-white leading-none">AquaGrow</p>
            <p className="text-[9px] text-emerald-400 uppercase tracking-widest mt-0.5">Staff Portal</p>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 px-3 py-4 overflow-y-auto">
          <NavLinks />
        </div>

        {/* User card */}
        <div className="p-3 border-t border-white/8">
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white/4 rounded-xl mb-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-zinc-500 truncate capitalize">{user?.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition font-medium"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-white/8">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Fish size={14} className="text-white" />
          </div>
          <span className="font-bold text-white text-sm">AquaGrow Staff</span>
        </div>
        <button onClick={() => setMobileOpen(o => !o)} className="p-1.5 text-zinc-400 hover:text-white">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-zinc-900 h-full flex flex-col pt-14 shadow-2xl">
            <div className="flex-1 px-3 py-4 overflow-y-auto">
              <NavLinks onClick={() => setMobileOpen(false)} />
            </div>
            <div className="p-3 border-t border-white/8">
              <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                  <p className="text-[10px] text-zinc-500 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition">
                <LogOut size={15} /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto lg:pt-0 pt-14">
        <div className="max-w-5xl mx-auto p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
