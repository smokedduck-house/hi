"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Square, Trash2, Pencil, Plus, X, Check } from "lucide-react";

// ── 상수 ────────────────────────────────────────────────────────
const DEFAULT_SUBJECTS = ["국어", "영어", "수학", "지구과학", "한국지리"];

const SUBJECT_COLORS: Record<string, string> = {
  "국어": "#6366f1",
  "영어": "#f59e0b",
  "수학": "#10b981",
  "지구과학": "#3b82f6",
  "한국지리": "#8b5cf6",
};
const EXTRA_COLORS = ["#ef4444", "#ec4899", "#14b8a6", "#f97316", "#84cc16"];

// 충북고등학교 학사일정
const VACATION_PERIODS = [
  { start: "2026-01-03", end: "2026-03-01" }, // 겨울방학
  { start: "2026-07-20", end: "2026-08-17" }, // 여름방학
  { start: "2027-01-04", end: "2027-01-31" }, // 겨울방학
];

// 야자 시간표 (요일별)
// 월=1, 화=2, 수=3, 목=4, 금=5
const YAJA_SCHEDULE: Record<number, { label: string; slots: string[]; color: string }[]> = {
  1: [ // 월
    { label: "야자1", slots: ["19:00", "19:30", "20:00"], color: "#f59e0b" },
    { label: "야자2", slots: ["20:30", "21:00", "21:30"], color: "#f97316" },
  ],
  2: [ // 화
    { label: "야자1", slots: ["19:00", "19:30", "20:00"], color: "#f59e0b" },
    { label: "야자2", slots: ["20:30", "21:00", "21:30"], color: "#f97316" },
  ],
  3: [ // 수
    { label: "8교시", slots: ["16:30", "17:00", "17:30"], color: "#10b981" },
    { label: "야자1", slots: ["19:00", "19:30", "20:00"], color: "#f59e0b" },
    { label: "야자2", slots: ["20:30", "21:00", "21:30"], color: "#f97316" },
  ],
  4: [ // 목
    { label: "야자1", slots: ["19:00", "19:30", "20:00"], color: "#f59e0b" },
    { label: "야자2", slots: ["20:30", "21:00", "21:30"], color: "#f97316" },
  ],
  5: [ // 금
    { label: "8교시", slots: ["16:30", "17:00", "17:30"], color: "#10b981" },
    { label: "야자1", slots: ["19:00", "19:30", "20:00"], color: "#f59e0b" },
    { label: "야자2", slots: ["20:30", "21:00", "21:30"], color: "#f97316" },
  ],
};

// 30분 슬롯 05:00~24:00
const START_HOUR = 5;
const END_HOUR = 24;
const SLOTS: string[] = [];
for (let h = START_HOUR; h < END_HOUR; h++) {
  SLOTS.push(`${String(h).padStart(2, "0")}:00`);
  SLOTS.push(`${String(h).padStart(2, "0")}:30`);
}

// ── 학교 일정 유틸 ────────────────────────────────────────────────
function isVacation(date: string) {
  return VACATION_PERIODS.some((p) => date >= p.start && date <= p.end);
}
function isWeekend(date: string) {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}
function isSchoolDay(date: string) {
  return !isVacation(date) && !isWeekend(date);
}
// 학교가 있는 날 → 16:30 이전 자동 차단 (수/금은 8교시 포함이라 16:30부터 가능)
function getSchoolBlockedSlots(date: string): Set<string> {
  if (!isSchoolDay(date)) return new Set();
  return new Set(SLOTS.filter((s) => s < "16:30"));
}

// 야자 관련 유틸
function getYajaPeriods(date: string) {
  if (!isSchoolDay(date)) return [];
  return YAJA_SCHEDULE[new Date(date).getDay()] ?? [];
}

// slot → 야자 period 정보
function getYajaSlotInfo(date: string): Record<string, { label: string; color: string; isFirst: boolean }> {
  const result: Record<string, { label: string; color: string; isFirst: boolean }> = {};
  for (const period of getYajaPeriods(date)) {
    period.slots.forEach((slot, i) => {
      result[slot] = { label: period.label, color: period.color, isFirst: i === 0 };
    });
  }
  return result;
}

// 플랜 과목을 야자 슬롯에 비례 배분
function distributeToYajaSlots(
  todayPlan: Record<string, number>,
  yajaSlots: string[]
): Record<string, string> {
  const entries = Object.entries(todayPlan).filter(([, c]) => c > 0);
  if (!entries.length || !yajaSlots.length) return {};
  const total = entries.reduce((a, [, c]) => a + c, 0);
  const result: Record<string, string> = {};
  let idx = 0;
  for (const [subject, count] of entries) {
    const numSlots = Math.max(1, Math.round((count / total) * yajaSlots.length));
    for (let i = 0; i < numSlots && idx < yajaSlots.length; i++, idx++) {
      result[yajaSlots[idx]] = subject;
    }
  }
  while (idx < yajaSlots.length) {
    result[yajaSlots[idx++]] = entries[entries.length - 1][0];
  }
  return result;
}

// ── 타입 ────────────────────────────────────────────────────────
type LogEntry = {
  id: string;
  subject: string;
  seconds: number;
  startTime: string | null;
  endTime: string | null;
};
type Task = { name: string; totalCount: number; unit: string };
type Plan = { id: string; title: string; tasks: string; schedule: string; completions?: { date: string; subject: string; done: number }[] };

// ── 유틸 ────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }
function currentSlot() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${now.getMinutes() < 30 ? "00" : "30"}`;
}
function fmtSecs(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}
function fmtTimer(s: number) {
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function nowHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}
function timeToSecs(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) * 60);
}
function getColor(subject: string, planSubjects: string[]): string {
  if (SUBJECT_COLORS[subject]) return SUBJECT_COLORS[subject];
  const idx = planSubjects.indexOf(subject);
  return EXTRA_COLORS[Math.max(0, idx) % EXTRA_COLORS.length];
}

// Log entries → timetable 슬롯 매핑
function computeLogBlocks(logs: LogEntry[]): Record<string, { subject: string; logId: string }> {
  const result: Record<string, { subject: string; logId: string }> = {};
  for (const log of logs) {
    if (!log.startTime || !log.endTime) continue;
    for (const slot of SLOTS) {
      if (slot >= log.startTime && slot < log.endTime) {
        result[slot] = { subject: log.subject, logId: log.id };
      }
    }
  }
  return result;
}

// ── 시간 추가/수정 모달 ──────────────────────────────────────────
function TimeEditModal({
  initial,
  allSubjects,
  planSubjects,
  onSave,
  onClose,
}: {
  initial?: { subject: string; startTime: string; endTime: string };
  allSubjects: string[];
  planSubjects: string[];
  onSave: (subject: string, startTime: string, endTime: string, seconds: number) => Promise<void>;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(initial?.subject ?? allSubjects[0] ?? "");
  const [startTime, setStartTime] = useState(initial?.startTime ?? nowHHMM());
  const [endTime, setEndTime] = useState(initial?.endTime ?? nowHHMM());
  const [saving, setSaving] = useState(false);

  const secs = timeToSecs(startTime, endTime);

  async function handleSave() {
    if (!subject || secs <= 0) return;
    setSaving(true);
    await onSave(subject, startTime, endTime, secs);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="rounded-2xl border w-full max-w-xs" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="font-bold text-sm">{initial ? "시간 수정" : "공부 기록 추가"}</p>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>과목</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              {allSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>시작</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
                style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>종료</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
                style={{ background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" }} />
            </div>
          </div>
          {secs > 0 && (
            <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
              {fmtSecs(secs)} 기록됩니다
            </p>
          )}
          <button
            onClick={() => void handleSave()}
            disabled={saving || secs <= 0}
            className="w-full py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: secs > 0 ? "var(--primary)" : "var(--muted)", color: secs > 0 ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────
export function TimetableClient() {
  const date = todayStr();
  const schoolDay = isSchoolDay(date);
  const schoolBlocked = getSchoolBlockedSlots(date);

  // 플랜
  const [plan, setPlan] = useState<Plan | null>(null);

  // 체크리스트 (localStorage per day)
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // 타임블록 (계획, localStorage per day)
  const [blocks, setBlocks] = useState<Record<string, string | null>>({});
  const [userBlocked, setUserBlocked] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState<"draw" | "erase">("draw");
  const [selectedSubject, setSelectedSubject] = useState(DEFAULT_SUBJECTS[2]); // 수학 기본
  const dragging = useRef(false);

  // 공부 기록
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [bySubject, setBySubject] = useState<Record<string, number>>({});
  const [totalSeconds, setTotalSeconds] = useState(0);

  // 타이머
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerStartHHMM = useRef("");
  const startedAt = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 모달
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // 타임테이블 ref (현재 시간으로 스크롤)
  const timetableRef = useRef<HTMLDivElement>(null);
  const curSlotRef = useRef<HTMLDivElement>(null);

  // ── 야자 슬롯 자동 배분 (하루 1회) ─────────────────────────────
  function syncPlanToYaja(loadedPlan: Plan, currentBlocks: Record<string, string | null>) {
    const syncKey = `yajaSync_${loadedPlan.id}_${date}`;
    if (localStorage.getItem(syncKey) === "done") return currentBlocks;

    const schedule = JSON.parse(loadedPlan.schedule || "{}") as Record<string, Record<string, number>>;
    const todayPlan = schedule[date] ?? {};
    if (Object.keys(todayPlan).length === 0) return currentBlocks;

    const periods = getYajaPeriods(date);
    const allYajaSlots = periods.flatMap((p) => p.slots);
    if (allYajaSlots.length === 0) return currentBlocks;

    const distributed = distributeToYajaSlots(todayPlan, allYajaSlots);
    const next = { ...currentBlocks, ...distributed };
    localStorage.setItem(`timetable_${date}`, JSON.stringify(next));
    localStorage.setItem(syncKey, "done");
    return next;
  }

  // ── 초기 로드 ──────────────────────────────────────────────────
  useEffect(() => {
    const savedBlocks = JSON.parse(localStorage.getItem(`timetable_${date}`) ?? "{}") as Record<string, string | null>;
    setBlocks(savedBlocks);
    const savedBlocked = localStorage.getItem("userBlockedSlots");
    if (savedBlocked) setUserBlocked(new Set(JSON.parse(savedBlocked) as string[]));
    const savedChecked = localStorage.getItem(`checked_${date}`);
    if (savedChecked) setChecked(new Set(JSON.parse(savedChecked) as string[]));

    const planId = localStorage.getItem("activePlanId");
    if (planId) {
      fetch(`/api/planner/${planId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d: Plan | null) => {
          if (!d) return;
          setPlan(d);
          // 플랜 로드 후 야자 슬롯 자동 배분
          const synced = syncPlanToYaja(d, savedBlocks);
          setBlocks(synced);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // 현재 시간 슬롯으로 스크롤
  useEffect(() => {
    setTimeout(() => curSlotRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
  }, []);

  const loadLogs = useCallback(async () => {
    const res = await fetch(`/api/study-log?date=${date}`);
    const data = await res.json() as { logs: LogEntry[]; bySubject: Record<string, number>; totalSeconds: number };
    setLogs(data.logs);
    setBySubject(data.bySubject);
    setTotalSeconds(data.totalSeconds);
  }, [date]);

  useEffect(() => { void loadLogs(); }, [loadLogs]);

  // ── 타이머 ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeSubject) {
      startedAt.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubject]);

  async function startTimer(subject: string) {
    if (activeSubject && elapsed > 0) await saveSession();
    setElapsed(0);
    timerStartHHMM.current = nowHHMM();
    setActiveSubject(subject);
  }

  async function stopTimer() {
    if (!activeSubject || elapsed < 1) { setActiveSubject(null); setElapsed(0); return; }
    await saveSession();
    setActiveSubject(null);
    setElapsed(0);
  }

  async function saveSession() {
    if (!activeSubject || elapsed < 1) return;
    const endHHMM = nowHHMM();
    await fetch("/api/study-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan?.id, date, subject: activeSubject, seconds: elapsed, startTime: timerStartHHMM.current, endTime: endHHMM }),
    });
    // 타임블록에도 반영
    const next = { ...blocks };
    for (const slot of SLOTS) {
      if (slot >= timerStartHHMM.current.slice(0, 5) && slot < endHHMM.slice(0, 5)) {
        if (!userBlocked.has(slot) && !schoolBlocked.has(slot)) next[slot] = activeSubject;
      }
    }
    setBlocks(next);
    localStorage.setItem(`timetable_${date}`, JSON.stringify(next));
    await loadLogs();
  }

  // ── 타임블록 편집 ─────────────────────────────────────────────
  function applySlot(slot: string) {
    if (schoolBlocked.has(slot) || userBlocked.has(slot)) return;
    const next = { ...blocks, [slot]: editMode === "erase" ? null : selectedSubject };
    setBlocks(next);
    localStorage.setItem(`timetable_${date}`, JSON.stringify(next));
  }

  // ── 체크리스트 ────────────────────────────────────────────────
  function toggleCheck(subject: string) {
    setChecked((prev) => {
      const n = new Set(prev);
      n.has(subject) ? n.delete(subject) : n.add(subject);
      localStorage.setItem(`checked_${date}`, JSON.stringify([...n]));
      return n;
    });
  }

  // ── 공부 기록 CRUD ────────────────────────────────────────────
  async function addLog(subject: string, startTime: string, endTime: string, seconds: number) {
    await fetch("/api/study-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan?.id, date, subject, seconds, startTime, endTime }),
    });
    await loadLogs();
  }

  async function updateLog(id: string, subject: string, startTime: string, endTime: string, seconds: number) {
    await fetch(`/api/study-log/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, seconds, startTime, endTime }),
    });
    await loadLogs();
  }

  async function deleteLog(id: string) {
    await fetch(`/api/study-log/${id}`, { method: "DELETE" });
    await loadLogs();
  }

  // ── 계산 ──────────────────────────────────────────────────────
  const planTasks: Task[] = plan ? (JSON.parse(plan.tasks || "[]") as Task[]) : [];
  const planSubjects = planTasks.map((t) => t.name).filter((n) => !DEFAULT_SUBJECTS.includes(n));
  const allSubjects = [...DEFAULT_SUBJECTS, ...planSubjects];
  const schedule: Record<string, Record<string, number>> = plan ? (JSON.parse(plan.schedule || "{}") as Record<string, Record<string, number>>) : {};
  const todayPlan = schedule[date] ?? {};
  const logBlocks = computeLogBlocks(logs);
  const cur = currentSlot();
  const yajaSlotInfo = getYajaSlotInfo(date);
  const yajaPeriods = getYajaPeriods(date);

  const isBlocked = (slot: string) => schoolBlocked.has(slot) || userBlocked.has(slot);
  const getSlotSubject = (slot: string): string | null => {
    if (isBlocked(slot)) return null;
    if (logBlocks[slot]) return logBlocks[slot].subject;
    return blocks[slot] ?? null;
  };

  const cardStyle = { background: "var(--card)", borderColor: "var(--border)" };

  return (
    <div className="space-y-4">
      {/* 모달 */}
      {(showAddModal || editingLog) && (
        <TimeEditModal
          initial={editingLog ? { subject: editingLog.subject, startTime: editingLog.startTime ?? "", endTime: editingLog.endTime ?? "" } : undefined}
          allSubjects={allSubjects}
          planSubjects={planSubjects}
          onSave={async (subject, startTime, endTime, seconds) => {
            if (editingLog) await updateLog(editingLog.id, subject, startTime, endTime, seconds);
            else await addLog(subject, startTime, endTime, seconds);
            setEditingLog(null);
            setShowAddModal(false);
          }}
          onClose={() => { setEditingLog(null); setShowAddModal(false); }}
        />
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">오늘 시간표</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {date}
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: schoolDay ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)", color: schoolDay ? "#ef4444" : "#10b981" }}>
              {schoolDay ? "📚 학교 있는 날" : isVacation(date) ? "🌴 방학" : "🏖️ 주말"}
            </span>
            {plan && <span className="ml-2 text-xs" style={{ color: "var(--muted-foreground)" }}>· {plan.title}</span>}
          </p>
          {/* 야자 시간 뱃지 */}
          {yajaPeriods.length > 0 && (
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {yajaPeriods.map((p) => {
                const timeLabel = p.label === "야자1" ? "19:00–20:20" : p.label === "야자2" ? "20:40–22:00" : "16:50–18:00";
                return (
                  <span key={p.label} className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${p.color}20`, color: p.color, border: `1px solid ${p.color}40` }}>
                    {p.label} {timeLabel}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 총 공부 시간 바 */}
      <div className="rounded-xl border p-3 flex items-center gap-3" style={cardStyle}>
        <div className="flex-1">
          <p className="text-xl font-bold tabular-nums">{fmtSecs(totalSeconds + (activeSubject ? elapsed : 0))}</p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>오늘 총 공부 시간</p>
        </div>
        {activeSubject && (
          <div className="text-right">
            <p className="text-base font-bold tabular-nums" style={{ color: getColor(activeSubject, planSubjects) }}>{fmtTimer(elapsed)}</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{activeSubject} 진행중</p>
          </div>
        )}
      </div>

      {/* 메인 레이아웃: 왼쪽 콘텐츠 + 오른쪽 타임테이블 */}
      <div className="flex gap-4 items-start">

        {/* ── 왼쪽 패널 ── */}
        <div className="flex-1 space-y-4 min-w-0">

          {/* 오늘 할 일 체크리스트 */}
          <div className="rounded-xl border p-4 space-y-2" style={cardStyle}>
            <p className="text-sm font-bold">오늘 할 일</p>
            {allSubjects.map((subject) => {
              const isChecked = checked.has(subject);
              const color = getColor(subject, planSubjects);
              const planned = todayPlan[subject];
              const isRunning = activeSubject === subject;
              return (
                <div key={subject} className="flex items-center gap-2 py-1">
                  <button
                    onClick={() => toggleCheck(subject)}
                    className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all"
                    style={{ background: isChecked ? color : "transparent", borderColor: isChecked ? color : "var(--border)" }}
                  >
                    {isChecked && <Check size={12} color="white" strokeWidth={3} />}
                  </button>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="flex-1 text-sm font-medium" style={{ textDecoration: isChecked ? "line-through" : "none", color: isChecked ? "var(--muted-foreground)" : "var(--foreground)" }}>
                    {subject}
                  </span>
                  {planned != null && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${color}20`, color }}>
                      {planned}{planTasks.find((t) => t.name === subject)?.unit ?? "개"}
                    </span>
                  )}
                  {bySubject[subject] != null && (
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{fmtSecs(bySubject[subject])}</span>
                  )}
                  <button
                    onClick={() => isRunning ? void stopTimer() : void startTimer(subject)}
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: isRunning ? color : "var(--muted)", color: isRunning ? "#fff" : "var(--muted-foreground)" }}
                  >
                    {isRunning ? <Square size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}
                  </button>
                </div>
              );
            })}
          </div>

          {/* 공부 기록 */}
          <div className="rounded-xl border p-4 space-y-2" style={cardStyle}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">오늘 기록</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <Plus size={12} /> 직접 추가
              </button>
            </div>
            {logs.length === 0 ? (
              <p className="text-xs text-center py-3" style={{ color: "var(--muted-foreground)" }}>아직 기록이 없습니다</p>
            ) : (
              <div className="space-y-1.5">
                {logs.map((log) => {
                  const color = getColor(log.subject, planSubjects);
                  return (
                    <div key={log.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--muted)" }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs font-semibold flex-shrink-0">{log.subject}</span>
                      {log.startTime && log.endTime && (
                        <span className="text-xs flex-shrink-0" style={{ color: "var(--muted-foreground)" }}>{log.startTime}–{log.endTime}</span>
                      )}
                      <span className="text-xs flex-1" style={{ color }}>{fmtSecs(log.seconds)}</span>
                      <button onClick={() => setEditingLog(log)} className="p-1 rounded" style={{ color: "var(--muted-foreground)" }}><Pencil size={12} /></button>
                      <button onClick={() => void deleteLog(log.id)} className="p-1 rounded" style={{ color: "var(--destructive)" }}><Trash2 size={12} /></button>
                    </div>
                  );
                })}
                {/* 과목별 합계 */}
                {Object.keys(bySubject).length > 0 && (
                  <div className="pt-2 space-y-1">
                    {Object.entries(bySubject).map(([subject, secs]) => {
                      const color = getColor(subject, planSubjects);
                      const pct = totalSeconds > 0 ? Math.round((secs / totalSeconds) * 100) : 0;
                      return (
                        <div key={subject} className="flex items-center gap-2">
                          <span className="text-xs w-16 truncate font-medium" style={{ color }}>{subject}</span>
                          <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--muted)" }}>
                            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                          </div>
                          <span className="text-xs w-12 text-right" style={{ color: "var(--muted-foreground)" }}>{fmtSecs(secs)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── 오른쪽 타임테이블 (컴팩트) ── */}
        <div className="w-44 flex-shrink-0 space-y-2">
          {/* 툴바 */}
          <div className="rounded-xl border p-2 space-y-2" style={cardStyle}>
            {/* 과목 팔레트 */}
            <div className="flex flex-wrap gap-1">
              {allSubjects.map((name) => {
                const color = getColor(name, planSubjects);
                const isSel = selectedSubject === name;
                return (
                  <button
                    key={name}
                    onClick={() => { setSelectedSubject(name); setEditMode("draw"); }}
                    title={name}
                    className="px-1.5 py-0.5 rounded text-xs font-semibold transition-all"
                    style={{
                      background: isSel ? color : `${color}20`,
                      color: isSel ? "#fff" : color,
                      border: `1px solid ${color}`,
                    }}
                  >
                    {name.slice(0, 2)}
                  </button>
                );
              })}
            </div>
            {/* 그리기/지우기 */}
            <div className="flex gap-1">
              <button onClick={() => setEditMode("draw")} className="flex-1 py-1 rounded text-xs font-medium"
                style={{ background: editMode === "draw" ? "var(--primary)" : "var(--muted)", color: editMode === "draw" ? "var(--primary-foreground)" : "var(--foreground)" }}>
                그리기
              </button>
              <button onClick={() => setEditMode("erase")} className="flex-1 py-1 rounded text-xs font-medium"
                style={{ background: editMode === "erase" ? "#ef4444" : "var(--muted)", color: editMode === "erase" ? "#fff" : "var(--foreground)" }}>
                지우기
              </button>
            </div>
          </div>

          {/* 타임그리드 */}
          <div
            ref={timetableRef}
            className="rounded-xl border overflow-hidden overflow-y-auto"
            style={{ ...cardStyle, maxHeight: "65vh" }}
          >
            <div
              className="select-none"
              onMouseLeave={() => { dragging.current = false; }}
            >
              {SLOTS.map((slot) => {
                const isHour = slot.endsWith(":00");
                const isBlk = isBlocked(slot);
                const subject = getSlotSubject(slot);
                const color = subject ? getColor(subject, planSubjects) : null;
                const isCur = slot === cur;
                const isFromLog = Boolean(logBlocks[slot]);
                const yajaInfo = yajaSlotInfo[slot];
                const isYaja = Boolean(yajaInfo) && !isBlk;

                return (
                  <div
                    key={slot}
                    ref={isCur ? curSlotRef : undefined}
                    className="flex items-stretch relative"
                    style={{ height: 20, borderTop: isHour ? "1px solid var(--border)" : "1px dashed color-mix(in srgb, var(--border) 40%, transparent)" }}
                    onMouseDown={() => { dragging.current = true; if (!isFromLog) applySlot(slot); }}
                    onMouseEnter={() => { if (dragging.current && !isFromLog) applySlot(slot); }}
                    onMouseUp={() => { dragging.current = false; }}
                  >
                    {/* 시간 레이블 (짝수 시간만) */}
                    <div className="flex-shrink-0 flex items-center justify-end pr-1 tabular-nums"
                      style={{ width: 34, color: "var(--muted-foreground)", fontSize: "0.58rem", opacity: isHour && Number(slot.slice(0, 2)) % 2 === 0 ? 1 : 0 }}>
                      {slot.slice(0, 5)}
                    </div>

                    {/* 블록 */}
                    <div className="flex-1 relative" style={{ cursor: editMode === "erase" ? "crosshair" : "cell" }}>
                      {isBlk ? (
                        <div className="absolute inset-0"
                          style={{ background: "repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(239,68,68,0.07) 3px,rgba(239,68,68,0.07) 6px)", borderLeft: "2px solid #ef444430" }} />
                      ) : subject ? (
                        <div className="absolute inset-0"
                          style={{ background: `${color}${isFromLog ? "40" : "28"}`, borderLeft: `2px solid ${color}${isFromLog ? "cc" : "70"}` }}>
                          {isHour && (
                            <span className="absolute left-1 top-0 leading-5 truncate font-medium" style={{ color: color ?? undefined, fontSize: "0.58rem" }}>
                              {subject.slice(0, 3)}
                            </span>
                          )}
                        </div>
                      ) : isYaja ? (
                        // 야자 시간 (빈 슬롯)
                        <div className="absolute inset-0"
                          style={{ background: `${yajaInfo.color}10`, borderLeft: `2px solid ${yajaInfo.color}50` }}>
                          {yajaInfo.isFirst && (
                            <span className="absolute left-1 top-0 leading-5 font-bold" style={{ color: yajaInfo.color, fontSize: "0.55rem" }}>
                              {yajaInfo.label}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="absolute inset-0" style={{ background: isCur ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "transparent" }} />
                      )}
                      {/* 현재 시간선 */}
                      {isCur && <div className="absolute left-0 right-0 bottom-0 h-0.5" style={{ background: "var(--primary)", zIndex: 10 }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 범례 */}
          <div className="rounded-xl border p-2 space-y-1" style={cardStyle}>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <div className="w-3 h-3 rounded-sm" style={{ background: "repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(239,68,68,0.15) 2px,rgba(239,68,68,0.15) 4px)", border: "1px solid #ef444440" }} />
              {schoolDay ? "수업시간" : "공부 불가"}
            </div>
            {yajaPeriods.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                <div className="w-3 h-3 rounded-sm" style={{ background: "#f59e0b10", borderLeft: "2px solid #f59e0b50" }} />
                야자 시간 (자동배정)
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <div className="w-3 h-3 rounded-sm" style={{ background: "#6366f140", borderLeft: "2px solid #6366f1cc" }} />
              타이머 기록
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <div className="w-3 h-3 rounded-sm" style={{ background: "#6366f128", borderLeft: "2px solid #6366f170" }} />
              계획 블록
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
