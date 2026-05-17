"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  TrendingUp,
  BookOpen,
  AlertTriangle,
  Sparkles,
  ClipboardList,
} from "lucide-react";

const navItems = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/exams/new", label: "모의고사 입력", icon: PlusCircle },
  { href: "/trends", label: "점수 추이", icon: TrendingUp },
  { href: "/wrong-notes", label: "오답 노트", icon: BookOpen },
  { href: "/weakness", label: "취약점 분석", icon: AlertTriangle },
  { href: "/math-helper", label: "AI 수학 도우미", icon: Sparkles },
  { href: "/math-problems", label: "수학 오답 정리", icon: ClipboardList },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col border-r py-6 px-3"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="mb-8 px-3">
        <h1 className="text-lg font-bold" style={{ color: "var(--primary)" }}>
          훈제오리 스터디
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          오답 노트 & 성적 추이
        </p>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={{
                background: active ? "var(--primary)" : "transparent",
                color: active ? "var(--primary-foreground)" : "var(--foreground)",
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
