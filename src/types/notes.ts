export interface Note {
  id: string;
  subtopic_id: string | null;
  topic_id: string | null;
  title: string;
  content: string;
  created_at: string;
  updated_at?: string;
  user_id: string;
}

export interface CreateNoteRequest {
  subtopic_id?: string | null;
  topic_id?: string | null;
  title?: string;
  content: string;
}

export interface UpdateNoteRequest {
  id: string;
  content: string;
}

export interface NotesResponse {
  notes: Note[];
  count: number;
}

export interface UseNotesReturn {
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  createNote: (data: CreateNoteRequest) => Promise<Note | null>;
  updateNote: (data: UpdateNoteRequest) => Promise<Note | null>;
  deleteNote: (id: string) => Promise<boolean>;
  fetchNotes: (subtopicId?: string | null, topicId?: string | null) => Promise<void>;
  fetchNotesByTopic: (topicId: string) => Promise<void>;
  fetchNotesBySubtopic: (subtopicId: string) => Promise<void>;
  clearNotes: () => void;
}