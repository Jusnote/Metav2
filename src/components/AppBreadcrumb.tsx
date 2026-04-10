"use client";
import { Link, useLocation } from "react-router-dom";
import { IconChevronRight } from "@tabler/icons-react";

const ROUTE_LABELS: Record<string, string> = {
  "": "Home",
  "flashcards": "Flashcards",
  "study": "Modo Estudo",
  "questoes": "Questões",
  "lei-seca": "Lei Seca",
  "cadernos": "Cadernos",
  "editais": "Editais",
  "cronograma": "Cronograma",
  "resumos-list": "Resumos",
  "plate-editor": "Editor",
  "documents-organization": "Conteúdos",
  "notes": "Notas",
  "goals": "Metas",
  "settings": "Configurações",
  "moderacao": "Moderação",
  "criar-questao": "Criar Questão",
};

export function AppBreadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => {
    const path = "/" + segments.slice(0, i + 1).join("/");
    const label = ROUTE_LABELS[seg] || decodeURIComponent(seg);
    const isLast = i === segments.length - 1;
    return { path, label, isLast };
  });

  return (
    <nav className="flex items-center gap-1.5 text-[13px] mb-4 max-w-5xl mx-auto w-full">
      <Link
        to="/"
        className="text-slate-400 hover:text-[#1E40AF] transition-colors font-medium"
      >
        Home
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.path} className="flex items-center gap-1.5">
          <IconChevronRight className="h-3 w-3 text-slate-300" />
          {crumb.isLast ? (
            <span className="text-slate-700 font-semibold">{crumb.label}</span>
          ) : (
            <Link
              to={crumb.path}
              className="text-slate-400 hover:text-[#1E40AF] transition-colors font-medium"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
