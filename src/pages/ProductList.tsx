import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Package, Search, Loader2, AlertCircle, IndianRupee, RefreshCw } from 'lucide-react';

interface Product {
  _id: string;
  name: string;
  code: string;
  company: string;
  category: string;
  baseStockUnit: string;
  packSize?: number;
  mrp?: number;
  approvedSellingRate?: number;
  sellingDiscountPercent?: number;
  isActive: boolean;
}

const CATEGORIES = ['All', 'Feed', 'Medicine', 'Mineral', 'Equipment', 'Other'];

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const load = () => {
    setLoading(true);
    setError(null);
    api.get<Product[]>('/products')
      .then(r => setProducts(r.data))
      .catch(() => setError('Failed to load products'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter(p => {
    const matchesSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.company.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === 'All' || p.category === category;
    return matchesSearch && matchesCat;
  });

  const fmtRs = (v?: number) => v ? `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package size={24} className="text-blue-400" /> Products
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">Approved selling rates set by owner</p>
        </div>
        <button onClick={load} className="p-2 text-zinc-500 hover:text-white hover:bg-white/8 rounded-xl transition">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, code, company…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60 transition"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                category === cat
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-emerald-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-600">No products match your search</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => (
            <div key={p._id} className="bg-white/4 border border-white/8 rounded-2xl p-4 hover:border-white/16 transition">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{p.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{p.company} · {p.code}</p>
                </div>
                <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
                  p.category === 'Feed' ? 'bg-orange-500/20 text-orange-400' :
                  p.category === 'Medicine' ? 'bg-red-500/20 text-red-400' :
                  p.category === 'Mineral' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-zinc-500/20 text-zinc-400'
                }`}>
                  {p.category}
                </span>
              </div>

              <div className="border-t border-white/6 pt-3 mt-3 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">Selling Rate</span>
                  {p.approvedSellingRate
                    ? <span className="text-sm font-bold text-emerald-400">{fmtRs(p.approvedSellingRate)} / {p.baseStockUnit}</span>
                    : <span className="text-xs text-amber-400 font-medium">Rate pending ⏳</span>
                  }
                </div>
                {p.sellingDiscountPercent != null && p.sellingDiscountPercent > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">Max Discount</span>
                    <span className="text-xs text-lime-400">{p.sellingDiscountPercent}%</span>
                  </div>
                )}
                {p.mrp && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-zinc-500">MRP</span>
                    <span className="text-xs text-zinc-400">{fmtRs(p.mrp)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-600 text-center pt-2">
        {filtered.length} of {products.length} products shown · Purchase costs are not shown to staff
      </p>
    </div>
  );
};

export default ProductList;
