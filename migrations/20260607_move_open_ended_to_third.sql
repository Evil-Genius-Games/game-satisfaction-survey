-- Move the restored optional open-ended feedback question to the third survey position.
-- Existing deployments that already restored the question at the end of the standard survey can apply this safely.

BEGIN;

UPDATE questions
   SET display_order = 11
 WHERE survey_id = 1
   AND question_text = 'GM email address';

UPDATE questions
   SET display_order = 10
 WHERE survey_id = 1
   AND question_text = 'GM last name';

UPDATE questions
   SET display_order = 9
 WHERE survey_id = 1
   AND question_text = 'GM first name';

UPDATE questions
   SET display_order = 8
 WHERE survey_id = 1
   AND question_text = 'Would you like to learn more about being a GM?';

UPDATE questions
   SET display_order = 7
 WHERE survey_id = 1
   AND question_text = 'How likely are you to recommend this game to a friend?';

UPDATE questions
   SET display_order = 6
 WHERE survey_id = 1
   AND question_text = 'Rate the adventure from 1 to 5.';

UPDATE questions
   SET display_order = 5
 WHERE survey_id = 1
   AND question_text = 'Rate the GM from 1 to 5.';

UPDATE questions
   SET display_order = 4
 WHERE survey_id = 1
   AND question_text = 'What adventure did you play?';

INSERT INTO questions (
  survey_id,
  question_text,
  question_type,
  is_required,
  display_order,
  placeholder_text,
  validation_rules
)
SELECT
  1,
  'Do you have any other feedback about your game experience?',
  'long_text',
  false,
  3,
  'Share anything else you would like us to know...',
  '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
    FROM questions
   WHERE survey_id = 1
     AND question_text = 'Do you have any other feedback about your game experience?'
);

UPDATE questions
   SET question_type = 'long_text',
       is_required = false,
       display_order = 3,
       placeholder_text = COALESCE(placeholder_text, 'Share anything else you would like us to know...'),
       validation_rules = COALESCE(validation_rules, '{}'::jsonb)
 WHERE survey_id = 1
   AND question_text = 'Do you have any other feedback about your game experience?';

COMMIT;
