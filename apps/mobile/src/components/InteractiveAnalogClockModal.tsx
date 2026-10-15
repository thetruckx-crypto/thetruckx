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
import Svg, { Circle, Line } from 'react-native-svg';
import { Clock as ClockIcon, X, Check, Keyboard, Sliders } from 'lucide-react-native';

interface InteractiveAnalogClockModalProps {
  visible: boolean;
  selectedTime: string; // e.g. "09:30 AM" or "14:45"
  onSelectTime: (timeStr: string) => void;
  onClose: () => void;
  title?: string;
}

const CLOCK_RADIUS = 100;
const DIAL_SIZE = 220;
const CENTER = DIAL_SIZE / 2;

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export const InteractiveAnalogClockModal: React.FC<InteractiveAnalogClockModalProps> = ({
  visible,
  selectedTime,
  onSelectTime,
  onClose,
  title = 'Select Loading Time',
}) => {
  // Parsing initial time
  const parsed = useMemo(() => {
    let h = 9;
    let m = 30;
    let ampm: 'AM' | 'PM' = 'AM';

    if (selectedTime) {
      const match = selectedTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (match) {
        h = parseInt(match[1], 10) || 9;
        m = parseInt(match[2], 10) || 0;
        if (match[3]) {
          ampm = match[3].toUpperCase() === 'PM' ? 'PM' : 'AM';
        } else if (h >= 12) {
          ampm = 'PM';
          if (h > 12) h -= 12;
        }
      }
    }
    return { h: h === 0 ? 12 : h > 12 ? h - 12 : h, m, ampm };
  }, [selectedTime]);

  const [hour, setHour] = useState<number>(parsed.h);
  const [minute, setMinute] = useState<number>(parsed.m);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.ampm);
  const [pickerMode, setPickerMode] = useState<'HOURS' | 'MINUTES'>('HOURS');
  const [isManualInput, setIsManualInput] = useState<boolean>(false);

  // Manual inputs
  const [manualHour, setManualHour] = useState<string>(String(parsed.h).padStart(2, '0'));
  const [manualMin, setManualMin] = useState<string>(String(parsed.m).padStart(2, '0'));
  const [manualError, setManualError] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setHour(parsed.h);
      setMinute(parsed.m);
      setPeriod(parsed.ampm);
      setPickerMode('HOURS');
      setIsManualInput(false);
      setManualHour(String(parsed.h).padStart(2, '0'));
      setManualMin(String(parsed.m).padStart(2, '0'));
      setManualError(null);
    }
  }, [visible, parsed]);

  // Polar to Cartesian coordinate helpers
  const getHandPosition = () => {
    const angle = pickerMode === 'HOURS'
      ? ((hour % 12) / 12) * 360
      : (minute / 60) * 360;

    const rad = ((angle - 90) * Math.PI) / 180;
    const r = CLOCK_RADIUS - 20;
    const x = CENTER + r * Math.cos(rad);
    const y = CENTER + r * Math.sin(rad);

    return { x, y, angle };
  };

  const handPos = getHandPosition();

  const handleHourSelect = (val: number) => {
    setHour(val);
    setManualHour(String(val).padStart(2, '0'));
    // Smoothly transition to minute picker
    setPickerMode('MINUTES');
  };

  const handleMinuteSelect = (val: number) => {
    setMinute(val);
    setManualMin(String(val).padStart(2, '0'));
  };

  const handleConfirm = () => {
    if (isManualInput) {
      const h = parseInt(manualHour, 10);
      const m = parseInt(manualMin, 10);
      if (isNaN(h) || h < 1 || h > 12) {
        setManualError('Enter hours between 1 and 12');
        return;
      }
      if (isNaN(m) || m < 0 || m > 59) {
        setManualError('Enter minutes between 0 and 59');
        return;
      }
      const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
      onSelectTime(formatted);
      onClose();
      return;
    }

    const formatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
    onSelectTime(formatted);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.clockCard}>
              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.headerTitleWrap}>
                  <ClockIcon size={18} color="#F15A24" strokeWidth={2.4} />
                  <Text style={styles.headerTitle}>{title}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={20} color="#667085" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>

              {/* Digital Time Preview & Mode Switchers */}
              <View style={styles.digitalReadoutRow}>
                <View style={styles.timeCluster}>
                  <TouchableOpacity
                    style={[styles.digitBox, pickerMode === 'HOURS' && !isManualInput && styles.digitBoxActive]}
                    onPress={() => {
                      setIsManualInput(false);
                      setPickerMode('HOURS');
                    }}
                  >
                    <Text style={[styles.digitText, pickerMode === 'HOURS' && !isManualInput && styles.digitTextActive]}>
                      {String(hour).padStart(2, '0')}
                    </Text>
                    <Text style={styles.digitLabel}>HOURS</Text>
                  </TouchableOpacity>

                  <Text style={styles.colonText}>:</Text>

                  <TouchableOpacity
                    style={[styles.digitBox, pickerMode === 'MINUTES' && !isManualInput && styles.digitBoxActive]}
                    onPress={() => {
                      setIsManualInput(false);
                      setPickerMode('MINUTES');
                    }}
                  >
                    <Text style={[styles.digitText, pickerMode === 'MINUTES' && !isManualInput && styles.digitTextActive]}>
                      {String(minute).padStart(2, '0')}
                    </Text>
                    <Text style={styles.digitLabel}>MINS</Text>
                  </TouchableOpacity>
                </View>

                {/* AM / PM Toggle */}
                <View style={styles.ampmSelector}>
                  <TouchableOpacity
                    style={[styles.ampmBtn, period === 'AM' && styles.ampmBtnActive]}
                    onPress={() => setPeriod('AM')}
                  >
                    <Text style={[styles.ampmText, period === 'AM' && styles.ampmTextActive]}>AM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ampmBtn, period === 'PM' && styles.ampmBtnActive]}
                    onPress={() => setPeriod('PM')}
                  >
                    <Text style={[styles.ampmText, period === 'PM' && styles.ampmTextActive]}>PM</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Toggle Clock Dial vs Manual Keypad */}
              <View style={styles.modeToggleRow}>
                <TouchableOpacity
                  style={[styles.modeToggleBtn, !isManualInput && styles.modeToggleBtnActive]}
                  onPress={() => setIsManualInput(false)}
                >
                  <Sliders size={13} color={!isManualInput ? '#0C1A34' : '#667085'} />
                  <Text style={[styles.modeToggleText, !isManualInput && styles.modeToggleTextActive]}>
                    Analog Dial ({pickerMode === 'HOURS' ? 'Hours' : 'Minutes'})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeToggleBtn, isManualInput && styles.modeToggleBtnActive]}
                  onPress={() => setIsManualInput(true)}
                >
                  <Keyboard size={13} color={isManualInput ? '#0C1A34' : '#667085'} />
                  <Text style={[styles.modeToggleText, isManualInput && styles.modeToggleTextActive]}>
                    Keyboard
                  </Text>
                </TouchableOpacity>
              </View>

              {isManualInput ? (
                /* Manual numeric entry */
                <View style={styles.manualEntryWrap}>
                  <Text style={styles.manualInstruction}>Enter exact dispatch/loading time:</Text>
                  <View style={styles.manualInputsRow}>
                    <View style={styles.manualFieldBox}>
                      <Text style={styles.manualSubLabel}>Hour (1-12)</Text>
                      <TextInput
                        style={styles.manualTextInput}
                        value={manualHour}
                        onChangeText={(t) => {
                          setManualHour(t);
                          setManualError(null);
                          const parsedNum = parseInt(t, 10);
                          if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 12) {
                            setHour(parsedNum);
                          }
                        }}
                        keyboardType="numeric"
                        maxLength={2}
                      />
                    </View>

                    <Text style={[styles.colonText, { alignSelf: 'center', marginTop: 12 }]}>:</Text>

                    <View style={styles.manualFieldBox}>
                      <Text style={styles.manualSubLabel}>Minute (00-59)</Text>
                      <TextInput
                        style={styles.manualTextInput}
                        value={manualMin}
                        onChangeText={(t) => {
                          setManualMin(t);
                          setManualError(null);
                          const parsedNum = parseInt(t, 10);
                          if (!isNaN(parsedNum) && parsedNum >= 0 && parsedNum <= 59) {
                            setMinute(parsedNum);
                          }
                        }}
                        keyboardType="numeric"
                        maxLength={2}
                      />
                    </View>
                  </View>
                  {manualError && <Text style={styles.manualErrorText}>{manualError}</Text>}
                  <Text style={styles.disclaimerText}>
                    Carrier dispatch schedule is subject to depot operating windows.
                  </Text>
                </View>
              ) : (
                /* Interactive Analog Clock Face */
                <View style={styles.analogClockWrap}>
                  <View style={styles.clockDial}>
                    <Svg width={DIAL_SIZE} height={DIAL_SIZE} style={StyleSheet.absoluteFill}>
                      {/* Outer dial ring */}
                      <Circle cx={CENTER} cy={CENTER} r={CENTER - 2} fill="#F8FAFC" stroke="#EAECF0" strokeWidth="2" />
                      {/* Inner accent ring */}
                      <Circle cx={CENTER} cy={CENTER} r={CENTER - 18} fill="none" stroke="#F1F5F9" strokeWidth="1" />

                      {/* Clock Hand */}
                      <Line
                        x1={CENTER}
                        y1={CENTER}
                        x2={handPos.x}
                        y2={handPos.y}
                        stroke="#F15A24"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      {/* Selection bubble on target position */}
                      <Circle cx={handPos.x} cy={handPos.y} r="16" fill="#F15A24" opacity={0.25} />
                      {/* Center pivot dot */}
                      <Circle cx={CENTER} cy={CENTER} r="5" fill="#0C1A34" />
                      <Circle cx={CENTER} cy={CENTER} r="2" fill="#FFFFFF" />
                    </Svg>

                    {/* Clock Numbers positioned along the perimeter */}
                    {(pickerMode === 'HOURS' ? HOURS : MINUTES).map((val) => {
                      const angle = pickerMode === 'HOURS'
                        ? ((val % 12) / 12) * 360
                        : (val / 60) * 360;

                      const rad = ((angle - 90) * Math.PI) / 180;
                      const r = CLOCK_RADIUS - 20;
                      const x = CENTER + r * Math.cos(rad) - 16;
                      const y = CENTER + r * Math.sin(rad) - 16;

                      const isTarget = pickerMode === 'HOURS'
                        ? val === (hour === 0 ? 12 : hour)
                        : Math.abs(val - minute) < 2.5;

                      return (
                        <TouchableOpacity
                          key={String(val)}
                          style={[
                            styles.numberBubble,
                            { left: x, top: y },
                            isTarget && styles.numberBubbleActive,
                          ]}
                          onPress={() => {
                            if (pickerMode === 'HOURS') {
                              handleHourSelect(val);
                            } else {
                              handleMinuteSelect(val);
                            }
                          }}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.numberText, isTarget && styles.numberTextActive]}>
                            {pickerMode === 'MINUTES' ? String(val).padStart(2, '0') : val}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.clockModeHint}>
                    {pickerMode === 'HOURS'
                      ? 'Tap hour on dial to set (1 to 12)'
                      : 'Tap minute on dial to set (00 to 55)'}
                  </Text>
                </View>
              )}

              {/* Action Buttons: Confirm and Cancel */}
              <View style={styles.actionRow}>
                <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn}>
                  <Check size={16} color="#FFFFFF" strokeWidth={2.8} />
                  <Text style={styles.confirmBtnText}>Confirm Time</Text>
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
  clockCard: {
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
  digitalReadoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAECF0',
    padding: 10,
    marginBottom: 12,
  },
  timeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  digitBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#EAECF0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 54,
  },
  digitBoxActive: {
    borderColor: '#F15A24',
    backgroundColor: '#FFF7F2',
  },
  digitText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1D2D46',
  },
  digitTextActive: {
    color: '#F15A24',
  },
  digitLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  colonText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#94A3B8',
  },
  ampmSelector: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F6',
    borderRadius: 10,
    padding: 3,
  },
  ampmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ampmBtnActive: {
    backgroundColor: '#0C1A34',
  },
  ampmText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#667085',
  },
  ampmTextActive: {
    color: '#FFFFFF',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
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
  analogClockWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  clockDial: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBubble: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBubbleActive: {
    backgroundColor: '#F15A24',
  },
  numberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D2D46',
  },
  numberTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  clockModeHint: {
    fontSize: 11.5,
    color: '#667085',
    marginTop: 10,
    fontWeight: '500',
  },
  manualEntryWrap: {
    paddingVertical: 14,
  },
  manualInstruction: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667085',
    marginBottom: 10,
  },
  manualInputsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 10,
  },
  manualFieldBox: {
    alignItems: 'center',
  },
  manualSubLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
  },
  manualTextInput: {
    width: 72,
    height: 50,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '900',
    color: '#0C1A34',
    textAlign: 'center',
  },
  manualErrorText: {
    fontSize: 11.5,
    color: '#DC2626',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 4,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
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
  confirmBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
