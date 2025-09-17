import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  Play,
  BookOpen,
  HelpCircle
} from "lucide-react";
import { useStudyMode } from "@/contexts/StudyModeContext";

const navigationItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Flashcards", url: "/flashcards", icon: Play },
  { title: "Conteúdos", url: "/documents-organization", icon: BookOpen },
  { title: "Questões", url: "/questoes", icon: HelpCircle },
];

export function NavigationHeader() {
  const { isGuidedMode } = useStudyMode();
  const location = useLocation();
  const currentPath = location.pathname;

  // Só renderiza se estiver no modo dirigido
  if (!isGuidedMode) {
    return null;
  }

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const getNavClassName = (path: string) => {
    const baseClasses = "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ease-in-out hover:scale-105 active:scale-95";
    if (isActive(path)) {
      return `${baseClasses} bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md hover:from-orange-600 hover:to-orange-700`;
    }
    return `${baseClasses} text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200/50`;
  };

  return (
    <div className="w-full bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-2">
        <nav className="flex items-center justify-center gap-2">
          {navigationItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              end={item.url === "/"}
              className={`${getNavClassName(item.url)} group`}
            >
              <item.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
              <span className="transition-all duration-200">{item.title}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}