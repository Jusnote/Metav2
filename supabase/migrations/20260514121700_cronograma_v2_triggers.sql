-- UP: triggers que publicam eventos. Handlers reais vêm em sub-plan 5.
-- DOWN: DROP TRIGGER ... DROP FUNCTION

-- 1. trg_publish_completion_event: INSERT em plan_events quando schedule_items.status → 'concluido'
CREATE OR REPLACE FUNCTION fn_publish_completion_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'concluido') THEN
    INSERT INTO plan_events (plano_id, event_type, payload)
    VALUES (NEW.plano_id, 'item.completed', jsonb_build_object(
      'item_id', NEW.id,
      'week_number', NEW.week_number,
      'type', NEW.type,
      'completed_at', NEW.completed_at,
      'subtopico_id', NEW.subtopico_id
    ));
  END IF;
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'pulado') THEN
    INSERT INTO plan_events (plano_id, event_type, payload)
    VALUES (NEW.plano_id, 'item.skipped', jsonb_build_object(
      'item_id', NEW.id,
      'week_number', NEW.week_number
    ));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_publish_completion_event ON schedule_items;
CREATE TRIGGER trg_publish_completion_event
  AFTER UPDATE OF status ON schedule_items
  FOR EACH ROW EXECUTE FUNCTION fn_publish_completion_event();

-- 2. trg_publish_week_completed: INSERT em plan_events quando weekly_stats.completion_pct ≥ 100
CREATE OR REPLACE FUNCTION fn_publish_week_completed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'UPDATE'
      AND (OLD.completion_pct IS NULL OR OLD.completion_pct < 100)
      AND NEW.completion_pct >= 100) THEN
    INSERT INTO plan_events (plano_id, event_type, payload)
    VALUES (NEW.plano_id, 'week.completed', jsonb_build_object(
      'week_number', NEW.week_number
    ));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_publish_week_completed ON weekly_stats;
CREATE TRIGGER trg_publish_week_completed
  AFTER UPDATE OF completion_pct ON weekly_stats
  FOR EACH ROW EXECUTE FUNCTION fn_publish_week_completed();

-- 3. Increment version on schedule_items UPDATE (optimistic lock)
CREATE OR REPLACE FUNCTION fn_increment_schedule_item_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_increment_version ON schedule_items;
CREATE TRIGGER trg_increment_version
  BEFORE UPDATE ON schedule_items
  FOR EACH ROW EXECUTE FUNCTION fn_increment_schedule_item_version();

COMMENT ON FUNCTION fn_publish_completion_event IS 'Trigger: publica item.completed ou item.skipped em plan_events';
COMMENT ON FUNCTION fn_publish_week_completed IS 'Trigger: publica week.completed quando completion_pct cruza 100%';
COMMENT ON FUNCTION fn_increment_schedule_item_version IS 'Trigger: incrementa version pra optimistic lock';
