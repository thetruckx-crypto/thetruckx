import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  RotateCcw,
} from 'lucide-react-native';

export interface DriverDobCalendarModalProps {
  visible: boolean;
  currentDob?: string; // DD/MM/YYYY format
  onConfirm: (dob: string) => void; // returns DD/MM/YYYY
  onClose: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Calculate Age helper
export const calculateAgeFromDate = (
  year: number,
  monthIndex: number,
  day: number
): { age: number; isEligible: boolean; error?: string } => {
  const birthDate = new Date(year, monthIndex, day);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 18) {
    return { age, isEligible: false, error: 'Driver must be at least 18 years old.' };
  }
  if (age > 75) {
    return { age, isEligible: false, error: 'Driver exceeds max commercial age threshold (75 years).' };
  }
  return { age, isEligible: true };
};

export const DriverDobCalendarModal: React.FC<DriverDobCalendarModalProps> = ({
  visible,
  currentDob = '',
  onConfirm,
  onClose,
}) => {
  // Current calendar view: 'DAYS' | 'YEARS' | 'MONTHS'
  const [viewMode, setViewMode] = useState<'DAYS' | 'YEARS' | 'MONTHS'>('DAYS');

  // Selected date components
  const [selectedYear, setSelectedYear] = useState<number>(1995);
  const [selectedMonth, setSelectedMonth] = useState<number>(7); // 0-indexed (August)
  const [selectedDay, setSelectedDay] = useState<number>(15);

  // Active browsing month and year (can browse without committing)
  const [browseYear, setBrowseYear] = useState<number>(1995);
  const [browseMonth, setBrowseMonth] = useState<number>(7);

  // Decade filter for fast year navigation
  const [activeDecade, setActiveDecade] = useState<number>(1990);

  // Parse initial date on open
  useEffect(() => {
    if (visible) {
      if (currentDob && currentDob.includes('/')) {
        const parts = currentDob.split('/');
        if (parts.length === 3) {
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const y = parseInt(parts[2], 10);
          if (!isNaN(d) && !isNaN(m) && !isNaN(y) && y >= 1940 && y <= 2015) {
            setSelectedDay(d);
            setSelectedMonth(m);
            setSelectedYear(y);
            setBrowseMonth(m);
            setBrowseYear(y);
            setActiveDecade(Math.floor(y / 10) * 10);
            setViewMode('DAYS');
            return;
          }
        }
      }
      // Default to 1995 (around 30 years old)
      const defaultY = 1995;
      const defaultM = 5;
      const defaultD = 15;
      setSelectedYear(defaultY);
      setSelectedMonth(defaultM);
      setSelectedDay(defaultD);
      setBrowseYear(defaultY);
      setBrowseMonth(defaultM);
      setActiveDecade(1990);
      setViewMode('DAYS');
    }
  }, [visible, currentDob]);

  // Real-time calculated age for currently selected date
  const ageInfo = useMemo(() => {
    return calculateAgeFromDate(selectedYear, selectedMonth, selectedDay);
  }, [selectedYear, selectedMonth, selectedDay]);

  // List of eligible years (1950 to 2008 = age 18 to 76 in 2026)
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const maxYear = currentYear - 18; // At least 18 years old
    const minYear = currentYear - 75; // Max 75 years old
    const years: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      years.push(y);
    }
    return years;
  }, []);

  const availableDecades = useMemo(() => {
    const decades = [2000, 1990, 1980, 1970, 1960, 1950];
    return decades;
  }, []);

  // Filtered years by selected decade
  const filteredYears = useMemo(() => {
    return availableYears.filter((y) => Math.floor(y / 10) * 10 === activeDecade);
  }, [availableYears, activeDecade]);

  // Calendar matrix calculation for browseYear and browseMonth
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(browseYear, browseMonth, 1).getDay();
    const daysInMonth = new Date(browseYear, browseMonth + 1, 0).getDate();

    const days: Array<{
      dayNum: number | null;
      isSelected: boolean;
      isToday: boolean;
    }> = [];

    // Leading empty slots
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNum: null, isSelected: false, isToday: false });
    }

    const today = new Date();
    // Days in month
    for (let d = 1; d <= daysInMonth; d++) {
      const isSelected =
        selectedYear === browseYear &&
        selectedMonth === browseMonth &&
        selectedDay === d;
      const isToday =
        today.getFullYear() === browseYear &&
        today.getMonth() === browseMonth &&
        today.getDate() === d;

      days.push({
        dayNum: d,
        isSelected,
        isToday,
      });
    }

    return days;
  }, [browseYear, browseMonth, selectedYear, selectedMonth, selectedDay]);

  // Handlers for month navigation
  const handlePrevMonth = () => {
    if (browseMonth === 0) {
      setBrowseMonth(11);
      setBrowseYear((prev) => prev - 1);
    } else {
      setBrowseMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (browseMonth === 11) {
      setBrowseMonth(0);
      setBrowseYear((prev) => prev + 1);
    } else {
      setBrowseMonth((prev) => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    setSelectedDay(day);
    setSelectedMonth(browseMonth);
    setSelectedYear(browseYear);
  };

  const handleSelectYear = (year: number) => {
    setSelectedYear(year);
    setBrowseYear(year);
    setViewMode('DAYS');
  };

  const handleSelectMonth = (monthIndex: number) => {
    setSelectedMonth(monthIndex);
    setBrowseMonth(monthIndex);
    setViewMode('DAYS');
  };

  const handleConfirmSelection = () => {
    const dd = String(selectedDay).padStart(2, '0');
    const mm = String(selectedMonth + 1).padStart(2, '0');
    const yyyy = String(selectedYear);
    onConfirm(`${dd}/${mm}/${yyyy}`);
    onClose();
  };

  const formattedSelectedDate = useMemo(() => {
    const dd = String(selectedDay).padStart(2, '0');
    const monthName = MONTH_NAMES[selectedMonth];
    return `${dd} ${monthName} ${selectedYear}`;
  }, [selectedDay, selectedMonth, selectedYear]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <CalendarIcon size={18} color="#F05A22" />
                <Text style={styles.modalTitle}>Select Date of Birth</Text>
              </View>
              <Text style={styles.modalSubtitle}>
                Driver age is automatically verified (Minimum 18 years)
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityLabel="Close date picker"
            >
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Real-time Age Calculation Banner */}
          <View style={[
            styles.ageSummaryCard,
            ageInfo.isEligible ? styles.ageSummaryEligible : styles.ageSummaryIneligible
          ]}>
            <View style={styles.ageSummaryContent}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedDateText}>{formattedSelectedDate}</Text>
                <View style={styles.ageBadgeRow}>
                  <Text style={[
                    styles.ageValueText,
                    ageInfo.isEligible ? styles.ageTextEligible : styles.ageTextIneligible
                  ]}>
                    Auto-Calculated Age: {ageInfo.age} Years Old
                  </Text>
                </View>
              </View>
              <View style={[
                styles.eligibilityChip,
                ageInfo.isEligible ? styles.eligibilityChipValid : styles.eligibilityChipInvalid
              ]}>
                {ageInfo.isEligible ? (
                  <>
                    <CheckCircle2 size={13} color="#15803D" strokeWidth={2.5} />
                    <Text style={styles.eligibilityTextValid}>Eligible</Text>
                  </>
                ) : (
                  <>
                    <AlertCircle size={13} color="#B91C1C" strokeWidth={2.5} />
                    <Text style={styles.eligibilityTextInvalid}>
                      {ageInfo.age < 18 ? 'Under 18' : '> 75 Yrs'}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {ageInfo.error ? (
              <View style={styles.warningRow}>
                <AlertCircle size={13} color="#DC2626" />
                <Text style={styles.warningText}>{ageInfo.error}</Text>
              </View>
            ) : (
              <Text style={styles.eligibilitySubtext}>
                Meets Ministry of Transport Sarathi commercial driver age criteria.
              </Text>
            )}
          </View>

          {/* Fast Navigation Selector Bar (Month & Year Toggles) */}
          <View style={styles.navBar}>
            <TouchableOpacity
              style={styles.monthNavArrow}
              onPress={handlePrevMonth}
              accessibilityLabel="Previous month"
            >
              <ChevronLeft size={20} color="#172B4D" />
            </TouchableOpacity>

            <View style={styles.selectorButtonsRow}>
              {/* Month Selector Button */}
              <TouchableOpacity
                style={[
                  styles.navSelectorBtn,
                  viewMode === 'MONTHS' ? styles.navSelectorBtnActive : null,
                ]}
                onPress={() => setViewMode(viewMode === 'MONTHS' ? 'DAYS' : 'MONTHS')}
              >
                <Text style={styles.navSelectorBtnText}>{MONTH_NAMES[browseMonth]}</Text>
                <ChevronDown size={14} color="#F05A22" />
              </TouchableOpacity>

              {/* Year Selector Button */}
              <TouchableOpacity
                style={[
                  styles.navSelectorBtn,
                  viewMode === 'YEARS' ? styles.navSelectorBtnActive : null,
                ]}
                onPress={() => setViewMode(viewMode === 'YEARS' ? 'DAYS' : 'YEARS')}
              >
                <Text style={styles.navSelectorBtnText}>{browseYear}</Text>
                <ChevronDown size={14} color="#F05A22" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.monthNavArrow}
              onPress={handleNextMonth}
              accessibilityLabel="Next month"
            >
              <ChevronRight size={20} color="#172B4D" />
            </TouchableOpacity>
          </View>

          {/* Mode 1: Month Selection Grid */}
          {viewMode === 'MONTHS' && (
            <View style={styles.monthGridContainer}>
              <Text style={styles.viewSectionTitle}>Select Birth Month</Text>
              <View style={styles.monthGrid}>
                {MONTH_SHORT.map((name, idx) => {
                  const isCurMonth = browseMonth === idx;
                  return (
                    <TouchableOpacity
                      key={name}
                      style={[
                        styles.monthGridCell,
                        isCurMonth ? styles.monthGridCellActive : null,
                      ]}
                      onPress={() => handleSelectMonth(idx)}
                    >
                      <Text
                        style={[
                          styles.monthGridCellText,
                          isCurMonth ? styles.monthGridCellTextActive : null,
                        ]}
                      >
                        {name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Mode 2: Fast Year Selection Grid */}
          {viewMode === 'YEARS' && (
            <View style={styles.yearGridContainer}>
              <Text style={styles.viewSectionTitle}>Select Birth Year</Text>

              {/* Decade Filter Tabs */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.decadeTabsRow}
              >
                {availableDecades.map((dec) => {
                  const isSelectedDec = activeDecade === dec;
                  return (
                    <TouchableOpacity
                      key={dec}
                      style={[
                        styles.decadeTab,
                        isSelectedDec ? styles.decadeTabActive : null,
                      ]}
                      onPress={() => setActiveDecade(dec)}
                    >
                      <Text
                        style={[
                          styles.decadeTabText,
                          isSelectedDec ? styles.decadeTabTextActive : null,
                        ]}
                      >
                        {dec}s
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Years Grid for the Active Decade */}
              <ScrollView contentContainerStyle={styles.yearGrid}>
                {filteredYears.map((y) => {
                  const isCurYear = browseYear === y;
                  const estimatedAge = new Date().getFullYear() - y;
                  return (
                    <TouchableOpacity
                      key={y}
                      style={[
                        styles.yearGridCell,
                        isCurYear ? styles.yearGridCellActive : null,
                      ]}
                      onPress={() => handleSelectYear(y)}
                    >
                      <Text
                        style={[
                          styles.yearGridCellYear,
                          isCurYear ? styles.yearGridCellTextActive : null,
                        ]}
                      >
                        {y}
                      </Text>
                      <Text
                        style={[
                          styles.yearGridCellAge,
                          isCurYear ? styles.yearGridCellAgeActive : null,
                        ]}
                      >
                        ~{estimatedAge} yrs
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Mode 3: Standard Days Calendar Grid */}
          {viewMode === 'DAYS' && (
            <View style={styles.daysContainer}>
              {/* Weekday Labels Header */}
              <View style={styles.weekdayRow}>
                {DAY_LABELS.map((label, idx) => (
                  <View key={label} style={styles.weekdayCell}>
                    <Text
                      style={[
                        styles.weekdayText,
                        idx === 0 ? styles.sundayText : null,
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Calendar Days 7-column Grid */}
              <View style={styles.daysGrid}>
                {calendarDays.map((item, index) => {
                  if (item.dayNum === null) {
                    return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
                  }

                  return (
                    <TouchableOpacity
                      key={`day-${item.dayNum}`}
                      style={[
                        styles.dayCell,
                        item.isSelected ? styles.dayCellSelected : null,
                      ]}
                      onPress={() => handleSelectDay(item.dayNum!)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayCellText,
                          item.isSelected ? styles.dayCellTextSelected : null,
                        ]}
                      >
                        {item.dayNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Footer Action Buttons */}
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                !ageInfo.isEligible ? styles.confirmBtnDisabled : null,
              ]}
              onPress={handleConfirmSelection}
              disabled={!ageInfo.isEligible}
              activeOpacity={0.85}
            >
              <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={styles.confirmBtnText}>
                Confirm Date of Birth (Age {ageInfo.age})
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#172B4D',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageSummaryCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  ageSummaryEligible: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  ageSummaryIneligible: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  ageSummaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectedDateText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#172B4D',
  },
  ageBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  ageValueText: {
    fontSize: 13,
    fontWeight: '700',
  },
  ageTextEligible: {
    color: '#15803D',
  },
  ageTextIneligible: {
    color: '#B91C1C',
  },
  eligibilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
  },
  eligibilityChipValid: {
    backgroundColor: '#DCFCE7',
  },
  eligibilityChipInvalid: {
    backgroundColor: '#FEE2E2',
  },
  eligibilityTextValid: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  eligibilityTextInvalid: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  eligibilitySubtext: {
    fontSize: 11,
    color: '#475569',
    marginTop: 6,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  warningText: {
    fontSize: 11.5,
    color: '#DC2626',
    fontWeight: '600',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  monthNavArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  navSelectorBtnActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  navSelectorBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#172B4D',
  },
  viewSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  monthGridContainer: {
    paddingVertical: 8,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  monthGridCell: {
    width: '23%',
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthGridCellActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  monthGridCellText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  monthGridCellTextActive: {
    color: '#FFFFFF',
  },
  yearGridContainer: {
    maxHeight: 280,
    paddingVertical: 8,
  },
  decadeTabsRow: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  decadeTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  decadeTabActive: {
    backgroundColor: '#F05A22',
  },
  decadeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  decadeTabTextActive: {
    color: '#FFFFFF',
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
  yearGridCell: {
    width: '31%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  yearGridCellActive: {
    backgroundColor: '#F05A22',
    borderColor: '#F05A22',
  },
  yearGridCellYear: {
    fontSize: 14,
    fontWeight: '800',
    color: '#172B4D',
  },
  yearGridCellAge: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  yearGridCellTextActive: {
    color: '#FFFFFF',
  },
  yearGridCellAgeActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  daysContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  sundayText: {
    color: '#EF4444',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellEmpty: {
    width: '14.28%',
    aspectRatio: 1,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginVertical: 1,
  },
  dayCellSelected: {
    backgroundColor: '#F05A22',
  },
  dayCellText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  confirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F05A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
