import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, AlertCircle, ChevronDown, Check } from 'lucide-react';

export type PresetOption =
  | 'all_time'
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'custom';

export interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (startDate: Date, endDate: Date, label?: string) => void;
  activeLabel?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const PRESETS: { id: PresetOption; label: string }[] = [
  { id: 'all_time', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_year', label: 'This Year' },
  { id: 'last_year', label: 'Last Year' },
  { id: 'custom', label: 'Custom Range' },
];

function formatDateDisplay(d: Date): string {
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleDateString('en-IN', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function computeDisplayLabel(start: Date, end: Date, preset?: PresetOption): string {
  if (preset === 'all_time' || start.getFullYear() <= 2020) {
    return 'All Time';
  }
  if (preset === 'today') return 'Today';
  if (preset === 'yesterday') return 'Yesterday';
  if (preset === 'this_week') return 'This Week';
  if (preset === 'last_week') return 'Last Week';
  if (preset === 'this_month') return 'This Month';
  if (preset === 'last_month') return 'Last Month';
  if (preset === 'this_year') return 'This Year';
  if (preset === 'last_year') return 'Last Year';

  const isSameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  return isSameDay
    ? formatDateDisplay(start)
    : `${formatDateDisplay(start)} – ${formatDateDisplay(end)}`;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  activeLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState<'single' | 'range'>(
    startDate.toDateString() === endDate.toDateString() && startDate.getFullYear() > 2020 ? 'single' : 'range'
  );

  // Active Preset Tracking
  const [activePreset, setActivePreset] = useState<PresetOption>(() => {
    if (startDate.getFullYear() <= 2020) return 'all_time';
    return 'custom';
  });

  // Pending Selection State
  const [pendingStart, setPendingStart] = useState<Date>(startDate);
  const [pendingEnd, setPendingEnd] = useState<Date>(endDate);
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);

  // Direct Date Input State
  const [startInputText, setStartInputText] = useState('');
  const [endInputText, setEndInputText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Calendar View Month & Year: Default to current IST date (October 2026), not hardcoded 2021
  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState<number>(() => {
    return startDate.getFullYear() > 2020 ? startDate.getMonth() : today.getMonth();
  });
  const [viewYear, setViewYear] = useState<number>(() => {
    return startDate.getFullYear() > 2020 ? startDate.getFullYear() : today.getFullYear();
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Synchronize internal inputs when pending dates change
  useEffect(() => {
    if (pendingStart) {
      setStartInputText(formatDateDisplay(pendingStart));
    }
    if (pendingEnd) {
      setEndInputText(formatDateDisplay(pendingEnd));
    }

    if (pendingStart && pendingEnd && pendingStart > pendingEnd) {
      setValidationError('From Date must not be later than To Date.');
    } else {
      setValidationError(null);
    }
  }, [pendingStart, pendingEnd]);

  // Click outside and Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleCancel();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, startDate, endDate]);

  const handleOpen = () => {
    setPendingStart(startDate);
    setPendingEnd(endDate);
    setIsSelectingEnd(false);
    setValidationError(null);

    // If All Time or initial, focus calendar view on current month/year
    if (startDate.getFullYear() <= 2020) {
      setViewMonth(today.getMonth());
      setViewYear(today.getFullYear());
    } else {
      setViewMonth(startDate.getMonth());
      setViewYear(startDate.getFullYear());
    }

    setIsOpen(true);
  };

  const handleCancel = () => {
    setPendingStart(startDate);
    setPendingEnd(endDate);
    setValidationError(null);
    setIsSelectingEnd(false);
    setIsOpen(false);
  };

  // Preset Selection
  const applyPresetSelection = (preset: PresetOption) => {
    setActivePreset(preset);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let newStart = new Date(startOfToday);
    let newEnd = new Date(endOfToday);

    switch (preset) {
      case 'all_time':
        newStart = new Date(2020, 0, 1, 0, 0, 0, 0);
        newEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        setSelectionMode('range');
        break;

      case 'today':
        newStart = startOfToday;
        newEnd = endOfToday;
        setSelectionMode('single');
        break;

      case 'yesterday':
        newStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        newEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        setSelectionMode('single');
        break;

      case 'this_week': {
        const day = now.getDay(); // 0 is Sunday
        newStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day, 0, 0, 0, 0);
        newEnd = endOfToday;
        setSelectionMode('range');
        break;
      }

      case 'last_week': {
        const day = now.getDay();
        newStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - 7, 0, 0, 0, 0);
        newEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - 1, 23, 59, 59, 999);
        setSelectionMode('range');
        break;
      }

      case 'this_month':
        newStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        newEnd = endOfToday;
        setSelectionMode('range');
        break;

      case 'last_month':
        newStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        newEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        setSelectionMode('range');
        break;

      case 'this_year':
        newStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        newEnd = endOfToday;
        setSelectionMode('range');
        break;

      case 'last_year':
        newStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
        newEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        setSelectionMode('range');
        break;

      case 'custom':
        return;
    }

    setPendingStart(newStart);
    setPendingEnd(newEnd);
    setValidationError(null);
    setIsSelectingEnd(false);

    // Update view month & year to the preset start month
    if (preset !== 'all_time') {
      setViewMonth(newStart.getMonth());
      setViewYear(newStart.getFullYear());
    } else {
      setViewMonth(now.getMonth());
      setViewYear(now.getFullYear());
    }
  };

  // Month Days Calculation
  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewMonth, viewYear]);

  const firstDayWeekday = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay();
  }, [viewMonth, viewYear]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear(viewYear - 1);
      } else {
        setViewMonth(viewMonth - 1);
      }
    } else {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear(viewYear + 1);
      } else {
        setViewMonth(viewMonth + 1);
      }
    }
  };

  // Date Cell Click Handler
  const handleDayClick = (dayNumber: number) => {
    const clickedDate = new Date(viewYear, viewMonth, dayNumber, 0, 0, 0, 0);
    setActivePreset('custom');

    if (selectionMode === 'single') {
      setPendingStart(clickedDate);
      const singleEnd = new Date(viewYear, viewMonth, dayNumber, 23, 59, 59, 999);
      setPendingEnd(singleEnd);
      setValidationError(null);
    } else {
      // Date Range mode
      if (!isSelectingEnd) {
        setPendingStart(clickedDate);
        setPendingEnd(clickedDate);
        setIsSelectingEnd(true);
        setValidationError(null);
      } else {
        if (clickedDate < pendingStart) {
          setPendingStart(clickedDate);
          setPendingEnd(pendingStart);
        } else {
          const rangeEnd = new Date(viewYear, viewMonth, dayNumber, 23, 59, 59, 999);
          setPendingEnd(rangeEnd);
        }
        setIsSelectingEnd(false);
        setValidationError(null);
      }
    }
  };

  // Apply Filter Handler
  const handleApply = () => {
    if (validationError || !pendingStart || !pendingEnd) {
      return;
    }

    if (pendingStart > pendingEnd) {
      setValidationError('From Date must not be later than To Date.');
      return;
    }

    const computedLabel = computeDisplayLabel(pendingStart, pendingEnd, activePreset);
    onChange(pendingStart, pendingEnd, computedLabel);
    setIsOpen(false);
  };

  // Parse direct date input on blur
  const handleDateInputBlur = (type: 'start' | 'end') => {
    const textVal = type === 'start' ? startInputText : endInputText;
    const parsed = new Date(textVal);

    if (!isNaN(parsed.getTime())) {
      setActivePreset('custom');
      if (type === 'start') {
        parsed.setHours(0, 0, 0, 0);
        setPendingStart(parsed);
        setViewMonth(parsed.getMonth());
        setViewYear(parsed.getFullYear());
      } else {
        parsed.setHours(23, 59, 59, 999);
        setPendingEnd(parsed);
      }
    } else {
      // Revert text to previous valid date
      if (type === 'start') setStartInputText(formatDateDisplay(pendingStart));
      else setEndInputText(formatDateDisplay(pendingEnd));
    }
  };

  const buttonLabel = activeLabel || computeDisplayLabel(startDate, endDate);

  return (
    <div className="date-range-picker-container" ref={containerRef}>
      {/* 1. Header Trigger Button */}
      <button
        id="btn-date-filter-trigger"
        type="button"
        className="date-picker-trigger"
        onClick={isOpen ? handleCancel : handleOpen}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Calendar size={15} style={{ color: '#F05A22' }} />
        <span>{buttonLabel}</span>
        <ChevronDown size={14} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {/* 2. Calendar Popover */}
      {isOpen && (
        <div
          className="date-picker-dropdown enterprise-calendar-popover"
          role="dialog"
          aria-label="Filter by Date"
        >
          {/* Left Column: Preset Filters */}
          <div className="date-picker-presets">
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', padding: '4px 8px', textTransform: 'uppercase' }}>
              Quick Presets
            </div>
            {PRESETS.map((p) => {
              const isSelected = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={isSelected ? 'preset-active' : ''}
                  onClick={() => applyPresetSelection(p.id)}
                  style={isSelected ? { color: '#F05A22', fontWeight: 700, backgroundColor: '#FFFFFF' } : {}}
                >
                  {p.label}
                  {isSelected && <Check size={12} style={{ float: 'right', marginTop: '2px', color: '#F05A22' }} />}
                </button>
              );
            })}
          </div>

          {/* Right Column: Calendar & Range Controls */}
          <div className="calendar-view" style={{ minWidth: '340px' }}>
            {/* Mode Selector Toggle: [ Single Date ] [ Date Range ] */}
            <div className="calendar-mode-tabs" style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
              <button
                type="button"
                className={`calendar-mode-btn ${selectionMode === 'single' ? 'active' : ''}`}
                onClick={() => {
                  setSelectionMode('single');
                  setPendingEnd(new Date(pendingStart.getFullYear(), pendingStart.getMonth(), pendingStart.getDate(), 23, 59, 59, 999));
                  setValidationError(null);
                  setIsSelectingEnd(false);
                }}
              >
                Single Date
              </button>
              <button
                type="button"
                className={`calendar-mode-btn ${selectionMode === 'range' ? 'active' : ''}`}
                onClick={() => {
                  setSelectionMode('range');
                  setValidationError(null);
                  setIsSelectingEnd(false);
                }}
              >
                Date Range
              </button>
            </div>

            {/* Date Fields Display / Direct Entry */}
            <div className="calendar-date-inputs" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                  {selectionMode === 'single' ? 'Selected Date' : 'From Date'}
                </label>
                <input
                  type="text"
                  className="calendar-date-field"
                  value={startInputText}
                  onChange={(e) => setStartInputText(e.target.value)}
                  onBlur={() => handleDateInputBlur('start')}
                  placeholder="DD MMM YYYY"
                />
              </div>

              {selectionMode === 'range' && (
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                    To Date
                  </label>
                  <input
                    type="text"
                    className="calendar-date-field"
                    value={endInputText}
                    onChange={(e) => setEndInputText(e.target.value)}
                    onBlur={() => handleDateInputBlur('end')}
                    placeholder="DD MMM YYYY"
                  />
                </div>
              )}
            </div>

            {/* Validation Error Alert */}
            {validationError && (
              <div
                className="calendar-validation-msg"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#DC2626',
                  fontSize: '12px',
                  marginBottom: '10px',
                  background: '#FEF2F2',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #FEE2E2',
                }}
              >
                <AlertCircle size={14} />
                <span>{validationError}</span>
              </div>
            )}

            {/* Calendar Header with Navigation */}
            <div className="calendar-header">
              <button
                type="button"
                className="nav-btn"
                onClick={() => navigateMonth('prev')}
                title="Previous Month"
                aria-label="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="month-year" style={{ fontSize: '14px', fontWeight: 700, color: '#172B4D' }}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>

              <button
                type="button"
                className="nav-btn"
                onClick={() => navigateMonth('next')}
                title="Next Month"
                aria-label="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Weekday Labels */}
            <div className="calendar-weekdays">
              {WEEKDAY_NAMES.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="calendar-grid">
              {/* Empty offset padding cells */}
              {Array.from({ length: firstDayWeekday }).map((_, i) => (
                <div key={`empty-${i}`} className="calendar-day empty" style={{ pointerEvents: 'none' }} />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const day = idx + 1;
                const cellDate = new Date(viewYear, viewMonth, day, 0, 0, 0, 0);

                const isToday =
                  cellDate.getFullYear() === today.getFullYear() &&
                  cellDate.getMonth() === today.getMonth() &&
                  cellDate.getDate() === today.getDate();

                const isStart =
                  pendingStart &&
                  cellDate.getFullYear() === pendingStart.getFullYear() &&
                  cellDate.getMonth() === pendingStart.getMonth() &&
                  cellDate.getDate() === pendingStart.getDate();

                const isEnd =
                  pendingEnd &&
                  cellDate.getFullYear() === pendingEnd.getFullYear() &&
                  cellDate.getMonth() === pendingEnd.getMonth() &&
                  cellDate.getDate() === pendingEnd.getDate();

                const inRange =
                  pendingStart &&
                  pendingEnd &&
                  cellDate > pendingStart &&
                  cellDate < pendingEnd;

                let dayClass = 'calendar-day';
                if (isToday) dayClass += ' today';
                if (isStart) dayClass += ' start';
                if (isEnd) dayClass += ' end';
                if (inRange) dayClass += ' in-range';

                return (
                  <button
                    key={`day-${day}`}
                    type="button"
                    className={dayClass}
                    onClick={() => handleDayClick(day)}
                    title={cellDate.toLocaleDateString('en-IN', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Action Buttons: [ Cancel ] [ Apply Filter ] */}
            <div
              className="calendar-actions-footer"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '8px',
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid #E2E8F0',
              }}
            >
              <button
                type="button"
                className="btn-calendar-cancel"
                onClick={handleCancel}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                id="btn-apply-date-filter"
                type="button"
                className="btn-calendar-apply"
                onClick={handleApply}
                disabled={Boolean(validationError) || !pendingStart || !pendingEnd}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: validationError ? '#94A3B8' : '#F05A22',
                  color: '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: validationError ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(240, 90, 34, 0.28)',
                }}
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
