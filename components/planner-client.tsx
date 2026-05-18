"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, ChevronLeft, ChevronRight, Check, Calendar, BookOpen, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


import type { PlannerTask } from "@/lib/planner-utils";

// ── 타입 ────────────────────────────────────────────────────────
type Plan = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  tasks: string; // JSON: PlannerTask[]
  schedule: string; // JSON
  createdAt: string;
  completions?: Completion[];
};

type Completion = { id: string; planId: string; date: string; subject: string; done: number };

// ── 유틸 ────────────────────────────────────────────────────────
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const DAYS_KO = ["월", "화", "수", "목", "금", "토", "일"];
const TASK_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899",
];
const UNITS = ["강", "문제", "쪽", "개", "기타"];

// ── 플랜 생성 폼 ────────────────────────────────────────────────
function CreateForm({ onCreated }: { onCreated: (plan: Plan) => void }) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(addDays(today(), 89));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputStyle = { background: "var(--muted)", borderColor: "var(--border)" };
  const labelStyle: React.CSSProperties = { fontSize: "0.72rem", fontWeight: 600, color: "var(--muted-foreground)" };

  async function handleSubmit() {
    if (!title.trim()) { setError("플랜 제목을 입력해주세요."); return; }
    if (!startDate || !endDate || endDate <= startDate) { setError("날짜 범위를 확인해주세요."); return; }

    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), startDate, endDate }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "생성 실패");
        return;
      }
      const plan = await res.json() as Plan;
      localStorage.setItem("activePlanId", plan.id);
      onCreated(plan);
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">AI 플래너</h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          플랜을 만들고 할 일을 하나씩 추가하면 자동으로 일정을 짜드립니다.
        </p>
      </div>

      <div className="rounded-xl border p-5 space-y-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="space-y-1">
          <label style={labelStyle}>플랜 제목</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 수능 D-100 플랜" style={inputStyle} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label style={labelStyle}>시작일</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </div>
          <div className="space-y-1">
            <label style={labelStyle}>종료일</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {error && (
          <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "var(--destructive)" }}>
            {error}
          </p>
        )}

        <Button onClick={handleSubmit} disabled={loading} className="w-full">
          {loading
            ? <><Loader2 size={15} className="mr-2 animate-spin" />생성 중...</>
            : "플랜 만들기"
          }
        </Button>
      </div>
    </div>
  );
}

// ── 할 일 관리 ───────────────────────────────────────────────────
function TaskManager({
  plan,
  onPlanUpdate,
}: {
  plan: Plan;
  onPlanUpdate: (updated: Plan) => void;
}) {
  const tasks: PlannerTask[] = JSON.parse(plan.tasks || "[]");

  const [name, setName] = useState("");
  const [totalCount, setTotalCount] = useState("");
  const [unit, setUnit] = useState("강");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveTasks(next: PlannerTask[]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/planner/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: next }),
      });
      if (!res.ok) { setError("저장 실패"); return; }
      const updated = await res.json() as Plan;
      onPlanUpdate(updated);
    } catch {
      setError("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  async function addTask() {
    const n = name.trim();
    const total = parseInt(totalCount);
    if (!n) { setError("할 일 이름을 입력해주세요."); return; }
    if (!total || total <= 0) { setError("수량을 입력해주세요."); return; }
    if (tasks.find((t) => t.name === n)) { setError("같은 이름의 할 일이 이미 있습니다."); return; }

    const newTask: PlannerTask = { name: n, totalCount: total, unit };
    setError("");
    await saveTasks([...tasks, newTask]);
    setName("");
    setTotalCount("");
  }

  async function removeTask(taskName: string) {
    setError("");
    await saveTasks(tasks.filter((t) => t.name !== taskName));
  }

  const inputStyle = { background: "var(--muted)", borderColor: "var(--border)" };

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <p className="text-sm font-semibold">할 일 목록</p>

      {/* 현재 할 일 목록 */}
      {tasks.length > 0 && (
        <div className="space-y-1.5">
          {tasks.map((t, i) => (
            <div key={t.name} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--muted)" }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TASK_COLORS[i % TASK_COLORS.length] }} />
              <span className="font-medium flex-1 truncate">{t.name}</span>
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                총 {t.totalCount}{t.unit}
              </span>
              <button
                onClick={() => void removeTask(t.name)}
                disabled={saving}
                className="p-1 rounded flex-shrink-0"
                style={{ color: "var(--muted-foreground)" }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {tasks.length === 0 && (
        <p className="text-sm text-center py-2" style={{ color: "var(--muted-foreground)" }}>
          아직 할 일이 없습니다. 아래에서 추가하세요.
        </p>
      )}

      {/* 새 할 일 추가 폼 */}
      <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: "var(--border)", borderStyle: "dashed" }}>
        <p className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>할 일 추가</p>

        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void addTask()}
            placeholder="예: 뉴런 수2, 수능특강 영어"
            className="flex-1"
            style={inputStyle}
          />
        </div>

        <div className="flex gap-2">
          <Input
            type="number"
            value={totalCount}
            onChange={(e) => setTotalCount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void addTask()}
            placeholder="총 수량"
            className="w-28"
            style={inputStyle}
            min={1}
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="rounded-lg px-2 py-1.5 text-sm border"
            style={{ ...inputStyle, color: "var(--foreground)" }}
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        {error && (
          <p className="text-xs px-2 py-1 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "var(--destructive)" }}>
            {error}
          </p>
        )}

        <Button onClick={() => void addTask()} disabled={saving} size="sm" className="w-full">
          {saving
            ? <><Loader2 size={13} className="mr-1.5 animate-spin" />일정 자동 배분 중...</>
            : <><Plus size={13} className="mr-1.5" />추가</>
          }
        </Button>
      </div>
    </div>
  );
}

// ── 주간 스케줄 뷰 ──────────────────────────────────────────────
function ScheduleView({
  plan: initialPlan,
  onBack,
}: {
  plan: Plan;
  onBack: () => void;
}) {
  const [plan, setPlan] = useState(initialPlan);
  const schedule: Record<string, Record<string, number>> = JSON.parse(plan.schedule || "{}");
  const tasks: PlannerTask[] = JSON.parse(plan.tasks || "[]");
  const taskColors: Record<string, string> = {};
  tasks.forEach((t, i) => { taskColors[t.name] = TASK_COLORS[i % TASK_COLORS.length]; });

  const [weekStart, setWeekStart] = useState(() => {
    const t = today();
    const clamp = t < plan.startDate ? plan.startDate : t > plan.endDate ? plan.endDate : t;
    return mondayOf(clamp);
  });
  const [completions, setCompletions] = useState<Completion[]>(plan.completions ?? []);

  // 플랜 업데이트 시 스케줄도 함께 갱신
  function handlePlanUpdate(updated: Plan) {
    setPlan(updated);
    setCompletions(updated.completions ?? []);
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function prevWeek() { setWeekStart((w) => addDays(w, -7)); }
  function nextWeek() { setWeekStart((w) => addDays(w, 7)); }

  function getCompletion(date: string, subject: string): number {
    return completions.find((c) => c.date === date && c.subject === subject)?.done ?? 0;
  }

  async function setDone(date: string, subject: string, done: number) {
    setCompletions((prev) => {
      const existing = prev.find((c) => c.date === date && c.subject === subject);
      if (existing) return prev.map((c) => c.date === date && c.subject === subject ? { ...c, done } : c);
      return [...prev, { id: "", planId: plan.id, date, subject, done }];
    });
    await fetch(`/api/planner/${plan.id}/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, subject, done }),
    });
  }

  const todaySchedule = schedule[today()] ?? {};
  const todayTotal = Object.values(todaySchedule).reduce((a, b) => a + b, 0);
  const cardStyle = { background: "var(--card)", borderColor: "var(--border)" };

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg" style={{ background: "var(--muted)" }}>
          <ChevronLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold">{plan.title}</h2>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {plan.startDate} ~ {plan.endDate}
            {todayTotal > 0 && <span className="ml-2 font-semibold" style={{ color: "var(--primary)" }}>오늘 {todayTotal}개</span>}
          </p>
        </div>
      </div>

      {/* 할 일 관리 */}
      <TaskManager plan={plan} onPlanUpdate={handlePlanUpdate} />

      {/* 할 일이 없으면 스케줄 미표시 */}
      {tasks.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={cardStyle}>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            할 일을 추가하면 자동으로 일정이 생성됩니다.
          </p>
        </div>
      ) : (
        <>
          {/* 주간 네비게이션 */}
          <div className="flex items-center justify-between">
            <button onClick={prevWeek} className="p-1.5 rounded-lg border" style={cardStyle}><ChevronLeft size={16} /></button>
            <p className="text-sm font-semibold">
              {formatDate(weekDays[0])} ~ {formatDate(weekDays[6])}
            </p>
            <button onClick={nextWeek} className="p-1.5 rounded-lg border" style={cardStyle}><ChevronRight size={16} /></button>
          </div>

          {/* 주간 그리드 */}
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((date, di) => {
              const daySchedule = schedule[date] ?? {};
              const isToday = date === today();
              const isOut = date < plan.startDate || date > plan.endDate;

              return (
                <div
                  key={date}
                  className="rounded-xl border p-2 min-h-24 space-y-1.5"
                  style={{
                    ...cardStyle,
                    borderColor: isToday ? "var(--primary)" : "var(--border)",
                    borderWidth: isToday ? 2 : 1,
                    opacity: isOut ? 0.3 : 1,
                  }}
                >
                  <div className="text-center">
                    <p className="text-xs font-bold" style={{ color: isToday ? "var(--primary)" : di === 6 ? "#ef4444" : di === 5 ? "#3b82f6" : "var(--foreground)" }}>
                      {DAYS_KO[di]}
                    </p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{formatDate(date)}</p>
                  </div>

                  {!isOut && Object.entries(daySchedule).map(([name, amount]) => {
                    const done = getCompletion(date, name);
                    const color = taskColors[name] ?? "#6366f1";
                    const finished = done >= amount;
                    return (
                      <div key={name} className="rounded-lg px-1.5 py-1 text-xs" style={{ background: finished ? "rgba(16,185,129,0.15)" : `${color}18` }}>
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate font-medium" style={{ color: finished ? "#10b981" : color }}>{name}</span>
                          {finished && <Check size={10} color="#10b981" />}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <button
                            onClick={() => void setDone(date, name, Math.max(0, done - 1))}
                            className="w-4 h-4 rounded text-center leading-none"
                            style={{ background: "var(--muted)", fontSize: "0.65rem" }}
                          >−</button>
                          <span className="flex-1 text-center" style={{ color: "var(--muted-foreground)", fontSize: "0.65rem" }}>
                            {done}/{amount}
                          </span>
                          <button
                            onClick={() => void setDone(date, name, Math.min(amount, done + 1))}
                            className="w-4 h-4 rounded text-center leading-none"
                            style={{ background: "var(--muted)", fontSize: "0.65rem" }}
                          >+</button>
                        </div>
                      </div>
                    );
                  })}
                  {!isOut && Object.keys(daySchedule).length === 0 && (
                    <p className="text-center text-xs" style={{ color: "var(--muted-foreground)" }}>휴식</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* 전체 진행률 */}
          <div className="rounded-xl border p-4 space-y-3" style={cardStyle}>
            <p className="text-sm font-semibold">전체 진행률</p>
            {tasks.map((task) => {
              const total = task.totalCount;
              const done = completions.filter((c) => c.subject === task.name).reduce((a, c) => a + c.done, 0);
              const pct = Math.min(100, Math.round((done / total) * 100));
              const color = taskColors[task.name] ?? "#6366f1";
              return (
                <div key={task.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{task.name}</span>
                    <span style={{ color: "var(--muted-foreground)" }}>{done}/{total}{task.unit} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--muted)" }}>
                    <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── 플랜 목록 ───────────────────────────────────────────────────
function PlanList({ plans, onSelect, onDelete }: {
  plans: Plan[];
  onSelect: (plan: Plan) => void;
  onDelete: (id: string) => void;
}) {
  const activePlanId = typeof window !== "undefined" ? localStorage.getItem("activePlanId") : null;

  async function deletePlan(id: string) {
    if (!confirm("플랜을 삭제하시겠습니까?")) return;
    await fetch(`/api/planner/${id}`, { method: "DELETE" });
    if (localStorage.getItem("activePlanId") === id) localStorage.removeItem("activePlanId");
    onDelete(id);
  }

  if (plans.length === 0) return (
    <div className="rounded-xl border p-10 text-center" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--muted-foreground)" }}>
      <Calendar size={32} className="mx-auto mb-3 opacity-30" />
      <p>아직 플랜이 없습니다.</p>
      <p className="text-sm mt-1">위에서 새 플랜을 만들어보세요.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">내 플랜 ({plans.length})</p>
      {plans.map((plan) => {
        const tasks: PlannerTask[] = JSON.parse(plan.tasks || "[]");
        const isActive = plan.id === activePlanId;
        return (
          <div
            key={plan.id}
            className="rounded-xl border p-4 flex items-center gap-3 cursor-pointer transition-all"
            style={{
              background: "var(--card)",
              borderColor: isActive ? "var(--primary)" : "var(--border)",
              borderWidth: isActive ? 2 : 1,
            }}
            onClick={() => void onSelect(plan)}
          >
            <BookOpen size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate">{plan.title}</p>
                {isActive && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                    진행중
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {plan.startDate} ~ {plan.endDate}
                {tasks.length > 0 && ` · ${tasks.map((t) => t.name).join(", ")}`}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); void deletePlan(plan.id); }}
              className="p-1.5 rounded flex-shrink-0"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── 메인 ────────────────────────────────────────────────────────
export function PlannerClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);

  const fetchPlans = useCallback(async () => {
    const res = await fetch("/api/planner");
    const data = await res.json() as Plan[];
    setPlans(data);
    setLoadingPlans(false);
  }, []);

  useEffect(() => { void fetchPlans(); }, [fetchPlans]);

  async function handleSelectPlan(plan: Plan) {
    const res = await fetch(`/api/planner/${plan.id}`);
    const full = await res.json() as Plan;
    localStorage.setItem("activePlanId", full.id);
    setSelectedPlan(full);
  }

  function handleCreated(plan: Plan) {
    setPlans((prev) => [plan, ...prev]);
    void handleSelectPlan(plan);
  }

  function handleDelete(id: string) {
    setPlans((p) => p.filter((x) => x.id !== id));
    if (selectedPlan?.id === id) setSelectedPlan(null);
  }

  if (selectedPlan) {
    return (
      <div className="space-y-5 max-w-4xl">
        <ScheduleView plan={selectedPlan} onBack={() => setSelectedPlan(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <CreateForm onCreated={handleCreated} />
      {loadingPlans ? (
        <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>로딩 중...</div>
      ) : (
        <PlanList plans={plans} onSelect={handleSelectPlan} onDelete={handleDelete} />
      )}
    </div>
  );
}
