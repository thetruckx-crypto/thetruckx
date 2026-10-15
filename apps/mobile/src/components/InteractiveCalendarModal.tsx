import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Check } from 'lucide-react-native';

interface InteractiveCalendarModalProps {
  visible: boolean;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  onClose: () => void;
  minDate?: string; // YYYY-MM-DD (defaults to today)
  title?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Helper date parsers and formatters
export const toDDMMYYYY = (dateStr: string): string => {
  if (!dateStr) return '';
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  }
  return dateStr;
};

export const toYYYYMMDD = (dateStr: string): string => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('-');
    return `${y}-${m}-${d}`;
  }
  return dateStr;
};

export const parseDateParts = (dateStr?: string) => {
  if (!dateStr || !dateStr.includes('-')) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  if (parts[0].length === 4) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return { y, m, d };
  } else if (parts[2].length === 4) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return { y, m, d };
  }
  return null;
};

export const InteractiveCalendarModal: React.FC<InteractiveCalendarModalProps> = ({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
  minDate,
  title = 'Select Loading Date',
}) => {
  // Today's date YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const effectiveMinDate = minDate ? toYYYYMMDD(minDate) : todayStr;

  // Internal view month/year
  const [viewYear, setViewYear] = useState<number>(() => {
    const parsed = parseDateParts(selectedDate);
    return parsed ? parsed.y : new Date().getFullYear();
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    const parsed = parseDateParts(selectedDate);
    return parsed ? parsed.m - 1 : new Date().getMonth();
  });

  const [tempSelectedDate, setTempSelectedDate] = useState<string>(
    selectedDate ? toYYYYMMDD(selectedDate) : ''
  );
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualDateText, setManualDateText] = useState(
    selectedDate ? toDDMMYYYY(selectedDate) : ''
  );
  const [manualError, setManualError] = useState<string | null>(null);

  // Sync when opening
  React.useEffect(() => {
    if (visible) {
      const parsed = parseDateParts(selectedDate);
      if (parsed) {
        setViewYear(parsed.y);
        setViewMonth(parsed.m - 1);
      }
      setTempSelectedDate(selectedDate ? toYYYYMMDD(selectedDate) : '');
      setManualDateText(selectedDate ? toDDMMYYYY(selectedDate) : '');
      setManualError(null);
      setShowManualInput(false);
    }
  }, [visible, selectedDate]);

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const days: Array<{
      dayNum: number | null;
      fullDateStr: string;
      isPast: boolean;
      isSelected: boolean;
      isToday: boolean;
    }> = [];

    // Leading empty slots
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dayNum: null,
        fullDateStr: '',
        isPast: true,
        isSelected: false,
        isToday: false,
      });
    }

    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPast = dateStr < effectiveMinDate;
      const isSelected = dateStr === tempSelectedDate;
      const isToday = dateStr === todayStr;

      days.push({
        dayNum: d,
        fullDateStr: dateStr,
        isPast,
        isSelected,
        isToday,
      });
    }

    return days;
  }, [viewYear, viewMonth, tempSelectedDate, effectiveMinDate, todayStr]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleConfirm = () => {
    if (showManualInput) {
      const trimmed = manualDateText.trim();
      // Accepts DD-MM-YYYY or YYYY-MM-DD
      const isDDMM = /^\d{2}-\d{2}-\d{4}$/.test(trimmed);
      const isYYYYMM = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
      if (!isDDMM && !isYYYYMM) {
        setManualError('Please enter date in DD-MM-YYYY format');
        return;
      }
      const iso = toYYYYMMDD(trimmed);
      if (iso < effectiveMinDate) {
        setManualError('Date cannot be in the past');
        return;
      }
      onSelectDate(toDDMMYYYY(trimmed));
      onClose();
      return;
    }

    if (!tempSelectedDate) {
      return;
    }
    onSelectDate(toDDMMYYYY(tempSelectedDate));
    onClose();
  };

  const formatReadableDate = (dateStr: string) => {
    if (!dateStr || !dateStr.includes('-')) return 'None Selected';
    try {
      const parts = parseDateParts(dateStr);
      if (!parts) return dateStr;
      const d = new Date(parts.y, parts.m - 1, parts.d);
      return d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.calendarContainer}>
              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.headerTitleWrap}>
                  <CalendarIcon size={18} color="#F15A24" strokeWidth={2.4} />
                  <Text style={styles.headerTitle}>{title}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={20} color="#667085" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>

              {/* Selected date readout */}
              <View style={styles.selectedDateBanner}>
                <Text style={styles.selectedDateLabel}>REQUESTED LOADING DATE</Text>
                <Text style={styles.selectedDateValue}>
                  {tempSelectedDate ? formatReadableDate(tempSelectedDate) : 'Tap a date below'}
                </Text>
              </View>

              {/* Toggle manual vs calendar */}
              <View style={styles.modeToggleRow}>
                <TouchableOpacity
                  style={[styles.modeToggleBtn, !showManualInput && styles.modeToggleBtnActive]}
                  onPress={() => setShowManualInput(false)}
                >
                  <Text style={[styles.modeToggleText, !showManualInput && styles.modeToggleTextActive]}>
                    Calendar View
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeToggleBtn, showManualInput && styles.modeToggleBtnActive]}
                  onPress={() => setShowManualInput(true)}
                >
                  <Text style={[styles.modeToggleText, showManualInput && styles.modeToggleTextActive]}>
                    Manual (YYYY-MM-DD)
                  </Text>
                </TouchableOpacity>
              </View>

              {showManualInput ? (
                /* Manual text entry */
                <View style={styles.manualEntryWrap}>
                  <Text style={styles.manualLabel}>Enter Date (YYYY-MM-DD):</Text>
                  <TextInput
                    style={[styles.manualInput, manualError ? styles.manualInputError : null]}
                    value={manualDateText}
                    onChangeText={(t) => {
                      setManualDateText(t);
                      setManualError(null);
                      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
                        setTempSelectedDate(t);
                      }
                    }}
                    placeholder="e.g. 2026-10-24"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    maxLength={10}
                  />
                  {manualError && <Text style={styles.errorText}>{manualError}</Text>}
                  <Text style={styles.helperText}>Earliest loading available: {effectiveMinDate}</Text>
                </View>
              ) : (
                /* Interactive Month Calendar */
                <View>
                  {/* Month / Year Navigator */}
                  <View style={styles.navRow}>
                    <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrowBtn}>
                      <ChevronLeft size={20} color="#0C1A34" strokeWidth={2.5} />
                    </TouchableOpacity>

                    <Text style={styles.monthYearText}>
                      {MONTH_NAMES[viewMonth]} {viewYear}
                    </Text>

                    <TouchableOpacity onPress={handleNextMonth} style={styles.navArrowBtn}>
                      <ChevronRight size={20} color="#0C1A34" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>

                  {/* Day of Week Labels */}
                  <View style={styles.dayLabelsRow}>
                    {DAY_LABELS.map((d) => (
                      <Text key={d} style={styles.dayLabelText}>
                        {d}
                      </Text>
                    ))}
                  </View>

                  {/* Days Grid */}
                  <View style={styles.daysGrid}>
                    {calendarDays.map((item, index) => {
                      if (!item.dayNum) {
                        return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
                      }

                      return (
                        <TouchableOpacity
                          key={item.fullDateStr}
                          style={[
                            styles.dayCell,
                            item.isSelected && styles.dayCellSelected,
                            item.isToday && !item.isSelected && styles.dayCellToday,
                          ]}
                          disabled={item.isPast}
                          onPress={() => {
                            setTempSelectedDate(item.fullDateStr);
                            setManualDateText(item.fullDateStr);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.dayNumberText,
                              item.isPast && styles.dayNumberPast,
                              item.isSelected && styles.dayNumberSelected,
                              item.isToday && !item.isSelected && styles.dayNumberToday,
                            ]}
                          >
                            {item.dayNum}
                          </Text>
                          {item.isToday && !item.isSelected && <View style={styles.todayIndicatorDot} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Action Buttons: Confirm & Cancel */}
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirm}
                  style={[styles.confirmBtn, !tempSelectedDate && !manualDateText && styles.confirmBtnDisabled]}
                  disabled={!tempSelectedDate && !manualDateText}
                >
                  <Check size={16} color="#FFFFFF" strokeWidth={2.8} />
                  <Text style={styles.confirmBtnText}>Confirm Date</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 26, 52, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  calendarContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0C1A34',
  },
  closeBtn: {
    padding: 4,
  },
  selectedDateBanner: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 10,
    marginBottom: 12,
  },
  selectedDateLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  selectedDateValue: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#F15A24',
    marginTop: 2,
  },
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F6',
    borderRadius: 10,
    padding: 2,
    marginBottom: 14,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0C1A34',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  modeToggleText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#667085',
  },
  modeToggleTextActive: {
    color: '#0C1A34',
    fontWeight: '800',
  },
  manualEntryWrap: {
    paddingVertical: 10,
  },
  manualLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1D2D46',
    marginBottom: 6,
  },
  manualInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#0C1A34',
  },
  manualInputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    fontSize: 11.5,
    color: '#DC2626',
    marginTop: 4,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 11.5,
    color: '#667085',
    marginTop: 6,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  navArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EAECF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0C1A34',
  },
  dayLabelsRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  dayLabelText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 36,
  },
  dayCell: {
    width: '14.28%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: 18,
  },
  dayCellSelected: {
    backgroundColor: '#0C1A34',
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: '#F15A24',
  },
  dayNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D2D46',
  },
  dayNumberPast: {
    color: '#CBD5E1',
    textDecorationLine: 'line-through',
  },
  dayNumberSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayNumberToday: {
    color: '#F15A24',
    fontWeight: '800',
  },
  todayIndicatorDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#F15A24',
    position: 'absolute',
    bottom: 3,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EAECF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#667085',
  },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F15A24',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  confirmBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
