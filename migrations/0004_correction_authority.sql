-- Preserve create authority; correction uses its own narrow scope. No data writes.
DROP TRIGGER IF EXISTS ingest_receipts_authority;
CREATE TRIGGER ingest_receipts_authority BEFORE INSERT ON ingest_receipts
WHEN NEW.operation NOT IN ('events:create', 'events:correct')
  OR NOT EXISTS (SELECT 1 FROM users WHERE user_id = NEW.owner_id AND role = 'owner' AND status = 'active')
  OR (NEW.grant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM integration_grants g WHERE g.grant_id = NEW.grant_id AND g.owner_id = NEW.owner_id
    AND g.revoked_at IS NULL AND g.expires_at > unixepoch(NEW.received_at)
    AND json_array_length(g.scopes) BETWEEN 1 AND 4
    AND NOT EXISTS (SELECT 1 FROM json_each(g.scopes) WHERE type <> 'text' OR value NOT IN ('context:read', 'events:read', 'events:write', 'events:correct'))
    AND (SELECT COUNT(DISTINCT value) FROM json_each(g.scopes)) = json_array_length(g.scopes)
    AND EXISTS (SELECT 1 FROM json_each(g.scopes) WHERE value = CASE NEW.operation WHEN 'events:create' THEN 'events:write' WHEN 'events:correct' THEN 'events:correct' END)
  ))
BEGIN
  SELECT RAISE(ABORT, 'PRIVATE_ACCESS_DENIED');
END;
