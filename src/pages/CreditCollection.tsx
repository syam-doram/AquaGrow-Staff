/**
 * CreditCollection.tsx
 * Staff page for recording credit (outstanding) payment collections from farmers.
 * Does NOT create a new sale - only reduces farmer outstanding balance.
 *
 * Endpoints:
 *   GET  /api/farmers?q=                           -> search farmers
 *   GET  /api/farmers/:id                          -> { totalCredit, name, phoneNumber, ... }
 *   GET  /api/sales/invoices?farmerId=&status=finalized -> credit invoices
 *   POST /api/farmers/:id/collect-credit           -> { amount, method, reference, date, notes }
 *   GET  /api/farmers/:id/collections              -> last 10 collections
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import {
  IndianRupee, Search, AlertTriangle, RefreshCw,
  CheckCircle2, User, Phone, FileText, Banknote,
  Smartphone, Building2, Calendar, StickyNote, Info,
  X, ChevronDown,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FarmerSearchResult {
  _id: string;
  name: string;
  phoneNumber?: string;
  location?: string;
}

interface FarmerDetail extends FarmerSearchResult {
  totalCredit: number;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  date?: string;
  createdAt: string;
  total: number;
  paidAmount?: number;
  balance?: number;
  status: string;
}

interface Collection {
  _id: string;
  date?: string;
  createdAt: string;
  amount: number;
  method: string;
  reference?: string;
  recordedBy?: string;
  notes?: string;
}

type PaymentMethod = 'cash' | 'upi' | 'bank_transfer';

interface CollectForm {
  amount: string;
  method: PaymentMethod;
  reference: string;
  date: string;
  notes: string;
}

interface ToastState { msg: string; type: 'success' | 'error' }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtRs = (n?: number) =>
  n != null ? `\u20b9${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '\u2014';

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014';

const todayISO = () => new Date().toISOString().slice(0, 10);

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
};

// ─── Spinner ─────────────────────────────────────────────────────────────────

const Spinner = ({ size = 20 }: { size?: number }) => (
  <div
    style={{ width: size, height: size }}
    className="border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin shrink-0"
  />
);

// ─── Toast ───────────────────────────────────────────────────────────────────

const Toast = ({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) => (
  <div
    className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold shadow-2xl ${
      toast.type === 'success' ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'
    }`}
  >
    {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
    {toast.msg}
    <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100">
      <X size={13} />
    </button>
  </div>
);

// ─── Main ────────────────────────────────────────────────────────────────────

const CreditCollection: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FarmerSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [farmer, setFarmer] = useState<FarmerDetail | null>(null);
  const [farmerLoading, setFarmerLoading] = useState(false);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  const [form, setForm] = useState<CollectForm>({
    amount: '',
    method: 'cash',
    reference: '',
    date: todayISO(),
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, type: ToastState['type'] = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

  // Debounced farmer search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setDropdownOpen(false);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get('/farmers?q=' + encodeURIComponent(searchQuery));
        const list: FarmerSearchResult[] = Array.isArray(res.data)
          ? (res.data as FarmerSearchResult[])
          : ((res.data as { farmers?: FarmerSearchResult[] })?.farmers ?? []);
        setSearchResults(list.slice(0, 8));
        setDropdownOpen(list.length > 0);
      } catch {
        setSearchResults([]);
        setDropdownOpen(false);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  }, [searchQuery]);

  const loadFarmerData = useCallback(async (id: string) => {
    setFarmerLoading(true);
    setInvoicesLoading(true);
    setCollectionsLoading(true);

    try {
      const r = await api.get('/farmers/' + id);
      setFarmer(r.data as FarmerDetail);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to load farmer';
      showToast(msg, 'error');
    } finally {
      setFarmerLoading(false);
    }

    try {
      const r = await api.get('/sales/invoices?farmerId=' + id + '&status=finalized');
      const list: Invoice[] = Array.isArray(r.data)
        ? (r.data as Invoice[])
        : ((r.data as { invoices?: Invoice[] })?.invoices ?? []);
      setInvoices(list);
    } catch {
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }

    try {
      const r = await api.get('/farmers/' + id + '/collections');
      const list: Collection[] = Array.isArray(r.data)
        ? (r.data as Collection[])
        : ((r.data as { collections?: Collection[] })?.collections ?? []);
      setCollections(list.slice(0, 10));
    } catch {
      setCollections([]);
    } finally {
      setCollectionsLoading(false);
    }
  }, []);

  const selectFarmer = (f: FarmerSearchResult) => {
    setSearchQuery(f.name);
    setDropdownOpen(false);
    setFarmer(null);
    setInvoices([]);
    setCollections([]);
    setForm({ amount: '', method: 'cash', reference: '', date: todayISO(), notes: '' });
    loadFarmerData(f._id);
  };

  const clearFarmer = () => {
    setSearchQuery('');
    setFarmer(null);
    setInvoices([]);
    setCollections([]);
    setForm({ amount: '', method: 'cash', reference: '', date: todayISO(), notes: '' });
  };

  const reloadFarmer = useCallback(async () => {
    if (!farmer) return;
    try {
      const r = await api.get('/farmers/' + farmer._id);
      setFarmer(r.data as FarmerDetail);
    } catch { /* silent */ }
    try {
      const r = await api.get('/farmers/' + farmer._id + '/collections');
      const list: Collection[] = Array.isArray(r.data)
        ? (r.data as Collection[])
        : ((r.data as { collections?: Collection[] })?.collections ?? []);
      setCollections(list.slice(0, 10));
    } catch { /* silent */ }
  }, [farmer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmer) return;
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (farmer.totalCredit > 0 && amt > farmer.totalCredit) {
      showToast(`Amount exceeds outstanding balance (${fmtRs(farmer.totalCredit)})`, 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/farmers/' + farmer._id + '/collect-credit', {
        amount: amt,
        method: form.method,
        reference: form.reference.trim() || undefined,
        date: form.date,
        notes: form.notes.trim() || undefined,
      });
      showToast(`${fmtRs(amt)} collected successfully`, 'success');
      setForm({ amount: '', method: 'cash', reference: '', date: todayISO(), notes: '' });
      await reloadFarmer();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Collection failed';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const outstanding = farmer?.totalCredit ?? 0;
  const needsRef = form.method === 'upi' || form.method === 'bank_transfer';

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen space-y-6 pb-16 p-4 md:p-6">

      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <IndianRupee size={15} className="text-purple-400" />
          </div>
          <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Finance</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Credit Collection</h1>
        <p className="text-zinc-400 text-sm">Collect outstanding payments from farmers</p>
      </div>

      {/* Farmer Search */}
      <div className="bg-white/4 border border-white/8 rounded-2xl p-4 relative">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Select Farmer</p>
        <div className="relative">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
            <Search size={14} className="text-zinc-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name or phone..."
              className="bg-transparent flex-1 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              autoComplete="off"
            />
            {searchLoading && <Spinner size={14} />}
            {farmer && (
              <button onClick={clearFarmer} className="text-zinc-500 hover:text-zinc-200 transition-colors">
                <X size={14} />
              </button>
            )}
            {!farmer && searchQuery && <ChevronDown size={14} className="text-zinc-500" />}
          </div>

          {dropdownOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
              {searchResults.map(f => (
                <button
                  key={f._id}
                  onClick={() => selectFarmer(f)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <User size={13} className="text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-100 truncate">{f.name}</p>
                    {f.phoneNumber && (
                      <p className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                        <Phone size={9} /> {f.phoneNumber}
                        {f.location && <span className="ml-1">\u00b7 {f.location}</span>}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {farmerLoading && (
          <div className="mt-4 flex items-center gap-3 p-4 bg-white/3 rounded-xl">
            <Spinner size={18} />
            <span className="text-sm text-zinc-400">Loading farmer data...</span>
          </div>
        )}

        {farmer && !farmerLoading && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/3 border border-white/8 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center shrink-0">
                <User size={16} className="text-purple-400" />
              </div>
              <div>
                <p className="text-base font-bold text-zinc-100">{farmer.name}</p>
                {farmer.phoneNumber && (
                  <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                    <Phone size={10} /> {farmer.phoneNumber}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-0.5">Outstanding Balance</p>
              <p className={`text-2xl font-bold font-mono ${outstanding > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {fmtRs(outstanding)}
              </p>
              {outstanding <= 0 && (
                <span className="text-[10px] text-emerald-400 font-bold">No outstanding dues</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Credit Invoices */}
      {farmer && (
        <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={14} className="text-amber-400" />
            <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Credit / Unpaid Invoices</p>
          </div>

          {invoicesLoading ? (
            <div className="flex items-center gap-3 py-6 justify-center">
              <Spinner size={18} />
              <span className="text-sm text-zinc-400">Loading invoices...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-8 text-center">
              <FileText size={28} className="text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">No finalized credit invoices found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Invoice #', 'Date', 'Total', 'Paid', 'Balance'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] text-zinc-500 font-bold uppercase tracking-widest whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {invoices.map(inv => {
                    const paid = inv.paidAmount ?? 0;
                    const balance = inv.balance ?? (inv.total - paid);
                    return (
                      <tr key={inv._id} className="hover:bg-white/2 transition-colors">
                        <td className="px-3 py-2.5 font-bold text-zinc-200">{inv.invoiceNumber}</td>
                        <td className="px-3 py-2.5 text-zinc-400">{fmtDate(inv.date ?? inv.createdAt)}</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-200">{fmtRs(inv.total)}</td>
                        <td className="px-3 py-2.5 font-mono text-emerald-400">{fmtRs(paid)}</td>
                        <td className={`px-3 py-2.5 font-mono font-bold ${balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {fmtRs(balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Collection Form */}
      {farmer && outstanding > 0 && (
        <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <IndianRupee size={14} className="text-purple-400" />
            <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Record Collection</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Amount */}
            <div>
              <label className="text-xs text-zinc-400 font-bold block mb-1.5">
                Amount <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  <IndianRupee size={12} />
                </span>
                <input
                  type="number"
                  min="1"
                  max={outstanding}
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder={`Max ${fmtRs(outstanding)}`}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-purple-500/60 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Method */}
            <div>
              <label className="text-xs text-zinc-400 font-bold block mb-1.5">
                Payment Method <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                {(['cash', 'upi', 'bank_transfer'] as PaymentMethod[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, method: m, reference: '' }))}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                      form.method === m
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                        : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/20'
                    }`}
                  >
                    {m === 'cash' && <Banknote size={13} />}
                    {m === 'upi' && <Smartphone size={13} />}
                    {m === 'bank_transfer' && <Building2 size={13} />}
                    {METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference */}
            {needsRef && (
              <div>
                <label className="text-xs text-zinc-400 font-bold block mb-1.5">
                  {form.method === 'upi' ? 'UPI / Transaction ID' : 'Bank Ref / UTR'}
                  <span className="text-zinc-600 font-normal ml-1">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder={form.method === 'upi' ? 'e.g. 123456789012' : 'e.g. UTR123456789'}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-purple-500/60 transition-colors"
                />
              </div>
            )}

            {/* Date */}
            <div>
              <label className="text-xs text-zinc-400 font-bold flex items-center gap-1 mb-1.5">
                <Calendar size={11} /> Collection Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-purple-500/60 transition-colors"
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-zinc-400 font-bold flex items-center gap-1 mb-1.5">
                <StickyNote size={11} /> Notes
              </label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional remarks..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-purple-500/60 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !form.amount}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              {submitting ? (
                <><Spinner size={15} /> Processing...</>
              ) : (
                <><IndianRupee size={15} /> Record Collection</>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Cleared / no outstanding state */}
      {farmer && outstanding <= 0 && !farmerLoading && (
        <div className="bg-white/4 border border-white/8 rounded-2xl p-6 text-center">
          <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-3" />
          <p className="text-emerald-400 font-bold">No outstanding balance</p>
          <p className="text-zinc-500 text-sm mt-1">This farmer has no pending credit dues.</p>
        </div>
      )}

      {/* Recent Collections */}
      {farmer && (
        <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw size={14} className="text-blue-400" />
            <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">Recent Collections</p>
            <span className="ml-auto text-[10px] text-zinc-600">(last 10)</span>
          </div>

          {collectionsLoading ? (
            <div className="flex items-center gap-3 py-6 justify-center">
              <Spinner size={18} />
              <span className="text-sm text-zinc-400">Loading collections...</span>
            </div>
          ) : collections.length === 0 ? (
            <div className="py-8 text-center">
              <IndianRupee size={28} className="text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">No collections recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Date', 'Amount', 'Method', 'Reference', 'Recorded By'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] text-zinc-500 font-bold uppercase tracking-widest whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {collections.map(c => (
                    <tr key={c._id} className="hover:bg-white/2 transition-colors">
                      <td className="px-3 py-2.5 text-zinc-400">{fmtDate(c.date ?? c.createdAt)}</td>
                      <td className="px-3 py-2.5 font-bold font-mono text-emerald-400">{fmtRs(c.amount)}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-full">
                          {METHOD_LABELS[c.method as PaymentMethod] ?? c.method}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-zinc-500 font-mono">{c.reference ?? '\u2014'}</td>
                      <td className="px-3 py-2.5 text-zinc-400">{c.recordedBy ?? '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl">
        <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200/70 leading-relaxed">
          <span className="font-bold text-amber-300">Note:</span>{' '}
          Credit collection does NOT create a new sale. It reduces the farmer&apos;s outstanding balance only.
        </p>
      </div>

    </div>
  );
};

export default CreditCollection;
