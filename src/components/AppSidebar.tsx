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
  IconShield,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "../hooks/useAuth";
import { useUserRole } from "@/hooks/moderation/useUserRole";
import { toast } from "sonner";
import { DocumentsOrganizationSidebar } from "./DocumentsOrganizationSidebar";
import { SoftGlowSeparator } from "./SoftGlowSeparator";

import { CadernosSidebar } from "./cadernos/CadernosSidebar";

// -------- Navigation config --------

interface SubItem {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  shortLabel?: string;
  href: string;
  icon: React.ReactNode;
  subItems?: SubItem[];
  customPanel?: boolean; // Uses custom panel content instead of subItems
  panelWidth?: number; // Custom panel width (default 220)
}

const mainNavigation: NavItem[] = [
  {
    label: "Dashboard",
    shortLabel: "Home",
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
  },
  {
    label: "Lei Seca",
    href: "/lei-seca",
    icon: <IconScale className="h-5 w-5" />,
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

const moderationNav: NavItem[] = [
  {
    label: "Moderação",
    shortLabel: "Mod.",
    href: "/moderacao",
    icon: <IconShield className="h-5 w-5" />,
  },
];

const toolsNavigation: NavItem[] = [
  {
    label: "Cronograma",
    shortLabel: "Crono",
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
  const { isModerator } = useUserRole();
  const isMobile = useIsMobile();

  const allNavItems = [...mainNavigation, ...toolsNavigation, ...(isModerator ? moderationNav : [])];
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
      {/* ===== DESKTOP: flat flex layout ===== */}
      {!isMobile && <div className="flex h-screen w-full overflow-hidden">
        {/* Icon Rail */}
        <div className="w-[76px] shrink-0 flex flex-col items-center py-4 px-2 bg-white">
          {/* Logo */}
          <a href="/" className="flex items-center justify-center py-1 mb-6">
            <div className="h-6 w-7 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] shadow-[0_2px_8px_rgba(30,64,175,0.3)]" />
          </a>

          {/* Main nav */}
          <nav className="flex flex-col gap-1">
            {mainNavigation.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavClick(item)}
                className={cn(
                  "flex flex-col items-center gap-0.5 w-[60px] py-1.5 px-1 rounded-[10px] transition-all duration-150 relative",
                  isActive(item.href)
                    ? "bg-[#DBEAFE]/80 text-[#1E40AF] shadow-[0_1px_4px_rgba(30,64,175,0.08)]"
                    : "bg-transparent text-[#8b8fa3] hover:text-[#64748b] hover:bg-black/[0.04]",
                  panelSection === item.href && !isActive(item.href) && "text-[#64748b] bg-black/[0.04]"
                )}
                title={item.label}
              >
                {item.icon}
                <span className={cn(
                  "text-[9px] font-medium leading-tight truncate max-w-[56px]",
                  isActive(item.href) ? "font-semibold" : ""
                )}>
                  {item.shortLabel || item.label}
                </span>
                {isActive(item.href) && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-[2.5px] h-[22px] rounded-r-[3px]"
                    style={{ left: '-1px', background: 'linear-gradient(180deg, #1E40AF, #3B82F6)' }}
                  />
                )}
              </button>
            ))}
          </nav>

          <div className="my-3 mx-1 border-t border-black/[0.06]" />

          {/* Tools nav */}
          <nav className="flex flex-col gap-1">
            {toolsNavigation.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavClick(item)}
                className={cn(
                  "flex flex-col items-center gap-0.5 w-[60px] py-1.5 px-1 rounded-[10px] transition-all duration-150 relative",
                  isActive(item.href)
                    ? "bg-[#DBEAFE]/80 text-[#1E40AF] shadow-[0_1px_4px_rgba(30,64,175,0.08)]"
                    : "bg-transparent text-[#8b8fa3] hover:text-[#64748b] hover:bg-black/[0.04]"
                )}
                title={item.label}
              >
                {item.icon}
                <span className={cn(
                  "text-[9px] font-medium leading-tight truncate max-w-[56px]",
                  isActive(item.href) ? "font-semibold" : ""
                )}>
                  {item.shortLabel || item.label}
                </span>
                {isActive(item.href) && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-[2.5px] h-[22px] rounded-r-[3px]"
                    style={{ left: '-1px', background: 'linear-gradient(180deg, #1E40AF, #3B82F6)' }}
                  />
                )}
              </button>
            ))}
          </nav>

          {/* Bottom: settings + moderation + user + logout */}
          <div className="mt-auto flex flex-col gap-1">
            {isModerator && (
              <>
                <div className="my-2 mx-1 border-t border-black/[0.06]" />
                {moderationNav.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => handleNavClick(item)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 w-[60px] py-1.5 px-1 rounded-[10px] transition-all duration-150 relative",
                      isActive(item.href)
                        ? "bg-violet-500/20 text-violet-300"
                        : "bg-transparent text-[#8b8fa3] hover:text-violet-300 hover:bg-violet-500/10"
                    )}
                    title={item.label}
                  >
                    {item.icon}
                    <span className={cn(
                      "text-[9px] font-medium leading-tight truncate max-w-[56px]",
                      isActive(item.href) ? "font-semibold" : ""
                    )}>
                      {item.shortLabel || item.label}
                    </span>
                    {isActive(item.href) && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-violet-400 rounded-r" />
                    )}
                  </button>
                ))}
              </>
            )}
            <button
              onClick={() => { setPanelSection(null); navigate("/settings"); }}
              className="flex flex-col items-center gap-0.5 w-[60px] py-1.5 px-1 rounded-[10px] bg-transparent text-[#8b8fa3] hover:text-[#64748b] hover:bg-black/[0.04] transition-all duration-150"
              title="Configurações"
            >
              <IconSettings className="h-5 w-5" />
              <span className="text-[9px] font-medium leading-tight truncate max-w-[56px]">Config</span>
            </button>

            {user && (
              <>
                <div className="flex items-center justify-center py-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] shadow-[0_2px_6px_rgba(30,64,175,0.25)] flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">
                      {user.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center h-9 w-9 rounded-[10px] bg-transparent text-[#8b8fa3] hover:text-red-400 hover:bg-red-500/[0.06] transition-all duration-150"
                  title="Sair"
                >
                  <IconLogout className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Separator: Rail → Flyout/Content */}
        <SoftGlowSeparator />

        {/* Flyout Panel */}
        <AnimatePresence>
          {panelItem && (panelItem.subItems || panelItem.customPanel) && (
            <>
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: panelItem.panelWidth || 220, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="flex flex-col overflow-hidden shrink-0 bg-white"
              >
                {panelItem.customPanel ? (
                  /* Custom panel content based on route */
                  panelItem.href === "/questoes" ? (
                    null
                  ) : panelItem.href === "/lei-seca" ? (
                    null
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
                              ? "bg-blue-100 text-blue-800 font-medium"
                              : "text-gray-500 hover:bg-blue-50 hover:text-gray-700"
                          )}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </nav>
                  </>
                )}
              </motion.div>
              {/* Separator: Flyout → Content */}
              <SoftGlowSeparator />
            </>
          )}
        </AnimatePresence>

        {/* Content area */}
        <div className="flex flex-1 min-w-0 bg-[#f8f9fb] flex-col overflow-hidden">
          {children}
        </div>
      </div>}

      {/* ===== MOBILE: Top bar + Content + Overlay ===== */}
      {isMobile && <div className="flex flex-col h-screen w-full">
        <div className="flex h-10 px-4 py-4 items-center justify-between bg-white border-b border-gray-200 w-full shrink-0">
          <a href="/" className="flex items-center gap-2 text-gray-800 text-sm font-medium">
            <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] shadow-[0_2px_8px_rgba(30,64,175,0.3)]" />
            Papiro
          </a>
          <IconMenu2
            className="text-gray-500 cursor-pointer"
            onClick={() => setMobileOpen(true)}
          />
        </div>
        <div className="flex-1 overflow-auto bg-[#f8f9fb]">
          {children}
        </div>
      </div>}

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 bg-gradient-to-t from-white via-blue-50/20 to-zinc-100 z-[100] flex flex-col p-6"
          >
            <div className="flex justify-between items-center mb-8">
              <a href="/" className="flex items-center gap-2 text-gray-800 text-sm font-medium">
                <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] shadow-[0_2px_8px_rgba(30,64,175,0.3)]" />
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
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-500 hover:bg-blue-50 hover:text-gray-700"
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
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] shadow-[0_2px_6px_rgba(30,64,175,0.25)] flex items-center justify-center">
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
