'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Question, QuestionOption } from '@/lib/db';

interface SurveyData {
  id: number;
  title: string;
  description: string | null;
  questions: (Question & { options?: QuestionOption[] })[];
}

export default function SurveyForm({ surveyId, preSelectedConvention }: { surveyId: number; preSelectedConvention?: string | null }) {
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [couponDelivered, setCouponDelivered] = useState(false);
  const [conventionDisplayName, setConventionDisplayName] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const [selectedGMName, setSelectedGMName] = useState<string | null>(null);
  const [selectedGMOptionId, setSelectedGMOptionId] = useState<number | null>(null);
  const [filteredAdventures, setFilteredAdventures] = useState<any[]>([]);
  const [filteredGMs, setFilteredGMs] = useState<any[]>([]);
  const [selectedConventionOptionId, setSelectedConventionOptionId] = useState<number | null>(null);
  const previousConventionRef = useRef<string | null>(null);
  
  // Generate a temporary coupon code for QR code display
  const tempCouponCode = useMemo(() => {
    if (couponCode) return couponCode;
    const prefix = 'GM';
    const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `${prefix}${randomNum}`;
  }, [couponCode]);

  // Auto-fill convention if pre-selected and find display name
  useEffect(() => {
    if (preSelectedConvention && survey) {
      const conventionQuestion = survey.questions.find(q => q.question_text === 'What convention are you attending?');
      if (conventionQuestion && conventionQuestion.options) {
        // First try to match by option_value (the stored value, e.g., "gen_con")
        let matchingOption = conventionQuestion.options.find(
          opt => opt.option_value?.toLowerCase() === preSelectedConvention.toLowerCase()
        );
        
        // If not found, try matching by option_text (display name, e.g., "Gen Con")
        if (!matchingOption) {
          matchingOption = conventionQuestion.options.find(
            opt => opt.option_text.toLowerCase() === preSelectedConvention.toLowerCase()
          );
        }
        
        // If still not found, try partial match on option_value
        if (!matchingOption) {
          matchingOption = conventionQuestion.options.find(
            opt => opt.option_value?.toLowerCase().includes(preSelectedConvention.toLowerCase()) ||
                   preSelectedConvention.toLowerCase().includes(opt.option_value?.toLowerCase() || '')
          );
        }
        
        // If still not found, try partial match on option_text
        if (!matchingOption) {
          matchingOption = conventionQuestion.options.find(
            opt => opt.option_text.toLowerCase().includes(preSelectedConvention.toLowerCase()) ||
                   preSelectedConvention.toLowerCase().includes(opt.option_text.toLowerCase())
          );
        }
        
        if (matchingOption) {
          // Always use option_text (display name) for display, e.g., "Gen Con"
          setConventionDisplayName(matchingOption.option_text);
          
          if (!answers[conventionQuestion.id]) {
            // Store the option_value for database consistency
            setAnswers(prev => ({
              ...prev,
              [conventionQuestion.id]: matchingOption.option_value || matchingOption.option_text
            }));
          }
        } else {
          // Fallback: try to format the convention name nicely
          // Convert "gen_con" to "Gen Con"
          const formattedName = preSelectedConvention
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          setConventionDisplayName(formattedName);
          
          if (!answers[conventionQuestion.id]) {
            setAnswers(prev => ({
              ...prev,
              [conventionQuestion.id]: preSelectedConvention
            }));
          }
        }
      }
    }
  }, [preSelectedConvention, survey, answers]);

  // Filter questions based on conditional logic
  const visibleQuestions = useMemo(() => {
    if (!survey) return [];
    
    const questions = survey.questions;
    const gmInterestQuestion = questions.find(q => q.display_order === 7);
    const wantsToLearnGM = gmInterestQuestion && answers[gmInterestQuestion.id] === 'yes';
    const conventionQuestion = questions.find(q => q.question_text === 'What convention are you attending?');
    const adventureQuestion = questions.find(q => q.question_text === 'What adventure did you play?');
    
    const filtered = questions.filter(q => {
      // If skipping to GM questions, only show those
      if (skipToGMQuestions) {
        return q.display_order >= 8 && q.display_order <= 10;
      }
      
      // Hide convention question if pre-selected
      if (preSelectedConvention && q.id === conventionQuestion?.id) {
        return false;
      }
      
      // Always show questions 1-7 (now includes the recommendation question)
      if (q.display_order <= 7) return true;
      
      // Only show name/email (questions 8-10) if they answered "yes" to Q7 (GM interest)
      if (q.display_order >= 8 && q.display_order <= 10) {
        return wantsToLearnGM;
      }
      
      return false;
    });

    // Insert GM selection before adventure question if GMs exist and adventure question is visible
    // Find GM question (question with "GM" or "Game Master" in text)
    const gmQuestion = questions.find(q => 
      (q.question_text.toLowerCase().includes('gm') || q.question_text.toLowerCase().includes('game master')) &&
      ['dropdown', 'single_choice', 'multiple_choice'].includes(q.question_type)
    );

    const result = [...filtered];
    // Insert GM question before adventure question if both exist
    if (gmQuestion && adventureQuestion && filtered.some(q => q.id === adventureQuestion.id)) {
      const adventureIndex = result.findIndex(q => q.id === adventureQuestion.id);
      const gmIndex = result.findIndex(q => q.id === gmQuestion.id);
      
      // If GM question is not already in filtered, insert it before adventure
      if (gmIndex === -1 && adventureIndex !== -1) {
        result.splice(adventureIndex, 0, gmQuestion);
      }
    }
    
    return result;
  }, [survey, answers, skipToGMQuestions, preSelectedConvention]);

  // Adjust current question index if visible questions change
  // But DON'T change it if we're still within valid bounds
  useEffect(() => {
    if (visibleQuestions.length > 0 && currentQuestion >= visibleQuestions.length) {
      // Only adjust if we're truly out of bounds
      setCurrentQuestion(visibleQuestions.length - 1);
    }
  }, [visibleQuestions.length]);

  useEffect(() => {
    fetch(`/api/survey/${surveyId}`)
      .then(res => res.json())
      .then(data => {
        setSurvey(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching survey:', err);
        setLoading(false);
      });

  }, [surveyId]);

  // Fetch GMs when convention is selected (either from answers or preSelectedConvention)
  useEffect(() => {
    const conventionQuestion = survey?.questions.find(q => q.question_text === 'What convention are you attending?');
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
              // API returns all GMs if convention has no associations, so always set it
              setFilteredGMs(data.gms);
            } else {
              // If no GMs in response, fall back to all GMs from question options
              const gmQuestion = survey?.questions.find(q => 
                (q.question_text.toLowerCase().includes('gm') || q.question_text.toLowerCase().includes('game master')) &&
                ['dropdown', 'single_choice', 'multiple_choice'].includes(q.question_type)
              );
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
            const gmQuestion = survey?.questions.find(q => 
              (q.question_text.toLowerCase().includes('gm') || q.question_text.toLowerCase().includes('game master')) &&
              ['dropdown', 'single_choice', 'multiple_choice'].includes(q.question_type)
            );
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
              const gmQuestion = survey?.questions.find(q => 
                (q.question_text.toLowerCase().includes('gm') || q.question_text.toLowerCase().includes('game master')) &&
                ['dropdown', 'single_choice', 'multiple_choice'].includes(q.question_type)
              );
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
            const gmQuestion = survey?.questions.find(q => 
              (q.question_text.toLowerCase().includes('gm') || q.question_text.toLowerCase().includes('game master')) &&
              ['dropdown', 'single_choice', 'multiple_choice'].includes(q.question_type)
            );
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
      if (previousConventionRef.current !== null && previousConventionRef.current !== currentConvention) {
        setSelectedGMOptionId(null);
        setSelectedGMName(null);
        setFilteredAdventures([]);
        const gmQuestion = survey?.questions.find(q => 
          (q.question_text.toLowerCase().includes('gm') || q.question_text.toLowerCase().includes('game master'))
        );
        const adventureQuestion = survey?.questions.find(q => q.question_text === 'What adventure did you play?');
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
  }, [answers, survey, preSelectedConvention]);

  // Sync selectedGMOptionId with GM answer if GM was already answered, and fetch adventures
  useEffect(() => {
    if (survey) {
      const gmQuestion = survey.questions.find(q => 
        (q.question_text.toLowerCase().includes('gm') || q.question_text.toLowerCase().includes('game master')) &&
        ['dropdown', 'single_choice', 'multiple_choice'].includes(q.question_type)
      );
      
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
        const conventionQuestion = survey.questions.find(q => q.question_text === 'What convention are you attending?');
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
            console.log('Fetching adventures for GM option ID:', gmOptionIdToUse, 'and Convention option ID:', conventionOption.id);
            fetch(`/api/survey/adventures-by-gm?gm_option_id=${gmOptionIdToUse}&convention_option_id=${conventionOption.id}`)
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
                  console.warn('No adventures in response:', data);
                  setFilteredAdventures([]);
                }
              })
              .catch(err => {
                console.error('Error fetching adventures by GM and Convention:', err);
                setFilteredAdventures([]);
              });
          } else {
            // Try by convention value
            console.log('Fetching adventures by GM option ID and convention value:', gmOptionIdToUse, selectedConvention);
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
              })
              .catch(err => {
                console.error('Error fetching adventures by GM and Convention:', err);
                setFilteredAdventures([]);
              });
          }
        } else if (!gmOptionIdToUse && !selectedGMOptionId && gmAnswerValue && selectedConvention) {
          // Try fetching by GM name/value and convention as fallback
          console.log('Fetching adventures by GM name/value and convention:', gmAnswerValue, selectedConvention);
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
            })
            .catch(err => {
              console.error('Error fetching adventures by GM name and Convention:', err);
              setFilteredAdventures([]);
            });
        }
      } else if (!answers[gmQuestion?.id || -1] && selectedGMOptionId) {
        // GM answer was cleared, clear adventures
        setFilteredAdventures([]);
      }
    }
  }, [survey, answers, selectedGMOptionId, filteredGMs]);

  const handleAnswer = (questionId: number, value: any) => {
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
      
      // Clear adventure answer when GM changes
      const adventureQuestion = survey?.questions.find(q => q.question_text === 'What adventure did you play?');
      if (adventureQuestion) {
        setAnswers(prev => {
          const newAnswers = { ...prev };
          delete newAnswers[adventureQuestion.id];
          return newAnswers;
        });
      }
      
      // Still save the GM answer normally, then return
      setAnswers(prev => ({
        ...prev,
        [questionId]: value
      }));
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
      if (questionId === survey?.questions.find(q => q.display_order === 7)?.id && value === 'no') {
        const firstNameQuestion = survey?.questions.find(q => q.display_order === 8);
        const lastNameQuestion = survey?.questions.find(q => q.display_order === 9);
        const emailQuestion = survey?.questions.find(q => q.display_order === 10);
        if (firstNameQuestion) delete newAnswers[firstNameQuestion.id];
        if (lastNameQuestion) delete newAnswers[lastNameQuestion.id];
        if (emailQuestion) delete newAnswers[emailQuestion.id];
      }
      
      return newAnswers;
    });
  };

  const handleNext = async () => {
    // Check if we're on the recommendation question (Q6)
    const recommendationQuestion = survey?.questions.find(q => q.display_order === 6);
    const currentQ = visibleQuestions[currentQuestion];
    
    // If we just answered the recommendation question, submit survey and show coupon page
    if (recommendationQuestion && currentQ?.id === recommendationQuestion.id && answers[recommendationQuestion.id] !== undefined && answers[recommendationQuestion.id] !== null && answers[recommendationQuestion.id] !== '' && !showCouponPage && !responseId) {
      // Submit survey with all answers up to this point
      await submitSurveyUpToRecommendation();
      setShowCouponPage(true);
      return;
    }
    
    // Normal next behavior
    if (visibleQuestions && currentQuestion < visibleQuestions.length - 1) {
      setCurrentQuestion(prev => {
        const next = prev + 1;
        return Math.min(next, visibleQuestions.length - 1);
      });
    }
  };

  const submitSurveyUpToRecommendation = async () => {
    if (isSubmittingRef.current || responseId) return;
    
    isSubmittingRef.current = true;
    
    // Get GM question IDs to exclude them from main survey answers
    const gmQuestionIds = survey?.questions
      .filter(q => q.display_order >= 8 && q.display_order <= 10)
      .map(q => q.id) || [];
    
    // Get convention question
    const conventionQuestion = survey?.questions.find(q => q.question_text === 'What convention are you attending?');
    
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
      const response = await fetch(`/api/survey/${surveyId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerArray })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.responseId) {
          setResponseId(data.responseId);
          // Record coupon delivery immediately
          await recordCouponDelivery(data.responseId);
        }
      } else {
        console.error('Error submitting survey:', response.status);
      }
    } catch (error) {
      console.error('Error submitting survey:', error);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const recordCouponDelivery = async (responseIdParam?: number) => {
    if (couponDelivered) return;
    
    const idToUse = responseIdParam || responseId;
    if (!idToUse) return;
    
    try {
      const response = await fetch('/api/coupon/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseId: idToUse,
          couponCode: tempCouponCode
        })
      });
      
      if (response.ok) {
        setCouponDelivered(true);
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
      setSubmitted(true);
      return;
    }
    
    // Prevent double submission
    if (isSubmittingRef.current) {
      return;
    }
    
    isSubmittingRef.current = true;
    
    // Get GM question IDs to exclude them from main survey answers
    const gmQuestionIds = survey?.questions
      .filter(q => q.display_order >= 8 && q.display_order <= 10)
      .map(q => q.id) || [];
    
    // Get convention question
    const conventionQuestion = survey?.questions.find(q => q.question_text === 'What convention are you attending?');
    
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
      const response = await fetch(`/api/survey/${surveyId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerArray })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.responseId) {
          setResponseId(data.responseId);
          // Record coupon delivery after submission
          await recordCouponDelivery(data.responseId);
        }
        // Use the same coupon code that was shown in the QR code
        setCouponCode(tempCouponCode);
        setSubmitted(true);
      } else {
        alert('Error submitting survey. Please try again.');
        isSubmittingRef.current = false;
      }
    } catch (error) {
      console.error('Error submitting survey:', error);
      alert('Error submitting survey. Please try again.');
      isSubmittingRef.current = false;
    }
  };

  const updateResponseWithRemainingAnswers = async () => {
    if (!responseId) {
      console.error('No responseId available for GM interest submission');
      return { success: false, error: 'No responseId' };
    }
    
    // Get GM questions (display_order 8, 9, 10)
    const gmQuestions = survey?.questions.filter(q => q.display_order >= 8 && q.display_order <= 10) || [];
    const firstNameQuestion = gmQuestions.find(q => q.display_order === 8);
    const lastNameQuestion = gmQuestions.find(q => q.display_order === 9);
    const emailQuestion = gmQuestions.find(q => q.display_order === 10);
    
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

  // Debug logging - MUST be before any early returns (React hooks rule)
  useEffect(() => {
    if (visibleQuestions.length > 0 && survey && !submitted) {
      const safeCurrentQuestion = Math.min(Math.max(0, currentQuestion), Math.max(0, visibleQuestions.length - 1));
      const question = visibleQuestions[safeCurrentQuestion];
      console.log('Survey state:', {
        currentQuestion,
        safeCurrentQuestion,
        visibleQuestionsLength: visibleQuestions.length,
        isLastQuestion: safeCurrentQuestion === visibleQuestions.length - 1,
        questionText: question?.question_text,
        questionDisplayOrder: question?.display_order
      });
    }
  }, [currentQuestion, visibleQuestions.length, visibleQuestions, survey, submitted]);

  // Adjust current question index when skipToGMQuestions changes
  useEffect(() => {
    if (skipToGMQuestions && visibleQuestions.length > 0) {
      setCurrentQuestion(0);
    }
  }, [skipToGMQuestions, visibleQuestions.length]);

  if (loading) {
    return (
      <div className="container">
        <div>Loading survey...</div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="container">
        <div>Survey not found</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="container">
        <div className="success-message">
          <h2>Thank You! 🎉</h2>
          <p style={{ fontSize: '1.2rem', marginTop: '1rem' }}>We'll be reaching out soon!</p>
        </div>
      </div>
    );
  }

  if (visibleQuestions.length === 0) {
    return (
      <div className="container">
        <div>Loading questions...</div>
      </div>
    );
  }

  // Safety check - ensure currentQuestion is valid
  const safeCurrentQuestion = Math.min(Math.max(0, currentQuestion), Math.max(0, visibleQuestions.length - 1));
  const question = visibleQuestions[safeCurrentQuestion];
  
  if (!question) {
    return <div>Loading question...</div>;
  }
  
  const progress = ((safeCurrentQuestion + 1) / visibleQuestions.length) * 100;
  const isLastQuestion = safeCurrentQuestion === visibleQuestions.length - 1;
  
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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
          border: '2px solid #667eea',
          textAlign: 'center',
          maxWidth: '600px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{
            padding: '1rem', 
            background: '#f0f8ff', 
            borderRadius: '12px', 
            border: '2px solid #667eea',
            textAlign: 'center'
          }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '0.75rem', color: '#333' }}>
            Thank You! 🎉
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
                  color: '#667eea', 
                  letterSpacing: '2px',
                  margin: 0,
                  wordBreak: 'break-all'
                }}>
                  {tempCouponCode}
                </p>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(tempCouponCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch (err) {
                      console.error('Failed to copy:', err);
                    }
                  }}
                  style={{
                    padding: '0.6rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: copied ? '#27ae60' : '#667eea',
                    background: copied ? '#d4edda' : 'white',
                    border: `2px solid ${copied ? '#27ae60' : '#667eea'}`,
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
                          couponCode: tempCouponCode 
                        })
                      });
                      if (response.ok) {
                        setEmailSent(true);
                        // Update coupon delivery record with email if we have responseId
                        if (responseId) {
                          await fetch('/api/coupon/deliver', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              responseId: responseId,
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
                    background: sendingEmail ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
              e.currentTarget.style.boxShadow = '0 10px 20px rgba(102, 126, 234, 0.4)';
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
    const isActuallyLast = safeCurrentQuestion === visibleQuestions.length - 1;
    
    console.log('Form submit attempt:', {
      safeCurrentQuestion,
      visibleQuestionsLength: visibleQuestions.length,
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
      {conventionDisplayName && (
        <div style={{
          padding: '0.5rem 1rem',
          background: '#f0f8ff',
          border: '1px solid #667eea',
          borderRadius: '6px',
          marginBottom: '1.5rem',
          textAlign: 'center',
          fontSize: '0.9rem',
          color: '#333',
          maxWidth: '600px',
          margin: '0 auto 1.5rem auto'
        }}>
          <span style={{ color: '#667eea', fontWeight: 600 }}>Convention:</span> {conventionDisplayName}
        </div>
      )}
      <h1 style={{ textAlign: 'center', fontSize: '1.5rem', marginBottom: '0.5rem', color: '#333' }}>
        Thanks for playing with
      </h1>
      <h1 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '1rem', color: '#667eea', fontWeight: 700 }}>
        Evil Genius Games
      </h1>
      <p style={{ textAlign: 'center', fontSize: '0.95rem', marginBottom: '1.5rem', color: '#666', lineHeight: '1.5' }}>
        Complete this 5 minute survey to receive a $5 coupon from Evil Genius Games
      </p>
      <form onSubmit={handleFormSubmit}>
        <div className="survey-header">
          <h2>{survey.title}</h2>
          {survey.description && <p>{survey.description}</p>}
        </div>

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
              // Determine rating scale based on question text
              const isTenScale = question.question_text.toLowerCase().includes('1 to 10') || question.question_text.toLowerCase().includes('scale of 1 to 10');
              const maxRating = isTenScale ? 10 : 5;
              const ratings = Array.from({ length: maxRating }, (_, i) => i + 1);
              
              return ratings.map((rating) => (
                <button
                  key={rating}
                  type="button"
                  className={`rating-button ${answers[question.id] === rating ? 'selected' : ''}`}
                  onClick={() => handleAnswer(question.id, rating)}
                  style={maxRating === 10 ? { width: '40px', height: '40px', fontSize: '1rem' } : {}}
                >
                  {rating}
                </button>
              ));
            })()}
          </div>
        )}

        {question.question_type === 'multiple_choice' && question.options && (
          <div className="question-options">
            {question.options.map((option) => (
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
            {question.options.map((option) => (
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
              if (question.question_text === 'What adventure did you play?') {
                // Check if GM was answered (even if selectedGMOptionId isn't set yet)
                const gmQuestion = survey?.questions.find(q => 
                  (q.question_text.toLowerCase().includes('gm') || q.question_text.toLowerCase().includes('game master')) &&
                  ['dropdown', 'single_choice', 'multiple_choice'].includes(q.question_type)
                );
                const gmAnswered = gmQuestion && answers[gmQuestion.id];
                const hasGMOptionId = selectedGMOptionId != null;
                
                if ((hasGMOptionId || gmAnswered) && filteredAdventures.length > 0) {
                  // Show only adventures associated with the selected GM
                  return filteredAdventures.map((adventure: any) => (
                    <option key={adventure.id} value={adventure.option_value || adventure.option_text}>
                      {adventure.option_text}
                    </option>
                  ));
                } else if ((hasGMOptionId || gmAnswered) && filteredAdventures.length === 0) {
                  // GM selected but no adventures associated (or still loading)
                  return (
                    <option value="" disabled>
                      {hasGMOptionId ? 'No adventures available for this GM' : 'Loading adventures...'}
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
              const isGMQuestion = (question.question_text.toLowerCase().includes('gm') || question.question_text.toLowerCase().includes('game master'));
              if (isGMQuestion) {
                // If convention filtering is active, use filteredGMs, otherwise use all GM options
                const gmsToShow = filteredGMs.length > 0 ? filteredGMs : question.options || [];
                return gmsToShow.map((gm: any) => {
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
              return question.options.map((option) => (
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

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
        {safeCurrentQuestion > 0 && (
          <button type="button" onClick={handlePrevious} className="submit-button" style={{ flex: 1 }}>
            Previous
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
                visibleQuestionsLength: visibleQuestions.length,
                questionId: question.id,
                questionText: question.question_text,
                answerValue: answers[question.id],
                canProceed,
                isRequired: question.is_required,
                isSubmitting: isSubmittingRef.current
              });
              if (safeCurrentQuestion === visibleQuestions.length - 1 && !isSubmittingRef.current && canProceed) {
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
            {isSubmittingRef.current ? 'Submitting...' : 'Submit'}
          </button>
        )}
      </div>
      </form>
    </div>
  );
}

