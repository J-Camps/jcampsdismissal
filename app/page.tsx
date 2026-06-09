"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  Car, Footprints, Radio, User, Settings, Lock, Search, RotateCcw,
  Check, ChevronRight, AlertCircle, Clock, MapPin, Users,
  AlertTriangle, UtensilsCrossed, LogOut, Bus,
} from "lucide-react";

// Runner labels — used by Dispatcher to assign, and by runners to filter their queue
const RUNNERS = ["Runner 1", "Runner 2", "Runner 3", "Runner 4"];
const STATUSES = ["Waiting", "Called", "Assigned", "Picked Up", "Dismissed"] as const;

const STATUS_STYLE: Record<string, string> = {
  Waiting: "bg-slate-100 text-slate-500",
  Called: "bg-amber-100 text-amber-700",
  Assigned: "bg-blue-100 text-blue-700",
  "Picked Up": "bg-violet-100 text-violet-700",
  Dismissed: "bg-green-100 text-green-700",
};

const TRANSPORT_LABEL: Record<string, string> = {
  Bus: "Bus",
  AfterCare: "After Care",
  Carline: "Car Line",
  WalkUp: "Walk-Up",
};

const TRANSPORT_STYLE: Record<string, string> = {
  Bus: "bg-blue-100 text-blue-700",
  AfterCare: "bg-purple-100 text-purple-700",
  Carline: "bg-green-100 text-green-700",
  WalkUp: "bg-orange-100 text-orange-700",
};

const TRANSPORT_ORDER = ["Bus", "Carline", "WalkUp", "AfterCare", "Other"];

const fmt = (ts?: number) =>
  ts
    ? new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

type StaffDoc = Doc<"staff">;
type CamperDoc = Doc<"campers">;

// ─── Root ────────────────────────────────────────────────────────────────────

export default function App() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <AppInner />;
}

function AppInner() {
  const [staff, setStaff] = useState<StaffDoc | null>(null);
  if (!staff) return <LockScreen onUnlock={setStaff} />;
  return <RoleRouter staff={staff} onLogout={() => setStaff(null)} />;
}

// ─── Lock Screen ─────────────────────────────────────────────────────────────

function LockScreen({ onUnlock }: { onUnlock: (staff: StaffDoc) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const staffResult = useQuery(
    api.staff.getByCode,
    code.length > 0 ? { code } : "skip",
  );

  const handleUnlock = () => {
    if (code.length === 0) return;
    if (staffResult === undefined) return; // still loading
    if (!staffResult) {
      setError("Invalid code. Please try again.");
      return;
    }
    onUnlock(staffResult);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-full bg-slate-900 flex items-center justify-center mx-auto mb-4">
          <Lock className="text-white" size={24} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">JCamp</h1>
        <p className="text-slate-500 text-sm mt-1 mb-6">Enter your staff code</p>
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
          placeholder="• • • •"
          type="password"
          autoComplete="off"
          className="w-full text-center text-2xl tracking-widest border border-slate-300 rounded-xl py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
        <button
          onClick={handleUnlock}
          disabled={staffResult === undefined && code.length > 0}
          className="w-full bg-slate-900 text-white rounded-xl py-3 font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          {staffResult === undefined && code.length > 0 ? "Checking…" : "Sign In"}
        </button>
      </div>
    </div>
  );
}

// ─── Role Router ─────────────────────────────────────────────────────────────

function RoleRouter({ staff, onLogout }: { staff: StaffDoc; onLogout: () => void }) {
  // Single-view roles go straight to their screen
  if (staff.role === "counselor") {
    return (
      <SingleViewShell staff={staff} onLogout={onLogout}>
        <CounselorView staff={staff} />
      </SingleViewShell>
    );
  }

  if (staff.role === "runner") {
    return (
      <SingleViewShell staff={staff} onLogout={onLogout}>
        <RunnerView runnerName={staff.runnerLabel ?? staff.name} />
      </SingleViewShell>
    );
  }

  if (staff.role === "carline") {
    return (
      <SingleViewShell staff={staff} onLogout={onLogout}>
        <Caller source="Carline" />
      </SingleViewShell>
    );
  }

  if (staff.role === "walkup") {
    return (
      <SingleViewShell staff={staff} onLogout={onLogout}>
        <Caller source="Walk-Up" />
      </SingleViewShell>
    );
  }

  if (staff.role === "dispatcher") {
    return (
      <SingleViewShell staff={staff} onLogout={onLogout}>
        <Dispatcher />
      </SingleViewShell>
    );
  }

  // Multi-tab roles: director and admin
  return <MultiTabView staff={staff} onLogout={onLogout} />;
}

// Shell for single-view roles (no tab bar)
function SingleViewShell({
  staff,
  onLogout,
  children,
}: {
  staff: StaffDoc;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader staff={staff} onLogout={onLogout} />
      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

// Shell for multi-tab roles
function MultiTabView({ staff, onLogout }: { staff: StaffDoc; onLogout: () => void }) {
  const allTabs = [
    { id: "carline", label: "Carline", icon: Car, roles: ["admin"] },
    { id: "walkup", label: "Walk-Up", icon: Footprints, roles: ["admin"] },
    { id: "dispatcher", label: "Dispatcher", icon: Radio, roles: ["admin"] },
    { id: "runner", label: "Runner", icon: User, roles: ["admin"] },
    { id: "admin", label: "Admin", icon: Settings, roles: ["admin", "director"] },
  ] as const;

  const tabs = allTabs.filter((t) =>
    (t.roles as readonly string[]).includes(staff.role),
  );
  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id ?? "admin");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 overflow-x-auto">
          <span className="font-bold text-slate-900 whitespace-nowrap mr-2">JCamp</span>
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <span className="text-sm text-slate-500 hidden sm:block">{staff.name}</span>
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === "carline" && <Caller source="Carline" />}
        {activeTab === "walkup" && <Caller source="Walk-Up" />}
        {activeTab === "dispatcher" && <Dispatcher />}
        {activeTab === "runner" && <RunnerAdminView />}
        {activeTab === "admin" && <Admin />}
      </main>
    </div>
  );
}

function AppHeader({ staff, onLogout }: { staff: StaffDoc; onLogout: () => void }) {
  const roleLabel: Record<string, string> = {
    counselor: "Counselor",
    carline: "Carline",
    walkup: "Walk-Up",
    dispatcher: "Dispatcher",
    runner: "Runner",
    director: "Director",
    admin: "Admin",
  };
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
        <span className="font-bold text-slate-900">JCamp</span>
        <span className="text-sm text-slate-600 mr-auto">{staff.name}</span>
        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
          {roleLabel[staff.role] ?? staff.role}
        </span>
        <button
          onClick={onLogout}
          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

// ─── Counselor View ───────────────────────────────────────────────────────────

function CounselorView({ staff }: { staff: StaffDoc }) {
  const bunk = staff.bunkAssignment ?? "";
  const roster = useQuery(
    api.campers.getBunkRoster,
    bunk ? { bunk } : "skip",
  );
  const confirmWithBunk = useMutation(api.campers.confirmWithBunk);
  const updateArrival = useMutation(api.campers.updateArrival);
  const unconfirm = useMutation(api.campers.unconfirmWithBunk);

  if (!bunk) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
        No bunk assigned to your account. Contact an administrator.
      </div>
    );
  }

  if (roster === undefined) return <Loading />;

  const confirmedCount = roster.filter((c) => c.bunkConfirmed).length;
  const arrivedCount = roster.filter((c) => c.arrivalStatus === "Arrived" || c.bunkConfirmed).length;
  const calledCampers = roster.filter(
    (c) => c.status === "Called" || c.status === "Assigned",
  );

  // Group by transport type in a fixed order
  const groups: Record<string, CamperDoc[]> = {};
  for (const key of TRANSPORT_ORDER) groups[key] = [];
  for (const c of roster) {
    const key = c.transportationType ?? "Other";
    (groups[key] ?? (groups["Other"] ??= [])).push(c);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Users size={22} className="text-slate-700" />
        <h2 className="text-xl font-bold text-slate-900">{bunk}</h2>
        <span className="text-sm text-slate-500 ml-auto">
          {confirmedCount}/{roster.length} confirmed
        </span>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="Total" value={roster.length} color="slate" />
        <StatCard label="Arrived" value={arrivedCount} color="green" />
        <StatCard label="With Bunk" value={confirmedCount} color="blue" />
      </div>

      {/* Dismissal alerts — float to top */}
      {calledCampers.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-5">
          <p className="text-amber-800 font-semibold text-sm mb-2 flex items-center gap-1.5">
            <AlertCircle size={16} />
            {calledCampers.length} camper{calledCampers.length !== 1 ? "s" : ""} called for
            pickup
          </p>
          <div className="space-y-1.5">
            {calledCampers.map((c) => (
              <div
                key={c._id}
                className="flex items-center justify-between bg-white rounded-xl px-3 py-2 shadow-sm"
              >
                <span className="font-semibold text-slate-900">
                  {c.preferredName ?? c.name}
                </span>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campers grouped by transport */}
      {TRANSPORT_ORDER.map((group) => {
        const campers = groups[group];
        if (!campers || campers.length === 0) return null;
        return (
          <div key={group} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  TRANSPORT_STYLE[group] ?? "bg-slate-100 text-slate-600"
                }`}
              >
                {TRANSPORT_LABEL[group] ?? group} · {campers.length}
              </span>
            </div>
            <div className="space-y-2">
              {campers.map((c) => (
                <CamperCard
                  key={c._id}
                  camper={c}
                  onConfirm={() => confirmWithBunk({ id: c._id, staffName: staff.name })}
                  onMarkArrived={() =>
                    updateArrival({ id: c._id, arrivalType: "WalkIn", staffName: staff.name })
                  }
                  onUnconfirm={() => unconfirm({ id: c._id })}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CamperCard({
  camper,
  onConfirm,
  onMarkArrived,
  onUnconfirm,
}: {
  camper: CamperDoc;
  onConfirm: () => void;
  onMarkArrived: () => void;
  onUnconfirm: () => void;
}) {
  const displayName = camper.preferredName
    ? `${camper.preferredName}${camper.lastName ? " " + camper.lastName : ""}`
    : camper.name;

  const isCalled = camper.status === "Called" || camper.status === "Assigned";
  const isConfirmed = !!camper.bunkConfirmed;
  const isArrived = camper.arrivalStatus === "Arrived" || isConfirmed;

  return (
    <div
      className={`bg-white rounded-2xl border p-4 shadow-sm transition-colors ${
        isCalled ? "border-amber-300" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Avatar + name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-600 font-bold text-sm">
            {(camper.preferredName ?? camper.name).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-slate-900 truncate">{displayName}</p>
              {camper.hasAllergies && (
                <AlertTriangle size={14} className="text-orange-500 flex-shrink-0" />
              )}
              {camper.hasNotes && (
                <AlertCircle size={14} className="text-blue-400 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {camper.grade && (
                <span className="text-xs text-slate-400">{camper.grade}</span>
              )}
              {camper.lunchInfo && (
                <span className="text-xs text-slate-500 flex items-center gap-0.5">
                  <UtensilsCrossed size={11} />
                  {camper.lunchInfo}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status column */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {isCalled && <StatusBadge status={camper.status} />}
          {isConfirmed ? (
            <button
              onClick={onUnconfirm}
              className="flex items-center gap-1 text-xs text-green-600 font-medium hover:text-green-800"
            >
              <Check size={13} /> With bunk
            </button>
          ) : isArrived ? (
            <span className="text-xs text-blue-600 font-medium">Arrived</span>
          ) : (
            <span className="text-xs text-slate-400">Not arrived</span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {!isConfirmed && (
        <div className="flex gap-2 mt-3">
          {!isArrived && (
            <button
              onClick={onMarkArrived}
              className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-2 text-sm font-medium hover:bg-slate-200"
            >
              Mark Arrived
            </button>
          )}
          <button
            onClick={onConfirm}
            className="flex-1 bg-slate-900 text-white rounded-xl py-2 text-sm font-medium hover:bg-slate-800 flex items-center justify-center gap-1.5"
          >
            <Check size={15} /> Confirm with Bunk
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "slate" | "green" | "blue";
}) {
  const styles = {
    slate: "border-slate-200 text-slate-900",
    green: "border-green-200 text-green-700",
    blue: "border-blue-200 text-blue-700",
  };
  return (
    <div className={`bg-white rounded-xl border p-3 text-center shadow-sm ${styles[color]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Caller (Carline / Walk-Up) ───────────────────────────────────────────────

function Caller({ source }: { source: "Carline" | "Walk-Up" }) {
  const [entry, setEntry] = useState("");
  const matched = useQuery(
    api.campers.getByCode,
    entry.length === 3 ? { code: entry } : "skip",
  );
  const callByCode = useMutation(api.campers.callByCode);

  const Icon = source === "Carline" ? Car : Footprints;

  const call = async () => {
    await callByCode({ code: entry, source });
    setEntry("");
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={22} className="text-slate-700" />
        <h2 className="text-xl font-bold text-slate-900">{source} Caller</h2>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <label className="text-sm font-medium text-slate-600">Family pickup code</label>
        <input
          value={entry}
          onChange={(e) => setEntry(e.target.value.replace(/\D/g, "").slice(0, 3))}
          placeholder="000"
          inputMode="numeric"
          className="w-full text-center text-4xl font-bold tracking-widest border border-slate-300 rounded-xl py-4 my-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />

        {entry.length === 3 && matched !== undefined && matched.length === 0 && (
          <p className="text-center text-slate-500 mt-2">No campers found for that code.</p>
        )}

        {matched && matched.length > 0 && (
          <div className="mt-2">
            <p className="text-sm font-medium text-slate-500 mb-2">
              Campers for code {entry}:
            </p>
            <div className="space-y-2">
              {matched.map((c) => (
                <div
                  key={c._id}
                  className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {c.preferredName ?? c.name}
                    </p>
                    <p className="text-xs text-slate-500">{c.bunk}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
            <button
              onClick={call}
              className="w-full bg-amber-500 text-white rounded-xl py-3 font-semibold mt-4 hover:bg-amber-600"
            >
              Call Campers
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

function Dispatcher() {
  const active = useQuery(api.campers.active);
  const assign = useMutation(api.campers.assign);
  const cancelCall = useMutation(api.campers.cancelCall);

  if (active === undefined) return <Loading />;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Radio size={22} className="text-slate-700" />
        <h2 className="text-xl font-bold text-slate-900">Dispatcher</h2>
        <span className="ml-auto text-sm text-slate-500">{active.length} active</span>
      </div>

      {active.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
          No campers called yet.
        </div>
      )}

      <div className="space-y-3">
        {active.map((c) => (
          <div
            key={c._id}
            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold text-slate-900">{c.preferredName ?? c.name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} />
                    {c.bunk}
                  </span>
                  <span>#{c.code}</span>
                  <span className="flex items-center gap-1">
                    {c.callSource === "Carline" ? (
                      <Car size={12} />
                    ) : (
                      <Footprints size={12} />
                    )}
                    {c.callSource}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {fmt(c.tCalled)}
                  </span>
                </div>
              </div>
              <StatusBadge status={c.status} />
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {RUNNERS.map((r) => (
                <button
                  key={r}
                  onClick={() => assign({ id: c._id, runner: r })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    c.runner === r
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {r.replace("Runner ", "R")}
                </button>
              ))}
              {c.runner && (
                <span className="text-xs text-slate-500">→ {c.runner}</span>
              )}
              <button
                onClick={() => cancelCall({ id: c._id })}
                className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <AlertCircle size={13} /> Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Runner View (staff-code login) ──────────────────────────────────────────

function RunnerView({ runnerName }: { runnerName: string }) {
  const mine = useQuery(api.campers.forRunner, { runner: runnerName });
  const pickUp = useMutation(api.campers.pickUp);
  const dismiss = useMutation(api.campers.dismiss);

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <User size={22} className="text-slate-700" />
        <h2 className="text-xl font-bold text-slate-900">{runnerName}</h2>
      </div>

      {mine === undefined && <Loading />}

      {mine && mine.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
          Nothing assigned to you right now.
        </div>
      )}

      <div className="space-y-3">
        {mine?.map((c) => (
          <div
            key={c._id}
            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-lg text-slate-900">
                  {c.preferredName ?? c.name}
                </p>
                <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin size={13} />
                    {c.bunk}
                  </span>
                  <span className="flex items-center gap-1">
                    {c.callSource === "Carline" ? (
                      <Car size={13} />
                    ) : (
                      <Footprints size={13} />
                    )}
                    {c.callSource}
                  </span>
                </div>
              </div>
              <StatusBadge status={c.status} />
            </div>
            {c.status === "Assigned" && (
              <button
                onClick={() => pickUp({ id: c._id })}
                className="w-full bg-violet-600 text-white rounded-xl py-3 font-semibold mt-3 hover:bg-violet-700 flex items-center justify-center gap-2"
              >
                <Check size={18} /> Picked Up
              </button>
            )}
            {c.status === "Picked Up" && (
              <button
                onClick={() => dismiss({ id: c._id })}
                className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold mt-3 hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <ChevronRight size={18} /> Dismissed
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Runner view for admin (can pick which runner to view)
function RunnerAdminView() {
  const [me, setMe] = useState<string | null>(null);

  if (!me) {
    return (
      <div className="max-w-md mx-auto">
        <h2 className="text-xl font-bold text-slate-900 mb-4">View Runner Queue</h2>
        <div className="grid grid-cols-2 gap-3">
          {RUNNERS.map((r) => (
            <button
              key={r}
              onClick={() => setMe(r)}
              className="bg-white border border-slate-200 rounded-2xl py-8 font-semibold text-slate-900 hover:border-slate-900 shadow-sm"
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <button
        onClick={() => setMe(null)}
        className="text-sm text-slate-500 hover:text-slate-900 mb-4"
      >
        ← Back
      </button>
      <RunnerView runnerName={me} />
    </div>
  );
}

// ─── Admin ────────────────────────────────────────────────────────────────────

function Admin() {
  const [q, setQ] = useState("");
  const campers = useQuery(api.campers.list);
  const resetDay = useMutation(api.campers.resetDay);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      Waiting: 0,
      Called: 0,
      Assigned: 0,
      "Picked Up": 0,
      Dismissed: 0,
    };
    campers?.forEach((x) => {
      c[x.status]++;
    });
    return c;
  }, [campers]);

  if (campers === undefined) return <Loading />;

  const filtered = campers.filter((c) => {
    const s = q.toLowerCase();
    return (
      !s ||
      c.name.toLowerCase().includes(s) ||
      c.bunk.toLowerCase().includes(s) ||
      c.code.includes(s) ||
      (c.runner ?? "").toLowerCase().includes(s) ||
      c.status.toLowerCase().includes(s) ||
      (c.unit ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Settings size={22} className="text-slate-700" />
        <h2 className="text-xl font-bold text-slate-900">Admin</h2>
        <button
          onClick={() => {
            if (confirm("Reset all campers to Waiting and clear attendance?")) resetDay();
          }}
          className="ml-auto flex items-center gap-1.5 text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 font-medium"
        >
          <RotateCcw size={15} /> Reset Day
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {STATUSES.map((s) => (
          <div
            key={s}
            className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm"
          >
            <p className="text-2xl font-bold text-slate-900">{counts[s]}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s}</p>
          </div>
        ))}
      </div>

      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-3 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, bunk, unit, code, runner, status…"
          className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                {["Camper", "Bunk", "Unit", "Code", "Transport", "Arrived", "Confirmed", "Source", "Runner", "Status"].map(
                  (h) => (
                    <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c._id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                    {c.preferredName ?? c.name}
                    {c.hasAllergies && (
                      <AlertTriangle
                        size={12}
                        className="inline ml-1 text-orange-500"
                      />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.bunk}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.unit ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.code}</td>
                  <td className="px-4 py-2.5">
                    {c.transportationType ? (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          TRANSPORT_STYLE[c.transportationType]
                        }`}
                      >
                        {TRANSPORT_LABEL[c.transportationType]}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {c.arrivalStatus === "Arrived" || c.bunkConfirmed ? (
                      <span className="text-green-600 font-medium">✓</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {c.bunkConfirmed ? (
                      <span className="text-blue-600 font-medium">✓</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.callSource ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.runner ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
        STATUS_STYLE[status] ?? "bg-slate-100 text-slate-500"
      }`}
    >
      {status}
    </span>
  );
}

function Loading() {
  return <div className="text-center text-slate-400 py-10">Loading…</div>;
}
