import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  CreditCard, Loader2, AlertCircle, CheckCircle2,
  X, RefreshCw, IndianRupee, FileText
} from 'lucide-react';

interface InvoicePayment { amount: number; method: string; }

interface Invoice {
  _id: string;
  farmerId: string | { _id: string; name: string };
  items: { quantity: number; total: number; productId: any }[];
  totalAmount: number;
  status: 'draft' | 'finalized' | 'paid' | 'cancelled';
  payments: InvoicePayment[];
  createdAt: string;
}

const fmtRs  = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const METHODS = ['Cash', 'UPI', 'Bank', 'Credit', 'Mixed'];

const Payments: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [paying, setPaying]     = useState<string | null>(null);
  const [payForms, setPayForms] = useState<Record<string, { amount: string; method: string }>>({});

  // Fetch draft + finalized (both have unpaid balance)
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [drafts, finalized] = await Promise.all([
        api.get<Invoice[]>('/invoices?status=draft'),
        api.get<Invoice[]>('/invoices?status=finalized'),
      ]);
      const all = [...(drafts.data || []), ...(finalized.data || [])];
      // Keep only those where outstanding > 0
      const unpaid = all.filter(inv => {
        const paid = (inv.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
        return paid < inv.totalAmount;
      });
      // Deduplicate by _id (in case backend returns overlapping results)
      const seen = new Set<string>();
      const unique = unpaid.filter(inv => { if (seen.has(inv._id)) return false; seen.add(inv._id); return true; });
      setInvoices(unique);
    } catch {
      setError('Failed to load invoices. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setForm = (id: string, field: 'amount' | 'method', val: string) =>
    setPayForms(prev => ({ ...prev, [id]: { amount: '', method: 'Cash', ...prev[id], [field]: val } }));

  const handlePay = async (inv: Invoice) => {
    const form = payForms[inv._id];
    const amt  = Number(form?.amount);
    if (!amt || amt <= 0) { setError('Enter a valid payment amount'); return; }

    // Don't exceed outstanding
    const alreadyPaid = (inv.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    const outstanding = inv.totalAmount - alreadyPaid;
    if (amt > outstanding + 0.01) {
      setError(`Payment ₹${amt.toFixed(2)} exceeds outstanding ${fmtRs(outstanding)}`);
      return;
    }

    setError(null);
    setPaying(inv._id);
    try {
      await api.post(`/invoices/${inv._id}/payment`, {
        amount: amt,
        method: form?.method || 'Cash',
      });
      load();
      setPayForms(prev => { const n = { ...prev }; delete n[inv._id]; return n; });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Payment failed');
    } finally {
      setPaying(null);
    }
  };

  const farmerName = (inv: Invoice): string => {
    if (!inv.farmerId) return '—';
    if (typeof inv.farmerId === 'object') return (inv.farmerId as any).name ?? '—';
    return String(inv.farmerId).slice(-6).toUpperCase();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard size={24} className="text-purple-400" /> Payments
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">Collect payment against outstanding invoices</p>
        </div>
        <button onClick={load} className="p-2 text-zinc-500 hover:text-white hover:bg-white/8 rounded-xl transition">
          <RefreshCw size={16} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 size={28} className="animate-spin text-purple-400" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-3" />
          <p className="text-white font-semibold">All invoices are settled!</p>
          <p className="text-zinc-500 text-sm mt-1">No outstanding payments at this time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => {
            const form       = payForms[inv._id] || { amount: '', method: 'Cash' };
            const paidSoFar  = (inv.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
            const outstanding = inv.totalAmount - paidSoFar;

            return (
              <div key={inv._id} className="bg-white/4 border border-white/8 rounded-2xl p-4 space-y-3">
                {/* Invoice header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-zinc-500" />
                      <p className="text-xs text-zinc-500 font-mono">#{inv._id.slice(-8).toUpperCase()}</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        inv.status === 'draft'
                          ? 'bg-zinc-500/20 text-zinc-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>{inv.status.toUpperCase()}</span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5">{farmerName(inv)} · {fmtDate(inv.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Total</p>
                    <p className="text-sm font-bold text-zinc-200">{fmtRs(inv.totalAmount)}</p>
                  </div>
                </div>

                {/* Payment progress */}
                {paidSoFar > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Paid so far</span>
                      <span className="text-emerald-400 font-medium">{fmtRs(paidSoFar)}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (paidSoFar / inv.totalAmount) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Outstanding */}
                <div className="flex justify-between items-center py-2 border-t border-white/5">
                  <span className="text-sm text-zinc-400">Outstanding</span>
                  <span className="text-lg font-bold text-amber-400">{fmtRs(outstanding)}</span>
                </div>

                {/* Payment form */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Amount (₹)</label>
                    <input
                      type="number" min="0.01" step="0.01"
                      value={form.amount}
                      onChange={e => setForm(inv._id, 'amount', e.target.value)}
                      placeholder={outstanding.toFixed(2)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-purple-500/60 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Method</label>
                    <select
                      value={form.method}
                      onChange={e => setForm(inv._id, 'method', e.target.value)}
                      className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-500/60 transition"
                    >
                      {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => handlePay(inv)}
                  disabled={paying === inv._id}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition"
                >
                  {paying === inv._id && <Loader2 size={14} className="animate-spin" />}
                  {paying === inv._id ? 'Processing…' : 'Record Payment'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Payments;
