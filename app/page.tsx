"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  Car, Footprints, Radio, User, Settings, Lock, Search, RotateCcw,
  Check, ChevronRight, AlertCircle, Clock, MapPin,
  AlertTriangle, LogOut, ChevronDown, ChevronUp,
  X, Hash, BookOpen, Bus, ArrowRight, StickyNote,
  CheckCircle2, ChevronLeft, Upload, Users, Building2, Calendar, UtensilsCrossed,
  Route,
} from "lucide-react";

// ─── Brand colors (JCC Greater Boston) ───────────────────────────────────────
// Navy #023B64 | Steel Blue #5B8C9D | Pearl #F6F1E9 | Silver Fog #8EB2CB

// ─── Constants ────────────────────────────────────────────────────────────────

const RUNNERS_FALLBACK = ["Runner 1", "Runner 2", "Runner 3", "Runner 4"];
const BUS_ROUTES_FALLBACK = ["Bus 1", "Bus 2", "Bus 3", "Bus 4", "Bus 5", "Bus 6"];
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
  Period7: "Period 7",
};

const today = () => new Date().toISOString().split("T")[0];

// Which Upper Camp schedule today follows: Friday → "Friday", else "MonThu".
const currentDayType = (): "MonThu" | "Friday" => (new Date().getDay() === 5 ? "Friday" : "MonThu");

type StaffDoc  = Doc<"staff">;
type CamperDoc = Doc<"campers">;

// ─── Campus Presence Helper ───────────────────────────────────────────────────
// Returns whether a camper is currently Here or NotHere based solely on raw
// checkpoint state. No automatic gap/exception detection.

type CampusPresence = "Here" | "NotHere";

interface CampusPresenceResult {
  status: CampusPresence;
  label: string;   // "Here" | "Not Here"
  detail: string;  // e.g. "In Bunk", "Not Arrived", "Absent"
}

function getCampusPresence(c: CamperDoc): CampusPresenceResult {
  if (c.arrivalStatus === "Absent")   return { status: "NotHere", label: "Not Here", detail: "Absent" };
  if (c.status === "Dismissed")       return { status: "NotHere", label: "Not Here", detail: "Dismissed" };
  if (c.bunkConfirmed && c.leftEarly) return { status: "NotHere", label: "Not Here", detail: "Left for Day" };
  if (c.bunkConfirmed)                return { status: "Here",    label: "Here",     detail: "In Bunk" };
  return { status: "NotHere", label: "Not Here", detail: "Not Arrived" };
}

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
          <img src="/jcc-logo.png" alt="JCC Camps" className="h-24 w-auto" />
        </div>
        <p className="text-slate-500 text-sm mt-2 mb-7">Enter your staff code</p>
        <input
          value={code}
          onChange={e => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }}
          onKeyDown={e => e.key === "Enter" && handleUnlock()}
          inputMode="numeric" type="password" autoComplete="off" maxLength={6}
          placeholder="————"
          className="w-full text-center text-3xl font-normal tracking-[0.35em] border-2 border-slate-200 rounded-2xl py-4 mb-4 focus:outline-none bg-slate-50"
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
  director:   { label: "Director",     icon: Settings },
  admin:      { label: "Admin",        icon: Settings },
  unithead:   { label: "Unit Head",    icon: BookOpen },
};

// Render the appropriate top-level view for a single role.
function renderRoleView(role: Role, staff: StaffDoc): React.ReactNode {
  switch (role) {
    case "counselor":  return <CounselorView staff={staff} />;
    case "specialist": return <SpecialistView staff={staff} />;
    case "runner":     return <RunnerViewForStaff staff={staff} />;
    case "carline":    return <Caller source="Carline" />;
    case "walkup":     return <Caller source="Walk-Up" />;
    case "dispatcher": return <Dispatcher />;
    case "beforecare": return <CareView staff={staff} kind="BeforeCare" />;
    case "aftercare":  return <CareView staff={staff} kind="AfterCare" />;
    case "bus":        return <BusView staff={staff} />;
    case "unithead":   return <CounselorView staff={staff} />;
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
    beforecare:"Before Care", aftercare:"After Care", bus:"Bus", unithead:"Unit Head",
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

type AdminSection = "campers" | "transport" | "extday" | "bunk" | "admin" | "staff" | "upload" | "structure" | "periods" | "tracks" | "lunch";
type TransportSub = "carline" | "walkup" | "dispatcher" | "runner" | "bus";
type ExtDaySub    = "beforecare" | "aftercare";

function MultiTabShell({ staff, onLogout }: { staff: StaffDoc; onLogout: () => void }) {
  const [section,  setSection]  = useState<AdminSection>("campers");
  const [transSub, setTransSub] = useState<TransportSub>("carline");
  const [extSub,   setExtSub]   = useState<ExtDaySub>("beforecare");

  const sections: { id: AdminSection; label: string; icon: React.ReactNode }[] = [
    { id: "campers",   label: "Dashboard",  icon: <Users size={18} /> },
    { id: "transport", label: "Transport",  icon: <Car size={18} /> },
    { id: "extday",    label: "Ext. Day",   icon: <Clock size={18} /> },
    { id: "bunk",      label: "Bunk",       icon: <BookOpen size={18} /> },
    { id: "admin",     label: "Admin",      icon: <Settings size={18} /> },
    { id: "structure", label: "Structure",  icon: <Building2 size={18} /> },
    { id: "staff",     label: "Staff",      icon: <User size={18} /> },
    { id: "periods",   label: "Periods",    icon: <Calendar size={18} /> },
    { id: "tracks",    label: "Tracks",     icon: <Route size={18} /> },
    { id: "lunch",     label: "Lunch",      icon: <UtensilsCrossed size={18} /> },
    { id: "upload",    label: "Upload",     icon: <Upload size={18} /> },
  ];

  const transTabs: { id: TransportSub; label: string }[] = [
    { id: "carline",    label: "Carline"    },
    { id: "walkup",     label: "Walk-Up"    },
    { id: "dispatcher", label: "Dispatcher" },
    { id: "runner",     label: "Runner"     },
    { id: "bus",        label: "Bus"        },
  ];

  const extTabs: { id: ExtDaySub; label: string }[] = [
    { id: "beforecare", label: "Before Care" },
    { id: "aftercare",  label: "After Care"  },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F6F1E9" }}>
      {/* Header */}
      <header className="sticky top-0 z-20" style={{ backgroundColor: "#023B64" }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <img src="/jcc-logo.png" alt="JCC Camps" className="h-9 w-auto mr-auto flex-shrink-0" style={{ filter: "brightness(0) invert(1)" }} />
          <span className="text-sm text-white/70 hidden sm:block">{staff.name}</span>
          <button onClick={onLogout} className="p-2 text-white/60 rounded-xl active:text-white">
            <LogOut size={18} />
          </button>
        </div>

        {/* Section picker — 4-column grid, no scroll */}
        <div className="grid grid-cols-4 gap-px px-2 pb-2 pt-1">
          {sections.map(s => {
            const active = section === s.id;
            return (
              <button key={s.id} onClick={() => setSection(s.id)}
                className="relative flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-colors"
                style={active
                  ? { backgroundColor: "rgba(255,255,255,0.22)", color: "#fff" }
                  : { backgroundColor: "transparent", color: "rgba(255,255,255,0.5)" }}>
                {s.icon}
                <span className="text-[10px] font-semibold leading-tight">{s.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-5">
        {section === "transport" && (
          <>
            {/* Transportation sub-tabs */}
            <div className="flex gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5 mb-4 overflow-x-auto">
              {transTabs.map(t => (
                <button key={t.id} onClick={() => setTransSub(t.id)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
                  style={transSub === t.id ? { backgroundColor: "#023B64", color: "#fff" } : { color: "#64748b" }}>
                  {t.label}
                </button>
              ))}
            </div>
            {transSub === "carline"    && <Caller source="Carline" />}
            {transSub === "walkup"     && <Caller source="Walk-Up" />}
            {transSub === "dispatcher" && <Dispatcher />}
            {transSub === "runner"     && <RunnerAdminView />}
            {transSub === "bus"        && <BusView staff={staff} />}
          </>
        )}

        {section === "extday" && (
          <>
            {/* Extended Day sub-tabs */}
            <div className="flex gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5 mb-4">
              {extTabs.map(t => (
                <button key={t.id} onClick={() => setExtSub(t.id)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
                  style={extSub === t.id ? { backgroundColor: "#023B64", color: "#fff" } : { color: "#64748b" }}>
                  {t.label}
                </button>
              ))}
            </div>
            {extSub === "beforecare" && <CareView staff={staff} kind="BeforeCare" />}
            {extSub === "aftercare"  && <CareView staff={staff} kind="AfterCare" />}
          </>
        )}

        {section === "campers"  && <CamperDashboard staff={staff} />}
        {section === "bunk"     && <AdminBunkView staff={staff} />}
        {section === "admin"    && <Admin />}
        {section === "structure" && <CampStructureManagement />}
        {section === "staff"    && <StaffManagement />}
        {section === "periods"  && <PeriodManagement />}
        {section === "tracks"   && <TrackManagement />}
        {section === "lunch"    && <LunchManagement />}
        {section === "upload"   && <CamperUpload />}
      </main>
    </div>
  );
}

// ─── Camper Dashboard ─────────────────────────────────────────────────────────

interface CamperRow {
  camper:       CamperDoc;
  campusStatus: "Here" | "NotHere";
  arrival:      string;
  beforeCare:   string;
  bunk:         string;
  afterCare:    string;
  busRoom:      string;
  runner:       string;
  dismissal:    string;
}

function getCamperRow(c: CamperDoc): CamperRow {
  const presence = getCampusPresence(c);

  // Arrival
  let arrival = "Not Arrived";
  if (c.arrivalStatus === "Absent") {
    arrival = "Absent";
  } else if (c.arrivalStatus === "Arrived") {
    const t = c.arrivalType;
    if (t === "BeforeCare") arrival = "Before Care";
    else if (t?.startsWith("Bus")) arrival = `Bus (${t.replace("Bus", "").trim() || ""})`.replace(" ()", "");
    else if (t === "WalkIn") arrival = "Walk-In";
    else if (t === "LateDropOff") arrival = "Late Drop-Off";
    else if (t === "Director") arrival = "Director";
    else arrival = "Carline";
  }

  // Before Care
  let beforeCare = "Not Expected";
  const bcIn  = !!c.dailyCheckpoints?.BeforeCare;
  const bcOut = !!c.dailyCheckpointsOut?.BeforeCare;
  if (c.beforeCare || bcIn) {
    if (bcOut)      beforeCare = "Out to Bunk";
    else if (bcIn)  beforeCare = "In Before Care";
    else            beforeCare = "Expected";
  }

  // Bunk
  let bunk = "Not In";
  if (c.arrivalStatus === "Absent") {
    bunk = "—";
  } else if (c.bunkConfirmed) {
    if (c.status === "Dismissed") {
      bunk = "Out to Dismissal";
    } else if (c.leftEarly) {
      if (c.dailyCheckpoints?.AfterCare) bunk = "Out to After Care";
      else if (c.dailyCheckpoints?.Bus || c.dailyCheckpointsOut?.Bus) bunk = "Out to Bus Room";
      else bunk = "Left Early";
    } else {
      bunk = "In Bunk";
    }
  } else if (bcOut) {
    bunk = "Expected (from BC)";
  }

  // After Care
  let afterCare = "Not Expected";
  const isACExpected = c.afterCare || c.transportationType === "AfterCare" || c.dailyDismissalOverride === "AfterCare";
  const acIn  = !!c.dailyCheckpoints?.AfterCare;
  const acOut = !!c.dailyCheckpointsOut?.AfterCare;
  if (isACExpected || acIn) {
    if (acOut)      afterCare = "Picked Up";
    else if (acIn)  afterCare = "In After Care";
    else            afterCare = "Expected";
  }

  // Bus Room
  let busRoom = "Not Expected";
  const isBusExpected = c.transportationType === "Bus" || c.dailyDismissalOverride === "Bus" || !!c.busRoute;
  const busIn  = !!c.dailyCheckpoints?.Bus;
  const busOut = !!c.dailyCheckpointsOut?.Bus;
  if (isBusExpected || busIn || busOut) {
    if (busOut)     busRoom = "Boarded Bus";
    else if (busIn) busRoom = "In Bus Room";
    else            busRoom = "Expected";
  }

  // Runner
  let runner = "—";
  if (c.runner) {
    if (c.status === "Assigned")     runner = `Assigned · ${c.runner}`;
    else if (c.status === "Picked Up") runner = `With ${c.runner}`;
    else runner = c.runner;
  }

  // Dismissal
  let dismissal = "Not Called";
  if (c.arrivalStatus === "Absent") {
    dismissal = "—";
  } else if (c.status === "Dismissed") {
    dismissal = "Dismissed";
  } else if (c.leftEarly && !acIn && !busIn && !busOut) {
    dismissal = "Left for Day";
  } else if (c.status === "Picked Up") {
    dismissal = "With Runner";
  } else if (c.status === "Assigned") {
    dismissal = "Assigned";
  } else if (c.status === "Called") {
    dismissal = "Called";
  }

  return { camper: c, campusStatus: presence.status, arrival, beforeCare, bunk, afterCare, busRoom, runner, dismissal };
}

const DASHBOARD_STATUS_CHIP: Record<"Here" | "NotHere", { label: string; style: string }> = {
  Here:    { label: "Here",     style: "bg-green-100 text-green-700" },
  NotHere: { label: "Not Here", style: "bg-slate-100 text-slate-500" },
};

function dotColor(val: string): string {
  if (val === "—" || val === "Not Expected" || val === "Not Called" || val === "Not Arrived" || val === "Not In") return "bg-slate-200";
  if (val === "Absent") return "bg-slate-300";
  if (val === "Expected" || val === "Expected (from BC)") return "bg-blue-200";
  return "bg-green-400";
}

function CamperDashboardRow({ row, onClick }: { row: CamperRow; onClick: () => void }) {
  const { camper } = row;
  const chip     = DASHBOARD_STATUS_CHIP[row.campusStatus];
  const bg       = avatarBg(camper.name);
  const initial  = (camper.preferredName ?? camper.name).charAt(0).toUpperCase();
  const displayName = camper.preferredName
    ? `${camper.preferredName}${camper.lastName ? " " + camper.lastName : ""}`
    : camper.name;

  const dots: { label: string; value: string; show: boolean }[] = [
    { label: "BC",   value: row.beforeCare, show: row.beforeCare !== "Not Expected" },
    { label: "Bunk", value: row.bunk,        show: true },
    { label: "AC",   value: row.afterCare,   show: row.afterCare !== "Not Expected" },
    { label: "Bus",  value: row.busRoom,     show: row.busRoom !== "Not Expected" },
    { label: "Out",  value: row.dismissal,   show: true },
  ].filter(d => d.show);

  return (
    <button onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 rounded-2xl px-3 py-3 flex gap-3 items-start active:opacity-75 transition-opacity">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: bg }}>
        {camper.photoUrl
          ? <img src={camper.photoUrl} className="w-full h-full object-cover" alt="" />
          : <span className="text-white font-black text-sm leading-none">{initial}</span>}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-800 text-sm truncate">{displayName}</span>
          {camper.hasAllergies && <AlertTriangle size={11} className="text-red-500 flex-shrink-0" />}
          {camper.hasNotes     && <StickyNote    size={11} className="text-blue-400 flex-shrink-0" />}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {camper.bunk}{camper.arrivalMethod ? ` · ${camper.arrivalMethod}` : ""}
        </p>
        <div className="flex gap-2.5 mt-1.5 flex-wrap">
          {dots.map((d, i) => (
            <div key={d.label || i} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor(d.value)}`} />
              <span className="text-[10px] text-slate-500 font-medium leading-none">{d.label}: {d.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Status chip */}
      <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 mt-0.5 ${chip.style}`}>
        {chip.label}
      </span>
    </button>
  );
}

// Hierarchy grouping options for the Dashboard
type DashGroupBy = "camp" | "division" | "bunk" | "grade";
const DASH_GROUP_OPTIONS: { id: DashGroupBy; label: string }[] = [
  { id: "camp",     label: "Camp → Group" },
  { id: "division", label: "Camp → Division" },
  { id: "bunk",     label: "Group" },
  { id: "grade",    label: "Grade" },
];

const DIVISION_CAMPS = new Set(["Kaleidoscope"]);

function groupKeysFor(c: CamperDoc, groupBy: DashGroupBy, structureMap?: Map<string, { camp: string; division: string }>): [string, string] {
  const camp  = c.camp?.trim() || "Unassigned Camp";
  const bunk  = c.bunk?.trim() || "No Group";
  const grade = c.grade?.trim() || "No Grade";
  const struct = structureMap?.get(bunk);
  const resolvedCamp = struct?.camp ?? camp;
  const division = struct?.division ?? c.campDivision?.trim() ?? "Unassigned";
  switch (groupBy) {
    case "camp":
      if (DIVISION_CAMPS.has(resolvedCamp)) return [resolvedCamp, `${division}::${bunk}`];
      return [resolvedCamp, bunk];
    case "division": return [resolvedCamp, division];
    case "bunk":     return [bunk, ""];
    case "grade":    return [grade, bunk];
  }
}

function countsFor(rows: CamperRow[]) {
  const here    = rows.filter(r => r.campusStatus === "Here").length;
  const notHere = rows.length - here;
  return { total: rows.length, here, notHere };
}

function CamperDashboard({ staff }: { staff: StaffDoc }) {
  const campers = useQuery(api.campers.list);
  const campStructure = useQuery(api.campStructure.list);

  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState<"all" | "Here" | "NotHere">("all");
  const [groupBy,        setGroupBy]        = useState<DashGroupBy>("camp");
  const [expandedTop,    setExpandedTop]    = useState<Set<string>>(new Set());
  const [expandedSub,    setExpandedSub]    = useState<Set<string>>(new Set());
  const [selectedCamper, setSelectedCamper] = useState<CamperDoc | null>(null);

  if (campers === undefined) return <Loading />;

  const internalCampers = campers.filter(c => !c.isExternal);
  const rows = internalCampers.map(c => getCamperRow(c));

  const hereCount       = rows.filter(r => r.campusStatus === "Here").length;
  const notHereCount    = rows.filter(r => r.campusStatus === "NotHere").length;
  const absentCount     = internalCampers.filter(c => c.arrivalStatus === "Absent").length;
  const notArrivedCount = internalCampers.filter(c => !c.arrivalStatus || c.arrivalStatus === "NotArrived").length;
  const dismissedCount  = rows.filter(r => r.dismissal === "Dismissed" || r.dismissal === "Left for Day").length;

  const q = search.toLowerCase().trim();
  const filtered = rows.filter(r => {
    if (statusFilter !== "all" && r.campusStatus !== statusFilter) return false;
    if (q) {
      const name = `${r.camper.preferredName ?? r.camper.name} ${r.camper.lastName ?? ""}`.toLowerCase();
      if (!name.includes(q) && !String(r.camper.code).includes(q)) return false;
    }
    return true;
  });

  // When actively searching/filtering, auto-expand everything so matches are visible.
  const autoExpand = q.length > 0 || statusFilter !== "all";

  // Build structure lookup: bunk → { camp, division }
  const structureMap = new Map<string, { camp: string; division: string }>();
  for (const s of campStructure ?? []) {
    if (s.isActive !== false) structureMap.set(s.bunk, { camp: s.camp, division: s.division });
  }

  // Build hierarchy: top → sub → rows
  const hasSubLevel = groupBy !== "bunk";
  const hierarchy = new Map<string, Map<string, CamperRow[]>>();

  // Seed from camp structure first so all bunks/divisions appear even if empty
  if (campStructure && campStructure.length > 0 && !q && statusFilter === "all") {
    for (const s of campStructure) {
      if (s.isActive === false) continue;
      if (s.camp === "Unassigned" || s.division === "Unassigned") continue;
      let top: string, sub: string;
      switch (groupBy) {
        case "camp":
          top = s.camp;
          sub = DIVISION_CAMPS.has(s.camp) ? `${s.division}::${s.bunk}` : s.bunk;
          break;
        case "division": top = s.camp; sub = s.division; break;
        case "bunk":     top = s.bunk; sub = ""; break;
        case "grade":    continue;
      }
      if (!hierarchy.has(top)) hierarchy.set(top, new Map());
      const subKey = hasSubLevel ? sub : "";
      if (!hierarchy.get(top)!.has(subKey)) hierarchy.get(top)!.set(subKey, []);
    }
  }

  // Add campers into the hierarchy
  for (const r of filtered) {
    const [top, sub] = groupKeysFor(r.camper, groupBy, structureMap);
    if (!hierarchy.has(top)) hierarchy.set(top, new Map());
    const subMap = hierarchy.get(top)!;
    const subKey = hasSubLevel ? sub : "";
    if (!subMap.has(subKey)) subMap.set(subKey, []);
    subMap.get(subKey)!.push(r);
  }

  // Sort: structure-defined camps first (by sort order), then alphabetical
  const structureCampOrder = new Map<string, number>();
  for (const s of campStructure ?? []) {
    if (s.isActive === false) continue;
    const existing = structureCampOrder.get(s.camp);
    if (existing === undefined || (s.sortOrder ?? 999) < existing) {
      structureCampOrder.set(s.camp, s.sortOrder ?? 999);
    }
  }
  const topKeys = [...hierarchy.keys()].sort((a, b) => {
    const oa = structureCampOrder.get(a) ?? 9999;
    const ob = structureCampOrder.get(b) ?? 9999;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });

  const toggleStatus = (s: "Here" | "NotHere") =>
    setStatusFilter(prev => prev === s ? "all" : s);
  const toggleTop = (k: string) =>
    setExpandedTop(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleSub = (k: string) =>
    setExpandedSub(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const expandAll = () => {
    const tops = new Set<string>();
    const subs = new Set<string>();
    for (const [top, subMap] of hierarchy) {
      tops.add(top);
      for (const sub of subMap.keys()) {
        subs.add(`${top}//${sub}`);
        if (DIVISION_CAMPS.has(top) && groupBy === "camp" && sub.includes("::")) {
          const div = sub.split("::")[0];
          subs.add(`${top}//${div}`);
          subs.add(`${top}//${div}//${sub.split("::")[1]}`);
        }
      }
    }
    setExpandedTop(tops); setExpandedSub(subs);
  };
  const collapseAll = () => { setExpandedTop(new Set()); setExpandedSub(new Set()); };

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-4">
        <div className="flex gap-2">
          {(["Here", "NotHere"] as const).map(s => {
            const counts = { Here: hereCount, NotHere: notHereCount };
            const styles = {
              Here:    { num: "text-green-700", label: "text-green-600", active: "bg-green-50" },
              NotHere: { num: "text-slate-600",  label: "text-slate-500", active: "bg-slate-100" },
            };
            const st = styles[s];
            return (
              <button key={s} onClick={() => toggleStatus(s)}
                className={`flex-1 text-center rounded-xl py-2.5 transition-colors ${statusFilter === s ? st.active : ""}`}>
                <p className={`text-2xl font-black ${st.num}`}>{counts[s]}</p>
                <p className={`text-xs font-semibold mt-0.5 ${st.label}`}>
                  {s === "Here" ? "Here" : "Not Here"}
                </p>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 text-center mt-2 pt-2 border-t border-slate-100">
          {internalCampers.length} enrolled
          {notArrivedCount > 0  ? ` · ${notArrivedCount} not arrived` : ""}
          {absentCount > 0      ? ` · ${absentCount} absent` : ""}
          {dismissedCount > 0   ? ` · ${dismissedCount} dismissed` : ""}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or code…"
          className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#5B8C9D]" />
      </div>

      {/* Group-by control + expand/collapse */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Group by</span>
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-0.5">
          {DASH_GROUP_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => setGroupBy(opt.id)}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                groupBy === opt.id ? "text-white" : "text-slate-500"
              }`}
              style={groupBy === opt.id ? { backgroundColor: "#023B64" } : undefined}>
              {opt.label}
            </button>
          ))}
        </div>
        {!autoExpand && (
          <div className="ml-auto flex gap-2">
            <button onClick={expandAll} className="text-xs text-slate-500 font-medium underline">Expand all</button>
            <button onClick={collapseAll} className="text-xs text-slate-500 font-medium underline">Collapse all</button>
          </div>
        )}
      </div>

      {statusFilter !== "all" && (
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${DASHBOARD_STATUS_CHIP[statusFilter].style}`}>
            {DASHBOARD_STATUS_CHIP[statusFilter].label}
          </span>
          <button onClick={() => setStatusFilter("all")} className="text-xs text-slate-400 underline ml-auto">
            Show all
          </button>
        </div>
      )}

      <p className="text-xs text-slate-400">{filtered.length} of {campers.length} campers</p>

      {/* Hierarchy accordions */}
      <div className="space-y-2.5">
        {topKeys.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-10 text-center text-slate-400 text-sm">
            No campers match your filters.
          </div>
        )}
        {topKeys.map(top => {
          const subMap = hierarchy.get(top)!;
          const allRows = [...subMap.values()].flat();
          const c = countsFor(allRows);
          const topOpen = autoExpand || expandedTop.has(top);
          const subKeys = [...subMap.keys()].sort((a, b) => a.localeCompare(b));
          return (
            <div key={top} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {/* Top-level folder header */}
              <button onClick={() => toggleTop(top)}
                className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left active:bg-slate-50">
                {topOpen ? <ChevronDown size={18} className="text-slate-400 flex-shrink-0" />
                         : <ChevronRight size={18} className="text-slate-400 flex-shrink-0" />}
                <span className="font-bold text-slate-800 flex-1 min-w-0 truncate">{top}</span>
                <span className="text-xs font-semibold text-green-600">{c.here} here</span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-semibold text-slate-400">{c.total} total</span>
              </button>

              {topOpen && (
                <div className="border-t border-slate-100">
                  {!hasSubLevel
                    ? (
                      // No sub-level: list rows directly
                      <div className="p-2.5 space-y-2 bg-slate-50/50">
                        {allRows.map(row => (
                          <CamperDashboardRow key={row.camper._id} row={row} onClick={() => setSelectedCamper(row.camper)} />
                        ))}
                      </div>
                    )
                    : (() => {
                      const isDivisionCamp = DIVISION_CAMPS.has(top) && groupBy === "camp";
                      if (isDivisionCamp) {
                        const divGroups = new Map<string, { bunk: string; rows: CamperRow[] }[]>();
                        for (const sub of subKeys) {
                          const parts = sub.split("::");
                          const div = parts[0] ?? "Unassigned";
                          const bunk = parts[1] ?? sub;
                          if (!divGroups.has(div)) divGroups.set(div, []);
                          divGroups.get(div)!.push({ bunk, rows: subMap.get(sub)! });
                        }
                        return [...divGroups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([div, bunks]) => {
                          const divRows = bunks.flatMap(b => b.rows);
                          const dc = countsFor(divRows);
                          const divId = `${top}//${div}`;
                          const divOpen = autoExpand || expandedSub.has(divId);
                          return (
                            <div key={divId} className="border-b border-slate-100 last:border-b-0">
                              <button onClick={() => toggleSub(divId)}
                                className="w-full flex items-center gap-2 pl-9 pr-4 py-2.5 text-left active:bg-slate-50">
                                {divOpen ? <ChevronDown size={15} className="text-slate-300 flex-shrink-0" />
                                         : <ChevronRight size={15} className="text-slate-300 flex-shrink-0" />}
                                <span className="text-sm font-bold text-slate-700 flex-1 min-w-0 truncate">{div}</span>
                                <span className="text-[11px] font-semibold text-green-600">{dc.here}</span>
                                <span className="text-[11px] text-slate-300">/</span>
                                <span className="text-[11px] font-semibold text-slate-400">{dc.total}</span>
                              </button>
                              {divOpen && bunks.sort((a, b) => a.bunk.localeCompare(b.bunk)).map(({ bunk, rows: bunkRows }) => {
                                const bc = countsFor(bunkRows);
                                const bunkId = `${top}//${div}//${bunk}`;
                                const bunkOpen = autoExpand || expandedSub.has(bunkId);
                                return (
                                  <div key={bunkId} className="border-t border-slate-50">
                                    <button onClick={() => toggleSub(bunkId)}
                                      className="w-full flex items-center gap-2 pl-14 pr-4 py-2 text-left active:bg-slate-50">
                                      {bunkOpen ? <ChevronDown size={13} className="text-slate-200 flex-shrink-0" />
                                               : <ChevronRight size={13} className="text-slate-200 flex-shrink-0" />}
                                      <span className="text-xs font-semibold text-slate-500 flex-1 min-w-0 truncate">{bunk}</span>
                                      <span className="text-[10px] font-semibold text-green-600">{bc.here}</span>
                                      <span className="text-[10px] text-slate-300">/</span>
                                      <span className="text-[10px] font-semibold text-slate-400">{bc.total}</span>
                                    </button>
                                    {bunkOpen && (
                                      <div className="px-2.5 pb-2 space-y-2 bg-slate-50/50">
                                        {bunkRows.map(row => (
                                          <CamperDashboardRow key={row.camper._id} row={row} onClick={() => setSelectedCamper(row.camper)} />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        });
                      }
                      return subKeys.map(sub => {
                        const subRows = subMap.get(sub)!;
                        const sc = countsFor(subRows);
                        const subId = `${top}//${sub}`;
                        const subOpen = autoExpand || expandedSub.has(subId);
                        return (
                          <div key={subId} className="border-b border-slate-100 last:border-b-0">
                            <button onClick={() => toggleSub(subId)}
                              className="w-full flex items-center gap-2 pl-9 pr-4 py-2.5 text-left active:bg-slate-50">
                              {subOpen ? <ChevronDown size={15} className="text-slate-300 flex-shrink-0" />
                                       : <ChevronRight size={15} className="text-slate-300 flex-shrink-0" />}
                              <span className="text-sm font-semibold text-slate-600 flex-1 min-w-0 truncate">{sub}</span>
                              <span className="text-[11px] font-semibold text-green-600">{sc.here}</span>
                              <span className="text-[11px] text-slate-300">/</span>
                              <span className="text-[11px] font-semibold text-slate-400">{sc.total}</span>
                            </button>
                            {subOpen && (
                              <div className="px-2.5 pb-2.5 space-y-2 bg-slate-50/50">
                                {subRows.map(row => (
                                  <CamperDashboardRow key={row.camper._id} row={row} onClick={() => setSelectedCamper(row.camper)} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedCamper && (
        <CamperDetailSheet
          camper={selectedCamper}
          onClose={() => setSelectedCamper(null)}
          staffName={staff.name}
          isAdmin
        />
      )}
    </div>
  );
}

function AdminBunkView({ staff }: { staff: StaffDoc }) {
  const allBunks = useQuery(api.campers.getBunks, {});
  const [bunk, setBunk] = useState<string>("");

  // Once bunk list loads, default to the first bunk.
  const bunks = allBunks ?? [];
  const selectedBunk = bunk || bunks[0] || "";

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold" style={{ color: "#023B64" }}>Bunk Roster</h2>
      {bunks.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {bunks.map((b, i) => (
            <button key={b || i} onClick={() => setBunk(b)}
              className="px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0"
              style={selectedBunk === b
                ? { backgroundColor: "#023B64", color: "#fff" }
                : { color: "#64748b", backgroundColor: "#fff", border: "1px solid #e2e8f0" }}>
              {b}
            </button>
          ))}
        </div>
      )}
      {selectedBunk ? (
        <CounselorBunkView staff={staff} bunk={selectedBunk} />
      ) : (
        <Loading />
      )}
    </div>
  );
}

// ─── Camper Detail Sheet ──────────────────────────────────────────────────────

function CamperDetailSheet({ camper, onClose, hideCode = false, staffName, isAdmin = false }: { camper: CamperDoc; onClose: () => void; hideCode?: boolean; staffName?: string; isAdmin?: boolean }) {
  const logs = useQuery(api.attendanceLogs.getByCamper, {
    camperId: camper._id,
    date: today(),
  });
  const todayOverride = useQuery(api.dailyOverrides.getForCamper, { camperId: camper._id, date: today() });
  const effectiveArrival = todayOverride?.morningArrival ?? camper.arrivalMethod ?? "—";
  const effectiveDismissal = todayOverride?.afternoonDismissal ?? camper.dismissalMethod ?? "—";

  const resetMorning  = useMutation(api.campers.resetMorningStatus);
  const undoMarkOut   = useMutation(api.campers.undoLeftEarly);
  const saveNote      = useMutation(api.campers.setAttendanceNote);
  const checkIn       = useMutation(api.campers.confirmWithBunk);
  const doMarkAbsent  = useMutation(api.campers.markAbsent);
  const doMarkOut     = useMutation(api.campers.markLeftEarly);
  const adminEditMut  = useMutation(api.campers.adminEdit);
  const [noteDraft, setNoteDraft] = useState(camper.attendanceNote ?? "");
  const [editing, setEditing] = useState(false);
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
      label: isAbsent ? "Absent today" : (camper.bunkConfirmed ? "In Bunk" : "Not Yet at Bunk"),
      done:  !!(camper.bunkConfirmed || isAbsent),
      badge: isAbsent ? { label: "Absent", style: "text-amber-600 bg-amber-100" } : undefined,
    },
    {
      label: camper.dailyCheckpoints?.AfterCare ? "In After Care"
           : camper.dailyCheckpoints?.Bus ? "In Bus Room"
           : "Left for Day",
      done:  isLeftEarly,
      badge: isLeftEarly ? { label: camper.dailyCheckpoints?.AfterCare ? "In After Care" : camper.dailyCheckpoints?.Bus ? "In Bus Room" : "Left for Day", style: "text-violet-600 bg-violet-100" } : undefined,
    },
    { label: "Called for pickup", done: camper.status !== "Waiting", value: camper.status !== "Waiting" ? camper.status : undefined },
    { label: "With Runner",       done: !!(camper.runner),           value: camper.runner ?? undefined },
    { label: "Dismissed",         done: camper.status === "Picked Up" || camper.status === "Dismissed" },
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

        {/* Header row: avatar + name */}
        <div className="flex items-center gap-4 px-4 pb-4 flex-shrink-0">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm"
            style={{ backgroundColor: bg }}>
            {camper.photoUrl ? (
              <img src={camper.photoUrl} alt={displayName}
                className="w-full h-full object-cover object-top" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-4xl font-black leading-none select-none"
                  style={{ color: "rgba(255,255,255,0.88)" }}>
                  {initial}
                </span>
              </div>
            )}
          </div>
          {/* Name + bunk */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-2xl leading-tight text-slate-900 truncate">{displayName}</p>
            <p className="text-slate-400 text-sm mt-0.5">
              {camper.bunk}{camper.unit ? ` · ${camper.unit}` : ""}
            </p>
          </div>
          {/* Close */}
          <button onClick={onClose}
            className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 active:bg-slate-200 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 pt-4 pb-8 space-y-4">

          {/* Allergy / notes alerts */}
          {(camper.hasAllergies || camper.hasNotes) && (
            <div className="space-y-2">
              {camper.hasAllergies && (
                <div className="flex items-start gap-3 bg-red-50 border-2 border-red-400 rounded-2xl px-4 py-4">
                  <AlertTriangle size={24} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-800 text-base">Allergy Alert</p>
                    {camper.allergyDetails ? (
                      <p className="text-red-700 text-sm mt-0.5 font-semibold">{camper.allergyDetails}</p>
                    ) : (
                      <p className="text-red-700 text-sm mt-0.5">Allergies on file. Check with the office before serving food.</p>
                    )}
                  </div>
                </div>
              )}
              {(camper.hasNotes || camper.camperNotes) && (
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3.5">
                  <BookOpen size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-blue-800 text-sm">Camper Notes</p>
                    {camper.camperNotes ? (
                      <p className="text-blue-600 text-xs mt-0.5">{camper.camperNotes}</p>
                    ) : (
                      <p className="text-blue-600 text-xs mt-0.5">See director for details.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info grid */}
          {!editing && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <InfoTile icon={<MapPin size={16} />}    label="Group"        value={camper.bunk} />
                <InfoTile icon={<User size={16} />}      label="Grade"        value={camper.grade ?? "—"} />
                <InfoTile icon={<ArrowRight size={16} />} label="Arrival"     value={effectiveArrival} />
                <InfoTile icon={<Bus size={16} />}        label="Dismissal"   value={effectiveDismissal} />
                {!hideCode && (
                  <InfoTile icon={<Hash size={16} />} label="Pickup Code" value={`#${camper.code}`} mono />
                )}
              </div>
              {isAdmin && staffName && (
                <button onClick={() => setEditing(true)}
                  className="w-full py-2.5 text-sm font-semibold text-[#023B64] bg-slate-50 border border-slate-200 rounded-xl active:bg-slate-100">
                  Edit Camper Info
                </button>
              )}
            </>
          )}

          {/* Admin edit form */}
          {editing && isAdmin && staffName && (
            <AdminCamperEditForm camper={camper} staffName={staffName} onDone={() => setEditing(false)} />
          )}

          {/* Period schedule (view-only) — hidden automatically if camper has none */}
          {!editing && <CamperPeriodSchedule camper={camper} />}

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

        </div>
      </div>
    </div>
  );
}

// ─── Camper Period Schedule (view-only) ───────────────────────────────────────
// Reads ONLY the current period source of truth: periodScheduleRecords (active
// rows) joined to periodClasses for the room/location. Never touches the legacy
// camper.periodGroups / camper.periodAttendance / periodSchedules fields.
// Rendered on the shared camper profile; there is no edit affordance here, so it
// is inherently view-only for counselors and every other role.
function CamperPeriodSchedule({ camper }: { camper: CamperDoc }) {
  const monThu  = useQuery(api.periodScheduleRecords.getActiveForCamper, { camperId: camper._id, dayType: "MonThu" });
  const friday  = useQuery(api.periodScheduleRecords.getActiveForCamper, { camperId: camper._id, dayType: "Friday" });
  const classes = useQuery(api.periodClasses.list);
  // Today's per-period check-ins (current SoT: periodAttendanceRecords).
  const attendance = useQuery(api.periodAttendance.getForCamperDate, { camperId: camper._id });
  const [dayType, setDayType] = useState<"MonThu" | "Friday">(currentDayType());

  // Wait for both day schedules before deciding whether to show the section.
  if (monThu === undefined || friday === undefined) return null;

  const hasMonThu = monThu.length > 0;
  const hasFriday = friday.length > 0;
  if (!hasMonThu && !hasFriday) return null; // no period schedule → hide entirely

  // Only offer the Mon–Thu / Friday toggle when the camper genuinely has both.
  const showToggle = hasMonThu && hasFriday;
  const activeDayType = showToggle ? dayType : (hasFriday ? "Friday" : "MonThu");
  const records = activeDayType === "Friday" ? friday : monThu;

  const locationById = new Map<string, string | undefined>();
  for (const c of classes ?? []) locationById.set(c._id, c.location);

  // Check-ins only make sense for the schedule that matches today's actual day type.
  const showAttendance = activeDayType === currentDayType();
  const attByPeriod = new Map<string, NonNullable<typeof attendance>[number]>();
  for (const a of attendance ?? []) attByPeriod.set(a.period, a);

  const sorted = [...records].sort((a, b) => a.period.localeCompare(b.period));

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <SectionLabel>Period Schedule</SectionLabel>
        {showToggle && (
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {([{ id: "MonThu", label: "Mon–Thu" }, { id: "Friday", label: "Fri" }] as const).map(d => (
              <button
                key={d.id}
                onClick={() => setDayType(d.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  activeDayType === d.id ? "bg-white text-[#023B64] shadow-sm" : "text-slate-500"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {sorted.map(r => {
          const location = locationById.get(r.periodClassId);
          const att = attByPeriod.get(r.period);
          const checkedIn = !!att?.checkedIn;
          return (
            <div key={r._id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
              <div className="w-10 flex-shrink-0 text-center">
                <span className="text-sm font-bold text-[#023B64]">
                  {(PERIOD_LABEL[r.period] ?? r.period).replace("Period ", "P")}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">{r.classNameSnapshot}</p>
                {location && (
                  <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
                    <MapPin size={11} /> {location}
                  </p>
                )}
              </div>
              {showAttendance && (
                checkedIn ? (
                  <div className="flex-shrink-0 flex items-center gap-1 bg-green-100 text-green-700 rounded-full pl-1.5 pr-2.5 py-1">
                    <CheckCircle2 size={13} />
                    <span className="text-[11px] font-semibold whitespace-nowrap">
                      In{att?.checkedInAt ? ` · ${fmt(att.checkedInAt)}` : ""}
                    </span>
                  </div>
                ) : (
                  <div className="flex-shrink-0 flex items-center gap-1 bg-slate-100 text-slate-400 rounded-full px-2.5 py-1">
                    <span className="text-[11px] font-semibold whitespace-nowrap">Not in</span>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400 px-1">
        {activeDayType === "Friday" ? "Friday schedule" : "Monday–Thursday schedule"}
        {showAttendance ? " · check-ins for today" : ""} · view only
      </p>
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

// ─── Admin Camper Edit Form ──────────────────────────────────────────────────

const ARRIVAL_OPTIONS = ["Carline", "Before Care", "Bus 1", "Bus 2", "Bus 3", "Bus 4", "Bus 5", "Bus 6"];
const DISMISSAL_OPTIONS = ["Carline", "After Care", "Bus 1", "Bus 2", "Bus 3", "Bus 4", "Bus 5", "Bus 6"];

function AdminCamperEditForm({ camper, staffName, onDone }: { camper: CamperDoc; staffName: string; onDone: () => void }) {
  const adminEdit = useMutation(api.campers.adminEdit);
  const [form, setForm] = useState({
    preferredName: camper.preferredName ?? camper.name,
    lastName: camper.lastName ?? "",
    bunk: camper.bunk,
    code: camper.code,
    grade: camper.grade ?? "",
    arrivalMethod: camper.arrivalMethod ?? "",
    dismissalMethod: camper.dismissalMethod ?? "",
    photoUrl: camper.photoUrl ?? "",
    allergyNotes: camper.allergyDetails ?? "",
    camperNotes: camper.camperNotes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const safetyFields = ["code", "dismissalMethod", "allergyNotes"];
    const changed = safetyFields.filter(k => (form as Record<string, string>)[k] !== ((camper as Record<string, unknown>)[k === "allergyNotes" ? "allergyDetails" : k] ?? ""));
    if (changed.length > 0) {
      const msg = changed.map(k => k === "code" ? "pickup code" : k === "dismissalMethod" ? "dismissal method" : "allergy notes").join(", ");
      if (!confirm(`You are changing: ${msg}.\n\nThis affects camper safety. Continue?`)) return;
    }
    setSaving(true);
    await adminEdit({
      id: camper._id,
      staffName,
      preferredName: form.preferredName.trim() || undefined,
      lastName: form.lastName.trim() || undefined,
      bunk: form.bunk.trim() || undefined,
      code: form.code.trim() || undefined,
      grade: form.grade.trim() || undefined,
      arrivalMethod: form.arrivalMethod || undefined,
      dismissalMethod: form.dismissalMethod || undefined,
      photoUrl: form.photoUrl.trim() || undefined,
      allergyNotes: form.allergyNotes,
      camperNotes: form.camperNotes,
    });
    setSaving(false);
    onDone();
  };

  const field = (label: string, key: keyof typeof form, opts?: { mono?: boolean }) => (
    <div>
      <label className="text-xs font-semibold text-slate-500 mb-1 block">{label}</label>
      <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
        className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none ${opts?.mono ? "font-mono" : ""}`} />
    </div>
  );

  const select = (label: string, key: keyof typeof form, options: string[]) => (
    <div>
      <label className="text-xs font-semibold text-slate-500 mb-1 block">{label}</label>
      <select value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white">
        <option value="">— none —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-3">
      <SectionLabel>Edit Camper Info</SectionLabel>
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {field("Preferred Name", "preferredName")}
          {field("Last Name", "lastName")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("Group", "bunk")}
          {field("Grade", "grade")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("Pickup Code", "code", { mono: true })}
          {field("Photo URL", "photoUrl")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {select("Arrival Method", "arrivalMethod", ARRIVAL_OPTIONS)}
          {select("Dismissal Method", "dismissalMethod", DISMISSAL_OPTIONS)}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Allergy Notes</label>
          <textarea value={form.allergyNotes} onChange={e => setForm({ ...form, allergyNotes: e.target.value })}
            rows={2} placeholder="Leave blank if no allergies"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Camper Notes</label>
          <textarea value={form.camperNotes} onChange={e => setForm({ ...form, camperNotes: e.target.value })}
            rows={2} placeholder="Leave blank if no notes"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={onDone}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-500 bg-slate-100 rounded-xl active:bg-slate-200">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl active:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: "#023B64" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Counselor View ───────────────────────────────────────────────────────────

function CounselorView({ staff }: { staff: StaffDoc }) {
  const bunk = staff.bunkAssignment ?? "";
  // Records-based period classes (Upper Camp) and tracks (Middle Camp) this
  // counselor leads — each drives an extra tab when present.
  const myClasses = useQuery(api.periodClasses.getForStaff, { staffId: staff._id });
  const myTracks = useQuery(api.tracks.getForStaff, { staffId: staff._id });
  const hasClasses = (myClasses ?? []).length > 0;
  const hasTracks = (myTracks ?? []).length > 0;
  const [view, setView] = useState<"bunk" | "periods" | "tracks">("bunk");

  const tabs: { id: "bunk" | "periods" | "tracks"; label: string }[] = [{ id: "bunk", label: "My Bunk" }];
  if (hasClasses) tabs.push({ id: "periods", label: "Periods" });
  if (hasTracks) tabs.push({ id: "tracks", label: "Tracks" });

  const tabSwitcher = tabs.length > 1 && (
    <div className="flex gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5 mb-4">
      {tabs.map(t => (
        <button key={t.id} onClick={() => setView(t.id)}
          className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
          style={view === t.id ? { backgroundColor: "#023B64", color: "#fff" } : { color: "#64748b" }}>
          {t.label}
        </button>
      ))}
    </div>
  );

  if (view === "periods" && hasClasses) {
    return <div className="space-y-4">{tabSwitcher}<MyClassesPanel staff={staff} /></div>;
  }
  if (view === "tracks" && hasTracks) {
    return <div className="space-y-4">{tabSwitcher}<MyTracksPanel staff={staff} /></div>;
  }

  return (
    <div className="space-y-4">
      {tabSwitcher}
      <CounselorBunkView staff={staff} bunk={bunk} />
    </div>
  );
}

// A counselor's assigned Middle Camp tracks, with daily present/absent marking.
function MyTracksPanel({ staff }: { staff: StaffDoc }) {
  const tracks = useQuery(api.tracks.getForStaff, { staffId: staff._id });
  const [activeId, setActiveId] = useState<string | null>(null);

  if (tracks === undefined) return <Loading />;

  const sorted = [...tracks].sort((a, b) => a.name.localeCompare(b.name));
  const active = sorted.find(t => t._id === activeId) ?? sorted[0] ?? null;

  return (
    <div className="space-y-4">
      {sorted.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
          No tracks assigned. Contact an administrator.
        </div>
      )}
      {sorted.length > 1 && (
        <div className="flex gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5 overflow-x-auto">
          {sorted.map(t => (
            <button key={t._id} onClick={() => setActiveId(t._id)}
              className="flex-shrink-0 py-2 px-3 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
              style={active?._id === t._id ? { backgroundColor: "#023B64", color: "#fff" } : { color: "#64748b" }}>
              {t.name}
            </button>
          ))}
        </div>
      )}
      {active && (
        <>
          <div>
            <h3 className="text-2xl font-bold" style={{ color: "#023B64" }}>{active.name}</h3>
            {active.location && <p className="text-slate-500 text-sm">{active.location}</p>}
          </div>
          <TrackRoster track={active} staffName={staff.name} />
        </>
      )}
    </div>
  );
}

type BunkGroupKey = "none" | "status" | "dismissal" | "track";

const BUNK_GROUP_OPTIONS: { key: BunkGroupKey; label: string }[] = [
  { key: "none",      label: "All" },
  { key: "status",    label: "In / Out" },
  { key: "dismissal", label: "Dismissal" },
  { key: "track",     label: "Track" },
];

const STATUS_GROUP_ORDER = ["In", "Out", "Not Yet In", "Absent"];

type BunkRosterItem = { c: CamperDoc; isAbsent: boolean; arrived: boolean; dismissed: boolean; effectiveDismissal?: string };

function bunkGroupKey(item: BunkRosterItem, groupBy: BunkGroupKey): string {
  const { c, isAbsent, arrived, dismissed } = item;
  switch (groupBy) {
    case "status":
      if (isAbsent) return "Absent";
      if (dismissed) return "Out";
      if (arrived) return "In";
      return "Not Yet In";
    case "dismissal":
      return item.effectiveDismissal ?? c.dismissalMethod ?? "Other";
    case "track":
      return c.track ?? "No Track";
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
  const last = (k: string) => k === "Other" || k === "No Track";
  const order: string[] = groupBy === "status"
    ? STATUS_GROUP_ORDER
    : [...map.keys()].sort((a, b) => last(a) ? 1 : last(b) ? -1 : a.localeCompare(b));
  return order.filter(k => map.has(k)).map(k => [k, map.get(k)!]);
}

function CounselorBunkView({ staff, bunk }: {
  staff: StaffDoc;
  bunk: string;
}) {
  const roster        = useQuery(api.campers.getBunkRoster, bunk ? { bunk } : "skip");
  const todayOverrides = useQuery(api.dailyOverrides.getForDate, {});
  const setArrived    = useMutation(api.campers.confirmWithBunk);
  const setNotArrived = useMutation(api.campers.unconfirmWithBunk);
  const setOut        = useMutation(api.campers.markLeftEarly);
  const setNotOut     = useMutation(api.campers.undoLeftEarly);
  const todayLunchRecords = useQuery(api.lunchRecords.getForDate, { date: today() });
  const markLunchPickedUp = useMutation(api.lunchRecords.markPickedUp);
  const [selected,  setSelected]  = useState<CamperDoc | null>(null);
  const [groupBy, setGroupBy] = useState<BunkGroupKey>("none");

  const isAdmin = [staff.role, ...(staff.extraRoles ?? [])].some(r => r === "admin" || r === "director");

  if (!bunk) return (
    <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
      No bunk assigned. Contact an administrator.
    </div>
  );
  if (roster === undefined) return <Loading />;

  // Build override lookup by camperId
  const overrideMap = new Map<string, NonNullable<typeof todayOverrides>[number]>();
  for (const o of todayOverrides ?? []) overrideMap.set(o.camperId, o);

  const sorted = [...roster].sort((a, b) => camperName(a).localeCompare(camperName(b)));

  const items: BunkRosterItem[] = sorted.map(c => {
    const ov = overrideMap.get(c._id);
    const isAbsent  = ov?.isAbsent === true || c.arrivalStatus === "Absent";
    const arrived   = !!c.bunkConfirmed;
    const dismissed = !!c.leftEarly;
    const effectiveDismissal = ov?.afternoonDismissal ?? c.dismissalMethod;
    return { c, isAbsent, arrived, dismissed, effectiveDismissal };
  });

  const isAbsentToday = (c: CamperDoc) => {
    const ov = overrideMap.get(c._id);
    return ov?.isAbsent === true || c.arrivalStatus === "Absent";
  };

  const absentCount  = sorted.filter(c => isAbsentToday(c)).length;
  const inCount      = sorted.filter(c => !isAbsentToday(c) && c.bunkConfirmed === true && c.leftEarly !== true).length;
  const outCount     = sorted.filter(c => !isAbsentToday(c) && c.leftEarly === true).length;
  const notInCount   = sorted.filter(c => !isAbsentToday(c) && c.bunkConfirmed !== true && c.leftEarly !== true).length;
  const called       = roster.filter(c => c.status === "Called" || c.status === "Assigned");

  const toggleAM = (c: CamperDoc) => {
    if (isAbsentToday(c)) return;
    if (c.bunkConfirmed) setNotArrived({ id: c._id });
    else                 setArrived({ id: c._id, staffName: staff.name });
  };
  const toggleOut = (c: CamperDoc) => {
    if (isAbsentToday(c)) return;
    if (c.leftEarly) setNotOut({ id: c._id });
    else             setOut({ id: c._id, staffName: staff.name });
  };

  const groups = groupBunkRoster(items, groupBy);

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold" style={{ color: "#023B64" }}>{bunk}</h2>

        {/* Summary strip */}
        <div className="flex gap-2">
          <Pill value={inCount}      label="In"     color="green" />
          <Pill value={notInCount}   label="Not In" color="slate" />
          <Pill value={outCount}     label="Out"    color="blue" />
          {absentCount > 0 && <Pill value={absentCount} label="Absent" color="amber" />}
        </div>
        <p className="text-xs text-slate-500 text-center -mt-1">
          {sorted.length} enrolled
        </p>

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
          {BUNK_GROUP_OPTIONS.filter(opt => opt.key !== "track" || (roster ?? []).some(c => c.track)).map(opt => (
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
        {groups.map(([label, groupItems], gi) => (
          <div key={label || `group-${gi}`}>
            {label && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{label}</span>
                <span className="text-xs text-slate-400">{groupItems.length}</span>
              </div>
            )}
            <div className="space-y-2">
              {groupItems.map(({ c, isAbsent, arrived, dismissed }) => (
                <BunkCamperRow key={c._id} camper={c} isAbsent={isAbsent} arrived={arrived} dismissed={dismissed}
                  override={overrideMap.get(c._id)}
                  lunchRecord={(todayLunchRecords ?? []).find(r => r.camperId === c._id)}
                  canMarkLunch={isAdmin}
                  onOpenProfile={() => setSelected(c)}
                  onToggleAM={() => toggleAM(c)}
                  onToggleOut={() => toggleOut(c)}
                  onToggleLunch={(rec) => markLunchPickedUp({ id: rec._id as never, pickedUp: !rec.pickedUp, staffId: staff.name })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} hideCode staffName={staff.name} isAdmin={isAdmin} />}
    </>
  );
}

// One roster row: identity + transport/flags inline, plus In / Out tap targets.
type BunkLunchRecord = { _id: string; lunchType: "regular" | "alternate"; pickedUp?: boolean };

function BunkCamperRow({ camper, isAbsent, arrived, dismissed, override, lunchRecord, canMarkLunch = false, onOpenProfile, onToggleAM, onToggleOut, onToggleLunch }: {
  camper: CamperDoc;
  isAbsent: boolean;
  arrived: boolean;
  dismissed: boolean;
  override?: { isAbsent?: boolean; lateDropoffTime?: string; earlyPickupTime?: string; morningArrival?: string; afternoonDismissal?: string; note?: string };
  lunchRecord?: BunkLunchRecord;
  canMarkLunch?: boolean;   // only admins/office may mark lunch picked up; counselors see it read-only
  onOpenProfile: () => void;
  onToggleAM: () => void;
  onToggleOut: () => void;
  onToggleLunch?: (rec: BunkLunchRecord) => void;
}) {
  const name = camperName(camper);
  const bg = avatarBg(camper.name);
  const isCalled  = camper.status === "Called" || camper.status === "Assigned";

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
      isAbsent ? "border-slate-200 opacity-60"
      : isCalled ? "border-amber-300"
      : "border-slate-200"
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
            <span className="font-semibold text-slate-900 text-xl leading-tight">{name}</span>
            {camper.hasAllergies && (
              <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full tracking-wide">ALLERGY</span>
            )}
            {camper.dismissalMethod && (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full tracking-wide">
                {camper.dismissalMethod}
              </span>
            )}
            {camper.track && (
              <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded-full tracking-wide flex items-center gap-0.5">
                <Route size={9} />{camper.track}
              </span>
            )}
            {override?.isAbsent && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">Absent</span>
            )}
            {override?.lateDropoffTime && (
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">Late: {fmtClock(override.lateDropoffTime)}</span>
            )}
            {override?.earlyPickupTime && (
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">Early: {fmtClock(override.earlyPickupTime)}</span>
            )}
            {override?.afternoonDismissal && (
              <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-full">Dismissal: {camper.dismissalMethod ?? "?"} → {override.afternoonDismissal}</span>
            )}
            {override?.morningArrival && (
              <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">Arrival: {camper.arrivalMethod ?? "?"} → {override.morningArrival}</span>
            )}
            {override?.note && (
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><StickyNote size={9} />{override.note}</span>
            )}
            {isCalled && <StatusBadge status={camper.status} />}
            {lunchRecord && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tracking-wide ${lunchRecord.lunchType === "alternate" ? "text-purple-700 bg-purple-100" : "text-orange-700 bg-orange-100"}`}>
                {lunchRecord.lunchType === "alternate" ? "ALT LUNCH" : "ORDERS LUNCH"}
              </span>
            )}
          </div>
        </div>
        <ArrowRight size={16} className="text-slate-300 flex-shrink-0" />
      </button>

      {/* Lunch: admins/office mark picked up; counselors see it read-only. */}
      {lunchRecord && (() => {
        const cls = `w-full border-t border-slate-100 px-4 py-2.5 flex items-center gap-2 ${
          isAbsent ? "bg-slate-50 text-slate-300"
          : lunchRecord.pickedUp ? "bg-green-50"
          : "bg-amber-50"
        }`;
        const icon = <UtensilsCrossed size={14} className={isAbsent ? "text-slate-300" : lunchRecord.pickedUp ? "text-green-600" : "text-amber-600"} />;
        const label = <span className={`text-xs font-semibold ${isAbsent ? "" : lunchRecord.pickedUp ? "text-green-700" : "text-amber-700"}`}>{lunchRecord.lunchType === "alternate" ? "Alt lunch" : "Lunch"}</span>;
        const statusCls = `ml-auto flex items-center gap-1.5 text-xs font-bold ${isAbsent ? "" : lunchRecord.pickedUp ? "text-green-700" : "text-amber-700"}`;
        if (canMarkLunch) {
          return (
            <button onClick={() => onToggleLunch?.(lunchRecord)} disabled={isAbsent}
              className={`${cls} transition-colors ${isAbsent ? "cursor-not-allowed" : lunchRecord.pickedUp ? "active:bg-green-100" : "active:bg-amber-100"}`}>
              {icon}{label}
              <span className={statusCls}>{lunchRecord.pickedUp ? <><Check size={14} strokeWidth={3} /> Picked up</> : "Tap when picked up"}</span>
            </button>
          );
        }
        // Read-only for counselors — order/status visible, not editable.
        return (
          <div className={cls}>
            {icon}{label}
            <span className={statusCls}>{lunchRecord.pickedUp ? <><Check size={14} strokeWidth={3} /> Picked up</> : "Not picked up"}</span>
          </div>
        );
      })()}

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
        <button onClick={onToggleOut} disabled={isAbsent || !arrived}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${
            isAbsent || !arrived ? "bg-slate-50 text-slate-300 cursor-not-allowed"
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
            <h3 className="text-lg font-bold text-slate-900">Today&apos;s Changes</h3>
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

function FlagEditor({ camper, staffName, onClose }: { camper: CamperDoc; staffName: string; onClose?: () => void }) {
  const upsertOverride = useMutation(api.dailyOverrides.upsert);
  const [date, setDate] = useState(today());
  const override = useQuery(api.dailyOverrides.getForCamper, { camperId: camper._id, date });

  const isAbsent = override?.isAbsent === true;
  const [note, setNote] = useState(override?.note ?? "");
  const [late, setLate] = useState(override?.lateDropoffTime ?? "");
  const [early, setEarly] = useState(override?.earlyPickupTime ?? "");

  useEffect(() => {
    setNote(override?.note ?? "");
    setLate(override?.lateDropoffTime ?? "");
    setEarly(override?.earlyPickupTime ?? "");
  }, [override?.note, override?.lateDropoffTime, override?.earlyPickupTime]);

  const save = (fields: Record<string, unknown>) =>
    upsertOverride({ camperId: camper._id, staffName, date, ...fields } as Parameters<typeof upsertOverride>[0]);

  return (
    <div className="border border-slate-200 rounded-2xl p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-900 truncate">{camperName(camper)}</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">{date === today() ? "Today" : date}</span>
        <button onClick={() => save({ isAbsent: !isAbsent })}
          className={`text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 ${isAbsent ? "bg-red-500 text-white" : "bg-slate-100 text-slate-500 active:bg-slate-200"}`}>
          {isAbsent ? "Absent" : "Mark Absent"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-slate-500 block">
          Late arrival
          <input type="time" value={late}
            onChange={e => { setLate(e.target.value); save({ lateDropoffTime: e.target.value || undefined }); }}
            className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
        </label>
        <label className="text-xs font-medium text-slate-500 block">
          Early pickup
          <input type="time" value={early}
            onChange={e => { setEarly(e.target.value); save({ earlyPickupTime: e.target.value || undefined }); }}
            className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-slate-500 block">
          Arrival override
          <select value={override?.morningArrival ?? ""}
            onChange={e => {
              const val = e.target.value || undefined;
              if (val && date === today() && (camper.arrivalStatus === "Arrived" || camper.bunkConfirmed)) {
                if (!confirm("This camper already arrived today. Change arrival method anyway?")) return;
              }
              save({ morningArrival: val });
            }}
            className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none bg-white">
            <option value="">No change</option>
            {ARRIVAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {camper.arrivalMethod && <p className="text-[10px] text-slate-400 mt-0.5">Normal: {camper.arrivalMethod}</p>}
        </label>
        <label className="text-xs font-medium text-slate-500 block">
          Dismissal override
          <select value={override?.afternoonDismissal ?? ""}
            onChange={e => {
              const val = e.target.value || undefined;
              if (val && date === today() && camper.status !== "Waiting") {
                if (!confirm("This camper has dismissal activity today. Change dismissal method anyway?")) return;
              }
              save({ afternoonDismissal: val });
            }}
            className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none bg-white">
            <option value="">No change</option>
            {DISMISSAL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {camper.dismissalMethod && <p className="text-[10px] text-slate-400 mt-0.5">Normal: {camper.dismissalMethod}</p>}
        </label>
      </div>
      <input value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={() => save({ note: note.trim() || undefined })}
        placeholder="Daily note (optional)"
        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none" />
      {onClose && (
        <button onClick={onClose}
          className="w-full py-2 text-xs font-semibold text-slate-500 bg-slate-50 rounded-lg active:bg-slate-100 mt-1">
          Done
        </button>
      )}
    </div>
  );
}

// ─── Generic Checkpoint Roster (Before/After Care, Bus sheets) ───────────────

type CheckpointKey = "BeforeCare" | "AfterCare" | "Bus";

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

// ─── Generic In/Out Roster (Before/After Care, Bus sheets) ───────────────────

type DailyOverride = { camperId: string; isAbsent?: boolean; lateDropoffTime?: string; earlyPickupTime?: string; morningArrival?: string; afternoonDismissal?: string; note?: string };

function InOutRosterView({
  campers, checkpoint, staffName, groupLabel, emptyMessage, inLabel, outLabel, overrides, hideSummary, showCode,
}: {
  campers: CamperDoc[];
  checkpoint: "BeforeCare" | "AfterCare" | "Bus";
  staffName: string;
  groupLabel?: string;
  emptyMessage?: string;
  inLabel: string;   // e.g. "Arrived" / "Boarded"
  outLabel: string;  // e.g. "Left for Bunk" / "Dropped Off"
  overrides?: DailyOverride[];
  hideSummary?: boolean;  // when the parent already renders the summary on top
  showCode?: boolean;     // reveal the pickup safety code in the profile (After Care)
}) {
  const setCheckpoint = useMutation(api.campers.setCheckpoint);
  const [selected, setSelected] = useState<CamperDoc | null>(null);

  const overrideMap = new Map<string, DailyOverride>();
  for (const o of overrides ?? []) overrideMap.set(o.camperId, o);
  const isAbsentToday = (c: CamperDoc) =>
    overrideMap.get(c._id)?.isAbsent === true || c.arrivalStatus === "Absent";

  if (campers.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
        {emptyMessage ?? "No campers in this group."}
      </div>
    );
  }

  const sorted = [...campers].sort((a, b) => camperName(a).localeCompare(camperName(b)));

  // Counters mirror the bunk view: In / Not In / Out / Absent.
  const absentCount = sorted.filter(c => isAbsentToday(c)).length;
  const inCount     = sorted.filter(c => !isAbsentToday(c) && c.dailyCheckpoints?.[checkpoint] && !c.dailyCheckpointsOut?.[checkpoint]).length;
  const outCount    = sorted.filter(c => !isAbsentToday(c) && c.dailyCheckpoints?.[checkpoint] && c.dailyCheckpointsOut?.[checkpoint]).length;
  const notInCount  = sorted.filter(c => !isAbsentToday(c) && !c.dailyCheckpoints?.[checkpoint]).length;

  const toggleIn = (c: CamperDoc) => {
    if (isAbsentToday(c)) return;
    setCheckpoint({ id: c._id, checkpoint, value: !c.dailyCheckpoints?.[checkpoint], staffName, label: groupLabel, phase: "in" });
  };
  const toggleOut = (c: CamperDoc) => {
    if (isAbsentToday(c)) return;
    setCheckpoint({ id: c._id, checkpoint, value: !c.dailyCheckpointsOut?.[checkpoint], staffName, label: groupLabel, phase: "out" });
  };

  return (
    <>
      <div className="space-y-4">
        {/* Summary strip — matches bunk attendance */}
        {!hideSummary && (
          <>
            <div className="flex gap-2">
              <Pill value={inCount}    label="In"     color="green" />
              <Pill value={notInCount} label="Not In" color="slate" />
              <Pill value={outCount}   label="Out"    color="blue" />
              {absentCount > 0 && <Pill value={absentCount} label="Absent" color="amber" />}
            </div>
            <p className="text-xs text-slate-500 text-center -mt-1">
              {sorted.length} enrolled
            </p>
          </>
        )}

        <div className="space-y-2">
          {sorted.map(c => (
            <InOutCamperRow key={c._id} camper={c} checkpoint={checkpoint}
              isAbsent={isAbsentToday(c)}
              override={overrideMap.get(c._id)}
              onOpenProfile={() => setSelected(c)}
              onToggleIn={() => toggleIn(c)}
              onToggleOut={() => toggleOut(c)}
            />
          ))}
        </div>
      </div>

      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} hideCode={!showCode} />}
    </>
  );
}

// Care/Bus roster row — same layout & badges as BunkCamperRow.
function InOutCamperRow({
  camper, checkpoint, isAbsent, override, onOpenProfile, onToggleIn, onToggleOut,
}: {
  camper: CamperDoc;
  checkpoint: "BeforeCare" | "AfterCare" | "Bus";
  isAbsent: boolean;
  override?: DailyOverride;
  onOpenProfile: () => void;
  onToggleIn: () => void;
  onToggleOut: () => void;
}) {
  const name = camperName(camper);
  const bg = avatarBg(camper.name);
  const arrived = !!camper.dailyCheckpoints?.[checkpoint];
  const dismissed = !!camper.dailyCheckpointsOut?.[checkpoint];

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isAbsent ? "border-slate-200 opacity-60" : "border-slate-200"}`}>
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
            <span className="font-semibold text-slate-900 text-xl leading-tight">{name}</span>
            {camper.hasAllergies && (
              <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full tracking-wide">ALLERGY</span>
            )}
            {camper.dismissalMethod && (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full tracking-wide">
                {camper.dismissalMethod}
              </span>
            )}
            {camper.track && (
              <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded-full tracking-wide flex items-center gap-0.5">
                <Route size={9} />{camper.track}
              </span>
            )}
            {override?.isAbsent && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">Absent</span>
            )}
            {override?.lateDropoffTime && (
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">Late: {fmtClock(override.lateDropoffTime)}</span>
            )}
            {override?.earlyPickupTime && (
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">Early: {fmtClock(override.earlyPickupTime)}</span>
            )}
            {override?.afternoonDismissal && (
              <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-full">Dismissal: {camper.dismissalMethod ?? "?"} → {override.afternoonDismissal}</span>
            )}
            {override?.morningArrival && (
              <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">Arrival: {camper.arrivalMethod ?? "?"} → {override.morningArrival}</span>
            )}
            {override?.note && (
              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><StickyNote size={9} />{override.note}</span>
            )}
          </div>
        </div>
        <ArrowRight size={16} className="text-slate-300 flex-shrink-0" />
      </button>

      {/* Two tap targets: In | Out — same style as bunk */}
      <div className="border-t border-slate-100 flex">
        <button onClick={onToggleIn} disabled={isAbsent}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-1.5 border-r border-slate-100 transition-colors ${
            isAbsent ? "bg-slate-50 text-slate-300 cursor-not-allowed"
            : arrived ? "bg-green-500 text-white active:bg-green-600"
            : "bg-white text-slate-500 active:bg-slate-50"
          }`}>
          In
        </button>
        <button onClick={onToggleOut} disabled={isAbsent || !arrived}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${
            isAbsent || !arrived ? "bg-slate-50 text-slate-300 cursor-not-allowed"
            : dismissed ? "bg-green-500 text-white active:bg-green-600"
            : "bg-white text-slate-500 active:bg-slate-50"
          }`}>
          Out
        </button>
      </div>
    </div>
  );
}

// ─── Before / After Care ──────────────────────────────────────────────────────

function CareView({ staff, kind }: { staff: StaffDoc; kind: "BeforeCare" | "AfterCare" }) {
  const normalRoster = useQuery(kind === "BeforeCare" ? api.campers.getBeforeCareRoster : api.campers.getAfterCareRoster, {});
  const allCampers   = useQuery(api.campers.list);
  const overrides    = useQuery(api.dailyOverrides.getForDate, {});
  const [careGroupBy, setCareGroupBy] = useState<"all" | "program">("all");
  const [addingExternal, setAddingExternal] = useState(false);
  const [extForm, setExtForm] = useState(() => ({ firstName: "", lastName: "", program: kind === "BeforeCare" ? "Grossman Before Care" : "Grossman After Care", allergy: "" }));
  const [extError, setExtError] = useState("");
  const [extUploadMode, setExtUploadMode] = useState(false);
  const [extCsvData, setExtCsvData] = useState<{ headers: string[]; rows: CsvRow[] } | null>(null);
  const [extMapping, setExtMapping] = useState<Record<string, string>>({});
  const [extUploadStep, setExtUploadStep] = useState<"map" | "preview" | null>(null);
  const [extUploading, setExtUploading] = useState(false);

  const EXT_AC_FIELDS = [
    { key: "firstName", label: "First Name", required: true },
    { key: "lastName", label: "Last Name", required: true },
    { key: "program", label: "Program", required: false },
    { key: "allergyNotes", label: "Allergy Notes", required: false },
  ] as const;
  const createCamper = useMutation(api.campers.adminCreate);
  if (normalRoster === undefined || allCampers === undefined) return <Loading />;

  const isBefore = kind === "BeforeCare";
  const title = isBefore ? "Before Care" : "After Care";
  const outLabel = isBefore ? "Out to Bunk" : "Picked Up";
  const matchField = isBefore ? "morningArrival" : "afternoonDismissal";
  const matchValue = isBefore ? "Before Care" : "After Care";
  const normalField = isBefore ? "arrivalMethod" : "dismissalMethod";
  // External-program plumbing (mirrored for Before Care and After Care).
  const programField = isBefore ? "beforeCareProgram" : "afterCareProgram";
  const defaultProgram = isBefore ? "Grossman Before Care" : "Grossman After Care";
  const jcampsProgram = isBefore ? "JCamps Before Care" : "JCamps After Care";
  const buildExternalArgs = (fn: string, ln: string, prog: string, allergy?: string) => ({
    preferredName: fn,
    lastName: ln || undefined,
    bunk: "External",
    code: "000",
    ...(isBefore
      ? { arrivalMethod: "Before Care", beforeCareProgram: prog }
      : { dismissalMethod: "After Care", afterCareProgram: prog }),
    isExternal: true,
    allergyDetails: allergy,
    staffName: staff.name,
  });

  const overrideMap = new Map<string, NonNullable<typeof overrides>[number]>();
  for (const o of overrides ?? []) overrideMap.set(o.camperId, o);

  const normalIds = new Set(normalRoster.map(c => c._id));

  // Campers overridden INTO this care today (not normally here)
  const addedToday = (allCampers ?? []).filter(c => {
    if (normalIds.has(c._id)) return false;
    const ov = overrideMap.get(c._id);
    return ov?.[matchField] === matchValue;
  });

  // Campers overridden OUT of this care today (normally here)
  const removedToday = normalRoster.filter(c => {
    const ov = overrideMap.get(c._id);
    return ov?.[matchField] && ov[matchField] !== matchValue;
  });

  const removedIds = new Set(removedToday.map(c => c._id));
  const activeRoster = normalRoster.filter(c => !removedIds.has(c._id));
  const todayRoster = [...activeRoster, ...addedToday];

  // Summary counts — mirror the bunk attendance strip.
  const isAbsentToday = (c: CamperDoc) =>
    overrideMap.get(c._id)?.isAbsent === true || c.arrivalStatus === "Absent";
  const absentCount = todayRoster.filter(c => isAbsentToday(c)).length;
  const inCount     = todayRoster.filter(c => !isAbsentToday(c) && c.dailyCheckpoints?.[kind] && !c.dailyCheckpointsOut?.[kind]).length;
  const outCount    = todayRoster.filter(c => !isAbsentToday(c) && c.dailyCheckpoints?.[kind] && c.dailyCheckpointsOut?.[kind]).length;
  const notInCount  = todayRoster.filter(c => !isAbsentToday(c) && !c.dailyCheckpoints?.[kind]).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold" style={{ color: "#023B64" }}>{title}</h2>
        <button onClick={() => setAddingExternal(true)}
          className="ml-auto text-xs font-semibold text-white px-3 py-1.5 rounded-xl"
          style={{ backgroundColor: "#023B64" }}>+ External</button>
      </div>

      {/* Summary strip — same as bunk attendance, on top */}
      <div className="flex gap-2">
        <Pill value={inCount}    label="In"     color="green" />
        <Pill value={notInCount} label="Not In" color="slate" />
        <Pill value={outCount}   label="Out"    color="blue" />
        {absentCount > 0 && <Pill value={absentCount} label="Absent" color="amber" />}
      </div>
      <p className="text-xs text-slate-500 text-center -mt-1">
        {todayRoster.length} enrolled
      </p>

      {removedToday.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider px-1">Removed Today</p>
          {removedToday.map(c => {
            const ov = overrideMap.get(c._id);
            return (
              <div key={c._id} className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3 opacity-70">
                <span className="font-semibold text-slate-700 text-sm">{camperName(c)}</span>
                <span className="text-xs text-amber-700">→ now {ov?.[matchField]}</span>
              </div>
            );
          })}
        </div>
      )}

      {addedToday.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-green-600 uppercase tracking-wider px-1">Added Today</p>
          {addedToday.map(c => (
            <div key={c._id} className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="font-semibold text-slate-700 text-sm">{camperName(c)}</span>
              <span className="text-xs text-green-700">normally {(c as Record<string, unknown>)[normalField] as string ?? "—"}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <button onClick={() => setCareGroupBy("all")}
          className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${careGroupBy === "all" ? "text-white" : "bg-white text-slate-500 border border-slate-200"}`}
          style={careGroupBy === "all" ? { backgroundColor: "#023B64" } : undefined}>All</button>
        <button onClick={() => setCareGroupBy("program")}
          className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${careGroupBy === "program" ? "text-white" : "bg-white text-slate-500 border border-slate-200"}`}
          style={careGroupBy === "program" ? { backgroundColor: "#023B64" } : undefined}>By Program</button>
      </div>

      {careGroupBy === "program" ? (() => {
        const groups = new Map<string, CamperDoc[]>();
        for (const c of todayRoster) {
          const prog = (c as Record<string, unknown>)[programField] as string || jcampsProgram;
          if (!groups.has(prog)) groups.set(prog, []);
          groups.get(prog)!.push(c);
        }
        return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([prog, members]) => (
          <div key={prog} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span className="text-sm font-bold text-slate-700">{prog}</span>
              <span className="text-xs text-slate-400">{members.length}</span>
            </div>
            <InOutRosterView
              campers={members}
              checkpoint={kind}
              staffName={staff.name}
              inLabel="Mark In"
              outLabel={outLabel}
              groupLabel={`${title} · ${prog}`}
              emptyMessage={`No campers in ${prog}.`}
              overrides={overrides ?? []}
              hideSummary
              showCode={kind === "AfterCare"}
            />
          </div>
        ));
      })() : (
        <InOutRosterView
          campers={todayRoster}
          checkpoint={kind}
          staffName={staff.name}
          inLabel="Mark In"
          outLabel={outLabel}
          groupLabel={title}
          emptyMessage={`No campers expected in ${title} today.`}
          overrides={overrides ?? []}
          hideSummary
          showCode={kind === "AfterCare"}
        />
      )}

      {addingExternal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAddingExternal(false)} />
          <div className="relative bg-white rounded-t-3xl overflow-auto max-h-[85vh]">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-slate-200 rounded-full" /></div>
            <div className="px-5 pt-2 pb-6 space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">Add External {title}</h3>
                <button onClick={() => setExtUploadMode(!extUploadMode)}
                  className="ml-auto text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600">
                  {extUploadMode ? "Single" : "CSV Upload"}
                </button>
              </div>
              <p className="text-xs text-slate-400">These campers only appear in {title}.</p>
              {extError && <p className="text-sm text-red-500 font-medium">{extError}</p>}

              {extUploadMode ? (
                <div className="space-y-3">
                  {!extCsvData ? (
                    <>
                      <p className="text-xs text-slate-500">CSV: First Name, Last Name, Program, Allergy Notes</p>
                      <label className="inline-block text-xs font-semibold text-white px-3 py-2 rounded-xl cursor-pointer"
                        style={{ backgroundColor: "#023B64" }}>
                        Choose CSV
                        <input type="file" accept=".csv" onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const parsed = parseCsv(ev.target?.result as string);
                            setExtCsvData(parsed);
                            const autoMap: Record<string, string> = {};
                            for (const field of EXT_AC_FIELDS) {
                              const match = parsed.headers.find(h => {
                                const norm = h.toLowerCase().replace(/[^a-z0-9]/g, "");
                                return norm === field.key.toLowerCase() || norm === field.label.toLowerCase().replace(/[^a-z0-9]/g, "");
                              });
                              if (match) autoMap[field.key] = match;
                            }
                            setExtMapping(autoMap);
                            setExtUploadStep("map");
                          };
                          reader.readAsText(file);
                          e.target.value = "";
                        }} className="hidden" />
                      </label>
                    </>
                  ) : extUploadStep === "map" ? (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-700">{extCsvData.rows.length} rows · {extCsvData.headers.length} columns</p>
                      {EXT_AC_FIELDS.map(field => (
                        <div key={field.key} className="flex items-center gap-3">
                          <span className="text-sm text-slate-900 flex-1">{field.label}{field.required ? " *" : ""}</span>
                          <select value={extMapping[field.key] ?? ""} onChange={e => setExtMapping({ ...extMapping, [field.key]: e.target.value })}
                            className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white w-36">
                            <option value="">— skip —</option>
                            {extCsvData.headers.map((h, hi) => <option key={hi} value={h}>{h}</option>)}
                          </select>
                        </div>
                      ))}
                      <div className="flex gap-3">
                        <button onClick={() => { setExtCsvData(null); setExtUploadStep(null); }} className="flex-1 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl">Back</button>
                        <button onClick={() => setExtUploadStep("preview")} disabled={!extMapping.firstName || !extMapping.lastName}
                          className="flex-1 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-50" style={{ backgroundColor: "#023B64" }}>Preview</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-700">Preview · {extCsvData.rows.length} campers</p>
                      {extCsvData.rows.slice(0, 5).map((row, i) => {
                        const fn = extMapping.firstName ? (row[extMapping.firstName]?.trim() ?? "") : "";
                        const ln = extMapping.lastName ? (row[extMapping.lastName]?.trim() ?? "") : "";
                        const prog = extMapping.program ? (row[extMapping.program]?.trim() ?? "") : "";
                        const allergy = extMapping.allergyNotes ? (row[extMapping.allergyNotes]?.trim() ?? "") : "";
                        return (
                          <div key={i} className="text-sm">
                            <span className="font-semibold text-slate-900">{fn} {ln}</span>
                            {prog && <span className="text-xs text-slate-400 ml-2">{prog}</span>}
                            {allergy && <span className="text-[10px] text-red-600 ml-2">Allergy: {allergy}</span>}
                          </div>
                        );
                      })}
                      {extCsvData.rows.length > 5 && <p className="text-xs text-slate-400">…and {extCsvData.rows.length - 5} more</p>}
                      <div className="flex gap-3">
                        <button onClick={() => setExtUploadStep("map")} className="flex-1 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl">Back</button>
                        <button disabled={extUploading} onClick={async () => {
                          setExtUploading(true);
                          const errors: string[] = [];
                          let created = 0;
                          for (let i = 0; i < extCsvData.rows.length; i++) {
                            const row = extCsvData.rows[i];
                            const fn = extMapping.firstName ? (row[extMapping.firstName]?.trim() ?? "") : "";
                            const ln = extMapping.lastName ? (row[extMapping.lastName]?.trim() ?? "") : "";
                            if (!fn) { errors.push(`Row ${i + 2}: missing first name`); continue; }
                            const prog = extMapping.program ? (row[extMapping.program]?.trim() || defaultProgram) : defaultProgram;
                            const allergy = extMapping.allergyNotes ? (row[extMapping.allergyNotes]?.trim() || undefined) : undefined;
                            try {
                              await createCamper(buildExternalArgs(fn, ln, prog, allergy));
                              created++;
                            } catch (e: unknown) { errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : "failed"}`); }
                          }
                          setExtUploading(false);
                          if (errors.length > 0) setExtError(`${created} added. Errors: ${errors.join("; ")}`);
                          else { setAddingExternal(false); setExtCsvData(null); setExtUploadStep(null); setExtError(""); }
                        }}
                          className="flex-1 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-50" style={{ backgroundColor: "#023B64" }}>
                          {extUploading ? "Uploading…" : `Upload ${extCsvData.rows.length}`}
                        </button>
                      </div>
                      {extError && <p className="text-xs text-amber-700">{extError}</p>}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">First Name *</label>
                      <input value={extForm.firstName} onChange={e => setExtForm({ ...extForm, firstName: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" placeholder="First name" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Last Name *</label>
                      <input value={extForm.lastName} onChange={e => setExtForm({ ...extForm, lastName: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" placeholder="Last name" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Program</label>
                      <select value={extForm.program} onChange={e => setExtForm({ ...extForm, program: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white">
                        <option value={defaultProgram}>{defaultProgram}</option>
                        <option value={jcampsProgram}>{jcampsProgram}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Allergy Notes</label>
                      <input value={extForm.allergy} onChange={e => setExtForm({ ...extForm, allergy: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" placeholder="e.g. Peanut allergy" />
                    </div>
                  </div>
                  <button onClick={async () => {
                    if (!extForm.firstName.trim() || !extForm.lastName.trim()) { setExtError("Name is required"); return; }
                    try {
                      await createCamper(buildExternalArgs(extForm.firstName.trim(), extForm.lastName.trim(), extForm.program, extForm.allergy.trim() || undefined));
                      setAddingExternal(false);
                      setExtForm({ firstName: "", lastName: "", program: defaultProgram, allergy: "" });
                      setExtError("");
                    } catch (e: unknown) { setExtError(e instanceof Error ? e.message : "Failed"); }
                  }}
                    className="w-full py-3 text-sm font-bold text-white rounded-xl"
                    style={{ backgroundColor: "#023B64" }}>Add Camper</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bus Attendance Sheets ────────────────────────────────────────────────────

const BUS_CHECKPOINTS = [
  { key: "MorningBusIn",        label: "Bus",  phase: "AM" },
  { key: "MorningBusRoom",      label: "JCC",  phase: "AM" },
  { key: "AfternoonBusRoomIn",  label: "Room", phase: "PM" },
  { key: "AfternoonBusOnBoard", label: "Bus",  phase: "PM" },
  { key: "AfternoonBusAtStop",  label: "Stop", phase: "PM" },
] as const;

const BUS_COLORS_STATIC: Record<string, { bg: string; text: string; light: string; border: string }> = {
  "Blue Bus":   { bg: "#2563eb", text: "#fff",    light: "#dbeafe", border: "#93c5fd" },
  "Red Bus":    { bg: "#dc2626", text: "#fff",    light: "#fee2e2", border: "#fca5a5" },
  "Green Bus":  { bg: "#16a34a", text: "#fff",    light: "#dcfce7", border: "#86efac" },
  "Yellow Bus": { bg: "#ca8a04", text: "#fff",    light: "#fef9c3", border: "#fde047" },
  "Orange Bus": { bg: "#ea580c", text: "#fff",    light: "#ffedd5", border: "#fdba74" },
  "Purple Bus": { bg: "#7c3aed", text: "#fff",    light: "#ede9fe", border: "#c4b5fd" },
};
const DEFAULT_BUS_COLOR = { bg: "#023B64", text: "#fff", light: "#e0f2fe", border: "#93c5fd" };

function getBusColorFromRoutes(route: string, busRouteRecords?: Doc<"busRoutes">[]): { bg: string; text: string; light: string; border: string } {
  if (busRouteRecords) {
    const rec = busRouteRecords.find(r => r.name === route);
    if (rec?.colorHex) return { bg: rec.colorHex, text: "#fff", light: rec.colorLight ?? "#e0f2fe", border: rec.colorBorder ?? "#93c5fd" };
  }
  return BUS_COLORS_STATIC[route] ?? DEFAULT_BUS_COLOR;
}

function busCpCount(campers: CamperDoc[], key: string) {
  return campers.filter(c => c.dailyCheckpoints?.[key]).length;
}

function BusView({ staff }: { staff: StaffDoc }) {
  const busRouteRecords = useQuery(api.busRoutes.list);
  const busRoutesFromCampers = useQuery(api.campers.getBusRoutes);
  const allCampers = useQuery(api.campers.list);
  const overrides  = useQuery(api.dailyOverrides.getForDate, {});
  const setCheckpoint = useMutation(api.campers.setCheckpoint);
  const isAdmin = [staff.role, ...(staff.extraRoles ?? [])].some(r => r === "admin" || r === "director");
  const allRouteNames = busRouteRecords && busRouteRecords.length > 0
    ? busRouteRecords.filter(r => r.isActive !== false).sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99)).map(r => r.name)
    : busRoutesFromCampers && busRoutesFromCampers.length > 0 ? busRoutesFromCampers : BUS_ROUTES_FALLBACK;
  const staffBusRoute = staff.busRoute;
  const routes = isAdmin ? allRouteNames : staffBusRoute ? allRouteNames.filter(r => r === staffBusRoute) : allRouteNames;
  const getBusColor = (route: string) => getBusColorFromRoutes(route, busRouteRecords ?? undefined);
  const [view, setView] = useState<"all" | string>(isAdmin ? "all" : staffBusRoute ?? "all");
  const [selected, setSelected] = useState<CamperDoc | null>(null);
  const [search, setSearch] = useState("");
  const [groupByStop, setGroupByStop] = useState(false);
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());

  if (allCampers === undefined) return <Loading />;

  const overrideMap = new Map<string, NonNullable<typeof overrides>[number]>();
  for (const o of overrides ?? []) overrideMap.set(o.camperId, o);

  const getBusRoster = (route: string) => {
    const base = allCampers.filter(c => c.arrivalMethod === route || c.dismissalMethod === route || c.busRoute === route);
    const baseIds = new Set(base.map(c => c._id));
    const added = allCampers.filter(c => {
      if (baseIds.has(c._id)) return false;
      const ov = overrideMap.get(c._id);
      return ov?.morningArrival === route || ov?.afternoonDismissal === route;
    });
    const removed = base.filter(c => {
      const ov = overrideMap.get(c._id);
      if (!ov) return false;
      const arrStays = (c.arrivalMethod === route && !ov.morningArrival) || ov.morningArrival === route;
      const disStays = (c.dismissalMethod === route && !ov.afternoonDismissal) || ov.afternoonDismissal === route;
      return !arrStays && !disStays;
    });
    const removedIds = new Set(removed.map(c => c._id));
    return [...base.filter(c => !removedIds.has(c._id)), ...added];
  };

  const allBusCampers = routes.flatMap(r => getBusRoster(r));
  const uniqueBusIds = new Set<string>();
  const dedupedAll = allBusCampers.filter(c => { if (uniqueBusIds.has(c._id)) return false; uniqueBusIds.add(c._id); return true; });

  const isAbsent = (c: CamperDoc) => overrideMap.get(c._id)?.isAbsent === true || c.arrivalStatus === "Absent";
  const allDoneFn = (c: CamperDoc) => BUS_CHECKPOINTS.every(cp => c.dailyCheckpoints?.[cp.key]);
  const toggleCp = (c: CamperDoc, key: string) => {
    if (isAbsent(c)) return;
    setCheckpoint({ id: c._id, checkpoint: key as "MorningBusIn", value: !c.dailyCheckpoints?.[key], staffName: staff.name, label: view === "all" ? "" : view });
  };
  const toggleRoute = (r: string) => { const s = new Set(expandedRoutes); if (s.has(r)) s.delete(r); else s.add(r); setExpandedRoutes(s); };

  const renderCounters = (clist: CamperDoc[]) => (
    <div className="grid grid-cols-5 gap-1">
      {BUS_CHECKPOINTS.map(cp => {
        const done = busCpCount(clist, cp.key);
        return (
          <div key={cp.key} className="bg-white border border-slate-200 rounded-xl px-1 py-2 text-center">
            <p className="text-sm font-bold text-slate-900">{done}<span className="text-slate-400 font-normal">/{clist.length}</span></p>
            <p className="text-[9px] text-slate-400 uppercase">{cp.phase} {cp.label}</p>
          </div>
        );
      })}
    </div>
  );

  const renderCamperRow = (c: CamperDoc) => {
    const absent = isAbsent(c);
    const done = allDoneFn(c);
    const sq = search.toLowerCase();
    if (sq && !camperName(c).toLowerCase().includes(sq) && !c.bunk.toLowerCase().includes(sq) && !(c.busStop ?? "").toLowerCase().includes(sq) && !c.code.includes(sq)) return null;
    return (
      <div key={c._id} className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${absent ? "opacity-50" : done ? "opacity-55" : ""}`}>
        <button onClick={() => setSelected(c)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
          <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: avatarBg(c.name) }}>
            {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : (c.preferredName ?? c.name).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-base leading-tight">{camperName(c)}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-xs text-slate-500">{c.bunk}</span>
              <span className="text-xs text-slate-400 font-mono">#{c.code}</span>
              {c.busStop && <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">{c.busStop}</span>}
              {c.walkPermission && <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">Walk</span>}
              {c.hasAllergies && <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">ALLERGY</span>}
              {absent && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">Absent</span>}
            </div>
          </div>
        </button>
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "#023B64" }}>Morning</p>
              <div className="flex gap-2">
                {BUS_CHECKPOINTS.filter(cp => cp.phase === "AM").map(cp => { const checked = !!c.dailyCheckpoints?.[cp.key]; return (
                  <button key={cp.key} onClick={() => toggleCp(c, cp.key)} disabled={absent} className={`flex flex-col items-center gap-1 ${absent ? "cursor-not-allowed" : ""}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${absent ? "bg-slate-50" : checked ? "bg-green-500 text-white" : "bg-slate-100 active:bg-slate-200"}`}>{checked && <Check size={18} strokeWidth={3} />}</div>
                    <span className={`text-[11px] font-semibold ${checked ? "text-green-600" : "text-slate-400"}`}>{cp.label}</span>
                  </button>); })}
              </div>
            </div>
            <div className="w-px h-12 bg-slate-200" />
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "#023B64" }}>Afternoon</p>
              <div className="flex gap-2">
                {BUS_CHECKPOINTS.filter(cp => cp.phase === "PM").map(cp => { const checked = !!c.dailyCheckpoints?.[cp.key]; return (
                  <button key={cp.key} onClick={() => toggleCp(c, cp.key)} disabled={absent} className={`flex flex-col items-center gap-1 ${absent ? "cursor-not-allowed" : ""}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${absent ? "bg-slate-50" : checked ? "bg-green-500 text-white" : "bg-slate-100 active:bg-slate-200"}`}>{checked && <Check size={18} strokeWidth={3} />}</div>
                    <span className={`text-[11px] font-semibold ${checked ? "text-green-600" : "text-slate-400"}`}>{cp.label}</span>
                  </button>); })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── All Buses Dashboard ──
  if (view === "all") return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2"><Bus size={22} className="text-slate-700" /><h2 className="text-xl font-bold text-slate-900">All Buses</h2><span className="text-sm text-slate-400 ml-1">{dedupedAll.length} campers</span></div>
        {renderCounters(dedupedAll)}
        <div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, bunk, code, bus stop…" className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none" /></div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button className="px-3.5 py-2 rounded-xl text-sm font-semibold flex-shrink-0 text-white" style={{ backgroundColor: "#023B64" }}>All</button>
          {routes.map(r => { const bc = getBusColor(r); return <button key={r} onClick={() => setView(r)} className="px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0" style={{ color: bc.bg, backgroundColor: bc.light, border: `1px solid ${bc.border}` }}>{r}</button>; })}
        </div>
        {routes.map(r => {
          const rr = getBusRoster(r).sort((a, b) => camperName(a).localeCompare(camperName(b)));
          const expanded = expandedRoutes.has(r);
          const cpDone = BUS_CHECKPOINTS.map(cp => busCpCount(rr, cp.key));
          const bc = getBusColor(r);
          return (
            <div key={r} className="rounded-2xl shadow-sm overflow-hidden" style={{ backgroundColor: bc.light, border: `1.5px solid ${bc.border}` }}>
              <button onClick={() => toggleRoute(r)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:opacity-80">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ backgroundColor: bc.bg, color: bc.text }}>{rr.length}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900">{r}</p>
                  <div className="flex gap-2 mt-1 text-[10px] text-slate-400">{BUS_CHECKPOINTS.map((cp, i) => <span key={cp.key} className={cpDone[i] === rr.length && rr.length > 0 ? "text-green-600 font-bold" : ""}>{cp.phase[0]}{cp.label[0]}: {cpDone[i]}/{rr.length}</span>)}</div>
                </div>
                {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>
              {expanded && <div className="border-t border-slate-100 px-3 py-3 space-y-2">{renderCounters(rr)}<div className="space-y-2.5 mt-3">{rr.map(c => renderCamperRow(c)).filter(Boolean)}</div><button onClick={() => setView(r)} className="w-full py-2 text-xs font-semibold text-slate-500">Open full {r} sheet →</button></div>}
            </div>
          );
        })}
      </div>
      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} />}
    </>
  );

  // ── Single Bus Sheet ──
  const singleRoster = getBusRoster(view).sort((a, b) => { if (groupByStop) { const sa = (a.busStop ?? "").localeCompare(b.busStop ?? ""); if (sa !== 0) return sa; } return camperName(a).localeCompare(camperName(b)); });
  const stopGroups = groupByStop ? [...singleRoster.reduce((acc, c) => { const stop = c.busStop || "No Stop Assigned"; if (!acc.has(stop)) acc.set(stop, []); acc.get(stop)!.push(c); return acc; }, new Map<string, CamperDoc[]>()).entries()].sort((a, b) => a[0].localeCompare(b[0])) : null;

  return (
    <>
      <div className="space-y-4">
        <button onClick={() => setView("all")} className="text-sm text-slate-500 flex items-center gap-1">← All Buses</button>
        <h2 className="text-2xl font-bold" style={{ color: getBusColor(view).bg }}>{view}</h2>
        {renderCounters(singleRoster)}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button onClick={() => setView("all")} className="px-3.5 py-2 rounded-xl text-sm font-semibold flex-shrink-0" style={{ color: "#64748b", backgroundColor: "#fff", border: "1px solid #e2e8f0" }}>All</button>
          {routes.map(r => { const bc = getBusColor(r); return <button key={r} onClick={() => setView(r)} className="px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0" style={view === r ? { backgroundColor: bc.bg, color: bc.text } : { color: bc.bg, backgroundColor: bc.light, border: `1px solid ${bc.border}` }}>{r}</button>; })}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, bunk, code, stop…" className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none" /></div>
          <button onClick={() => setGroupByStop(!groupByStop)} className={`text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors whitespace-nowrap ${groupByStop ? "text-white" : "bg-white text-slate-500 border border-slate-200"}`} style={groupByStop ? { backgroundColor: "#023B64" } : undefined}>By Stop</button>
        </div>
        <p className="text-xs text-slate-500 text-center">{singleRoster.length} campers on {view}</p>
        {singleRoster.length === 0 && <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">No campers on {view}.</div>}
        {stopGroups ? stopGroups.map(([stop, members]) => {
          const bc = getBusColor(view);
          return (
          <div key={stop}>
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl" style={{ backgroundColor: bc.light, border: `1px solid ${bc.border}` }}><MapPin size={14} style={{ color: bc.bg }} /><span className="text-sm font-bold" style={{ color: bc.bg }}>{stop}</span><span className="text-xs" style={{ color: bc.bg, opacity: 0.6 }}>{members.length}</span></div>
            <div className="space-y-2.5">{members.map(c => renderCamperRow(c)).filter(Boolean)}</div>
          </div>
        ); }) : <div className="space-y-2.5">{singleRoster.map(c => renderCamperRow(c)).filter(Boolean)}</div>}
      </div>
      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} />}
    </>
  );

}

// ─── Specialist View (Upper Camp activity rosters) ───────────────────────────

function SpecialistView({ staff }: { staff: StaffDoc }) {
  // An activity leader may run Upper Camp period classes and/or Middle Camp tracks.
  const myClasses = useQuery(api.periodClasses.getForStaff, { staffId: staff._id });
  const myTracks = useQuery(api.tracks.getForStaff, { staffId: staff._id });
  const [view, setView] = useState<"classes" | "tracks">("classes");

  if (myClasses === undefined || myTracks === undefined) return <Loading />;

  const hasClasses = myClasses.length > 0;
  const hasTracks = myTracks.length > 0;
  const showTracks = hasTracks && (!hasClasses || view === "tracks");

  if (!hasClasses && !hasTracks) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
        No classes or tracks assigned. Contact an administrator.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {showTracks ? <Route size={22} className="text-slate-700" /> : <Calendar size={22} className="text-slate-700" />}
        <h2 className="text-xl font-bold text-slate-900">{showTracks ? "My Tracks" : "My Classes"}</h2>
      </div>
      {hasClasses && hasTracks && (
        <div className="flex gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5">
          {([{ id: "classes", label: "Classes" }, { id: "tracks", label: "Tracks" }] as const).map(t => (
            <button key={t.id} onClick={() => setView(t.id)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
              style={(view === t.id) ? { backgroundColor: "#023B64", color: "#fff" } : { color: "#64748b" }}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {showTracks ? <MyTracksPanel staff={staff} /> : <MyClassesPanel staff={staff} />}
    </div>
  );
}

// The records-based "my classes" panel: a day toggle, a strip of the staff
// member's classes for that day, and the selected class's roster + check-in.
// Used by the specialist view and the counselor "Periods" tab.
function MyClassesPanel({ staff }: { staff: StaffDoc }) {
  const [dayType, setDayType] = useState<"MonThu" | "Friday">(currentDayType());
  const classes = useQuery(api.periodClasses.getForStaff, { staffId: staff._id, dayType });
  const [activeId, setActiveId] = useState<string | null>(null);

  if (classes === undefined) return <Loading />;

  const sorted = [...classes].sort((a, b) => a.period.localeCompare(b.period) || a.className.localeCompare(b.className));
  const active = sorted.find(c => c._id === activeId) ?? sorted[0] ?? null;

  return (
    <div className="space-y-4">
      {/* Mon–Thu vs Friday — defaults to today's schedule. */}
      <div className="flex gap-1.5 bg-slate-100 rounded-2xl p-1.5">
        {([{ id: "MonThu", label: "Mon–Thu" }, { id: "Friday", label: "Friday" }] as const).map(d => (
          <button key={d.id} onClick={() => { setDayType(d.id); setActiveId(null); }}
            className="flex-1 py-2 rounded-xl text-sm font-bold transition-colors"
            style={dayType === d.id ? { backgroundColor: "#F59E0B", color: "#fff" } : { color: "#64748b" }}>
            {d.label}{currentDayType() === d.id ? " · Today" : ""}
          </button>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
          No classes assigned for {dayType === "Friday" ? "Friday" : "Mon–Thu"}. Contact an administrator.
        </div>
      )}

      {sorted.length > 1 && (
        <div className="flex gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5 overflow-x-auto">
          {sorted.map(c => (
            <button key={c._id} onClick={() => setActiveId(c._id)}
              className="flex-shrink-0 py-2 px-3 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
              style={active?._id === c._id ? { backgroundColor: "#023B64", color: "#fff" } : { color: "#64748b" }}>
              {(PERIOD_LABEL[c.period] ?? c.period).replace("Period ", "P")} · {c.className}
            </button>
          ))}
        </div>
      )}

      {active && <MyClassRoster cls={active} staffName={staff.name} />}
    </div>
  );
}

// A staff member's records-based class roster with daily check-in.
function MyClassRoster({ cls, staffName }: { cls: Doc<"periodClasses">; staffName: string }) {
  const roster = useQuery(api.periodScheduleRecords.getForClass, { periodClassId: cls._id });
  const attendance = useQuery(api.periodAttendance.getForPeriodClassDate, { periodClassId: cls._id });
  const campers = useQuery(api.campers.list);
  const checkIn = useMutation(api.periodAttendance.checkIn);
  const undoCheckIn = useMutation(api.periodAttendance.undoCheckIn);
  const [selected, setSelected] = useState<CamperDoc | null>(null);

  if (roster === undefined || campers === undefined) return <Loading />;

  const camperMap = new Map(campers.map(c => [c._id as string, c]));
  const rosterCampers = roster
    .map(r => camperMap.get(r.camperId as string))
    .filter((c): c is CamperDoc => !!c)
    .sort((a, b) => camperName(a).localeCompare(camperName(b)));
  const checkedCount = rosterCampers.filter(c => (attendance ?? []).find(a => a.camperId === c._id)?.checkedIn).length;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-2xl font-bold" style={{ color: "#023B64" }}>{cls.className}</h3>
            <p className="text-slate-500 text-sm">{PERIOD_LABEL[cls.period] ?? cls.period}{cls.location ? ` · ${cls.location}` : ""}</p>
          </div>
          <span className="text-slate-500 text-sm font-medium">{checkedCount} / {rosterCampers.length}</span>
        </div>

        {rosterCampers.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
            No campers scheduled for this class.
          </div>
        )}

        <div className="space-y-2">
          {rosterCampers.map(c => {
            const att = (attendance ?? []).find(a => a.camperId === c._id);
            const checked = att?.checkedIn === true;
            const presence = getCampusPresence(c);
            return (
              <div key={c._id} className="bg-white rounded-2xl border border-slate-200 flex items-center gap-3 px-4 py-3">
                <button onClick={() => setSelected(c)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: avatarBg(c.name) }}>
                    {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : (c.preferredName ?? c.name).charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900 text-sm">{camperName(c)}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${presence.status === "Here" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{presence.label}</span>
                    </div>
                    <p className="text-xs text-slate-500">{c.bunk}{checked && att?.checkedInAt ? ` · ${fmt(att.checkedInAt)}` : ""}</p>
                    <AttendanceNoteLine note={c.attendanceNote} />
                  </div>
                </button>
                <button onClick={async () => { if (checked && att) await undoCheckIn({ id: att._id }); else await checkIn({ camperId: c._id, period: cls.period, className: cls.className, periodClassId: cls._id, staffId: staffName }); }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${checked ? "bg-green-500 text-white" : "bg-slate-100 active:bg-slate-200"}`}>
                  {checked && <Check size={18} strokeWidth={3} />}
                </button>
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
  const [lookupOpen, setLookupOpen] = useState(false);
  const matched    = useQuery(api.campers.getByCode, entry.length === 3 ? { code: entry } : "skip");
  const callByCode = useMutation(api.campers.callByCode);
  const Icon = source === "Carline" ? Car : Footprints;
  const call = async () => { await callByCode({ code: entry, source }); setEntry(""); };

  // When staff recovers a camper via name lookup, drop their family code into the
  // normal entry field so the standard verify-then-call flow takes over.
  const recoverCode = (code: string) => {
    setEntry(String(code).replace(/\D/g, "").slice(0, 3));
    setLookupOpen(false);
  };

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

          {/* Fallback: parent doesn't remember the safety number */}
          <button onClick={() => setLookupOpen(true)}
            className="w-full text-center text-sm font-semibold text-[#023B64] mt-4 py-2 active:opacity-70">
            Forgot Safety Number?
          </button>
        </div>
      </div>

      {lookupOpen && <SafetyNumberLookup onClose={() => setLookupOpen(false)} onRecover={recoverCode} />}
      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

// Staff-only fallback: search a camper by name to recover the family safety number.
function SafetyNumberLookup({ onClose, onRecover }: { onClose: () => void; onRecover: (code: string) => void }) {
  const campers = useQuery(api.campers.list);
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const results = query.length < 2 ? [] : (campers ?? []).filter(c => {
    const hay = `${c.preferredName ?? ""} ${c.name ?? ""} ${c.lastName ?? ""}`.toLowerCase();
    return hay.includes(query);
  }).slice(0, 25);

  const fullName = (c: CamperDoc) =>
    c.preferredName
      ? `${c.preferredName}${c.lastName ? " " + c.lastName : ""}`
      : c.name;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="backdrop-fade absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="sheet-slide-up relative bg-white rounded-t-3xl flex flex-col max-h-[88dvh] overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Safety Number Lookup</h3>
            <p className="text-xs text-slate-500">Search by camper name to recover the family code</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center active:bg-slate-200">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pt-4 flex-shrink-0">
          <div className="relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} autoFocus
              placeholder="First, preferred, or last name…"
              className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:outline-none text-sm bg-white"
              onFocus={e => (e.currentTarget.style.borderColor = "#023B64")}
              onBlur={e => (e.currentTarget.style.borderColor = "")} />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-2">
          {campers === undefined && <Loading />}
          {campers !== undefined && query.length < 2 && (
            <p className="text-center text-slate-400 text-sm py-8">Type at least 2 letters to search.</p>
          )}
          {campers !== undefined && query.length >= 2 && results.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">No campers match “{q}”.</p>
          )}
          {results.map(c => (
            <button key={c._id} onClick={() => onRecover(c.code)}
              className="w-full flex items-center gap-3 bg-slate-50 active:bg-slate-100 rounded-xl px-4 py-3 text-left">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold overflow-hidden"
                style={{ backgroundColor: avatarBg(c.name) }}>
                {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : fullName(c).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900">{fullName(c)}</p>
                <p className="text-xs text-slate-500">{c.bunk}{c.grade ? ` · ${c.grade}` : ""}</p>
              </div>
              <span className="text-xs font-semibold text-[#023B64] flex items-center gap-1 flex-shrink-0">
                Use code <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

function Dispatcher() {
  const active     = useQuery(api.campers.active);
  const runners    = useQuery(api.staff.getRunners);
  const assign     = useMutation(api.campers.assign);
  const cancelCall = useMutation(api.campers.cancelCall);
  const [selected, setSelected] = useState<CamperDoc | null>(null);

  if (active === undefined || runners === undefined) return <Loading />;

  const runnerDisplayNames = runners.length > 0
    ? runners.map(r => ({ id: r._id, display: r.runnerLabel || staffDisplayName(r, runners), raw: r }))
    : [];

  const assignedRunnerNames = new Set(
    active.filter(c => c.status === "Assigned" && c.runner).map(c => c.runner!)
  );
  const availableRunners = runnerDisplayNames.filter(r => !assignedRunnerNames.has(r.display));
  const busyRunners = runnerDisplayNames.filter(r => assignedRunnerNames.has(r.display));

  const sorted = [...active].sort((a, b) => (b.tCalled ?? 0) - (a.tCalled ?? 0));

  const WAIT_WARN_MS = 5 * 60 * 1000;
  const now = Date.now();

  return (
    <>
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Radio size={22} className="text-slate-700" />
          <h2 className="text-xl font-bold text-slate-900">Dispatcher</h2>
          <span className="ml-auto text-sm text-slate-500 font-medium">{active.length} active</span>
        </div>

        {runnerDisplayNames.length > 0 && (
          <div className="mb-4 bg-white rounded-2xl border border-slate-200 p-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Runners</p>
            <div className="flex gap-2 flex-wrap">
              {runnerDisplayNames.map(r => {
                const busy = assignedRunnerNames.has(r.display);
                return (
                  <span key={r.id} className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg ${busy ? "bg-slate-100 text-slate-400 line-through" : "bg-green-100 text-green-700"}`}>
                    {r.display}{busy ? "" : " ✓"}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {active.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">No campers called yet.</div>
        )}
        <div className="space-y-3">
          {sorted.map(c => {
            const waitingLong = !c.runner && c.tCalled && (now - c.tCalled) > WAIT_WARN_MS;
            return (
              <div key={c._id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${waitingLong ? "border-amber-400 ring-2 ring-amber-200" : "border-slate-200"}`}>
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
                    {c.runner
                      ? <p className="text-xs text-blue-600 font-semibold mt-0.5">→ {c.runner}</p>
                      : <p className="text-xs text-amber-600 font-bold mt-0.5">Needs Runner</p>
                    }
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={c.status} />
                    {waitingLong && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <AlertTriangle size={10} /> Waiting
                      </span>
                    )}
                  </div>
                </button>
                <div className="border-t border-slate-100 px-3 py-2.5 flex gap-2 flex-wrap items-center">
                  {availableRunners.map(r => (
                    <button key={r.id} onClick={() => assign({ id: c._id, runner: r.display })}
                      className="px-3.5 py-2 rounded-xl text-sm font-bold bg-green-50 text-green-700 active:bg-green-100 transition-colors">
                      {r.display}
                    </button>
                  ))}
                  {busyRunners.map(r => (
                    <button key={r.id} onClick={() => assign({ id: c._id, runner: r.display })}
                      className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-colors ${c.runner === r.display ? "text-white" : "bg-slate-100 text-slate-400"}`}
                      style={c.runner === r.display ? { backgroundColor: "#023B64" } : undefined}>
                      {r.display}
                    </button>
                  ))}
                  <button onClick={() => cancelCall({ id: c._id })}
                    className="ml-auto text-xs text-red-400 active:text-red-600 flex items-center gap-1 px-2 py-2">
                    <AlertCircle size={13} /> Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function RunnerViewForStaff({ staff }: { staff: StaffDoc }) {
  const runners = useQuery(api.staff.getRunners);
  if (runners === undefined) return <Loading />;
  const displayName = staff.runnerLabel || staffDisplayName(staff, runners);
  return <RunnerView runnerName={displayName} />;
}

// ─── Runner View ─────────────────────────────────────────────────────────────

function RunnerView({ runnerName }: { runnerName: string }) {
  const mine    = useQuery(api.campers.forRunner, { runner: runnerName });
  const pickUp  = useMutation(api.campers.pickUp);
  const dismiss = useMutation(api.campers.dismiss);
  const [selected, setSelected] = useState<CamperDoc | null>(null);

  if (mine === undefined) return <Loading />;

  const active    = mine.filter(c => c.status === "Assigned" || c.status === "Picked Up");
  const completed = mine.filter(c => c.status === "Dismissed");

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <User size={20} className="text-slate-400" />
          <h2 className="text-xl font-bold text-slate-900">{runnerName}</h2>
          {active.length > 0 && (
            <span className="ml-auto text-sm font-bold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "#023B64", color: "#fff" }}>
              {active.length} active
            </span>
          )}
        </div>

        {active.length === 0 && completed.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <User size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Standing by</p>
            <p className="text-sm mt-1">No assignments yet.</p>
          </div>
        )}

        {/* Active assignments — large, focused cards */}
        {active.map(c => {
          const name = camperName(c);
          const bg   = avatarBg(c.name);
          const isPickedUp = c.status === "Picked Up";
          return (
            <div key={c._id} className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
              {/* Identity */}
              <button onClick={() => setSelected(c)} className="w-full flex items-center gap-4 px-5 py-4 text-left active:bg-slate-50">
                <div className="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xl text-white overflow-hidden"
                  style={{ backgroundColor: bg }}>
                  {c.photoUrl
                    ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" />
                    : (c.preferredName ?? c.name).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xl text-slate-900 leading-tight">{name}</p>
                  {c.hasAllergies && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 mr-1">ALLERGY</span>
                  )}
                  <p className="text-sm text-slate-500 mt-0.5">{c.bunk}</p>
                </div>
                <StatusBadge status={c.status} />
              </button>

              {/* Direction banner */}
              <div className="border-t border-slate-100 px-5 py-3.5 flex items-start gap-4 bg-slate-50">
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {isPickedUp ? "Bring to" : "Get from"}
                  </p>
                  <p className="font-bold text-lg text-slate-900 mt-0.5">
                    {isPickedUp
                      ? (c.callSource === "Carline" ? "Carline" : "Walk-Up Area")
                      : c.bunk}
                  </p>
                </div>
                {c.callSource && (
                  <div className="flex-shrink-0 pt-4">
                    {c.callSource === "Carline" ? <Car size={22} className="text-slate-400" /> : <Footprints size={22} className="text-slate-400" />}
                  </div>
                )}
              </div>

              {/* Primary action */}
              {!isPickedUp && (
                <button onClick={() => pickUp({ id: c._id })}
                  className="w-full py-4 font-bold text-base text-white flex items-center justify-center gap-2 active:opacity-80"
                  style={{ backgroundColor: "#5B8C9D" }}>
                  <Check size={20} /> With Me
                </button>
              )}
              {isPickedUp && (
                <button onClick={() => dismiss({ id: c._id })}
                  className="w-full py-4 font-bold text-base text-white flex items-center justify-center gap-2 active:opacity-80"
                  style={{ backgroundColor: "#16A34A" }}>
                  <CheckCircle2 size={20} /> Dismissed
                </button>
              )}
            </div>
          );
        })}

        {/* Completed — compact list */}
        {completed.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">Completed</p>
            <div className="space-y-2">
              {completed.map(c => (
                <div key={c._id} className="bg-white rounded-2xl border border-slate-200 flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm text-white overflow-hidden"
                    style={{ backgroundColor: avatarBg(c.name) }}>
                    {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : (c.preferredName ?? c.name).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{camperName(c)}</p>
                    <p className="text-xs text-slate-400">{c.bunk}</p>
                  </div>
                  <Check size={16} className="text-green-500 flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function RunnerAdminView() {
  const runners = useQuery(api.staff.getRunners);
  const runnerNames = runners && runners.length > 0
    ? runners.map(r => r.runnerLabel || staffDisplayName(r, runners))
    : RUNNERS_FALLBACK;
  const [me, setMe] = useState<string | null>(null);
  if (!me) return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-4">View Runner Queue</h2>
      <div className="grid grid-cols-2 gap-3">
        {runnerNames.map(r => (
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

type AdminTab = "campers" | "manage" | "changes";

type CamperFormData = {
  preferredName: string; lastName: string; bunk: string; code: string;
  camp: string; campDivision: string; grade: string;
  arrivalMethod: string; dismissalMethod: string; photoUrl: string;
  allergyDetails: string; camperNotes: string; lunchInfo: string;
};

const CAMPER_FORM_BLANK: CamperFormData = {
  preferredName: "", lastName: "", bunk: "", code: "", camp: "", campDivision: "",
  grade: "", arrivalMethod: "", dismissalMethod: "", photoUrl: "",
  allergyDetails: "", camperNotes: "", lunchInfo: "",
};

function camperFormFromDoc(c: CamperDoc): CamperFormData {
  return {
    preferredName: c.preferredName ?? c.name ?? "",
    lastName: c.lastName ?? "",
    bunk: c.bunk ?? "",
    code: c.code ?? "",
    camp: c.camp ?? "",
    campDivision: c.campDivision ?? "",
    grade: c.grade ?? "",
    arrivalMethod: c.arrivalMethod ?? "",
    dismissalMethod: c.dismissalMethod ?? "",
    photoUrl: c.photoUrl ?? "",
    allergyDetails: c.allergyDetails ?? "",
    camperNotes: c.camperNotes ?? "",
    lunchInfo: c.lunchInfo ?? "",
  };
}

function Admin() {
  const [tab, setTab] = useState<AdminTab>("campers");
  const [q, setQ]       = useState("");
  const [selected, setSelected] = useState<CamperDoc | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [editingCamper, setEditingCamper] = useState<CamperDoc | null>(null);
  const [addingCamper, setAddingCamper] = useState(false);
  const [camperForm, setCamperForm] = useState<CamperFormData>(CAMPER_FORM_BLANK);
  const [camperError, setCamperError] = useState("");
  const campers         = useQuery(api.campers.list);
  const campStructure   = useQuery(api.campStructure.list);
  const todayOverrides  = useQuery(api.dailyOverrides.getForDate, {});
  const upcomingOverrides = useQuery(api.dailyOverrides.getUpcoming, { fromDate: today() });
  const clearDailyState = useMutation(api.campers.clearDailyState);
  const adminCreateCamper = useMutation(api.campers.adminCreate);
  const adminUpdateCamper = useMutation(api.campers.adminUpdate);
  const deactivateCamper = useMutation(api.campers.deactivate);
  const reactivateCamper = useMutation(api.campers.reactivate);
  const deleteCamper = useMutation(api.campers.adminDelete);

  const totalChanges = ((todayOverrides ?? []).length) + ((upcomingOverrides ?? []).filter(o => o.date > today()).length);
  const adminTabs: { id: AdminTab; label: string }[] = [
    { id: "campers", label: "Campers" },
    { id: "manage", label: "Manage" },
    { id: "changes", label: "Changes" },
  ];

  if (campers === undefined) return <Loading />;

  const camperMap = new Map<string, CamperDoc>();
  for (const c of campers) camperMap.set(c._id, c);

  const activeCampers = campers.filter(c => c.isActive !== false && !c.isExternal);
  const inactiveCampers = campers.filter(c => c.isActive === false && !c.isExternal);

  const filtered = campers.filter(c => {
    if (tab === "manage") {
      if (!showInactive && c.isActive === false) return false;
      if (showInactive && c.isActive !== false) return false;
    } else {
      if (c.isActive === false) return false;
    }
    const s = q.toLowerCase();
    if (!s) return true;
    return c.name.toLowerCase().includes(s)
      || (c.preferredName ?? "").toLowerCase().includes(s)
      || (c.lastName ?? "").toLowerCase().includes(s)
      || c.bunk.toLowerCase().includes(s)
      || c.code.includes(s)
      || (c.arrivalMethod ?? "").toLowerCase().includes(s)
      || (c.dismissalMethod ?? "").toLowerCase().includes(s)
      || (c.camp ?? "").toLowerCase().includes(s);
  });

  const structureBunks = (campStructure ?? []).filter(s => s.isActive !== false).map(s => s.bunk).sort();
  const structureCamps = [...new Set((campStructure ?? []).filter(s => s.isActive !== false).map(s => s.camp))].sort();
  const structureDivisions = [...new Set((campStructure ?? []).filter(s => s.isActive !== false).map(s => s.division))].sort();

  const openAddCamper = () => { setCamperForm(CAMPER_FORM_BLANK); setAddingCamper(true); setEditingCamper(null); setCamperError(""); };
  const openEditCamper = (c: CamperDoc) => { setCamperForm(camperFormFromDoc(c)); setEditingCamper(c); setAddingCamper(false); setCamperError(""); };

  const handleSaveCamper = async () => {
    if (!camperForm.preferredName.trim() || !camperForm.bunk.trim() || !camperForm.code.trim()) {
      setCamperError("Name, bunk, and safety code are required"); return;
    }
    try {
      if (editingCamper) {
        await adminUpdateCamper({
          id: editingCamper._id, staffName: "Admin",
          preferredName: camperForm.preferredName.trim(),
          lastName: camperForm.lastName.trim() || undefined,
          bunk: camperForm.bunk.trim(),
          code: camperForm.code.trim(),
          camp: camperForm.camp.trim() || undefined,
          campDivision: camperForm.campDivision.trim() || undefined,
          grade: camperForm.grade.trim() || undefined,
          arrivalMethod: camperForm.arrivalMethod.trim() || undefined,
          dismissalMethod: camperForm.dismissalMethod.trim() || undefined,
          photoUrl: camperForm.photoUrl.trim() || undefined,
          allergyDetails: camperForm.allergyDetails.trim() || undefined,
          camperNotes: camperForm.camperNotes.trim() || undefined,
          lunchInfo: camperForm.lunchInfo.trim() || undefined,
        });
      } else {
        await adminCreateCamper({
          preferredName: camperForm.preferredName.trim(),
          lastName: camperForm.lastName.trim() || undefined,
          bunk: camperForm.bunk.trim(),
          code: camperForm.code.trim(),
          camp: camperForm.camp.trim() || undefined,
          campDivision: camperForm.campDivision.trim() || undefined,
          grade: camperForm.grade.trim() || undefined,
          arrivalMethod: camperForm.arrivalMethod.trim() || undefined,
          dismissalMethod: camperForm.dismissalMethod.trim() || undefined,
          photoUrl: camperForm.photoUrl.trim() || undefined,
          allergyDetails: camperForm.allergyDetails.trim() || undefined,
          camperNotes: camperForm.camperNotes.trim() || undefined,
          lunchInfo: camperForm.lunchInfo.trim() || undefined,
          staffName: "Admin",
        });
      }
      setEditingCamper(null); setAddingCamper(false); setCamperError("");
    } catch (e: unknown) {
      setCamperError(e instanceof Error ? e.message : "Save failed");
    }
  };

  const showCamperForm = addingCamper || editingCamper;
  const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none";
  const lbl = "text-xs font-semibold text-slate-500 mb-1 block";

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings size={22} className="text-slate-700" />
          <h2 className="text-xl font-bold text-slate-900">Admin</h2>
          <button onClick={() => {
            if (confirm("Start new day?\n\nThis clears all today's live attendance (arrivals, bunk check-ins, dismissal status).\n\nDaily overrides, future plans, and attendance history are NOT deleted.")) {
              clearDailyState();
            }
          }}
            className="ml-auto flex items-center gap-1.5 text-sm bg-red-50 text-red-600 px-3 py-2 rounded-xl active:bg-red-100 font-semibold">
            <RotateCcw size={15} /> New Day
          </button>
        </div>

        <div className="flex gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5">
          {adminTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
              style={tab === t.id ? { backgroundColor: "#023B64", color: "#fff" } : { color: "#64748b" }}>
              {t.label}
              {t.id === "changes" && totalChanges > 0 && (
                <span className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{totalChanges}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Campers Tab ── */}
        {tab === "campers" && (
          <>
            <div className="relative">
              <Search size={17} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search name, group, code…"
                className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:outline-none text-sm bg-white"
                onFocus={e => (e.currentTarget.style.borderColor = "#023B64")}
                onBlur={e => (e.currentTarget.style.borderColor = "")} />
            </div>

            <p className="text-xs text-slate-400">{filtered.length} of {activeCampers.length} campers</p>

            <div className="space-y-2">
              {filtered.map(c => {
                const name = c.preferredName ? `${c.preferredName}${c.lastName ? " " + c.lastName : ""}` : c.name;
                return (
                  <button key={c._id} onClick={() => setSelected(c)}
                    className="w-full text-left bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 active:bg-slate-50">
                    <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm overflow-hidden"
                      style={{ backgroundColor: avatarBg(c.name) }}>
                      {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : (c.preferredName ?? c.name).charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm">{name}</span>
                        {c.hasAllergies && <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">ALLERGY</span>}
                        {c.dismissalMethod && <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">{c.dismissalMethod}</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{c.bunk} · #{c.code}</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ── Manage Tab ── */}
        {tab === "manage" && (
          <>
            <div className="flex items-center gap-2">
              <button onClick={openAddCamper}
                className="flex items-center gap-1.5 text-sm font-semibold text-white px-3 py-2 rounded-xl active:opacity-80"
                style={{ backgroundColor: "#023B64" }}>
                + Add Camper
              </button>
              <button onClick={() => setShowInactive(!showInactive)}
                className={`text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${showInactive ? "bg-amber-100 text-amber-700" : "bg-white text-slate-500 border border-slate-200"}`}>
                {showInactive ? `Inactive (${inactiveCampers.length})` : `Show Inactive (${inactiveCampers.length})`}
              </button>
            </div>

            <div className="relative">
              <Search size={17} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search name, group, code, camp…"
                className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:outline-none text-sm bg-white"
                onFocus={e => (e.currentTarget.style.borderColor = "#023B64")}
                onBlur={e => (e.currentTarget.style.borderColor = "")} />
            </div>

            <p className="text-xs text-slate-400">{filtered.length} {showInactive ? "inactive" : "active"} campers</p>

            <div className="space-y-2">
              {filtered.map(c => {
                const name = c.preferredName ? `${c.preferredName}${c.lastName ? " " + c.lastName : ""}` : c.name;
                const inactive = c.isActive === false;
                return (
                  <div key={c._id} className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${inactive ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm overflow-hidden"
                        style={{ backgroundColor: inactive ? "#94a3b8" : avatarBg(c.name) }}>
                        {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : (c.preferredName ?? c.name).charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm">{name}</span>
                          {inactive && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">Inactive</span>}
                          {c.hasAllergies && <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">ALLERGY</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{c.bunk} · #{c.code}{c.camp ? ` · ${c.camp}` : ""}</p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => openEditCamper(c)}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 active:bg-slate-200">
                          Edit
                        </button>
                        {inactive ? (
                          <button onClick={() => reactivateCamper({ id: c._id, staffName: "Admin" })}
                            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-green-100 text-green-700 active:bg-green-200">
                            Reactivate
                          </button>
                        ) : (
                          <button onClick={() => {
                            if (confirm(`Deactivate ${name}? They will be hidden from active views but records are preserved.`))
                              deactivateCamper({ id: c._id, staffName: "Admin" });
                          }}
                            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 active:bg-red-100">
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Changes Tab ── */}
        {tab === "changes" && (
          <AdminTodayChanges
            overrides={todayOverrides ?? []}
            futureOverrides={(upcomingOverrides ?? []).filter(o => o.date > today())}
            camperMap={camperMap}
            campers={campers}
            onSelectCamper={setSelected}
          />
        )}
      </div>

      {selected && <CamperDetailSheet camper={selected} onClose={() => setSelected(null)} staffName="Admin" isAdmin />}

      {/* Add / Edit Camper modal */}
      {showCamperForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setAddingCamper(false); setEditingCamper(null); }} />
          <div className="relative bg-white rounded-t-3xl overflow-auto max-h-[85vh]">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-slate-200 rounded-full" /></div>
            <div className="px-5 pt-2 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">{editingCamper ? "Edit Camper" : "Add Camper"}</h3>
                {editingCamper && (
                  <button onClick={async () => {
                    try {
                      await deleteCamper({ id: editingCamper._id, staffName: "Admin" });
                      setEditingCamper(null);
                    } catch (e: unknown) {
                      setCamperError(e instanceof Error ? e.message : "Delete failed");
                    }
                  }}
                    className="text-xs text-red-500 font-semibold px-3 py-1.5 rounded-lg active:bg-red-50">
                    Delete
                  </button>
                )}
              </div>

              {camperError && <p className="text-sm text-red-500 font-medium">{camperError}</p>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>First Name *</label>
                  <input value={camperForm.preferredName} onChange={e => setCamperForm({ ...camperForm, preferredName: e.target.value })}
                    className={inp} placeholder="First name" />
                </div>
                <div>
                  <label className={lbl}>Last Name</label>
                  <input value={camperForm.lastName} onChange={e => setCamperForm({ ...camperForm, lastName: e.target.value })}
                    className={inp} placeholder="Last name" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Bunk *</label>
                  <input value={camperForm.bunk} onChange={e => setCamperForm({ ...camperForm, bunk: e.target.value })}
                    className={inp} placeholder="e.g. Red" list="camper-bunk-list" />
                  <datalist id="camper-bunk-list">{structureBunks.map(b => <option key={b} value={b} />)}</datalist>
                </div>
                <div>
                  <label className={lbl}>Safety Code *</label>
                  <input value={camperForm.code} onChange={e => setCamperForm({ ...camperForm, code: e.target.value })}
                    className={`${inp} font-mono`} placeholder="e.g. 123" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Camp</label>
                  <input value={camperForm.camp} onChange={e => setCamperForm({ ...camperForm, camp: e.target.value })}
                    className={inp} placeholder="e.g. Kaleidoscope" list="camper-camp-list" />
                  <datalist id="camper-camp-list">{structureCamps.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className={lbl}>Division</label>
                  <input value={camperForm.campDivision} onChange={e => setCamperForm({ ...camperForm, campDivision: e.target.value })}
                    className={inp} placeholder="e.g. Lower" list="camper-div-list" />
                  <datalist id="camper-div-list">{structureDivisions.map(d => <option key={d} value={d} />)}</datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Grade</label>
                  <input value={camperForm.grade} onChange={e => setCamperForm({ ...camperForm, grade: e.target.value })}
                    className={inp} placeholder="e.g. 3rd" />
                </div>
                <div>
                  <label className={lbl}>Lunch Info</label>
                  <input value={camperForm.lunchInfo} onChange={e => setCamperForm({ ...camperForm, lunchInfo: e.target.value })}
                    className={inp} placeholder="Blank = buys lunch" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Arrival Method</label>
                  <input value={camperForm.arrivalMethod} onChange={e => setCamperForm({ ...camperForm, arrivalMethod: e.target.value })}
                    className={inp} placeholder="e.g. Carline" />
                </div>
                <div>
                  <label className={lbl}>Dismissal Method</label>
                  <input value={camperForm.dismissalMethod} onChange={e => setCamperForm({ ...camperForm, dismissalMethod: e.target.value })}
                    className={inp} placeholder="e.g. After Care" />
                </div>
              </div>

              <div>
                <label className={lbl}>Allergy Details</label>
                <input value={camperForm.allergyDetails} onChange={e => setCamperForm({ ...camperForm, allergyDetails: e.target.value })}
                  className={inp} placeholder="e.g. Peanut allergy — EpiPen in office" />
              </div>

              <div>
                <label className={lbl}>Camper Notes</label>
                <textarea value={camperForm.camperNotes} onChange={e => setCamperForm({ ...camperForm, camperNotes: e.target.value })}
                  className={`${inp} h-20 resize-none`} placeholder="Notes visible to counselors" />
              </div>

              <div>
                <label className={lbl}>Photo URL</label>
                <input value={camperForm.photoUrl} onChange={e => setCamperForm({ ...camperForm, photoUrl: e.target.value })}
                  className={inp} placeholder="https://..." />
              </div>

              <button onClick={handleSaveCamper}
                className="w-full py-3 text-sm font-bold text-white rounded-xl active:opacity-80"
                style={{ backgroundColor: "#023B64" }}>
                {editingCamper ? "Save Changes" : "Add Camper"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Admin Today's Changes ──────────────────────────────────────────────────

function AdminTodayChanges({ overrides, futureOverrides, camperMap, campers, onSelectCamper }: {
  overrides: Doc<"dailyOverrides">[];
  futureOverrides: Doc<"dailyOverrides">[];
  camperMap: Map<string, CamperDoc>;
  campers: CamperDoc[];
  onSelectCamper: (c: CamperDoc) => void;
}) {
  const upsertOverride = useMutation(api.dailyOverrides.upsert);
  const clearOne       = useMutation(api.dailyOverrides.clearOne);
  const [adding, setAdding] = useState(false);
  const [addCamperId, setAddCamperId] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = (camperId: string) => {
    setAddCamperId(camperId);
    setAdding(true);
    setAddSearch("");
  };

  const filteredCampers = addSearch.trim()
    ? campers.filter(c => {
        const s = addSearch.toLowerCase();
        const name = `${c.preferredName ?? c.name} ${c.lastName ?? ""}`.toLowerCase();
        return name.includes(s) || c.bunk.toLowerCase().includes(s) || c.code.includes(s);
      }).slice(0, 8)
    : [];

  return (
    <div className="space-y-4">
      {/* Add new override */}
      {!adding && (
        <div className="space-y-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={addSearch} onChange={e => setAddSearch(e.target.value)}
              placeholder="Search camper to add today's change…"
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none" />
          </div>
          {filteredCampers.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {filteredCampers.map(c => {
                const name = c.preferredName ? `${c.preferredName}${c.lastName ? " " + c.lastName : ""}` : c.name;
                return (
                  <button key={c._id} onClick={() => handleAdd(c._id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-slate-100 last:border-b-0 active:bg-slate-50">
                    <span className="text-sm font-medium text-slate-900">{name}</span>
                    <span className="text-xs text-slate-400">{c.bunk}</span>
                    <span className="ml-auto text-xs font-semibold text-[#023B64]">+ Add</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Adding form */}
      {adding && addCamperId && (() => {
        const c = camperMap.get(addCamperId);
        if (!c) return null;
        return <FlagEditor camper={c} staffName="Admin" onClose={() => setAdding(false)} />;
      })()}

      {/* Existing overrides */}
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{overrides.length} change{overrides.length !== 1 ? "s" : ""} today</p>

      {overrides.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
          No changes for today. Search a camper above to add one.
        </div>
      )}

      {overrides.map(o => {
        const c = camperMap.get(o.camperId);
        if (!c) return null;
        const name = c.preferredName ? `${c.preferredName}${c.lastName ? " " + c.lastName : ""}` : c.name;

        if (editingId === o._id) {
          return <FlagEditor key={o._id} camper={c} staffName="Admin" onClose={() => setEditingId(null)} />;
        }

        return (
          <div key={o._id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold overflow-hidden"
                style={{ backgroundColor: avatarBg(c.name) }}>
                {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : (c.preferredName ?? c.name).charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-slate-900 text-sm">{name}</span>
                <p className="text-xs text-slate-400">{c.bunk}</p>
              </div>
              <button onClick={() => setEditingId(o._id)}
                className="text-xs text-[#023B64] font-semibold px-2 py-1 rounded-lg active:bg-slate-50">
                Edit
              </button>
              <button onClick={() => { if (confirm(`Clear today's change for ${name}?`)) clearOne({ camperId: c._id, staffName: "Admin" }); }}
                className="text-xs text-red-400 font-semibold px-2 py-1 rounded-lg active:bg-red-50">
                Clear
              </button>
            </div>
            <div className="border-t border-slate-100 px-4 py-2.5 flex gap-1.5 flex-wrap">
              {o.isAbsent && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">Absent</span>}
              {o.lateDropoffTime && <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">Late: {fmtClock(o.lateDropoffTime)}</span>}
              {o.earlyPickupTime && <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">Early: {fmtClock(o.earlyPickupTime)}</span>}
              {o.afternoonDismissal && <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-full">Dismissal → {o.afternoonDismissal}</span>}
              {o.morningArrival && <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">Arrival → {o.morningArrival}</span>}
              {o.note && <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">{o.note}</span>}
              {!o.isAbsent && !o.lateDropoffTime && !o.earlyPickupTime && !o.afternoonDismissal && !o.morningArrival && !o.note && (
                <span className="text-xs text-slate-400">No changes set</span>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Future Changes ── */}
      {futureOverrides.length > 0 && (
        <>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">{futureOverrides.length} upcoming</p>
          {futureOverrides.map(o => {
            const c = camperMap.get(o.camperId);
            if (!c) return null;
            const name = c.preferredName ? `${c.preferredName}${c.lastName ? " " + c.lastName : ""}` : c.name;
            return (
              <div key={o._id} className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 text-sm">{name}</span>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{o.date}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{c.bunk}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {o.isAbsent && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">Absent</span>}
                  {o.lateDropoffTime && <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">Late: {fmtClock(o.lateDropoffTime)}</span>}
                  {o.earlyPickupTime && <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">Early: {fmtClock(o.earlyPickupTime)}</span>}
                  {o.afternoonDismissal && <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-full">Dismissal → {o.afternoonDismissal}</span>}
                  {o.morningArrival && <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">Arrival → {o.morningArrival}</span>}
                  {o.note && <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">{o.note}</span>}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ─── Period Management ────────────────────────────────────────────────────────

// Split a single full-name cell into first / last.
// Handles "First Last", "First Middle Last" (first token = first), and "Last, First".
function parseFullName(raw: string): { first: string; last: string } {
  const s = raw.trim();
  if (!s) return { first: "", last: "" };
  if (s.includes(",")) {
    const [last, first] = s.split(",").map(p => p.trim());
    return { first: first ?? "", last: last ?? "" };
  }
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

type PeriodTab = "classes" | "schedules" | "upload" | "history";

function PeriodManagement() {
  const periodClassList = useQuery(api.periodClasses.list);
  const campers = useQuery(api.campers.list);
  const staffList = useQuery(api.staff.list);
  const campStructureForPeriods = useQuery(api.campStructure.list);
  const allScheduleRecords = useQuery(api.periodScheduleRecords.getForCamper, "skip");
  const uploadHistory = useQuery(api.uploadBatches.list, { type: "period" });
  const createPeriodClass = useMutation(api.periodClasses.create);
  const updatePeriodClass = useMutation(api.periodClasses.update);
  const archivePeriodClass = useMutation(api.periodClasses.archive);
  const removePeriodClass = useMutation(api.periodClasses.remove);
  const assignStaffMut = useMutation(api.periodClasses.assignStaff);
  const getOrCreateClass = useMutation(api.periodClasses.getOrCreate);
  const assignSchedule = useMutation(api.periodScheduleRecords.assign);
  const endAssignment = useMutation(api.periodScheduleRecords.endAssignment);
  const removeScheduleRecord = useMutation(api.periodScheduleRecords.remove);
  const clearCamperSchedules = useMutation(api.periodScheduleRecords.clearForCamper);
  const clearAllSchedules = useMutation(api.periodScheduleRecords.clearAll);
  const clearEverything = useMutation(api.periodClasses.clearAll);
  const checkInMut = useMutation(api.periodAttendance.checkIn);
  const undoCheckInMut = useMutation(api.periodAttendance.undoCheckIn);
  const createBatch = useMutation(api.uploadBatches.create);

  const [tab, setTab] = useState<PeriodTab>("classes");
  const [dayType, setDayType] = useState<"MonThu" | "Friday">("MonThu");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [addingClass, setAddingClass] = useState(false);
  const [editingClass, setEditingClass] = useState<Doc<"periodClasses"> | null>(null);
  const [classForm, setClassForm] = useState({ period: "Period1", className: "", location: "", capacity: "", notes: "" });
  const [classError, setClassError] = useState("");
  const [assigningStaff, setAssigningStaff] = useState(false);

  // Upload state
  const [uploadStep, setUploadStep] = useState<"pick" | "map" | "preview" | null>(null);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: CsvRow[] } | null>(null);
  const [periodMapping, setPeriodMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);

  // Camper schedule state
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [selectedCamperId, setSelectedCamperId] = useState<string | null>(null);
  const selectedCamperSchedule = useQuery(api.periodScheduleRecords.getActiveForCamper,
    selectedCamperId ? { camperId: selectedCamperId as never, dayType } : "skip");
  const selectedCamperAttendance = useQuery(api.periodAttendance.getForCamperDate,
    selectedCamperId ? { camperId: selectedCamperId as never } : "skip");

  // Class roster state
  const selectedClassRoster = useQuery(api.periodScheduleRecords.getForClass,
    selectedClassId ? { periodClassId: selectedClassId as never } : "skip");
  const selectedClassAttendance = useQuery(api.periodAttendance.getForPeriodClassDate,
    selectedClassId ? { periodClassId: selectedClassId as never } : "skip");

  // Upper Camp roster derived from the camp structure: the ordered list of
  // "Upper Camp" division bunks, with each bunk's active campers grouped under it.
  const { upperCampers, upperBunkGroups } = useMemo(() => {
    const upperRows = (campStructureForPeriods ?? [])
      .filter(s => s.division === "Upper Camp" && s.isActive !== false)
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.bunk.localeCompare(b.bunk));
    const orderedBunks: string[] = [];
    const byBunk = new Map<string, CamperDoc[]>();
    for (const s of upperRows) {
      if (!byBunk.has(s.bunk)) { byBunk.set(s.bunk, []); orderedBunks.push(s.bunk); }
    }
    const flat: CamperDoc[] = [];
    for (const c of (campers ?? [])) {
      if (c.isActive === false || !byBunk.has(c.bunk)) continue;
      byBunk.get(c.bunk)!.push(c);
      flat.push(c);
    }
    for (const arr of byBunk.values()) arr.sort((a, b) => camperName(a).localeCompare(camperName(b)));
    const groups = orderedBunks
      .map(bunk => ({ bunk, campers: byBunk.get(bunk)! }))
      .filter(g => g.campers.length > 0);
    return { upperCampers: flat, upperBunkGroups: groups };
  }, [campers, campStructureForPeriods]);

  if (periodClassList === undefined || campers === undefined) return <Loading />;

  const camperMap = new Map<string, CamperDoc>();
  for (const c of campers) camperMap.set(c._id, c);
  const camperByName = new Map<string, CamperDoc>();
  for (const c of campers) {
    const full = `${(c.preferredName ?? c.name).toLowerCase()} ${(c.lastName ?? "").toLowerCase()}`.trim();
    camperByName.set(full, c);
    camperByName.set((c.preferredName ?? c.name).toLowerCase(), c);
    const bunkKey = `${full}::${c.bunk.toLowerCase()}`;
    camperByName.set(bunkKey, c);
  }

  // A class with no dayType is legacy Mon–Thu data.
  const dtOf = (c: { dayType?: string }) => (c.dayType === "Friday" ? "Friday" : "MonThu");
  const dayClasses = periodClassList.filter(c => dtOf(c) === dayType);
  const activeClasses = dayClasses.filter(c => showInactive || (c.isActive !== false && c.isArchived !== true));
  const periods = [...new Set(dayClasses.map(c => c.period))].sort();
  const filteredClasses = activeClasses.filter(c => {
    if (periodFilter !== "all" && c.period !== periodFilter) return false;
    if (q) {
      const low = q.toLowerCase();
      if (!c.className.toLowerCase().includes(low) && !c.period.toLowerCase().includes(low)) return false;
    }
    return true;
  });

  const PERIOD_UPLOAD_FIELDS = [
    { key: "fullName", label: "Full Name", required: false },
    { key: "preferredName", label: "Preferred Name", required: false },
    { key: "lastName", label: "Last Name", required: false },
    { key: "bunk", label: "Bunk", required: false },
    { key: "period1", label: "Period 1", required: false },
    { key: "period2", label: "Period 2", required: false },
    { key: "period3", label: "Period 3", required: false },
    { key: "period4", label: "Period 4", required: false },
    { key: "period5", label: "Period 5", required: false },
    { key: "period6", label: "Period 6", required: false },
    { key: "period7", label: "Period 7", required: false },
  ] as const;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCsv(ev.target?.result as string);
      setCsvData(parsed);
      setUploadResult(null);
      // Common header aliases per field (normalized: lowercase, alphanumerics only).
      const ALIASES: Record<string, string[]> = {
        fullName: ["fullname", "name", "campername", "camper", "studentname", "student"],
        preferredName: ["preferredname", "firstname", "first", "nickname"],
        lastName: ["lastname", "last", "surname"],
        bunk: ["bunk", "group", "cabin"],
      };
      const autoMap: Record<string, string> = {};
      for (const field of PERIOD_UPLOAD_FIELDS) {
        const aliases = ALIASES[field.key] ?? [field.key.toLowerCase(), field.label.toLowerCase().replace(/[^a-z0-9]/g, "")];
        const match = parsed.headers.find(h => aliases.includes(h.toLowerCase().replace(/[^a-z0-9]/g, "")));
        if (match) autoMap[field.key] = match;
      }
      // Don't claim a plain "Name" column as full name if separate first/last were found.
      if (autoMap.fullName && autoMap.preferredName && autoMap.lastName) delete autoMap.fullName;
      setPeriodMapping(autoMap);
      setUploadStep("map");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Need a way to identify the camper: either a Full Name column, or a Preferred Name column.
  const periodRequiredMapped = !!periodMapping.fullName || !!periodMapping.preferredName;

  const handleUpload = async () => {
    if (!csvData) return;
    setUploading(true);
    const errors: string[] = [];
    let created = 0;

    for (let i = 0; i < csvData.rows.length; i++) {
      const row = csvData.rows[i];
      let firstName = periodMapping.preferredName ? (row[periodMapping.preferredName]?.trim() ?? "") : "";
      let lastName = periodMapping.lastName ? (row[periodMapping.lastName]?.trim() ?? "") : "";
      const bunk = periodMapping.bunk ? (row[periodMapping.bunk]?.trim() ?? "") : "";

      // Single "Full Name" column: parse into first/last (separate columns win if also present).
      const rawFull = periodMapping.fullName ? (row[periodMapping.fullName]?.trim() ?? "") : "";
      if (rawFull) {
        const parsed = parseFullName(rawFull);
        if (!firstName) firstName = parsed.first;
        if (!lastName) lastName = parsed.last;
      }

      const display = `${firstName} ${lastName}`.trim() || rawFull;
      const searchKey = `${firstName} ${lastName}`.trim().toLowerCase();
      let camper = camperByName.get(searchKey)
        ?? (rawFull ? camperByName.get(rawFull.toLowerCase()) : undefined)
        ?? camperByName.get(firstName.toLowerCase());
      if (!camper && bunk) {
        camper = camperByName.get(`${searchKey}::${bunk.toLowerCase()}`)
          ?? campers.find(c => (c.preferredName ?? c.name).toLowerCase() === firstName.toLowerCase() && (c.lastName ?? "").toLowerCase() === lastName.toLowerCase() && c.bunk === bunk);
      }

      if (!camper) { errors.push(`Row ${i + 2}: "${display}" not found`); continue; }
      if (camper.isActive === false) { errors.push(`Row ${i + 2}: "${display}" is inactive — skipped`); continue; }

      for (let p = 1; p <= 7; p++) {
        const key = `period${p}`;
        if (periodMapping[key]) {
          const className = row[periodMapping[key]]?.trim();
          if (className) {
            try {
              const classId = await getOrCreateClass({ period: `Period${p}`, className, dayType });
              await assignSchedule({ camperId: camper._id, period: `Period${p}`, periodClassId: classId, classNameSnapshot: className, dayType, source: "upload" });
              created++;
            } catch { errors.push(`Row ${i + 2}: failed to assign Period ${p}`); }
          }
        }
      }
    }

    if (created > 0) {
      await createBatch({ type: "period", rowsImported: created, rowsSkipped: errors.length, warnings: 0, errors: errors.length });
    }
    setUploadResult({ created, updated: 0, errors });
    setUploading(false);
  };

  const rosterCampers = (selectedClassRoster ?? []).map(r => camperMap.get(r.camperId as string)).filter(Boolean) as CamperDoc[];

  const periodTabs: { id: PeriodTab; label: string }[] = [
    { id: "classes", label: "Classes" },
    { id: "schedules", label: "Schedules" },
    { id: "upload", label: "Upload" },
    { id: "history", label: "History" },
  ];

  const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none";
  const lbl = "text-xs font-semibold text-slate-500 mb-1 block";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar size={22} className="text-slate-700" />
        <h2 className="text-xl font-bold text-slate-900">Periods</h2>
        <span className="text-sm text-slate-400 ml-1">{dayClasses.length} classes</span>
      </div>

      {/* Mon–Thu vs Friday schedule selector — scopes every tab below. */}
      <div className="flex gap-1.5 bg-slate-100 rounded-2xl p-1.5">
        {([
          { id: "MonThu", label: "Mon–Thu" },
          { id: "Friday", label: "Friday" },
        ] as const).map(d => (
          <button key={d.id} onClick={() => { setDayType(d.id); setSelectedClassId(null); setSelectedCamperId(null); setPeriodFilter("all"); }}
            className="flex-1 py-2 rounded-xl text-sm font-bold transition-colors"
            style={dayType === d.id ? { backgroundColor: "#F59E0B", color: "#fff" } : { color: "#64748b" }}>
            {d.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5">
        {periodTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={tab === t.id ? { backgroundColor: "#023B64", color: "#fff" } : { color: "#64748b" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Classes Tab ── */}
      {tab === "classes" && (
        <>
          <div className="flex items-center gap-2">
            <button onClick={() => { setAddingClass(true); setEditingClass(null); setClassForm({ period: "Period1", className: "", location: "", capacity: "", notes: "" }); setClassError(""); }}
              className="text-xs font-semibold text-white px-3 py-2 rounded-xl" style={{ backgroundColor: "#023B64" }}>+ Add Class</button>
            <button onClick={() => setShowInactive(!showInactive)}
              className={`text-xs font-semibold px-3 py-2 rounded-xl ${showInactive ? "bg-amber-100 text-amber-700" : "bg-white text-slate-500 border border-slate-200"}`}>
              {showInactive ? "Active Only" : "Show Inactive"}</button>
            <button onClick={() => { if (confirm("Clear ALL period schedule assignments? Class definitions will be kept.")) clearAllSchedules(); }}
              className="ml-auto text-xs font-semibold px-3 py-2 rounded-xl bg-red-50 text-red-500 active:bg-red-100">
              Clear Schedules</button>
            <button onClick={async () => { if (confirm("DELETE everything? All period classes, all schedule assignments, and all attendance records will be permanently removed.")) { await clearEverything(); } }}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-red-100 text-red-600 active:bg-red-200">
              Delete All</button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => setPeriodFilter("all")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 ${periodFilter === "all" ? "text-white" : "bg-white text-slate-500 border border-slate-200"}`} style={periodFilter === "all" ? { backgroundColor: "#023B64" } : undefined}>All</button>
            {periods.map(p => <button key={p} onClick={() => setPeriodFilter(p)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 ${periodFilter === p ? "text-white" : "bg-white text-slate-500 border border-slate-200"}`} style={periodFilter === p ? { backgroundColor: "#023B64" } : undefined}>{PERIOD_LABEL[p] ?? p}</button>)}
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-3 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search class name…" className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none" />
          </div>

          <div className="space-y-2">
            {filteredClasses.map(cl => {
              const staffNames = (cl.assignedStaffIds ?? []).map(id => (staffList ?? []).find(s => s._id === id)?.name).filter(Boolean);
              return (
                <div key={cl._id} className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${cl.isArchived ? "opacity-50" : ""}`}>
                  <button onClick={() => { setSelectedClassId(cl._id); setAssigningStaff(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ backgroundColor: "#e0f2fe", color: "#023B64" }}>
                      {(PERIOD_LABEL[cl.period] ?? cl.period).replace("Period ", "P")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm">{cl.className}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs text-slate-500">{PERIOD_LABEL[cl.period] ?? cl.period}</span>
                        {cl.location && <><span className="text-xs text-slate-300">·</span><span className="text-xs text-slate-500">{cl.location}</span></>}
                        {staffNames.length > 0 ? <span className="text-[10px] text-blue-600 font-semibold">· {staffNames.join(", ")}</span> : <span className="text-[10px] text-amber-500 font-semibold">· No staff</span>}
                        {cl.isArchived && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">Archived</span>}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                  </button>
                </div>
              );
            })}
            {filteredClasses.length === 0 && <p className="text-center text-slate-400 py-8">No classes found.</p>}
          </div>
        </>
      )}

      {/* ── Class Roster (when a class is selected) ── */}
      {tab === "classes" && selectedClassId && (() => {
        const cl = periodClassList.find(c => c._id === selectedClassId);
        if (!cl) return null;
        const staffNames = (cl.assignedStaffIds ?? []).map(id => (staffList ?? []).find(s => s._id === id)?.name).filter(Boolean);
        return (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedClassId(null)} />
            <div className="relative bg-white rounded-t-3xl overflow-auto max-h-[85vh]">
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-slate-200 rounded-full" /></div>
              <div className="px-5 pt-2 pb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{cl.className}</h3>
                    <p className="text-xs text-slate-500">{PERIOD_LABEL[cl.period] ?? cl.period}{cl.location ? ` · ${cl.location}` : ""}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => { setEditingClass(cl); setClassForm({ period: cl.period, className: cl.className, location: cl.location ?? "", capacity: cl.capacity?.toString() ?? "", notes: cl.notes ?? "" }); setClassError(""); setSelectedClassId(null); }}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600">Edit</button>
                    <button onClick={() => setAssigningStaff(!assigningStaff)}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600">{assigningStaff ? "Done" : "Staff"}</button>
                  </div>
                </div>

                {staffNames.length > 0 && <div className="flex gap-1.5 flex-wrap">{staffNames.map((n, i) => <span key={i} className="text-xs font-semibold px-2 py-1 rounded-lg bg-blue-50 text-blue-700">{n}</span>)}</div>}

                {assigningStaff && (
                  <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-500">Assign staff:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(staffList ?? []).filter(s => s.isActive !== false).map(s => {
                        const assigned = (cl.assignedStaffIds ?? []).includes(s._id);
                        return <button key={s._id} onClick={() => {
                          const ids = assigned ? (cl.assignedStaffIds ?? []).filter(id => id !== s._id) : [...(cl.assignedStaffIds ?? []), s._id];
                          assignStaffMut({ id: cl._id, staffIds: ids });
                        }} className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg ${assigned ? "bg-blue-500 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>{s.name}</button>;
                      })}
                    </div>
                  </div>
                )}

                <p className="text-xs text-slate-400">{rosterCampers.length} campers</p>
                <div className="space-y-2">
                  {rosterCampers.map(c => {
                    const att = (selectedClassAttendance ?? []).find(a => a.camperId === c._id);
                    const checked = att?.checkedIn === true;
                    const presence = getCampusPresence(c);
                    return (
                      <div key={c._id} className="bg-white rounded-2xl border border-slate-200 flex items-center gap-3 px-4 py-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: avatarBg(c.name) }}>
                          {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : (c.preferredName ?? c.name).charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 text-sm">{camperName(c)}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${presence.status === "Here" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{presence.label}</span>
                          </div>
                          <p className="text-xs text-slate-500">{c.bunk}{checked && att?.checkedInAt ? ` · ${fmt(att.checkedInAt)}` : ""}</p>
                        </div>
                        <button onClick={async () => { if (checked && att) await undoCheckInMut({ id: att._id }); else await checkInMut({ camperId: c._id, period: cl.period, className: cl.className, periodClassId: cl._id, staffId: "Admin" }); }}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${checked ? "bg-green-500 text-white" : "bg-slate-100 active:bg-slate-200"}`}>
                          {checked && <Check size={18} strokeWidth={3} />}
                        </button>
                      </div>
                    );
                  })}
                  {rosterCampers.length === 0 && <p className="text-center text-slate-400 py-6">No campers in this class.</p>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Schedules Tab ── */}
      {tab === "schedules" && (
        <>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-3 text-slate-400" />
            <input value={scheduleSearch} onChange={e => setScheduleSearch(e.target.value)} placeholder="Search Upper camper…" className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none" />
          </div>
          {selectedCamperId ? (() => {
            const c = camperMap.get(selectedCamperId);
            if (!c) return null;
            const presence = getCampusPresence(c);
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedCamperId(null)} className="text-sm text-slate-500 flex items-center gap-1">← Back</button>
                  <button onClick={() => { if (confirm("Clear all period assignments for this camper?")) { clearCamperSchedules({ camperId: selectedCamperId as never }); } }}
                    className="ml-auto text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 active:bg-red-100">Clear All</button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: avatarBg(c.name) }}>
                    {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : (c.preferredName ?? c.name).charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{camperName(c)}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-slate-500">{c.bunk}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${presence.status === "Here" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{presence.label}</span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 px-1">Editing the <span className="font-semibold">{dayType === "Friday" ? "Friday" : "Mon–Thu"}</span> schedule · pick a class to move {c.preferredName ?? c.name}.</p>
                <div className="space-y-2">
                  {[1,2,3,4,5,6,7].map(p => {
                    const period = `Period${p}`;
                    const sched = (selectedCamperSchedule ?? []).find(s => s.period === period);
                    const att = (selectedCamperAttendance ?? []).find(a => a.period === period);
                    const periodOptions = dayClasses
                      .filter(cl => cl.period === period && cl.isActive !== false && cl.isArchived !== true)
                      .sort((a, b) => a.className.localeCompare(b.className));
                    return (
                      <div key={p} className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ backgroundColor: "#e0f2fe", color: "#023B64" }}>P{p}</div>
                        <div className="flex-1 min-w-0">
                          <select
                            value={sched?.periodClassId ?? ""}
                            onChange={async (e) => {
                              const val = e.target.value;
                              if (!val) { if (sched) await removeScheduleRecord({ id: sched._id }); return; }
                              if (val === sched?.periodClassId) return;
                              const cl = periodOptions.find(o => o._id === val);
                              if (!cl) return;
                              await assignSchedule({ camperId: c._id, period, periodClassId: cl._id, classNameSnapshot: cl.className, dayType });
                            }}
                            className="w-full text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none">
                            <option value="">— None —</option>
                            {/* Keep a stale assignment selectable even if its class was archived/removed. */}
                            {sched && !periodOptions.some(o => o._id === sched.periodClassId) && (
                              <option value={sched.periodClassId}>{sched.classNameSnapshot}</option>
                            )}
                            {periodOptions.map(o => (
                              <option key={o._id} value={o._id}>{o.className}{o.location ? ` (${o.location})` : ""}</option>
                            ))}
                          </select>
                          {att?.checkedIn && <p className="text-[10px] text-green-600 mt-0.5">Checked in {att.checkedInAt ? fmt(att.checkedInAt) : ""}</p>}
                        </div>
                        {sched && (att?.checkedIn
                          ? <Check size={16} className="text-green-500 flex-shrink-0" />
                          : <span className="text-[10px] text-slate-400 flex-shrink-0">Not in</span>)}
                      </div>
                    );
                  })}
                  {periods.length === 0 && (
                    <p className="text-center text-xs text-slate-400 py-3">No classes defined for the {dayType === "Friday" ? "Friday" : "Mon–Thu"} schedule yet. Add classes in the Classes tab first.</p>
                  )}
                </div>
              </div>
            );
          })() : (
            <div className="space-y-4">
              {(() => {
                const s = scheduleSearch.trim().toLowerCase();
                const groups = upperBunkGroups
                  .map(g => ({
                    bunk: g.bunk,
                    campers: s ? g.campers.filter(c => camperName(c).toLowerCase().includes(s) || g.bunk.toLowerCase().includes(s)) : g.campers,
                  }))
                  .filter(g => g.campers.length > 0);
                return groups.map(g => (
                  <div key={g.bunk} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{g.bunk}</p>
                      <span className="text-[10px] text-slate-400">{g.campers.length}</span>
                    </div>
                    {g.campers.map(c => (
                      <button key={c._id} onClick={() => setSelectedCamperId(c._id)}
                        className="w-full text-left bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 active:bg-slate-50">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: avatarBg(c.name) }}>
                          {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : (c.preferredName ?? c.name).charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm">{camperName(c)}</p>
                          <p className="text-xs text-slate-500">{c.bunk}</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </button>
                    ))}
                  </div>
                ));
              })()}
              {upperCampers.length === 0 && <p className="text-center text-slate-400 py-8">No Upper Camp campers found.</p>}
            </div>
          )}
        </>
      )}

      {/* ── Upload Tab ── */}
      {tab === "upload" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 flex items-center gap-2 border-b border-amber-100" style={{ backgroundColor: "#FEF3C7" }}>
            <span className="text-xs font-bold" style={{ color: "#B45309" }}>
              Uploading to: {dayType === "Friday" ? "Friday" : "Mon–Thu"} schedule
            </span>
            <span className="text-[11px] text-amber-700/70 ml-auto">switch above</span>
          </div>
          {(!uploadStep || uploadStep === "pick") && (
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">Upload Upper Camp period schedule</p>
                <p className="text-xs text-slate-400 mt-1">CSV: a Full Name column (or separate First/Last), optional Bunk, and Period 1–7. Friday may use fewer periods — just map the columns present.</p>
              </div>
              <label className="inline-block text-xs font-semibold text-white px-3 py-2 rounded-xl cursor-pointer active:opacity-80"
                style={{ backgroundColor: "#023B64" }}>
                Choose CSV
                <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
              </label>
            </div>
          )}

          {uploadStep === "map" && csvData && (
            <div className="divide-y divide-slate-100">
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-sm font-semibold text-slate-700">{csvData.rows.length} rows · {csvData.headers.length} columns</p>
                <p className="text-xs text-slate-400 mt-0.5">Map CSV columns to period fields</p>
              </div>
              {PERIOD_UPLOAD_FIELDS.map(field => (
                <div key={field.key} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-900">{field.label}</span>
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </div>
                  <select value={periodMapping[field.key] ?? ""}
                    onChange={e => setPeriodMapping({ ...periodMapping, [field.key]: e.target.value })}
                    className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white w-40">
                    <option value="">— skip —</option>
                    {csvData.headers.map((h, hi) => <option key={hi} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
              <div className="px-4 py-3 flex gap-3">
                <button onClick={() => setUploadStep("pick")} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl">Back</button>
                <button onClick={() => setUploadStep("preview")} disabled={!periodRequiredMapped}
                  className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50" style={{ backgroundColor: "#023B64" }}>
                  Preview
                </button>
              </div>
            </div>
          )}

          {uploadStep === "preview" && csvData && (
            <div className="divide-y divide-slate-100">
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-sm font-semibold text-slate-700">Preview · {csvData.rows.length} campers</p>
              </div>
              {csvData.rows.slice(0, 5).map((row, i) => {
                const name = (periodMapping.fullName ? (row[periodMapping.fullName]?.trim() ?? "") : "")
                  || `${row[periodMapping.preferredName]?.trim() ?? ""} ${row[periodMapping.lastName]?.trim() ?? ""}`.trim();
                const periods = [];
                for (let p = 1; p <= 7; p++) { const k = `period${p}`; if (periodMapping[k]) { const v = row[periodMapping[k]]?.trim(); if (v) periods.push(`P${p}: ${v}`); } }
                return (
                  <div key={i} className="px-4 py-2">
                    <p className="text-sm font-semibold text-slate-900">{name || "—"}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{periods.join(" · ") || "No periods mapped"}</p>
                  </div>
                );
              })}
              {csvData.rows.length > 5 && <div className="px-4 py-2 text-xs text-slate-400">…and {csvData.rows.length - 5} more</div>}
              <div className="px-4 py-3 flex gap-3">
                <button onClick={() => setUploadStep("map")} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl">Back</button>
                <button onClick={handleUpload} disabled={uploading}
                  className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50" style={{ backgroundColor: "#023B64" }}>
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </div>
              {uploadResult && (
                <div className={`mx-4 mb-3 rounded-xl p-3 text-sm ${uploadResult.errors.length > 0 ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
                  <p className="font-semibold">{uploadResult.created} created, {uploadResult.updated} updated</p>
                  {uploadResult.errors.map((e, i) => <p key={i} className="text-xs text-amber-700 mt-1">{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── History Tab ── */}
      {tab === "history" && (
        <div className="space-y-2">
          {(uploadHistory ?? []).length === 0 && <p className="text-center text-slate-400 py-8">No upload history yet.</p>}
          {(uploadHistory ?? []).sort((a, b) => b.uploadedAt - a.uploadedAt).map(b => (
            <div key={b._id} className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{b.filename ?? "Period Upload"}</span>
                <span className="text-xs text-slate-400">{new Date(b.uploadedAt).toLocaleString()}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{b.rowsImported ?? 0} imported · {b.rowsSkipped ?? 0} skipped · {b.errors ?? 0} errors</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Add/Edit Class Modal ── */}
      {(addingClass || editingClass) && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setAddingClass(false); setEditingClass(null); }} />
          <div className="relative bg-white rounded-t-3xl overflow-auto max-h-[85vh]">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-slate-200 rounded-full" /></div>
            <div className="px-5 pt-2 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">{editingClass ? "Edit Class" : "Add Class"}</h3>
                {editingClass && (
                  <div className="flex gap-2">
                    <button onClick={async () => { try { await archivePeriodClass({ id: editingClass._id }); setEditingClass(null); } catch (e: unknown) { setClassError(e instanceof Error ? e.message : "Failed"); } }}
                      className="text-xs text-amber-600 font-semibold px-3 py-1.5 rounded-lg active:bg-amber-50">Archive</button>
                    <button onClick={async () => { try { await removePeriodClass({ id: editingClass._id }); setEditingClass(null); } catch (e: unknown) { setClassError(e instanceof Error ? e.message : "Failed"); } }}
                      className="text-xs text-red-500 font-semibold px-3 py-1.5 rounded-lg active:bg-red-50">Delete</button>
                  </div>
                )}
              </div>
              {classError && <p className="text-sm text-red-500 font-medium">{classError}</p>}
              <div>
                <label className={lbl}>Period *</label>
                <select value={classForm.period} onChange={e => setClassForm({ ...classForm, period: e.target.value })} className={`${inp} bg-white`} disabled={!!editingClass}>
                  {[1,2,3,4,5,6,7].map(p => <option key={p} value={`Period${p}`}>Period {p}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Class Name *</label>
                <input value={classForm.className} onChange={e => setClassForm({ ...classForm, className: e.target.value })} className={inp} placeholder="e.g. Art" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Location</label><input value={classForm.location} onChange={e => setClassForm({ ...classForm, location: e.target.value })} className={inp} placeholder="e.g. Room 3" /></div>
                <div><label className={lbl}>Capacity</label><input value={classForm.capacity} onChange={e => setClassForm({ ...classForm, capacity: e.target.value.replace(/\D/g, "") })} className={`${inp} font-mono`} placeholder="e.g. 20" /></div>
              </div>
              <div><label className={lbl}>Notes</label><textarea value={classForm.notes} onChange={e => setClassForm({ ...classForm, notes: e.target.value })} className={`${inp} h-16 resize-none`} /></div>
              <button onClick={async () => {
                if (!classForm.className.trim()) { setClassError("Class name is required"); return; }
                try {
                  if (editingClass) { await updatePeriodClass({ id: editingClass._id, className: classForm.className.trim(), location: classForm.location.trim() || undefined, capacity: classForm.capacity ? parseInt(classForm.capacity) : undefined, notes: classForm.notes.trim() || undefined }); }
                  else { await createPeriodClass({ period: classForm.period, className: classForm.className.trim(), dayType, location: classForm.location.trim() || undefined, capacity: classForm.capacity ? parseInt(classForm.capacity) : undefined, notes: classForm.notes.trim() || undefined }); }
                  setAddingClass(false); setEditingClass(null); setClassError("");
                } catch (e: unknown) { setClassError(e instanceof Error ? e.message : "Save failed"); }
              }} className="w-full py-3 text-sm font-bold text-white rounded-xl" style={{ backgroundColor: "#023B64" }}>
                {editingClass ? "Save Changes" : "Add Class"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Track Management (Middle Camp) ──────────────────────────────────────────
type TrackTab = "tracks" | "campers" | "upload";

function TrackManagement() {
  const trackList = useQuery(api.tracks.list);
  const campers = useQuery(api.campers.list);
  const staffList = useQuery(api.staff.list);
  const campStructure = useQuery(api.campStructure.list);
  const createTrack = useMutation(api.tracks.create);
  const updateTrack = useMutation(api.tracks.update);
  const removeTrack = useMutation(api.tracks.remove);
  const assignTrackStaff = useMutation(api.tracks.assignStaff);
  const getOrCreateTrack = useMutation(api.tracks.getOrCreate);
  const setCamperTrack = useMutation(api.tracks.setCamperTrack);
  const clearAllTracks = useMutation(api.tracks.clearAllCamperTracks);
  const createBatch = useMutation(api.uploadBatches.create);

  const [tab, setTab] = useState<TrackTab>("tracks");
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [addingTrack, setAddingTrack] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Doc<"tracks"> | null>(null);
  const [trackForm, setTrackForm] = useState({ name: "", location: "", notes: "" });
  const [trackError, setTrackError] = useState("");
  const [assigningStaff, setAssigningStaff] = useState(false);
  const [search, setSearch] = useState("");

  const [uploadStep, setUploadStep] = useState<"pick" | "map" | "preview" | null>(null);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: CsvRow[] } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ created: number; errors: string[] } | null>(null);

  if (trackList === undefined || campers === undefined) return <Loading />;

  // Middle Camp campers grouped by bunk, ordered by the structure.
  const midRows = (campStructure ?? [])
    .filter(s => s.division === "Middle Camp" && s.isActive !== false)
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.bunk.localeCompare(b.bunk));
  const midBunks: string[] = [];
  const midBunkSet = new Set<string>();
  for (const s of midRows) if (!midBunkSet.has(s.bunk)) { midBunkSet.add(s.bunk); midBunks.push(s.bunk); }
  const middleCampers = campers.filter(c => c.isActive !== false && midBunkSet.has(c.bunk));

  const camperByName = new Map<string, CamperDoc>();
  for (const c of campers) {
    const full = `${(c.preferredName ?? c.name).toLowerCase()} ${(c.lastName ?? "").toLowerCase()}`.trim();
    camperByName.set(full, c);
    camperByName.set((c.preferredName ?? c.name).toLowerCase(), c);
  }

  const tracksSorted = [...trackList].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name));
  const trackCounts = new Map<string, number>();
  for (const c of middleCampers) if (c.track) trackCounts.set(c.track, (trackCounts.get(c.track) ?? 0) + 1);

  const TRACK_UPLOAD_FIELDS = [
    { key: "fullName", label: "Full Name", required: false },
    { key: "preferredName", label: "First Name", required: false },
    { key: "lastName", label: "Last Name", required: false },
    { key: "track", label: "Track", required: true },
  ] as const;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCsv(ev.target?.result as string);
      setCsvData(parsed);
      setUploadResult(null);
      const aliases: Record<string, string[]> = {
        fullName: ["fullname", "name", "campername", "camper", "studentname"],
        preferredName: ["preferredname", "firstname", "first"],
        lastName: ["lastname", "last", "surname"],
        track: ["track", "group", "trackname"],
      };
      const autoMap: Record<string, string> = {};
      for (const field of TRACK_UPLOAD_FIELDS) {
        const al = aliases[field.key] ?? [field.key.toLowerCase()];
        const match = parsed.headers.find(h => al.includes(h.toLowerCase().replace(/[^a-z0-9]/g, "")));
        if (match) autoMap[field.key] = match;
      }
      if (autoMap.fullName && autoMap.preferredName && autoMap.lastName) delete autoMap.fullName;
      setMapping(autoMap);
      setUploadStep("map");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const requiredMapped = !!mapping.track && (!!mapping.fullName || !!mapping.preferredName);

  const handleUpload = async () => {
    if (!csvData) return;
    setUploading(true);
    const errors: string[] = [];
    let created = 0;
    for (let i = 0; i < csvData.rows.length; i++) {
      const row = csvData.rows[i];
      let firstName = mapping.preferredName ? (row[mapping.preferredName]?.trim() ?? "") : "";
      let lastName = mapping.lastName ? (row[mapping.lastName]?.trim() ?? "") : "";
      const rawFull = mapping.fullName ? (row[mapping.fullName]?.trim() ?? "") : "";
      if (rawFull) { const p = parseFullName(rawFull); if (!firstName) firstName = p.first; if (!lastName) lastName = p.last; }
      const trackName = mapping.track ? (row[mapping.track]?.trim() ?? "") : "";
      const display = `${firstName} ${lastName}`.trim() || rawFull;
      if (!trackName) { errors.push(`Row ${i + 2}: "${display}" has no track`); continue; }
      const key = `${firstName} ${lastName}`.trim().toLowerCase();
      const camper = camperByName.get(key) ?? (rawFull ? camperByName.get(rawFull.toLowerCase()) : undefined) ?? camperByName.get(firstName.toLowerCase());
      if (!camper) { errors.push(`Row ${i + 2}: "${display}" not found`); continue; }
      try {
        await getOrCreateTrack({ name: trackName });
        await setCamperTrack({ camperId: camper._id, track: trackName });
        created++;
      } catch { errors.push(`Row ${i + 2}: failed to assign ${trackName}`); }
    }
    if (created > 0) await createBatch({ type: "track", rowsImported: created, rowsSkipped: errors.length, warnings: 0, errors: errors.length });
    setUploadResult({ created, errors });
    setUploading(false);
  };

  const filteredCampers = middleCampers.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return camperName(c).toLowerCase().includes(s) || c.bunk.toLowerCase().includes(s) || (c.track ?? "").toLowerCase().includes(s);
  });

  const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none";
  const lbl = "text-xs font-semibold text-slate-500 mb-1 block";
  const trackOptions = tracksSorted.filter(t => t.isActive !== false);
  const selectedTrack = trackList.find(t => t._id === selectedTrackId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Route size={22} className="text-slate-700" />
        <h2 className="text-xl font-bold text-slate-900">Tracks</h2>
        <span className="text-sm text-slate-400 ml-1">{trackList.length} tracks · {middleCampers.length} Middle campers</span>
      </div>

      <div className="flex gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5">
        {([{ id: "tracks", label: "Tracks" }, { id: "campers", label: "Campers" }, { id: "upload", label: "Upload" }] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={tab === t.id ? { backgroundColor: "#023B64", color: "#fff" } : { color: "#64748b" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tracks tab ── */}
      {tab === "tracks" && (
        <>
          <div className="flex items-center gap-2">
            <button onClick={() => { setAddingTrack(true); setEditingTrack(null); setTrackForm({ name: "", location: "", notes: "" }); setTrackError(""); }}
              className="text-xs font-semibold text-white px-3 py-2 rounded-xl" style={{ backgroundColor: "#023B64" }}>+ Add Track</button>
            <button onClick={() => { if (confirm("Clear every camper's track assignment? Track definitions are kept.")) clearAllTracks(); }}
              className="ml-auto text-xs font-semibold px-3 py-2 rounded-xl bg-red-50 text-red-500 active:bg-red-100">Clear Assignments</button>
          </div>
          <div className="space-y-2">
            {tracksSorted.map(t => {
              const staffNames = (t.assignedStaffIds ?? []).map(id => (staffList ?? []).find(s => s._id === id)?.name).filter(Boolean);
              return (
                <button key={t._id} onClick={() => { setSelectedTrackId(t._id); setAssigningStaff(false); }}
                  className={`w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3 active:bg-slate-50 ${t.isActive === false ? "opacity-50" : ""}`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#e0f2fe", color: "#023B64" }}><Route size={18} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-500">{trackCounts.get(t.name) ?? 0} campers</span>
                      {t.location && <><span className="text-xs text-slate-300">·</span><span className="text-xs text-slate-500">{t.location}</span></>}
                      {staffNames.length > 0 ? <span className="text-[10px] text-blue-600 font-semibold">· {staffNames.join(", ")}</span> : <span className="text-[10px] text-amber-500 font-semibold">· No staff</span>}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
              );
            })}
            {tracksSorted.length === 0 && <p className="text-center text-slate-400 py-8">No tracks yet. Add one or upload a track sheet.</p>}
          </div>
        </>
      )}

      {/* ── Track detail / attendance (modal) ── */}
      {selectedTrack && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedTrackId(null)} />
          <div className="relative bg-white rounded-t-3xl overflow-auto max-h-[85vh]">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-slate-200 rounded-full" /></div>
            <div className="px-5 pt-2 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedTrack.name}</h3>
                  <p className="text-xs text-slate-500">{trackCounts.get(selectedTrack.name) ?? 0} campers{selectedTrack.location ? ` · ${selectedTrack.location}` : ""}</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => { setEditingTrack(selectedTrack); setTrackForm({ name: selectedTrack.name, location: selectedTrack.location ?? "", notes: selectedTrack.notes ?? "" }); setTrackError(""); setSelectedTrackId(null); }}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600">Edit</button>
                  <button onClick={() => setAssigningStaff(!assigningStaff)}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600">{assigningStaff ? "Done" : "Staff"}</button>
                </div>
              </div>
              {assigningStaff && (
                <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-500">Assign Middle Camp staff:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(staffList ?? []).filter(s => s.isActive !== false).map(s => {
                      const assigned = (selectedTrack.assignedStaffIds ?? []).includes(s._id);
                      return <button key={s._id} onClick={() => {
                        const ids = assigned ? (selectedTrack.assignedStaffIds ?? []).filter(id => id !== s._id) : [...(selectedTrack.assignedStaffIds ?? []), s._id];
                        assignTrackStaff({ id: selectedTrack._id, staffIds: ids });
                      }} className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg ${assigned ? "bg-blue-500 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>{s.name}</button>;
                    })}
                  </div>
                </div>
              )}
              <TrackRoster track={selectedTrack} staffName="Admin" />
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit track form ── */}
      {(addingTrack || editingTrack) && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setAddingTrack(false); setEditingTrack(null); }} />
          <div className="relative bg-white rounded-t-3xl overflow-auto max-h-[85vh]">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-slate-200 rounded-full" /></div>
            <div className="px-5 pt-2 pb-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">{editingTrack ? "Edit Track" : "Add Track"}</h3>
                {editingTrack && (
                  <button onClick={async () => { if (confirm(`Delete "${editingTrack.name}"? Campers in it will be unassigned.`)) { await removeTrack({ id: editingTrack._id }); setEditingTrack(null); } }}
                    className="text-xs text-red-500 font-semibold px-3 py-1.5 rounded-lg active:bg-red-50">Delete</button>
                )}
              </div>
              {trackError && <p className="text-sm text-red-500 font-medium">{trackError}</p>}
              <div><label className={lbl}>Track Name *</label><input value={trackForm.name} onChange={e => setTrackForm({ ...trackForm, name: e.target.value })} className={inp} placeholder="e.g. Adventure Track" /></div>
              <div><label className={lbl}>Location</label><input value={trackForm.location} onChange={e => setTrackForm({ ...trackForm, location: e.target.value })} className={inp} placeholder="e.g. Field House" /></div>
              <div><label className={lbl}>Notes</label><textarea value={trackForm.notes} onChange={e => setTrackForm({ ...trackForm, notes: e.target.value })} className={`${inp} h-16 resize-none`} /></div>
              <button onClick={async () => {
                if (!trackForm.name.trim()) { setTrackError("Track name is required"); return; }
                try {
                  if (editingTrack) await updateTrack({ id: editingTrack._id, name: trackForm.name.trim(), location: trackForm.location.trim() || undefined, notes: trackForm.notes.trim() || undefined });
                  else await createTrack({ name: trackForm.name.trim(), location: trackForm.location.trim() || undefined, notes: trackForm.notes.trim() || undefined });
                  setAddingTrack(false); setEditingTrack(null); setTrackError("");
                } catch (e: unknown) { setTrackError(e instanceof Error ? e.message : "Save failed"); }
              }} className="w-full py-3 text-sm font-bold text-white rounded-xl" style={{ backgroundColor: "#023B64" }}>{editingTrack ? "Save Changes" : "Add Track"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Campers tab (assign each camper a track) ── */}
      {tab === "campers" && (
        <>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-3 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Middle camper…" className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none" />
          </div>
          <div className="space-y-4">
            {midBunks.map(bunk => {
              const inBunk = filteredCampers.filter(c => c.bunk === bunk).sort((a, b) => camperName(a).localeCompare(camperName(b)));
              if (inBunk.length === 0) return null;
              return (
                <div key={bunk} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{bunk}</p>
                    <span className="text-[10px] text-slate-400">{inBunk.length}</span>
                  </div>
                  {inBunk.map(c => (
                    <div key={c._id} className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: avatarBg(c.name) }}>
                        {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : (c.preferredName ?? c.name).charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0"><p className="font-semibold text-slate-900 text-sm truncate">{camperName(c)}</p></div>
                      <select value={c.track ?? ""} onChange={e => setCamperTrack({ camperId: c._id, track: e.target.value || undefined })}
                        className="text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none max-w-[45%]">
                        <option value="">— No track —</option>
                        {c.track && !trackOptions.some(t => t.name === c.track) && <option value={c.track}>{c.track}</option>}
                        {trackOptions.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              );
            })}
            {middleCampers.length === 0 && <p className="text-center text-slate-400 py-8">No Middle Camp campers found.</p>}
          </div>
        </>
      )}

      {/* ── Upload tab ── */}
      {tab === "upload" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {(!uploadStep || uploadStep === "pick") && (
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">Upload Middle Camp track sheet</p>
                <p className="text-xs text-slate-400 mt-1">CSV: a Full Name column (or First/Last) and a Track column. Tracks are created automatically.</p>
              </div>
              <label className="inline-block text-xs font-semibold text-white px-3 py-2 rounded-xl cursor-pointer active:opacity-80" style={{ backgroundColor: "#023B64" }}>
                Choose CSV
                <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
              </label>
            </div>
          )}
          {uploadStep === "map" && csvData && (
            <div className="divide-y divide-slate-100">
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-sm font-semibold text-slate-700">{csvData.rows.length} rows · {csvData.headers.length} columns</p>
                <p className="text-xs text-slate-400 mt-0.5">Map CSV columns</p>
              </div>
              {TRACK_UPLOAD_FIELDS.map(field => (
                <div key={field.key} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0"><span className="text-sm font-medium text-slate-900">{field.label}</span>{field.required && <span className="text-red-400 ml-0.5">*</span>}</div>
                  <select value={mapping[field.key] ?? ""} onChange={e => setMapping({ ...mapping, [field.key]: e.target.value })}
                    className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white w-40">
                    <option value="">— skip —</option>
                    {csvData.headers.map((h, hi) => <option key={hi} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
              <div className="px-4 py-3 flex gap-3">
                <button onClick={() => setUploadStep("pick")} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl">Back</button>
                <button onClick={() => setUploadStep("preview")} disabled={!requiredMapped}
                  className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50" style={{ backgroundColor: "#023B64" }}>Preview</button>
              </div>
            </div>
          )}
          {uploadStep === "preview" && csvData && (
            <div className="divide-y divide-slate-100">
              <div className="px-4 py-3 bg-slate-50"><p className="text-sm font-semibold text-slate-700">Preview · {csvData.rows.length} campers</p></div>
              {csvData.rows.slice(0, 5).map((row, i) => {
                const nm = (mapping.fullName ? (row[mapping.fullName]?.trim() ?? "") : "") || `${row[mapping.preferredName]?.trim() ?? ""} ${row[mapping.lastName]?.trim() ?? ""}`.trim();
                const tr = mapping.track ? (row[mapping.track]?.trim() ?? "") : "";
                return <div key={i} className="px-4 py-2"><p className="text-sm font-semibold text-slate-900">{nm || "—"}</p><p className="text-xs text-slate-500 mt-0.5">{tr || "No track"}</p></div>;
              })}
              {csvData.rows.length > 5 && <div className="px-4 py-2 text-xs text-slate-400">…and {csvData.rows.length - 5} more</div>}
              <div className="px-4 py-3 flex gap-3">
                <button onClick={() => setUploadStep("map")} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl">Back</button>
                <button onClick={handleUpload} disabled={uploading} className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50" style={{ backgroundColor: "#023B64" }}>{uploading ? "Uploading…" : "Upload"}</button>
              </div>
              {uploadResult && (
                <div className={`mx-4 mb-3 rounded-xl p-3 text-sm ${uploadResult.errors.length > 0 ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
                  <p className="font-semibold">{uploadResult.created} assigned</p>
                  {uploadResult.errors.slice(0, 12).map((e, i) => <p key={i} className="text-xs text-amber-700 mt-1">{e}</p>)}
                  {uploadResult.errors.length > 12 && <p className="text-xs text-amber-700 mt-1">…and {uploadResult.errors.length - 12} more</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Track roster with daily present/absent marking. Shared by admin and counselors.
function TrackRoster({ track, staffName }: { track: Doc<"tracks">; staffName: string }) {
  const roster = useQuery(api.tracks.getRoster, { track: track.name });
  const attendance = useQuery(api.trackAttendance.getForTrackDate, { track: track.name });
  const mark = useMutation(api.trackAttendance.mark);
  const clearMark = useMutation(api.trackAttendance.clearMark);
  const [selected, setSelected] = useState<CamperDoc | null>(null);

  if (roster === undefined) return <Loading />;

  const sorted = [...roster].sort((a, b) => camperName(a).localeCompare(camperName(b)));
  const statusOf = (id: string) => (attendance ?? []).find(a => a.camperId === id)?.status;
  const present = sorted.filter(c => statusOf(c._id) === "Present").length;
  const absent = sorted.filter(c => statusOf(c._id) === "Absent").length;
  const unmarked = sorted.length - present - absent;

  return (
    <>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Pill value={present} label="Present" color="green" />
          <Pill value={absent} label="Absent" color="amber" />
          <Pill value={unmarked} label="Unmarked" color="slate" />
        </div>
        {sorted.length === 0 && <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">No campers in this track.</div>}
        <div className="space-y-2">
          {sorted.map(c => {
            const status = statusOf(c._id);
            return (
              <div key={c._id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setSelected(c)} className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 text-left active:bg-slate-50">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold overflow-hidden" style={{ backgroundColor: avatarBg(c.name) }}>
                    {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : (c.preferredName ?? c.name).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-700 text-sm">{camperName(c)}</span>
                    <p className="text-xs text-slate-400">{c.bunk}</p>
                    <AttendanceNoteLine note={c.attendanceNote} />
                  </div>
                </button>
                <div className="flex border-l border-slate-100 flex-shrink-0">
                  <button onClick={() => status === "Present" ? clearMark({ camperId: c._id }) : mark({ camperId: c._id, track: track.name, status: "Present", staffId: staffName })}
                    className={`px-3.5 py-3 text-xs font-semibold transition-colors ${status === "Present" ? "bg-green-100 text-green-700" : "text-slate-400 active:text-green-600"}`}>Present</button>
                  <button onClick={() => status === "Absent" ? clearMark({ camperId: c._id }) : mark({ camperId: c._id, track: track.name, status: "Absent", staffId: staffName })}
                    className={`px-3.5 py-3 text-xs font-semibold border-l border-slate-100 transition-colors ${status === "Absent" ? "bg-amber-100 text-amber-700" : "text-slate-400 active:text-amber-600"}`}>Absent</button>
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

// ─── Lunch Management ─────────────────────────────────────────────────────────

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().split("T")[0];
}

function getWeekDays(monday: string): { date: string; label: string }[] {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const d = new Date(monday + "T00:00:00");
  return labels.map((label, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return { date: day.toISOString().split("T")[0], label };
  });
}

function LunchManagement() {
  const [weekStart, setWeekStart] = useState(getMonday(today()));
  const lunchRecords = useQuery(api.lunchRecords.getForWeek, { weekStartDate: weekStart });
  const todayRecords = useQuery(api.lunchRecords.getForDate, { date: today() });
  const campers = useQuery(api.campers.list);
  const markPickedUp = useMutation(api.lunchRecords.markPickedUp);
  const weeklyUpload = useMutation(api.lunchRecords.weeklyUpload);
  const [uploadStep, setUploadStep] = useState<"pick" | "map" | "preview" | null>(null);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: CsvRow[] } | null>(null);
  const [lunchMapping, setLunchMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const [filter, setFilter] = useState<"all" | "ordered" | "picked" | "notpicked">("all");
  const [q, setQ] = useState("");

  if (lunchRecords === undefined || campers === undefined) return <Loading />;

  const camperMap = new Map<string, CamperDoc>();
  for (const c of campers) camperMap.set(c._id, c);
  const camperByName = new Map<string, CamperDoc>();
  for (const c of campers) {
    const full = `${(c.preferredName ?? c.name).toLowerCase()} ${(c.lastName ?? "").toLowerCase()}`.trim();
    camperByName.set(full, c);
    if (c.name && c.name !== c.preferredName) camperByName.set(`${c.name.toLowerCase()} ${(c.lastName ?? "").toLowerCase()}`.trim(), c);
  }

  const weekDays = getWeekDays(weekStart);
  const todayStr = today();
  const todayLunch = (todayRecords ?? []);
  const pickedUpToday = todayLunch.filter(r => r.pickedUp);
  const notPickedUpToday = todayLunch.filter(r => !r.pickedUp);

  const uniqueCamperIds = [...new Set(lunchRecords.map(r => r.camperId as string))];

  const displayed = uniqueCamperIds.filter(id => {
    const c = camperMap.get(id);
    if (!c) return false;
    if (q) {
      const name = `${c.preferredName ?? c.name} ${c.lastName ?? ""}`.toLowerCase();
      if (!name.includes(q.toLowerCase()) && !c.bunk.toLowerCase().includes(q.toLowerCase()) && !c.code.includes(q)) return false;
    }
    if (filter === "picked") return todayLunch.some(r => r.camperId === id && r.pickedUp);
    if (filter === "notpicked") return todayLunch.some(r => r.camperId === id && !r.pickedUp);
    return true;
  });

  const LUNCH_UPLOAD_FIELDS: { key: string; label: string; required: boolean }[] = [
    { key: "preferredName", label: "Preferred Name", required: true },
    { key: "lastName", label: "Last Name", required: true },
    { key: "safetyCode", label: "Safety Code", required: false },
    { key: "altLunch", label: "Alt Lunch", required: false },
    { key: "notes", label: "Notes", required: false },
    { key: "weekStartDate", label: "Week Start Date", required: false },
  ];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCsv(ev.target?.result as string);
      setCsvData(parsed);
      setUploadResult(null);
      const autoMap: Record<string, string> = {};
      for (const field of LUNCH_UPLOAD_FIELDS) {
        const match = parsed.headers.find(h => {
          const norm = h.toLowerCase().replace(/[^a-z0-9]/g, "");
          const labelNorm = field.label.toLowerCase().replace(/[^a-z0-9]/g, "");
          return norm === field.key.toLowerCase() || norm === labelNorm;
        });
        if (match) autoMap[field.key] = match;
      }
      setLunchMapping(autoMap);
      setUploadStep("map");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const lunchRequiredMapped = LUNCH_UPLOAD_FIELDS.filter(f => f.required).every(f => lunchMapping[f.key]);

  const handleUpload = async () => {
    if (!csvData) return;
    setUploading(true);
    const errors: string[] = [];
    const records: { camperId: string; altLunch?: string; note?: string }[] = [];

    let uploadWeek = weekStart;
    for (let i = 0; i < csvData.rows.length; i++) {
      const row = csvData.rows[i];
      const firstName = lunchMapping.preferredName ? (row[lunchMapping.preferredName]?.trim() ?? "") : "";
      const lastName = lunchMapping.lastName ? (row[lunchMapping.lastName]?.trim() ?? "") : "";
      const code = lunchMapping.safetyCode ? (row[lunchMapping.safetyCode]?.trim() ?? "") : "";
      if (lunchMapping.weekStartDate && row[lunchMapping.weekStartDate]?.trim()) uploadWeek = getMonday(row[lunchMapping.weekStartDate].trim());

      const searchKey = `${firstName} ${lastName}`.trim().toLowerCase();
      let camper = camperByName.get(searchKey);
      if (!camper && code) {
        camper = campers.find(c => c.code === code && (c.preferredName ?? c.name).toLowerCase() === firstName.toLowerCase());
      }

      if (!camper) { errors.push(`Row ${i + 2}: "${firstName} ${lastName}"${code ? ` (#${code})` : ""} not found`); continue; }
      if (camper.isActive === false) { errors.push(`Row ${i + 2}: "${firstName} ${lastName}" is inactive — skipped`); continue; }

      const altLunch = lunchMapping.altLunch ? (row[lunchMapping.altLunch]?.trim() || undefined) : undefined;
      const note = lunchMapping.notes ? (row[lunchMapping.notes]?.trim() || undefined) : undefined;
      records.push({ camperId: camper._id, altLunch, note });
    }

    let result = { created: 0, updated: 0 };
    if (records.length > 0) {
      result = await weeklyUpload({ weekStartDate: uploadWeek, records: records as never });
      setWeekStart(uploadWeek);
    }
    setUploadResult({ ...result, errors });
    setUploading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UtensilsCrossed size={22} className="text-slate-700" />
        <h2 className="text-xl font-bold text-slate-900">Lunch</h2>
        <button onClick={() => setUploadStep(uploadStep ? null : "pick")}
          className="ml-auto text-xs font-semibold px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 active:bg-slate-50">
          {uploadStep ? "View Sheet" : "Upload Weekly"}
        </button>
      </div>

      {uploadStep ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {uploadStep === "pick" && (
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">Upload weekly lunch sheet</p>
                <p className="text-xs text-slate-400 mt-1">CSV: Preferred Name, Last Name, Safety Code, Alt Lunch, Notes</p>
                <p className="text-xs text-slate-400">Alt Lunch: blank = regular all week, or day names separated by | (e.g. Tuesday|Thursday)</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Week of:</label>
                <input type="date" value={weekStart} onChange={e => setWeekStart(getMonday(e.target.value))}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white" />
              </div>
              <label className="inline-block text-xs font-semibold text-white px-3 py-2 rounded-xl cursor-pointer active:opacity-80"
                style={{ backgroundColor: "#023B64" }}>
                Choose CSV
                <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
              </label>
            </div>
          )}

          {uploadStep === "map" && csvData && (
            <div className="divide-y divide-slate-100">
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-sm font-semibold text-slate-700">{csvData.rows.length} rows · {csvData.headers.length} columns</p>
                <p className="text-xs text-slate-400 mt-0.5">Map CSV columns to lunch fields</p>
              </div>
              {LUNCH_UPLOAD_FIELDS.map(field => (
                <div key={field.key} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-900">{field.label}</span>
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </div>
                  <select value={lunchMapping[field.key] ?? ""}
                    onChange={e => setLunchMapping({ ...lunchMapping, [field.key]: e.target.value })}
                    className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white w-40">
                    <option value="">— skip —</option>
                    {csvData.headers.map((h, hi) => <option key={hi} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
              <div className="px-4 py-3 flex gap-3">
                <button onClick={() => setUploadStep("pick")} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl">Back</button>
                <button onClick={() => setUploadStep("preview")} disabled={!lunchRequiredMapped}
                  className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50" style={{ backgroundColor: "#023B64" }}>
                  Preview
                </button>
              </div>
            </div>
          )}

          {uploadStep === "preview" && csvData && (
            <div className="divide-y divide-slate-100">
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-sm font-semibold text-slate-700">Preview · {csvData.rows.length} campers · Week of {weekStart}</p>
              </div>
              {csvData.rows.slice(0, 5).map((row, i) => {
                const name = `${lunchMapping.preferredName ? (row[lunchMapping.preferredName]?.trim() ?? "") : ""} ${lunchMapping.lastName ? (row[lunchMapping.lastName]?.trim() ?? "") : ""}`.trim();
                const code = lunchMapping.safetyCode ? (row[lunchMapping.safetyCode]?.trim() ?? "") : "";
                const alt = lunchMapping.altLunch ? (row[lunchMapping.altLunch]?.trim() ?? "") : "";
                return (
                  <div key={i} className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{name || "—"}</span>
                      {code && <span className="text-xs text-slate-400 font-mono">#{code}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{alt ? `Alt lunch: ${alt}` : "Regular lunch all week"}</p>
                  </div>
                );
              })}
              {csvData.rows.length > 5 && <div className="px-4 py-2 text-xs text-slate-400">…and {csvData.rows.length - 5} more</div>}
              <div className="px-4 py-3 flex gap-3">
                <button onClick={() => setUploadStep("map")} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl">Back</button>
                <button onClick={handleUpload} disabled={uploading}
                  className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50" style={{ backgroundColor: "#023B64" }}>
                  {uploading ? "Uploading…" : `Upload for week of ${weekStart}`}
                </button>
              </div>
              {uploadResult && (
                <div className={`mx-4 mb-3 rounded-xl p-3 text-sm ${uploadResult.errors.length > 0 ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
                  <p className="font-semibold">{uploadResult.created} daily records created, {uploadResult.updated} updated</p>
                  {uploadResult.errors.map((e, i) => <p key={i} className="text-xs text-amber-700 mt-1">{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Week of:</label>
            <input type="date" value={weekStart} onChange={e => setWeekStart(getMonday(e.target.value))}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white" />
          </div>

          <div className="flex gap-2">
            <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex-1 text-center">
              <p className="text-lg font-bold text-slate-900">{uniqueCamperIds.length}</p>
              <p className="text-[10px] text-slate-400 uppercase">On Sheet</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex-1 text-center">
              <p className="text-lg font-bold text-green-600">{pickedUpToday.length}</p>
              <p className="text-[10px] text-slate-400 uppercase">Picked Up Today</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex-1 text-center">
              <p className="text-lg font-bold text-amber-600">{notPickedUpToday.length}</p>
              <p className="text-[10px] text-slate-400 uppercase">Waiting Today</p>
            </div>
          </div>

          <div className="flex gap-1.5">
            {([["all","All"],["notpicked","Not Picked Up"],["picked","Picked Up"]] as const).map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${filter === val ? "text-white" : "bg-white text-slate-500 border border-slate-200"}`}
                style={filter === val ? { backgroundColor: "#023B64" } : undefined}>
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-3 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search name, bunk, code…"
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none" />
          </div>

          {/* Weekly grid */}
          <div className="space-y-2">
            {displayed.map(camperId => {
              const c = camperMap.get(camperId);
              if (!c) return null;
              const presence = getCampusPresence(c);
              const weekRecords = lunchRecords.filter(r => r.camperId === camperId);
              return (
                <div key={camperId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0 overflow-hidden"
                      style={{ backgroundColor: avatarBg(c.name) }}>
                      {c.photoUrl ? <img src={c.photoUrl} alt="" className="w-full h-full object-cover" /> : (c.preferredName ?? c.name).charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 text-sm">{camperName(c)}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${presence.status === "Here" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{presence.label}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{c.bunk} · #{c.code}</p>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 px-4 py-2 flex gap-1">
                    {weekDays.map(day => {
                      const rec = weekRecords.find(r => r.date === day.date);
                      if (!rec) return <div key={day.date} className="flex-1 text-center py-1"><p className="text-[10px] text-slate-300">{day.label}</p></div>;
                      const isToday = day.date === todayStr;
                      const isAlt = rec.lunchType === "alternate";
                      return (
                        <button key={day.date} onClick={() => markPickedUp({ id: rec._id, pickedUp: !rec.pickedUp, staffId: "Admin" })}
                          className={`flex-1 rounded-lg py-1.5 text-center transition-colors cursor-pointer active:opacity-80 ${
                            rec.pickedUp ? "bg-green-500 text-white"
                            : isAlt ? "bg-amber-50 border border-amber-200"
                            : "bg-slate-50 border border-slate-200"
                          }`}>
                          <p className={`text-[10px] font-bold ${rec.pickedUp ? "text-white" : isAlt ? "text-amber-700" : "text-slate-600"}`}>{day.label}</p>
                          <p className={`text-[9px] ${rec.pickedUp ? "text-white/80" : isAlt ? "text-amber-500" : "text-slate-400"}`}>
                            {rec.pickedUp ? "✓" : isAlt ? "Alt" : "Reg"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {displayed.length === 0 && uniqueCamperIds.length === 0 && (
              <p className="text-center text-slate-400 py-8">No lunch records for this week. Upload a weekly lunch sheet to get started.</p>
            )}
            {displayed.length === 0 && uniqueCamperIds.length > 0 && (
              <p className="text-center text-slate-400 py-6">No results match your filter.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Camp Structure Management ────────────────────────────────────────────────

type StructureFormData = {
  camp: string; division: string; bunk: string; displayName: string;
  sortOrder: string; isActive: boolean;
  defaultLocation: string; dismissalLocation: string;
};

const STRUCTURE_BLANK: StructureFormData = {
  camp: "", division: "", bunk: "", displayName: "",
  sortOrder: "", isActive: true,
  defaultLocation: "", dismissalLocation: "",
};

function CampStructureManagement() {
  const structure = useQuery(api.campStructure.list);
  const campers = useQuery(api.campers.list);
  const createEntry = useMutation(api.campStructure.create);
  const updateEntry = useMutation(api.campStructure.update);
  const removeEntry = useMutation(api.campStructure.remove);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Doc<"campStructure"> | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<StructureFormData>(STRUCTURE_BLANK);
  const [groupBy, setGroupBy] = useState<"camp" | "division">("camp");

  if (structure === undefined) return <Loading />;

  const camperCounts = new Map<string, number>();
  for (const c of campers ?? []) {
    camperCounts.set(c.bunk, (camperCounts.get(c.bunk) ?? 0) + 1);
  }

  const camps = [...new Set(structure.map(s => s.camp))].sort();
  const divisions = [...new Set(structure.map(s => s.division))].sort();

  const filtered = structure.filter(s => {
    if (!q) return true;
    const low = q.toLowerCase();
    return s.camp.toLowerCase().includes(low) || s.division.toLowerCase().includes(low)
      || s.bunk.toLowerCase().includes(low) || (s.displayName ?? "").toLowerCase().includes(low);
  });

  const sorted = [...filtered].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.bunk.localeCompare(b.bunk));

  const groups = new Map<string, typeof sorted>();
  for (const s of sorted) {
    const key = groupBy === "camp" ? s.camp : s.division;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const openAdd = () => { setForm(STRUCTURE_BLANK); setAdding(true); setEditing(null); setError(""); };
  const openEdit = (s: Doc<"campStructure">) => {
    setForm({
      camp: s.camp, division: s.division, bunk: s.bunk,
      displayName: s.displayName ?? "", sortOrder: s.sortOrder?.toString() ?? "",
      isActive: s.isActive !== false,
      defaultLocation: s.defaultLocation ?? "", dismissalLocation: s.dismissalLocation ?? "",
    });
    setEditing(s); setAdding(false); setError("");
  };

  const handleSave = async () => {
    if (!form.camp.trim() || !form.division.trim() || !form.bunk.trim()) {
      setError("Camp, division, and bunk are required"); return;
    }
    try {
      const args = {
        camp: form.camp.trim(),
        division: form.division.trim(),
        bunk: form.bunk.trim(),
        displayName: form.displayName.trim() || undefined,
        sortOrder: form.sortOrder ? parseInt(form.sortOrder) : undefined,
        isActive: form.isActive,
        defaultLocation: form.defaultLocation.trim() || undefined,
        dismissalLocation: form.dismissalLocation.trim() || undefined,
      };
      if (editing) {
        await updateEntry({ id: editing._id, ...args });
      } else {
        await createEntry(args);
      }
      setEditing(null); setAdding(false); setError("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  };

  const handleDelete = async (s: Doc<"campStructure">) => {
    const count = camperCounts.get(s.bunk) ?? 0;
    if (!confirm(`Delete "${s.bunk}"?${count > 0 ? ` (${count} campers currently assigned)` : ""}`)) return;
    await removeEntry({ id: s._id });
    if (editing?._id === s._id) setEditing(null);
  };

  const showForm = adding || editing;
  const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none";
  const lbl = "text-xs font-semibold text-slate-500 mb-1 block";

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 size={22} className="text-slate-700" />
          <h2 className="text-xl font-bold text-slate-900">Camp Structure</h2>
          <span className="text-sm text-slate-400 ml-1">{structure.length} bunks</span>
          <button onClick={openAdd}
            className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-white px-3 py-2 rounded-xl active:opacity-80"
            style={{ backgroundColor: "#023B64" }}>
            + Add Bunk
          </button>
        </div>

        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-3.5 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search camp, division, bunk…"
            className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:outline-none text-sm bg-white"
            onFocus={e => (e.currentTarget.style.borderColor = "#023B64")}
            onBlur={e => (e.currentTarget.style.borderColor = "")} />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Group by</span>
          {([["camp", "Camp"], ["division", "Division"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setGroupBy(val)}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${groupBy === val ? "text-white" : "bg-white text-slate-500 border border-slate-200"}`}
              style={groupBy === val ? { backgroundColor: "#023B64" } : undefined}>
              {label}
            </button>
          ))}
        </div>

        {sortedGroups.map(([group, members]) => (
          <div key={group}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-sm font-bold text-slate-700">{group}</span>
              <span className="text-xs text-slate-400">{members.length} bunks</span>
            </div>
            <div className="space-y-2">
              {members.map(s => {
                const count = camperCounts.get(s.bunk) ?? 0;
                return (
                  <div key={s._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <button onClick={() => openEdit(s)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{ backgroundColor: s.isActive === false ? "#f1f5f9" : "#e0f2fe", color: s.isActive === false ? "#94a3b8" : "#023B64" }}>
                        {count}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${s.isActive === false ? "text-slate-400" : "text-slate-900"}`}>
                            {s.displayName || s.bunk}
                          </span>
                          {s.isActive === false && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">Inactive</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                          <span>{s.camp}</span>
                          <span>·</span>
                          <span>{s.division}</span>
                          {s.bunk !== (s.displayName || s.bunk) && <><span>·</span><span className="font-mono text-slate-400">{s.bunk}</span></>}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="text-center text-slate-400 py-8">
            {structure.length === 0 ? "No camp structure defined yet. Add bunks to get started." : "No bunks match your search."}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setAdding(false); setEditing(null); }} />
          <div className="relative bg-white rounded-t-3xl overflow-auto max-h-[85vh]">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-slate-200 rounded-full" /></div>
            <div className="px-5 pt-2 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">{editing ? "Edit Bunk" : "Add Bunk"}</h3>
                {editing && (
                  <button onClick={() => handleDelete(editing)}
                    className="text-xs text-red-500 font-semibold px-3 py-1.5 rounded-lg active:bg-red-50">Delete</button>
                )}
              </div>

              {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

              <div>
                <label className={lbl}>Camp *</label>
                <input value={form.camp} onChange={e => setForm({ ...form, camp: e.target.value })}
                  className={inp} placeholder="e.g. Kaleidoscope" list="camp-suggestions" />
                <datalist id="camp-suggestions">{camps.map(c => <option key={c} value={c} />)}</datalist>
              </div>

              <div>
                <label className={lbl}>Division *</label>
                <input value={form.division} onChange={e => setForm({ ...form, division: e.target.value })}
                  className={inp} placeholder="e.g. Lower" list="div-suggestions" />
                <datalist id="div-suggestions">{divisions.map(d => <option key={d} value={d} />)}</datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Bunk Name *</label>
                  <input value={form.bunk} onChange={e => setForm({ ...form, bunk: e.target.value })}
                    className={inp} placeholder="e.g. Bunk 1A" />
                </div>
                <div>
                  <label className={lbl}>Display Name</label>
                  <input value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })}
                    className={inp} placeholder="Optional" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Sort Order</label>
                  <input value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: e.target.value.replace(/\D/g, "") })}
                    className={`${inp} font-mono`} placeholder="e.g. 1" inputMode="numeric" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300" />
                    Active
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Default Location</label>
                  <input value={form.defaultLocation} onChange={e => setForm({ ...form, defaultLocation: e.target.value })}
                    className={inp} placeholder="e.g. Field 2" />
                </div>
                <div>
                  <label className={lbl}>Dismissal Location</label>
                  <input value={form.dismissalLocation} onChange={e => setForm({ ...form, dismissalLocation: e.target.value })}
                    className={inp} placeholder="e.g. Front Gate" />
                </div>
              </div>

              <button onClick={handleSave}
                className="w-full py-3 text-sm font-bold text-white rounded-xl active:opacity-80"
                style={{ backgroundColor: "#023B64" }}>
                {editing ? "Save Changes" : "Add Bunk"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Staff Management ─────────────────────────────────────────────────────────

const ALL_ROLES: Role[] = ["counselor","specialist","carline","walkup","dispatcher","runner","director","admin","beforecare","aftercare","bus","unithead"];
const ROLE_LABEL: Record<string, string> = {
  counselor:"Bunk Counselor",specialist:"Specialist",carline:"Dismissal Staff",walkup:"Dismissal Staff",
  dispatcher:"Dismissal Staff",runner:"Runner",director:"Director",admin:"Admin",
  beforecare:"Before Care Staff",aftercare:"After Care Staff",bus:"Bus Staff",unithead:"Unit Head",
};

const PRIMARY_ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "admin",      label: "Admin" },
  { value: "director",   label: "Office" },
  { value: "unithead",   label: "Unit Head" },
  { value: "counselor",  label: "Bunk Counselor" },
  { value: "specialist", label: "Specialist" },
  { value: "carline",    label: "Dismissal Staff" },
  { value: "runner",     label: "Runner" },
  { value: "bus",        label: "Bus Staff" },
  { value: "beforecare", label: "Before Care Staff" },
  { value: "aftercare",  label: "After Care Staff" },
];

const UNIT_OPTIONS = ["Lower", "Middle", "Upper", "CIT", "Swim", "Sports", "Tennis", "Specialty"];

const STAFF_CSV_HEADERS = ["firstName","lastName","email","phone","primaryRole","assignedBunk","assignedUnit","campSection","canBeRunner","busRoute","camp","division","primaryJob","secondaryJob","beforeCare","afterCare","isActive","loginCode","runnerLabel"];

type StaffFormData = {
  firstName: string; lastName: string; email: string; phone: string;
  code: string; role: Role; extraRoles: Role[];
  bunkAssignment: string; unitAssignment: string; campSection: string;
  busRoute: string; camp: string; division: string;
  primaryJob: string; secondaryJob: string;
  canBeRunner: boolean; runnerLabel: string; isActive: boolean;
};

const STAFF_BLANK: StaffFormData = {
  firstName: "", lastName: "", email: "", phone: "", code: "",
  role: "counselor", extraRoles: [], bunkAssignment: "", unitAssignment: "",
  campSection: "", busRoute: "", camp: "", division: "",
  primaryJob: "", secondaryJob: "",
  canBeRunner: false, runnerLabel: "", isActive: true,
};

const JOB_OPTIONS = [
  "Bunk Counselor", "Specialist", "Unit Head", "Dismissal Runner",
  "Dismissal Caller", "Dispatcher", "Bus Staff", "Before Care Staff",
  "After Care Staff", "Lunch Staff", "Office", "Director",
];

function staffDisplayName(s: { firstName?: string; lastName?: string; name: string }, allRunners: { firstName?: string; lastName?: string; name: string }[]): string {
  const first = s.firstName ?? s.name.split(" ")[0] ?? "";
  const last = s.lastName ?? s.name.split(" ").slice(1).join(" ") ?? "";
  if (!last) return first;
  const lastInitial = last.charAt(0);
  const base = `${first} ${lastInitial}.`;
  const conflicts = allRunners.filter(r => {
    const rFirst = r.firstName ?? r.name.split(" ")[0] ?? "";
    const rLast = r.lastName ?? r.name.split(" ").slice(1).join(" ") ?? "";
    return rFirst === first && rLast !== last && rLast.charAt(0) === lastInitial;
  });
  if (conflicts.length === 0) return base;
  for (let i = 2; i <= last.length; i++) {
    const partial = `${first} ${last.slice(0, i)}.`;
    const stillConflicting = conflicts.filter(r => {
      const rLast = r.lastName ?? r.name.split(" ").slice(1).join(" ") ?? "";
      return rLast.slice(0, i) === last.slice(0, i);
    });
    if (stillConflicting.length === 0) return partial;
  }
  return `${first} ${last}`;
}

function staffFormFromDoc(s: StaffDoc): StaffFormData {
  const parts = s.name.split(" ");
  return {
    firstName: s.firstName ?? parts[0] ?? "",
    lastName: s.lastName ?? parts.slice(1).join(" ") ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    code: s.code,
    role: s.role as Role,
    extraRoles: (s.extraRoles ?? []) as Role[],
    bunkAssignment: s.bunkAssignment ?? "",
    unitAssignment: s.unitAssignment ?? "",
    campSection: s.campSection ?? "",
    busRoute: s.busRoute ?? "",
    camp: (s as Record<string, unknown>).camp as string ?? "",
    division: (s as Record<string, unknown>).division as string ?? "",
    primaryJob: (s as Record<string, unknown>).primaryJob as string ?? "",
    secondaryJob: (s as Record<string, unknown>).secondaryJob as string ?? "",
    canBeRunner: s.canBeRunner ?? false,
    runnerLabel: s.runnerLabel ?? "",
    isActive: s.isActive !== false,
  };
}

type StaffCsvError = { row: number; field: string; message: string };

function StaffManagement() {
  const staffList = useQuery(api.staff.list);
  const bunkList  = useQuery(api.campers.getBunks, {});
  const structureBunks = useQuery(api.campStructure.list);
  const busRouteList = useQuery(api.busRoutes.list);
  const createStaff = useMutation(api.staff.create);
  const updateStaff = useMutation(api.staff.update);
  const removeStaff = useMutation(api.staff.remove);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<StaffDoc | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<StaffFormData>(STAFF_BLANK);
  const [staffUploadStep, setStaffUploadStep] = useState<"pick" | "map" | "preview" | null>(null);
  const [staffCsvData, setStaffCsvData] = useState<{ headers: string[]; rows: CsvRow[] } | null>(null);
  const [staffMapping, setStaffMapping] = useState<Record<string, string>>({});
  const [csvUploading, setCsvUploading] = useState(false);
  const [staffUploadResult, setStaffUploadResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const [groupBy, setGroupBy] = useState<"none" | "camp" | "division" | "bunk" | "primaryJob" | "secondaryJob">("none");

  const bunks = [...new Set([
    ...(bunkList ?? []),
    ...(structureBunks ?? []).filter(s => s.isActive !== false).map(s => s.bunk),
  ])].sort();

  const openAdd = () => { setForm(STAFF_BLANK); setAdding(true); setEditing(null); setError(""); };
  const openEdit = (s: StaffDoc) => {
    setForm(staffFormFromDoc(s));
    setEditing(s); setAdding(false); setError("");
  };

  const buildSaveArgs = () => {
    const name = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    return {
      name: name || form.firstName.trim(),
      firstName: form.firstName.trim() || undefined,
      lastName: form.lastName.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      code: form.code.trim(),
      role: form.role,
      extraRoles: form.extraRoles.length > 0 ? form.extraRoles : undefined,
      bunkAssignment: form.bunkAssignment || undefined,
      unitAssignment: form.unitAssignment || undefined,
      campSection: form.campSection || undefined,
      busRoute: form.busRoute || undefined,
      camp: form.camp || undefined,
      division: form.division || undefined,
      primaryJob: form.primaryJob || undefined,
      secondaryJob: form.secondaryJob || undefined,
      canBeRunner: form.canBeRunner || form.primaryJob === "Dismissal Runner" || form.secondaryJob === "Dismissal Runner" || undefined,
      runnerLabel: form.runnerLabel.trim() || undefined,
      isActive: form.isActive,
    };
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.code.trim()) { setError("First name and login code are required"); return; }
    try {
      const args = buildSaveArgs();
      if (editing) {
        await updateStaff({ id: editing._id, ...args });
      } else {
        await createStaff(args);
      }
      setEditing(null); setAdding(false); setError("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  };

  const handleDelete = async (s: StaffDoc) => {
    if (!confirm(`Delete ${s.name}?`)) return;
    await removeStaff({ id: s._id });
    if (editing?._id === s._id) { setEditing(null); }
  };

  // CSV role mapping
  const csvRoleMap: Record<string, Role> = {
    "admin": "admin", "office": "director", "unit head": "unithead", "unithead": "unithead",
    "bunk counselor": "counselor", "counselor": "counselor",
    "specialist": "specialist", "dismissal staff": "carline", "dismissal": "carline",
    "runner": "runner", "bus staff": "bus", "bus": "bus",
    "before care staff": "beforecare", "before care": "beforecare", "beforecare": "beforecare",
    "after care staff": "aftercare", "after care": "aftercare", "aftercare": "aftercare",
    "director": "director", "carline": "carline", "walkup": "walkup", "dispatcher": "dispatcher",
  };

  const parseBoolVal = (v: string) => ["true","yes","1","y"].includes(v.toLowerCase().trim());

  const STAFF_UPLOAD_FIELDS: { key: string; label: string; required: boolean }[] = [
    { key: "firstName", label: "First Name", required: true },
    { key: "lastName", label: "Last Name", required: true },
    { key: "loginCode", label: "Login Code", required: true },
    { key: "email", label: "Email", required: false },
    { key: "phone", label: "Phone", required: false },
    { key: "primaryRole", label: "Primary Role", required: true },
    { key: "assignedBunk", label: "Assigned Bunk", required: false },
    { key: "assignedUnit", label: "Assigned Unit", required: false },
    { key: "campSection", label: "Camp Section", required: false },
    { key: "busRoute", label: "Bus Route", required: false },
    { key: "camp", label: "Camp", required: false },
    { key: "division", label: "Division", required: false },
    { key: "primaryJob", label: "Primary Job", required: false },
    { key: "secondaryJob", label: "Secondary Job", required: false },
    { key: "canBeRunner", label: "Can Be Runner", required: false },
    { key: "isActive", label: "Is Active", required: false },
    { key: "runnerLabel", label: "Runner Label", required: false },
  ];

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCsv(ev.target?.result as string);
      setStaffCsvData(parsed);
      setStaffUploadResult(null);
      const autoMap: Record<string, string> = {};
      for (const field of STAFF_UPLOAD_FIELDS) {
        const match = parsed.headers.find(h => {
          const norm = h.toLowerCase().replace(/[^a-z0-9]/g, "");
          const labelNorm = field.label.toLowerCase().replace(/[^a-z0-9]/g, "");
          const keyNorm = field.key.toLowerCase();
          return norm === keyNorm || norm === labelNorm;
        });
        if (match) autoMap[field.key] = match;
      }
      setStaffMapping(autoMap);
      setStaffUploadStep("map");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const staffRequiredMapped = STAFF_UPLOAD_FIELDS.filter(f => f.required).every(f => staffMapping[f.key]);

  const handleCsvUpload = async () => {
    if (!staffCsvData) return;
    setCsvUploading(true);
    const errors: string[] = [];
    let created = 0, updated = 0;
    try {
      for (let i = 0; i < staffCsvData.rows.length; i++) {
        const row = staffCsvData.rows[i];
        const fn = staffMapping.firstName ? (row[staffMapping.firstName]?.trim() ?? "") : "";
        const ln = staffMapping.lastName ? (row[staffMapping.lastName]?.trim() ?? "") : "";
        const code = staffMapping.loginCode ? (row[staffMapping.loginCode]?.trim() ?? "") : "";
        if (!fn || !code) { errors.push(`Row ${i + 2}: missing first name or login code`); continue; }

        const roleRaw = staffMapping.primaryRole ? (row[staffMapping.primaryRole]?.trim().toLowerCase() ?? "") : "";
        const role = csvRoleMap[roleRaw];
        if (!role) { errors.push(`Row ${i + 2}: unknown role "${roleRaw}"`); continue; }

        const name = `${fn} ${ln}`.trim();
        const email = staffMapping.email ? (row[staffMapping.email]?.trim() || undefined) : undefined;
        const args = {
          name, firstName: fn || undefined, lastName: ln || undefined,
          email, phone: staffMapping.phone ? (row[staffMapping.phone]?.trim() || undefined) : undefined,
          code, role,
          bunkAssignment: staffMapping.assignedBunk ? (row[staffMapping.assignedBunk]?.trim() || undefined) : undefined,
          unitAssignment: staffMapping.assignedUnit ? (row[staffMapping.assignedUnit]?.trim() || undefined) : undefined,
          campSection: staffMapping.campSection ? (row[staffMapping.campSection]?.trim() || undefined) : undefined,
          busRoute: staffMapping.busRoute ? (row[staffMapping.busRoute]?.trim() || undefined) : undefined,
          camp: staffMapping.camp ? (row[staffMapping.camp]?.trim() || undefined) : undefined,
          division: staffMapping.division ? (row[staffMapping.division]?.trim() || undefined) : undefined,
          primaryJob: staffMapping.primaryJob ? (row[staffMapping.primaryJob]?.trim() || undefined) : undefined,
          secondaryJob: staffMapping.secondaryJob ? (row[staffMapping.secondaryJob]?.trim() || undefined) : undefined,
          canBeRunner: staffMapping.canBeRunner ? (parseBoolVal(row[staffMapping.canBeRunner] ?? "") || undefined) : undefined,
          runnerLabel: staffMapping.runnerLabel ? (row[staffMapping.runnerLabel]?.trim() || undefined) : undefined,
          isActive: staffMapping.isActive ? parseBoolVal(row[staffMapping.isActive] ?? "true") : true,
        };
        const nameKey = `${fn} ${ln}`.trim().toLowerCase();
        const existing = staffList?.find(s => s.code === code)
          ?? (email ? staffList?.find(s => s.email && s.email === email) : undefined)
          ?? staffList?.find(s => s.name.toLowerCase() === nameKey)
          ?? staffList?.find(s => (s.firstName ?? "").toLowerCase() === fn.toLowerCase() && (s.lastName ?? "").toLowerCase() === ln.toLowerCase());
        try {
          if (existing) { await updateStaff({ id: existing._id, ...args }); updated++; }
          else { await createStaff(args); created++; }
        } catch (e: unknown) { errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : "failed"}`); }
      }
    } catch (e: unknown) { errors.push(e instanceof Error ? e.message : "Upload failed"); }
    setStaffUploadResult({ created, updated, errors });
    setCsvUploading(false);
  };

  const downloadCsv = () => {
    if (!staffList) return;
    const rows = staffList.map(s => {
      const roleLabel = PRIMARY_ROLE_OPTIONS.find(r => r.value === s.role)?.label ?? s.role;
      const sx = s as unknown as { camp?: string; division?: string; primaryJob?: string; secondaryJob?: string };
      return [
        s.firstName ?? s.name.split(" ")[0] ?? "", s.lastName ?? s.name.split(" ").slice(1).join(" ") ?? "",
        s.email ?? "", s.phone ?? "", roleLabel,
        s.bunkAssignment ?? "", s.unitAssignment ?? "", s.campSection ?? "",
        s.canBeRunner ? "TRUE" : "FALSE", s.busRoute ?? "",
        sx.camp ?? "", sx.division ?? "", sx.primaryJob ?? "", sx.secondaryJob ?? "",
        "", "", s.isActive !== false ? "TRUE" : "FALSE", s.code, s.runnerLabel ?? "",
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = STAFF_CSV_HEADERS.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "staff.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const csv = STAFF_CSV_HEADERS.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "staff_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (staffList === undefined) return <Loading />;

  const filtered = staffList.filter(s => {
    if (!q) return true;
    const low = q.toLowerCase();
    const sx = s as Record<string, unknown>;
    return s.name.toLowerCase().includes(low) || s.code.includes(low)
      || s.role.toLowerCase().includes(low) || (s.bunkAssignment ?? "").toLowerCase().includes(low)
      || (s.email ?? "").toLowerCase().includes(low)
      || ((sx.camp as string) ?? "").toLowerCase().includes(low)
      || ((sx.division as string) ?? "").toLowerCase().includes(low)
      || ((sx.primaryJob as string) ?? "").toLowerCase().includes(low)
      || ((sx.secondaryJob as string) ?? "").toLowerCase().includes(low);
  });

  const showForm = adding || editing;

  const needsBunk    = form.role === "counselor" || form.extraRoles.includes("counselor");
  const needsUnit    = form.role === "unithead"  || form.extraRoles.includes("unithead");
  const needsBus     = form.role === "bus"       || form.extraRoles.includes("bus");
  const needsRunner  = form.role === "runner"    || form.extraRoles.includes("runner") || form.canBeRunner;

  const inp = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none";
  const lbl = "text-xs font-semibold text-slate-500 mb-1 block";

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <User size={22} className="text-slate-700" />
          <h2 className="text-xl font-bold text-slate-900">Staff</h2>
          <span className="text-sm text-slate-400 ml-1">{staffList.length} total</span>
          <button onClick={openAdd}
            className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-white px-3 py-2 rounded-xl active:opacity-80"
            style={{ backgroundColor: "#023B64" }}>
            + Add Staff
          </button>
        </div>

        {/* CSV actions */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setStaffUploadStep(staffUploadStep ? null : "pick")}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 active:bg-slate-50">
            {staffUploadStep ? "Hide Upload" : "CSV Upload"}
          </button>
          <button onClick={downloadCsv} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 active:bg-slate-50">
            Download CSV
          </button>
          <button onClick={downloadTemplate} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 active:bg-slate-50">
            Template
          </button>
        </div>
        {staffUploadStep && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {staffUploadStep === "pick" && (
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Upload staff CSV</p>
                  <p className="text-xs text-slate-400 mt-1">CSV: First Name, Last Name, Login Code, Primary Role, and optional fields</p>
                </div>
                <label className="inline-block text-xs font-semibold text-white px-3 py-2 rounded-xl cursor-pointer active:opacity-80"
                  style={{ backgroundColor: "#023B64" }}>
                  Choose CSV
                  <input type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
                </label>
              </div>
            )}

            {staffUploadStep === "map" && staffCsvData && (
              <div className="divide-y divide-slate-100">
                <div className="px-4 py-3 bg-slate-50">
                  <p className="text-sm font-semibold text-slate-700">{staffCsvData.rows.length} rows · {staffCsvData.headers.length} columns</p>
                  <p className="text-xs text-slate-400 mt-0.5">Map CSV columns to staff fields</p>
                </div>
                {STAFF_UPLOAD_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-900">{field.label}</span>
                      {field.required && <span className="text-red-400 ml-0.5">*</span>}
                    </div>
                    <select value={staffMapping[field.key] ?? ""}
                      onChange={e => setStaffMapping({ ...staffMapping, [field.key]: e.target.value })}
                      className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white w-40">
                      <option value="">— skip —</option>
                      {staffCsvData.headers.map((h, hi) => <option key={hi} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
                <div className="px-4 py-3 flex gap-3">
                  <button onClick={() => setStaffUploadStep("pick")} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl">Back</button>
                  <button onClick={() => setStaffUploadStep("preview")} disabled={!staffRequiredMapped}
                    className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50" style={{ backgroundColor: "#023B64" }}>
                    Preview
                  </button>
                </div>
              </div>
            )}

            {staffUploadStep === "preview" && staffCsvData && (
              <div className="divide-y divide-slate-100">
                <div className="px-4 py-3 bg-slate-50">
                  <p className="text-sm font-semibold text-slate-700">Preview · {staffCsvData.rows.length} staff</p>
                </div>
                {staffCsvData.rows.slice(0, 5).map((row, i) => {
                  const name = `${staffMapping.firstName ? (row[staffMapping.firstName]?.trim() ?? "") : ""} ${staffMapping.lastName ? (row[staffMapping.lastName]?.trim() ?? "") : ""}`.trim();
                  const role = staffMapping.primaryRole ? (row[staffMapping.primaryRole]?.trim() ?? "") : "";
                  const code = staffMapping.loginCode ? (row[staffMapping.loginCode]?.trim() ?? "") : "";
                  const bunk = staffMapping.assignedBunk ? (row[staffMapping.assignedBunk]?.trim() ?? "") : "";
                  return (
                    <div key={i} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{name || "—"}</span>
                        {code && <span className="text-xs text-slate-400 font-mono">{code}</span>}
                        {role && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#023B64" }}>{role}</span>}
                      </div>
                      {bunk && <p className="text-xs text-slate-500 mt-0.5">{bunk}</p>}
                    </div>
                  );
                })}
                {staffCsvData.rows.length > 5 && <div className="px-4 py-2 text-xs text-slate-400">…and {staffCsvData.rows.length - 5} more</div>}
                <div className="px-4 py-3 flex gap-3">
                  <button onClick={() => setStaffUploadStep("map")} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl">Back</button>
                  <button onClick={handleCsvUpload} disabled={csvUploading}
                    className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50" style={{ backgroundColor: "#023B64" }}>
                    {csvUploading ? "Uploading…" : "Upload Staff"}
                  </button>
                </div>
                {staffUploadResult && (
                  <div className={`mx-4 mb-3 rounded-xl p-3 text-sm ${staffUploadResult.errors.length > 0 ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
                    <p className="font-semibold">{staffUploadResult.created} created, {staffUploadResult.updated} updated</p>
                    {staffUploadResult.errors.map((e, i) => <p key={i} className="text-xs text-amber-700 mt-1">{e}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-3.5 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search name, code, role, bunk, camp, job…"
            className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:outline-none text-sm bg-white"
            onFocus={e => (e.currentTarget.style.borderColor = "#023B64")}
            onBlur={e => (e.currentTarget.style.borderColor = "")} />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Group by</span>
          {([["none","None"],["camp","Camp"],["division","Division"],["bunk","Bunk"],["primaryJob","Primary Job"],["secondaryJob","Secondary Job"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setGroupBy(val)}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${groupBy === val ? "text-white" : "bg-white text-slate-500 border border-slate-200"}`}
              style={groupBy === val ? { backgroundColor: "#023B64" } : undefined}>
              {label}
            </button>
          ))}
        </div>

        {(() => {
          const getGroupKey = (s: StaffDoc): string => {
            const sx = s as unknown as { camp?: string; division?: string; primaryJob?: string; secondaryJob?: string };
            switch (groupBy) {
              case "camp": return sx.camp || "No Camp";
              case "division": return sx.division || "No Division";
              case "bunk": return s.bunkAssignment || "No Bunk";
              case "primaryJob": return sx.primaryJob || "No Primary Job";
              case "secondaryJob": return sx.secondaryJob || "No Secondary Job";
              default: return "";
            }
          };

          const groups: Map<string, StaffDoc[]> = new Map();
          for (const s of filtered) {
            const key = groupBy === "none" ? "" : getGroupKey(s);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(s);
          }
          const sortedGroups = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

          const renderStaffRow = (s: StaffDoc) => (
            <div key={s._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button onClick={() => openEdit(s)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                  style={{ backgroundColor: s.isActive === false ? "#94a3b8" : avatarBg(s.name) }}>
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${s.isActive === false ? "text-slate-400" : "text-slate-900"}`}>{s.name}</span>
                    <span className="text-xs font-mono text-slate-400">{s.code}</span>
                    {s.isActive === false && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">Inactive</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: "#023B64" }}>
                      {PRIMARY_ROLE_OPTIONS.find(r => r.value === s.role)?.label ?? ROLE_LABEL[s.role] ?? s.role}
                    </span>
                    {(s.extraRoles ?? []).map(r => (
                      <span key={r} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {ROLE_LABEL[r] ?? r}
                      </span>
                    ))}
                    {s.bunkAssignment && <span className="text-xs text-slate-500">{s.bunkAssignment}</span>}
                    {(s as unknown as { camp?: string }).camp ? <span className="text-xs text-slate-500">{(s as unknown as { camp: string }).camp}</span> : null}
                    {(s as unknown as { primaryJob?: string }).primaryJob ? <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-full">{(s as unknown as { primaryJob: string }).primaryJob}</span> : null}
                    {s.busRoute && (() => {
                      const br = (busRouteList ?? []).find(r => r.name === s.busRoute);
                      return (
                        <span className="text-xs font-semibold flex items-center gap-1">
                          {br?.colorHex && <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: br.colorHex }} />}
                          <span style={{ color: br?.colorHex ?? "#64748b" }}>{s.busRoute}</span>
                        </span>
                      );
                    })()}
                    {s.canBeRunner && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">Runner</span>}
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
              </button>
            </div>
          );

          return (
            <div className="space-y-4">
              {sortedGroups.map(([group, members]) => (
                <div key={group}>
                  {group && (
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-sm font-bold text-slate-700">{group}</span>
                      <span className="text-xs text-slate-400">{members.length}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {members.map(renderStaffRow)}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-slate-400 py-8">No staff found</div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setAdding(false); setEditing(null); }} />
          <div className="relative bg-white rounded-t-3xl overflow-auto max-h-[85vh]">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-slate-200 rounded-full" /></div>
            <div className="px-5 pt-2 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">{editing ? "Edit Staff" : "Add Staff"}</h3>
                <div className="flex items-center gap-2">
                  {editing && (
                    <button onClick={() => handleDelete(editing)}
                      className="text-xs text-red-500 font-semibold px-3 py-1.5 rounded-lg active:bg-red-50">
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>First Name *</label>
                  <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
                    className={inp} placeholder="First name" />
                </div>
                <div>
                  <label className={lbl}>Last Name</label>
                  <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
                    className={inp} placeholder="Last name" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className={inp} placeholder="Email" />
                </div>
                <div>
                  <label className={lbl}>Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className={inp} placeholder="Phone" />
                </div>
              </div>

              <div>
                <label className={lbl}>Login Code *</label>
                <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.replace(/\D/g, "") })}
                  className={`${inp} font-mono`} placeholder="4-digit code" maxLength={6} inputMode="numeric" />
              </div>

              <div>
                <label className={lbl}>Primary Role *</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}
                  className={`${inp} bg-white`}>
                  {PRIMARY_ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <div>
                <label className={lbl}>Additional Roles</label>
                <div className="flex flex-wrap gap-2">
                  {PRIMARY_ROLE_OPTIONS.filter(r => r.value !== form.role).map(r => (
                    <button key={r.value} onClick={() => {
                      const has = form.extraRoles.includes(r.value);
                      setForm({ ...form, extraRoles: has ? form.extraRoles.filter(x => x !== r.value) : [...form.extraRoles, r.value] });
                    }}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                        form.extraRoles.includes(r.value) ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200"
                      }`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Camp</label>
                  <input value={form.camp} onChange={e => setForm({ ...form, camp: e.target.value })}
                    className={inp} placeholder="e.g. Kaleidoscope" />
                </div>
                <div>
                  <label className={lbl}>Division</label>
                  <input value={form.division} onChange={e => setForm({ ...form, division: e.target.value })}
                    className={inp} placeholder="e.g. Upper" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Primary Job</label>
                  <select value={form.primaryJob} onChange={e => setForm({ ...form, primaryJob: e.target.value })}
                    className={`${inp} bg-white`}>
                    <option value="">Select job…</option>
                    {JOB_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Secondary Job</label>
                  <select value={form.secondaryJob} onChange={e => setForm({ ...form, secondaryJob: e.target.value })}
                    className={`${inp} bg-white`}>
                    <option value="">None</option>
                    {JOB_OPTIONS.filter(j => j !== form.primaryJob).map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
              </div>

              {/* Role-based conditional fields */}
              {needsBunk && (
                <div>
                  <label className={lbl}>Assigned Bunk</label>
                  <select value={form.bunkAssignment} onChange={e => setForm({ ...form, bunkAssignment: e.target.value })}
                    className={`${inp} bg-white`}>
                    <option value="">Select bunk…</option>
                    {bunks.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              )}

              {needsUnit && (
                <div>
                  <label className={lbl}>Assigned Unit</label>
                  <select value={form.unitAssignment} onChange={e => setForm({ ...form, unitAssignment: e.target.value })}
                    className={`${inp} bg-white`}>
                    <option value="">Select unit…</option>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {form.unitAssignment && bunks.length > 0 && (
                    <div className="mt-1.5">
                      <p className="text-[10px] text-slate-400">Bunks in {form.unitAssignment}:</p>
                      <p className="text-xs text-slate-500">{bunks.filter(b => b.toLowerCase().startsWith(form.unitAssignment.toLowerCase())).join(", ") || "None found"}</p>
                    </div>
                  )}
                </div>
              )}

              {(needsBunk || needsUnit) && (
                <div>
                  <label className={lbl}>Camp Section</label>
                  <select value={form.campSection} onChange={e => setForm({ ...form, campSection: e.target.value })}
                    className={`${inp} bg-white`}>
                    <option value="">Select section…</option>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              )}

              {needsBus && (
                <div>
                  <label className={lbl}>Bus Route</label>
                  <select value={form.busRoute} onChange={e => setForm({ ...form, busRoute: e.target.value })}
                    className={`${inp} bg-white`}>
                    <option value="">Select bus route…</option>
                    {(busRouteList ?? []).filter(r => r.isActive !== false).sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99)).map(r => (
                      <option key={r._id} value={r.name}>{r.name}{r.color ? ` (${r.color})` : ""}{r.isActive === false ? " — Inactive" : ""}</option>
                    ))}
                  </select>
                  {form.busRoute && (() => {
                    const br = (busRouteList ?? []).find(r => r.name === form.busRoute);
                    if (!br) return null;
                    return (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: br.colorHex ?? "#023B64" }} />
                        <span className="text-xs text-slate-500">{br.color ?? br.name}</span>
                        {br.isActive === false && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">Inactive route</span>}
                      </div>
                    );
                  })()}
                </div>
              )}

              {needsRunner && (
                <div>
                  <label className={lbl}>Runner Label</label>
                  <input value={form.runnerLabel} onChange={e => setForm({ ...form, runnerLabel: e.target.value })}
                    className={inp} placeholder="e.g. Runner 1" />
                </div>
              )}

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={form.canBeRunner} onChange={e => setForm({ ...form, canBeRunner: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300" />
                  Can be runner
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300" />
                  Active
                </label>
              </div>

              <button onClick={handleSave}
                className="w-full py-3 text-sm font-bold text-white rounded-xl active:opacity-80"
                style={{ backgroundColor: "#023B64" }}>
                {editing ? "Save Changes" : "Add Staff Member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Camper CSV Upload ────────────────────────────────────────────────────────

type CsvRow = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
  }
  fields.push(cur.trim());
  return fields;
}

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  // Uniquify headers: blank columns become "Column N", duplicates get a suffix.
  // Messy exports (e.g. a Google Doc table) often repeat or omit header names,
  // which would otherwise collide as React keys and clobber row data.
  const rawHeaders = parseCsvLine(lines[0]).map(h => h.replace(/^"|"$/g, "").trim());
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h, j) => {
    const base = h || `Column ${j + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    const row: CsvRow = {};
    headers.forEach((h, j) => { row[h] = vals[j] ?? ""; });
    rows.push(row);
  }
  return { headers, rows };
}

// ─── Upload field map ─────────────────────────────────────────────────────────

const CAMPER_FIELDS: { key: string; label: string; required: boolean; boolean?: boolean }[] = [
  { key: "preferredName",   label: "Preferred Name",    required: true  },
  { key: "lastName",        label: "Last Name",         required: false },
  { key: "bunk",            label: "Group",             required: true  },
  { key: "camp",            label: "Camp",              required: false },
  { key: "code",            label: "Safety Code",       required: true  },
  { key: "arrivalMethod",   label: "Arrival Method",    required: true  },
  { key: "dismissalMethod", label: "Dismissal Method",  required: true  },
  { key: "grade",           label: "Grade",             required: false },
  { key: "photoUrl",        label: "Photo URL",         required: false },
  { key: "allergyNotes",    label: "Allergy Notes",     required: false },
  { key: "camperNotes",     label: "Camper Notes",      required: false },
  { key: "busStop",         label: "Bus Stop",          required: false },
  { key: "walkPermission",  label: "Walk Permission",   required: false, boolean: true },
  { key: "afterCareProgram", label: "After Care Program", required: false },
];

const parseBool = (val: string) =>
  ["true", "1", "yes"].includes(val.toLowerCase().trim());

const normalizeBusRoute = (val: string) => {
  const t = val.trim();
  return /^[1-6]$/.test(t) ? `Bus ${t}` : t;
};

// CampMinder exports photoUrl as an <img> tag — extract the src attribute if present.
const normalizePhotoUrl = (val: string): string => {
  const t = val.trim();
  if (!t) return "";
  const match = t.match(/src=['"]([^'"]+)['"]/i);
  return match ? match[1] : t.startsWith("http") ? t : "";
};

const csvEscape = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  const s = typeof val === "object" ? JSON.stringify(val) : String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"` : s;
};

const EXPORT_COLUMNS = [
  "preferredName","lastName","photoUrl",
  "bunk","grade","code",
  "arrivalMethod","dismissalMethod",
  "allergyDetails","camperNotes",
  "bunkConfirmed","leftEarly",
  "status","runner",
  "exportDate","exportTime",
];

// ─── CamperUpload ─────────────────────────────────────────────────────────────

function normalizeBunkName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fuzzyBunkMatch(input: string, knownBunks: string[]): string | null {
  const norm = normalizeBunkName(input);
  if (!norm) return null;
  for (const b of knownBunks) {
    if (normalizeBunkName(b) === norm) return b;
  }
  for (const b of knownBunks) {
    const nb = normalizeBunkName(b);
    if (nb.includes(norm) || norm.includes(nb)) return b;
  }
  return null;
}

type BunkIssue = {
  csvBunk: string;
  rows: number[];
  suggestion: string | null;
  resolution: "match" | "create" | "skip" | null;
  matchTo: string;
};

function CamperUpload() {
  const allCampers   = useQuery(api.campers.list);
  const campStructure = useQuery(api.campStructure.list);
  const createCamper    = useMutation(api.campers.create);
  const deleteAll       = useMutation(api.campers.deleteAllCampers);
  const clearDailyState = useMutation(api.campers.clearDailyState);
  const createStructure = useMutation(api.campStructure.create);

  // Upload flow
  const [step, setStep]       = useState<"pick"|"map"|"preview"|"bunkReview"|"done">("pick");
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: CsvRow[] }>({ headers: [], rows: [] });
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]   = useState<{ added: number; skipped: number; errors: string[] }>({ added: 0, skipped: 0, errors: [] });
  const [bunkIssues, setBunkIssues] = useState<BunkIssue[]>([]);

  // Clear modal
  const [showClear, setShowClear]         = useState(false);
  const [clearText, setClearText]         = useState("");
  const [clearing, setClearing]           = useState(false);
  const [clearSuccess, setClearSuccess]   = useState(false);

  // Instructions panel
  const [showInstructions, setShowInstructions] = useState(false);

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!allCampers?.length) return;
    const now      = new Date();
    const dateStr  = now.toISOString().split("T")[0];
    const timeStr  = now.toLocaleTimeString();
    const rows = allCampers.map(c => {
      const rec = c as Record<string, unknown>;
      return EXPORT_COLUMNS.map(col => {
        if (col === "exportDate") return csvEscape(dateStr);
        if (col === "exportTime") return csvEscape(timeStr);
        return csvEscape(rec[col]);
      }).join(",");
    });
    const csv  = [EXPORT_COLUMNS.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: `jcamps-attendance-export-${dateStr}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Clear ───────────────────────────────────────────────────────────────────
  const handleClear = async () => {
    setClearing(true);
    await deleteAll({});
    setClearing(false);
    setClearSuccess(true);
    setClearText("");
  };

  // ── File picker ─────────────────────────────────────────────────────────────
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCsv(ev.target?.result as string);
      setCsvData(parsed);
      const PHOTO_ALIASES = ["photo", "camperphoto", "camperpicture", "picture", "headshot", "photourl", "photo url", "camper photo"];
      const GROUP_ALIASES = ["group", "bunk", "cabin", "team"];
      const ALLERGY_ALIASES = ["allergynotes", "allergydetails", "allergies", "allergy"];
      const NOTES_ALIASES = ["campernotes", "notes", "camper notes"];
      const autoMap: Record<string, string> = {};
      for (const field of CAMPER_FIELDS) {
        const match = parsed.headers.find(h => {
          const norm = h.toLowerCase().replace(/[^a-z0-9]/g, "");
          const low = h.toLowerCase().trim();
          if (field.key === "photoUrl") return PHOTO_ALIASES.includes(norm) || PHOTO_ALIASES.includes(low);
          if (field.key === "bunk") return GROUP_ALIASES.includes(norm) || GROUP_ALIASES.includes(low);
          if (field.key === "allergyNotes") return ALLERGY_ALIASES.includes(norm) || ALLERGY_ALIASES.includes(low);
          if (field.key === "camperNotes") return NOTES_ALIASES.includes(norm) || NOTES_ALIASES.includes(low);
          return norm === field.key.toLowerCase().replace(/[^a-z0-9]/g, "")
            || low.replace(/[^a-z]/g, "").includes(field.label.toLowerCase().replace(/[^a-z]/g, ""));
        });
        if (match) autoMap[field.key] = match;
      }
      setMapping(autoMap);
      setStep("map");
    };
    reader.readAsText(file);
  };

  // ── Preview & warnings ──────────────────────────────────────────────────────
  const buildWarnings = () => {
    const w: string[] = [];
    const seenCodes = new Map<string, number>();
    const seenNames = new Map<string, number>();
    csvData.rows.forEach((row, i) => {
      const rowNum = i + 2;
      const code = row[mapping.code]?.trim();
      const preferredName = row[mapping.preferredName]?.trim();
      const lastName  = mapping.lastName ? row[mapping.lastName]?.trim() : "";
      const bunk = row[mapping.bunk]?.trim();
      if (!preferredName) w.push(`Row ${rowNum}: missing preferred name`);
      if (!bunk) w.push(`Row ${rowNum}: missing group`);
      if (!code) w.push(`Row ${rowNum}: missing safety code`);
      if (code) {
        if (seenCodes.has(code)) w.push(`Row ${rowNum}: duplicate code "${code}" (also row ${seenCodes.get(code)})`);
        else seenCodes.set(code, rowNum);
      }
      if (preferredName) {
        const fullName = `${preferredName} ${lastName}`.trim();
        if (seenNames.has(fullName)) w.push(`Row ${rowNum}: duplicate name "${fullName}" (also row ${seenNames.get(fullName)})`);
        else seenNames.set(fullName, rowNum);
      }
    });
    return w;
  };

  const goToPreview = () => {
    setWarnings(buildWarnings());
    const knownBunks = (campStructure ?? []).filter(s => s.isActive !== false).map(s => s.bunk);
    if (knownBunks.length > 0) {
      const bunkRows = new Map<string, number[]>();
      csvData.rows.forEach((row, i) => {
        const bunk = row[mapping.bunk]?.trim();
        if (bunk) {
          if (!bunkRows.has(bunk)) bunkRows.set(bunk, []);
          bunkRows.get(bunk)!.push(i + 2);
        }
      });
      const issues: BunkIssue[] = [];
      for (const [csvBunk, rows] of bunkRows) {
        if (knownBunks.includes(csvBunk)) continue;
        const suggestion = fuzzyBunkMatch(csvBunk, knownBunks);
        issues.push({ csvBunk, rows, suggestion, resolution: suggestion ? "match" : null, matchTo: suggestion ?? "" });
      }
      if (issues.length > 0) {
        setBunkIssues(issues);
        setStep("bunkReview");
        return;
      }
    }
    setStep("preview");
  };

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    setUploading(true);
    let added = 0, skipped = 0;
    const errors: string[] = [];
    for (let i = 0; i < csvData.rows.length; i++) {
      const row = csvData.rows[i];
      try {
        const preferredName = row[mapping.preferredName]?.trim() ?? "";
        const bunk = row[mapping.bunk]?.trim() ?? "";
        const code = row[mapping.code]?.trim() ?? "";
        const arrivalMethod = row[mapping.arrivalMethod]?.trim() ?? "";
        const dismissalMethod = row[mapping.dismissalMethod]?.trim() ?? "";
        if (!preferredName || !bunk || !code) {
          errors.push(`Row ${i + 2}: missing required field (preferredName/group/code)`);
          skipped++;
          continue;
        }
        const camper: Record<string, unknown> = {
          name: preferredName,
          preferredName,
          bunk,
          code,
          status: "Waiting" as const,
        };

        if (arrivalMethod) camper.arrivalMethod = arrivalMethod;
        if (dismissalMethod) camper.dismissalMethod = dismissalMethod;

        // Optional fields
        const lastName = mapping.lastName && row[mapping.lastName]?.trim();
        if (lastName) camper.lastName = lastName;

        const grade = mapping.grade && row[mapping.grade]?.trim();
        if (grade) camper.grade = grade;

        const camp = mapping.camp && row[mapping.camp]?.trim();
        if (camp) camper.camp = camp;

        if (mapping.photoUrl) {
          const url = normalizePhotoUrl(row[mapping.photoUrl] ?? "");
          if (url) camper.photoUrl = url;
        }

        // Allergy notes — text drives the flag
        const allergyNotes = mapping.allergyNotes && row[mapping.allergyNotes]?.trim();
        if (allergyNotes) {
          camper.allergyDetails = allergyNotes;
          camper.hasAllergies = true;
        }

        // Camper notes — text drives the flag
        const camperNotes = mapping.camperNotes && row[mapping.camperNotes]?.trim();
        if (camperNotes) {
          camper.camperNotes = camperNotes;
          camper.hasNotes = true;
        }

        // Bus fields
        const busStop = mapping.busStop && row[mapping.busStop]?.trim();
        if (busStop) camper.busStop = busStop;

        const walkPerm = mapping.walkPermission && row[mapping.walkPermission]?.trim();
        if (walkPerm) camper.walkPermission = parseBool(walkPerm);

        const acProgram = mapping.afterCareProgram && row[mapping.afterCareProgram]?.trim();
        if (acProgram) camper.afterCareProgram = acProgram;

        await createCamper(camper as Parameters<typeof createCamper>[0]);
        added++;
      } catch (err: unknown) {
        errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : "failed"}`);
        skipped++;
      }
    }
    setResult({ added, skipped, errors });
    setUploading(false);
    setStep("done");
  };

  const requiredMapped = CAMPER_FIELDS.filter(f => f.required).every(f => mapping[f.key]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-10">

      {/* Header */}
      <h2 className="text-xl font-bold" style={{ color: "#023B64" }}>Upload &amp; Data Management</h2>

      {/* Admin tools */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin Tools</p>
        </div>

        {/* Reset Attendance */}
        <button onClick={() => {
            if (confirm("Reset all attendance?\n\nThis clears today's In/Out status, arrivals, and dismissal state for all campers.\n\nCamper records, staff, and daily overrides are NOT deleted.")) {
              clearDailyState();
            }
          }} disabled={!allCampers?.length}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-slate-100 active:bg-slate-50 disabled:opacity-40">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <RotateCcw size={16} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Reset Attendance</p>
            <p className="text-xs text-slate-400 mt-0.5">Clear all In/Out status for a new day</p>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </button>

        {/* Export */}
        <button onClick={handleExport} disabled={!allCampers?.length}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-slate-100 active:bg-slate-50 disabled:opacity-40">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <ArrowRight size={16} className="text-blue-600 -rotate-90" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Export Today's Data CSV</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {allCampers ? `${allCampers.length} campers · all live state` : "Loading…"}
            </p>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </button>

        {/* Clear */}
        <button onClick={() => { setShowClear(true); setClearSuccess(false); setClearText(""); }}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-red-50">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <X size={16} className="text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-600">Clear All Camper Data</p>
            <p className="text-xs text-slate-400 mt-0.5">Remove all campers before uploading a new file. Staff unaffected.</p>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </button>
      </div>

      {/* CSV Format Instructions */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <button onClick={() => setShowInstructions(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-slate-50">
          <div>
            <p className="text-sm font-semibold text-slate-900">CSV Format for Camper Upload</p>
            <p className="text-xs text-slate-400 mt-0.5">Column names, accepted values, and sample row</p>
          </div>
          {showInstructions ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>

        {showInstructions && (
          <div className="border-t border-slate-100 px-4 py-4 space-y-4 text-sm">

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Required columns</p>
              <div className="flex flex-wrap gap-1.5">
                {["preferredName","group","code","arrivalMethod","dismissalMethod"].map(c => (
                  <span key={c} className="px-2 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-mono font-semibold">{c}</span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Optional columns</p>
              <div className="flex flex-wrap gap-1.5">
                {["lastName","camp","grade","photoUrl","allergyNotes","camperNotes"].map(c => (
                  <span key={c} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-mono">{c}</span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Accepted values</p>
              <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-xs">
                <p><span className="font-semibold">arrivalMethod:</span> <span className="text-slate-500">Carline · Before Care · Bus 1 · Bus 2 · Bus 3 · Bus 4 · Bus 5 · Bus 6</span></p>
                <p><span className="font-semibold">dismissalMethod:</span> <span className="text-slate-500">Carline · After Care · Bus 1 · Bus 2 · Bus 3 · Bus 4 · Bus 5 · Bus 6</span></p>
                <p><span className="font-semibold">code:</span> <span className="text-slate-500">3-digit pickup code</span></p>
                <p><span className="font-semibold">allergyNotes:</span> <span className="text-slate-500">Text description — allergy flag auto-shows if not blank</span></p>
                <p><span className="font-semibold">camperNotes:</span> <span className="text-slate-500">Text — notes flag auto-shows if not blank</span></p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sample header row</p>
              <div className="bg-slate-900 text-green-300 rounded-xl p-3 text-[10px] font-mono overflow-x-auto whitespace-nowrap">
                preferredName,lastName,group,camp,code,arrivalMethod,dismissalMethod,grade,photoUrl,allergyNotes,camperNotes
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sample data row</p>
              <div className="bg-slate-900 text-green-300 rounded-xl p-3 text-[10px] font-mono overflow-x-auto whitespace-nowrap">
                Jake,Cohen,Group A,123,Carline,Bus 2,1st,,Peanut allergy,Needs help transitioning
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ── Upload Flow ── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upload Camper CSV</p>
        </div>

        {/* Step: Pick */}
        {step === "pick" && (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
              <ArrowRight size={24} className="text-slate-400 -rotate-90" />
            </div>
            <div>
              <p className="text-slate-700 font-medium">Choose a CSV file to upload</p>
              <p className="text-xs text-slate-400 mt-1">Required: preferredName, group, code, arrivalMethod, dismissalMethod</p>
            </div>
            <label className="inline-block cursor-pointer">
              <span className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl active:opacity-80"
                style={{ backgroundColor: "#023B64" }}>
                Choose CSV File
              </span>
              <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
            </label>
          </div>
        )}

        {/* Step: Map */}
        {step === "map" && (
          <div className="divide-y divide-slate-100">
            <div className="px-4 py-3 bg-slate-50">
              <p className="text-sm font-semibold text-slate-700">{csvData.rows.length} rows · {csvData.headers.length} columns detected</p>
              <p className="text-xs text-slate-400 mt-0.5">Map your CSV columns to camper fields, then preview</p>
            </div>
            {CAMPER_FIELDS.map(field => (
              <div key={field.key} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-900">{field.label}</span>
                  {field.required && <span className="text-red-500 text-xs ml-1">*</span>}
                  {field.boolean && <span className="text-slate-400 text-xs ml-1">bool</span>}
                </div>
                <select value={mapping[field.key] ?? ""}
                  onChange={e => setMapping({ ...mapping, [field.key]: e.target.value })}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none max-w-[150px]">
                  <option value="">— skip —</option>
                  {csvData.headers.map((h, i) => <option key={`${h}__${i}`} value={h}>{h || `(column ${i + 1})`}</option>)}
                </select>
              </div>
            ))}
            <div className="p-4 flex gap-3">
              <button onClick={() => setStep("pick")}
                className="flex-1 py-3 text-sm font-semibold text-slate-500 bg-slate-100 rounded-xl active:bg-slate-200">
                Back
              </button>
              <button onClick={goToPreview} disabled={!requiredMapped}
                className="flex-1 py-3 text-sm font-bold text-white rounded-xl disabled:opacity-40"
                style={{ backgroundColor: "#023B64" }}>
                Preview →
              </button>
            </div>
          </div>
        )}

        {/* Step: Bunk Review */}
        {step === "bunkReview" && (
          <div className="space-y-4 p-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-amber-800">Bunk validation</p>
              <p className="text-xs text-amber-700 mt-1">
                {bunkIssues.length} bunk{bunkIssues.length !== 1 ? "s" : ""} in your CSV {bunkIssues.length !== 1 ? "don't" : "doesn't"} match
                the camp structure. Resolve each one before uploading.
              </p>
            </div>

            {bunkIssues.map((issue, idx) => {
              const knownBunks = (campStructure ?? []).filter(s => s.isActive !== false).map(s => s.bunk);
              return (
                <div key={issue.csvBunk} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                    <span className="font-bold text-slate-900 text-sm">"{issue.csvBunk}"</span>
                    <span className="text-xs text-slate-400">({issue.rows.length} camper{issue.rows.length !== 1 ? "s" : ""})</span>
                  </div>

                  {issue.suggestion && (
                    <p className="text-xs text-slate-500">
                      Did you mean <span className="font-bold text-slate-700">"{issue.suggestion}"</span>?
                    </p>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => {
                      const updated = [...bunkIssues];
                      updated[idx] = { ...issue, resolution: "match", matchTo: issue.suggestion ?? "" };
                      setBunkIssues(updated);
                    }}
                      className={`text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${
                        issue.resolution === "match" ? "text-white" : "bg-slate-100 text-slate-600"
                      }`}
                      style={issue.resolution === "match" ? { backgroundColor: "#023B64" } : undefined}
                      disabled={!issue.suggestion && !issue.matchTo}>
                      Match to existing
                    </button>
                    <button onClick={() => {
                      const updated = [...bunkIssues];
                      updated[idx] = { ...issue, resolution: "create" };
                      setBunkIssues(updated);
                    }}
                      className={`text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${
                        issue.resolution === "create" ? "text-white bg-green-600" : "bg-slate-100 text-slate-600"
                      }`}>
                      Create new bunk
                    </button>
                    <button onClick={() => {
                      const updated = [...bunkIssues];
                      updated[idx] = { ...issue, resolution: "skip" };
                      setBunkIssues(updated);
                    }}
                      className={`text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${
                        issue.resolution === "skip" ? "text-white bg-red-500" : "bg-slate-100 text-slate-600"
                      }`}>
                      Skip these rows
                    </button>
                  </div>

                  {issue.resolution === "match" && (
                    <select value={issue.matchTo}
                      onChange={e => {
                        const updated = [...bunkIssues];
                        updated[idx] = { ...issue, matchTo: e.target.value };
                        setBunkIssues(updated);
                      }}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white">
                      <option value="">Select bunk…</option>
                      {knownBunks.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  )}
                </div>
              );
            })}

            <div className="flex gap-3">
              <button onClick={() => setStep("map")}
                className="flex-1 py-3 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl active:bg-slate-200">
                Back
              </button>
              <button onClick={async () => {
                const allResolved = bunkIssues.every(i => i.resolution !== null);
                if (!allResolved) return;
                for (const issue of bunkIssues) {
                  if (issue.resolution === "create") {
                    try {
                      await createStructure({ camp: "Unassigned", division: "Unassigned", bunk: issue.csvBunk });
                    } catch { /* already exists */ }
                  }
                  if (issue.resolution === "match" && issue.matchTo) {
                    for (const row of csvData.rows) {
                      if (row[mapping.bunk]?.trim() === issue.csvBunk) {
                        row[mapping.bunk] = issue.matchTo;
                      }
                    }
                  }
                }
                const skippedBunks = new Set(bunkIssues.filter(i => i.resolution === "skip").map(i => i.csvBunk));
                if (skippedBunks.size > 0) {
                  setCsvData({
                    ...csvData,
                    rows: csvData.rows.filter(r => !skippedBunks.has(r[mapping.bunk]?.trim())),
                  });
                }
                setStep("preview");
              }}
                disabled={bunkIssues.some(i => i.resolution === null || (i.resolution === "match" && !i.matchTo))}
                className="flex-1 py-3 text-sm font-bold text-white rounded-xl active:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: "#023B64" }}>
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="space-y-0 divide-y divide-slate-100">
            <div className="px-4 py-3 bg-slate-50">
              <p className="text-sm font-semibold text-slate-700">Preview · first 5 rows</p>
              <p className="text-xs text-slate-400 mt-0.5">{csvData.rows.length} total rows to import</p>
            </div>

            {/* Preview rows */}
            {csvData.rows.slice(0, 5).map((row, i) => {
              const pref   = row[mapping.preferredName]?.trim() || "—";
              const last   = mapping.lastName ? row[mapping.lastName]?.trim() : "";
              const bunk   = row[mapping.bunk]?.trim() || "—";
              const code   = row[mapping.code]?.trim() || "—";
              const arrival   = mapping.arrivalMethod ? row[mapping.arrivalMethod]?.trim() : "";
              const dismissal = mapping.dismissalMethod ? row[mapping.dismissalMethod]?.trim() : "";
              return (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-slate-400 w-5 flex-shrink-0">#{i + 2}</span>
                    <span className="font-semibold text-slate-900 text-sm">{pref}{last ? ` ${last}` : ""}</span>
                  </div>
                  <div className="flex gap-2 mt-1 ml-7 flex-wrap">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{bunk}</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">#{code}</span>
                    {arrival && <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">→ {arrival}</span>}
                    {dismissal && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">← {dismissal}</span>}
                  </div>
                </div>
              );
            })}
            {csvData.rows.length > 5 && (
              <div className="px-4 py-3 text-xs text-slate-400">
                …and {csvData.rows.length - 5} more rows
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="px-4 py-4 bg-amber-50 space-y-2">
                <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle size={13} /> {warnings.length} warning{warnings.length !== 1 ? "s" : ""} — review before importing
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700">{w}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 flex gap-3">
              <button onClick={() => setStep("map")}
                className="flex-1 py-3 text-sm font-semibold text-slate-500 bg-slate-100 rounded-xl active:bg-slate-200">
                Back
              </button>
              <button onClick={handleUpload} disabled={uploading}
                className="flex-1 py-3 text-sm font-bold text-white rounded-xl disabled:opacity-50 active:opacity-80"
                style={{ backgroundColor: "#023B64" }}>
                {uploading ? "Importing…" : `Import ${csvData.rows.length} Campers`}
              </button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="p-6 space-y-4">
            <div className="text-center">
              <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
              <p className="text-lg font-bold text-slate-900">Imported {result.added} camper{result.added !== 1 ? "s" : ""}</p>
              {result.skipped > 0 && <p className="text-sm text-slate-500 mt-0.5">Skipped {result.skipped} rows</p>}
              {warnings.length > 0 && <p className="text-sm text-amber-600 mt-0.5">Warnings: {warnings.length}</p>}
            </div>
            {result.errors.length > 0 && (
              <div className="bg-red-50 rounded-xl p-3 max-h-40 overflow-y-auto space-y-0.5">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600">{err}</p>
                ))}
              </div>
            )}
            <button onClick={() => { setStep("pick"); setCsvData({ headers: [], rows: [] }); setMapping({}); setWarnings([]); }}
              className="w-full py-3 text-sm font-bold text-white rounded-xl active:opacity-80"
              style={{ backgroundColor: "#023B64" }}>
              Upload Another File
            </button>
          </div>
        )}
      </div>

      {/* ── Clear Camper Data Modal ── */}
      {showClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!clearing) { setShowClear(false); setClearText(""); setClearSuccess(false); }}} />
          <div className="relative bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

            {clearSuccess ? (
              <div className="p-8 text-center space-y-4">
                <CheckCircle2 size={44} className="text-green-500 mx-auto" />
                <p className="font-bold text-slate-900 text-lg">All camper data cleared</p>
                <p className="text-sm text-slate-500">You can now upload a new camper CSV file.</p>
                <button onClick={() => { setShowClear(false); setClearSuccess(false); }}
                  className="w-full py-3 text-sm font-bold text-white rounded-xl"
                  style={{ backgroundColor: "#023B64" }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle size={20} className="text-red-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">Clear All Camper Data</p>
                      <p className="text-xs text-slate-500 mt-0.5">This cannot be undone</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed">
                    You are about to delete <span className="font-bold">all camper data</span>. This should only be done before uploading a new weekly camper file. Staff accounts will not be deleted. <span className="font-semibold text-red-600">This cannot be undone unless you exported a backup first.</span>
                  </p>

                  {/* Export reminder */}
                  <button onClick={handleExport} disabled={!allCampers?.length}
                    className="w-full flex items-center gap-2 justify-center py-2.5 border border-blue-200 rounded-xl text-sm font-semibold text-blue-700 bg-blue-50 active:bg-blue-100 disabled:opacity-40">
                    <ArrowRight size={15} className="-rotate-90" /> Export Today's Data First
                  </button>

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500">
                      Type <span className="font-mono font-bold text-red-600">DELETE CAMPERS</span> to confirm
                    </p>
                    <input
                      value={clearText}
                      onChange={e => setClearText(e.target.value)}
                      placeholder="DELETE CAMPERS"
                      className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-red-400"
                    />
                  </div>
                </div>

                <div className="flex border-t border-slate-100">
                  <button onClick={() => { setShowClear(false); setClearText(""); }}
                    className="flex-1 py-3.5 text-sm font-semibold text-slate-500 active:bg-slate-50">
                    Cancel
                  </button>
                  <button
                    onClick={handleClear}
                    disabled={clearText !== "DELETE CAMPERS" || clearing}
                    className="flex-1 py-3.5 text-sm font-bold text-white disabled:opacity-40 active:opacity-80"
                    style={{ backgroundColor: "#DC2626" }}>
                    {clearing ? "Deleting…" : "Delete All Campers"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
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
