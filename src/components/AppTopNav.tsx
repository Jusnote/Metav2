"use client";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  IconHome,
  IconPlayerPlay,
  IconHelpCircle,
  IconScale,
  IconNotebook,
  IconClipboardList,
  IconCalendar,
  IconFileText,
  IconEdit,
  IconSettings,
  IconLogout,
  IconMenu2,
  IconX,
  IconShield,
  IconSearch,
  IconBell,
  IconChevronDown,
  IconArrowUp,
  IconCheck,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "../hooks/useAuth";
import { useUserRole } from "@/hooks/moderation/useUserRole";
import { toast } from "sonner";
import { StudyConfigDialog } from "./StudyConfigDialog";
import { useStudyConfig } from "../hooks/useStudyConfig";

// -------- Navigation config --------

interface SubItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  subItems?: SubItem[];
}

const mainNavigation: NavItem[] = [
  { label: "Início", href: "/", icon: <IconHome className="h-4 w-4" /> },
  {
    label: "Flashcards",
    href: "/flashcards",
    icon: <IconPlayerPlay className="h-4 w-4" />,
    subItems: [
      { label: "Meus Decks", href: "/flashcards" },
      { label: "Modo Estudo", href: "/study" },
    ],
  },
  { label: "Questões", href: "/questoes", icon: <IconHelpCircle className="h-4 w-4" /> },
  { label: "Lei Seca", href: "/lei-seca", icon: <IconScale className="h-4 w-4" /> },
  { label: "Cadernos", href: "/cadernos", icon: <IconNotebook className="h-4 w-4" /> },
  { label: "Editais", href: "/editais", icon: <IconClipboardList className="h-4 w-4" /> },
];

const rightNavigation: NavItem[] = [
  { label: "Cronograma", href: "/cronograma", icon: <IconCalendar className="h-4 w-4" /> },
];

const moreItems: NavItem[] = [
  { label: "Resumos", href: "/resumos-list", icon: <IconFileText className="h-4 w-4" /> },
  { label: "Editor", href: "/plate-editor", icon: <IconEdit className="h-4 w-4" /> },
];

const moderationItem: NavItem = {
  label: "Moderação",
  href: "/moderacao",
  icon: <IconShield className="h-4 w-4" />,
};

// -------- Component --------

export function AppTopNav({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isModerator } = useUserRole();
  const { config } = useStudyConfig();
  const isMobile = useIsMobile();

  const allNavItems = [...mainNavigation, ...rightNavigation, ...moreItems, ...(isModerator ? [moderationItem] : [])];

  const isActive = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  // Sticky header shadow on scroll
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logout realizado com sucesso!");
      navigate("/auth");
    } catch {
      toast.error("Erro ao fazer logout.");
    }
  };

  // Config status
  const getConfigStatus = () => {
    if (!config) return { percentage: 0, color: "red" as const, label: "Não configurado" };
    const completedSections = config.metadata?.completedSections || [];
    const weights = { essential: 40, times: 20, preferences: 20, goals: 20 } as const;
    const sections = ["essential", "times", "preferences", "goals"] as const;
    let total = 0;
    sections.forEach((s) => { if (completedSections.includes(s)) total += weights[s]; });
    if (total === 0) return { percentage: 0, color: "red" as const, label: "Não configurado" };
    if (total < 100) return { percentage: total, color: "yellow" as const, label: `${total}% configurado` };
    return { percentage: 100, color: "green" as const, label: "Configuração completa" };
  };
  const configStatus = getConfigStatus();

  return (
    <>
      {/* ===== DESKTOP ===== */}
      {!isMobile && (
        <div className="flex flex-col h-screen w-full overflow-hidden">
          {/* Accent stripe */}
          <div className="h-[3px] shrink-0 bg-white" />

          {/* Sticky header */}
          <div
            className={cn(
              "sticky top-0 z-50 shrink-0 transition-shadow duration-300",
              scrolled && "shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
            )}
          >
            {/* ---- Top Bar ---- */}
            <div className="bg-white/92 backdrop-blur-[16px] border-b border-slate-100/60">
              <div className="max-w-[1200px] mx-auto px-12">
                <div className="flex items-center h-[60px] gap-5">
                  {/* Logo */}
                  <Link
                    to="/"
                    className="flex items-center shrink-0 mr-1 -ml-10 hover:opacity-90 active:scale-[0.98] transition-all"
                  >
                    <img
                      src="/logo-papiro.png"
                      alt="Papiro"
                      className="h-[200px] w-auto mix-blend-multiply object-contain"
                      style={{ filter: "contrast(1.05)", margin: "-70px 0" }}
                    />
                  </Link>

                  {/* Search */}
                  <div className="flex-1 max-w-[420px] relative group">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none transition-colors group-focus-within:text-blue-500" />
                    <input
                      type="text"
                      placeholder="Buscar disciplinas, concursos e provas..."
                      className={cn(
                        "w-full h-[38px] pl-9 pr-[52px] rounded-[10px]",
                        "bg-slate-50 border-[1.5px] border-slate-200",
                        "text-[13px] font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal",
                        "outline-none transition-all duration-250",
                        "hover:bg-white hover:border-slate-300",
                        "focus:bg-white focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]"
                      )}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 pointer-events-none">
                      <kbd className="inline-flex items-center justify-center min-w-[22px] h-5 px-1 bg-white border border-slate-200 border-b-2 rounded-[5px] text-[10px] font-bold text-slate-400">
                        Ctrl
                      </kbd>
                      <kbd className="inline-flex items-center justify-center min-w-[22px] h-5 px-1 bg-white border border-slate-200 border-b-2 rounded-[5px] text-[10px] font-bold text-slate-400">
                        K
                      </kbd>
                    </div>
                  </div>

                  {/* Right actions */}
                  <div className="ml-auto flex items-center gap-1.5">
                    <button className="h-[34px] px-[18px] bg-gradient-to-br from-[#1E40AF] to-[#1D4ED8] text-white text-[12.5px] font-bold rounded-lg border-none cursor-pointer shadow-[0_1px_4px_rgba(30,64,175,0.2)] hover:from-[#1D4ED8] hover:to-[#2563EB] hover:shadow-[0_4px_14px_rgba(30,64,175,0.25)] hover:-translate-y-px active:translate-y-0 transition-all">
                      Upgrade
                    </button>

                    <div className="w-px h-[22px] bg-slate-200 mx-2" />

                    {/* Config */}
                    <button
                      onClick={() => setShowConfigDialog(true)}
                      className="w-[34px] h-[34px] rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-[0.92] transition-all relative"
                      title={configStatus.label}
                    >
                      <IconSettings className="h-[19px] w-[19px]" />
                      {configStatus.color === "red" && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                      )}
                      {configStatus.color === "yellow" && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-yellow-500 rounded-full text-[7px] text-white font-bold flex items-center justify-center">
                          {configStatus.percentage}
                        </span>
                      )}
                      {configStatus.color === "green" && (
                        <IconCheck className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 text-green-500" />
                      )}
                    </button>

                    {/* Notifications */}
                    <button className="w-[34px] h-[34px] rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-[0.92] transition-all relative">
                      <IconBell className="h-[19px] w-[19px]" />
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-[pulse-dot_2s_infinite]" />
                    </button>

                    <div className="w-px h-[22px] bg-slate-200 mx-2" />

                    {/* User */}
                    {user && (
                      <div className="flex items-center gap-2 py-[3px] px-2.5 pl-[3px] rounded-full cursor-pointer border border-transparent hover:bg-slate-50 hover:border-slate-100 transition-all">
                        <Avatar className="h-8 w-8 shadow-[0_2px_8px_rgba(30,64,175,0.18)]">
                          <AvatarFallback className="bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] text-white text-[13px] font-bold">
                            {user.email?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="leading-tight">
                          <div className="text-[13px] font-semibold text-slate-700">
                            {user.email?.split("@")[0]}
                          </div>
                          <div className="text-[10px] text-slate-400">Pro Plan</div>
                        </div>
                        <IconChevronDown className="h-3.5 w-3.5 text-slate-400 ml-0.5" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ---- Nav Bar (Dark) ---- */}
            <nav className="bg-[#2d2d2d]">
              <div className="max-w-[1200px] mx-auto px-12">
                <div className="flex items-center justify-center h-[42px] gap-1 pl-6">
                  {/* Main nav items */}
                  {mainNavigation.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      isActive={isActive(item.href)}
                      navigate={navigate}
                      location={location}
                    />
                  ))}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Right nav items */}
                  {rightNavigation.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      isActive={isActive(item.href)}
                      navigate={navigate}
                      location={location}
                    />
                  ))}

                  {/* More dropdown */}
                  <MoreDropdown
                    items={moreItems}
                    moderationItem={isModerator ? moderationItem : undefined}
                    isActive={isActive}
                    navigate={navigate}
                  />
                </div>
              </div>
            </nav>
          </div>

          {/* Content area */}
          <div
            className="flex-1 overflow-auto bg-[#f8fafc] relative"
            style={{
              backgroundImage: "radial-gradient(circle, #e5e5e5 0.5px, transparent 0.5px)",
              backgroundSize: "32px 32px",
              backgroundColor: "#F1F1F1",
            }}
          >
            {children}
          </div>
        </div>
      )}

      {/* ===== MOBILE ===== */}
      {isMobile && (
        <div className="flex flex-col h-screen w-full">
          {/* Accent stripe */}
          <div className="h-[3px] shrink-0 bg-white" />

          {/* Mobile top bar */}
          <div className="flex h-12 px-4 items-center justify-between bg-white border-b border-slate-200 shrink-0">
            <Link to="/" className="flex items-center">
              <img
                src="/logo-papiro.png"
                alt="Papiro"
                className="h-7 w-auto mix-blend-multiply"
                style={{ filter: "contrast(1.05)" }}
              />
            </Link>
            <button
              onClick={() => setMobileOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <IconMenu2 className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto bg-[#f8fafc]">
            {children}
          </div>
        </div>
      )}

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 bg-white z-[100] flex flex-col"
          >
            {/* Mobile header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <Link to="/" className="flex items-center" onClick={() => setMobileOpen(false)}>
                <img
                  src="/logo-papiro.png"
                  alt="Papiro"
                  className="h-8 w-auto mix-blend-multiply"
                  style={{ filter: "contrast(1.05)" }}
                />
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile search */}
            <div className="px-6 py-3">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="w-full h-10 pl-9 pr-4 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Mobile nav */}
            <nav className="flex-1 overflow-auto px-4 py-2">
              {allNavItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 py-3 px-3 rounded-lg transition-colors",
                    isActive(item.href)
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  )}
                >
                  {item.icon}
                  <span className="text-sm">{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* Mobile footer */}
            {user && (
              <div className="px-4 py-4 border-t border-slate-200">
                <div className="flex items-center gap-3 py-3 px-3">
                  <Avatar className="h-9 w-9 shadow-[0_2px_6px_rgba(30,64,175,0.25)]">
                    <AvatarFallback className="bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] text-white text-sm font-bold">
                      {user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium text-slate-700">{user.email?.split("@")[0]}</div>
                    <div className="text-xs text-slate-400">{user.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => { setMobileOpen(false); handleLogout(); }}
                  className="flex items-center gap-3 py-3 px-3 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors w-full mt-1"
                >
                  <IconLogout className="h-5 w-5" />
                  <span className="text-sm">Sair</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Config Dialog */}
      <StudyConfigDialog
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        onComplete={() => {
          toast.success("Configuração salva com sucesso!");
        }}
      />
    </>
  );
}

// -------- NavLink sub-component --------

function NavLink({
  item,
  isActive: active,
  navigate,
  location,
}: {
  item: NavItem;
  isActive: boolean;
  navigate: ReturnType<typeof useNavigate>;
  location: ReturnType<typeof useLocation>;
}) {
  const hasDropdown = item.subItems && item.subItems.length > 0;
  const wrapRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={wrapRef} className="relative flex items-stretch group">
      <button
        onClick={() => navigate(item.href)}
        className={cn(
          "inline-flex items-center gap-2 px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap cursor-pointer transition-all duration-200 relative",
          "text-[#a0a0a0] hover:text-white hover:bg-white/[0.07] rounded-md",
          active && "!text-white"
        )}
      >
        <span className={cn("transition-opacity", active ? "opacity-100" : "opacity-60 group-hover:opacity-90")}>{item.icon}</span>
        {item.label}
        {hasDropdown && (
          <IconChevronDown className="h-3 w-3 text-[#666] group-hover:text-[#999] group-hover:translate-y-px transition-all" />
        )}
        {/* Active blue underline */}
        {active && (
          <span className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-t-sm bg-[#1E40AF] shadow-[0_0_6px_rgba(30,64,175,0.4)]" />
        )}
      </button>

      {/* Dropdown */}
      {hasDropdown && (
        <div className="absolute top-full left-0 pt-1.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50">
          <div className="bg-white border border-slate-200 rounded-xl p-1.5 min-w-[190px] shadow-[0_10px_40px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,0,0,0.04)] animate-[dd-open_0.18s_cubic-bezier(0.16,1,0.3,1)]">
            {item.subItems!.map((sub) => (
              <Link
                key={sub.href}
                to={sub.href}
                className={cn(
                  "flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium rounded-lg transition-all duration-100",
                  (sub.href === "/" ? location.pathname === sub.href : location.pathname.startsWith(sub.href))
                    ? "bg-slate-50 text-slate-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-800 hover:translate-x-0.5"
                )}
              >
                {sub.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// -------- MoreDropdown sub-component --------

function MoreDropdown({
  items,
  moderationItem,
  isActive,
  navigate,
}: {
  items: NavItem[];
  moderationItem?: NavItem;
  isActive: (href: string) => boolean;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const anyActive = items.some((i) => isActive(i.href)) || (moderationItem && isActive(moderationItem.href));

  return (
    <div className="relative flex items-stretch group">
      <button
        className={cn(
          "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap cursor-pointer transition-all duration-200 relative",
          "text-[#a0a0a0] hover:text-white hover:bg-white/[0.07]",
          anyActive && "!text-white"
        )}
      >
        Mais
        <IconChevronDown className="h-3 w-3 text-[#666] group-hover:text-[#999] group-hover:translate-y-px transition-all" />
        {anyActive && (
          <span className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-t-sm bg-[#1E40AF] shadow-[0_0_6px_rgba(30,64,175,0.4)]" />
        )}
      </button>

      {/* Dropdown */}
      <div className="absolute top-full right-0 pt-1.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 z-50">
        {/* Invisible bridge */}
        <div className="bg-white border border-slate-200 rounded-xl p-1.5 min-w-[210px] shadow-[0_12px_48px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.04)] animate-[dd-open_0.18s_cubic-bezier(0.16,1,0.3,1)]">
          {items.map((item) => (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={cn(
                "flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] font-medium rounded-lg transition-all duration-100",
                isActive(item.href)
                  ? "bg-slate-50 text-slate-800"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-800 hover:translate-x-0.5"
              )}
            >
              <span className="text-slate-400">{item.icon}</span>
              {item.label}
            </button>
          ))}

          {moderationItem && (
            <>
              <div className="h-px bg-slate-100 my-1 mx-2.5" />
              <button
                onClick={() => navigate(moderationItem.href)}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] font-medium rounded-lg transition-all duration-100",
                  isActive(moderationItem.href)
                    ? "bg-violet-50 text-violet-700"
                    : "text-violet-600 hover:bg-violet-50 hover:text-violet-700 hover:translate-x-0.5"
                )}
              >
                <span className="text-violet-400">{moderationItem.icon}</span>
                {moderationItem.label}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
