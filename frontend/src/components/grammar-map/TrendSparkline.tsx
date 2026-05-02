import React from 'react';

interface TrendSparklineProps {
  trend7d: number;
  trend30d: number;
}

const TrendSparkline: React.FC<TrendSparklineProps> = ({ trend7d, trend30d }) => {
  const previousWindow = Math.max(0, trend30d - trend7d);
  const values = [previousWindow, trend7d];
  const width = 180;
  const height = 44;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const y = (value: number) => height - (value / max) * (height - 8) - 4;
  const points = values.map((value, index) => `${index * step},${y(value)}`).join(' ');

  return (
    <div className="grammar-trend">
      <div className="grammar-trend-head">
        <span>30 天趋势</span>
        <strong>{trend7d}/{trend30d}</strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((value, index) => (
          <circle key={`${value}-${index}`} cx={index * step} cy={y(value)} r="3" fill="var(--accent)" />
        ))}
      </svg>
      <div className="grammar-trend-axis">
        <span>前 23 天</span>
        <span>近 7 天</span>
      </div>
    </div>
  );
};

export default TrendSparkline;
