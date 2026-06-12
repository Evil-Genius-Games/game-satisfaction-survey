-- Restore the core post-game rating sequence used by the survey and admin reports.
-- The intended respondent flow is:
--   1. Rate the GM from 1 to 5
--   2. Rate the adventure from 1 to 5
--   3. NPS/referral question from 1 to 10

UPDATE questions
SET
  question_text = 'Rate the GM from 1 to 5.',
  question_type = 'rating',
  is_required = true,
  validation_rules = '{"min": 1, "max": 5}'::jsonb
WHERE survey_id = 1
  AND display_order = 4;

UPDATE questions
SET
  question_text = 'Rate the adventure from 1 to 5.',
  question_type = 'rating',
  is_required = true,
  validation_rules = '{"min": 1, "max": 5}'::jsonb,
  placeholder_text = NULL
WHERE survey_id = 1
  AND display_order = 5;

UPDATE questions
SET
  question_text = 'How likely are you to recommend this game to a friend?',
  question_type = 'rating',
  is_required = true,
  validation_rules = '{"min": 1, "max": 10}'::jsonb,
  placeholder_text = NULL
WHERE survey_id = 1
  AND display_order = 6;
