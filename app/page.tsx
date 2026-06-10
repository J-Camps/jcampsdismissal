"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  Car, Footprints, Radio, User, Settings, Lock, Search, RotateCcw,
  Check, ChevronRight, AlertCircle, Clock, MapPin, ClipboardList,
} from "lucide-react";

const ACCESS_CODE = "1234";
const RUNNERS = ["Runner 1", "Runner 2", "Runner 3", "Runner 4"];
const STATUSES = ["Waiting", "Called", "Assigned", "Picked Up", "Dismissed"] as const;

const STATUS_STYLE: Record<string, string> = {
  "Waiting": "bg-slate-100 text-slate-500",
  "Called": "bg-amber-100 text-amber-700",
  "Assigned": "bg-blue-100 text-blue-700",
  "Picked Up": "bg-violet-100 text-violet-700",
  "Dismissed": "bg-green-100 text-green-700",
};

const ATTENDANCE_OPTIONS = ["Present", "Absent", "Expected Late", "Dismissed Early", "Already Dismissed"] as const;

const ATTENDANCE_STYLE: Record<string, string> = {
  "Present": "bg-green-100 text-green-700",
  "Absent": "bg-red-100 text-red-700",
  "Expected Late": "bg-amber-100 text-amber-700",
  "Dismissed Early": "bg-blue-100 text-blue-700",
  "Already Dismissed": "bg-slate-200 text-slate-600",
};

const fmt = (ts?: number) =>
  ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

export default function App() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <AppInner />;
}

function AppInner() {
  const [unlocked, setUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [role, setRole] = useState("carline");

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-slate-900 flex items-center justify-center mx-auto mb-4">
            <Lock className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">JCamp Dismissal</h1>
          <p className="text-slate-500 text-sm mt-1 mb-6">Enter the shared camp access code</p>
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="• • • •"
            className="w-full text-center text-2xl tracking-widest border border-slate-300 rounded-xl py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <button
            onClick={() => (codeInput === ACCESS_CODE ? setUnlocked(true) : alert("Demo code is 1234"))}
            className="w-full bg-slate-900 text-white rounded-xl py-3 font-semibold hover:bg-slate-800"
          >
            Unlock
          </button>
          <p className="text-xs text-slate-400 mt-4">Demo code: 1234</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "carline", label: "Carline", icon: Car },
    { id: "walkup", label: "Walk-Up", icon: Footprints },
    { id: "attendance", label: "Attendance", icon: ClipboardList },
    { id: "dispatcher", label: "Dispatcher", icon: Radio },
    { id: "runner", label: "Runner", icon: User },
    { id: "admin", label: "Admin", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3 overflow-x-auto">
          <span className="font-bold text-slate-900 whitespace-nowrap mr-2">JCamp</span>
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = role === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setRole(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                  active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {(role === "carline" || role === "walkup") && (
          <Caller source={role === "carline" ? "Carline" : "Walk-Up"} />
        )}
        {role === "attendance" && <AttendanceView />}
        {role === "dispatcher" && <Dispatcher />}
        {role === "runner" && <RunnerView />}
        {role === "admin" && <Admin />}
      </main>
    </div>
  );
}

function Caller({ source }: { source: "Carline" | "Walk-Up" }) {
  const [entry, setEntry] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [showNameSearch, setShowNameSearch] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const codeMatched = useQuery(
    api.campers.getByCode,
    entry.length === 3 ? { code: entry } : "skip"
  );
  const nameMatched = useQuery(
    api.campers.searchByName,
    entry.length === 0 && nameQuery.trim().length >= 2 ? { query: nameQuery.trim() } : "skip"
  );
  const callByIds = useMutation(api.campers.callByIds);

  const Icon = source === "Carline" ? Car : Footprints;

  const matched = entry.length === 3 ? codeMatched : nameMatched;
  const matchedKey = matched?.map((c) => c._id).join(",") ?? "";

  useEffect(() => {
    if (matched) {
      setSelected(Object.fromEntries(matched.map((c) => [c._id, c.status === "Waiting"])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedKey]);

  const selectedIds = (matched ?? []).filter((c) => selected[c._id]).map((c) => c._id);

  const call = async () => {
    if (selectedIds.length === 0) return;
    await callByIds({ ids: selectedIds, source });
    setEntry("");
    setNameQuery("");
    setShowNameSearch(false);
    setSelected({});
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
          onChange={(e) => {
            setEntry(e.target.value.replace(/\D/g, "").slice(0, 3));
            setNameQuery("");
            setShowNameSearch(false);
          }}
          placeholder="000"
          inputMode="numeric"
          className="w-full text-center text-4xl font-bold tracking-widest border border-slate-300 rounded-xl py-4 my-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />

        {entry.length === 3 && codeMatched !== undefined && codeMatched.length === 0 && (
          <p className="text-center text-slate-500 mt-2">No campers found for that code.</p>
        )}

        {/* Fallback: search by name when the code isn't known */}
        {entry.length === 0 && (
          <div className="mt-1">
            <button onClick={() => setShowNameSearch((v) => !v)} className="text-xs text-slate-400 hover:text-slate-700 underline">
              Don&apos;t know the code? Search by name
            </button>
            {showNameSearch && (
              <input
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                placeholder="Camper or family name…"
                className="w-full border border-slate-300 rounded-xl py-2.5 px-3 mt-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            )}
            {nameQuery.trim().length >= 2 && nameMatched !== undefined && nameMatched.length === 0 && (
              <p className="text-center text-slate-500 mt-2 text-sm">No campers found.</p>
            )}
          </div>
        )}

        {matched && matched.length > 0 && (
          <div className="mt-2">
            <p className="text-sm font-medium text-slate-500 mb-2">
              {matched.length > 1 ? "Select campers to call:" : "Camper:"}
            </p>
            <div className="space-y-2">
              {matched.map((c) => {
                const waiting = c.status === "Waiting";
                return (
                  <label key={c._id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${waiting ? "bg-slate-50 cursor-pointer" : "bg-slate-50 opacity-60"}`}>
                    <div className="flex items-center gap-3">
                      {waiting ? (
                        <input
                          type="checkbox"
                          checked={!!selected[c._id]}
                          onChange={(e) => setSelected((s) => ({ ...s, [c._id]: e.target.checked }))}
                          className="w-4 h-4"
                        />
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                      <div>
                        <p className="font-semibold text-slate-900">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.bunk}</p>
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                  </label>
                );
              })}
            </div>
            <button onClick={call} disabled={selectedIds.length === 0}
              className="w-full bg-amber-500 text-white rounded-xl py-3 font-semibold mt-4 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed">
              Call {selectedIds.length > 0 ? `${selectedIds.length} ` : ""}Camper{selectedIds.length === 1 ? "" : "s"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AttendanceView() {
  const campers = useQuery(api.campers.list);
  const setStatus = useMutation(api.campers.setAttendanceStatus);
  const [q, setQ] = useState("");

  if (campers === undefined) return <Loading />;

  const counts: Record<string, number> = {
    "Present": 0, "Absent": 0, "Expected Late": 0, "Dismissed Early": 0, "Already Dismissed": 0,
  };
  campers.forEach((c) => { counts[c.attendanceStatus ?? "Present"]++; });

  const filtered = campers.filter((c) => {
    const s = q.toLowerCase();
    return !s || c.name.toLowerCase().includes(s) || c.bunk.toLowerCase().includes(s);
  });

  // Group by bunk
  const byBunk: Record<string, Doc<"campers">[]> = {};
  for (const c of filtered) {
    (byBunk[c.bunk] ??= []).push(c);
  }
  const bunks = Object.keys(byBunk).sort();

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList size={22} className="text-slate-700" />
        <h2 className="text-xl font-bold text-slate-900">Attendance</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {ATTENDANCE_OPTIONS.map((s) => (
          <div key={s} className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-slate-900">{counts[s]}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s}</p>
          </div>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-3 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or bunk…"
          className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900" />
      </div>

      <div className="space-y-5">
        {bunks.map((bunk) => (
          <div key={bunk}>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-2">{bunk}</h3>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
              {byBunk[bunk].map((c) => {
                const current = c.attendanceStatus ?? "Present";
                return (
                  <div key={c._id} className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
                    <p className="font-medium text-slate-900">{c.name}</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${ATTENDANCE_STYLE[current]}`}>
                        {current}
                      </span>
                      <select
                        value={current}
                        onChange={(e) => setStatus({ id: c._id, attendanceStatus: e.target.value as typeof ATTENDANCE_OPTIONS[number] })}
                        className="text-sm border border-slate-300 rounded-lg py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        {ATTENDANCE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {bunks.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
            No campers found.
          </div>
        )}
      </div>
    </div>
  );
}

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
          No campers called yet. Head to the Caller screen to enter pickup codes.
        </div>
      )}

      <div className="space-y-3">
        {active.map((c) => (
          <div key={c._id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold text-slate-900">{c.name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1"><MapPin size={12} />{c.bunk}</span>
                  <span>#{c.code}</span>
                  <span className="flex items-center gap-1">
                    {c.callSource === "Carline" ? <Car size={12} /> : <Footprints size={12} />}{c.callSource}
                  </span>
                  <span className="flex items-center gap-1"><Clock size={12} />{fmt(c.tCalled)}</span>
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
                    c.runner === r ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {r.replace("Runner ", "R")}
                </button>
              ))}
              {c.runner && <span className="text-xs text-slate-500">→ {c.runner}</span>}
              <button
                onClick={() => cancelCall({ id: c._id })}
                className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <AlertCircle size={13} /> Cancel call
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RunnerView() {
  const [me, setMe] = useState<string | null>(null);
  const mine = useQuery(api.campers.forRunner, me ? { runner: me } : "skip");
  const pickUp = useMutation(api.campers.pickUp);
  const dismiss = useMutation(api.campers.dismiss);

  if (!me) {
    return (
      <div className="max-w-md mx-auto">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Who are you?</h2>
        <div className="grid grid-cols-2 gap-3">
          {RUNNERS.map((r) => (
            <button key={r} onClick={() => setMe(r)} className="bg-white border border-slate-200 rounded-2xl py-8 font-semibold text-slate-900 hover:border-slate-900 shadow-sm">
              {r}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-900">{me}</h2>
        <button onClick={() => setMe(null)} className="text-sm text-slate-500 hover:text-slate-900">Switch</button>
      </div>

      {mine === undefined && <Loading />}

      {mine && mine.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
          Nothing assigned to you right now.
        </div>
      )}

      <div className="space-y-3">
        {mine?.map((c) => (
          <div key={c._id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-lg text-slate-900">{c.name}</p>
                <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                  <span className="flex items-center gap-1"><MapPin size={13} />{c.bunk}</span>
                  <span className="flex items-center gap-1">
                    {c.callSource === "Carline" ? <Car size={13} /> : <Footprints size={13} />}{c.callSource}
                  </span>
                </div>
              </div>
              <StatusBadge status={c.status} />
            </div>
            {c.status === "Assigned" && (
              <button onClick={() => pickUp({ id: c._id })}
                className="w-full bg-violet-600 text-white rounded-xl py-3 font-semibold mt-3 hover:bg-violet-700 flex items-center justify-center gap-2">
                <Check size={18} /> Picked Up
              </button>
            )}
            {c.status === "Picked Up" && (
              <button onClick={() => dismiss({ id: c._id })}
                className="w-full bg-green-600 text-white rounded-xl py-3 font-semibold mt-3 hover:bg-green-700 flex items-center justify-center gap-2">
                <ChevronRight size={18} /> Dismissed
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Admin() {
  const [q, setQ] = useState("");
  const campers = useQuery(api.campers.list);
  const resetDay = useMutation(api.campers.resetDay);

  const counts = useMemo(() => {
    const c: Record<string, number> = { Waiting: 0, Called: 0, Assigned: 0, "Picked Up": 0, Dismissed: 0 };
    campers?.forEach((x) => { c[x.status]++; });
    return c;
  }, [campers]);

  if (campers === undefined) return <Loading />;

  const filtered = campers.filter((c) => {
    const s = q.toLowerCase();
    return !s || c.name.toLowerCase().includes(s) || c.bunk.toLowerCase().includes(s) ||
      c.code.includes(s) || (c.runner || "").toLowerCase().includes(s) || c.status.toLowerCase().includes(s);
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Settings size={22} className="text-slate-700" />
        <h2 className="text-xl font-bold text-slate-900">Admin</h2>
        <button
          onClick={() => { if (confirm("Reset all campers to Waiting?")) resetDay(); }}
          className="ml-auto flex items-center gap-1.5 text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 font-medium"
        >
          <RotateCcw size={15} /> Reset Day
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {STATUSES.map((s) => (
          <div key={s} className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-slate-900">{counts[s]}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s}</p>
          </div>
        ))}
      </div>

      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-3 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, bunk, code, runner, status…"
          className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                {["Camper", "Bunk", "Code", "Source", "Runner", "Status", "Attendance"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c._id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.bunk}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.code}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.callSource || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{c.runner || "—"}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${ATTENDANCE_STYLE[c.attendanceStatus ?? "Present"]}`}>
                      {c.attendanceStatus ?? "Present"}
                    </span>
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

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

function Loading() {
  return <div className="text-center text-slate-400 py-10">Loading…</div>;
}
