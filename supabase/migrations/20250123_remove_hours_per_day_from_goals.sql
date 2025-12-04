-- Remove hours_per_day column from study_goals table
-- System now uses global availability from user_study_config instead
-- FSRS algorithm determines when revisions happen automatically
ALTER TABLE study_goals
DROP COLUMN IF EXISTS hours_per_day;

-- Add comment to study_goals table explaining the change
COMMENT ON TABLE study_goals IS 'Study goals use global availability from user_study_config. FSRS algorithm automatically schedules items based on available hours per day from configuration.';
