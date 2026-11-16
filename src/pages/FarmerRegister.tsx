/**
 * FarmerRegister — Staff portal
 * Register a new farmer. No edit option (admin-only).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Search, Phone, MapPin, Layers, Loader2, AlertCircle, CheckCircle, X,
} from 'lucide-react';
import api from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Farmer {
  _id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  location?: string;
  farmSize?: number;
  createdAt?: string;
}

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition';

// ─── Register Modal ───────────────────────────────────────────────────────────
interface ModalProps {
  onClose: () => void;
  onRegistered: (f: Farmer) => void;
}

const RegisterModal: React.FC<ModalProps> = ({ onClose, onRegistered }) => {
  const [form, setForm] = useState({ name: '', phoneNumber: '', email: '', location: '', farmSize: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim())        return setError('Name is required');
    if (!form.phoneNumber.trim()) return setError('Phone number is required');
    setSaving(true);
    try {
      const { data } = await api.post<Farmer>('/farmers', {
        name: form.name.trim(),
        phoneNumber: form.phoneNumber.trim(),
        email: form.email.trim() || undefined,
        location: form.location.trim() || undefined,
        farmSize: form.farmSize ? Number(form.farmSize) : 0,
        password: form.password.trim() || form.phoneNumber.trim(),
      });
      onRegistered(data);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Registration failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <p className="text-sm font-bold text-white">Register New Farmer</p>
            <p className="text-xs text-zinc-500 mt-0.5">Default password = phone number</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/8 transition">
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />{error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Full Name *</label>
            <input className={inputCls} placeholder="Ravi Kumar" value={form.name} onChange={set('name')} required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Phone Number *</label>
            <input className={inputCls} placeholder="9876543210" value={form.phoneNumber} onChange={set('phoneNumber')} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Location</label>
              <input className={inputCls} placeholder="Nellore" value={form.location} onChange={set('location')} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Farm Size (ac)</label>
              <input className={inputCls} type="number" min="0" step="0.5" placeholder="2.5" value={form.farmSize} onChange={set('farmSize')} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Email (optional)</label>
            <input className={inputCls} type="email" placeholder="farmer@example.com" value={form.email} onChange={set('email')} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 bg-white/5 hover:bg-white/10 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving…' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const FarmerRegister: React.FC = () => {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const { data } = await api.get<Farmer[]>('/farmers', { params: { q, limit: 200 } });
      setFarmers(data);
    } catch {
      // silent — ProtectedRoute handles auth
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(search || undefined), 350);
    return () => clearTimeout(t);
  }, [search, load]);

  const handleRegistered = (farmer: Farmer) => {
    setFarmers(prev => [farmer, ...prev]);
    setShowModal(false);
    showSuccess(`${farmer.name} registered successfully`);
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold text-white bg-emerald-600">
          <CheckCircle size={15} /> {toast}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <RegisterModal onClose={() => setShowModal(false)} onRegistered={handleRegistered} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users size={22} className="text-emerald-400" /> Farmer Register
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">{farmers.length} farmers · tap + to register new</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition shadow-lg shadow-emerald-500/20"
        >
          <Plus size={16} /> Register Farmer
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/50 transition"
          placeholder="Search by name or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-emerald-400" />
          </div>
        ) : farmers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
            <Users size={36} className="mb-3 opacity-30" />
            <p className="text-sm">{search ? 'No farmers match your search' : 'No farmers yet'}</p>
            {!search && (
              <button onClick={() => setShowModal(true)} className="mt-2 text-emerald-400 text-sm hover:underline">
                Register first farmer →
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {farmers.map(f => (
              <div key={f._id} className="flex items-center gap-4 px-4 py-3.5 hover:bg-white/3 transition">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">
                  {f.name.charAt(0).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{f.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><Phone size={10} />{f.phoneNumber}</span>
                    {f.location && <span className="flex items-center gap-1"><MapPin size={10} />{f.location}</span>}
                    {f.farmSize ? <span className="flex items-center gap-1"><Layers size={10} />{f.farmSize} ac</span> : null}
                  </div>
                </div>
                {/* Date */}
                <div className="text-xs text-zinc-600 shrink-0">
                  {f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-IN') : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FarmerRegister;
