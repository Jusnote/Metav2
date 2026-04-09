"use client";

import { useState, useMemo } from "react";
import { ProgressRing } from "./ProgressRing";
import { WeekSelector } from "./WeekSelector";
import { useWeekSchedule, type WeekActivity } from "@/hooks/useWeekSchedule";
import { useDocumentsOrganization } from "@/contexts/DocumentsOrganizationContext";

// ============ CONSTANTS ============

type Tab = "tarefas" | "insights" | "sessoes" | "e-se";

const TABS: { key: Tab; label: string }[] = [
  { key: "tarefas", label: "Tarefas" },
  { key: "insights", label: "Insights" },
  { key: "sessoes", label: "Sessões" },
  { key: "e-se", label: "E se?" },
];

const TYPE_LABELS: Record<WeekActivity["type"], string> = {
  estudo: "Estudo",
  revisao: "Revisão",
  questoes: "Questões",
  "lei-seca": "Lei Seca",
};

// ============ HELPERS ============

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

function sortActivities(activities: WeekActivity[]): WeekActivity[] {
  return [...activities].sort((a, b) => {
    // suggested first, then pending, then completed
    if (a.suggested && !a.completed && !(b.suggested && !b.completed)) return -1;
    if (b.suggested && !b.completed && !(a.suggested && !a.completed)) return 1;
    if (!a.completed && b.completed) return -1;
    if (a.completed && !b.completed) return 1;
    return 0;
  });
}

// ============ SUB-COMPONENTS ============

function ScoreDisplay() {
  return (
    <div className="flex items-baseline gap-2">
      <div className="flex items-baseline gap-0.5">
        <span
          className="text-[32px] font-extrabold leading-none bg-gradient-to-r from-[#4f46e5] to-[#9b8afb] bg-clip-text text-transparent"
        >
          76
        </span>
        <span className="text-[14px] text-[#9e99ae] font-medium">/100</span>
      </div>
      <span className="text-[12px] font-semibold text-emerald-500">+4</span>
      <span className="text-[10px] font-medium text-[#6c63ff] bg-white/70 px-2 py-0.5 rounded-full">
        38 dias
      </span>
    </div>
  );
}

function WeekProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-semibold text-[#1a1625]">Semana</span>
      <div className="flex-1 h-[6px] rounded-full bg-[#eeecfb] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#6c63ff] to-[#9b8afb] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-semibold text-[#6c63ff]">
        {completed}/{total}
      </span>
    </div>
  );
}

function ActivityRow({ activity }: { activity: WeekActivity }) {
  const isSuggested = activity.suggested && !activity.completed;
  const isDone = activity.completed;

  return (
    <div
      className={`
        group flex items-center gap-3 px-6 py-[10px] transition-colors cursor-pointer
        border-t border-[#f0eef5]/50 first:border-t-0
        ${isSuggested ? "bg-[#f5f3ff] border-l-[2.5px] border-l-[#6c63ff] pl-[22px]" : "hover:bg-[#f8f7fd]"}
        ${isDone ? "opacity-[0.28]" : ""}
      `}
    >
      {/* Checkbox */}
      <div
        className={`
          w-[17px] h-[17px] rounded-full border-[1.5px] flex-shrink-0 flex items-center justify-center transition-colors
          ${isDone ? "bg-[#6c63ff] border-[#6c63ff]" : "border-[#d4d0e0] group-hover:border-[#9b8afb]"}
        `}
      >
        {isDone && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Title + Meta */}
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-semibold text-[#1a1625] truncate ${isDone ? "line-through" : ""}`}>
          {activity.title}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[#9e99ae] mt-0.5">
          <span>{activity.disciplina}</span>
          {activity.context && (
            <>
              <span className="text-[#d4d0e0]">&middot;</span>
              <span>{activity.context}</span>
            </>
          )}
          {activity.deadlineLabel && (
            <>
              <span className="text-[#d4d0e0]">&middot;</span>
              <span className="text-red-500 font-semibold">{activity.deadlineLabel}</span>
            </>
          )}
          <span className="text-[#d4d0e0]">&middot;</span>
          <span className="text-emerald-500 font-semibold">+{activity.pointsValue}</span>
        </div>
      </div>

      {/* Right: type + duration + button */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <span className="text-[10px] text-[#9e99ae] font-medium">
          {TYPE_LABELS[activity.type]}
        </span>
        <span className="text-[10px] text-[#c8c5d0]">
          {formatDuration(activity.durationMinutes)}
        </span>
        {!isDone && (
          <button
            className={`
              text-[10px] font-semibold text-white bg-[#6c63ff] px-3 py-1 rounded-md
              hover:bg-[#5b54e0] transition-all
              ${isSuggested ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
            `}
          >
            Iniciar
          </button>
        )}
      </div>
    </div>
  );
}

function TabTarefas({ activities }: { activities: WeekActivity[] }) {
  const sorted = useMemo(() => sortActivities(activities), [activities]);

  return (
    <div>
      <p className="text-[9px] text-[#9e99ae] mb-0 px-6 py-2">
        Itens em destaque s&atilde;o sugeridos para hoje
      </p>
      {sorted.map((a) => (
        <ActivityRow key={a.id} activity={a} />
      ))}
    </div>
  );
}

function TabInsights() {
  const cards = [
    {
      title: "Ponto fraco",
      main: "Dir. Administrativo 38%",
      detail: "+12.4 pts para fechar",
    },
    {
      title: "Evolução",
      main: "Velocidade +15%",
      detail: "Melhor horário 8h-10h",
    },
    {
      title: "Projeção",
      main: "Mantendo ritmo",
      detail: "82/100 em 30 dias",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 px-1">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-[#f5f3ff] border border-[#f0eef5] rounded-xl p-4"
        >
          <div className="text-[9px] uppercase tracking-wider font-semibold text-[#6c63ff] mb-2">{card.title}</div>
          <div className="text-[13px] font-semibold text-[#1a1625] mb-1">
            <strong>{card.main}</strong>
          </div>
          <div className="text-[11px] text-[#6b667a] leading-relaxed">{card.detail}</div>
        </div>
      ))}
    </div>
  );
}

function TabSessoes() {
  const sessions = [
    { time: "Hoje, 8h-9h20", desc: "Estudo — Dir. Constitucional", points: "+2.1" },
    { time: "Ontem, 14h-15h", desc: "Questões — Misto", points: "+0.6" },
    { time: "Ontem, 8h-9h", desc: "Estudo — Dir. Penal", points: "+1.4" },
    { time: "Seg, 19h-19h40", desc: "Revisão — Dir. Penal", points: "+0.8" },
    { time: "Seg, 8h-9h10", desc: "Lei Seca — Dir. Constitucional", points: "+0.5" },
  ];

  return (
    <div className="flex flex-col">
      {sessions.map((s, i) => (
        <div
          key={i}
          className={`
            flex items-center px-4 py-2.5 hover:bg-[#f8f7fd] transition-colors rounded-lg
            ${i > 0 ? "border-t border-[#f0eef5]/30" : ""}
          `}
        >
          <span className="text-[11px] text-[#9e99ae] font-medium w-[72px] flex-shrink-0">
            {s.time}
          </span>
          <span className="text-[11px] text-[#6b667a] flex-1">
            {s.desc}
          </span>
          <span className="text-[11px] text-emerald-500 font-bold">
            {s.points}
          </span>
        </div>
      ))}
    </div>
  );
}

function TabEse() {
  const [hours, setHours] = useState(4);
  // Simple linear projection mock
  const projected = Math.min(100, Math.round(60 + hours * 5.5));
  const probability = Math.min(99, Math.round(35 + hours * 8.5));

  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <label className="text-[13px] font-semibold text-[#1a1625]">
        Se eu estudar{" "}
        <span className="text-[#6c63ff] font-bold">{hours} h/dia</span>
      </label>
      <input
        type="range"
        min={1}
        max={8}
        step={0.5}
        value={hours}
        onChange={(e) => setHours(Number(e.target.value))}
        className="w-full max-w-xs accent-[#6c63ff] h-1.5"
      />
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-baseline gap-1">
          <span className="text-[10px] text-[#9e99ae]">Nota projetada:</span>
          <span className="text-[24px] font-extrabold bg-gradient-to-r from-[#4f46e5] to-[#9b8afb] bg-clip-text text-transparent">
            {projected}
          </span>
          <span className="text-[12px] text-[#9e99ae]">/100</span>
        </div>
        <span className="text-[11px] text-[#6b667a]">
          Probabilidade de aprovação: <strong className="text-[#6c63ff]">{probability}%</strong>
        </span>
      </div>
    </div>
  );
}

// ============ MAIN COMPONENT ============

export function CronogramaWeekView() {
  const { cronogramaWeek, setCronogramaWeek } = useDocumentsOrganization();
  const { activities, stats } = useWeekSchedule(cronogramaWeek);
  const [activeTab, setActiveTab] = useState<Tab>("tarefas");

  return (
    <div className="max-w-5xl mx-auto px-8 py-6 flex flex-col gap-0">
      <div className="bg-white rounded-2xl shadow-[0_0_0_1px_rgba(108,99,255,0.06),0_4px_16px_rgba(108,99,255,0.04)] overflow-hidden">

        {/* ---- Section 1: Rings + Score ---- */}
        <div
          className="flex items-center justify-between rounded-t-2xl px-8 py-6 border border-[#f0eef5] shadow-[0_1px_3px_rgba(108,99,255,0.06)]"
          style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ffffff 100%)" }}
        >
          {/* Left: rings */}
          <div className="flex items-center gap-6">
            <ProgressRing
              value={stats.byType.estudo.done}
              max={stats.byType.estudo.total}
              color="#6c63ff"
              label="Estudo"
            />
            <ProgressRing
              value={stats.byType.revisao.done}
              max={stats.byType.revisao.total}
              color="#9b8afb"
              label="Revisão"
            />
            <ProgressRing
              value={stats.byType.questoes.done}
              max={stats.byType.questoes.total}
              color="#b4acf9"
              label="Questões"
            />
            <ProgressRing
              value={stats.byType["lei-seca"].done}
              max={stats.byType["lei-seca"].total}
              color="#4f46e5"
              label="Lei Seca"
            />
            {/* Decorative accent line */}
            <div className="w-px h-8 bg-gradient-to-b from-transparent via-[#eeecfb] to-transparent ml-1" />
          </div>

          {/* Right: score */}
          <ScoreDisplay />
        </div>

        {/* Separator */}
        <div className="h-px bg-[#f0eef5]" />

        {/* ---- Section 2: Week selector + progress bar ---- */}
        <div className="flex items-center gap-4 px-8 py-4">
          <WeekSelector week={cronogramaWeek} onChange={setCronogramaWeek} />
          <div className="flex-1">
            <WeekProgressBar completed={stats.completed} total={stats.total} />
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-[#f0eef5]" />

        {/* ---- Section 3: Quick session + tabs ---- */}
        <div className="flex items-center justify-between px-8 py-3">
          {/* Left: session buttons */}
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-[#6c63ff] hover:bg-[#5b54e0] px-5 py-2 rounded-lg transition-colors shadow-sm">
              <span className="text-[9px]">&#9654;</span>
              Sess&atilde;o autom&aacute;tica &middot; 50min
            </button>
            <button className="text-[11px] font-semibold text-[#6c63ff] hover:bg-[#f5f3ff] px-4 py-2 rounded-lg transition-colors border border-[#f0eef5]">
              R&aacute;pida &middot; 25min
            </button>
          </div>

          {/* Right: pill tabs */}
          <div className="flex items-center bg-[#f5f3ff] rounded-lg p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  text-[11px] px-3 py-1.5 rounded-md transition-all
                  ${activeTab === tab.key
                    ? "bg-white shadow-sm text-[#6c63ff] font-semibold"
                    : "text-[#9e99ae] hover:text-[#6b667a] font-medium"
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-[#f0eef5]" />

        {/* ---- Section 4: Tab content ---- */}
        <div className="min-h-[200px]">
          {activeTab === "tarefas" && <TabTarefas activities={activities} />}
          {activeTab === "insights" && (
            <div className="px-6 py-4">
              <TabInsights />
            </div>
          )}
          {activeTab === "sessoes" && (
            <div className="px-4 py-2">
              <TabSessoes />
            </div>
          )}
          {activeTab === "e-se" && <TabEse />}
        </div>

        {/* Separator */}
        <div className="h-px bg-[#f0eef5]" />

        {/* ---- Section 5: Footer ---- */}
        <div className="flex items-center justify-between bg-[#f5f3ff] border-t border-[#f0eef5] rounded-b-2xl px-6 py-3.5">
          <span className="text-[11px] text-[#1a1625] font-medium">
            Fechar an&eacute;is: <span className="text-[#6c63ff] font-bold">+{stats.totalPoints - stats.earnedPoints} pts</span>
            {" "}&middot; Proje&ccedil;&atilde;o: <span className="font-bold text-[#6c63ff]">82</span>
          </span>
          <span className="text-[11px] text-[#9e99ae] font-medium">
            TRF 3a &middot; 38 dias
          </span>
        </div>
      </div>
    </div>
  );
}
