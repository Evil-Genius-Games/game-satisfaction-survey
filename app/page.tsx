'use client';

import { useState, useEffect } from 'react';
import SurveyForm from './components/SurveyForm';

export default function Home() {
  const [surveyId, setSurveyId] = useState<number | null>(null);
  const [convention, setConvention] = useState<string | null>(null);

  useEffect(() => {
    // Default to survey ID 1 for demo
    setSurveyId(1);
    
    // Check for convention parameter in URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const conventionParam = params.get('convention');
      if (conventionParam) {
        setConvention(decodeURIComponent(conventionParam));
      }
    }
  }, []);

  if (!surveyId) {
    return <div className="container">Loading...</div>;
  }

  return (
    <>
      <SurveyForm surveyId={surveyId} preSelectedConvention={convention} />
    </>
  );
}

