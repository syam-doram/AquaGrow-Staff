import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  ShoppingCart, Search, Trash2, Loader2, AlertCircle,
  CheckCircle2, X, User, IndianRupee, Package,
} from 'lucide-react';

interface Product {
  _id: string;
  name: string;
  code: string;
  company: string;
  category?: string;
  baseStockUnit: string;
  packSize?: number;           // kg per bag (e.g. 20 → 20 kg bag)
  approvedSellingRate?: number; // ₹/kg borrowing (credit) rate
  sellingDiscountPercent?: number; // cash discount %
}

interface Farmer {
  _id: string;
  name: string;
  phoneNumber: string;
}

interface LineItem {
  productId: string;
  productName: string;
  baseUnit: string;         // actual stock unit (kg, L …)
  packSize: number;         // 0 = no bags; >0 = kg per bag
  approvedRate: number;     // ₹/baseUnit (borrowing rate)
  cashDiscountPct: number;  // % cash discount
  quantity: string;         // in bags when packSize > 0, else in baseUnit
  isCash: boolean;          // true → apply cashDiscountPct
}

const fmtRs = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

/** Total in ₹ for a line item */
const lineTotal = (item: LineItem): number => {
  const qty     = parseFloat(item.quantity) || 0;
  const kgQty   = item.packSize > 0 ? qty * item.packSize : qty;
  const disc    = item.isCash ? item.cashDiscountPct : 0;
  return item.approvedRate * kgQty * (1 - disc / 100);
};

const InvoiceCreate: React.FC = () => {
  const [products, setProducts]       = useState<Product[]>([]);
  const [farmers, setFarmers]         = useState<Farmer[]>([]);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<{ invoiceId: string; total: number } | null>(null);

  const [farmerSearch, setFarmerSearch]       = useState('');
  const [showFarmerDrop, setShowFarmerDrop]   = useState(false);
  const [selectedFarmer, setSelectedFarmer]   = useState<Farmer | null>(null);

  const [items, setItems]                     = useState<LineItem[]>([]);
  const [productSearch, setProductSearch]     = useState('');
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
    if (items.find(i => i.productId === p._id)) {
      setShowProductDrop(false); setProductSearch(''); return;
    }
    const packSize = p.packSize ?? 0;
    setItems(prev => [...prev, {
      productId:      p._id,
      productName:    p.name,
      baseUnit:       p.baseStockUnit,
      packSize,
      approvedRate:   p.approvedSellingRate!,
      cashDiscountPct: p.sellingDiscountPercent ?? 0,
      quantity:       '1',
      isCash:         false,
    }]);
    setProductSearch('');
    setShowProductDrop(false);
  };

  const updateQty = (idx: number, val: string) =>
    setItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, quantity: val }));

  const toggleCash = (idx: number) =>
    setItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, isCash: !item.isCash }));

  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx));

  const totalAmount = items.reduce((s, item) => s + lineTotal(item), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmer) { setError('Select a farmer'); return; }
    if (!items.length)   { setError('Add at least one product'); return; }
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
          // Send quantity in baseUnit (kg) — bags × packSize converts to kg
          quantity: item.packSize > 0
            ? parseFloat(item.quantity) * item.packSize
            : parseFloat(item.quantity),
          discountPercent: item.isCash ? item.cashDiscountPct : 0,
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

          {/* Product search */}
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
                {filteredProducts.slice(0, 15).map(p => {
                  const bagLabel = p.packSize && p.packSize > 0
                    ? ` · ₹${((p.approvedSellingRate ?? 0) * p.packSize).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / ${p.packSize}${p.baseStockUnit} bag`
                    : '';
                  return (
                    <button
                      key={p._id} type="button"
                      onClick={() => addProduct(p)}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/8 text-sm flex justify-between items-center gap-2"
                    >
                      <div>
                        <span className="text-white font-medium">{p.name}</span>
                        {p.packSize && p.packSize > 0 && (
                          <span className="ml-2 text-[10px] text-zinc-500">{p.packSize}{p.baseStockUnit}/bag</span>
                        )}
                      </div>
                      <span className="text-emerald-400 text-xs font-semibold shrink-0">
                        ₹{p.approvedSellingRate?.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {p.baseStockUnit}{bagLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Line items */}
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item, idx) => {
                const total         = lineTotal(item);
                const borrowingRate = item.approvedRate;
                const cashRate      = borrowingRate * (1 - item.cashDiscountPct / 100);
                const effectiveRate = item.isCash ? cashRate : borrowingRate;
                const bagRate       = item.packSize > 0 ? effectiveRate * item.packSize : null;
                const qtyLabel      = item.packSize > 0 ? 'bags' : item.baseUnit;
                const kgQty         = item.packSize > 0
                  ? (parseFloat(item.quantity) || 0) * item.packSize
                  : parseFloat(item.quantity) || 0;

                return (
                  <div key={item.productId} className="bg-white/4 border border-white/8 rounded-xl p-3">
                    {/* Product header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Package size={13} className="text-zinc-500 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-white leading-tight">{item.productName}</p>
                          {/* Rate info */}
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-zinc-500">
                              Borrowing: ₹{borrowingRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/{item.baseUnit}
                            </span>
                            {item.cashDiscountPct > 0 && (
                              <span className="text-[10px] text-lime-400">
                                Cash: ₹{cashRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/{item.baseUnit} ({item.cashDiscountPct}% off)
                              </span>
                            )}
                            {item.packSize > 0 && (
                              <span className="text-[10px] text-zinc-600">
                                · {item.packSize}{item.baseUnit}/bag
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeItem(idx)} className="p-1 text-zinc-600 hover:text-red-400 transition shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Controls: qty + cash toggle + total */}
                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1">Qty ({qtyLabel})</label>
                        <input
                          type="number" min="0.01" step={item.packSize > 0 ? '1' : 'any'}
                          value={item.quantity}
                          onChange={e => updateQty(idx, e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-500/60 transition"
                        />
                        {item.packSize > 0 && (parseFloat(item.quantity) || 0) > 0 && (
                          <p className="text-[10px] text-zinc-600 mt-0.5">{kgQty.toLocaleString('en-IN')} {item.baseUnit} total</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1">Rate Type</label>
                        <button
                          type="button"
                          onClick={() => toggleCash(idx)}
                          className={`w-full py-1.5 rounded-lg text-xs font-semibold border transition ${
                            item.isCash
                              ? 'bg-lime-500/15 border-lime-500/40 text-lime-400'
                              : 'bg-zinc-700/40 border-white/10 text-zinc-400'
                          }`}
                        >
                          {item.isCash ? '💵 Cash' : '📋 Borrowing'}
                        </button>
                        {bagRate != null && (
                          <p className="text-[10px] text-zinc-500 mt-0.5 text-center">
                            {fmtRs(bagRate)}/bag
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1">Total</label>
                        <p className="text-sm font-bold text-white py-1.5">{fmtRs(total)}</p>
                        {item.isCash && item.cashDiscountPct > 0 && (
                          <p className="text-[10px] text-lime-400">-{item.cashDiscountPct}% applied</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Grand total */}
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
