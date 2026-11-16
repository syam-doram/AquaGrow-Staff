import React, { useState, useEffect, useRef } from 'react';
import { Sprout, AlertCircle, Loader2, CheckCircle2, X, Search, User } from 'lucide-react';
import api from '../services/api';

interface Farmer {
  _id: string;
  name: string;
  phoneNumber?: string;
}

interface SubmittedDraft {
  _id: string;
  farmerId: string;
  farmerName?: string;
  pondId: string;
  weightKg: number;
  date: string;
  notes?: string;
  status: string;
}

const HarvestDraft: React.FC = () => {
  // Farmer search
  const [farmerQuery, setFarmerQuery] = useState('');
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [farmersLoading, setFarmersLoading] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [pondId, setPondId] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedDraft | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced farmer search
  useEffect(() => {
    if (farmerQuery.length < 2) { setFarmers([]); return; }
    const t = setTimeout(async () => {
      setFarmersLoading(true);
      try {
        const { data } = await api.get<Farmer[]>('/farmers', { params: { q: farmerQuery } });
        setFarmers(Array.isArray(data) ? data : []);
        setShowDropdown(true);
      } catch {
        setFarmers([]);
      } finally {
        setFarmersLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [farmerQuery]);

  const selectFarmer = (f: Farmer) => {
    setSelectedFarmer(f);
    setFarmerQuery(f.name);
    setShowDropdown(false);
  };

  const clearFarmer = () => {
    setSelectedFarmer(null);
    setFarmerQuery('');
    setFarmers([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmer) { setError('Select a farmer from the search list'); return; }
    if (!pondId.trim())  { setError('Pond ID is required'); return; }
    if (!weightKg || Number(weightKg) <= 0) { setError('Enter a valid weight in kg'); return; }

    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.post<SubmittedDraft>('/harvests', {
        farmerId:   selectedFarmer._id,
        farmerName: selectedFarmer.name,
        pondId:     pondId.trim(),
        weightKg:   Number(weightKg),
        date,
        notes: notes.trim(),
      });
      setSubmitted(data);
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Submission failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSubmitted(null);
    clearFarmer();
    setPondId('');
    setWeightKg('');
    setDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setError(null);
  };

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sprout size={24} className="text-lime-400" /> Harvest Draft
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          Record a harvest. Owner will review and finalize settlement.
        </p>
      </div>

      {/* Success */}
      {submitted && (
        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <p className="font-bold">Harvest draft submitted!</p>
          </div>
          <div className="text-xs text-emerald-300 space-y-0.5">
            <p><span className="text-zinc-500">Farmer:</span> {submitted.farmerName ?? submitted.farmerId}</p>
            <p><span className="text-zinc-500">Pond:</span> {submitted.pondId}</p>
            <p><span className="text-zinc-500">Weight:</span> {submitted.weightKg} kg</p>
            <p><span className="text-zinc-500">Date:</span> {new Date(submitted.date).toLocaleDateString('en-IN')}</p>
            <p><span className="text-zinc-500">Status:</span> {submitted.status}</p>
          </div>
          <button
            onClick={reset}
            className="mt-2 text-xs underline text-emerald-400 hover:text-emerald-300"
          >
            Submit another
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {!submitted && (
        <form onSubmit={handleSubmit} className="bg-white/4 border border-white/8 rounded-2xl p-5 space-y-4">

          {/* Farmer search */}
          <div ref={dropdownRef} className="relative">
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Farmer *
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={farmerQuery}
                onChange={e => { setFarmerQuery(e.target.value); if (selectedFarmer) setSelectedFarmer(null); }}
                onFocus={() => farmers.length > 0 && setShowDropdown(true)}
                placeholder="Type farmer name or phone…"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-lime-500/60 transition"
              />
              {farmersLoading && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 animate-spin" />
              )}
              {selectedFarmer && !farmersLoading && (
                <button
                  type="button"
                  onClick={clearFarmer}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            {showDropdown && farmers.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                {farmers.map(f => (
                  <button
                    key={f._id}
                    type="button"
                    onClick={() => selectFarmer(f)}
                    className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition flex items-center gap-2"
                  >
                    <User size={13} className="text-zinc-500 shrink-0" />
                    <div>
                      <p className="text-sm text-zinc-200 font-medium">{f.name}</p>
                      {f.phoneNumber && <p className="text-xs text-zinc-500">{f.phoneNumber}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedFarmer && (
              <p className="mt-1 text-xs text-lime-400 flex items-center gap-1">
                <CheckCircle2 size={11} /> {selectedFarmer.name} selected
              </p>
            )}
          </div>

          {/* Pond ID */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Pond ID *</label>
            <input
              value={pondId}
              onChange={e => setPondId(e.target.value)}
              placeholder="e.g. P1, Pond-3"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-lime-500/60 transition"
            />
          </div>

          {/* Weight + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Weight (kg) *</label>
              <input
                type="number" min="0.1" step="any"
                value={weightKg}
                onChange={e => setWeightKg(e.target.value)}
                placeholder="0.0"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-lime-500/60 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Date *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-lime-500/60 transition"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional notes about this harvest…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-lime-500/60 transition resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-lime-600 hover:bg-lime-500 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            {submitting ? 'Submitting…' : 'Submit Harvest Draft'}
          </button>
        </form>
      )}
    </div>
  );
};

export default HarvestDraft;
