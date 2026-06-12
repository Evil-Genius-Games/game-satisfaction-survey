from pathlib import Path

path = Path('/home/ubuntu/game-satisfaction-survey/app/components/SurveyForm.tsx')
text = path.read_text()

replacements = [
    (
        "const QUESTION_KEYS = {\n  convention: 'What convention are you attending?',\n  adventure: 'What adventure did you play?',\n} as const;\n",
        "const QUESTION_KEYS = {\n  convention: 'What convention are you attending?',\n  adventure: 'What adventure did you play?',\n} as const;\n\nconst STANDARD_SURVEY_END_ORDER = 7;\nconst GM_INTEREST_ORDER = 8;\nconst GM_FIRST_NAME_ORDER = 9;\nconst GM_LAST_NAME_ORDER = 10;\nconst GM_EMAIL_ORDER = 11;\n"
    ),
    ("    const gmInterestQuestion = findQuestionByOrder(questions, 7);", "    const gmInterestQuestion = findQuestionByOrder(questions, GM_INTEREST_ORDER);") ,
    ("        return o >= 8 && o <= 10;", "        return o >= GM_FIRST_NAME_ORDER && o <= GM_EMAIL_ORDER;") ,
    ("      if (o <= 7) return true;", "      if (o <= GM_INTEREST_ORDER) return true;"),
    ("      if (o >= 8 && o <= 10) {", "      if (o >= GM_FIRST_NAME_ORDER && o <= GM_EMAIL_ORDER) {"),
    ("      result = questions.filter(q => order(q) <= 7);", "      result = questions.filter(q => order(q) <= GM_INTEREST_ORDER);") ,
    ("      if (questionId === findQuestionByOrder(survey?.questions, 7)?.id && value === 'no') {\n        const firstNameQuestion = findQuestionByOrder(survey?.questions, 8);\n        const lastNameQuestion = findQuestionByOrder(survey?.questions, 9);\n        const emailQuestion = findQuestionByOrder(survey?.questions, 10);",
     "      if (questionId === findQuestionByOrder(survey?.questions, GM_INTEREST_ORDER)?.id && value === 'no') {\n        const firstNameQuestion = findQuestionByOrder(survey?.questions, GM_FIRST_NAME_ORDER);\n        const lastNameQuestion = findQuestionByOrder(survey?.questions, GM_LAST_NAME_ORDER);\n        const emailQuestion = findQuestionByOrder(survey?.questions, GM_EMAIL_ORDER);"),
    ("    // Check if we're on the recommendation question (Q6)\n    const recommendationQuestion = findQuestionByOrder(survey?.questions, 6);\n    const currentQ = effectiveVisibleQuestions[currentQuestion];\n    \n    // If we just answered the recommendation question, submit survey and show coupon page\n    if (recommendationQuestion && currentQ?.id === recommendationQuestion.id && answers[recommendationQuestion.id] !== undefined && answers[recommendationQuestion.id] !== null && answers[recommendationQuestion.id] !== '' && !showCouponPage && !responseId) {",
     "    // Check if we're on the final standard survey question before the GM-interest follow-up.\n    // With the restored open-ended question, this is Q7; older databases without Q7 fall back to Q6.\n    const currentQ = effectiveVisibleQuestions[currentQuestion];\n    const finalStandardSurveyQuestion = effectiveVisibleQuestions\n      .filter(q => questionOrder(q) <= STANDARD_SURVEY_END_ORDER)\n      .sort((a, b) => questionOrder(a) - questionOrder(b))\n      .at(-1);\n    const currentAnswer = currentQ ? answers[currentQ.id] : undefined;\n    const currentQuestionAnswered = !currentQ?.is_required || (currentAnswer !== undefined && currentAnswer !== null && (typeof currentAnswer !== 'string' || currentAnswer.trim() !== ''));\n    \n    // If we just answered the final standard survey question, submit survey and show coupon page.\n    if (finalStandardSurveyQuestion && currentQ?.id === finalStandardSurveyQuestion.id && currentQuestionAnswered && !showCouponPage && !responseId) {"),
    ("      .filter(q => questionOrder(q) >= 8 && questionOrder(q) <= 10)", "      .filter(q => questionOrder(q) >= GM_FIRST_NAME_ORDER && questionOrder(q) <= GM_EMAIL_ORDER)"),
    ("      .filter(q => questionOrder(q) >= 8 && questionOrder(q) <= 10)", "      .filter(q => questionOrder(q) >= GM_FIRST_NAME_ORDER && questionOrder(q) <= GM_EMAIL_ORDER)"),
    ("    // Get GM questions (display_order 8, 9, 10)\n    const gmQuestions = survey?.questions.filter(q => questionOrder(q) >= 8 && questionOrder(q) <= 10) || [];\n    const firstNameQuestion = findQuestionByOrder(gmQuestions, 8);\n    const lastNameQuestion = findQuestionByOrder(gmQuestions, 9);\n    const emailQuestion = findQuestionByOrder(gmQuestions, 10);",
     "    // Get GM contact questions after the GM-interest opt-in question.\n    const gmQuestions = survey?.questions.filter(q => questionOrder(q) >= GM_FIRST_NAME_ORDER && questionOrder(q) <= GM_EMAIL_ORDER) || [];\n    const firstNameQuestion = findQuestionByOrder(gmQuestions, GM_FIRST_NAME_ORDER);\n    const lastNameQuestion = findQuestionByOrder(gmQuestions, GM_LAST_NAME_ORDER);\n    const emailQuestion = findQuestionByOrder(gmQuestions, GM_EMAIL_ORDER);")
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected text not found:\n{old}')
    text = text.replace(old, new, 1)

path.write_text(text)
