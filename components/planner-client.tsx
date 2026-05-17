"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Sparkles, ChevronLeft, ChevronRight, Check, Calendar, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── 타입 ────────────────────────────────────────────────────────
type Task = { name: string; totalCount: number; unit: string };

type Plan = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  tasks: string; // JSON
  schedule: string; // JSON
  createdAt: string;
  completions?: Completion[];
};

type Completion = { id: string; planId: string; date: string; subject: string; done: number };

// ── 유틸 ────────────────────────────────────────────────────────
function fmt(s: number): string {
  return String(Math.floor(s / 3600)).padStart(2, "0") + ":" +
    String(Math.floor((s % 3600) / 60)).padStart(2, "0") + ":" +
    String(s % 60).padStart(2, "0");
}

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
  const day = d.getDay(); // 0=일
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

// ── 계획 생성 폼 ────────────────────────────────────────────────
function CreateForm({ onCreated }: { onCreated: (plan: Plan) => void }) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(addDays(today(), 89)); // 기본 90일
  const [taskInfo, setTaskInfo] = useState("");
  const [dailyCapacity, setDailyCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!title.trim()) { setError("플랜 제목을 입력해주세요."); return; }
    if (!startDate || !endDate || endDate <= startDate) { setError("날짜 범위를 확인해주세요."); return; }
    if (!taskInfo.trim()) { setError("할 일 목록을 입력해주세요."); return; }

    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), startDate, endDate, taskInfo: taskInfo.trim(), dailyCapacity: dailyCapacity.trim(), description: description.trim() }),
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

  const inputStyle = { background: "var(--muted)", borderColor: "var(--border)" };
  const labelStyle: React.CSSProperties = { fontSize: "0.72rem", fontWeight: 600, color: "var(--muted-foreground)" };
  const textareaStyle = { background: "var(--muted)", borderColor: "var(--border)", color: "var(--foreground)" };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">AI 플래너</h2>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          할 일 목록을 붙여넣으면 AI가 날짜별 최적 일정을 짜드립니다.
        </p>
      </div>

      <div className="rounded-xl border p-5 space-y-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        {/* 플랜 제목 */}
        <div className="space-y-1">
          <label style={labelStyle}>플랜 제목</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 수능 D-100 플랜" style={inputStyle} />
        </div>

        {/* 날짜 */}
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

        {/* 할 일 목록 (자유 텍스트) */}
        <div className="space-y-1">
          <label style={labelStyle}>할 일 목록</label>
          <textarea
            value={taskInfo}
            onChange={(e) => setTaskInfo(e.target.value)}
            placeholder={"해야 할 것들을 자유롭게 붙여넣으세요.\n\n예시:\n뉴런 수학2 강의목록:\n1강 집합의 뜻과 표현\n2강 집합의 연산\n...\n\n수능특강 영어 1~20강\n국어 기출 2020~2024 (총 150문제)"}
            rows={9}
            className="w-full rounded-lg px-3 py-2 text-sm border outline-none resize-y"
            style={textareaStyle}
          />
        </div>

        {/* 하루 가능한 양 */}
        <div className="space-y-1">
          <label style={labelStyle}>하루에 가능한 양 (선택 — 없으면 AI가 알아서 판단)</label>
          <textarea
            value={dailyCapacity}
            onChange={(e) => setDailyCapacity(e.target.value)}
            placeholder={"예: 수학 인강 하루 최대 2강\n영어 기출 하루 10문제\n국어는 매일 꼭 포함"}
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm border outline-none resize-none"
            style={textareaStyle}
          />
        </div>

        {/* 추가 요청 */}
        <div className="space-y-1">
          <label style={labelStyle}>기타 요청 (선택)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={"예: 수학은 오전에 몰아서\n주말은 최대한 쉬게\n시험 2주 전부터는 기출만"}
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm border outline-none resize-none"
            style={textareaStyle}
          />
        </div>

        {error && (
          <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "var(--destructive)" }}>
            {error}
          </p>
        )}

        <Button onClick={handleSubmit} disabled={loading} className="w-full">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              AI가 일정 분석 중...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles size={15} /> AI 플랜 생성
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── 주간 스케줄 뷰 ──────────────────────────────────────────────
function ScheduleView({ plan, onBack }: { plan: Plan; onBack: () => void }) {
  const schedule: Record<string, Record<string, number>> = JSON.parse(plan.schedule || "{}");
  const tasks: Task[] = JSON.parse(plan.tasks || "[]");
  const taskColors: Record<string, string> = {};
  tasks.forEach((t, i) => { taskColors[t.name] = TASK_COLORS[i % TASK_COLORS.length]; });

  const [weekStart, setWeekStart] = useState(() => {
    const t = today();
    // 플랜 범위 안으로 클램프
    const clamp = t < plan.startDate ? plan.startDate : t > plan.endDate ? plan.endDate : t;
    return mondayOf(clamp);
  });
  const [completions, setCompletions] = useState<Completion[]>(plan.completions ?? []);

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

  // 오늘 총 할당량 계산
  const todaySchedule = schedule[today()] ?? {};
  const todayTotal = Object.values(todaySchedule).reduce((a, b) => a + b, 0);

  const cardStyle = { background: "var(--card)", borderColor: "var(--border)" };

  return (
    <div className="space-y-5">
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
                        onClick={() => setDone(date, name, Math.max(0, done - 1))}
                        className="w-4 h-4 rounded text-center leading-none"
                        style={{ background: "var(--muted)", fontSize: "0.65rem" }}
                      >−</button>
                      <span className="flex-1 text-center" style={{ color: "var(--muted-foreground)", fontSize: "0.65rem" }}>
                        {done}/{amount}
                      </span>
                      <button
                        onClick={() => setDone(date, name, Math.min(amount, done + 1))}
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

      {/* 과제별 진행도 */}
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
        const tasks: Task[] = JSON.parse(plan.tasks || "[]");
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
            onClick={() => onSelect(plan)}
          >
            <BookOpen size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate">{plan.title}</p>
                {isActive && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>진행중</span>}
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {plan.startDate} ~ {plan.endDate} · {tasks.map((t) => t.name).join(", ")}
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
    // completions 포함해서 다시 fetch
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
