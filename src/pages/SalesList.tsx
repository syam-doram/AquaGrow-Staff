import { useState, useEffect, useCallback } from 'react';
import {
  ReceiptText,
  RefreshCw,
  Search,
  Eye,
  CreditCard,
  X,
  ChevronDown,
  IndianRupee,
} from 'lucide-react';
import api from '../services/api';

// ─── helpers ────────────────────────────────────────────────────────────────
const fmtRs = (v?: number) =>
  v != null ? `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
function todayISO() { return new Date().toISOString().slice(0, 10); }

// ─── types ───────────────────────────────────────────────────────────────────
type InvoiceStatus = 'Draft' | 'Finalized' | 'Paid' | 'Cancelled';
type PaymentMethod = 'Cash' | 'UPI' | 'Credit' | 'Mixed' | '';

interface InvoiceItem {
  productName: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPercent: number;
  lineTotal: number;
}

interface PaymentEntry {
  date: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  farmer: { _id: string; name: string; phone: string };
  date: string;
  items: InvoiceItem[];
  grandTotal: number;
  paidAmount: number;
  outstandingBalance: number;
  paymentMethod: PaymentMethod;
  status: InvoiceStatus;
  cultureId?: string;
  payments: PaymentEntry[];
}

// ─── status badge ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cls: Record<InvoiceStatus, string> = {
    Paid: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    Finalized: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    Cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
    Draft: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${cls[status]}`}>
      {status}
    </span>
  );
}

// ─── PaymentModal ────────────────────────────────────────────────────────────
interface PaymentModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}

function PaymentModal({ invoice, onClose, onSuccess }: PaymentModalProps) {
  const [amount, setAmount] = useState(invoice.outstandingBalance.toString());
  const [method, setMethod] = useState<'Cash' | 'UPI' | 'Credit'>('Cash');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }
    setLoading(true);
    try {
      await api.post(`/api/sales/invoices/${invoice._id}/payment`, {
        amount: amt,
        method,
        reference: method === 'UPI' ? reference : undefined,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">Record Payment</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-zinc-400 mb-4">
          Invoice {invoice.invoiceNumber} · Outstanding: {fmtRs(invoice.outstandingBalance)}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Amount ₹</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={invoice.outstandingBalance}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Method</label>
            <div className="flex gap-2">
              {(['Cash', 'UPI', 'Credit'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    method === m
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {method === 'UPI' && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1">UPI Reference</label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Transaction ID / UTR"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60"
              />
            </div>
          )}
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-zinc-300 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm text-white font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Recording…' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── BillDetailModal ──────────────────────────────────────────────────────────
interface BillDetailModalProps {
  invoice: Invoice;
  onClose: () => void;
  onPaymentRecorded: () => void;
}

function BillDetailModal({ invoice, onClose, onPaymentRecorded }: BillDetailModalProps) {
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState(invoice.outstandingBalance.toString());
  const [payMethod, setPayMethod] = useState<'Cash' | 'UPI' | 'Credit'>('Cash');
  const [payRef, setPayRef] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');

  async function handleInlinePayment(e: React.FormEvent) {
    e.preventDefault();
    setPayError('');
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { setPayError('Enter a valid amount'); return; }
    setPayLoading(true);
    try {
      await api.post(`/api/sales/invoices/${invoice._id}/payment`, {
        amount: amt,
        method: payMethod,
        reference: payMethod === 'UPI' ? payRef : undefined,
      });
      onPaymentRecorded();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setPayError(e?.response?.data?.message ?? 'Failed to record payment');
    } finally {
      setPayLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/8 sticky top-0 bg-zinc-900">
          <div>
            <h3 className="text-white font-semibold">Invoice {invoice.invoiceNumber}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{fmtDate(invoice.date)}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={invoice.status} />
            <button onClick={onClose} className="text-zinc-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
            <p className="text-xs text-zinc-400 mb-2 font-medium uppercase tracking-wide">Farmer</p>
            <p className="text-white font-medium">{invoice.farmer.name}</p>
            <p className="text-zinc-400 text-sm">{invoice.farmer.phone}</p>
            {invoice.cultureId && (
              <p className="text-zinc-500 text-xs mt-1">Culture: {invoice.cultureId}</p>
            )}
          </div>

          <div>
            <p className="text-xs text-zinc-400 mb-2 font-medium uppercase tracking-wide">Items</p>
            <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-left text-zinc-400 text-xs font-medium px-4 py-2.5">Product</th>
                    <th className="text-right text-zinc-400 text-xs font-medium px-4 py-2.5">Qty</th>
                    <th className="text-right text-zinc-400 text-xs font-medium px-4 py-2.5">Rate</th>
                    <th className="text-right text-zinc-400 text-xs font-medium px-4 py-2.5">Disc%</th>
                    <th className="text-right text-zinc-400 text-xs font-medium px-4 py-2.5">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-2.5 text-white">
                        {item.productName}
                        <span className="text-zinc-500 text-xs ml-1">{item.unit}</span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-200 text-right">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-zinc-200 text-right">{fmtRs(item.rate)}</td>
                      <td className="px-4 py-2.5 text-zinc-400 text-right">
                        {item.discountPercent ? `${item.discountPercent}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-white font-medium text-right">{fmtRs(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/8 bg-white/2">
                    <td colSpan={4} className="px-4 py-2.5 text-zinc-300 font-medium text-right">Grand Total</td>
                    <td className="px-4 py-2.5 text-emerald-400 font-semibold text-right">{fmtRs(invoice.grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {invoice.payments && invoice.payments.length > 0 && (
            <div>
              <p className="text-xs text-zinc-400 mb-2 font-medium uppercase tracking-wide">Payment History</p>
              <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left text-zinc-400 text-xs font-medium px-4 py-2.5">Date</th>
                      <th className="text-left text-zinc-400 text-xs font-medium px-4 py-2.5">Method</th>
                      <th className="text-right text-zinc-400 text-xs font-medium px-4 py-2.5">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((p, idx) => (
                      <tr key={idx} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-2.5 text-zinc-300">{fmtDate(p.date)}</td>
                        <td className="px-4 py-2.5 text-zinc-300">{p.method}</td>
                        <td className="px-4 py-2.5 text-emerald-400 font-medium text-right">{fmtRs(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between bg-white/4 border border-white/8 rounded-2xl p-4">
            <span className="text-zinc-300 text-sm">Outstanding Balance</span>
            <span className={`font-semibold text-lg ${invoice.outstandingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {fmtRs(invoice.outstandingBalance)}
            </span>
          </div>

          {invoice.outstandingBalance > 0 && invoice.status !== 'Cancelled' && (
            <div>
              {!showPayForm ? (
                <button
                  onClick={() => setShowPayForm(true)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <IndianRupee size={15} />
                  Record Payment
                </button>
              ) : (
                <form onSubmit={handleInlinePayment} className="bg-white/4 border border-white/8 rounded-2xl p-4 space-y-3">
                  <p className="text-sm text-white font-medium mb-1">Record Payment</p>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-zinc-400 mb-1">Amount ₹</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={invoice.outstandingBalance}
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60"
                        required
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-zinc-400 mb-1">Method</label>
                      <div className="relative">
                        <select
                          value={payMethod}
                          onChange={e => setPayMethod(e.target.value as 'Cash' | 'UPI' | 'Credit')}
                          className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/60 pr-8"
                        >
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="Credit">Credit</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                  {payMethod === 'UPI' && (
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">UPI Reference</label>
                      <input
                        type="text"
                        value={payRef}
                        onChange={e => setPayRef(e.target.value)}
                        placeholder="Transaction ID / UTR"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60"
                      />
                    </div>
                  )}
                  {payError && <p className="text-red-400 text-xs">{payError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowPayForm(false)} className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-zinc-300 hover:text-white transition-colors">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={payLoading}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm text-white font-medium transition-colors disabled:opacity-50"
                    >
                      {payLoading ? 'Recording…' : 'Confirm Payment'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SalesList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(todayISO());
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { from: dateFilter, to: dateFilter };
      if (statusFilter !== 'All') params.status = statusFilter;
      const res = await api.get('/api/sales/invoices', { params });
      setInvoices(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [dateFilter, statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const filtered = invoices.filter(inv => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.farmer.name.toLowerCase().includes(q) ||
      inv.farmer.phone.includes(q)
    );
  });

  const summary = {
    count: invoices.length,
    total: invoices.reduce((s, i) => s + i.grandTotal, 0),
    cash: invoices.filter(i => i.paymentMethod === 'Cash').reduce((s, i) => s + i.paidAmount, 0),
    upi: invoices.filter(i => i.paymentMethod === 'UPI').reduce((s, i) => s + i.paidAmount, 0),
    credit: invoices.filter(i => i.paymentMethod === 'Credit').reduce((s, i) => s + i.paidAmount, 0),
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/15 p-2.5 rounded-xl border border-emerald-500/20">
            <ReceiptText size={22} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Sales Bills</h1>
            <p className="text-zinc-400 text-sm">View bills and record payments</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4 col-span-1">
            <p className="text-xs text-zinc-400 mb-1">Bills Today</p>
            <p className="text-2xl font-bold text-white">{summary.count}</p>
          </div>
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
            <p className="text-xs text-zinc-400 mb-1">Total</p>
            <p className="text-lg font-bold text-emerald-400">{fmtRs(summary.total)}</p>
          </div>
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
            <p className="text-xs text-zinc-400 mb-1">Cash</p>
            <p className="text-lg font-bold text-green-400">{fmtRs(summary.cash)}</p>
          </div>
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
            <p className="text-xs text-zinc-400 mb-1">UPI</p>
            <p className="text-lg font-bold text-blue-400">{fmtRs(summary.upi)}</p>
          </div>
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
            <p className="text-xs text-zinc-400 mb-1">Credit</p>
            <p className="text-lg font-bold text-amber-400">{fmtRs(summary.credit)}</p>
          </div>
        </div>

        <div className="bg-white/4 border border-white/8 rounded-2xl p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Invoice# or farmer name / phone"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60"
            />
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/60"
          />
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-8 text-sm text-white outline-none focus:border-emerald-500/60"
            >
              {['All', 'Draft', 'Finalized', 'Paid', 'Cancelled'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
          <button
            onClick={fetchInvoices}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-zinc-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Desktop table */}
        <div className="hidden md:block bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-zinc-500 text-sm">
              <RefreshCw size={18} className="animate-spin mr-2" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
              <ReceiptText size={36} className="mb-3 opacity-30" />
              <p className="text-sm">No bills found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  {['Invoice#', 'Farmer', 'Date', 'Items', 'Total ₹', 'Method', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left text-zinc-400 text-xs font-medium px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv._id} className="border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors">
                    <td className="px-4 py-3 text-emerald-400 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <p className="text-white">{inv.farmer.name}</p>
                      <p className="text-zinc-500 text-xs">{inv.farmer.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-300 text-xs">{fmtDate(inv.date)}</td>
                    <td className="px-4 py-3 text-zinc-300">{inv.items.length}</td>
                    <td className="px-4 py-3 text-white font-medium">{fmtRs(inv.grandTotal)}</td>
                    <td className="px-4 py-3 text-zinc-300">{inv.paymentMethod || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setDetailInvoice(inv)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-300 hover:text-white transition-colors"
                        >
                          <Eye size={12} /> View
                        </button>
                        {(inv.status === 'Finalized' || inv.status === 'Draft') && inv.outstandingBalance > 0 && (
                          <button
                            onClick={() => setPayInvoice(inv)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 hover:text-emerald-200 transition-colors"
                          >
                            <CreditCard size={12} /> Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
              <RefreshCw size={18} className="animate-spin mr-2" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <ReceiptText size={36} className="mb-3 opacity-30" />
              <p className="text-sm">No bills found</p>
            </div>
          ) : (
            filtered.map(inv => (
              <div key={inv._id} className="bg-white/4 border border-white/8 rounded-2xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-emerald-400 font-mono text-xs">{inv.invoiceNumber}</p>
                    <p className="text-white font-medium mt-0.5">{inv.farmer.name}</p>
                    <p className="text-zinc-500 text-xs">{inv.farmer.phone}</p>
                  </div>
                  <StatusBadge status={inv.status} />
                </div>
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-zinc-400">{fmtDate(inv.date)}</span>
                  <span className="text-white font-semibold">{fmtRs(inv.grandTotal)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDetailInvoice(inv)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 hover:text-white transition-colors"
                  >
                    <Eye size={12} /> View
                  </button>
                  {(inv.status === 'Finalized' || inv.status === 'Draft') && inv.outstandingBalance > 0 && (
                    <button
                      onClick={() => setPayInvoice(inv)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 hover:text-emerald-200 transition-colors"
                    >
                      <CreditCard size={12} /> Pay
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {detailInvoice && (
        <BillDetailModal
          invoice={detailInvoice}
          onClose={() => setDetailInvoice(null)}
          onPaymentRecorded={fetchInvoices}
        />
      )}
      {payInvoice && (
        <PaymentModal
          invoice={payInvoice}
          onClose={() => setPayInvoice(null)}
          onSuccess={fetchInvoices}
        />
      )}
    </div>
  );
}
