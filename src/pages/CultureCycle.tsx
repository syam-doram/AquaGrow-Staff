import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "../services/api";
import {
  Sprout, Search, AlertCircle, Loader2, X, CheckCircle2,
  ChevronDown, Eye, CalendarDays, Clock, AlertTriangle,
} from "lucide-react";

interface Farmer {
  _id: string;
  name: string;
  phone?: string;
  village?: string;
}

interface Culture {
  _id: string;
  cultureId?: string;
  farmerId: string;
  startDate: string;
  endDate?: string;
  status: "active" | "closed";
  notes?: string;
}

interface SaleItem {
  _id: string;
  invoiceNumber: string;
  date: string;
  productCount: number;
  total: number;
  status: string;
}

interface CultureSales {
  sales: SaleItem[];
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
}

const today = () => new Date().toISOString().slice(0, 10);

const daysDiff = (startDate: string) => {
  const ms = Date.now() - new Date(startDate).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
};

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtRs = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inp =
  "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60 transition";

const StatusBadge: React.FC<{ status: string }> = ({ status }) =>
  status === "active" ? (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
      Active
    </span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-700/60 text-zinc-400 border border-zinc-600/40">
      Closed
    </span>
  );

interface FarmerSearchProps {
  onSelect: (f: Farmer) => void;
  selected: Farmer | null;
  onClear: () => void;
}

const FarmerSearch: React.FC<FarmerSearchProps> = ({ onSelect, selected, onClear }) => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const search = useCallback((val: string) => {
    if (!val.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    api.get<Farmer[]>("/farmers", { params: { q: val } })
      .then(r => { setResults(r.data); setOpen(true); })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQ(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(val), 350);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-3 bg-white/4 border border-white/8 rounded-xl p-3">
        <Sprout size={18} className="text-emerald-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{selected.name}</p>
          {selected.phone && <p className="text-zinc-500 text-xs">{selected.phone}{selected.village ? " · " + selected.village : ""}</p>}
        </div>
        <button onClick={onClear} className="text-zinc-500 hover:text-zinc-300 transition shrink-0">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={q}
          onChange={onChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search farmer by name or phone…"
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/60 transition"
        />
        {loading
          ? <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 animate-spin" />
          : <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        }
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 w-full mt-1 bg-zinc-800 border border-white/10 rounded-xl shadow-xl max-h-56 overflow-y-auto">
          {results.map(f => (
            <button
              key={f._id} type="button"
              onClick={() => { onSelect(f); setQ(""); setResults([]); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-white/8 text-sm flex items-center justify-between"
            >
              <span className="text-white font-medium">{f.name}</span>
              <span className="text-zinc-500 text-xs">{f.phone}{f.village ? " · " + f.village : ""}</span>
            </button>
          ))}
        </div>
      )}
      {open && q && results.length === 0 && !loading && (
        <div className="absolute z-30 w-full mt-1 bg-zinc-800 border border-white/10 rounded-xl p-3 text-center text-sm text-zinc-500">
          No farmer found
        </div>
      )}
    </div>
  );
};

interface StartModalProps {
  farmer: Farmer;
  hasActive: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const StartCultureModal: React.FC<StartModalProps> = ({ farmer, hasActive, onClose, onSuccess }) => {
  const [startDate, setStartDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/cultures", { farmerId: farmer._id, startDate, notes: notes.trim() || undefined });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to start culture");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Sprout size={18} className="text-emerald-400" /> Start New Culture
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition"><X size={18} /></button>
        </div>
        {hasActive && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm mb-4">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            This farmer already has an active culture. Starting another may cause conflicts.
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Farmer</label>
            <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-zinc-300">{farmer.name}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Start Date *</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inp} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Notes <span className="text-zinc-600">(optional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Any initial notes…" className={inp + " resize-none"} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 hover:text-zinc-200 text-sm transition">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-sm transition flex items-center justify-center gap-2">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? "Starting…" : "Start Culture"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CloseModalProps {
  culture: Culture;
  onClose: () => void;
  onSuccess: () => void;
}

const CloseModal: React.FC<CloseModalProps> = ({ culture, onClose, onSuccess }) => {
  const [endDate, setEndDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayId = culture.cultureId || culture._id.slice(-6).toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.put("/cultures/" + culture._id + "/close", { endDate, notes: notes.trim() || undefined });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to close culture");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Close Culture</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition"><X size={18} /></button>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm mb-4">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          Closing is permanent. All history preserved.
        </div>
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Culture ID</label>
            <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-emerald-400 font-mono">#{displayId}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">End Date *</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inp} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Notes <span className="text-zinc-600">(optional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Reason for closing, outcome…" className={inp + " resize-none"} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 hover:text-zinc-200 text-sm transition">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white font-semibold text-sm transition flex items-center justify-center gap-2">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? "Closing…" : "Close Culture"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DetailModalProps {
  culture: Culture;
  onClose: () => void;
}

const CultureDetailModal: React.FC<DetailModalProps> = ({ culture, onClose }) => {
  const [data, setData] = useState<CultureSales | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayId = culture.cultureId || culture._id.slice(-6).toUpperCase();

  useEffect(() => {
    api.get<CultureSales>("/cultures/" + culture._id + "/sales")
      .then(r => setData(r.data))
      .catch(() => setError("Failed to load sales"))
      .finally(() => setLoading(false));
  }, [culture._id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-lg">Culture Detail</h2>
            <p className="text-zinc-500 text-xs mt-0.5">
              #{displayId} · {fmtDate(culture.startDate)}{culture.endDate ? " → " + fmtDate(culture.endDate) : " (ongoing)"}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition"><X size={18} /></button>
        </div>
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="bg-white/4 border border-white/8 rounded-xl px-4 py-2 text-xs">
            <span className="text-zinc-500">Status</span>
            <div className="mt-1"><StatusBadge status={culture.status} /></div>
          </div>
          <div className="bg-white/4 border border-white/8 rounded-xl px-4 py-2 text-xs">
            <span className="text-zinc-500">Start Date</span>
            <p className="text-white font-medium mt-1">{fmtDate(culture.startDate)}</p>
          </div>
          {culture.endDate && (
            <div className="bg-white/4 border border-white/8 rounded-xl px-4 py-2 text-xs">
              <span className="text-zinc-500">End Date</span>
              <p className="text-white font-medium mt-1">{fmtDate(culture.endDate)}</p>
            </div>
          )}
          {culture.notes && (
            <div className="bg-white/4 border border-white/8 rounded-xl px-4 py-2 text-xs flex-1 min-w-0">
              <span className="text-zinc-500">Notes</span>
              <p className="text-zinc-300 mt-1 truncate">{culture.notes}</p>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-zinc-500 text-sm">
              <Loader2 size={16} className="animate-spin" /> Loading sales…
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={15} /> {error}
            </div>
          )}
          {data && (
            <>
              {data.sales.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-10">No sales linked to this culture.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-white/8">
                        <th className="pb-2 text-xs font-medium text-zinc-500">Invoice#</th>
                        <th className="pb-2 text-xs font-medium text-zinc-500">Date</th>
                        <th className="pb-2 text-xs font-medium text-zinc-500 text-right">Products</th>
                        <th className="pb-2 text-xs font-medium text-zinc-500 text-right">Total</th>
                        <th className="pb-2 text-xs font-medium text-zinc-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.sales.map(s => (
                        <tr key={s._id}>
                          <td className="py-2.5 text-zinc-200 font-mono text-xs">{s.invoiceNumber}</td>
                          <td className="py-2.5 text-zinc-400 text-xs">{fmtDate(s.date)}</td>
                          <td className="py-2.5 text-zinc-300 text-right">{s.productCount}</td>
                          <td className="py-2.5 text-white font-medium text-right">{fmtRs(s.total)}</td>
                          <td className="py-2.5">
                            <span className={"text-[10px] px-2 py-0.5 rounded-full font-medium border " + (
                              s.status === "paid"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                                : s.status === "credit"
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                                : "bg-zinc-700/60 text-zinc-400 border-zinc-600/40"
                            )}>{s.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="bg-white/4 border border-white/8 rounded-xl p-3 text-center">
                  <p className="text-xs text-zinc-500 mb-1">Total Billed</p>
                  <p className="text-white font-bold text-sm">{fmtRs(data.totalBilled)}</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                  <p className="text-xs text-emerald-500 mb-1">Collected</p>
                  <p className="text-emerald-400 font-bold text-sm">{fmtRs(data.totalCollected)}</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                  <p className="text-xs text-amber-500 mb-1">Outstanding</p>
                  <p className="text-amber-400 font-bold text-sm">{fmtRs(data.totalOutstanding)}</p>
                </div>
              </div>
            </>
          )}
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2.5 rounded-xl border border-white/10 text-zinc-400 hover:text-zinc-200 text-sm transition">
          Close
        </button>
      </div>
    </div>
  );
};

const CultureCycle: React.FC = () => {
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [culturesLoading, setCulturesLoading] = useState(false);
  const [culturesError, setCulturesError] = useState<string | null>(null);

  const [showStart, setShowStart] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedCulture, setSelectedCulture] = useState<Culture | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const activeCulture = cultures.find(c => c.status === "active") ?? null;

  const loadCultures = useCallback(async (farmerId: string) => {
    setCulturesLoading(true);
    setCulturesError(null);
    try {
      const r = await api.get<Culture[]>("/cultures", { params: { farmerId } });
      setCultures(r.data);
    } catch {
      setCulturesError("Failed to load cultures");
      setCultures([]);
    } finally {
      setCulturesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (farmer) loadCultures(farmer._id);
    else setCultures([]);
  }, [farmer, loadCultures]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleStartSuccess = () => {
    setShowStart(false);
    showToast("Culture started successfully.");
    if (farmer) loadCultures(farmer._id);
  };

  const handleCloseSuccess = () => {
    setShowClose(false);
    setSelectedCulture(null);
    showToast("Culture closed successfully.");
    if (farmer) loadCultures(farmer._id);
  };

  const openDetail = (c: Culture) => { setSelectedCulture(c); setShowDetail(true); };
  const openClose = (c: Culture) => { setSelectedCulture(c); setShowClose(true); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sprout size={24} className="text-green-400" /> Culture Cycles
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Manage aquaculture cycles per farmer</p>
      </div>

      {toast && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="ml-auto shrink-0"><X size={14} /></button>
        </div>
      )}

      <div className="bg-white/4 border border-white/8 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Select Farmer</p>
        <FarmerSearch
          onSelect={setFarmer}
          selected={farmer}
          onClear={() => { setFarmer(null); setCultures([]); }}
        />
      </div>

      {farmer && !culturesLoading && (
        <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">Active Culture</p>
          {activeCulture ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Culture ID</p>
                  <span className="font-mono text-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2.5 py-1 rounded-lg">
                    #{activeCulture.cultureId || activeCulture._id.slice(-6).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1"><CalendarDays size={11} /> Start Date</p>
                  <p className="text-white text-sm font-medium">{fmtDate(activeCulture.startDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1"><Clock size={11} /> Days Active</p>
                  <p className="text-white text-sm font-medium">{daysDiff(activeCulture.startDate)} days</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Status</p>
                  <StatusBadge status={activeCulture.status} />
                </div>
              </div>
              {activeCulture.notes && (
                <p className="text-zinc-400 text-xs bg-white/4 rounded-lg px-3 py-2">{activeCulture.notes}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => openDetail(activeCulture)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-zinc-300 hover:text-white text-sm transition">
                  <Eye size={14} /> View Sales
                </button>
                <button onClick={() => openClose(activeCulture)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-700/70 hover:bg-red-600/80 text-white text-sm font-medium transition">
                  Close Culture
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                No active culture for this farmer
              </div>
              <button onClick={() => setShowStart(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition">
                <Sprout size={14} /> Start New Culture
              </button>
            </div>
          )}
        </div>
      )}

      {farmer && culturesLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-zinc-500 text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading cultures…
        </div>
      )}

      {culturesError && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={15} /> {culturesError}
        </div>
      )}

      {farmer && !culturesLoading && cultures.length > 0 && (
        <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">Culture History</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-white/8">
                  <th className="pb-2.5 text-xs font-medium text-zinc-500">Culture ID</th>
                  <th className="pb-2.5 text-xs font-medium text-zinc-500">Start Date</th>
                  <th className="pb-2.5 text-xs font-medium text-zinc-500">End Date</th>
                  <th className="pb-2.5 text-xs font-medium text-zinc-500">Status</th>
                  <th className="pb-2.5 text-xs font-medium text-zinc-500">Notes</th>
                  <th className="pb-2.5 text-xs font-medium text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cultures.map(c => (
                  <tr key={c._id} className="hover:bg-white/3 transition">
                    <td className="py-3 font-mono text-xs text-emerald-400">#{c.cultureId || c._id.slice(-6).toUpperCase()}</td>
                    <td className="py-3 text-zinc-300 text-xs">{fmtDate(c.startDate)}</td>
                    <td className="py-3 text-zinc-400 text-xs">{fmtDate(c.endDate)}</td>
                    <td className="py-3"><StatusBadge status={c.status} /></td>
                    <td className="py-3 text-zinc-500 text-xs max-w-[180px] truncate">{c.notes || "—"}</td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openDetail(c)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-zinc-400 hover:text-white text-xs transition">
                          <Eye size={12} /> View
                        </button>
                        {c.status === "active" && (
                          <button onClick={() => openClose(c)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-700/50 hover:bg-red-600/70 text-red-300 text-xs transition">
                            Close
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {farmer && !culturesLoading && !culturesError && cultures.length === 0 && (
        <div className="bg-white/4 border border-white/8 rounded-2xl p-8 text-center">
          <Sprout size={32} className="text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-500 text-sm">No culture records for this farmer.</p>
        </div>
      )}

      {!farmer && (
        <div className="bg-white/4 border border-white/8 rounded-2xl p-10 text-center">
          <Search size={36} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Search and select a farmer to view their culture cycles.</p>
        </div>
      )}

      {showStart && farmer && (
        <StartCultureModal
          farmer={farmer}
          hasActive={!!activeCulture}
          onClose={() => setShowStart(false)}
          onSuccess={handleStartSuccess}
        />
      )}
      {showClose && selectedCulture && (
        <CloseModal
          culture={selectedCulture}
          onClose={() => { setShowClose(false); setSelectedCulture(null); }}
          onSuccess={handleCloseSuccess}
        />
      )}
      {showDetail && selectedCulture && (
        <CultureDetailModal
          culture={selectedCulture}
          onClose={() => { setShowDetail(false); setSelectedCulture(null); }}
        />
      )}
    </div>
  );
};

export default CultureCycle;
