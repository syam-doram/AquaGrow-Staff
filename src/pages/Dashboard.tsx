import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, canStock, canBill, canClose, isManager } from '../context/AuthContext';
import api from '../services/api';
import {
  PackagePlus, ShoppingCart, Package, CreditCard, ClipboardCheck,
  Sprout, FileText, AlertCircle, Loader2, TrendingUp, Users,
} from 'lucide-react';

interface DailySummary {
  invoiceCount: number;
  totalRevenue: number;
  paidCount: number;
  draftCount: number;
  finalizedCount: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role || '';
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    api.get<DailySummary>(`/invoices/summary?date=${today}`)
      .then(r => setSummary(r.data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [today]);

  const cards = [
    { label: "Today's Bills", value: summary?.invoiceCount ?? '-', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Revenue Today', value: summary ? `₹${summary.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Paid', value: summary?.paidCount ?? '-', icon: Users, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Outstanding', value: summary ? summary.invoiceCount - (summary.paidCount ?? 0) : '-', icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  const quickLinks = [
    { path: '/stock-inward', label: 'Stock Inward', icon: PackagePlus, color: 'text-orange-400', show: canStock(role) },
    { path: '/products',    label: 'Products',      icon: Package,     color: 'text-blue-400',   show: true },
    { path: '/invoice',     label: 'Create Bill',   icon: ShoppingCart,color: 'text-emerald-400',show: canBill(role) },
    { path: '/payments',    label: 'Payments',      icon: CreditCard,  color: 'text-purple-400', show: canBill(role) },
    { path: '/day-close',   label: 'Day Close',     icon: ClipboardCheck, color: 'text-teal-400', show: canClose(role) },
    { path: '/harvest-draft', label: 'Harvest Draft', icon: Sprout,    color: 'text-lime-400',   show: isManager(role) },
    { path: '/statement',   label: 'Statement',     icon: FileText,    color: 'text-zinc-400',   show: isManager(role) },
  ].filter(l => l.show);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5 capitalize">{role.replace(/_/g, ' ')} · {today}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(card => (
          <div key={card.label} className="bg-white/4 border border-white/8 rounded-2xl p-4">
            <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon size={18} className={card.color} />
            </div>
            {loading
              ? <Loader2 size={16} className="animate-spin text-zinc-600 mb-1" />
              : <p className="text-xl font-bold text-white">{card.value}</p>
            }
            <p className="text-xs text-zinc-500 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {quickLinks.map(({ path, label, icon: Icon, color }) => (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-start gap-3 p-4 bg-white/4 border border-white/8 rounded-2xl hover:bg-white/8 hover:border-white/16 transition group"
            >
              <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <Icon size={20} className={color} />
              </div>
              <span className="text-sm font-medium text-white leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
