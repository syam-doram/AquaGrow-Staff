import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, canStock, canBill, canClose, isManager } from '../context/AuthContext';
import api from '../services/api';
import {
  FileText, IndianRupee, Wallet, CreditCard, AlertCircle, Leaf, Package, ShoppingCart,
  ArrowRight, PackagePlus, Sprout, BookOpen, Loader2, Banknote, CalendarCheck,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InvoiceSummary {
  invoiceCount: number;
  totalRevenue: number;
  cashTotal: number;
  creditTotal: number;
}

interface DashboardSummary {
  outstandingCredit: number;
  activeCultures: number;
  lowStockCount: number;
  pendingOrders: number;
}

interface RecentBill {
  _id: string;
  farmerName: string;
  createdAt: string;
  total: number;
  paymentMethod: string;
  status: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatRupee(value: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

const STATUS_STYLES: Record<string, string> = {
  paid:    'bg-emerald-500/20 text-emerald-400',
  credit:  'bg-amber-500/20 text-amber-400',
  partial: 'bg-blue-500/20 text-blue-400',
  void:    'bg-red-500/20 text-red-400',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status?.toLowerCase()] ?? 'bg-white/10 text-white/60';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status ?? '—'}
    </span>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  bg: string;
  accent: string;
  loading: boolean;
}

function StatCard({ label, value, icon, bg, accent, loading }: StatCardProps) {
  return (
    <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
        <span className={accent}>{icon}</span>
      </div>
      {loading
        ? <Loader2 size={16} className="animate-spin text-zinc-600 mb-1" />
        : <p className="text-xl font-bold text-white">{value}</p>
      }
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Quick Link ──────────────────────────────────────────────────────────────

interface QuickLinkProps { to: string; icon: React.ReactNode; label: string; color: string; }

function QuickLink({ to, icon, label, color }: QuickLinkProps) {
  return (
    <Link
      to={to}
      className="flex flex-col items-start gap-3 p-4 bg-white/4 border border-white/8 rounded-2xl hover:bg-white/8 hover:border-white/16 transition group"
    >
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
        <span className={color}>{icon}</span>
      </div>
      <span className="text-sm font-medium text-white leading-tight">{label}</span>
    </Link>
  );
}

// ─── Role badge ──────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  manager:     { label: 'Manager',    cls: 'bg-violet-500/20 text-violet-400'  },
  staff:       { label: 'Staff',      cls: 'bg-blue-500/20 text-blue-400'      },
  cashier:     { label: 'Cashier',    cls: 'bg-emerald-500/20 text-emerald-400'},
  admin:       { label: 'Admin',      cls: 'bg-amber-500/20 text-amber-400'    },
  storekeeper: { label: 'Store',      cls: 'bg-orange-500/20 text-orange-400'  },
};

function RoleBadge({ role }: { role?: string }) {
  if (!role) return null;
  const { label, cls } = ROLE_BADGE[role.toLowerCase()] ?? { label: role, cls: 'bg-white/10 text-white/60' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role || '';
  const today = new Date().toISOString().slice(0, 10);

  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceSummary | null>(null);
  const [dashSummary,    setDashSummary]    = useState<DashboardSummary | null>(null);
  const [recentBills,    setRecentBills]    = useState<RecentBill[]>([]);
  const [loadingInv,   setLoadingInv]   = useState(true);
  const [loadingDash,  setLoadingDash]  = useState(true);
  const [loadingBills, setLoadingBills] = useState(true);

  useEffect(() => {
    // Row 1: invoice summary
    api.get<InvoiceSummary>(`/invoices/summary?date=${today}`)
      .then(r => setInvoiceSummary(r.data))
      .catch(() => setInvoiceSummary({ invoiceCount: 0, totalRevenue: 0, cashTotal: 0, creditTotal: 0 }))
      .finally(() => setLoadingInv(false));

    // Row 2: shop dashboard summary — handle 404/501 gracefully
    api.get<DashboardSummary>('/dashboard/summary')
      .then(r => setDashSummary(r.data))
      .catch(() => setDashSummary({ outstandingCredit: 0, activeCultures: 0, lowStockCount: 0, pendingOrders: 0 }))
      .finally(() => setLoadingDash(false));

    // Recent bills
    api.get('/sales/invoices?limit=5&sort=desc')
      .then(r => {
        const d = r.data;
        setRecentBills(Array.isArray(d) ? d : (d?.invoices ?? []));
      })
      .catch(() => setRecentBills([]))
      .finally(() => setLoadingBills(false));
  }, [today]);

  const row1: StatCardProps[] = [
    { label: "Today's Bills",  value: invoiceSummary?.invoiceCount ?? 0,                          icon: <FileText size={18} />,    bg: 'bg-blue-500/10',    accent: 'text-blue-400',    loading: loadingInv  },
    { label: 'Revenue Today',  value: `₹${formatRupee(invoiceSummary?.totalRevenue ?? 0)}`,      icon: <IndianRupee size={18} />, bg: 'bg-emerald-500/10', accent: 'text-emerald-400', loading: loadingInv  },
    { label: 'Cash Collected', value: `₹${formatRupee(invoiceSummary?.cashTotal ?? 0)}`,         icon: <Wallet size={18} />,      bg: 'bg-green-500/10',   accent: 'text-green-400',   loading: loadingInv  },
    { label: 'Credit Sales',   value: `₹${formatRupee(invoiceSummary?.creditTotal ?? 0)}`,       icon: <CreditCard size={18} />,  bg: 'bg-amber-500/10',   accent: 'text-amber-400',   loading: loadingInv  },
  ];

  const row2: StatCardProps[] = [
    { label: 'Outstanding Farmer Credit', value: `₹${formatRupee(dashSummary?.outstandingCredit ?? 0)}`, icon: <AlertCircle size={18} />,  bg: 'bg-red-500/10',    accent: 'text-red-400',    loading: loadingDash },
    { label: 'Active Cultures',           value: dashSummary?.activeCultures ?? 0,                        icon: <Leaf size={18} />,          bg: 'bg-teal-500/10',   accent: 'text-teal-400',   loading: loadingDash },
    { label: 'Low Stock Products',        value: dashSummary?.lowStockCount ?? 0,                         icon: <Package size={18} />,       bg: 'bg-orange-500/10', accent: 'text-orange-400', loading: loadingDash },
    { label: 'Pending Farmer Orders',     value: dashSummary?.pendingOrders ?? 0,                         icon: <ShoppingCart size={18} />,  bg: 'bg-purple-500/10', accent: 'text-purple-400', loading: loadingDash },
  ];

  const quickLinks = [
    { path: '/stock-inward',  label: 'Stock Inward',      icon: <PackagePlus size={20} />,   color: 'text-orange-400', show: canStock(role)  },
    { path: '/products',      label: 'Products',          icon: <Package size={20} />,       color: 'text-blue-400',   show: true            },
    { path: '/cultures',      label: 'Culture Cycles',    icon: <Sprout size={20} />,        color: 'text-teal-400',   show: true            },
    { path: '/harvest-draft', label: 'Harvest Draft',     icon: <Leaf size={20} />,          color: 'text-lime-400',   show: isManager(role) },
    { path: '/statement',     label: 'Statement',         icon: <BookOpen size={20} />,      color: 'text-zinc-400',   show: isManager(role) },
    { path: '/invoice',       label: 'Create Bill',       icon: <FileText size={20} />,      color: 'text-emerald-400',show: canBill(role)   },
    { path: '/sales-bills',   label: 'Sales Bills',       icon: <ShoppingCart size={20} />,  color: 'text-sky-400',    show: canBill(role)   },
    { path: '/credit',        label: 'Credit Collection', icon: <CreditCard size={20} />,    color: 'text-purple-400', show: canBill(role)   },
    { path: '/payments',      label: 'Payments',          icon: <Banknote size={20} />,      color: 'text-purple-400', show: canBill(role)   },
    { path: '/day-close',     label: 'Day Close',         icon: <CalendarCheck size={20} />, color: 'text-teal-400',   show: canClose(role)  },
  ].filter(l => l.show);

  return (
    <div className="space-y-6">

      {/* ── Greeting ── */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {getGreeting()}, {user?.name?.split(' ')[0] ?? 'there'}
        </h1>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <p className="text-zinc-500 text-sm capitalize">{role.replace(/_/g, ' ')} · {today}</p>
          {user?.role && <RoleBadge role={user.role} />}
        </div>
      </div>

      {/* ── Stats Row 1 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {row1.map(card => <StatCard key={card.label} {...card} />)}
      </div>

      {/* ── Stats Row 2 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {row2.map(card => <StatCard key={card.label} {...card} />)}
      </div>

      {/* ── Quick Links ── */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickLinks.map(({ path, label, icon, color }) => (
            <QuickLink key={path} to={path} icon={icon} label={label} color={color} />
          ))}
        </div>
      </div>

      {/* ── Today's Activity ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">Today's Activity</h2>
          <Link to="/sales-bills" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
          {loadingBills ? (
            <div className="p-6 flex flex-col gap-3">
              {[0, 1, 2].map(i => <div key={i} className="h-5 bg-white/8 rounded-lg animate-pulse" />)}
            </div>
          ) : recentBills.length === 0 ? (
            <div className="p-6 text-center text-zinc-500 text-sm">No bills created today yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Farmer</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Total ₹</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Method</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentBills.map(bill => (
                    <tr key={bill._id} className="hover:bg-white/4 transition-colors">
                      <td className="px-4 py-3 text-white font-medium truncate max-w-[140px]">{bill.farmerName ?? '—'}</td>
                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{bill.createdAt ? formatTime(bill.createdAt) : '—'}</td>
                      <td className="px-4 py-3 text-white text-right font-mono whitespace-nowrap">₹{formatRupee(bill.total ?? 0)}</td>
                      <td className="px-4 py-3 text-zinc-400 capitalize">{bill.paymentMethod ?? '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={bill.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
