'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const ResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);

const BarChart = dynamic(
  () => import('recharts').then((mod) => mod.BarChart),
  { ssr: false }
);

const Bar = dynamic(
  () => import('recharts').then((mod) => mod.Bar),
  { ssr: false }
);

const XAxis = dynamic(
  () => import('recharts').then((mod) => mod.XAxis),
  { ssr: false }
);

const YAxis = dynamic(
  () => import('recharts').then((mod) => mod.YAxis),
  { ssr: false }
);

const CartesianGrid = dynamic(
  () => import('recharts').then((mod) => mod.CartesianGrid),
  { ssr: false }
);

const Tooltip = dynamic(
  () => import('recharts').then((mod) => mod.Tooltip),
  { ssr: false }
);

interface RatingChartProps {
  data: Array<{ rating: number; count: number }>;
  title: string;
  color: string;
}

export default function RatingChart({ data, title, color }: RatingChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!data || data.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No data available</div>;
  }

  if (!mounted) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading chart...</div>;
  }

  const average = data.reduce((sum, item) => sum + (item.rating * item.count), 0) / data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '8px' }}>
      <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 600 }}>
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="rating" label={{ value: 'Rating', position: 'insideBottom', offset: -5 }} />
          <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Bar dataKey="count" fill={color} />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: '1rem', textAlign: 'center', padding: '0.75rem', background: '#f0f0f0', borderRadius: '6px' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#333', marginBottom: '0.25rem' }}>
          Average Rating: {average > 0 ? average.toFixed(2) : '0.00'}
        </div>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>
          Based on {data.reduce((sum, item) => sum + item.count, 0)} response{data.reduce((sum, item) => sum + item.count, 0) !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
