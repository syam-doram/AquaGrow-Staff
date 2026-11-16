import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  ShoppingCart, Search, Plus, Trash2, Loader2, AlertCircle,
  CheckCircle2, ChevronDown, X, User, IndianRupee,
} from 'lucide-react';

interface Product {
  _id: string;
  name: string;
  code: string;
  company: string;
  baseStockUnit: string;
  approvedSellingRate?: number;
  sellingDiscountPercent?: number;
}

interface Farmer {
  _id: string;
  name: string;
  phoneNumber: string;
}

interface LineItem {
  productId: string;
  productName: string;
  unit: string;
  approvedRate: number;
  maxDiscount: number;
  quantity: string;
  discountPercent: string;
}

const InvoiceCreate: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ invoiceId: string; total: number } | null>(null);

  const [farmerSearch, setFarmerSearch] = useState('');
  const [showFarmerDrop, setShowFarmerDrop] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);

  const [items, setItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDrop, setShowProductDrop] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Product[]>('/products'),
      api.get<Farmer[]>('/farmers'),
    ]).then(([pr, fr]) => {
      setProducts(pr.data.filter(p => p.approvedSellingRate && p.approvedSellingRate > 0));
      setFarmers(fr.data);
    }).catch(() => setError('Failed to load data')).finally(() => setLoading(false));
  }, []);

  const filteredFarmers = farmers.filter(f =>
    !farmerSearch ||
    f.name.toLowerCase().includes(farmerSearch.toLowerCase()) ||
    f.phoneNumber.includes(farmerSearch)
  );

  const filteredProducts = products.filter(p =>
    !productSearch ||
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.code.toLowerCase().includes(productSearch.toLowerCase())
  );

  const addProduct = (p: Product) => {
    if (items.find(i => i.productId === p._id)) { setShowProductDrop(false); setProductSearch(''); return; }
    setItems(prev => [...prev, {
      productId: p._id,
      productName: p.name,
      unit: p.baseStockUnit,
      approvedRate: p.approvedSellingRate!,
      maxDiscount: p.sellingDiscountPercent ?? 0,
      quantity: '1',
      discountPercent: '0',
    }]);
    setProductSearch('');
    setShowProductDrop(false);
  };

  const updateItem = (idx: number, field: 'quantity' | 'discountPercent', val: string) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: val };
      // Cap discount at max
      if (field === 'discountPercent') {
        const disc = parseFloat(val) || 0;
        updated.discountPercent = String(Math.min(disc, item.maxDiscount));
      }
      return updated;
    }));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const lineTotal = (item: LineItem) => {
    const qty = parseFloat(item.quantity) || 0;
    const disc = parseFloat(item.discountPercent) || 0;
    return item.approvedRate * qty * (1 - disc / 100);
  };

  const totalAmount = items.reduce((s, item) => s + lineTotal(item), 0);
  const fmtRs = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmer) { setError('Select a farmer'); return; }
    if (!items.length) { setError('Add at least one product'); return; }
    for (const item of items) {
      if (!parseFloat(item.quantity) || parseFloat(item.quantity) <= 0) {
        setError(`Enter a valid quantity for ${item.productName}`); return;
      }
    }

    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.post('/invoices', {
        farmerId: selectedFarmer._id,
        items: items.map(item => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity),
          discountPercent: parseFloat(item.discountPercent) || 0,
        })),
        ...(paymentAmount && Number(paymentAmount) > 0
          ? { payment: { amount: Number(paymentAmount), method: paymentMethod } }
          : {}),
        idempotencyKey: `${selectedFarmer._id}-${Date.now()}`,
      });
      setSuccess({ invoiceId: data._id, total: data.totalAmount });
      setItems([]);
      setSelectedFarmer(null);
      setFarmerSearch('');
      setPaymentAmount('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={28} className="animate-spin text-emerald-400" />
    </div>
  );

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShoppingCart size={24} className="text-emerald-400" /> Create Invoice
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">Multi-product farmer bill. Server verifies all rates.</p>
      </div>

      {success && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <CheckCircle2 size={18} /> Invoice Created!
          </div>
          <p className="text-sm">Total: {fmtRs(success.total)} · ID: {success.invoiceId.slice(-8)}</p>
          <button onClick={() => setSuccess(null)} className="mt-2 text-xs underline text-emerald-400/70">Create another</button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Farmer select */}
        <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Farmer *</label>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={selectedFarmer ? selectedFarmer.name : farmerSearch}
              onChange={e => { setFarmerSearch(e.target.value); setSelectedFarmer(null); setShowFarmerDrop(true); }}
              onFocus={() => setShowFarmerDrop(true)}
              placeholder="Search farmer by name or phone…"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60 transition"
            />
          </div>
          {showFarmerDrop && filteredFarmers.length > 0 && (
            <div className="mt-1 bg-zinc-800 border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
              {filteredFarmers.slice(0, 15).map(f => (
                <button
                  key={f._id} type="button"
                  onClick={() => { setSelectedFarmer(f); setFarmerSearch(f.name); setShowFarmerDrop(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/8 text-sm"
                >
                  <span className="text-white font-medium">{f.name}</span>
                  <span className="text-zinc-500 ml-2 text-xs">{f.phoneNumber}</span>
                </button>
              ))}
            </div>
          )}
          {selectedFarmer && (
            <p className="text-xs text-emerald-400 mt-1.5">✓ {selectedFarmer.name} · {selectedFarmer.phoneNumber}</p>
          )}
        </div>

        {/* Products */}
        <div className="bg-white/4 border border-white/8 rounded-2xl p-4 space-y-3">
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest">Products *</label>

          {/* Add product search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={productSearch}
              onChange={e => { setProductSearch(e.target.value); setShowProductDrop(true); }}
              onFocus={() => setShowProductDrop(true)}
              placeholder="Search to add product…"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-blue-500/60 transition"
            />
            {showProductDrop && filteredProducts.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-zinc-800 border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                {filteredProducts.slice(0, 15).map(p => (
                  <button
                    key={p._id} type="button"
                    onClick={() => addProduct(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/8 text-sm flex justify-between items-center"
                  >
                    <span className="text-white font-medium">{p.name}</span>
                    <span className="text-emerald-400 text-xs font-semibold">
                      ₹{p.approvedSellingRate?.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {p.baseStockUnit}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Line items */}
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item, idx) => {
                const total = lineTotal(item);
                return (
                  <div key={item.productId} className="bg-white/4 border border-white/8 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.productName}</p>
                        <p className="text-xs text-zinc-500">Rate: ₹{item.approvedRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {item.unit}</p>
                      </div>
                      <button type="button" onClick={() => removeItem(idx)} className="p-1 text-zinc-600 hover:text-red-400 transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1">Qty ({item.unit})</label>
                        <input
                          type="number" min="0.01" step="any"
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-500/60 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1">Discount % (max {item.maxDiscount}%)</label>
                        <input
                          type="number" min="0" max={item.maxDiscount} step="0.5"
                          value={item.discountPercent}
                          onChange={e => updateItem(idx, 'discountPercent', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-500/60 transition"
                        />
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="block text-[10px] text-zinc-500 mb-1">Total</label>
                        <p className="text-sm font-bold text-white py-1.5">{fmtRs(total)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Total row */}
              <div className="flex justify-between items-center px-1 pt-1 border-t border-white/8">
                <span className="text-sm font-semibold text-zinc-400">Grand Total</span>
                <span className="text-lg font-bold text-white">{fmtRs(totalAmount)}</span>
              </div>
            </div>
          )}

          {items.length === 0 && (
            <p className="text-center text-zinc-600 text-sm py-4">No items added yet</p>
          )}
        </div>

        {/* Payment */}
        {items.length > 0 && (
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4 space-y-3">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest">Payment (optional)</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Method</label>
                <select
                  value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/60 transition"
                >
                  {['Cash', 'UPI', 'Bank', 'Credit', 'Mixed'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Amount (₹)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                  placeholder={totalAmount > 0 ? totalAmount.toFixed(2) : '0.00'}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60 transition"
                />
              </div>
            </div>
            {paymentAmount && Number(paymentAmount) < totalAmount && (
              <p className="text-xs text-amber-400">Outstanding: {fmtRs(totalAmount - Number(paymentAmount))}</p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !selectedFarmer || !items.length}
          className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl text-sm transition shadow-lg shadow-emerald-500/20"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {submitting ? 'Creating Invoice…' : `Create Invoice · ${fmtRs(totalAmount)}`}
        </button>
      </form>
    </div>
  );
};

export default InvoiceCreate;
