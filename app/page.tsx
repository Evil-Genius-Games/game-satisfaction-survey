'use client';

import { useState, useEffect } from 'react';
import SurveyForm from './components/SurveyForm';

const DEFAULT_SURVEY_ID = 1;

export default function Home() {
  // Use default survey ID immediately so we never block on "Loading..." from this page.
  // Convention is read from URL in useEffect so links like ?convention=SaltCon work.
  const [surveyId] = useState<number>(DEFAULT_SURVEY_ID);
  const [convention, setConvention] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const conventionParam = params.get('convention');
    if (conventionParam) {
      setConvention(decodeURIComponent(conventionParam));
    }
  }, []);

  return (
    <>
      <SurveyForm surveyId={surveyId} preSelectedConvention={convention} />
    </>
  );
}

