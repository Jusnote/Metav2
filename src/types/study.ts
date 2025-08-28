export interface StudyTask {
  id: string;
  title: string;
  subject: 'math' | 'science' | 'language' | 'history';
  duration: number; // em minutos
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  description?: string;
  dueDate?: Date;
}

export interface DaySchedule {
  id: string;
  day: string;
  date: Date;
  tasks: StudyTask[];
}

export interface WeekSchedule {
  id: string;
  week: string;
  days: DaySchedule[];
}