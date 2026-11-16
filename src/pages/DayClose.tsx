import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { ClipboardCheck, AlertCircle, Loader2, CheckCircle2, X } from 'lucide-react';

interface Product { _id: string; name: string; baseStockUnit: string; }

interface PhysicalCount { [productId: string]: string; }

const DayClose: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<PhysicalCount>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    api.get<Product[]>('/products')
      .then(r => { setProducts(r.data); })
      .catch(() => setError('Failed to load products'))
      .finally(() => setLoading(false));
  }, []);

  const setCount = (id: string, val: string) => setCounts(prev => ({ ...prev, [id]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Build physicalCount: products with no entry default to 0
    const physicalCount: Record<string, number> = {};
    for (const p of products) {
      physicalCount[p._id] = Number(counts[p._id] ?? 0);
    }

    setError(null);
    setSubmitting(true);
    try {
      await api.post('/dayclose', {
        date: today,
        physicalCount,
      });
      setSuccess(true);
      setCounts({});
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit day close');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 size={28} className="animate-spin text-emerald-400" /></div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ClipboardCheck size={24} className="text-teal-400" /> Day Close
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">Enter physical stock count for {today}. Owner will approve.</p>
      </div>

      {success && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <CheckCircle2 size={18} /> Day Close Submitted!
          </div>
          <p className="text-sm">The owner will review and approve the reconciliation.</p>
          <button onClick={() => setSuccess(false)} className="mt-2 text-xs underline text-emerald-400/70">Submit another</button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {!success && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="bg-white/4 border border-white/8 rounded-2xl divide-y divide-white/6">
            <div className="grid grid-cols-3 px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-widest">
              <span>Product</span>
              <span className="text-center">Unit</span>
              <span className="text-right">Physical Count</span>
            </div>
            {products.map(p => (
              <div key={p._id} className="grid grid-cols-3 items-center px-4 py-3">
                <span className="text-sm text-white font-medium">{p.name}</span>
                <span className="text-xs text-zinc-500 text-center">{p.baseStockUnit}</span>
                <div className="flex justify-end">
                  <input
                    type="number" min="0" step="any"
                    value={counts[p._id] ?? ''}
                    onChange={e => setCount(p._id, e.target.value)}
                    placeholder="0"
                    className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white text-right outline-none focus:border-teal-500/60 transition"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
            ⚠️ Count all items carefully. Variances will be flagged to the owner.
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white font-bold rounded-2xl text-sm transition"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? 'Submitting…' : 'Submit Day Close'}
          </button>
        </form>
      )}
    </div>
  );
};

export default DayClose;
