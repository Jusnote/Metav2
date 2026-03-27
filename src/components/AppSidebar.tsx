"use client";
import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  IconHome,
  IconPlayerPlay,
  IconHelpCircle,
  IconScale,
  IconBook,
  IconCalendar,
  IconFileText,
  IconEdit,
  IconSettings,
  IconLogout,
  IconMenu2,
  IconX,
  IconNotebook,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useAuth } from "../hooks/useAuth";
import { toast } from "sonner";
import { LeiSecaSidebar } from "./lei-seca/LeiSecaSidebar";
import { DocumentsOrganizationSidebar } from "./DocumentsOrganizationSidebar";

import { CadernosSidebar } from "./cadernos/CadernosSidebar";

// -------- Navigation config --------

interface SubItem {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  subItems?: SubItem[];
  customPanel?: boolean; // Uses custom panel content instead of subItems
  panelWidth?: number; // Custom panel width (default 220)
}

const mainNavigation: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: <IconHome className="h-5 w-5" />,
  },
  {
    label: "Flashcards",
    href: "/flashcards",
    icon: <IconPlayerPlay className="h-5 w-5" />,
    subItems: [
      { label: "Meus Decks", href: "/flashcards" },
      { label: "Modo Estudo", href: "/study" },
    ],
  },
  {
    label: "Questões",
    href: "/questoes",
    icon: <IconHelpCircle className="h-5 w-5" />,
    customPanel: true,
    panelWidth: 320,
  },
  {
    label: "Lei Seca",
    href: "/lei-seca",
    icon: <IconScale className="h-5 w-5" />,
    customPanel: true,
    panelWidth: 340,
  },
  {
    label: "Conteúdos",
    href: "/documents-organization",
    icon: <IconBook className="h-5 w-5" />,
    customPanel: true,
    panelWidth: 340,
  },
  {
    label: "Cadernos",
    href: "/cadernos",
    icon: <IconNotebook className="h-5 w-5" />,
    customPanel: true,
    panelWidth: 300,
  },
];

const toolsNavigation: NavItem[] = [
  {
    label: "Cronograma",
    href: "/cronograma",
    icon: <IconCalendar className="h-5 w-5" />,
  },
  {
    label: "Resumos",
    href: "/resumos-list",
    icon: <IconFileText className="h-5 w-5" />,
  },
  {
    label: "Editor",
    href: "/plate-editor",
    icon: <IconEdit className="h-5 w-5" />,
  },
];

// -------- Component --------

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const [panelSection, setPanelSection] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const allNavItems = [...mainNavigation, ...toolsNavigation];
  const panelItem = allNavItems.find(item => item.href === panelSection);

  const isActive = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  // Auto-open panel for routes with customPanel (e.g. lei-seca)
  useEffect(() => {
    const customPanelItem = allNavItems.find(
      item => item.customPanel && location.pathname.startsWith(item.href)
    );
    if (customPanelItem) {
      setPanelSection(customPanelItem.href);
    }
  }, [location.pathname]);

  const handleNavClick = (item: NavItem) => {
    if ((item.subItems && item.subItems.length > 0) || item.customPanel) {
      setPanelSection(prev => prev === item.href ? null : item.href);
    } else {
      setPanelSection(null);
    }
    navigate(item.href);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logout realizado com sucesso!");
      navigate("/auth");
    } catch {
      toast.error("Erro ao fazer logout.");
    }
  };

  return (
    <>
      {/* ===== DESKTOP: 3 containers aninhados ===== */}
      <div className="hidden md:flex h-screen w-full bg-[#1B1D21] p-1.5 overflow-hidden">
        {/* Container 1 (externo): Icon Rail */}
        <div className="flex h-full w-full rounded-2xl bg-[#1B1D21] overflow-hidden">
          {/* Coluna de ícones */}
          <div className="w-14 shrink-0 flex flex-col py-4 px-2">
            {/* Logo */}
            <a href="/" className="flex items-center justify-center py-1 mb-6">
              <div className="h-6 w-7 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-[#E8930C]" />
            </a>

            {/* Main nav */}
            <nav className="flex flex-col gap-1">
              {mainNavigation.map((item) => (
                <button
                  key={item.href}
                  onClick={() => handleNavClick(item)}
                  className={cn(
                    "flex items-center justify-center h-9 w-9 rounded-md transition-all duration-150 relative",
                    isActive(item.href)
                      ? "bg-white/[0.08] text-white"
                      : "bg-transparent text-[#6B6760] hover:text-[#A09B94] hover:bg-white/[0.04]",
                    panelSection === item.href && !isActive(item.href) && "text-[#A09B94] bg-white/[0.04]"
                  )}
                  title={item.label}
                >
                  {item.icon}
                  {isActive(item.href) && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-[#E8930C] rounded-r" />
                  )}
                </button>
              ))}
            </nav>

            <div className="my-3 mx-1 border-t border-white/[0.06]" />

            {/* Tools nav */}
            <nav className="flex flex-col gap-1">
              {toolsNavigation.map((item) => (
                <button
                  key={item.href}
                  onClick={() => handleNavClick(item)}
                  className={cn(
                    "flex items-center justify-center h-9 w-9 rounded-md transition-all duration-150 relative",
                    isActive(item.href)
                      ? "bg-white/[0.08] text-white"
                      : "bg-transparent text-[#6B6760] hover:text-[#A09B94] hover:bg-white/[0.04]"
                  )}
                  title={item.label}
                >
                  {item.icon}
                  {isActive(item.href) && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-[#E8930C] rounded-r" />
                  )}
                </button>
              ))}
            </nav>

            {/* Bottom: settings + user + logout */}
            <div className="mt-auto flex flex-col gap-1">
              <button
                onClick={() => { setPanelSection(null); navigate("/settings"); }}
                className="flex items-center justify-center h-9 w-9 rounded-md bg-transparent text-[#6B6760] hover:text-[#A09B94] hover:bg-white/[0.04] transition-all duration-150"
                title="Configurações"
              >
                <IconSettings className="h-5 w-5" />
              </button>

              {user && (
                <>
                  <div className="flex items-center justify-center py-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#E8930C] to-[#C47A0A] flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">
                        {user.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center h-9 w-9 rounded-md bg-transparent text-[#6B6760] hover:text-red-400 hover:bg-red-500/[0.06] transition-all duration-150"
                    title="Sair"
                  >
                    <IconLogout className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Container 2 (meio): Flyout + Content */}
          <div className="flex flex-1 min-w-0 rounded-lg bg-[#F3F5F7] dark:bg-[#18181B] overflow-hidden m-1.5 ml-0 border border-[#E4E8EC] dark:border-[#27272A]">
            {/* Flyout Panel */}
            <AnimatePresence>
              {panelItem && (panelItem.subItems || panelItem.customPanel) && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: panelItem.panelWidth || 220, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="flex flex-col overflow-hidden shrink-0"
                >
                  {panelItem.customPanel ? (
                    /* Custom panel content based on route */
                    panelItem.href === "/questoes" ? (
                      null
                    ) : panelItem.href === "/lei-seca" ? (
                      <LeiSecaSidebar />
                    ) : panelItem.href === "/documents-organization" ? (
                      <DocumentsOrganizationSidebar />
                    ) : panelItem.href === "/cadernos" ? (
                      <CadernosSidebar />
                    ) : null
                  ) : (
                    /* Default subItems panel */
                    <>
                      <div className="p-4 pb-2">
                        <h3 className="text-gray-800 text-sm font-semibold">
                          {panelItem.label}
                        </h3>
                      </div>
                      <nav className="flex-1 overflow-auto px-2 py-1">
                        {panelItem.subItems!.map((sub) => (
                          <Link
                            key={sub.href}
                            to={sub.href}
                            className={cn(
                              "block px-3 py-2 rounded-md text-sm transition-colors mb-0.5",
                              (sub.href === "/" ? location.pathname === sub.href : location.pathname.startsWith(sub.href))
                                ? "bg-amber-100 text-amber-800 font-medium"
                                : "text-gray-500 hover:bg-amber-50 hover:text-gray-700"
                            )}
                          >
                            {sub.label}
                          </Link>
                        ))}
                      </nav>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Container 3 (interno): Conteúdo principal */}
            <div className="flex flex-1 min-w-0 rounded-lg bg-white dark:bg-[#09090B] m-1.5 flex-col overflow-hidden border border-[#E6E6EA]/50 dark:border-[#27272A]">
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* ===== MOBILE: Top bar + Content + Overlay ===== */}
      <div className="flex md:hidden flex-col h-screen w-full">
        <div className="flex h-10 px-4 py-4 items-center justify-between bg-gray-100 border-b border-gray-200 w-full shrink-0">
          <a href="/" className="flex items-center gap-2 text-gray-800 text-sm font-medium">
            <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-[#E8930C]" />
            Papiro
          </a>
          <IconMenu2
            className="text-gray-500 cursor-pointer"
            onClick={() => setMobileOpen(true)}
          />
        </div>
        <div className="flex-1 overflow-auto bg-white">
          {children}
        </div>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 bg-gradient-to-t from-white via-amber-50/20 to-zinc-100 z-[100] flex flex-col p-6"
          >
            <div className="flex justify-between items-center mb-8">
              <a href="/" className="flex items-center gap-2 text-gray-800 text-sm font-medium">
                <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-[#E8930C]" />
                Papiro
              </a>
              <IconX
                className="text-gray-500 cursor-pointer"
                onClick={() => setMobileOpen(false)}
              />
            </div>

            <nav className="flex flex-col gap-1">
              {allNavItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 py-3 px-3 rounded-lg transition-colors",
                    isActive(item.href)
                      ? "bg-amber-100 text-amber-700"
                      : "text-gray-500 hover:bg-amber-50 hover:text-gray-700"
                  )}
                >
                  {item.icon}
                  <span className="text-sm">{item.label}</span>
                </Link>
              ))}
            </nav>

            {user && (
              <div className="mt-auto pt-4 border-t border-gray-200">
                <div className="flex items-center gap-3 py-3 px-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#E8930C] to-[#C47A0A] flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">
                      {user.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{user.email?.split("@")[0]}</span>
                </div>
                <button
                  onClick={() => { setMobileOpen(false); handleLogout(); }}
                  className="flex items-center gap-3 py-3 px-3 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors w-full"
                >
                  <IconLogout className="h-5 w-5" />
                  <span className="text-sm">Sair</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
