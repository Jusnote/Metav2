-- Marcação v2: novos kinds 'underline' (sublinhado) e 'strike' (tachado).
-- O check inline original ganhou o nome automático question_highlights_kind_check;
-- drop defensivo (if exists) e recria com os 4 kinds.

alter table public.question_highlights drop constraint if exists question_highlights_kind_check;
alter table public.question_highlights add constraint question_highlights_kind_check check (kind in ('plain','attention','underline','strike'));
