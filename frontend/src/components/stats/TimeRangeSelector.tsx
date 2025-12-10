import React from 'react';
import { TimeRange } from '../../types';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({ value, onChange }) => {
  const options: { value: TimeRange; label: string }[] = [
    { value: '1h', label: '1 Hour' },
    { value: '1d', label: '1 Day' },
    { value: '1w', label: '1 Week' },
  ];

  return (
    <div className="time-range-selector">
      {options.map((option) => (
        <button
          key={option.value}
          className={`time-range-btn ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default TimeRangeSelector;
