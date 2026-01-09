'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import RatingChart from './components/RatingChart';

// Dynamic import for QRCodeSVG to avoid SSR issues
const DynamicQRCodeSVG = dynamic(
  () => import('qrcode.react').then(mod => mod.QRCodeSVG),
  { ssr: false }
);

interface DropdownOption {
  id: number;
  question_id: number;
  option_text: string;
  option_value: string | null;
  display_order: number;
}

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  display_order: number;
  options?: DropdownOption[];
}

interface Response {
  id: number;
  survey_id: number;
  respondent_email: string | null;
  respondent_name: string | null;
  submitted_at: string;
  answers: Array<{
    question_text: string;
    question_id: number;
    display_order: number;
    answer_text: string | null;
    answer_value: string | null;
  }>;
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'dropdowns' | 'responses' | 'gm-interest' | 'graphs' | 'settings'>('dropdowns');
  const [ratingData, setRatingData] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOption, setEditingOption] = useState<{ questionId: number; optionId: number; text: string } | null>(null);
  const [groupBy, setGroupBy] = useState<'convention' | 'game' | 'none'>('none');
  const [graphConventionFilter, setGraphConventionFilter] = useState<string>('all');
  const [conventions, setConventions] = useState<string[]>([]);
  const [gmInterestData, setGmInterestData] = useState<any[]>([]);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessResult, setReprocessResult] = useState<any>(null);
  const [removingGMAnswers, setRemovingGMAnswers] = useState(false);
  const [removeGMAnswersResult, setRemoveGMAnswersResult] = useState<any>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrCodeLink, setQrCodeLink] = useState<string>('');
  const [qrCodeConvention, setQrCodeConvention] = useState<string>('');
  const qrCodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      // Load data independently with timeouts so one failure doesn't block others
      const fetchWithTimeout = async (fetchFn: () => Promise<void>, timeout: number = 10000) => {
        return Promise.race([
          fetchFn(),
          new Promise<void>((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), timeout)
          )
        ]).catch((error) => {
          console.error('Fetch error:', error);
        });
      };

      // Load all data in parallel but independently
      await Promise.allSettled([
        fetchWithTimeout(fetchQuestions, 10000),
        fetchWithTimeout(fetchResponses, 15000),
        fetchWithTimeout(fetchRatingData, 10000),
        fetchWithTimeout(fetchConventions, 5000),
        fetchWithTimeout(fetchGmInterest, 10000)
      ]);
      
      setLoading(false);
    };
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'graphs' && conventions.length === 0) {
      fetchConventions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    fetchRatingData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphConventionFilter]);

  const fetchConventions = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch('/api/admin/conventions', {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        setConventions(Array.isArray(data) ? data : []);
      } else {
        const errorText = await res.text();
        console.error('Failed to fetch conventions:', res.status, errorText);
        setConventions([]);
      }
    } catch (error: any) {
      console.error('Error fetching conventions:', error);
      setConventions([]);
    }
  };

  const fetchGmInterest = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const res = await fetch('/api/admin/gm-interest', {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        setGmInterestData(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch GM interest:', res.status);
        setGmInterestData([]);
      }
    } catch (error: any) {
      console.error('Error fetching GM interest:', error);
      setGmInterestData([]);
    }
  };

  const fetchRatingData = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const url = graphConventionFilter === 'all' 
        ? '/api/admin/rating-data'
        : `/api/admin/rating-data?convention=${encodeURIComponent(graphConventionFilter)}`;
      
      const res = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Error fetching rating data:', res.status, errorData);
        setRatingData({ 
          gmRating: Array.from({ length: 5 }, (_, i) => ({ rating: i + 1, count: 0 })),
          adventureRating: Array.from({ length: 5 }, (_, i) => ({ rating: i + 1, count: 0 })),
          recommendationRating: Array.from({ length: 10 }, (_, i) => ({ rating: i + 1, count: 0 }))
        });
        return;
      }
      const data = await res.json();
      setRatingData(data);
    } catch (error: any) {
      console.error('Error fetching rating data:', error);
      setRatingData({ 
        gmRating: Array.from({ length: 5 }, (_, i) => ({ rating: i + 1, count: 0 })),
        adventureRating: Array.from({ length: 5 }, (_, i) => ({ rating: i + 1, count: 0 })),
        recommendationRating: Array.from({ length: 10 }, (_, i) => ({ rating: i + 1, count: 0 }))
      });
    }
  };

  const fetchQuestions = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const res = await fetch('/api/admin/questions', {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch questions: ${res.status}`);
      }
      
      const data = await res.json();
      setQuestions(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error fetching questions:', error);
      setQuestions([]);
    }
  };

  const fetchResponses = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const res = await fetch('/api/admin/responses', {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch responses: ${res.status}`);
      }
      
      const data = await res.json();
      setResponses(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error fetching responses:', error);
      setResponses([]);
    }
  };

  const getAnswerValue = (response: Response, questionText: string) => {
    const answer = response.answers.find(ans => ans.question_text === questionText);
    return answer?.answer_text || answer?.answer_value || 'Unknown';
  };

  const getGroupedResponses = () => {
    if (groupBy === 'none') {
      return { 'All Responses': responses };
    }

    const grouped: Record<string, Response[]> = {};

    responses.forEach(response => {
      let category = '';
      if (groupBy === 'convention') {
        category = getAnswerValue(response, 'What convention are you attending?');
      } else if (groupBy === 'game') {
        category = getAnswerValue(response, 'What adventure did you play?');
      }

      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(response);
    });

    // Sort categories alphabetically
    const sortedGrouped: Record<string, Response[]> = {};
    Object.keys(grouped).sort().forEach(key => {
      sortedGrouped[key] = grouped[key];
    });

    return sortedGrouped;
  };

  const handleUpdateOption = async (questionId: number, optionId: number, newText: string) => {
    try {
      const res = await fetch('/api/admin/options', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId, option_text: newText })
      });
      if (res.ok) {
        fetchQuestions();
        setEditingOption(null);
      }
    } catch (error) {
      console.error('Error updating option:', error);
      alert('Failed to update option');
    }
  };

  const handleAddOption = async (questionId: number, text: string) => {
    try {
      const res = await fetch('/api/admin/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, option_text: text })
      });
      if (res.ok) {
        fetchQuestions();
      }
    } catch (error) {
      console.error('Error adding option:', error);
      alert('Failed to add option');
    }
  };

  const handleAddMultipleOptions = async (questionId: number, texts: string[]) => {
    try {
      const validTexts = texts.filter(t => t.trim().length > 0);
      if (validTexts.length === 0) {
        alert('Please enter at least one option');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const text of validTexts) {
        try {
          const res = await fetch('/api/admin/options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionId, option_text: text.trim() })
          });
          if (res.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      if (successCount > 0) {
        fetchQuestions();
        if (errorCount > 0) {
          alert(`Added ${successCount} option(s). ${errorCount} option(s) failed.`);
        } else {
          alert(`Successfully added ${successCount} option(s).`);
        }
      } else {
        alert('Failed to add options');
      }
    } catch (error) {
      console.error('Error adding multiple options:', error);
      alert('Failed to add options');
    }
  };

  const handleDeleteOption = async (optionId: number) => {
    if (!confirm('Are you sure you want to delete this option?')) return;
    try {
      const res = await fetch('/api/admin/options', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId })
      });
      if (res.ok) {
        fetchQuestions();
      }
    } catch (error) {
      console.error('Error deleting option:', error);
      alert('Failed to delete option');
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await fetch('/api/admin/export-csv');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `survey-responses-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV');
    }
  };

  const handleReprocessGMInterest = async () => {
    if (!confirm('This will reprocess all existing survey responses to extract GM interest data. Continue?')) {
      return;
    }

    setReprocessing(true);
    setReprocessResult(null);

    try {
      const res = await fetch('/api/admin/reprocess-gm-interest', {
        method: 'POST'
      });

      const data = await res.json();
      setReprocessResult(data);

      if (res.ok && data.success) {
        alert(`Reprocessing complete! Processed ${data.processed} responses.${data.errors > 0 ? ` ${data.errors} errors occurred.` : ''}`);
        fetchGmInterest(); // Refresh GM interest data
      } else {
        alert('Reprocessing failed: ' + (data.message || data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error reprocessing GM interest:', error);
      alert('Failed to reprocess GM interest data');
    } finally {
      setReprocessing(false);
    }
  };

  const handleRemoveGMAnswers = async () => {
    if (!confirm('This will permanently remove all GM interest answers (first name, last name, email) from the main answers table. They will remain in the GM Interest table. This action cannot be undone. Continue?')) {
      return;
    }

    setRemovingGMAnswers(true);
    setRemoveGMAnswersResult(null);

    try {
      const res = await fetch('/api/admin/remove-gm-answers', {
        method: 'POST'
      });

      const data = await res.json();
      setRemoveGMAnswersResult(data);

      if (res.ok && data.success) {
        alert(`Removed ${data.deleted} GM interest answers from the main answers table.`);
        fetchResponses(); // Refresh responses
      } else {
        alert('Removal failed: ' + (data.message || data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error removing GM answers:', error);
      alert('Failed to remove GM answers');
    } finally {
      setRemovingGMAnswers(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!confirm('WARNING: This will delete ALL responses and answers. This cannot be undone. Are you absolutely sure?')) return;
    if (!confirm('Are you REALLY sure? This will permanently delete all data.')) return;
    try {
      const res = await fetch('/api/admin/clear-database', {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('Database cleared successfully');
        fetchResponses();
      } else {
        alert('Failed to clear database');
      }
    } catch (error) {
      console.error('Error clearing database:', error);
      alert('Failed to clear database');
    }
  };

  const dropdownQuestions = questions.filter(q => ['dropdown', 'multiple_choice', 'single_choice'].includes(q.question_type));

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Loading admin panel...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', background: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h1 style={{ padding: '2rem', borderBottom: '2px solid #e0e0e0', margin: 0, fontSize: '2rem' }}>
          Admin Panel
        </h1>
        
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0' }}>
          <button
            onClick={() => setActiveTab('dropdowns')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'dropdowns' ? '#667eea' : 'transparent',
              color: activeTab === 'dropdowns' ? 'white' : '#333',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600
            }}
          >
            Dropdown Options
          </button>
          <button
            onClick={() => setActiveTab('graphs')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'graphs' ? '#667eea' : 'transparent',
              color: activeTab === 'graphs' ? 'white' : '#333',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600
            }}
          >
            Graphs
          </button>
          <button
            onClick={() => setActiveTab('responses')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'responses' ? '#667eea' : 'transparent',
              color: activeTab === 'responses' ? 'white' : '#333',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600
            }}
          >
            Responses
          </button>
          <button
            onClick={() => setActiveTab('gm-interest')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'gm-interest' ? '#667eea' : 'transparent',
              color: activeTab === 'gm-interest' ? 'white' : '#333',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600
            }}
          >
            GM Interest
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'settings' ? '#667eea' : 'transparent',
              color: activeTab === 'settings' ? 'white' : '#333',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600
            }}
          >
            Settings
          </button>
        </div>

        <div style={{ padding: '2rem' }}>
          {activeTab === 'dropdowns' && (
            <div>
              <h2 style={{ marginBottom: '1.5rem' }}>Manage Dropdown Options</h2>
              {dropdownQuestions.map(question => (
                <div key={question.id} style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '8px' }}>
                  <h3 style={{ marginBottom: '1rem', color: '#333' }}>{question.question_text}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {question.options?.map(option => (
                      <div key={option.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {editingOption?.optionId === option.id ? (
                          <>
                            <input
                              type="text"
                              value={editingOption.text}
                              onChange={(e) => setEditingOption({ ...editingOption, text: e.target.value })}
                              style={{ flex: 1, padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateOption(question.id, option.id, editingOption.text);
                                } else if (e.key === 'Escape') {
                                  setEditingOption(null);
                                }
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => handleUpdateOption(question.id, option.id, editingOption.text)}
                              style={{ padding: '0.5rem 1rem', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingOption(null)}
                              style={{ padding: '0.5rem 1rem', background: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <span style={{ flex: 1, padding: '0.5rem' }}>{option.option_text}</span>
                            <button
                              onClick={() => setEditingOption({ questionId: question.id, optionId: option.id, text: option.option_text })}
                              style={{ padding: '0.5rem 1rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteOption(option.id)}
                              style={{ padding: '0.5rem 1rem', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                    <AddOptionForm questionId={question.id} onAdd={handleAddOption} onAddMultiple={handleAddMultipleOptions} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'responses' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2>Survey Responses ({responses.length})</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                    Group by:
                    <select
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value as 'convention' | 'game' | 'none')}
                      style={{
                        padding: '0.5rem',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '0.95rem'
                      }}
                    >
                      <option value="none">None</option>
                      <option value="convention">Convention</option>
                      <option value="game">Game/Adventure</option>
                    </select>
                  </label>
                  <button
                    onClick={handleExportCSV}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#27ae60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: 600
                    }}
                  >
                    Export CSV
                  </button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                {Object.entries(getGroupedResponses()).map(([category, categoryResponses]) => (
                  <div key={category} style={{ marginBottom: '2rem' }}>
                    <div style={{
                      padding: '1rem',
                      background: groupBy !== 'none' ? '#667eea' : '#f8f9fa',
                      color: groupBy !== 'none' ? 'white' : '#333',
                      fontWeight: 600,
                      fontSize: '1.1rem',
                      borderRadius: '8px 8px 0 0',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      {category} ({categoryResponses.length} {categoryResponses.length === 1 ? 'response' : 'responses'})
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>ID</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Submitted</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Answers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryResponses.map(response => (
                          <tr key={response.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                            <td style={{ padding: '0.75rem' }}>{response.id}</td>
                            <td style={{ padding: '0.75rem' }}>{new Date(response.submitted_at).toLocaleString()}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <details>
                                <summary style={{ cursor: 'pointer', color: '#667eea' }}>View Answers</summary>
                                <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f8f9fa', borderRadius: '4px' }}>
                                  {[...response.answers]
                                    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                                    .map((answer, idx) => (
                                    <div key={idx} style={{ marginBottom: '0.25rem' }}>
                                      <strong>{answer.question_text}:</strong> {answer.answer_text || answer.answer_value || '-'}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'gm-interest' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0 }}>GM Interest Responses ({gmInterestData.length})</h2>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/admin/export-gm-interest-csv');
                      if (res.ok) {
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `gm-interest-${new Date().toISOString().split('T')[0]}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      } else {
                        alert('Failed to export GM interest data');
                      }
                    } catch (error) {
                      console.error('Error exporting GM interest CSV:', error);
                      alert('Failed to export GM interest data');
                    }
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: 600
                  }}
                >
                  Export CSV
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>ID</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Response ID</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>First Name</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Last Name</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Email</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gmInterestData.length > 0 ? (
                      gmInterestData.map((gm: any) => (
                        <tr key={gm.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                          <td style={{ padding: '0.75rem' }}>{gm.id}</td>
                          <td style={{ padding: '0.75rem' }}>{gm.response_id}</td>
                          <td style={{ padding: '0.75rem' }}>{gm.first_name || '-'}</td>
                          <td style={{ padding: '0.75rem' }}>{gm.last_name || '-'}</td>
                          <td style={{ padding: '0.75rem' }}>{gm.email || '-'}</td>
                          <td style={{ padding: '0.75rem' }}>{new Date(gm.submitted_at).toLocaleString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                          No GM interest responses yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'graphs' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0 }}>Rating Question Analytics</h2>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                  Filter by Convention:
                  <select
                    value={graphConventionFilter}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      console.log('Changing convention filter to:', newValue);
                      setGraphConventionFilter(newValue);
                    }}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '0.95rem',
                      minWidth: '200px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="all">All Conventions</option>
                    {conventions.length > 0 ? (
                      conventions.map(conv => (
                        <option key={conv} value={conv}>
                          {conv.charAt(0).toUpperCase() + conv.slice(1).replace(/_/g, ' ')}
                        </option>
                      ))
                    ) : (
                      <option disabled>Loading conventions...</option>
                    )}
                  </select>
                  {conventions.length === 0 && (
                    <span style={{ fontSize: '0.85rem', color: '#666', marginLeft: '0.5rem' }}>
                      (No conventions found)
                    </span>
                  )}
                </label>
              </div>
              {ratingData && 
               Array.isArray(ratingData.gmRating) && 
               Array.isArray(ratingData.adventureRating) && 
               Array.isArray(ratingData.recommendationRating) &&
               ratingData.gmRating.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <RatingChart
                    data={ratingData.gmRating}
                    title="Rate your GM on a scale from 1 to 5"
                    color="#667eea"
                  />
                  <RatingChart
                    data={ratingData.adventureRating}
                    title="Rate the adventure on a scale from 1 to 5"
                    color="#764ba2"
                  />
                  <RatingChart
                    data={ratingData.recommendationRating}
                    title="On a scale of 1 to 10, Would you recommend Everyday Heroes to a friend?"
                    color="#27ae60"
                  />
                </div>
              ) : ratingData === null ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>Loading rating data...</div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                  No rating data available yet. Submit some survey responses to see charts.
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <h2 style={{ marginBottom: '1.5rem' }}>Settings</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>Convention-Specific Survey Links</h3>
                  <p style={{ marginBottom: '0.75rem', color: '#666', fontSize: '0.95rem' }}>
                    Generate survey links pre-configured for specific conventions. Users won't see the convention question when using these links.
                  </p>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.95rem' }}>
                      Select Convention:
                    </label>
                    <select
                      id="convention-select"
                      style={{
                        padding: '0.5rem',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '0.95rem',
                        minWidth: '200px',
                        marginBottom: '0.75rem'
                      }}
                    >
                      <option value="">Select a convention...</option>
                      {conventions.map(conv => (
                        <option key={conv} value={conv}>{conv}</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                      <button
                        onClick={() => {
                          const select = document.getElementById('convention-select') as HTMLSelectElement;
                          const selectedConvention = select?.value;
                          if (!selectedConvention) {
                            alert('Please select a convention');
                            return;
                          }
                          
                          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                          const surveyLink = `${baseUrl}/?convention=${encodeURIComponent(selectedConvention)}`;
                          
                          // Copy to clipboard
                          navigator.clipboard.writeText(surveyLink).then(() => {
                            alert(`Survey link copied to clipboard!\n\n${surveyLink}`);
                          }).catch(() => {
                            // Fallback: show in prompt
                            prompt('Copy this survey link:', surveyLink);
                          });
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.95rem',
                          fontWeight: 600
                        }}
                      >
                        Generate & Copy Link
                      </button>
                      <button
                        onClick={() => {
                          const select = document.getElementById('convention-select') as HTMLSelectElement;
                          const selectedConvention = select?.value;
                          if (!selectedConvention) {
                            alert('Please select a convention');
                            return;
                          }
                          
                          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                          const surveyLink = `${baseUrl}/?convention=${encodeURIComponent(selectedConvention)}`;
                          
                          // Show QR code modal
                          setQrCodeLink(surveyLink);
                          setQrCodeConvention(selectedConvention);
                          setShowQrCode(true);
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#27ae60',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.95rem',
                          fontWeight: 600
                        }}
                      >
                        Generate QR Code
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: '0.75rem', background: '#f8f9fa', borderRadius: '4px', fontSize: '0.85rem', color: '#666' }}>
                    <strong>Note:</strong> The convention will be automatically set when users access the survey via this link. The convention question will be hidden from the survey.
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '1.5rem' }}>
                  <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>GM Interest Data</h3>
                  <p style={{ marginBottom: '0.75rem', color: '#666', fontSize: '0.95rem' }}>
                    Reprocess all existing survey responses to extract GM interest data (first name, last name, email) from the answers table.
                  </p>
                  <button
                    onClick={handleReprocessGMInterest}
                    disabled={reprocessing}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: reprocessing ? '#95a5a6' : '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: reprocessing ? 'not-allowed' : 'pointer',
                      fontSize: '1rem',
                      fontWeight: 600
                    }}
                  >
                    {reprocessing ? 'Reprocessing...' : 'Reprocess GM Interest Data'}
                  </button>
                  {reprocessResult && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>Results:</p>
                      <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
                        <li>Processed: {reprocessResult.processed}</li>
                        <li>Errors: {reprocessResult.errors}</li>
                        <li>Total responses found: {reprocessResult.totalResponses}</li>
                      </ul>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '1.5rem' }}>
                  <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>Clean Up Main Answers Table</h3>
                  <p style={{ marginBottom: '0.75rem', color: '#666', fontSize: '0.95rem' }}>
                    Remove GM interest answers (first name, last name, email) from the main answers table. These answers will remain in the GM Interest table.
                  </p>
                  <button
                    onClick={handleRemoveGMAnswers}
                    disabled={removingGMAnswers}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: removingGMAnswers ? '#95a5a6' : '#f39c12',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: removingGMAnswers ? 'not-allowed' : 'pointer',
                      fontSize: '1rem',
                      fontWeight: 600
                    }}
                  >
                    {removingGMAnswers ? 'Removing...' : 'Remove GM Answers from Main Table'}
                  </button>
                  {removeGMAnswersResult && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>Results:</p>
                      <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
                        <li>Deleted: {removeGMAnswersResult.deleted} answers</li>
                        <li>Before count: {removeGMAnswersResult.beforeCount}</li>
                      </ul>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '1.5rem' }}>
                  <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>⚠️ Danger Zone</h3>
                  <p style={{ marginBottom: '0.75rem', color: '#666', fontSize: '0.95rem' }}>
                    Clearing the database will permanently delete all survey responses and answers. This action cannot be undone.
                  </p>
                  <button
                    onClick={handleClearDatabase}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: 600
                    }}
                  >
                    Clear Database
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrCode && qrCodeLink && typeof window !== 'undefined' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowQrCode(false)}
        >
          <div
            style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '400px',
              width: '90%',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>
              QR Code for {qrCodeConvention}
            </h3>
            <div
              ref={qrCodeRef}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '1rem',
                background: '#f8f9fa',
                borderRadius: '8px',
                marginBottom: '1rem'
              }}
            >
              {qrCodeLink && <DynamicQRCodeSVG value={qrCodeLink} size={256} />}
            </div>
            <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#666', wordBreak: 'break-all' }}>
              {qrCodeLink}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                onClick={async () => {
                  if (!qrCodeRef.current) return;
                  
                  try {
                    // Get the SVG element
                    const svgElement = qrCodeRef.current.querySelector('svg');
                    if (!svgElement) return;
                    
                    // Convert SVG to canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    
                    const svgData = new XMLSerializer().serializeToString(svgElement);
                    const img = new Image();
                    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(svgBlob);
                    
                    img.onload = async () => {
                      canvas.width = img.width;
                      canvas.height = img.height;
                      ctx.drawImage(img, 0, 0);
                      
                      canvas.toBlob(async (blob) => {
                        if (!blob) return;
                        
                        try {
                          await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                          ]);
                          alert('QR Code copied to clipboard!');
                        } catch (err) {
                          // Fallback: download the image
                          const link = document.createElement('a');
                          link.download = `qr-code-${qrCodeConvention}.png`;
                          link.href = URL.createObjectURL(blob);
                          link.click();
                          alert('QR Code downloaded! (Clipboard copy not supported in this browser)');
                        }
                        
                        URL.revokeObjectURL(url);
                      }, 'image/png');
                    };
                    
                    img.src = url;
                  } catch (error) {
                    console.error('Error copying QR code:', error);
                    alert('Failed to copy QR code. Please try downloading it instead.');
                  }
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 600
                }}
              >
                Copy QR Code
              </button>
              <button
                onClick={() => setShowQrCode(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#ccc',
                  color: '#333',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 600
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddOptionForm({ questionId, onAdd, onAddMultiple }: { questionId: number; onAdd: (questionId: number, text: string) => void; onAddMultiple: (questionId: number, texts: string[]) => void }) {
  const [text, setText] = useState('');
  const [multipleText, setMultipleText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'multiple'>('single');

  if (!showForm) {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button
          onClick={() => {
            setShowForm(true);
            setAddMode('single');
          }}
          style={{
            padding: '0.5rem 1rem',
            background: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          + Add Option
        </button>
        <button
          onClick={() => {
            setShowForm(true);
            setAddMode('multiple');
          }}
          style={{
            padding: '0.5rem 1rem',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          + Add Multiple
        </button>
      </div>
    );
  }

  if (addMode === 'multiple') {
    return (
      <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
          Add Multiple Options (one per line):
        </label>
        <textarea
          value={multipleText}
          onChange={(e) => setMultipleText(e.target.value)}
          placeholder="Enter options, one per line&#10;Example:&#10;Option 1&#10;Option 2&#10;Option 3"
          style={{ 
            width: '100%', 
            minHeight: '120px',
            padding: '0.5rem', 
            border: '1px solid #ccc', 
            borderRadius: '4px',
            fontFamily: 'inherit',
            fontSize: '0.95rem',
            resize: 'vertical'
          }}
          autoFocus
        />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button
            onClick={() => {
              const options = multipleText.split('\n').filter(line => line.trim().length > 0);
              if (options.length > 0) {
                onAddMultiple(questionId, options);
                setMultipleText('');
                setShowForm(false);
              } else {
                alert('Please enter at least one option');
              }
            }}
            style={{ padding: '0.5rem 1rem', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Add All
          </button>
          <button
            onClick={() => {
              setShowForm(false);
              setMultipleText('');
            }}
            style={{ padding: '0.5rem 1rem', background: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
      <input
        type="text"
        placeholder="New option text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ flex: 1, padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) {
            onAdd(questionId, text);
            setText('');
            setShowForm(false);
          } else if (e.key === 'Escape') {
            setShowForm(false);
            setText('');
          }
        }}
        autoFocus
      />
      <button
        onClick={() => {
          if (text.trim()) {
            onAdd(questionId, text);
            setText('');
            setShowForm(false);
          }
        }}
        style={{ padding: '0.5rem 1rem', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        Add
      </button>
      <button
        onClick={() => {
          setShowForm(false);
          setText('');
        }}
        style={{ padding: '0.5rem 1rem', background: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        Cancel
      </button>
    </div>
  );
}

