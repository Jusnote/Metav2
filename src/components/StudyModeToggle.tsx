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
    const baseClasses = "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 ease-in-out hover:scale-105 active:scale-95";
    if (studyMode === mode) {
      return cn(baseClasses, "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700");
    }
    return cn(baseClasses, "text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-300");
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