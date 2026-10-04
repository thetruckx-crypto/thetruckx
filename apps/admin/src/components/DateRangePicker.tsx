import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (startDate: Date, endDate: Date) => void;
}

type PresetOption = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date>(startDate);
  const [tempEndDate, setTempEndDate] = useState<Date>(endDate);
  const [viewMonth, setViewMonth] = useState<number>(startDate.getMonth());
  const [viewYear, setViewYear] = useState<number>(startDate.getFullYear());
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDateDisplay = (start: Date, end: Date): string => {
    const isSameDay = start.toDateString() === end.toDateString();
    const formatDate = (d: Date) => {
      const day = d.getDate().toString().padStart(2, '0');
      const month = d.toLocaleDateString('en-IN', { month: 'short' });
      const year = d.getFullYear();
      return `${day} ${month} ${year}`;
    };
    return isSameDay ? formatDate(start) : `${formatDate(start)} - ${formatDate(end)}`;
  };

  const applyPreset = (preset: PresetOption) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let newStart = new Date(today);
    let newEnd = new Date(today);

    switch (preset) {
      case 'today':
        break;
      case 'yesterday':
        newStart.setDate(today.getDate() - 1);
        newEnd.setDate(today.getDate() - 1);
        break;
      case 'this_week':
        const dayOfWeek = today.getDay();
        newStart.setDate(today.getDate() - dayOfWeek);
        newEnd = new Date(today);
        break;
      case 'last_week':
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        newStart = lastWeekStart;
        newEnd = lastWeekEnd;
        break;
      case 'this_month':
        newStart = new Date(today.getFullYear(), today.getMonth(), 1);
        newEnd = new Date(today);
        break;
      case 'last_month':
        newStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        newEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'custom':
        return;
    }

    setTempStartDate(newStart);
    setTempEndDate(newEnd);
    onChange(newStart, newEnd);
    setIsOpen(false);
  };

  const getDaysInMonth = (month: number, year: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number): number => {
    return new Date(year, month, 1).getDay();
  };

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(viewYear, viewMonth, day);
    clickedDate.setHours(0, 0, 0, 0);

    if (!isSelectingEnd) {
      setTempStartDate(clickedDate);
      setTempEndDate(clickedDate);
      setIsSelectingEnd(true);
    } else {
      if (clickedDate < tempStartDate) {
        setTempEndDate(tempStartDate);
        setTempStartDate(clickedDate);
      } else {
        setTempEndDate(clickedDate);
      }
      onChange(clickedDate < tempStartDate ? clickedDate : tempStartDate, clickedDate < tempStartDate ? tempStartDate : clickedDate);
      setIsSelectingEnd(false);
      setIsOpen(false);
    }
  };

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

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(viewMonth, viewYear);
    const firstDay = getFirstDayOfMonth(viewMonth, viewYear);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(viewYear, viewMonth, day);
      currentDate.setHours(0, 0, 0, 0);
      const isStart = currentDate.getTime() === tempStartDate.getTime();
      const isEnd = currentDate.getTime() === tempEndDate.getTime();
      const isInRange = currentDate >= tempStartDate && currentDate <= tempEndDate;
      const isToday = currentDate.toDateString() === new Date().toDateString();

      days.push(
        <button
          key={day}
          type="button"
          className={`calendar-day ${isStart ? 'start' : ''} ${isEnd ? 'end' : ''} ${isInRange ? 'in-range' : ''} ${isToday ? 'today' : ''}`}
          onClick={() => handleDateClick(day)}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  return (
    <div className="date-range-picker-container" ref={dropdownRef}>
      <button
        type="button"
        className="date-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Calendar size={16} />
        <span>{formatDateDisplay(startDate, endDate)}</span>
        <ChevronRight size={14} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="date-picker-dropdown">
          <div className="date-picker-presets">
            <button type="button" onClick={() => applyPreset('today')}>Today</button>
            <button type="button" onClick={() => applyPreset('yesterday')}>Yesterday</button>
            <button type="button" onClick={() => applyPreset('this_week')}>This Week</button>
            <button type="button" onClick={() => applyPreset('last_week')}>Last Week</button>
            <button type="button" onClick={() => applyPreset('this_month')}>This Month</button>
            <button type="button" onClick={() => applyPreset('last_month')}>Last Month</button>
          </div>

          <div className="calendar-view">
            <div className="calendar-header">
              <button type="button" onClick={() => navigateMonth('prev')} className="nav-btn">
                <ChevronLeft size={16} />
              </button>
              <span className="month-year">
                {new Date(viewYear, viewMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </span>
              <button type="button" onClick={() => navigateMonth('next')} className="nav-btn">
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="calendar-weekdays">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="weekday">{day}</div>
              ))}
            </div>

            <div className="calendar-grid">
              {renderCalendar()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
