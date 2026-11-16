import React, { useState } from 'react';
import api from '../services/api';
import { FileText, Search, Loader2, AlertCircle, X, TrendingUp, IndianRupee } from 'lucide-react';

interface LedgerRow {
  type: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  invoiceId?: string;
  paymentId?: string;
  status?: string;
  method?: string;
}

interface LedgerResponse {
  farmerId: string;
  ledger: LedgerRow[];
  totalDebit: number;
  totalCredit: number;
  outstanding: number;
}

interface Farmer { _id: string; name: string; phoneNumber: string; }

const Statement: React.FC = () => {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farmersLoading, setFarmersLoading] = useState(false);
  const [farmerSearch, setFarmerSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);

  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchFarmers = async (q: string) => {
    if (!q.trim()) return;
    setFarmersLoading(true);
    try {
      const { data } = await api.get<Farmer[]>(`/farmers?q=${encodeURIComponent(q)}`);
      setFarmers(data);
    } catch { setFarmers([]); }
    finally { setFarmersLoading(false); }
  };

  const fetchLedger = async () => {
    if (!selectedFarmer) { setError('Select a farmer'); return; }
    setError(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams({ farmerId: selectedFarmer._id, from, to }).toString();
      const { data } = await api.get<LedgerResponse>(`/ledger?${qs}`);
      setLedger(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  const fmtRs = (v: number) => v === 0 ? '—' : `₹${Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText size={24} className="text-zinc-400" /> Farmer Statement
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">View purchase and payment history by farmer</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      <div className="bg-white/4 border border-white/8 rounded-2xl p-4 space-y-3">
        {/* Farmer search */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Farmer</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={selectedFarmer ? selectedFarmer.name : farmerSearch}
              onChange={e => { setFarmerSearch(e.target.value); setSelectedFarmer(null); setShowDrop(true); searchFarmers(e.target.value); }}
              onFocus={() => { if (farmerSearch) setShowDrop(true); }}
              placeholder="Search farmer by name or phone…"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60 transition"
            />
            {farmersLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 animate-spin" />}
          </div>
          {showDrop && farmers.length > 0 && (
            <div className="mt-1 bg-zinc-800 border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
              {farmers.map(f => (
                <button key={f._id} type="button"
                  onClick={() => { setSelectedFarmer(f); setFarmerSearch(f.name); setShowDrop(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/8 text-sm"
                >
                  <span className="text-white font-medium">{f.name}</span>
                  <span className="text-zinc-500 ml-2 text-xs">{f.phoneNumber}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/60 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/60 transition"
            />
          </div>
        </div>

        <button
          onClick={fetchLedger}
          disabled={loading || !selectedFarmer}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Loading…' : 'View Statement'}
        </button>
      </div>

      {ledger && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/4 border border-white/8 rounded-2xl p-4 text-center">
              <p className="text-xs text-zinc-500 mb-1">Total Purchases</p>
              <p className="text-lg font-bold text-blue-400">{fmtRs(ledger.totalDebit)}</p>
            </div>
            <div className="bg-white/4 border border-white/8 rounded-2xl p-4 text-center">
              <p className="text-xs text-zinc-500 mb-1">Total Paid</p>
              <p className="text-lg font-bold text-emerald-400">{fmtRs(ledger.totalCredit)}</p>
            </div>
            <div className={`border rounded-2xl p-4 text-center ${ledger.outstanding > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
              <p className="text-xs text-zinc-500 mb-1">Outstanding</p>
              <p className={`text-lg font-bold ${ledger.outstanding > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {fmtRs(ledger.outstanding)}
              </p>
            </div>
          </div>

          {/* Ledger table */}
          {ledger.ledger.length === 0 ? (
            <p className="text-center text-zinc-500 py-8">No transactions in this period</p>
          ) : (
            <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-5 px-4 py-3 bg-white/4 text-xs font-semibold text-zinc-500 uppercase tracking-widest border-b border-white/8">
                <span className="col-span-2">Description</span>
                <span className="text-right">Debit</span>
                <span className="text-right">Credit</span>
                <span className="text-right">Balance</span>
              </div>
              {ledger.ledger.map((row, idx) => (
                <div key={idx} className="grid grid-cols-5 items-center px-4 py-3 border-b border-white/5 hover:bg-white/4 text-sm">
                  <div className="col-span-2">
                    <p className="text-white font-medium text-xs">{row.description}</p>
                    <p className="text-zinc-600 text-[10px]">{fmtDate(row.date)}</p>
                  </div>
                  <span className="text-right text-xs text-blue-400">{row.debit > 0 ? fmtRs(row.debit) : '—'}</span>
                  <span className="text-right text-xs text-emerald-400">{row.credit > 0 ? fmtRs(row.credit) : '—'}</span>
                  <span className={`text-right text-xs font-semibold ${row.balance > 0 ? 'text-red-400' : row.balance < 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {fmtRs(row.balance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Statement;
