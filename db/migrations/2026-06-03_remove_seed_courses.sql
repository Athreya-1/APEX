-- Remove legacy demo courses from early settings UI (MOCK_COURSES).
-- Safe to re-run: only touches active rows matching known seed patterns.

WITH seeds AS (
  SELECT id, user_id
  FROM public.courses
  WHERE is_active = true
    AND (
      (lower(trim(coalesce(code, ''))) = '15-213'
        AND lower(trim(name)) ~ 'intro(duction)?.*computer.*system')
      OR (lower(trim(coalesce(code, ''))) = '18-240'
        AND lower(trim(name)) ~ 'logic.*computation')
      OR (lower(trim(coalesce(code, ''))) = '15-251'
        AND lower(trim(name)) ~ 'great ideas')
      OR (lower(trim(coalesce(code, ''))) = 'cmr'
        AND lower(trim(name)) = 'carnegie mellon racing')
      OR (trim(coalesce(code, '')) = ''
        AND lower(trim(name)) ~ 'intro(duction)?.*computer.*system')
    )
),
replacement AS (
  SELECT s.id AS seed_id, r.id AS keep_id
  FROM seeds s
  JOIN LATERAL (
    SELECT c.id
    FROM public.courses c
    WHERE c.user_id = s.user_id
      AND c.is_active = true
      AND c.id <> s.id
      AND (
        lower(trim(coalesce(c.code, ''))) = '18-213'
        OR lower(trim(c.name)) ~ '18-213|computer.*system'
      )
    ORDER BY c.created_at ASC
    LIMIT 1
  ) r ON true
)
UPDATE public.tasks t
SET course_id = rep.keep_id
FROM replacement rep
WHERE t.course_id = rep.seed_id;

WITH seeds AS (
  SELECT id
  FROM public.courses
  WHERE is_active = true
    AND (
      (lower(trim(coalesce(code, ''))) = '15-213'
        AND lower(trim(name)) ~ 'intro(duction)?.*computer.*system')
      OR (lower(trim(coalesce(code, ''))) = '18-240'
        AND lower(trim(name)) ~ 'logic.*computation')
      OR (lower(trim(coalesce(code, ''))) = '15-251'
        AND lower(trim(name)) ~ 'great ideas')
      OR (lower(trim(coalesce(code, ''))) = 'cmr'
        AND lower(trim(name)) = 'carnegie mellon racing')
      OR (trim(coalesce(code, '')) = ''
        AND lower(trim(name)) ~ 'intro(duction)?.*computer.*system')
    )
)
UPDATE public.courses c
SET is_active = false, updated_at = now()
FROM seeds s
WHERE c.id = s.id;
