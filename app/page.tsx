"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  Car, Footprints, Radio, User, Settings, Lock, Search, RotateCcw,
  Check, ChevronRight, AlertCircle, Clock, MapPin,
  AlertTriangle, UtensilsCrossed, LogOut, ChevronDown, ChevronUp,
  X, Hash, BookOpen, Bus, ArrowRight,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const RUNNERS = ["Runner 1", "Runner 2", "Runner 3", "Runner 4"];
const STATUSES = ["Waiting", "Called", "Assigned", "Picked Up", "Dismissed"] as const;

const STATUS_STYLE: Record<string, string> = {
  Waiting:      "bg-slate-100 text-slate-600",
  Called:       "bg-amber-100 text-amber-700",
  Assigned:     "bg-blue-100 text-blue-700",
  "Picked Up":  "bg-violet-100 text-violet-700",
  Dismissed:    "bg-green-100 text-green-700",
};

const TRANSPORT_LABEL: Record<string, string> = {
  Bus: "Bus", AfterCare: "After Care", Carline: "Car Line", WalkUp: "Walk-Up",
};
const TRANSPORT_STYLE: Record<string, string> = {
  Bus: "bg-blue-100 text-blue-700", AfterCare: "bg-purple-100 text-purple-700",
  Carline: "bg-emerald-100 text-emerald-700", WalkUp: "bg-orange-100 text-orange-700",
};
const TRANSPORT_ORDER = ["Bus", "Carline", "WalkUp", "AfterCare", "Other"];

// Distinct avatar background colors derived from name hash
const AVATAR_BG = [
  "#1e3a5f","#3b1f5e","#1a3d2b","#5c1f2e","#1c3a4a",
  "#3d2b0f","#2d1b4e","#1f3d3d","#4a1f1f","#1f4a2b",
];

function avatarBg(name: string): string {
  let h = 0;
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length];
}

const fmt = (ts?: number) =>
  ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

const today = () => new Date().toISOString().split("T")[0];

type StaffDoc  = Doc<"staff">;
type CamperDoc = Doc<"campers">;

// ─── Root ────────────────────────────────────────────────────────────────────

export default function App() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <AppRoot />;
}

function AppRoot() {
  const [staff, setStaff] = useState<StaffDoc | null>(null);
  if (!staff) return <LockScreen onUnlock={setStaff} />;
  return <RoleRouter staff={staff} onLogout={() => setStaff(null)} />;
}

// ─── Lock Screen ─────────────────────────────────────────────────────────────

function LockScreen({ onUnlock }: { onUnlock: (s: StaffDoc) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const staffResult = useQuery(api.staff.getByCode, code.length > 0 ? { code } : "skip");

  const handleUnlock = () => {
    if (!code) return;
    if (staffResult === undefined) { setLoading(true); return; }
    if (!staffResult) { setError("Invalid code. Try again."); setCode(""); return; }
    onUnlock(staffResult);
  };

  useEffect(() => {
    if (loading && staffResult !== undefined) {
      setLoading(false);
      if (!staffResult) { setError("Invalid code. Try again."); setCode(""); }
      else onUnlock(staffResult);
    }
  }, [loading, staffResult]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 w-full max-w-xs text-center">
        <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mx-auto mb-5">
          <Lock className="text-white" size={26} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">JCamp</h1>
        <p className="text-slate-500 text-sm mt-1 mb-7">Enter your staff code</p>
        <input
          value={code}
          onChange={e => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }}
          onKeyDown={e => e.key === "Enter" && handleUnlock()}
          inputMode="numeric" type="password" autoComplete="off" maxLength={6}
          placeholder="——"
          className="w-full text-center text-3xl font-bold tracking-[0.35em] border-2 border-slate-200 rounded-2xl py-4 mb-4 focus:outline-none focus:border-slate-900 bg-slate-50"
        />
        {error && <p className="text-sm text-red-500 mb-3 font-medium">{error}</p>}
        <button
          onClick={handleUnlock}
          disabled={loading || code.length === 0}
          className="w-full bg-slate-900 text-white rounded-2xl py-4 text-base font-semibold active:bg-slate-700 disabled:opacity-40 transition-colors"
        >
          {loading ? "Checking…" : "Sign In"}
        </button>
      </div>
    </div>
  );
}

// ─── Role Router ─────────────────────────────────────────────────────────────

function RoleRouter({ staff, onLogout }: { staff: StaffDoc; onLogout: () => void }) {
  const wrap = (child: React.ReactNode) => (
    <div className="min-h-screen bg-slate-50">
      <MobileHeader staff={staff} onLogout={onLogout} />
      <main className="px-3 py-5 max-w-lg mx-auto">{child}</main>
    </div>
  );
  if (staff.role === "counselor")  return wrap(<CounselorView staff={staff} />);
  if (staff.role === "runner")     return wrap(<RunnerView runnerName={staff.runnerLabel ?? staff.name} />);
  if (staff.role === "carline")    return wrap(<Caller source="Carline" />);
  if (staff.role === "walkup")     return wrap(<Caller source="Walk-Up" />);
  if (staff.role === "dispatcher") return wrap(<Dispatcher />);
  return <MultiTabShell staff={staff} onLogout={onLogout} />;
}

function MobileHeader({ staff, onLogout }: { staff: StaffDoc; onLogout: () => void }) {
  const labels: Record<string, string> = {
    counselor:"Counselor", carline:"Carline", walkup:"Walk-Up",
    dispatcher:"Dispatcher", runner:"Runner", director:"Director", admin:"Admin",
  };
  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-20">
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
        <span className="font-bold text-slate-900 text-lg">JCamp</span>
        <span className="text-sm text-slate-500 truncate flex-1">{staff.name}</span>
        <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-medium flex-shrink-0">
          {labels[staff.role] ?? staff.role}
        </span>
        <button onClick={onLogout} className="p-2 text-slate-400 active:text-slate-700 rounded-xl flex-shrink-0">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

function MultiTabShell({ staff, onLogout }: { staff: StaffDoc; onLogout: () => void }) {
  const allTabs = [
    { id:"carline",    label:"Carline",    icon:Car,      roles:["admin"] },
    { id:"walkup",     label:"Walk-Up",    icon:Footprints,roles:["admin"] },
    { id:"dispatcher", label:"Dispatcher", icon:Radio,    roles:["admin"] },
    { id:"runner",     label:"Runner",     icon:User,     roles:["admin"] },
    { id:"admin",      label:"Admin",      icon:Settings, roles:["admin","director"] },
  ] as const;
  const tabs = allTabs.filter(t => (t.roles as readonly string[]).includes(staff.role));
  const [active, setActive] = useState<string>(tabs[0]?.id ?? "admin");
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <span className="font-bold text-slate-900 text-lg mr-auto">JCamp</span>
          <span className="text-sm text-slate-500 hidden sm:block">{staff.name}</span>
          <button onClick={onLogout} className="p-2 text-slate-400 rounded-xl active:bg-slate-100">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-3 py-5">
        {active === "carline"    && <Caller source="Carline" />}
        {active === "walkup"     && <Caller source="Walk-Up" />}
        {active === "dispatcher" && <Dispatcher />}
        {active === "runner"     && <RunnerAdminView />}
        {active === "admin"      && <Admin />}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-20 safe-area-bottom">
        <div className="max-w-2xl mx-auto flex">
          {tabs.map(t => {
            const Icon = t.icon;
            const on = active === t.id;
            return (
              <button key={t.id} onClick={() => setActive(t.id)}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${on ? "text-slate-900" : "text-slate-400"}`}>
                <Icon size={22} strokeWidth={on ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium leading-none mt-0.5">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ─── Camper Detail Sheet ──────────────────────────────────────────────────────

function CamperDetailSheet({ camper, onClose }: { camper: CamperDoc; onClose: () => void }) {
  const logs = useQuery(api.attendanceLogs.getByCamper, {
    camperId: camper._id,
    date: today(),
  });

  const displayName = camper.preferredName
    ? `${camper.preferredName}${camper.lastName ? " " + camper.lastName : ""}`
    : camper.name;

  const bg = avatarBg(camper.name);
  const initial = (camper.preferredName ?? camper.name).charAt(0).toUpperCase();

  const checkpoints: { label: string; done: boolean; value?: string }[] = [
    { label: "Arrived at camp",  done: !!(camper.arrivalStatus === "Arrived" || camper.bunkConfirmed), value: camper.arrivalType ?? undefined },
    { label: "Confirmed with bunk", done: !!camper.bunkConfirmed },
    { label: "Dismissal",        done: camper.status !== "Waiting", value: camper.status !== "Waiting" ? camper.status : undefined },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="backdrop-fade absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Sheet */}
      <div className="sheet-slide-up relative bg-white rounded-t-3xl flex flex-col max-h-[92dvh] overflow-hidden">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Photo / avatar hero */}
        <div className="relative flex-shrink-0 mx-4 rounded-2xl overflow-hidden" style={{ height: 220 }}>
          {camper.photoUrl ? (
            <img src={camper.photoUrl} alt={displayName}
              className="w-full h-full object-cover object-top" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: bg }}>
              <span className="text-[96px] font-black leading-none select-none"
                style={{ color: "rgba(255,255,255,0.88)" }}>
                {initial}
              </span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          {/* Name overlay */}
          <div className="absolute bottom-4 left-4 right-12">
            <p className="text-white font-bold text-2xl leading-tight drop-shadow-md">{displayName}</p>
            <p className="text-white/75 text-sm mt-0.5">
              {camper.bunk}{camper.unit ? ` · ${camper.unit}` : ""}
            </p>
          </div>
          {/* Close */}
          <button onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 bg-black/40 rounded-full flex items-center justify-center text-white active:bg-black/60 backdrop-blur-sm">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 pt-4 pb-8 space-y-4">

          {/* Allergy / notes alerts */}
          {(camper.hasAllergies || camper.hasNotes) && (
            <div className="space-y-2">
              {camper.hasAllergies && (
                <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3.5">
                  <AlertTriangle size={20} className="text-orange-500 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-orange-800 text-sm">Allergy Alert</p>
                    <p className="text-orange-600 text-xs mt-0.5">This camper has allergies on file.</p>
                  </div>
                </div>
              )}
              {camper.hasNotes && (
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3.5">
                  <BookOpen size={20} className="text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-blue-800 text-sm">Notes on File</p>
                    <p className="text-blue-600 text-xs mt-0.5">See director for details.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <InfoTile icon={<MapPin size={16} />}    label="Bunk"         value={camper.bunk} />
            <InfoTile icon={<User size={16} />}      label="Grade"        value={camper.grade ?? "—"} />
            <InfoTile icon={<Bus size={16} />}       label="Transport"
              value={TRANSPORT_LABEL[camper.transportationType ?? ""] ?? "—"}
              badge={camper.transportationType ? { label: TRANSPORT_LABEL[camper.transportationType], style: TRANSPORT_STYLE[camper.transportationType] } : undefined}
            />
            <InfoTile icon={<Hash size={16} />}      label="Pickup Code"  value={`#${camper.code}`}  mono />
          </div>

          {/* Lunch */}
          {camper.lunchInfo && (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5">
              <UtensilsCrossed size={18} className="text-slate-500 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-400 font-medium">Lunch</p>
                <p className="font-semibold text-slate-800 text-sm mt-0.5">{camper.lunchInfo}</p>
              </div>
            </div>
          )}

          {/* Today's checkpoints */}
          <div>
            <SectionLabel>Today's Status</SectionLabel>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {checkpoints.map((cp, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    cp.done ? "bg-green-100" : "bg-slate-100"
                  }`}>
                    {cp.done
                      ? <Check size={14} className="text-green-600" />
                      : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                  </div>
                  <span className={`flex-1 text-sm font-medium ${cp.done ? "text-slate-800" : "text-slate-400"}`}>
                    {cp.label}
                  </span>
                  {cp.value && (
                    <span className="text-xs text-slate-500 font-medium">{cp.value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Dismissal status badge if active */}
          {(camper.status === "Called" || camper.status === "Assigned") && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5 flex items-center gap-3">
              <AlertCircle size={20} className="text-amber-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-amber-800 text-sm">Called for Pickup</p>
                {camper.runner && (
                  <p className="text-amber-600 text-xs mt-0.5">Assigned to {camper.runner}</p>
                )}
              </div>
              <StatusBadge status={camper.status} />
            </div>
          )}

          {/* Attendance log */}
          {logs && logs.length > 0 && (
            <div>
              <SectionLabel>Activity Log</SectionLabel>
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log._id} className="flex items-start gap-3">
                    <span className="text-xs text-slate-400 font-mono flex-shrink-0 mt-0.5 w-12 text-right">
                      {fmt(log.timestamp)}
                    </span>
                    <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold text-slate-600">{log.checkpoint}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{log.status} · {log.staffName}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function InfoTile({
  icon, label, value, mono, badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  badge?: { label: string; style: string };
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      {badge ? (
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.style}`}>{badge.label}</span>
      ) : (
        <p className={`font-bold text-slate-800 text-base ${mono ? "font-mono tracking-wider" : ""}`}>{value}</p>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">{children}</p>
  );
}

// ─── Counselor View ───────────────────────────────────────────────────────────

function CounselorView({ staff }: { staff: StaffDoc }) {
  const bunk = staff.bunkAssignment ?? "";
  const roster    = useQuery(api.campers.getBunkRoster, bunk ? { bunk } : "skip");
  const confirm   = useMutation(api.campers.confirmWithBunk);
  const arrive    = useMutation(api.campers.updateArrival);
  const unconfirm = useMutation(api.campers.unconfirmWithBunk);
  const [showConfirmed, setShowConfirmed] = useState(false);
  const [selected, setSelected] = useState<CamperDoc | null>(null);

  if (!bunk) return (
    <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
      No bunk assigned. Contact an administrator.
    </div>
  );
  if (roster === undefined) return <Loading />;

  const confirmed   = roster.filter(c => c.bunkConfirmed);
  const unconfirmed = roster.filter(c => !c.bunkConfirmed);
  const called      = roster.filter(c => c.status === "Called" || c.status === "Assigned");

  const groups: Record<string, CamperDoc[]> = {};
  for (const k of TRANSPORT_ORDER) groups[k] = [];
  for (const c of unconfirmed) (groups[c.transportationType ?? "Other"] ??= []).push(c);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold text-slate-900">{bunk}</h2>
          <span className="text-slate-500 text-sm font-medium">{confirmed.length} / {roster.length}</span>
        </div>

        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${roster.length ? (confirmed.length / roster.length) * 100 : 0}%` }} />
        </div>

        <div className="flex gap-2">
          <Pill value={roster.filter(c => c.arrivalStatus === "Arrived" || c.bunkConfirmed).length} label="Arrived"   color="green" />
          <Pill value={confirmed.length}   label="Confirmed" color="blue"  />
          <Pill value={unconfirmed.length} label="Pending"   color="slate" />
        </div>

        {called.length > 0 && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4">
            <p className="text-amber-900 font-bold text-base flex items-center gap-2 mb-3">
              <AlertCircle size={20} className="flex-shrink-0" />
              {called.length} camper{called.length !== 1 ? "s" : ""} called for pickup!
            </p>
            <div className="space-y-2">
              {called.map(c => (
                <button key={c._id} onClick={() => setSelected(c)}
                  className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-3 active:bg-amber-50">
                  <div className="text-left">
                    <p className="font-bold text-slate-900">{c.preferredName ?? c.name}</p>
                    <p className="text-xs text-slate-500">{c.bunk}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </button>
              ))}
            </div>
          </div>
        )}

        {unconfirmed.length > 0 && (
          <div className="space-y-5">
            {TRANSPORT_ORDER.map(group => {
              const campers = groups[group];
              if (!campers?.length) return null;
              return (
                <div key={group}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${TRANSPORT_STYLE[group] ?? "bg-slate-100 text-slate-600"}`}>
                      {TRANSPORT_LABEL[group] ?? group}
                    </span>
                    <span className="text-xs text-slate-400">{campers.length}</span>
                  </div>
                  <div className="space-y-2">
                    {campers.map(c => (
                      <CamperCard key={c._id} camper={c}
                        onTap={() => setSelected(c)}
                        onConfirm={() => confirm({ id: c._id, staffName: staff.name })}
                        onMarkArrived={() => arrive({ id: c._id, arrivalType: "WalkIn", staffName: staff.name })}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {confirmed.length > 0 && (
          <div>
            <button onClick={() => setShowConfirmed(v => !v)}
              className="flex items-center gap-2 w-full py-3 px-1 text-sm font-semibold text-slate-500 active:text-slate-800">
              <Check size={16} className="text-green-500" />
              {confirmed.length} confirmed
              {showConfirmed ? <ChevronUp size={15} className="ml-auto" /> : <ChevronDown size={15} className="ml-auto" />}
            </button>
            {showConfirmed && (
              <div className="space-y-1.5">
                {confirmed.map(c => (
                  <ConfirmedRow key={c._id} camper={c}
                    onTap={() => setSelected(c)}
                    onUnconfirm={() => unconfirm({ id: c._id })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {unconfirmed.length === 0 && confirmed.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <Check size={32} className="text-green-500 mx-auto mb-2" />
            <p className="font-bold text-green-800 text-lg">All {confirmed.length} campers confirmed!</p>
          </div>
        )}
      </div>

      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function CamperCard({
  camper, onTap, onConfirm, onMarkArrived,
}: {
  camper: CamperDoc;
  onTap: () => void;
  onConfirm: () => void;
  onMarkArrived: () => void;
}) {
  const name = camper.preferredName
    ? `${camper.preferredName}${camper.lastName ? " " + camper.lastName : ""}`
    : camper.name;
  const isCalled  = camper.status === "Called" || camper.status === "Assigned";
  const isArrived = camper.arrivalStatus === "Arrived";
  const bg = avatarBg(camper.name);

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isCalled ? "border-amber-300" : "border-slate-200"}`}>
      {/* Tappable info area */}
      <button onClick={onTap} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-lg text-white overflow-hidden"
          style={{ backgroundColor: bg }}>
          {camper.photoUrl
            ? <img src={camper.photoUrl} alt={name} className="w-full h-full object-cover" />
            : (camper.preferredName ?? camper.name).charAt(0).toUpperCase()}
        </div>
        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-900 text-base leading-tight">{name}</span>
            {camper.hasAllergies && <AlertTriangle size={13} className="text-orange-500 flex-shrink-0" />}
            {camper.hasNotes     && <AlertCircle   size={13} className="text-blue-400  flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {camper.grade     && <span className="text-xs text-slate-400">{camper.grade}</span>}
            {camper.lunchInfo && <span className="text-xs text-slate-500 flex items-center gap-0.5"><UtensilsCrossed size={10} />{camper.lunchInfo}</span>}
            {isArrived && !camper.bunkConfirmed && <span className="text-xs text-blue-600 font-medium">Arrived</span>}
            {isCalled  && <StatusBadge status={camper.status} />}
          </div>
        </div>
        <ArrowRight size={16} className="text-slate-300 flex-shrink-0" />
      </button>

      {/* Action buttons */}
      <div className="border-t border-slate-100 flex">
        {!isArrived && (
          <button onClick={onMarkArrived}
            className="flex-1 py-3.5 text-sm font-semibold text-slate-600 bg-slate-50 active:bg-slate-100 border-r border-slate-100 transition-colors">
            Mark Arrived
          </button>
        )}
        <button onClick={onConfirm}
          className="flex-1 py-3.5 text-sm font-bold text-white bg-slate-900 active:bg-slate-700 flex items-center justify-center gap-1.5 transition-colors">
          <Check size={15} /> Confirm with Bunk
        </button>
      </div>
    </div>
  );
}

function ConfirmedRow({ camper, onTap, onUnconfirm }: {
  camper: CamperDoc;
  onTap: () => void;
  onUnconfirm: () => void;
}) {
  const name = camper.preferredName ?? camper.name;
  return (
    <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl overflow-hidden">
      <button onClick={onTap} className="flex items-center gap-3 flex-1 px-4 py-3 text-left active:bg-green-100">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold overflow-hidden"
          style={{ backgroundColor: avatarBg(camper.name) }}>
          {camper.photoUrl
            ? <img src={camper.photoUrl} alt={name} className="w-full h-full object-cover" />
            : (camper.preferredName ?? camper.name).charAt(0).toUpperCase()}
        </div>
        <span className="flex-1 font-medium text-slate-700 text-sm">{name}</span>
        {camper.transportationType && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${TRANSPORT_STYLE[camper.transportationType]}`}>
            {TRANSPORT_LABEL[camper.transportationType]}
          </span>
        )}
      </button>
      <button onClick={onUnconfirm} className="text-xs text-slate-400 active:text-red-500 px-3 py-3 border-l border-green-100">
        Undo
      </button>
    </div>
  );
}

function Pill({ value, label, color }: { value: number; label: string; color: "green"|"blue"|"slate" }) {
  const styles = { green:"bg-green-50 text-green-700 border-green-200", blue:"bg-blue-50 text-blue-700 border-blue-200", slate:"bg-slate-50 text-slate-600 border-slate-200" };
  return (
    <div className={`flex-1 border rounded-xl py-2.5 text-center ${styles[color]}`}>
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="text-xs mt-0.5 font-medium opacity-80">{label}</p>
    </div>
  );
}

// ─── Caller ───────────────────────────────────────────────────────────────────

function Caller({ source }: { source: "Carline" | "Walk-Up" }) {
  const [entry, setEntry] = useState("");
  const [selected, setSelected] = useState<CamperDoc | null>(null);
  const matched    = useQuery(api.campers.getByCode, entry.length === 3 ? { code: entry } : "skip");
  const callByCode = useMutation(api.campers.callByCode);
  const Icon = source === "Carline" ? Car : Footprints;
  const call = async () => { await callByCode({ code: entry, source }); setEntry(""); };

  return (
    <>
      <div>
        <div className="flex items-center gap-2 mb-5">
          <Icon size={22} className="text-slate-700" />
          <h2 className="text-xl font-bold text-slate-900">{source} Caller</h2>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <label className="text-sm font-semibold text-slate-500 block mb-2">Family pickup code</label>
          <input value={entry}
            onChange={e => setEntry(e.target.value.replace(/\D/g, "").slice(0, 3))}
            placeholder="0 0 0" inputMode="numeric"
            className="w-full text-center text-5xl font-bold tracking-[0.4em] border-2 border-slate-200 rounded-2xl py-5 focus:outline-none focus:border-slate-900 bg-slate-50" />

          {entry.length === 3 && matched !== undefined && matched.length === 0 && (
            <p className="text-center text-slate-500 mt-3 text-sm">No campers found for code {entry}.</p>
          )}
          {matched && matched.length > 0 && (
            <div className="mt-4 space-y-2">
              {matched.map(c => (
                <button key={c._id} onClick={() => setSelected(c)}
                  className="w-full flex items-center justify-between bg-slate-50 active:bg-slate-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: avatarBg(c.name) }}>
                      {(c.preferredName ?? c.name).charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{c.preferredName ?? c.name}</p>
                      <p className="text-xs text-slate-500">{c.bunk}</p>
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </button>
              ))}
              <button onClick={call}
                className="w-full bg-amber-500 active:bg-amber-600 text-white rounded-2xl py-4 font-bold text-base mt-2 transition-colors">
                Call Campers
              </button>
            </div>
          )}
        </div>
      </div>
      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

function Dispatcher() {
  const active     = useQuery(api.campers.active);
  const assign     = useMutation(api.campers.assign);
  const cancelCall = useMutation(api.campers.cancelCall);
  const [selected, setSelected] = useState<CamperDoc | null>(null);

  if (active === undefined) return <Loading />;

  return (
    <>
      <div>
        <div className="flex items-center gap-2 mb-5">
          <Radio size={22} className="text-slate-700" />
          <h2 className="text-xl font-bold text-slate-900">Dispatcher</h2>
          <span className="ml-auto text-sm text-slate-500 font-medium">{active.length} active</span>
        </div>
        {active.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">No campers called yet.</div>
        )}
        <div className="space-y-3">
          {active.map(c => (
            <div key={c._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button onClick={() => setSelected(c)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50">
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-lg overflow-hidden"
                  style={{ backgroundColor: avatarBg(c.name) }}>
                  {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : (c.preferredName ?? c.name).charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-base">{c.preferredName ?? c.name}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1"><MapPin size={11} />{c.bunk}</span>
                    <span>#{c.code}</span>
                    <span className="flex items-center gap-1"><Clock size={11} />{fmt(c.tCalled)}</span>
                  </div>
                  {c.runner && <p className="text-xs text-blue-600 font-semibold mt-0.5">→ {c.runner}</p>}
                </div>
                <StatusBadge status={c.status} />
              </button>
              <div className="border-t border-slate-100 px-3 py-2.5 flex gap-2 flex-wrap items-center">
                {RUNNERS.map(r => (
                  <button key={r} onClick={() => assign({ id: c._id, runner: r })}
                    className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-colors ${c.runner === r ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 active:bg-slate-200"}`}>
                    {r.replace("Runner ", "R")}
                  </button>
                ))}
                <button onClick={() => cancelCall({ id: c._id })}
                  className="ml-auto text-xs text-red-400 active:text-red-600 flex items-center gap-1 px-2 py-2">
                  <AlertCircle size={13} /> Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

// ─── Runner View ─────────────────────────────────────────────────────────────

function RunnerView({ runnerName }: { runnerName: string }) {
  const mine    = useQuery(api.campers.forRunner, { runner: runnerName });
  const pickUp  = useMutation(api.campers.pickUp);
  const dismiss = useMutation(api.campers.dismiss);
  const [selected, setSelected] = useState<CamperDoc | null>(null);

  if (mine === undefined) return <Loading />;

  return (
    <>
      <div>
        <div className="flex items-center gap-2 mb-5">
          <User size={22} className="text-slate-700" />
          <h2 className="text-xl font-bold text-slate-900">{runnerName}</h2>
          <span className="ml-auto text-sm text-slate-500">{mine.length} assigned</span>
        </div>
        {mine.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">Nothing assigned to you right now.</div>
        )}
        <div className="space-y-3">
          {mine.map(c => (
            <div key={c._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button onClick={() => setSelected(c)} className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-slate-50">
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-lg overflow-hidden"
                  style={{ backgroundColor: avatarBg(c.name) }}>
                  {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : (c.preferredName ?? c.name).charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg text-slate-900">{c.preferredName ?? c.name}</p>
                  <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1"><MapPin size={13} />{c.bunk}</span>
                    <span className="flex items-center gap-1">{c.callSource === "Carline" ? <Car size={13} /> : <Footprints size={13} />}{c.callSource}</span>
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </button>
              {c.status === "Assigned" && (
                <button onClick={() => pickUp({ id: c._id })}
                  className="w-full bg-violet-600 active:bg-violet-700 text-white py-4 font-bold text-base flex items-center justify-center gap-2">
                  <Check size={18} /> Picked Up
                </button>
              )}
              {c.status === "Picked Up" && (
                <button onClick={() => dismiss({ id: c._id })}
                  className="w-full bg-green-600 active:bg-green-700 text-white py-4 font-bold text-base flex items-center justify-center gap-2">
                  <ChevronRight size={18} /> Dismissed
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function RunnerAdminView() {
  const [me, setMe] = useState<string | null>(null);
  if (!me) return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-4">View Runner Queue</h2>
      <div className="grid grid-cols-2 gap-3">
        {RUNNERS.map(r => (
          <button key={r} onClick={() => setMe(r)}
            className="bg-white border border-slate-200 rounded-2xl py-9 font-bold text-slate-900 active:bg-slate-50 shadow-sm text-lg">
            {r}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div>
      <button onClick={() => setMe(null)} className="text-sm text-slate-500 mb-4 flex items-center gap-1">← Back</button>
      <RunnerView runnerName={me} />
    </div>
  );
}

// ─── Admin ────────────────────────────────────────────────────────────────────

function Admin() {
  const [q, setQ]       = useState("");
  const [selected, setSelected] = useState<CamperDoc | null>(null);
  const campers  = useQuery(api.campers.list);
  const resetDay = useMutation(api.campers.resetDay);

  const counts = useMemo(() => {
    const c: Record<string, number> = { Waiting:0, Called:0, Assigned:0, "Picked Up":0, Dismissed:0 };
    campers?.forEach(x => { c[x.status]++; });
    return c;
  }, [campers]);

  if (campers === undefined) return <Loading />;

  const filtered = campers.filter(c => {
    const s = q.toLowerCase();
    return !s || c.name.toLowerCase().includes(s) || c.bunk.toLowerCase().includes(s)
      || c.code.includes(s) || (c.runner ?? "").toLowerCase().includes(s)
      || c.status.toLowerCase().includes(s) || (c.unit ?? "").toLowerCase().includes(s);
  });

  return (
    <>
      <div>
        <div className="flex items-center gap-2 mb-5">
          <Settings size={22} className="text-slate-700" />
          <h2 className="text-xl font-bold text-slate-900">Admin</h2>
          <button onClick={() => { if (confirm("Reset all campers to Waiting?")) resetDay(); }}
            className="ml-auto flex items-center gap-1.5 text-sm bg-red-50 text-red-600 px-3 py-2 rounded-xl active:bg-red-100 font-semibold">
            <RotateCcw size={15} /> Reset Day
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-5">
          {STATUSES.map(s => (
            <div key={s} className="bg-white rounded-xl border border-slate-200 p-2 text-center shadow-sm">
              <p className="text-xl font-bold text-slate-900">{counts[s]}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{s}</p>
            </div>
          ))}
        </div>

        <div className="relative mb-3">
          <Search size={17} className="absolute left-3.5 top-3.5 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search name, bunk, code…"
            className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-sm" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  {["Camper","Bunk","Code","Transport","Arr","Conf","Runner","Status"].map(h => (
                    <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c._id} onClick={() => setSelected(c)}
                    className="border-t border-slate-100 active:bg-slate-50 cursor-pointer">
                    <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden"
                          style={{ backgroundColor: avatarBg(c.name) }}>
                          {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : (c.preferredName ?? c.name).charAt(0)}
                        </div>
                        {c.preferredName ?? c.name}
                        {c.hasAllergies && <AlertTriangle size={11} className="text-orange-500" />}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{c.bunk}</td>
                    <td className="px-3 py-2.5 text-slate-600 font-mono">{c.code}</td>
                    <td className="px-3 py-2.5">
                      {c.transportationType
                        ? <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TRANSPORT_STYLE[c.transportationType]}`}>{TRANSPORT_LABEL[c.transportationType]}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">{(c.arrivalStatus === "Arrived" || c.bunkConfirmed) ? <span className="text-green-500 font-bold">✓</span> : <span className="text-slate-200">—</span>}</td>
                    <td className="px-3 py-2.5 text-center">{c.bunkConfirmed ? <span className="text-blue-500 font-bold">✓</span> : <span className="text-slate-200">—</span>}</td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{c.runner ?? "—"}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-500"}`}>
      {status}
    </span>
  );
}

function Loading() {
  return <div className="text-center text-slate-400 py-12">Loading…</div>;
}
