-- Dedupe active courses per user (same normalized name) and prevent future duplicates.
-- Safe to re-run: uses is_active = false for dupes, not hard deletes.

WITH ranked AS (
  SELECT
    id,
    user_id,
    lower(trim(name)) AS norm_name,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, lower(trim(name))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.courses
  WHERE is_active = true
),
dupes AS (
  SELECT r.id AS dupe_id, k.id AS keep_id
  FROM ranked r
  JOIN ranked k
    ON k.user_id = r.user_id
   AND k.norm_name = r.norm_name
   AND k.rn = 1
  WHERE r.rn > 1
)
UPDATE public.tasks t
SET course_id = d.keep_id
FROM dupes d
WHERE t.course_id = d.dupe_id;

WITH ranked AS (
  SELECT
    id,
    user_id,
    lower(trim(name)) AS norm_name,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, lower(trim(name))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.courses
  WHERE is_active = true
)
UPDATE public.courses c
SET is_active = false, updated_at = now()
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS courses_user_norm_name_active_unique
  ON public.courses (user_id, lower(trim(name)))
  WHERE is_active = true;
