import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { PackagePlus, Search, AlertCircle, Loader2, CheckCircle2, ChevronDown, X } from 'lucide-react';

interface Product {
  _id: string;
  name: string;
  code: string;
  company: string;
  category: string;
  unit?: string;
  baseStockUnit: string;
  packSize?: number;
}

interface StockForm {
  supplier: string;
  invoiceNumber: string;
  receiptDate: string;
  productId: string;
  quantity: string;
  unit: string;
  batchNumber: string;
  expiryDate: string;
}

const EMPTY: StockForm = {
  supplier: '', invoiceNumber: '', receiptDate: new Date().toISOString().slice(0, 10),
  productId: '', quantity: '', unit: '', batchNumber: '', expiryDate: '',
};

const StockInward: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [form, setForm] = useState<StockForm>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDrop, setShowProductDrop] = useState(false);

  useEffect(() => {
    api.get<Product[]>('/products').then(r => setProducts(r.data)).catch(() => null).finally(() => setProductsLoading(false));
  }, []);

  const selectedProduct = products.find(p => p._id === form.productId);

  const filteredProducts = products.filter(p =>
    !productSearch ||
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.code.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.company.toLowerCase().includes(productSearch.toLowerCase())
  );

  const set = (k: keyof StockForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSelectProduct = (p: Product) => {
    set('productId', p._id);
    set('unit', p.baseStockUnit);
    setProductSearch(p.name);
    setShowProductDrop(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier.trim()) { setError('Supplier name is required'); return; }
    if (!form.invoiceNumber.trim()) { setError('Invoice number is required'); return; }
    if (!form.productId) { setError('Select a product'); return; }
    if (!form.quantity || Number(form.quantity) <= 0) { setError('Enter a valid quantity'); return; }

    setError(null);
    setSubmitting(true);
    try {
      await api.post('/receipts', {
        supplier: form.supplier.trim(),
        invoiceNumber: form.invoiceNumber.trim(),
        receiptDate: form.receiptDate,
        items: [{
          productId: form.productId,
          quantity: Number(form.quantity),
          unit: form.unit || selectedProduct?.baseStockUnit,
          batchId: form.batchNumber || undefined,
        }],
      });
      setSuccess(`Stock entry saved. Rate pending — owner will approve.`);
      setForm(EMPTY);
      setProductSearch('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save stock entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <PackagePlus size={24} className="text-orange-400" /> Stock Inward
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Record received stock. Purchase cost will be set by owner.</p>
      </div>

      {success && (
        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          <div>{success}</div>
          <button onClick={() => setSuccess(null)} className="ml-auto shrink-0"><X size={14} /></button>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>{error}</div>
          <button onClick={() => setError(null)} className="ml-auto shrink-0"><X size={14} /></button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white/4 border border-white/8 rounded-2xl p-5 space-y-4">
        {/* Supplier */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Supplier Name *</label>
          <input
            value={form.supplier} onChange={e => set('supplier', e.target.value)}
            placeholder="e.g. Sri Rama Traders"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60 transition"
          />
        </div>

        {/* Invoice Number */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Invoice No. *</label>
            <input
              value={form.invoiceNumber} onChange={e => set('invoiceNumber', e.target.value)}
              placeholder="INV-001"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Date *</label>
            <input
              type="date" value={form.receiptDate} onChange={e => set('receiptDate', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/60 transition"
            />
          </div>
        </div>

        {/* Product */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Product *</label>
          {productsLoading
            ? <div className="flex items-center gap-2 text-zinc-500 text-sm"><Loader2 size={14} className="animate-spin" /> Loading products…</div>
            : (
              <div className="relative">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={productSearch}
                    onChange={e => { setProductSearch(e.target.value); setShowProductDrop(true); set('productId', ''); }}
                    onFocus={() => setShowProductDrop(true)}
                    placeholder="Search product by name or code…"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60 transition"
                  />
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                </div>
                {showProductDrop && filteredProducts.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-zinc-800 border border-white/10 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                    {filteredProducts.slice(0, 20).map(p => (
                      <button
                        key={p._id} type="button"
                        onClick={() => handleSelectProduct(p)}
                        className="w-full text-left px-4 py-2.5 hover:bg-white/8 text-sm"
                      >
                        <span className="text-white font-medium">{p.name}</span>
                        <span className="text-zinc-500 ml-2 text-xs">{p.code} · {p.company}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showProductDrop && filteredProducts.length === 0 && productSearch && (
                  <div className="absolute z-20 w-full mt-1 bg-zinc-800 border border-white/10 rounded-xl p-3 text-center text-sm text-zinc-500">
                    No product found. Contact admin to add it.
                  </div>
                )}
              </div>
            )
          }
          {selectedProduct && (
            <p className="text-xs text-emerald-400 mt-1.5">
              ✓ {selectedProduct.name} — base unit: {selectedProduct.baseStockUnit}
              {selectedProduct.packSize ? ` (pack: ${selectedProduct.packSize}${selectedProduct.baseStockUnit})` : ''}
            </p>
          )}
        </div>

        {/* Quantity + Unit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Quantity *</label>
            <input
              type="number" min="0.01" step="any"
              value={form.quantity} onChange={e => set('quantity', e.target.value)}
              placeholder="0.00"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Unit</label>
            <input
              value={form.unit} onChange={e => set('unit', e.target.value)}
              placeholder={selectedProduct?.baseStockUnit || 'kg / bag / bottle'}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60 transition"
            />
          </div>
        </div>

        {/* Batch + Expiry */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Batch No. <span className="text-zinc-600">(optional)</span></label>
            <input
              value={form.batchNumber} onChange={e => set('batchNumber', e.target.value)}
              placeholder="BT-2024-01"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Expiry <span className="text-zinc-600">(optional)</span></label>
            <input
              type="date" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/60 transition"
            />
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
          ⚠️ Purchase cost and selling price will be set by the owner after submission.
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition"
        >
          {submitting && <Loader2 size={15} className="animate-spin" />}
          {submitting ? 'Saving…' : 'Save Stock Entry'}
        </button>
      </form>
    </div>
  );
};

export default StockInward;
