"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  Car, Footprints, Radio, User, Settings, Lock, Search, RotateCcw,
  Check, ChevronRight, AlertCircle, Clock, MapPin,
  AlertTriangle, UtensilsCrossed, LogOut, ChevronDown, ChevronUp,
  X, Hash, BookOpen, Bus, ArrowRight, StickyNote,
} from "lucide-react";

// ─── Brand colors (JCC Greater Boston) ───────────────────────────────────────
// Navy #023B64 | Steel Blue #5B8C9D | Pearl #F6F1E9 | Silver Fog #8EB2CB

// ─── Constants ────────────────────────────────────────────────────────────────

const RUNNERS = ["Runner 1", "Runner 2", "Runner 3", "Runner 4"];
const BUS_ROUTES = ["Bus 1", "Bus 2", "Bus 3", "Bus 4", "Bus 5", "Bus 6"];
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

// "14:30" → "2:30 PM"
function fmtClock(hhmm?: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

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

const PERIOD_LABEL: Record<string, string> = {
  Period1: "Period 1", Period2: "Period 2", Period3: "Period 3",
  Period4: "Period 4", Period5: "Period 5", Period6: "Period 6",
};

const today = () => new Date().toISOString().split("T")[0];

type StaffDoc  = Doc<"staff">;
type CamperDoc = Doc<"campers">;

// Full display name (preferred + last when available)
const camperName = (c: CamperDoc) =>
  c.preferredName ? `${c.preferredName}${c.lastName ? " " + c.lastName : ""}` : c.name;

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
    <div className="min-h-screen flex items-center justify-center p-5" style={{ backgroundColor: "#F6F1E9" }}>
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 w-full max-w-xs text-center">
        <div className="flex justify-center mb-2">
          <img src="/jcc-logo.png" alt="JCC Camps" className="h-14 w-auto" />
        </div>
        <p className="text-slate-500 text-sm mt-2 mb-7">Enter your staff code</p>
        <input
          value={code}
          onChange={e => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }}
          onKeyDown={e => e.key === "Enter" && handleUnlock()}
          inputMode="numeric" type="password" autoComplete="off" maxLength={6}
          placeholder="——"
          className="w-full text-center text-3xl font-bold tracking-[0.35em] border-2 border-slate-200 rounded-2xl py-4 mb-4 focus:outline-none bg-slate-50"
          style={{ outline: "none" }}
          onFocus={e => (e.currentTarget.style.borderColor = "#023B64")}
          onBlur={e => (e.currentTarget.style.borderColor = "")}
        />
        {error && <p className="text-sm text-red-500 mb-3 font-medium">{error}</p>}
        <button
          onClick={handleUnlock}
          disabled={loading || code.length === 0}
          className="w-full text-white rounded-2xl py-4 text-base font-semibold disabled:opacity-40 transition-colors"
          style={{ backgroundColor: "#023B64" }}
        >
          {loading ? "Checking…" : "Sign In"}
        </button>
      </div>
    </div>
  );
}

// ─── Role Router ─────────────────────────────────────────────────────────────

// All roles that have a self-service view (vs. the admin/director multi-tab shell).
type Role = StaffDoc["role"];

const ROLE_META: Record<string, { label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }> = {
  counselor:  { label: "Bunk",         icon: BookOpen },
  specialist: { label: "Specialist",   icon: Settings },
  runner:     { label: "Runner",       icon: User },
  carline:    { label: "Carline",      icon: Car },
  walkup:     { label: "Walk-Up",      icon: Footprints },
  dispatcher: { label: "Dispatcher",   icon: Radio },
  beforecare: { label: "Before Care",  icon: Clock },
  aftercare:  { label: "After Care",   icon: Clock },
  bus:        { label: "Bus",          icon: Bus },
  lunch:      { label: "Lunch",        icon: UtensilsCrossed },
  director:   { label: "Director",     icon: Settings },
  admin:      { label: "Admin",        icon: Settings },
};

// Render the appropriate top-level view for a single role.
function renderRoleView(role: Role, staff: StaffDoc): React.ReactNode {
  switch (role) {
    case "counselor":  return <CounselorView staff={staff} />;
    case "specialist": return <SpecialistView staff={staff} />;
    case "runner":     return <RunnerView runnerName={staff.runnerLabel ?? staff.name} />;
    case "carline":    return <Caller source="Carline" />;
    case "walkup":     return <Caller source="Walk-Up" />;
    case "dispatcher": return <Dispatcher />;
    case "beforecare": return <CareView staff={staff} kind="BeforeCare" />;
    case "aftercare":  return <CareView staff={staff} kind="AfterCare" />;
    case "bus":        return <BusView staff={staff} />;
    case "lunch":      return <LunchDistributorView staff={staff} />;
    default:           return null; // admin/director handled by MultiTabShell
  }
}

function RoleRouter({ staff, onLogout }: { staff: StaffDoc; onLogout: () => void }) {
  // Build deduped list of roles, keeping `role` first.
  const allRoles: Role[] = [];
  const seen = new Set<Role>();
  for (const r of [staff.role, ...(staff.extraRoles ?? [])]) {
    if (!seen.has(r)) { seen.add(r); allRoles.push(r); }
  }

  // Admin/director uses the dedicated multi-tab shell.
  if (allRoles.some(r => r === "admin" || r === "director")) {
    return <MultiTabShell staff={staff} onLogout={onLogout} />;
  }

  // Multi-role staff: bottom tab nav between each role's view.
  if (allRoles.length > 1) {
    return <MultiRoleShell staff={staff} onLogout={onLogout} roles={allRoles} />;
  }

  // Single role: render directly.
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F6F1E9" }}>
      <MobileHeader staff={staff} onLogout={onLogout} />
      <main className="px-3 py-5 max-w-lg mx-auto">{renderRoleView(allRoles[0], staff)}</main>
    </div>
  );
}

function MultiRoleShell({ staff, onLogout, roles }: { staff: StaffDoc; onLogout: () => void; roles: Role[] }) {
  const [active, setActive] = useState<Role>(roles[0]);
  const activeMeta = ROLE_META[active];

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: "#F6F1E9" }}>
      <header className="sticky top-0 z-20" style={{ backgroundColor: "#023B64" }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <img src="/jcc-logo.png" alt="JCC Camps" className="h-9 w-auto flex-shrink-0" style={{ filter: "brightness(0) invert(1)" }} />
          <span className="text-sm text-white/70 truncate flex-1">{staff.name}</span>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
            style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}>
            {activeMeta?.label ?? active}
          </span>
          <button onClick={onLogout} className="p-2 text-white/60 active:text-white rounded-xl flex-shrink-0">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="px-3 py-5 max-w-lg mx-auto">{renderRoleView(active, staff)}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-20 safe-area-bottom">
        <div className="max-w-lg mx-auto flex">
          {roles.map(r => {
            const meta = ROLE_META[r];
            const Icon = meta?.icon ?? User;
            const on = active === r;
            return (
              <button key={r} onClick={() => setActive(r)}
                className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors"
                style={{ color: on ? "#023B64" : "#94a3b8" }}>
                <Icon size={22} strokeWidth={on ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium leading-none mt-0.5">{meta?.label ?? r}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function MobileHeader({ staff, onLogout }: { staff: StaffDoc; onLogout: () => void }) {
  const labels: Record<string, string> = {
    counselor:"Counselor", specialist:"Specialist", carline:"Carline", walkup:"Walk-Up",
    dispatcher:"Dispatcher", runner:"Runner", director:"Director", admin:"Admin",
    beforecare:"Before Care", aftercare:"After Care", bus:"Bus",
  };
  return (
    <header className="sticky top-0 z-20" style={{ backgroundColor: "#023B64" }}>
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
        <img src="/jcc-logo.png" alt="JCC Camps" className="h-9 w-auto flex-shrink-0" style={{ filter: "brightness(0) invert(1)" }} />
        <span className="text-sm text-white/70 truncate flex-1">{staff.name}</span>
        <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
          style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}>
          {labels[staff.role] ?? staff.role}
        </span>
        <button onClick={onLogout} className="p-2 text-white/60 active:text-white rounded-xl flex-shrink-0">
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
    <div className="min-h-screen pb-20" style={{ backgroundColor: "#F6F1E9" }}>
      <header className="sticky top-0 z-20" style={{ backgroundColor: "#023B64" }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <img src="/jcc-logo.png" alt="JCC Camps" className="h-9 w-auto mr-auto flex-shrink-0" style={{ filter: "brightness(0) invert(1)" }} />
          <span className="text-sm text-white/70 hidden sm:block">{staff.name}</span>
          <button onClick={onLogout} className="p-2 text-white/60 rounded-xl active:text-white">
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
                className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors"
                style={{ color: on ? "#023B64" : "#94a3b8" }}>
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

function CamperDetailSheet({ camper, onClose, hideCode = false, staffName }: { camper: CamperDoc; onClose: () => void; hideCode?: boolean; staffName?: string }) {
  const logs = useQuery(api.attendanceLogs.getByCamper, {
    camperId: camper._id,
    date: today(),
  });

  const resetMorning  = useMutation(api.campers.resetMorningStatus);
  const undoMarkOut   = useMutation(api.campers.undoLeftEarly);
  const saveNote      = useMutation(api.campers.setAttendanceNote);
  const checkIn       = useMutation(api.campers.confirmWithBunk);
  const doMarkAbsent  = useMutation(api.campers.markAbsent);
  const doMarkOut     = useMutation(api.campers.markLeftEarly);
  const [noteDraft, setNoteDraft] = useState(camper.attendanceNote ?? "");
  const [noteSaved, setNoteSaved] = useState(true);

  const displayName = camper.preferredName
    ? `${camper.preferredName}${camper.lastName ? " " + camper.lastName : ""}`
    : camper.name;

  const bg = avatarBg(camper.name);
  const initial = (camper.preferredName ?? camper.name).charAt(0).toUpperCase();

  const isAbsent = camper.arrivalStatus === "Absent";
  const isLeftEarly = !!(camper.bunkConfirmed && camper.leftEarly);
  const checkpoints: { label: string; done: boolean; value?: string; badge?: { label: string; style: string } }[] = [
    {
      label: isAbsent ? "Marked absent" : (camper.bunkConfirmed ? "Checked in at bunk" : "Not checked in"),
      done:  !!(camper.bunkConfirmed || isAbsent),
      badge: isAbsent ? { label: "Absent", style: "text-amber-600 bg-amber-100" } : undefined,
    },
    {
      label: "Checked out for dismissal",
      done:  isLeftEarly,
      badge: isLeftEarly ? { label: "Checked Out", style: "text-violet-600 bg-violet-100" } : undefined,
    },
    { label: "Called for pickup", done: camper.status !== "Waiting", value: camper.status !== "Waiting" ? camper.status : undefined },
    { label: "Runner assigned",   done: !!(camper.runner),           value: camper.runner ?? undefined },
    { label: "Picked up",         done: camper.status === "Picked Up" || camper.status === "Dismissed" },
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
                <div className="flex items-center gap-3 bg-red-50 border-2 border-red-400 rounded-2xl px-4 py-4">
                  <AlertTriangle size={24} className="text-red-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-red-800 text-base">Allergy Alert</p>
                    <p className="text-red-700 text-sm mt-0.5">This camper has allergies on file. Check with the office before serving food.</p>
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
            {!hideCode && (
              <InfoTile icon={<Hash size={16} />} label="Pickup Code" value={`#${camper.code}`} mono />
            )}
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
              {checkpoints.filter(cp => cp.done || cp.label !== "Checked out for dismissal").map((cp, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    cp.badge ? cp.badge.style.match(/bg-\S+/)?.[0] ?? "bg-slate-100" : cp.done ? "bg-green-100" : "bg-slate-100"
                  }`}>
                    {cp.badge
                      ? <AlertTriangle size={13} className={cp.badge.style.match(/text-\S+/)?.[0]} />
                      : cp.done
                        ? <Check size={14} className="text-green-600" />
                        : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                  </div>
                  <span className={`flex-1 text-sm font-medium ${cp.badge ? cp.badge.style.match(/text-\S+/)?.[0] : cp.done ? "text-slate-800" : "text-slate-400"}`}>
                    {cp.label}
                  </span>
                  {cp.value && !cp.badge && (
                    <span className="text-xs text-slate-500 font-medium">{cp.value}</span>
                  )}
                  {cp.badge && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cp.badge.style}`}>{cp.badge.label}</span>
                  )}
                </div>
              ))}
            </div>

          </div>

          {/* Quick actions / status correction */}
          {staffName && (
            <div>
              <SectionLabel>Attendance Status</SectionLabel>
              <div className="bg-white border border-slate-200 rounded-2xl p-2 grid grid-cols-2 gap-2">
                {!camper.bunkConfirmed && !isAbsent && (
                  <button onClick={() => checkIn({ id: camper._id, staffName })}
                    className="text-sm font-semibold text-white rounded-xl py-2.5 active:opacity-80"
                    style={{ backgroundColor: "#023B64" }}>
                    Check In
                  </button>
                )}
                {camper.bunkConfirmed && !isLeftEarly && (
                  <button onClick={() => doMarkOut({ id: camper._id, staffName })}
                    className="text-sm font-semibold text-violet-700 bg-violet-50 rounded-xl py-2.5 active:bg-violet-100">
                    Check Out
                  </button>
                )}
                {isLeftEarly && (
                  <button onClick={() => undoMarkOut({ id: camper._id })}
                    className="text-sm font-semibold text-green-700 bg-green-50 rounded-xl py-2.5 active:bg-green-100">
                    Undo Check Out
                  </button>
                )}
                {!isAbsent && (
                  <button onClick={() => doMarkAbsent({ id: camper._id, staffName })}
                    className="text-sm font-semibold text-amber-700 bg-amber-50 rounded-xl py-2.5 active:bg-amber-100">
                    Mark Absent
                  </button>
                )}
                {isAbsent && (
                  <button onClick={() => resetMorning({ id: camper._id })}
                    className="text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl py-2.5 active:bg-slate-200">
                    Undo Absent
                  </button>
                )}
                {(camper.bunkConfirmed || isAbsent) && (
                  <button onClick={() => resetMorning({ id: camper._id })}
                    className="text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl py-2.5 active:bg-slate-200">
                    Reset to Not Checked In
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Attendance note */}
          <div>
            <SectionLabel>Attendance Note</SectionLabel>
            <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
              <textarea
                value={noteDraft}
                onChange={(e) => { setNoteDraft(e.target.value); setNoteSaved(false); }}
                placeholder="e.g. Picked up early on Tuesdays, nurse visit at 2pm..."
                rows={2}
                className="w-full text-sm text-slate-700 placeholder:text-slate-400 resize-none focus:outline-none"
              />
              {!noteSaved && (
                <div className="flex justify-end">
                  <button
                    onClick={() => { saveNote({ id: camper._id, note: noteDraft }); setNoteSaved(true); }}
                    className="text-xs font-bold text-white px-3 py-1.5 rounded-full active:opacity-80"
                    style={{ backgroundColor: "#023B64" }}>
                    Save Note
                  </button>
                </div>
              )}
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
  const periodAssignments = staff.periodAssignments ?? [];
  const [view, setView] = useState<"bunk" | number>("bunk");

  // Upper Camp counselors who also run a period activity group get a top-level
  // switch between their bunk roster and their period roster(s).
  const tabSwitcher = periodAssignments.length > 0 && (
    <div className="flex gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5 mb-4">
      <button onClick={() => setView("bunk")}
        className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
        style={view === "bunk" ? { backgroundColor: "#023B64", color: "#fff" } : { color: "#64748b" }}>
        My Bunk
      </button>
      {periodAssignments.map((a, i) => (
        <button key={i} onClick={() => setView(i)}
          className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
          style={view === i ? { backgroundColor: "#023B64", color: "#fff" } : { color: "#64748b" }}>
          {PERIOD_LABEL[a.period] ?? a.period}
        </button>
      ))}
    </div>
  );

  if (view !== "bunk") {
    const assignment = periodAssignments[view];
    return (
      <div className="space-y-4">
        {tabSwitcher}
        <PeriodRosterView assignment={assignment} staffName={staff.name} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tabSwitcher}
      <CounselorBunkView staff={staff} bunk={bunk} />
    </div>
  );
}

type BunkGroupKey = "none" | "status" | "lunch" | "transport";

const BUNK_GROUP_OPTIONS: { key: BunkGroupKey; label: string }[] = [
  { key: "none",       label: "All" },
  { key: "status",     label: "In / Out" },
  { key: "lunch",      label: "Lunch" },
  { key: "transport",  label: "Transport" },
];

const STATUS_GROUP_ORDER = ["In", "Out", "Not Yet In", "Absent"];
const LUNCH_GROUP_ORDER = ["Buys Lunch", "Brings Lunch"];

type BunkRosterItem = { c: CamperDoc; isAbsent: boolean; arrived: boolean; dismissed: boolean };

function bunkGroupKey(item: BunkRosterItem, groupBy: BunkGroupKey): string {
  const { c, isAbsent, arrived, dismissed } = item;
  switch (groupBy) {
    case "status":
      if (isAbsent) return "Absent";
      if (dismissed) return "Out";
      if (arrived) return "In";
      return "Not Yet In";
    case "lunch":
      return c.lunchInfo?.trim() ? "Brings Lunch" : "Buys Lunch";
    case "transport":
      if (c.busRoute) return `Bus · ${c.busRoute}`;
      if (c.transportationType) return TRANSPORT_LABEL[c.transportationType] ?? "Other";
      return "Other";
    default:
      return "";
  }
}

function groupBunkRoster(items: BunkRosterItem[], groupBy: BunkGroupKey): [string, BunkRosterItem[]][] {
  if (groupBy === "none") return [["", items]];
  const map = new Map<string, BunkRosterItem[]>();
  for (const item of items) {
    const key = bunkGroupKey(item, groupBy);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  let order: string[];
  if (groupBy === "status") order = STATUS_GROUP_ORDER;
  else if (groupBy === "lunch") order = LUNCH_GROUP_ORDER;
  else order = [...map.keys()].sort((a, b) => a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b));
  return order.filter(k => map.has(k)).map(k => [k, map.get(k)!]);
}

function CounselorBunkView({ staff, bunk }: { staff: StaffDoc; bunk: string }) {
  const roster        = useQuery(api.campers.getBunkRoster, bunk ? { bunk } : "skip");
  const setArrived    = useMutation(api.campers.confirmWithBunk);
  const setNotArrived = useMutation(api.campers.unconfirmWithBunk);
  const setOut        = useMutation(api.campers.markLeftEarly);
  const setNotOut     = useMutation(api.campers.undoLeftEarly);
  const [selected,  setSelected]  = useState<CamperDoc | null>(null);
  const [flagsOpen, setFlagsOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<BunkGroupKey>("none");

  const isAdmin = [staff.role, ...(staff.extraRoles ?? [])].some(r => r === "admin" || r === "director");

  if (!bunk) return (
    <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
      No bunk assigned. Contact an administrator.
    </div>
  );
  if (roster === undefined) return <Loading />;

  const sorted = [...roster].sort((a, b) => camperName(a).localeCompare(camperName(b)));

  // A camper marked "Out" without ever being marked "In" never actually came in today.
  const items: BunkRosterItem[] = sorted.map(c => {
    const isAbsent  = c.arrivalStatus === "Absent" || (!!c.leftEarly && !c.bunkConfirmed);
    const arrived   = !!c.bunkConfirmed && !isAbsent;
    const dismissed = !!c.leftEarly && !isAbsent;
    return { c, isAbsent, arrived, dismissed };
  });

  const inCount     = items.filter(i => i.arrived).length;
  const outCount    = items.filter(i => i.dismissed).length;
  const absentCount = items.filter(i => i.isAbsent).length;
  const called      = roster.filter(c => c.status === "Called" || c.status === "Assigned");

  const toggleAM = (c: CamperDoc) => {
    if (c.arrivalStatus === "Absent") return;
    if (c.bunkConfirmed) setNotArrived({ id: c._id });
    else                 setArrived({ id: c._id, staffName: staff.name });
  };
  const toggleOut = (c: CamperDoc) => {
    if (c.arrivalStatus === "Absent") return;
    if (c.leftEarly) setNotOut({ id: c._id });
    else             setOut({ id: c._id, staffName: staff.name });
  };

  const groups = groupBunkRoster(items, groupBy);

  return (
    <>
      <div className="space-y-4">
        {/* Header + admin gear */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold" style={{ color: "#023B64" }}>{bunk}</h2>
          {isAdmin && (
            <button onClick={() => setFlagsOpen(true)}
              className="p-2 rounded-xl text-slate-500 active:bg-slate-100" aria-label="Daily flags">
              <Settings size={20} />
            </button>
          )}
        </div>

        {/* Summary strip */}
        <div className="flex gap-2">
          <Pill value={inCount}  label="In"  color="slate" />
          <Pill value={outCount} label="Out" color="slate" />
        </div>
        {absentCount > 0 && (
          <div className="text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl px-3 py-2.5 text-center">
            {absentCount} camper{absentCount !== 1 ? "s" : ""} absent today
          </div>
        )}

        {/* Called-for-pickup alert */}
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

        {/* Group by selector */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {BUNK_GROUP_OPTIONS.map(opt => (
            <button key={opt.key} onClick={() => setGroupBy(opt.key)}
              className="px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0"
              style={groupBy === opt.key
                ? { backgroundColor: "#023B64", color: "#fff" }
                : { color: "#64748b", backgroundColor: "#fff", border: "1px solid #e2e8f0" }}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Roster — one screen, two tap targets per camper */}
        {groups.map(([label, groupItems]) => (
          <div key={label || "all"}>
            {label && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{label}</span>
                <span className="text-xs text-slate-400">{groupItems.length}</span>
              </div>
            )}
            <div className="space-y-2">
              {groupItems.map(({ c, isAbsent, arrived, dismissed }) => (
                <BunkCamperRow key={c._id} camper={c} isAbsent={isAbsent} arrived={arrived} dismissed={dismissed}
                  onOpenProfile={() => setSelected(c)}
                  onToggleAM={() => toggleAM(c)}
                  onToggleOut={() => toggleOut(c)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} hideCode staffName={staff.name} />}
      {flagsOpen && <DailyFlagsPanel campers={sorted} bunk={bunk} staffName={staff.name} onClose={() => setFlagsOpen(false)} />}
    </>
  );
}

// One roster row: identity + transport/lunch/flags inline, plus In / Out tap targets.
function BunkCamperRow({ camper, isAbsent, arrived, dismissed, onOpenProfile, onToggleAM, onToggleOut }: {
  camper: CamperDoc;
  isAbsent: boolean;
  arrived: boolean;
  dismissed: boolean;
  onOpenProfile: () => void;
  onToggleAM: () => void;
  onToggleOut: () => void;
}) {
  const name = camperName(camper);
  const bg = avatarBg(camper.name);
  const isCalled  = camper.status === "Called" || camper.status === "Assigned";

  const buysLunch = !camper.lunchInfo?.trim();
  const lunchPickedUp = !!camper.dailyCheckpoints?.Lunch;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
      isAbsent ? "border-slate-200 opacity-60" : isCalled ? "border-amber-300" : "border-slate-200"
    }`}>
      {/* Info area → opens profile */}
      <button onClick={onOpenProfile} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
        <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-lg text-white overflow-hidden"
          style={{ backgroundColor: bg }}>
          {camper.photoUrl
            ? <img src={camper.photoUrl} alt={name} className="w-full h-full object-cover" />
            : (camper.preferredName ?? camper.name).charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-900 text-base leading-tight">{name}</span>
            {camper.hasAllergies && (
              <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full tracking-wide">ALLERGY</span>
            )}
            {isCalled && <StatusBadge status={camper.status} />}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {camper.busRoute ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {camper.busRoute}
              </span>
            ) : camper.transportationType && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {TRANSPORT_LABEL[camper.transportationType]}
              </span>
            )}
            {buysLunch ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-0.5">
                <UtensilsCrossed size={10} />{lunchPickedUp ? "Lunch ✓" : "Lunch"}
              </span>
            ) : (
              <span className="text-xs text-slate-500 flex items-center gap-0.5">
                <UtensilsCrossed size={10} />{camper.lunchInfo}
              </span>
            )}
            {isAbsent && <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Absent</span>}
            {camper.lateDropoffTime && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-0.5">
                <Clock size={10} />Late {fmtClock(camper.lateDropoffTime)}
              </span>
            )}
            {camper.earlyPickupTime && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-0.5">
                <Clock size={10} />Early {fmtClock(camper.earlyPickupTime)}
              </span>
            )}
          </div>
          {camper.attendanceNote && (
            <p className="text-xs italic text-slate-500 truncate mt-1">{camper.attendanceNote}</p>
          )}
        </div>
        <ArrowRight size={16} className="text-slate-300 flex-shrink-0" />
      </button>

      {/* Two tap targets: In (arrival) | Out (dismissal) */}
      <div className="border-t border-slate-100 flex">
        <button onClick={onToggleAM} disabled={isAbsent}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-1.5 border-r border-slate-100 transition-colors ${
            isAbsent ? "bg-slate-50 text-slate-300 cursor-not-allowed"
            : arrived ? "bg-green-500 text-white active:bg-green-600"
            : "bg-white text-slate-500 active:bg-slate-50"
          }`}>
          In
        </button>
        <button onClick={onToggleOut} disabled={isAbsent}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${
            isAbsent ? "bg-slate-50 text-slate-300 cursor-not-allowed"
            : dismissed ? "bg-green-500 text-white active:bg-green-600"
            : "bg-white text-slate-500 active:bg-slate-50"
          }`}>
          Out
        </button>
      </div>
    </div>
  );
}

// Admin-only panel for setting per-camper daily flags before camp starts.
function DailyFlagsPanel({ campers, bunk, staffName, onClose }: {
  campers: CamperDoc[];
  bunk: string;
  staffName: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="backdrop-fade absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="sheet-slide-up relative bg-white rounded-t-3xl flex flex-col max-h-[92dvh] overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Daily Flags</h3>
            <p className="text-xs text-slate-500">{bunk} · set before camp starts</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center active:bg-slate-200">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">
          {campers.map(c => <FlagEditor key={c._id} camper={c} staffName={staffName} />)}
        </div>
      </div>
    </div>
  );
}

function FlagEditor({ camper, staffName }: { camper: CamperDoc; staffName: string }) {
  const setAbsent = useMutation(api.campers.setAbsent);
  const setLate   = useMutation(api.campers.setLateDropoff);
  const setEarly  = useMutation(api.campers.setEarlyPickup);
  const saveNote  = useMutation(api.campers.setAttendanceNote);

  const isAbsent = camper.arrivalStatus === "Absent";
  const [note, setNote] = useState(camper.attendanceNote ?? "");

  return (
    <div className="border border-slate-200 rounded-2xl p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-900 truncate">{camperName(camper)}</span>
        <button onClick={() => setAbsent({ id: camper._id, absent: !isAbsent, staffName })}
          className={`text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${isAbsent ? "bg-red-500 text-white" : "bg-slate-100 text-slate-500 active:bg-slate-200"}`}>
          {isAbsent ? "Absent" : "Mark Absent"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-slate-500 block">
          Late drop-off
          <input type="time" defaultValue={camper.lateDropoffTime ?? ""}
            onChange={e => setLate({ id: camper._id, time: e.target.value })}
            className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
        </label>
        <label className="text-xs font-medium text-slate-500 block">
          Early pickup
          <input type="time" defaultValue={camper.earlyPickupTime ?? ""}
            onChange={e => setEarly({ id: camper._id, time: e.target.value })}
            className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
        </label>
      </div>
      <input value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={() => saveNote({ id: camper._id, note })}
        placeholder="Note (optional)"
        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none" />
    </div>
  );
}

// ─── Generic Checkpoint Roster (Before/After Care, Bus sheets, Lunch check) ──

type CheckpointKey = "BeforeCare" | "AfterCare" | "Lunch" | "Bus";

function CheckpointRosterView({
  campers, checkpoint, staffName, actionLabel, doneLabel, groupLabel, emptyMessage,
}: {
  campers: CamperDoc[];
  checkpoint: CheckpointKey;
  staffName: string;
  actionLabel: string;   // e.g. "Check In"
  doneLabel: string;     // e.g. "Checked In"
  groupLabel?: string;   // optional group name for the activity log, e.g. "Bus 3"
  emptyMessage?: string;
}) {
  const setCheckpoint = useMutation(api.campers.setCheckpoint);
  const [selected, setSelected] = useState<CamperDoc | null>(null);

  const notDone = campers.filter(c => !c.dailyCheckpoints?.[checkpoint]);
  const done    = campers.filter(c => c.dailyCheckpoints?.[checkpoint]);

  if (campers.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
        {emptyMessage ?? "No campers in this group."}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Progress bar */}
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${campers.length ? (done.length / campers.length) * 100 : 0}%`, backgroundColor: "#5B8C9D" }} />
        </div>

        {/* Stat pills */}
        <div className="flex gap-2">
          <Pill value={done.length}    label={doneLabel} color="green" />
          <Pill value={notDone.length} label="Remaining" color="slate" />
        </div>

        {/* Needs check-in */}
        {notDone.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                Needs Check-In
              </span>
              <span className="text-xs text-slate-400">{notDone.length}</span>
            </div>
            <div className="space-y-2">
              {notDone.map(c => (
                <RosterCheckCard key={c._id} camper={c} present={false}
                  actionLabel={actionLabel} doneLabel={doneLabel}
                  onTap={() => setSelected(c)}
                  onCheck={() => setCheckpoint({ id: c._id, checkpoint, value: true, staffName, label: groupLabel })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Done */}
        {done.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                {doneLabel}
              </span>
              <span className="text-xs text-slate-400">{done.length}</span>
            </div>
            <div className="space-y-2">
              {done.map(c => (
                <RosterCheckCard key={c._id} camper={c} present={true}
                  actionLabel={actionLabel} doneLabel={doneLabel}
                  onTap={() => setSelected(c)}
                  onCheck={() => setCheckpoint({ id: c._id, checkpoint, value: false, staffName, label: groupLabel })}
                />
              ))}
            </div>
          </div>
        )}

        {notDone.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <Check size={32} className="text-green-500 mx-auto mb-2" />
            <p className="font-bold text-green-800 text-lg">All {campers.length} campers {doneLabel.toLowerCase()}!</p>
          </div>
        )}
      </div>

      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} hideCode />}
    </>
  );
}

// Same card shell as CamperCard (size/layout never changes), but driven by a
// generic "present" flag + action labels instead of the morning attendance flow.
function RosterCheckCard({
  camper, onTap, onCheck, present, actionLabel, doneLabel,
}: {
  camper: CamperDoc;
  onTap: () => void;
  onCheck: () => void;
  present: boolean;
  actionLabel: string;
  doneLabel: string;
}) {
  const name = camper.preferredName
    ? `${camper.preferredName}${camper.lastName ? " " + camper.lastName : ""}`
    : camper.name;
  const bg = avatarBg(camper.name);

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${present ? "border-green-200" : "border-slate-200"}`}>
      <button onClick={onTap} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-slate-50">
        <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-lg text-white overflow-hidden"
          style={{ backgroundColor: bg }}>
          {camper.photoUrl
            ? <img src={camper.photoUrl} alt={name} className="w-full h-full object-cover" />
            : (camper.preferredName ?? camper.name).charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-900 text-base leading-tight">{name}</span>
            {camper.hasAllergies && <AlertTriangle size={13} className="text-orange-500 flex-shrink-0" />}
            {camper.hasNotes     && <AlertCircle   size={13} className="text-blue-400  flex-shrink-0" />}
            {camper.lunchInfo    && <UtensilsCrossed size={13} className="text-slate-400 flex-shrink-0" />}
          </div>
        </div>
        <ArrowRight size={16} className="text-slate-300 flex-shrink-0" />
      </button>

      <div className={`border-t flex ${present ? "border-green-100" : "border-slate-100"}`}>
        {present ? (
          <button onClick={onCheck}
            className="flex-1 py-3.5 text-sm font-bold flex items-center justify-center gap-1.5 bg-green-50 text-green-700 active:bg-green-100 transition-colors">
            {doneLabel} · Tap to undo
          </button>
        ) : (
          <button onClick={onCheck}
            className="flex-1 py-3.5 text-sm font-bold text-white flex items-center justify-center gap-1.5 transition-colors active:opacity-80"
            style={{ backgroundColor: "#023B64" }}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Before / After Care ──────────────────────────────────────────────────────

function CareView({ staff, kind }: { staff: StaffDoc; kind: "BeforeCare" | "AfterCare" }) {
  const roster = useQuery(kind === "BeforeCare" ? api.campers.getBeforeCareRoster : api.campers.getAfterCareRoster, {});
  if (roster === undefined) return <Loading />;

  const title = kind === "BeforeCare" ? "Before Care" : "After Care";
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold" style={{ color: "#023B64" }}>{title}</h2>
      <CheckpointRosterView
        campers={roster}
        checkpoint={kind}
        staffName={staff.name}
        actionLabel="Check In"
        doneLabel="Checked In"
        groupLabel={title}
        emptyMessage={`No campers are enrolled in ${title}.`}
      />
    </div>
  );
}

// ─── Bus Attendance Sheets ────────────────────────────────────────────────────

function BusView({ staff }: { staff: StaffDoc }) {
  const [route, setRoute] = useState(staff.groupAssignment ?? BUS_ROUTES[0]);
  const roster = useQuery(api.campers.getBusRoster, { route });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold" style={{ color: "#023B64" }}>{route}</h2>

      {/* Bus selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {BUS_ROUTES.map(r => (
          <button key={r} onClick={() => setRoute(r)}
            className="px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0"
            style={route === r ? { backgroundColor: "#023B64", color: "#fff" } : { color: "#64748b", backgroundColor: "#fff", border: "1px solid #e2e8f0" }}>
            {r}
          </button>
        ))}
      </div>

      {roster === undefined ? <Loading /> : (
        <CheckpointRosterView
          campers={roster}
          checkpoint="Bus"
          staffName={staff.name}
          actionLabel="Board"
          doneLabel="On Bus"
          groupLabel={route}
          emptyMessage={`No campers assigned to ${route}.`}
        />
      )}
    </div>
  );
}

// ─── Lunch Distributor ────────────────────────────────────────────────────────

function LunchDistributorView({ staff }: { staff: StaffDoc }) {
  const buyers = useQuery(api.campers.getLunchBuyers, {});
  const [bunkFilter, setBunkFilter] = useState<string>("All");

  if (buyers === undefined) return <Loading />;

  const bunks = ["All", ...Array.from(new Set(buyers.map(c => c.bunk))).sort()];
  const filtered = bunkFilter === "All" ? buyers : buyers.filter(c => c.bunk === bunkFilter);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold" style={{ color: "#023B64" }}>Lunch Distribution</h2>
      <p className="text-sm text-slate-500 -mt-2">
        Track who has picked up their bought lunch. Counselors can see this status but cannot change it.
      </p>

      {/* Bunk filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {bunks.map(b => (
          <button key={b} onClick={() => setBunkFilter(b)}
            className="px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0"
            style={bunkFilter === b
              ? { backgroundColor: "#023B64", color: "#fff" }
              : { color: "#64748b", backgroundColor: "#fff", border: "1px solid #e2e8f0" }}>
            {b}
          </button>
        ))}
      </div>

      <CheckpointRosterView
        campers={filtered}
        checkpoint="Lunch"
        staffName={staff.name}
        actionLabel="Picked Up"
        doneLabel="Picked Up"
        groupLabel={bunkFilter === "All" ? undefined : bunkFilter}
        emptyMessage="No buy-lunch campers in this group."
      />
    </div>
  );
}

// ─── Specialist View (Upper Camp activity rosters) ───────────────────────────

function SpecialistView({ staff }: { staff: StaffDoc }) {
  const assignments = staff.periodAssignments ?? [];
  const [active, setActive] = useState(0);

  if (assignments.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
        No periods assigned. Contact an administrator.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {assignments.length > 1 && (
        <div className="flex gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5 overflow-x-auto">
          {assignments.map((a, i) => (
            <button key={i} onClick={() => setActive(i)}
              className="flex-1 py-2 px-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
              style={active === i ? { backgroundColor: "#023B64", color: "#fff" } : { color: "#64748b" }}>
              {PERIOD_LABEL[a.period] ?? a.period}
            </button>
          ))}
        </div>
      )}
      <PeriodRosterView assignment={assignments[active]} staffName={staff.name} />
    </div>
  );
}

function PeriodRosterView({
  assignment, staffName,
}: {
  assignment: { period: string; group: string; activity?: string };
  staffName: string;
}) {
  const roster = useQuery(api.campers.getPeriodRoster, { period: assignment.period, group: assignment.group });
  const setPeriodAttendance = useMutation(api.campers.setPeriodAttendance);
  const [selected, setSelected] = useState<CamperDoc | null>(null);

  if (roster === undefined) return <Loading />;

  const present = roster.filter(c => c.periodAttendance?.[assignment.period] === "Present");
  const absent  = roster.filter(c => c.periodAttendance?.[assignment.period] === "Absent");
  const unmarked = roster.filter(c => !c.periodAttendance?.[assignment.period]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: "#023B64" }}>{assignment.activity ?? assignment.group}</h2>
            <p className="text-slate-500 text-sm">{PERIOD_LABEL[assignment.period] ?? assignment.period} · {assignment.group}</p>
          </div>
          <span className="text-slate-500 text-sm font-medium">{present.length} / {roster.length}</span>
        </div>

        <div className="flex gap-2">
          <Pill value={present.length} label="Present" color="green" />
          <Pill value={absent.length}  label="Absent"  color="amber" />
          <Pill value={unmarked.length} label="Unmarked" color="slate" />
        </div>

        {roster.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
            No campers scheduled for this group.
          </div>
        )}

        <div className="space-y-2">
          {roster.map(c => {
            const status = c.periodAttendance?.[assignment.period];
            const name = c.preferredName ?? c.name;
            return (
              <div key={c._id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setSelected(c)} className="flex items-center gap-3 flex-1 px-4 py-3 text-left active:bg-slate-50">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold overflow-hidden"
                    style={{ backgroundColor: avatarBg(c.name) }}>
                    {c.photoUrl ? <img src={c.photoUrl} alt={name} className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-700 text-sm">{name}</span>
                    <p className="text-xs text-slate-400">{c.bunk}</p>
                    <AttendanceNoteLine note={c.attendanceNote} />
                  </div>
                </button>
                <div className="flex border-l border-slate-100">
                  <button
                    onClick={() => setPeriodAttendance({ id: c._id, period: assignment.period, status: "Present", staffName })}
                    className={`px-3.5 py-3 text-xs font-semibold transition-colors ${status === "Present" ? "bg-green-100 text-green-700" : "text-slate-400 active:text-green-600"}`}>
                    Present
                  </button>
                  <button
                    onClick={() => setPeriodAttendance({ id: c._id, period: assignment.period, status: "Absent", staffName })}
                    className={`px-3.5 py-3 text-xs font-semibold border-l border-slate-100 transition-colors ${status === "Absent" ? "bg-amber-100 text-amber-700" : "text-slate-400 active:text-amber-600"}`}>
                    Absent
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} hideCode />}
    </>
  );
}

function AttendanceNoteLine({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <div className="flex items-start gap-1 mt-0.5 text-xs text-amber-700">
      <StickyNote size={11} className="flex-shrink-0 mt-0.5" />
      <span className="truncate">{note}</span>
    </div>
  );
}

function Pill({ value, label, color }: { value: number; label: string; color: "green"|"blue"|"slate"|"amber" }) {
  const styles = { green:"bg-green-50 text-green-700 border-green-200", blue:"bg-blue-50 text-blue-700 border-blue-200", slate:"bg-slate-50 text-slate-600 border-slate-200", amber:"bg-amber-50 text-amber-700 border-amber-200" };
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
            className="w-full text-center text-5xl font-bold tracking-[0.4em] border-2 border-slate-200 rounded-2xl py-5 focus:outline-none bg-slate-50"
            onFocus={e => (e.currentTarget.style.borderColor = "#023B64")}
            onBlur={e => (e.currentTarget.style.borderColor = "")} />

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
                className="w-full text-white rounded-2xl py-4 font-bold text-base mt-2 transition-colors"
                style={{ backgroundColor: "#023B64" }}>
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
                    className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-colors ${c.runner === r ? "text-white" : "bg-slate-100 text-slate-700 active:bg-slate-200"}`}
                    style={c.runner === r ? { backgroundColor: "#023B64" } : undefined}>
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
                  className="w-full text-white py-4 font-bold text-base flex items-center justify-center gap-2"
                  style={{ backgroundColor: "#5B8C9D" }}>
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
            className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:outline-none text-sm"
            onFocus={e => (e.currentTarget.style.borderColor = "#023B64")}
            onBlur={e => (e.currentTarget.style.borderColor = "")} />
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
