from pathlib import Path

path = Path('/home/ubuntu/game-satisfaction-survey/app/components/SurveyForm.tsx')
text = path.read_text()

replacements = [
    (
        "const PARTICIPANT_STORAGE_KEY = 'game-satisfaction-survey-participant-id';\n",
        "const PARTICIPANT_STORAGE_KEY = 'game-satisfaction-survey-participant-id';\nconst COUPON_STORAGE_KEY = 'game-satisfaction-survey-issued-coupon';\n\ntype SavedCoupon = {\n  couponCode: string;\n  responseId?: number;\n  responseToken?: string;\n};\n"
    ),
    (
        "function getOrCreateParticipantId() {\n  if (typeof window === 'undefined') return null;\n\n  try {\n    const existingId = window.localStorage.getItem(PARTICIPANT_STORAGE_KEY);\n    if (existingId) return existingId;\n\n    const newId = createParticipantId();\n    window.localStorage.setItem(PARTICIPANT_STORAGE_KEY, newId);\n    return newId;\n  } catch (error) {\n    console.warn('Unable to persist survey participant identity:', error);\n    return createParticipantId();\n  }\n}\n",
        "function getOrCreateParticipantId() {\n  if (typeof window === 'undefined') return null;\n\n  try {\n    const existingId = window.localStorage.getItem(PARTICIPANT_STORAGE_KEY);\n    if (existingId) return existingId;\n\n    const newId = createParticipantId();\n    window.localStorage.setItem(PARTICIPANT_STORAGE_KEY, newId);\n    return newId;\n  } catch (error) {\n    console.warn('Unable to persist survey participant identity:', error);\n    return createParticipantId();\n  }\n}\n\nfunction getSavedCoupon(): SavedCoupon | null {\n  if (typeof window === 'undefined') return null;\n\n  try {\n    const rawCoupon = window.localStorage.getItem(COUPON_STORAGE_KEY);\n    if (!rawCoupon) return null;\n\n    const parsed = JSON.parse(rawCoupon) as SavedCoupon;\n    if (!parsed?.couponCode || typeof parsed.couponCode !== 'string') return null;\n\n    return parsed;\n  } catch (error) {\n    console.warn('Unable to retrieve saved coupon code:', error);\n    return null;\n  }\n}\n"
    ),
    (
        "  // Generate a temporary coupon code for QR code display\n  const tempCouponCode = useMemo(() => {\n    if (couponCode) return couponCode;\n    const prefix = 'GM';\n    const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');\n    return `${prefix}${randomNum}`;\n  }, [couponCode]);\n\n  // Auto-fill convention if pre-selected (run only when preSelectedConvention or survey changes to avoid re-run loops)\n",
        "  // Generate a temporary coupon code for QR code display\n  const tempCouponCode = useMemo(() => {\n    if (couponCode) return couponCode;\n    const prefix = 'GM';\n    const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');\n    return `${prefix}${randomNum}`;\n  }, [couponCode]);\n  const retrievableCouponCode = couponCode || (responseId ? tempCouponCode : '');\n\n  const saveCouponForRetrieval = (code: string, id?: number | null, token?: string | null) => {\n    if (typeof window === 'undefined' || !code) return;\n\n    try {\n      window.localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify({\n        couponCode: code,\n        responseId: id ?? undefined,\n        responseToken: token ?? undefined,\n      }));\n    } catch (error) {\n      console.warn('Unable to save coupon for retrieval:', error);\n    }\n  };\n\n  const copyCouponCode = async (code = tempCouponCode) => {\n    try {\n      await navigator.clipboard.writeText(code);\n      setCopied(true);\n      setTimeout(() => setCopied(false), 2000);\n    } catch (err) {\n      console.error('Failed to copy:', err);\n    }\n  };\n\n  useEffect(() => {\n    const savedCoupon = getSavedCoupon();\n    if (!savedCoupon) return;\n\n    setCouponCode(savedCoupon.couponCode);\n    if (savedCoupon.responseId) setResponseId(savedCoupon.responseId);\n    if (savedCoupon.responseToken) setResponseToken(savedCoupon.responseToken);\n  }, []);\n\n  // Auto-fill convention if pre-selected (run only when preSelectedConvention or survey changes to avoid re-run loops)\n"
    ),
    (
        "          setResponseId(data.responseId);\n          setResponseToken(data.responseToken);\n          // Record coupon delivery immediately\n          await recordCouponDelivery(data.responseId, data.responseToken);\n",
        "          setResponseId(data.responseId);\n          setResponseToken(data.responseToken);\n          setCouponCode(tempCouponCode);\n          saveCouponForRetrieval(tempCouponCode, data.responseId, data.responseToken);\n          // Record coupon delivery immediately\n          await recordCouponDelivery(data.responseId, data.responseToken);\n"
    ),
    (
        "      if (response.ok) {\n        setCouponDelivered(true);\n        if (!responseId) {\n          setResponseId(idToUse);\n        }\n      }\n",
        "      if (response.ok) {\n        setCouponDelivered(true);\n        saveCouponForRetrieval(tempCouponCode, idToUse, tokenToUse);\n        if (!responseId) {\n          setResponseId(idToUse);\n        }\n      }\n"
    ),
    (
        "  const handlePrevious = () => {\n    if (currentQuestion > 0) {\n      setCurrentQuestion(prev => Math.max(0, prev - 1));\n    }\n  };\n",
        "  const handlePrevious = () => {\n    if (currentQuestion > 0) {\n      setCurrentQuestion(prev => Math.max(0, prev - 1));\n      return;\n    }\n\n    if (skipToGMQuestions) {\n      setSkipToGMQuestions(false);\n      setShowCouponPage(true);\n    }\n  };\n"
    ),
    (
        "      await updateResponseWithRemainingAnswers();\n      setCouponCode(tempCouponCode);\n      setSubmitted(true);\n",
        "      await updateResponseWithRemainingAnswers();\n      setCouponCode(tempCouponCode);\n      saveCouponForRetrieval(tempCouponCode, responseId, responseToken);\n      setSubmitted(true);\n"
    ),
    (
        "          setResponseId(data.responseId);\n          setResponseToken(data.responseToken);\n          // Record coupon delivery after submission\n          await recordCouponDelivery(data.responseId, data.responseToken);\n        }\n        // Use the same coupon code that was shown in the QR code\n        setCouponCode(tempCouponCode);\n",
        "          setResponseId(data.responseId);\n          setResponseToken(data.responseToken);\n          setCouponCode(tempCouponCode);\n          saveCouponForRetrieval(tempCouponCode, data.responseId, data.responseToken);\n          // Record coupon delivery after submission\n          await recordCouponDelivery(data.responseId, data.responseToken);\n        }\n        // Use the same coupon code that was shown in the QR code\n        setCouponCode(tempCouponCode);\n        saveCouponForRetrieval(tempCouponCode, data.responseId, data.responseToken);\n"
    ),
    (
        "  if (submitted) {\n    return (\n      <div className=\"container\">\n        <div className=\"success-message\">\n          <h2>Thank You!</h2>\n          <p style={{ fontSize: '1.2rem', marginTop: '1rem' }}>We'll be reaching out soon!</p>\n        </div>\n      </div>\n    );\n  }\n",
        "  if (submitted) {\n    return (\n      <div className=\"container\">\n        <div className=\"success-message\">\n          <h2>Thank You!</h2>\n          <p style={{ fontSize: '1.2rem', marginTop: '1rem' }}>We'll be reaching out soon!</p>\n          {retrievableCouponCode && (\n            <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#fff8f7', border: '2px solid #ed1c24', borderRadius: '10px' }}>\n              <p style={{ margin: '0 0 0.5rem 0', color: '#333', fontWeight: 600 }}>Need your coupon code again?</p>\n              <p style={{ margin: '0 0 0.75rem 0', fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 700, color: '#ed1c24', letterSpacing: '1px' }}>{retrievableCouponCode}</p>\n              <button type=\"button\" onClick={() => copyCouponCode(retrievableCouponCode)} className=\"submit-button\" style={{ maxWidth: '220px', margin: '0 auto' }}>\n                {copied ? 'Copied!' : 'Copy Coupon Code'}\n              </button>\n            </div>\n          )}\n        </div>\n      </div>\n    );\n  }\n"
    ),
    (
        "                  onClick={async () => {\n                    try {\n                      await navigator.clipboard.writeText(tempCouponCode);\n                      setCopied(true);\n                      setTimeout(() => setCopied(false), 2000);\n                    } catch (err) {\n                      console.error('Failed to copy:', err);\n                    }\n                  }}\n",
        "                  onClick={() => copyCouponCode(tempCouponCode)}\n"
    ),
    (
        "        <div className=\"survey-header\">\n          <h2>{survey.title}</h2>\n          {survey.description && <p>{survey.description}</p>}\n        </div>\n\n      <div className=\"progress-bar\">\n",
        "        <div className=\"survey-header\">\n          <h2>{skipToGMQuestions ? 'GM Application' : survey.title}</h2>\n          {survey.description && !skipToGMQuestions && <p>{survey.description}</p>}\n          {skipToGMQuestions && <p>Tell us where to follow up. You can go back to your coupon at any time.</p>}\n        </div>\n\n      {retrievableCouponCode && (\n        <div style={{\n          maxWidth: '600px',\n          margin: '0 auto 1rem auto',\n          padding: '0.85rem 1rem',\n          border: '2px solid #ed1c24',\n          borderRadius: '10px',\n          background: '#fff8f7',\n          color: '#333',\n          display: 'flex',\n          gap: '0.75rem',\n          alignItems: 'center',\n          justifyContent: 'space-between',\n          flexWrap: 'wrap'\n        }}>\n          <span><strong>Your coupon code:</strong> <span style={{ fontFamily: 'monospace', color: '#ed1c24', fontWeight: 700, letterSpacing: '1px' }}>{retrievableCouponCode}</span></span>\n          <button type=\"button\" onClick={() => copyCouponCode(retrievableCouponCode)} style={{\n            padding: '0.5rem 0.85rem',\n            border: '2px solid #ed1c24',\n            borderRadius: '6px',\n            background: copied ? '#d4edda' : 'white',\n            color: copied ? '#27ae60' : '#ed1c24',\n            fontWeight: 700,\n            cursor: 'pointer'\n          }}>\n            {copied ? 'Copied!' : 'Copy'}\n          </button>\n        </div>\n      )}\n\n      <div className=\"progress-bar\">\n"
    ),
    (
        "        {safeCurrentQuestion > 0 && (\n          <button type=\"button\" onClick={handlePrevious} className=\"submit-button\" style={{ flex: 1 }}>\n            Previous\n          </button>\n        )}\n",
        "        {(safeCurrentQuestion > 0 || skipToGMQuestions) && (\n          <button type=\"button\" onClick={handlePrevious} className=\"submit-button\" style={{ flex: 1 }}>\n            Back\n          </button>\n        )}\n"
    ),
    (
        "            {isSubmittingRef.current ? 'Submitting...' : 'Submit'}\n",
        "            {isSubmittingRef.current ? 'Submitting...' : (skipToGMQuestions ? 'Submit Application' : 'Submit')}\n"
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f"Expected text not found:\n{old}")
    text = text.replace(old, new, 1)

path.write_text(text)
