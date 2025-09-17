import { GraduationCap, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudyMode, StudyMode } from "@/contexts/StudyModeContext";
import { cn } from "@/lib/utils";

export function StudyModeToggle() {
  const { studyMode, setStudyMode } = useStudyMode();

  const handleModeChange = (mode: StudyMode) => {
    setStudyMode(mode);
  };

  const getButtonClassName = (mode: StudyMode) => {
    const baseClasses = "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all duration-300 ease-in-out hover:scale-[1.02] active:scale-[0.98] rounded-lg border";
    if (studyMode === mode) {
      return cn(baseClasses, "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg border-orange-500 hover:from-orange-600 hover:to-orange-700 hover:shadow-xl");
    }
    return cn(baseClasses, "text-slate-300 hover:text-white hover:bg-slate-700/50 border-slate-600 hover:border-slate-500 bg-slate-800/30 backdrop-blur-sm");
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleModeChange('dirigido')}
        className={getButtonClassName('dirigido')}
      >
        <GraduationCap className="h-4 w-4" />
        <span>Estudo Dirigido</span>
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleModeChange('manual')}
        className={getButtonClassName('manual')}
      >
        <User className="h-4 w-4" />
        <span>Estudo Manual</span>
      </Button>
    </div>
  );
}
