'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Question, QuestionOption } from '@/lib/db';

interface SurveyData {
  id: number;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
}

type SurveyQuestion = Question & { options?: QuestionOption[] };

const QUESTION_KEYS = {
  convention: 'What convention are you attending?',
  adventure: 'What adventure did you play?',
} as const;

const STANDARD_SURVEY_END_ORDER = 7;
const GM_INTEREST_ORDER = 8;
const GM_FIRST_NAME_ORDER = 9;
const GM_LAST_NAME_ORDER = 10;
const GM_EMAIL_ORDER = 11;

function questionOrder(question: { display_order?: number | null }) {
  return Number(question.display_order ?? 0);
}

function findQuestionByText(questions: SurveyQuestion[] | undefined, text: string) {
  return questions?.find((question) => question.question_text === text);
}

function findConventionQuestion(questions: SurveyQuestion[] | undefined) {
  return findQuestionByText(questions, QUESTION_KEYS.convention);
}

function findAdventureQuestion(questions: SurveyQuestion[] | undefined) {
  return findQuestionByText(questions, QUESTION_KEYS.adventure);
}

function isGMChoiceQuestion(question: SurveyQuestion) {
  const text = question.question_text.toLowerCase();
  return (text.includes('gm') || text.includes('game master')) &&
    ['dropdown', 'single_choice', 'multiple_choice'].includes(question.question_type);
}

function findGMChoiceQuestion(questions: SurveyQuestion[] | undefined) {
  return questions?.find(isGMChoiceQuestion);
}

function findQuestionByOrder(questions: SurveyQuestion[] | undefined, displayOrder: number) {
  return questions?.find((question) => questionOrder(question) === displayOrder);
}

function getRatingMax(question: SurveyQuestion) {
  const maxRule = question.validation_rules?.max;
  const parsedMax = typeof maxRule === 'number' ? maxRule : Number(maxRule);

  if (Number.isInteger(parsedMax) && parsedMax > 0 && parsedMax <= 20) {
    return parsedMax;
  }

  const text = question.question_text.toLowerCase();
  return text.includes('1 to 10') || text.includes('1-10') || text.includes('scale of 1 to 10') ? 10 : 5;
}

const PARTICIPANT_STORAGE_KEY = 'game-satisfaction-survey-participant-id';
const COUPON_STORAGE_KEY = 'game-satisfaction-survey-issued-coupon';

type SavedCoupon = {
  couponCode: string;
  responseId?: number;
  responseToken?: string;
};

function createParticipantId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `participant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreateParticipantId() {
  if (typeof window === 'undefined') return null;

  try {
    const existingId = window.localStorage.getItem(PARTICIPANT_STORAGE_KEY);
    if (existingId) return existingId;

    const newId = createParticipantId();
    window.localStorage.setItem(PARTICIPANT_STORAGE_KEY, newId);
    return newId;
  } catch (error) {
    console.warn('Unable to persist survey participant identity:', error);
    return createParticipantId();
  }
}

function getSavedCoupon(): SavedCoupon | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawCoupon = window.localStorage.getItem(COUPON_STORAGE_KEY);
    if (!rawCoupon) return null;

    const parsed = JSON.parse(rawCoupon) as SavedCoupon;
    if (!parsed?.couponCode || typeof parsed.couponCode !== 'string') return null;

    return parsed;
  } catch (error) {
    console.warn('Unable to retrieve saved coupon code:', error);
    return null;
  }
}

export default function SurveyForm({ surveyId, preSelectedConvention }: { surveyId: number; preSelectedConvention?: string | null }) {
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [couponCode, setCouponCode] = useState<string>('');
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showCouponPage, setShowCouponPage] = useState(false);
  const [skipToGMQuestions, setSkipToGMQuestions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [responseId, setResponseId] = useState<number | null>(null);
  const [responseToken, setResponseToken] = useState<string | null>(null);
  const [couponDelivered, setCouponDelivered] = useState(false);
  const [conventionDisplayName, setConventionDisplayName] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const [selectedGMName, setSelectedGMName] = useState<string | null>(null);
  const [selectedGMOptionId, setSelectedGMOptionId] = useState<number | null>(null);
  const [filteredAdventures, setFilteredAdventures] = useState<any[]>([]);
  const [adventuresLoading, setAdventuresLoading] = useState(false);
  const [filteredGMs, setFilteredGMs] = useState<any[]>([]);
  const [selectedConventionOptionId, setSelectedConventionOptionId] = useState<number | null>(null);
  const previousConventionRef = useRef<string | null>(null);
  const preFilledConventionRef = useRef<string | null>(null);
  const lastFetchedAdventuresKeyRef = useRef<string | null>(null);
  const lastFetchedGMsKeyRef = useRef<string | null>(null);
  const ratingQuestionRenderCountRef = useRef(0);
  const loopFrozenRef = useRef(false);
  const pinnedRatingDisplayRef = useRef<{ question: { id: number; question_text?: string; question_type?: string; [key: string]: unknown }; index: number; listLength: number } | null>(null);
  const ratingQuestionListCacheRef = useRef<any[] | null>(null);


  // Generate a temporary coupon code for QR code display
  const tempCouponCode = useMemo(() => {
    if (couponCode) return couponCode;
    const prefix = 'GM';
    const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `${prefix}${randomNum}`;
  }, [couponCode]);
  const retrievableCouponCode = couponCode || (responseId ? tempCouponCode : '');

  const saveCouponForRetrieval = (code: string, id?: number | null, token?: string | null) => {
    if (typeof window === 'undefined' || !code) return;

    try {
      window.localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify({
        couponCode: code,
        responseId: id ?? undefined,
        responseToken: token ?? undefined,
      }));
    } catch (error) {
      console.warn('Unable to save coupon for retrieval:', error);
    }
  };

  const copyCouponCode = async (code = tempCouponCode) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  useEffect(() => {
    const savedCoupon = getSavedCoupon();
    if (!savedCoupon) return;

    setCouponCode(savedCoupon.couponCode);
    if (savedCoupon.responseId) setResponseId(savedCoupon.responseId);
    if (savedCoupon.responseToken) setResponseToken(savedCoupon.responseToken);
  }, []);

  // Auto-fill convention if pre-selected (run only when preSelectedConvention or survey changes to avoid re-run loops)
  useEffect(() => {
    if (!preSelectedConvention || !survey) return;
    const key = `${preSelectedConvention}|${survey.id}`;
    if (preFilledConventionRef.current === key) return;
    preFilledConventionRef.current = key;

    const conventionQuestion = findConventionQuestion(survey.questions);
    if (!conventionQuestion?.options) return;

    let matchingOption = conventionQuestion.options.find(
      opt => opt.option_value?.toLowerCase() === preSelectedConvention.toLowerCase()
    );
    if (!matchingOption) {
      matchingOption = conventionQuestion.options.find(
        opt => opt.option_text.toLowerCase() === preSelectedConvention.toLowerCase()
      );
    }
    if (!matchingOption) {
      matchingOption = conventionQuestion.options.find(
        opt => opt.option_value?.toLowerCase().includes(preSelectedConvention.toLowerCase()) ||
               preSelectedConvention.toLowerCase().includes(opt.option_value?.toLowerCase() || '')
      );
    }
    if (!matchingOption) {
      matchingOption = conventionQuestion.options.find(
        opt => opt.option_text.toLowerCase().includes(preSelectedConvention.toLowerCase()) ||
               preSelectedConvention.toLowerCase().includes(opt.option_text.toLowerCase())
      );
    }

    if (matchingOption) {
      setConventionDisplayName(matchingOption.option_text);
      setAnswers(prev => ({
        ...prev,
        [conventionQuestion.id]: matchingOption.option_value || matchingOption.option_text
      }));
    } else {
      const formattedName = preSelectedConvention
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      setConventionDisplayName(formattedName);
      setAnswers(prev => ({
        ...prev,
        [conventionQuestion.id]: preSelectedConvention
      }));
    }
  }, [preSelectedConvention, survey]);

  // Filter questions based on conditional logic
  const order = questionOrder;

  const visibleQuestions = useMemo(() => {
    if (!survey) return [];
    const questions = survey.questions ?? [];
    if (questions.length === 0) return [];

    const gmInterestQuestion = findQuestionByOrder(questions, GM_INTEREST_ORDER);
    const wantsToLearnGM = gmInterestQuestion && answers[gmInterestQuestion.id] === 'yes';
    const conventionQuestion = findConventionQuestion(questions);
    const adventureQuestion = findAdventureQuestion(questions);

    const filtered = questions.filter(q => {
      const o = order(q);
      if (skipToGMQuestions) {
        return o >= GM_FIRST_NAME_ORDER && o <= GM_EMAIL_ORDER;
      }
      if (preSelectedConvention && q.id === conventionQuestion?.id) {
        return false;
      }
      if (o <= GM_INTEREST_ORDER) return true;
      if (o >= GM_FIRST_NAME_ORDER && o <= GM_EMAIL_ORDER) {
        return wantsToLearnGM;
      }
      return false;
    });

    const gmQuestion = findGMChoiceQuestion(questions);

    let result = [...filtered];
    if (gmQuestion && adventureQuestion && filtered.some(q => q.id === adventureQuestion.id)) {
      const adventureIndex = result.findIndex(q => q.id === adventureQuestion.id);
      const gmIndex = result.findIndex(q => q.id === gmQuestion.id);
      if (gmIndex === -1 && adventureIndex !== -1) {
        result.splice(adventureIndex, 0, gmQuestion);
      }
    }
    if (result.length === 0 && questions.length > 0) {
      result = questions.filter(q => order(q) <= GM_INTEREST_ORDER);
      if (result.length === 0) result = [...questions];
    }
    return result;
  }, [survey, answers, skipToGMQuestions, preSelectedConvention]);

  // When filter returns empty but survey has questions, use survey.questions so we never loop on "loading questions"
  const effectiveVisibleQuestions =
    visibleQuestions.length > 0
      ? visibleQuestions
      : (survey?.questions?.length ? (survey.questions ?? []) : []);

  // Use cached list when on rating question so the list cannot alternate and cause effect loops
  const cachedList = ratingQuestionListCacheRef.current;
  const cIdx = cachedList?.length ? Math.min(currentQuestion, cachedList.length - 1) : -1;
  const cQ = cIdx >= 0 && cachedList ? cachedList[cIdx] : null;
  const cText = (cQ?.question_text ?? '').toLowerCase();
  const cachedIsRating = cQ && (cQ.question_type === 'rating' || (cText.includes('rate') && (cText.includes('gm') || cText.includes('1-5') || cText.includes('1 to 5'))));
  const useCachedList = !!(cachedList?.length && cachedIsRating);
  const displayQuestionList = useCachedList ? cachedList : effectiveVisibleQuestions;

  const safeCurrentIndex = Math.min(Math.max(0, currentQuestion), Math.max(0, (displayQuestionList?.length ?? 1) - 1));
  const currentQuestionObj = displayQuestionList?.[safeCurrentIndex];
  const qText = (currentQuestionObj?.question_text ?? '').toLowerCase();
  const isOnRatingQuestion =
    currentQuestionObj?.question_type === 'rating' ||
    (qText.includes('rate') && (qText.includes('gm') || qText.includes('1-5') || qText.includes('1 to 5')));
  const isGMApplicationStep =
    skipToGMQuestions ||
    (currentQuestionObj ? questionOrder(currentQuestionObj) >= GM_FIRST_NAME_ORDER && questionOrder(currentQuestionObj) <= GM_EMAIL_ORDER : false);

  if (isOnRatingQuestion) {
    ratingQuestionListCacheRef.current = displayQuestionList;
    ratingQuestionRenderCountRef.current += 1;
    if (ratingQuestionRenderCountRef.current > 12) loopFrozenRef.current = true;
    if (currentQuestionObj && (!pinnedRatingDisplayRef.current || pinnedRatingDisplayRef.current.question.id !== currentQuestionObj.id)) {
      pinnedRatingDisplayRef.current = { question: currentQuestionObj, index: safeCurrentIndex, listLength: displayQuestionList.length };
    }
  } else {
    ratingQuestionListCacheRef.current = null;
    ratingQuestionRenderCountRef.current = 0;
    loopFrozenRef.current = false;
    pinnedRatingDisplayRef.current = null;
  }

  // Adjust current question index only when visible questions LENGTH changes. Skip when on rating question or loop frozen to prevent loop.
  useEffect(() => {
    if (loopFrozenRef.current || isOnRatingQuestion) return;
    const len = visibleQuestions.length;
    if (len > 0) {
      setCurrentQuestion((prev) => (prev >= len ? len - 1 : prev));
    }
  }, [visibleQuestions.length, isOnRatingQuestion]);

  useEffect(() => {
    setLoadError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    fetch(`/api/survey/${surveyId}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) {
          return res.json().then((body: { error?: string }) => {
            throw new Error(body?.error || `Failed to load survey (${res.status})`);
          }).catch(() => {
            throw new Error(`Failed to load survey (${res.status})`);
          });
        }
        return res.json();
      })
      .then((data: SurveyData) => {
        if (!data || !Array.isArray(data.questions)) {
          setLoadError('Invalid survey data');
          setSurvey(null);
        } else {
          setSurvey(data);
        }
        setLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') {
          setLoadError('Request timed out. Please refresh the page.');
        } else {
          setLoadError(err?.message || 'Failed to load survey. Please refresh the page.');
        }
        setSurvey(null);
        setLoading(false);
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [surveyId]);

  // Fetch GMs when convention is selected. Skip when on rating question or loop frozen to prevent loop.
  useEffect(() => {
    if (loopFrozenRef.current || isOnRatingQuestion) return;
    const conventionQuestion = findConventionQuestion(survey?.questions);
    const selectedConvention = conventionQuestion && (answers[conventionQuestion.id] || preSelectedConvention);

    if (selectedConvention && conventionQuestion) {
      // Find the convention option to get its ID or value
      const conventionOption = conventionQuestion.options?.find((opt: any) => {
        const optValue = opt.option_value || opt.option_text;
        const selectedValue = selectedConvention;
        const optValueStr = optValue != null ? String(optValue).toLowerCase() : '';
        const optTextStr = opt.option_text != null ? String(opt.option_text).toLowerCase() : '';
        const selectedValueStr = selectedValue != null ? String(selectedValue).toLowerCase() : '';
        return optValueStr === selectedValueStr || optTextStr === selectedValueStr;
      });
      
      if (conventionOption) {
        setSelectedConventionOptionId(conventionOption.id);
        const gmFetchKey = `gms:${conventionOption.id}`;
        if (lastFetchedGMsKeyRef.current === gmFetchKey) {
          // Already fetched for this convention; skip to avoid re-render loop
        } else {
          lastFetchedGMsKeyRef.current = gmFetchKey;
          // Fetch GMs for this convention (API will return all GMs if no associations exist)
          fetch(`/api/survey/gms-by-convention?convention_option_id=${conventionOption.id}`)
            .then(res => {
              if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
              }
              return res.json();
            })
            .then(data => {
              if (data.gms && Array.isArray(data.gms)) {
                setFilteredGMs(data.gms);
              } else {
                // If no GMs in response, fall back to all GMs from question options
                const gmQuestion = findGMChoiceQuestion(survey?.questions);
                if (gmQuestion && gmQuestion.options) {
                  setFilteredGMs(gmQuestion.options.map((opt: any) => ({
                    id: opt.id,
                    option_text: opt.option_text,
                    option_value: opt.option_value
                  })));
                } else {
                  setFilteredGMs([]);
                }
              }
            })
            .catch(err => {
              console.error('Error fetching GMs by convention:', err);
              const gmQuestion = findGMChoiceQuestion(survey?.questions);
              if (gmQuestion && gmQuestion.options) {
                setFilteredGMs(gmQuestion.options.map((opt: any) => ({
                  id: opt.id,
                  option_text: opt.option_text,
                  option_value: opt.option_value
                })));
              } else {
                setFilteredGMs([]);
              }
            });
        }
      } else {
        // Try by value/name
        fetch(`/api/survey/gms-by-convention?convention_value=${encodeURIComponent(selectedConvention)}`)
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
          })
          .then(data => {
            if (data.gms && Array.isArray(data.gms)) {
              // API returns all GMs if convention has no associations, so always set it
              setFilteredGMs(data.gms);
            } else {
              // If no GMs in response, fall back to all GMs from question options
              const gmQuestion = findGMChoiceQuestion(survey?.questions);
              if (gmQuestion && gmQuestion.options) {
                setFilteredGMs(gmQuestion.options.map((opt: any) => ({
                  id: opt.id,
                  option_text: opt.option_text,
                  option_value: opt.option_value
                })));
              } else {
                setFilteredGMs([]);
              }
            }
          })
          .catch(err => {
            console.error('Error fetching GMs by convention:', err);
            // On error, fall back to all GMs from question options
            const gmQuestion = findGMChoiceQuestion(survey?.questions);
            if (gmQuestion && gmQuestion.options) {
              setFilteredGMs(gmQuestion.options.map((opt: any) => ({
                id: opt.id,
                option_text: opt.option_text,
                option_value: opt.option_value
              })));
            } else {
              setFilteredGMs([]);
            }
          });
      }
      
      // Clear GM and adventure selections when convention changes (only if convention actually changed)
      const currentConvention = answers[conventionQuestion.id] || preSelectedConvention;
      const norm = (s: string | null | undefined) => (s ?? '').toString().toLowerCase().trim();
      if (previousConventionRef.current !== null && norm(previousConventionRef.current) !== norm(currentConvention)) {
        lastFetchedAdventuresKeyRef.current = null;
        lastFetchedGMsKeyRef.current = null;
        setSelectedGMOptionId(null);
        setSelectedGMName(null);
        setFilteredAdventures([]);
        setAdventuresLoading(false);
        const gmQuestion = findGMChoiceQuestion(survey?.questions);
        const adventureQuestion = findAdventureQuestion(survey?.questions);
        if (gmQuestion) {
          setAnswers(prev => {
            const newAnswers = { ...prev };
            delete newAnswers[gmQuestion.id];
            return newAnswers;
          });
        }
        if (adventureQuestion) {
          setAnswers(prev => {
            const newAnswers = { ...prev };
            delete newAnswers[adventureQuestion.id];
            return newAnswers;
          });
        }
      }
      previousConventionRef.current = currentConvention;
    } else {
      setSelectedConventionOptionId(null);
      setFilteredGMs([]);
    }
  }, [answers, survey, preSelectedConvention, isOnRatingQuestion]);

  // Sync selectedGMOptionId with GM answer and fetch adventures. Skip when on rating question or loop frozen to prevent loop.
  useEffect(() => {
    if (loopFrozenRef.current || !survey || isOnRatingQuestion) return;
    const gmQuestion = findGMChoiceQuestion(survey.questions);
      
      if (gmQuestion && answers[gmQuestion.id]) {
        const gmAnswerValue = answers[gmQuestion.id];
        
        // Find the GM option to get its ID
        let matchedOption = filteredGMs.find((gm: any) => {
          const gmValue = gm.option_value || gm.option_text;
          return gmValue === gmAnswerValue || String(gmValue) === String(gmAnswerValue);
        });
        
        if (!matchedOption && gmQuestion.options) {
          matchedOption = gmQuestion.options.find((opt: any) => {
            const optValue = opt.option_value || opt.option_text;
            return optValue === gmAnswerValue || String(optValue) === String(gmAnswerValue);
          });
        }
        
        if (matchedOption && matchedOption.id !== selectedGMOptionId) {
          console.log('Syncing GM option ID from answer:', matchedOption);
          setSelectedGMOptionId(matchedOption.id);
          setSelectedGMName(matchedOption.option_text || matchedOption.option_value || gmAnswerValue);
        }
        
        // Fetch adventures if we have the option ID and convention
        const gmOptionIdToUse = matchedOption?.id || selectedGMOptionId;
        const conventionQuestion = findConventionQuestion(survey.questions);
        const selectedConvention = conventionQuestion && (answers[conventionQuestion.id] || preSelectedConvention);
        
        if (gmOptionIdToUse && selectedConvention && conventionQuestion) {
          // Find convention option ID
          const conventionOption = conventionQuestion.options?.find((opt: any) => {
            const optValue = opt.option_value || opt.option_text;
            const selectedValue = selectedConvention;
            const optValueStr = optValue != null ? String(optValue).toLowerCase() : '';
            const optTextStr = opt.option_text != null ? String(opt.option_text).toLowerCase() : '';
            const selectedValueStr = selectedValue != null ? String(selectedValue).toLowerCase() : '';
            return optValueStr === selectedValueStr || optTextStr === selectedValueStr;
          });
          
          if (conventionOption) {
            const fetchKey = `${gmOptionIdToUse}:${conventionOption.id}`;
            if (lastFetchedAdventuresKeyRef.current === fetchKey) {
              // Already fetched for this GM+convention; skip to avoid re-render loop
            } else {
              lastFetchedAdventuresKeyRef.current = fetchKey;
              setAdventuresLoading(true);
              fetch(`/api/survey/adventures-by-gm?gm_option_id=${gmOptionIdToUse}&convention_option_id=${conventionOption.id}`)
                .then(res => {
                  if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                  }
                  return res.json();
                })
                .then(data => {
                  if (data.adventures && Array.isArray(data.adventures)) {
                    setFilteredAdventures(data.adventures);
                  } else {
                    setFilteredAdventures([]);
                  }
                  setAdventuresLoading(false);
                })
                .catch(err => {
                  console.error('Error fetching adventures by GM and Convention:', err);
                  setFilteredAdventures([]);
                  setAdventuresLoading(false);
                });
            }
          } else {
            // Try by convention value
            console.log('Fetching adventures by GM option ID and convention value:', gmOptionIdToUse, selectedConvention);
            setAdventuresLoading(true);
            fetch(`/api/survey/adventures-by-gm?gm_option_id=${gmOptionIdToUse}&convention_value=${encodeURIComponent(selectedConvention)}`)
              .then(res => {
                if (!res.ok) {
                  throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
              })
              .then(data => {
                console.log('Adventures fetched:', data);
                if (data.adventures && Array.isArray(data.adventures)) {
                  setFilteredAdventures(data.adventures);
                } else {
                  setFilteredAdventures([]);
                }
                setAdventuresLoading(false);
              })
              .catch(err => {
                console.error('Error fetching adventures by GM and Convention:', err);
                setFilteredAdventures([]);
                setAdventuresLoading(false);
              });
          }
        } else if (!gmOptionIdToUse && !selectedGMOptionId && gmAnswerValue && selectedConvention) {
          // Try fetching by GM name/value and convention as fallback
          console.log('Fetching adventures by GM name/value and convention:', gmAnswerValue, selectedConvention);
          setAdventuresLoading(true);
          fetch(`/api/survey/adventures-by-gm?gm_name=${encodeURIComponent(gmAnswerValue)}&convention_value=${encodeURIComponent(selectedConvention)}`)
            .then(res => {
              if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
              }
              return res.json();
            })
            .then(data => {
              console.log('Adventures fetched by name:', data);
              if (data.adventures && Array.isArray(data.adventures)) {
                setFilteredAdventures(data.adventures);
              } else {
                setFilteredAdventures([]);
              }
              setAdventuresLoading(false);
            })
            .catch(err => {
              console.error('Error fetching adventures by GM name and Convention:', err);
              setFilteredAdventures([]);
              setAdventuresLoading(false);
            });
        }
      } else if (!answers[gmQuestion?.id || -1] && selectedGMOptionId) {
        // GM answer was cleared, clear adventures
        lastFetchedAdventuresKeyRef.current = null;
        setFilteredAdventures([]);
        setAdventuresLoading(false);
      }
  }, [survey, answers, selectedGMOptionId, filteredGMs, isOnRatingQuestion]);

  const handleAnswer = (questionId: number, value: any) => {
    setSubmissionError(null);

    // Handle GM selection - find GM question and check if this is it
    const gmQuestion = survey?.questions.find(q => 
      q.id === questionId &&
      (q.question_text.toLowerCase().includes('gm') || q.question_text.toLowerCase().includes('game master'))
    );

    if (gmQuestion) {
      console.log('GM selected, value:', value);
      console.log('filteredGMs:', filteredGMs);
      console.log('gmQuestion.options:', gmQuestion.options);
      
      // Find the selected GM option to get its ID
      // First check filteredGMs (if convention filtering is active)
      let selectedOption = filteredGMs.length > 0 
        ? filteredGMs.find((gm: any) => {
            const gmValue = gm.option_value || gm.option_text;
            return gmValue === value || String(gmValue) === String(value);
          })
        : null;
      
      // If not found in filteredGMs, check the original question options
      if (!selectedOption && gmQuestion.options) {
        selectedOption = gmQuestion.options.find((opt: any) => {
          const optValue = opt.option_value || opt.option_text;
          return optValue === value || String(optValue) === String(value);
        });
      }
      
      if (selectedOption) {
        console.log('Found GM option:', selectedOption);
        setSelectedGMOptionId(selectedOption.id);
        setSelectedGMName(selectedOption.option_text || selectedOption.option_value || value);
      } else {
        // Fallback: try to find by value match (case-insensitive)
        const valueStr = value != null ? String(value) : '';
        const fallbackOption = (filteredGMs.length > 0 ? filteredGMs : gmQuestion.options || []).find((gm: any) => {
          const gmValue = gm.option_value || gm.option_text;
          return gmValue != null && String(gmValue).toLowerCase() === valueStr.toLowerCase();
        });
        
        if (fallbackOption) {
          console.log('Found GM option via fallback:', fallbackOption);
          setSelectedGMOptionId(fallbackOption.id);
          setSelectedGMName(fallbackOption.option_text || fallbackOption.option_value || value);
        } else {
          console.warn('Could not find GM option for value:', value, 'Available options:', filteredGMs.length > 0 ? filteredGMs : gmQuestion.options);
          setSelectedGMOptionId(null);
          setSelectedGMName(value);
        }
      }
      
      // Clear the previous adventure answer while the selected GM's adventure list reloads.
      setAdventuresLoading(true);
      lastFetchedAdventuresKeyRef.current = null;
      setFilteredAdventures([]);

      const adventureQuestion = findAdventureQuestion(survey?.questions);
      setAnswers(prev => {
        const next = { ...prev, [questionId]: value };
        if (adventureQuestion) delete next[adventureQuestion.id];
        return next;
      });
      return;
    }
    
    // Normal answer handling for non-GM questions
    setAnswers(prev => {
      const newAnswers = {
        ...prev,
        [questionId]: value
      };
      
      // If they answer "no" to "Would you like to learn more about being a GM?"
      // Clear name and email answers
      if (questionId === findQuestionByOrder(survey?.questions, GM_INTEREST_ORDER)?.id && value === 'no') {
        const firstNameQuestion = findQuestionByOrder(survey?.questions, GM_FIRST_NAME_ORDER);
        const lastNameQuestion = findQuestionByOrder(survey?.questions, GM_LAST_NAME_ORDER);
        const emailQuestion = findQuestionByOrder(survey?.questions, GM_EMAIL_ORDER);
        if (firstNameQuestion) delete newAnswers[firstNameQuestion.id];
        if (lastNameQuestion) delete newAnswers[lastNameQuestion.id];
        if (emailQuestion) delete newAnswers[emailQuestion.id];
      }
      
      return newAnswers;
    });
  };

  const handleNext = async () => {
    // Check if we're on the final standard survey question before the GM-interest follow-up.
    // With the restored open-ended question, this is Q7; older databases without Q7 fall back to Q6.
    const currentQ = effectiveVisibleQuestions[currentQuestion];
    const finalStandardSurveyQuestion = effectiveVisibleQuestions
      .filter(q => questionOrder(q) <= STANDARD_SURVEY_END_ORDER)
      .sort((a, b) => questionOrder(a) - questionOrder(b))
      .at(-1);
    const currentAnswer = currentQ ? answers[currentQ.id] : undefined;
    const currentQuestionAnswered = !currentQ?.is_required || (currentAnswer !== undefined && currentAnswer !== null && (typeof currentAnswer !== 'string' || currentAnswer.trim() !== ''));
    
    // If we just answered the final standard survey question, submit survey and show coupon page.
    if (finalStandardSurveyQuestion && currentQ?.id === finalStandardSurveyQuestion.id && currentQuestionAnswered && !showCouponPage && !responseId) {
      // Submit survey with all answers up to this point
      const submittedSuccessfully = await submitSurveyUpToRecommendation();
      if (submittedSuccessfully) {
        setShowCouponPage(true);
      }
      return;
    }
    
    // Normal next behavior
    if (effectiveVisibleQuestions.length > 0 && currentQuestion < effectiveVisibleQuestions.length - 1) {
      setCurrentQuestion(prev => {
        const next = prev + 1;
        return Math.min(next, effectiveVisibleQuestions.length - 1);
      });
    }
  };

  const submitSurveyUpToRecommendation = async () => {
    if (isSubmittingRef.current) return false;
    if (responseId) return true;
    
    isSubmittingRef.current = true;
    setSubmissionError(null);
    
    // Get GM question IDs to exclude them from main survey answers
    const gmQuestionIds = survey?.questions
      .filter(q => questionOrder(q) >= GM_FIRST_NAME_ORDER && questionOrder(q) <= GM_EMAIL_ORDER)
      .map(q => q.id) || [];
    
    // Get convention question
    const conventionQuestion = findConventionQuestion(survey?.questions);
    
    // Get all answers up to and including the recommendation question (exclude GM questions)
    const answerArray = Object.entries(answers)
      .filter(([questionId]) => !gmQuestionIds.includes(parseInt(questionId)))
      .map(([questionId, value]) => {
        const question = survey?.questions.find(q => q.id === parseInt(questionId));
        
        if (Array.isArray(value)) {
          // Multiple choice - create multiple answer entries
          return value.map(v => ({
            question_id: parseInt(questionId),
            answer_value: v,
            answer_text: question?.options?.find(o => o.option_value === v)?.option_text || v
          }));
        }
        
        return {
          question_id: parseInt(questionId),
          answer_text: typeof value === 'string' ? value : null,
          answer_value: typeof value !== 'string' ? String(value) : null
        };
      }).flat();

    // If convention was pre-selected but not in answers, add it
    if (preSelectedConvention && conventionQuestion && !answerArray.some(a => a.question_id === conventionQuestion.id)) {
      answerArray.push({
        question_id: conventionQuestion.id,
        answer_text: preSelectedConvention,
        answer_value: null
      });
    }

    try {
      const participantId = getOrCreateParticipantId();
      const response = await fetch(`/api/survey/${surveyId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerArray, respondentInfo: { participantId } })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.responseId && data.responseToken) {
          setResponseId(data.responseId);
          setResponseToken(data.responseToken);
          setCouponCode(tempCouponCode);
          saveCouponForRetrieval(tempCouponCode, data.responseId, data.responseToken);
          // Record coupon delivery immediately
          await recordCouponDelivery(data.responseId, data.responseToken);
        }
        return true;
      }

      const errorData = await response.json().catch(() => ({}));
      if (response.status === 409) {
        setSubmissionError(errorData.error || 'You have already completed this survey for this convention, GM, and adventure.');
      } else {
        setSubmissionError('Error submitting survey. Please try again.');
      }
      console.error('Error submitting survey:', response.status, errorData);
      return false;
    } catch (error) {
      console.error('Error submitting survey:', error);
      setSubmissionError('Error submitting survey. Please try again.');
      return false;
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const recordCouponDelivery = async (responseIdParam?: number, responseTokenParam?: string) => {
    if (couponDelivered) return;
    
    const idToUse = responseIdParam || responseId;
    const tokenToUse = responseTokenParam || responseToken;
    if (!idToUse || !tokenToUse) return;
    
    try {
      const response = await fetch('/api/coupon/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseId: idToUse,
          responseToken: tokenToUse,
          couponCode: tempCouponCode
        })
      });
      
      if (response.ok) {
        setCouponDelivered(true);
        saveCouponForRetrieval(tempCouponCode, idToUse, tokenToUse);
        if (!responseId) {
          setResponseId(idToUse);
        }
      }
    } catch (error) {
      console.error('Error recording coupon delivery:', error);
    }
  };

  const handleVolunteerToBeGM = () => {
    setShowCouponPage(false);
    setSkipToGMQuestions(true);
    // Reset to first question in the filtered list (which will be Q8 - first name)
    setCurrentQuestion(0);
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => Math.max(0, prev - 1));
      return;
    }

    if (skipToGMQuestions) {
      setSkipToGMQuestions(false);
      setShowCouponPage(true);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    // If we already submitted after the recommendation question, just update with remaining answers
    if (responseId) {
      console.log('Updating response with GM interest data, responseId:', responseId);
      // Update existing response with any additional answers (GM questions)
      await updateResponseWithRemainingAnswers();
      setCouponCode(tempCouponCode);
      saveCouponForRetrieval(tempCouponCode, responseId, responseToken);
      setSubmitted(true);
      return;
    }
    
    // Prevent double submission
    if (isSubmittingRef.current) {
      return;
    }
    
    isSubmittingRef.current = true;
    setSubmissionError(null);
    
    // Get GM question IDs to exclude them from main survey answers
    const gmQuestionIds = survey?.questions
      .filter(q => questionOrder(q) >= GM_FIRST_NAME_ORDER && questionOrder(q) <= GM_EMAIL_ORDER)
      .map(q => q.id) || [];
    
    // Get convention question
    const conventionQuestion = findConventionQuestion(survey?.questions);
    
    // Exclude GM questions from main survey answers
    // Include convention answer if pre-selected, even if question was hidden
    const answerArray = Object.entries(answers)
      .filter(([questionId]) => !gmQuestionIds.includes(parseInt(questionId)))
      .map(([questionId, value]) => {
        const question = survey?.questions.find(q => q.id === parseInt(questionId));
        
        if (Array.isArray(value)) {
          // Multiple choice - create multiple answer entries
          return value.map(v => ({
            question_id: parseInt(questionId),
            answer_value: v,
            answer_text: question?.options?.find(o => o.option_value === v)?.option_text || v
          }));
        }
        
        return {
          question_id: parseInt(questionId),
          answer_text: typeof value === 'string' ? value : null,
          answer_value: typeof value !== 'string' ? String(value) : null
        };
      }).flat();

    // If convention was pre-selected but not in answers, add it
    if (preSelectedConvention && conventionQuestion && !answerArray.some(a => a.question_id === conventionQuestion.id)) {
      answerArray.push({
        question_id: conventionQuestion.id,
        answer_text: preSelectedConvention,
        answer_value: null
      });
    }

    try {
      const participantId = getOrCreateParticipantId();
      const response = await fetch(`/api/survey/${surveyId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerArray, respondentInfo: { participantId } })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.responseId && data.responseToken) {
          setResponseId(data.responseId);
          setResponseToken(data.responseToken);
          setCouponCode(tempCouponCode);
          saveCouponForRetrieval(tempCouponCode, data.responseId, data.responseToken);
          // Record coupon delivery after submission
          await recordCouponDelivery(data.responseId, data.responseToken);
        }
        // Use the same coupon code that was shown in the QR code
        setCouponCode(tempCouponCode);
        saveCouponForRetrieval(tempCouponCode, data.responseId, data.responseToken);
        setSubmitted(true);
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 409) {
          setSubmissionError(errorData.error || 'You have already completed this survey for this convention, GM, and adventure.');
        } else {
          setSubmissionError('Error submitting survey. Please try again.');
        }
        isSubmittingRef.current = false;
      }
    } catch (error) {
      console.error('Error submitting survey:', error);
      setSubmissionError('Error submitting survey. Please try again.');
      isSubmittingRef.current = false;
    }
  };

  const updateResponseWithRemainingAnswers = async () => {
    if (!responseId || !responseToken) {
      console.error('No response ownership token available for GM interest submission');
      return { success: false, error: 'No response ownership token' };
    }
    
    // Get GM contact questions after the GM-interest opt-in question.
    const gmQuestions = survey?.questions.filter(q => questionOrder(q) >= GM_FIRST_NAME_ORDER && questionOrder(q) <= GM_EMAIL_ORDER) || [];
    const firstNameQuestion = findQuestionByOrder(gmQuestions, GM_FIRST_NAME_ORDER);
    const lastNameQuestion = findQuestionByOrder(gmQuestions, GM_LAST_NAME_ORDER);
    const emailQuestion = findQuestionByOrder(gmQuestions, GM_EMAIL_ORDER);
    
    console.log('GM questions found:', {
      firstNameQuestion: firstNameQuestion?.id,
      lastNameQuestion: lastNameQuestion?.id,
      emailQuestion: emailQuestion?.id,
      allAnswers: answers
    });
    
    const firstName = firstNameQuestion ? answers[firstNameQuestion.id] : null;
    const lastName = lastNameQuestion ? answers[lastNameQuestion.id] : null;
    const email = emailQuestion ? answers[emailQuestion.id] : null;
    
    console.log('Submitting GM interest:', { responseId, firstName, lastName, email });
    
    // Submit to GM Interest table instead of regular answers table
    if (firstName || lastName || email) {
      try {
        const response = await fetch('/api/gm-interest/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            responseId: responseId,
            responseToken: responseToken,
            firstName: typeof firstName === 'string' ? firstName : null,
            lastName: typeof lastName === 'string' ? lastName : null,
            email: typeof email === 'string' ? email : null
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('GM interest submitted successfully:', data);
          return { success: true, data };
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Error submitting GM interest:', response.status, errorData);
          return { success: false, error: errorData };
        }
      } catch (error) {
        console.error('Error submitting GM interest:', error);
        return { success: false, error };
      }
    } else {
      console.log('No GM interest data to submit - all fields are empty');
      return { success: false, error: 'No data to submit' };
    }
  };

  // Adjust current question index when skipToGMQuestions changes. Skip when on rating question to prevent loop.
  useEffect(() => {
    if (loopFrozenRef.current || isOnRatingQuestion) return;
    if (skipToGMQuestions && visibleQuestions.length > 0) {
      setCurrentQuestion(0);
    }
  }, [skipToGMQuestions, visibleQuestions.length, isOnRatingQuestion]);

  if (loading) {
    return (
      <div className="container">
        <div>Loading survey...</div>
      </div>
    );
  }

  if (loadError || !survey) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>{loadError || 'Survey not found'}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="container">
        <div className="success-message">
          <h2>Thank You!</h2>
          <p style={{ fontSize: '1.2rem', marginTop: '1rem' }}>We'll be reaching out soon!</p>
          {retrievableCouponCode && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#fff8f7', border: '2px solid #ed1c24', borderRadius: '10px' }}>
              <p style={{ margin: '0 0 0.5rem 0', color: '#333', fontWeight: 600 }}>Need your coupon code again?</p>
              <p style={{ margin: '0 0 0.75rem 0', fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 700, color: '#ed1c24', letterSpacing: '1px' }}>{retrievableCouponCode}</p>
              <button type="button" onClick={() => copyCouponCode(retrievableCouponCode)} className="submit-button" style={{ maxWidth: '220px', margin: '0 auto' }}>
                {copied ? 'Copied!' : 'Copy Coupon Code'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (effectiveVisibleQuestions.length === 0) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>No questions available for this survey.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }

  // When on rating question, use pinned display so the UI cannot flicker even if state keeps changing
  const usePinnedRating = isOnRatingQuestion && pinnedRatingDisplayRef.current;
  const safeCurrentQuestion = usePinnedRating
    ? pinnedRatingDisplayRef.current!.index
    : Math.min(Math.max(0, currentQuestion), Math.max(0, effectiveVisibleQuestions.length - 1));
  const question = usePinnedRating
    ? pinnedRatingDisplayRef.current!.question
    : (displayQuestionList[safeCurrentQuestion] ?? displayQuestionList[0]);
  const displayListLength = usePinnedRating ? pinnedRatingDisplayRef.current!.listLength : displayQuestionList.length;

  if (!question) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Unable to load this question.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }
  
  const progress = ((safeCurrentQuestion + 1) / displayListLength) * 100;
  const isLastQuestion = safeCurrentQuestion === displayListLength - 1;
  
  // Improved validation: check if answer exists and is not empty
  // For rating questions, numbers (including 0) are valid, so we check for undefined/null/empty string
  const answerValue = answers[question.id];
  
  // More lenient validation - check if answer exists in any form
  let hasAnswer = false;
  if (answerValue !== undefined && answerValue !== null) {
    if (typeof answerValue === 'number') {
      // Numbers are always valid (including 0 for edge cases)
      hasAnswer = true;
    } else if (typeof answerValue === 'string') {
      // Strings must not be empty or just whitespace
      hasAnswer = answerValue.trim() !== '';
    } else if (Array.isArray(answerValue)) {
      // Arrays must have at least one element
      hasAnswer = answerValue.length > 0;
    } else {
      // For other types (boolean, object), consider them valid if they exist
      hasAnswer = true;
    }
  }
  
  const canProceed = !question.is_required || hasAnswer;
  
  // Debug logging for validation - always log for last question
  if (isLastQuestion) {
    console.log('Validation check (last question):', {
      questionId: question.id,
      questionText: question.question_text,
      questionType: question.question_type,
      answerValue,
      answerType: typeof answerValue,
      hasAnswer,
      canProceed,
      isRequired: question.is_required,
      allAnswers: answers
    });
  }
  
  // Show coupon page instead of question if needed
  if (showCouponPage) {
    return (
      <div style={{ 
        background: 'linear-gradient(135deg, #ed1c24 0%, #9f1016 100%)',
        minHeight: '100vh',
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ 
          padding: '1rem', 
          background: 'white',
          borderRadius: '12px', 
          border: '2px solid #ed1c24',
          textAlign: 'center',
          maxWidth: '600px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{
            padding: '1rem', 
            background: '#fff8f7', 
            borderRadius: '12px', 
            border: '2px solid #ed1c24',
            textAlign: 'center'
          }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '0.75rem', color: '#333' }}>
            Thank You!
          </h2>
          <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#666' }}>
            Your $5 coupon code:
          </p>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{ width: '100%' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '0.75rem',
                marginBottom: '0.5rem',
                flexWrap: 'wrap'
              }}>
                <p style={{ 
                  fontSize: '1.3rem', 
                  fontFamily: 'monospace', 
                  fontWeight: 700, 
                  color: '#ed1c24', 
                  letterSpacing: '2px',
                  margin: 0,
                  wordBreak: 'break-all'
                }}>
                  {tempCouponCode}
                </p>
                <button
                  onClick={() => copyCouponCode(tempCouponCode)}
                  style={{
                    padding: '0.6rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: copied ? '#27ae60' : '#ed1c24',
                    background: copied ? '#d4edda' : 'white',
                    border: `2px solid ${copied ? '#27ae60' : '#ed1c24'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    minHeight: '40px',
                    touchAction: 'manipulation'
                  }}
                >
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#666', lineHeight: '1.4', padding: '0 0.5rem', margin: 0 }}>
                Use code above at evilgeniusgames.com
              </p>
            </div>
          </div>
          {!emailSent ? (
            <div style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              background: '#f8f9fa', 
              borderRadius: '8px',
              border: '1px solid #e0e0e0'
            }}>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: '#333', fontWeight: 500 }}>
                Email this code to me:
              </p>
              <div style={{ 
                display: 'flex', 
                gap: '0.5rem', 
                flexWrap: 'wrap',
                justifyContent: 'center'
              }}>
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  style={{
                    flex: '1',
                    minWidth: '200px',
                    padding: '0.75rem',
                    fontSize: '0.9rem',
                    border: '2px solid #e0e0e0',
                    borderRadius: '6px',
                    fontFamily: 'inherit'
                  }}
                />
                <button
                  onClick={async () => {
                    if (!emailAddress || !emailAddress.includes('@')) {
                      alert('Please enter a valid email address');
                      return;
                    }
                    setSendingEmail(true);
                    try {
                      const response = await fetch('/api/send-coupon-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          email: emailAddress, 
                          couponCode: tempCouponCode,
                          responseId,
                          responseToken
                        })
                      });
                      if (response.ok) {
                        setEmailSent(true);
                        // Update coupon delivery record with email if we have response ownership data
                        if (responseId && responseToken) {
                          await fetch('/api/coupon/deliver', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              responseId: responseId,
                              responseToken: responseToken,
                              couponCode: tempCouponCode,
                              emailAddress: emailAddress
                            })
                          });
                        }
                      } else {
                        alert('Failed to send email. Please try again.');
                      }
                    } catch (error) {
                      console.error('Error sending email:', error);
                      alert('Failed to send email. Please try again.');
                    } finally {
                      setSendingEmail(false);
                    }
                  }}
                  disabled={sendingEmail || !emailAddress}
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: 'white',
                    background: sendingEmail ? '#ccc' : 'linear-gradient(135deg, #ed1c24 0%, #9f1016 100%)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: sendingEmail ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    minHeight: '44px',
                    touchAction: 'manipulation'
                  }}
                >
                  {sendingEmail ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.75rem', 
              background: '#d4edda', 
              borderRadius: '8px',
              border: '1px solid #27ae60',
              color: '#27ae60',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              ✓ Email sent to {emailAddress}!
            </div>
          )}
          <div style={{
            marginTop: '2rem',
            marginBottom: '1rem',
            borderTop: '2px solid #e0e0e0',
            width: '100%'
          }}></div>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleVolunteerToBeGM();
            }}
            style={{
              display: 'inline-block',
              padding: '0.875rem 1.25rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'white',
              background: 'linear-gradient(135deg, #ed1c24 0%, #9f1016 100%)',
              borderRadius: '8px',
              textDecoration: 'none',
              transition: 'transform 0.2s, box-shadow 0.2s',
              marginTop: '0.75rem',
              marginBottom: '1rem',
              minHeight: '44px',
              touchAction: 'manipulation'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 10px 20px rgba(237, 28, 36, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Volunteer to be a GM
          </a>
          <div style={{ 
            marginTop: '1rem', 
            textAlign: 'center', 
            maxWidth: '400px', 
            margin: '1rem auto 0',
            padding: '0.75rem'
          }}>
            <h3 style={{ 
              fontSize: '1rem', 
              fontWeight: 600, 
              marginBottom: '0.75rem', 
              color: '#333',
              textAlign: 'center',
              textDecoration: 'underline'
            }}>
              Get These Great Benefits
            </h3>
            <ul style={{ 
              listStyle: 'none', 
              padding: 0, 
              margin: 0,
              fontSize: '0.9rem',
              color: '#333',
              lineHeight: '1.6',
              display: 'inline-block',
              textAlign: 'center'
            }}>
              <li style={{ marginBottom: '0.5rem' }}>
                • Obtain Exclusive Rewards
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                • Earn Free Merchandise
              </li>
              <li style={{ padding: '0 0.5rem' }}>
                • Free Access to the Sidekick App
              </li>
            </ul>
          </div>
          </div>
        </div>
      </div>
    );
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only submit if we're actually on the last question
    const isActuallyLast = safeCurrentQuestion === displayListLength - 1;

    console.log('Form submit attempt:', {
      safeCurrentQuestion,
      visibleQuestionsLength: displayListLength,
      isActuallyLast,
      isSubmitting: isSubmittingRef.current,
      questionText: question?.question_text
    });
    
    // Additional check: make sure we're not in the middle of updating visible questions
    if (isActuallyLast && !isSubmittingRef.current) {
      handleSubmit(e);
    } else {
      console.log('Form submit prevented');
    }
  };

  return (
    <div className="container">
      <header className="brand-lockup" aria-label="Evil Genius Games survey">
        <div className="brand-logo-frame">
          <img
            src="/brand/evil-genius-games-logo.webp"
            alt="Evil Genius Games"
            className="brand-logo"
            width={170}
            height={52}
            loading="eager"
            decoding="async"
          />
        </div>
        <p className="brand-kicker">Mission Debrief</p>
        <h1 className="brand-title">Unlock your <span>$5 reward</span></h1>
      </header>
      {conventionDisplayName && (
        <div className="convention-badge">
          <strong>Convention:</strong> {conventionDisplayName}
        </div>
      )}
      <p className="brand-subtitle">
        File your after-action report from the table. It takes about five minutes, unlocks your reward, and helps Evil Genius Games make the next cinematic adventure even more legendary.
      </p>
      <form onSubmit={handleFormSubmit}>
        <div className="survey-header">
          <h2>{isGMApplicationStep ? 'GM Application' : survey.title}</h2>
          {survey.description && !isGMApplicationStep && <p>{survey.description}</p>}
          {isGMApplicationStep && (
            <p>
              Great GMs are the heroes who make every table unforgettable. The Evil Genius GM program gives you a chance to run cinematic adventures, meet an enthusiastic community of players, preview exciting game experiences, and help more fans discover their next favorite story. Your coupon stays available while you apply, and you can go back to it at any time.
            </p>
          )}
        </div>

      {retrievableCouponCode && (
        <div style={{
          maxWidth: '600px',
          margin: '0 auto 1rem auto',
          padding: '0.85rem 1rem',
          border: '2px solid #ed1c24',
          borderRadius: '10px',
          background: '#fff8f7',
          color: '#333',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap'
        }}>
          <span><strong>Your coupon code:</strong> <span style={{ fontFamily: 'monospace', color: '#ed1c24', fontWeight: 700, letterSpacing: '1px' }}>{retrievableCouponCode}</span></span>
          <button type="button" onClick={() => copyCouponCode(retrievableCouponCode)} style={{
            padding: '0.5rem 0.85rem',
            border: '2px solid #ed1c24',
            borderRadius: '6px',
            background: copied ? '#d4edda' : 'white',
            color: copied ? '#27ae60' : '#ed1c24',
            fontWeight: 700,
            cursor: 'pointer'
          }}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="question-container">
        <label className="question-label">
          {question.question_text}
          {question.is_required && <span className="required"> *</span>}
        </label>

        {question.question_type === 'short_text' && (
          <input
            type="text"
            className="question-input"
            placeholder={question.placeholder_text || ''}
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswer(question.id, e.target.value)}
            onKeyDown={(e) => {
              // Prevent Enter key from submitting form unless we're on last question
              if (e.key === 'Enter' && !isLastQuestion) {
                e.preventDefault();
                if (canProceed) {
                  handleNext();
                }
              }
            }}
            required={question.is_required}
          />
        )}

        {question.question_type === 'email' && (
          <input
            type="email"
            className="question-input"
            placeholder={question.placeholder_text || 'your.email@example.com'}
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswer(question.id, e.target.value)}
            onKeyDown={(e) => {
              // Prevent Enter key from submitting form unless we're on last question
              if (e.key === 'Enter' && !isLastQuestion) {
                e.preventDefault();
                if (canProceed) {
                  handleNext();
                }
              }
            }}
            required={question.is_required}
          />
        )}

        {question.question_type === 'long_text' && (
          <textarea
            className="question-input question-textarea"
            placeholder={question.placeholder_text || ''}
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswer(question.id, e.target.value)}
            required={question.is_required}
          />
        )}

        {question.question_type === 'rating' && (
          <div className="rating-container">
            {(() => {
              const maxRating = getRatingMax(question);
              const ratings = Array.from({ length: maxRating }, (_, i) => i + 1);
              
              return ratings.map((rating) => (
                <button
                  key={rating}
                  type="button"
                  className={`rating-button ${answers[question.id] === rating ? 'selected' : ''}`}
                  onClick={() => handleAnswer(question.id, rating)}
                  style={maxRating > 5 ? { width: '40px', height: '40px', fontSize: '1rem' } : {}}
                >
                  {rating}
                </button>
              ));
            })()}
          </div>
        )}

        {question.question_type === 'multiple_choice' && question.options && (
          <div className="question-options">
            {[...question.options].sort((a, b) => (a.option_text || a.option_value || '').localeCompare(b.option_text || b.option_value || '', undefined, { sensitivity: 'base' })).map((option: QuestionOption) => (
              <label key={option.id} className="option-item">
                <input
                  type="checkbox"
                  value={option.option_value || option.option_text}
                  checked={Array.isArray(answers[question.id]) && answers[question.id].includes(option.option_value || option.option_text)}
                  onChange={(e) => {
                    const current = Array.isArray(answers[question.id]) ? answers[question.id] : [];
                    if (e.target.checked) {
                      handleAnswer(question.id, [...current, option.option_value || option.option_text]);
                    } else {
                      handleAnswer(question.id, current.filter((v: any) => v !== (option.option_value || option.option_text)));
                    }
                  }}
                />
                {option.option_text}
              </label>
            ))}
          </div>
        )}

        {question.question_type === 'single_choice' && question.options && (
          <div className="question-options">
            {[...question.options].sort((a, b) => (a.option_text || a.option_value || '').localeCompare(b.option_text || b.option_value || '', undefined, { sensitivity: 'base' })).map((option: QuestionOption) => (
              <label key={option.id} className="option-item">
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option.option_value || option.option_text}
                  checked={answers[question.id] === (option.option_value || option.option_text)}
                  onChange={(e) => handleAnswer(question.id, e.target.value)}
                  required={question.is_required}
                />
                {option.option_text}
              </label>
            ))}
          </div>
        )}

        {question.question_type === 'dropdown' && question.options && (
          <select
            className="question-input"
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswer(question.id, e.target.value)}
            required={question.is_required}
            style={{ padding: '1rem', fontSize: '1rem' }}
          >
            <option value="">Select an option...</option>
            {(() => {
              // Filter adventures by GM - ONLY show adventures if GM is selected
              if (question.id === findAdventureQuestion(survey?.questions)?.id) {
                // Check if GM was answered (even if selectedGMOptionId isn't set yet)
                const gmQuestion = findGMChoiceQuestion(survey?.questions);
                const gmAnswered = gmQuestion && answers[gmQuestion.id];
                const hasGMOptionId = selectedGMOptionId != null;
                
                if (hasGMOptionId || gmAnswered) {
                  if (adventuresLoading && filteredAdventures.length === 0) {
                    return (
                      <option value="" disabled>
                        Loading adventures...
                      </option>
                    );
                  }

                  const adventuresToShow = filteredAdventures.length > 0 ? filteredAdventures : question.options || [];

                  if (adventuresToShow.length > 0) {
                    // Show GM-associated adventures when available; otherwise fall back to every adventure option.
                    return [...adventuresToShow].sort((a: any, b: any) => (a.option_text || a.option_value || '').localeCompare(b.option_text || b.option_value || '', undefined, { sensitivity: 'base' })).map((adventure: any) => (
                      <option key={adventure.id} value={adventure.option_value || adventure.option_text}>
                        {adventure.option_text}
                      </option>
                    ));
                  }

                  return (
                    <option value="" disabled>
                      No adventure options are configured
                    </option>
                  );
                } else {
                  // No GM selected - don't show any adventures
                  return (
                    <option value="" disabled>
                      Please select a GM first
                    </option>
                  );
                }
              }
              
              // Filter GMs by convention
              const isGMQuestion = isGMChoiceQuestion(question);
              if (isGMQuestion) {
                // If convention filtering is active, use filteredGMs, otherwise use all GM options
                const gmsToShow = filteredGMs.length > 0 ? filteredGMs : question.options || [];
                return [...gmsToShow].sort((a: any, b: any) => (a.option_text || a.option_value || '').localeCompare(b.option_text || b.option_value || '', undefined, { sensitivity: 'base' })).map((gm: any) => {
                  const gmValue = gm.option_value || gm.option_text;
                  const gmId = gm.id;
                  return (
                    <option key={gmId} value={gmValue}>
                      {gm.option_text}
                    </option>
                  );
                });
              }
              
              // Default: show all options
              return [...question.options].sort((a, b) => (a.option_text || a.option_value || '').localeCompare(b.option_text || b.option_value || '', undefined, { sensitivity: 'base' })).map((option: QuestionOption) => (
                <option key={option.id} value={option.option_value || option.option_text}>
                  {option.option_text}
                </option>
              ));
            })()}
          </select>
        )}

        {question.question_type === 'yes_no' && (
          <div className="question-options">
            <label className="option-item">
              <input
                type="radio"
                name={`question-${question.id}`}
                value="yes"
                checked={answers[question.id] === 'yes'}
                onChange={(e) => handleAnswer(question.id, e.target.value)}
                required={question.is_required}
              />
              Yes
            </label>
            <label className="option-item">
              <input
                type="radio"
                name={`question-${question.id}`}
                value="no"
                checked={answers[question.id] === 'no'}
                onChange={(e) => handleAnswer(question.id, e.target.value)}
                required={question.is_required}
              />
              No
            </label>
          </div>
        )}
      </div>

      {submissionError && (
        <div
          role="alert"
          style={{
            maxWidth: '600px',
            margin: '0 auto 1rem auto',
            padding: '0.85rem 1rem',
            border: '1px solid #d33',
            borderRadius: '8px',
            background: '#fff5f5',
            color: '#9b1c1c',
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          {submissionError}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
        {(safeCurrentQuestion > 0 || skipToGMQuestions) && (
          <button type="button" onClick={handlePrevious} className="submit-button" style={{ flex: 1 }}>
            Back
          </button>
        )}
        {!isLastQuestion ? (
          <button
            type="button"
            onClick={handleNext}
            className="submit-button"
            disabled={!canProceed}
            style={{ flex: safeCurrentQuestion === 0 ? 1 : 1, marginLeft: safeCurrentQuestion === 0 ? 0 : 0 }}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Submit button clicked', { 
                safeCurrentQuestion, 
                visibleQuestionsLength: effectiveVisibleQuestions.length,
                questionId: question.id,
                questionText: question.question_text,
                answerValue: answers[question.id],
                canProceed,
                isRequired: question.is_required,
                isSubmitting: isSubmittingRef.current
              });
              if (safeCurrentQuestion === displayListLength - 1 && !isSubmittingRef.current && canProceed) {
                handleSubmit(e as any);
              } else if (!canProceed) {
                console.warn('Cannot submit: question not answered', {
                  questionId: question.id,
                  questionText: question.question_text,
                  answerValue: answers[question.id],
                  isRequired: question.is_required,
                  hasAnswer: answerValue !== undefined && answerValue !== null && answerValue !== ''
                });
              }
            }}
            className="submit-button"
            disabled={!canProceed || isSubmittingRef.current}
            style={{ 
              flex: 1, 
              marginLeft: safeCurrentQuestion === 0 ? 0 : 0,
              opacity: (!canProceed || isSubmittingRef.current) ? 0.5 : 1,
              cursor: (!canProceed || isSubmittingRef.current) ? 'not-allowed' : 'pointer'
            }}
            title={!canProceed ? `Please answer this question${question.is_required ? ' (required)' : ''}. Answer: ${JSON.stringify(answers[question.id])}, Type: ${typeof answers[question.id]}` : 'Submit survey'}
          >
            {isSubmittingRef.current ? 'Submitting...' : (skipToGMQuestions ? 'Submit Application' : 'Submit')}
          </button>
        )}
      </div>
      </form>
    </div>
  );
}

