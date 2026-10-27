import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import {
  ArrowLeft,
  Phone,
  Mail,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle2,
  Headphones,
} from 'lucide-react-native';
import { authService, AuthSessionData } from '../../../services/authService';

interface HelpSupportScreenProps {
  session: AuthSessionData | null;
  onBack: () => void;
}

export const HelpSupportScreen: React.FC<HelpSupportScreenProps> = ({
  session,
  onBack,
}) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [category, setCategory] = useState<'TRACKING' | 'BOOKING' | 'PAYMENT' | 'OTHER'>('TRACKING');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ticketRef, setTicketRef] = useState<string | null>(null);

  const faqs = [
    {
      q: 'How do I track my active consignment?',
      a: 'Enter your 6 or 10-digit LR number or Booking ID in the Consignment Tracking field on your Home screen to view live GPS location and milestone updates.',
    },
    {
      q: 'How does freight pricing & billing work?',
      a: 'Freight contracts are quoted either per-trip or per-metric-tonne. Invoices and e-Way bills are automatically generated upon dispatch sign-off.',
    },
    {
      q: 'What should I do during a transit breakdown?',
      a: 'Call our 24/7 dedicated control tower immediately using the phone helpline below. An emergency backup lorry or repair team will be dispatched.',
    },
    {
      q: 'How are digital PODs uploaded?',
      a: 'Drivers or consignees can capture a clear photograph of the stamped physical Lorry Receipt in the app within 24 hours of delivery.',
    },
  ];

  const handleSubmitTicket = async () => {
    if (!subject.trim()) {
      Alert.alert('Required Field', 'Please enter a ticket subject.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Required Field', 'Please describe your inquiry or issue.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authService.submitSupportTicket({
        name: session?.fullName || 'TRUCKS User',
        phone: session?.mobile || '',
        category,
        subject: subject.trim(),
        message: message.trim(),
      });

      setTicketRef(res.ticketRef);
      setSubject('');
      setMessage('');
      Alert.alert(
        'Ticket Submitted',
        `Your support request has been logged under reference ${res.ticketRef}. Our operations desk will respond shortly.`
      );
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Unable to submit ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCall = () => {
    Linking.openURL('tel:18002584567').catch(() => {
      Alert.alert('Helpline', 'Call TRUCKS 24/7 Support Desk: +91 1800 258 4567');
    });
  };

  const handleEmail = () => {
    Linking.openURL('mailto:support@trucks.in').catch(() => {
      Alert.alert('Email Support', 'Contact us at: support@trucks.in');
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color="#172B4D" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Helpline Contact Cards */}
        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.contactCard} onPress={handleCall} activeOpacity={0.7}>
            <View style={[styles.contactIconCircle, { backgroundColor: '#FFF5ED' }]}>
              <Phone size={20} color="#F05A22" />
            </View>
            <Text style={styles.contactCardTitle}>Call 24/7 Helpline</Text>
            <Text style={styles.contactCardSub}>1800 258 4567</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard} onPress={handleEmail} activeOpacity={0.7}>
            <View style={[styles.contactIconCircle, { backgroundColor: '#EFF6FF' }]}>
              <Mail size={20} color="#2563EB" />
            </View>
            <Text style={styles.contactCardTitle}>Email Desk</Text>
            <Text style={styles.contactCardSub}>support@trucks.in</Text>
          </TouchableOpacity>
        </View>

        {/* FAQs Section */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionHeader}>Frequently Asked Questions</Text>

          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <View key={idx} style={styles.faqCard}>
                <TouchableOpacity
                  style={styles.faqQuestionRow}
                  onPress={() => setActiveFaq(isOpen ? null : idx)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.faqQuestionText}>{faq.q}</Text>
                  {isOpen ? <ChevronUp size={18} color="#F05A22" /> : <ChevronDown size={18} color="#94A3B8" />}
                </TouchableOpacity>

                {isOpen && (
                  <View style={styles.faqAnswerBox}>
                    <Text style={styles.faqAnswerText}>{faq.a}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Support Ticket Submission Form */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionHeader}>Submit a Support Ticket</Text>

          {ticketRef && (
            <View style={styles.ticketConfirmedBox}>
              <CheckCircle2 size={18} color="#16A34A" />
              <Text style={styles.ticketConfirmedText}>
                Active Ticket: <Text style={styles.ticketRefBold}>{ticketRef}</Text>
              </Text>
            </View>
          )}

          <View style={styles.ticketFormCard}>
            {/* Category Selector */}
            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.categoryPillsRow}>
              {(['TRACKING', 'BOOKING', 'PAYMENT', 'OTHER'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catPill, category === cat && styles.catPillActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catPillText, category === cat && styles.catPillTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subject Input */}
            <Text style={styles.inputLabel}>Subject *</Text>
            <TextInput
              style={styles.inputField}
              placeholder="e.g. Consignment delay on Route NH-27"
              placeholderTextColor="#94A3B8"
              value={subject}
              onChangeText={setSubject}
            />

            {/* Message Input */}
            <Text style={styles.inputLabel}>Message Description *</Text>
            <TextInput
              style={[styles.inputField, styles.textArea]}
              placeholder="Describe your issue or question in detail..."
              placeholderTextColor="#94A3B8"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmitTicket}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Send size={16} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Submit Support Ticket</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF0',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#172B4D',
  },
  scrollContainer: {
    padding: 16,
    backgroundColor: '#F8FAFC',
  },
  contactRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  contactCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5EAF0',
    alignItems: 'center',
  },
  contactIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  contactCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#172B4D',
    marginBottom: 2,
  },
  contactCardSub: {
    fontSize: 12,
    color: '#64748B',
  },
  sectionWrap: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#172B4D',
    marginBottom: 10,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5EAF0',
    marginBottom: 8,
    overflow: 'hidden',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  faqQuestionText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#172B4D',
    flex: 1,
    paddingRight: 10,
  },
  faqAnswerBox: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFCFF',
  },
  faqAnswerText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    paddingTop: 8,
  },
  ticketConfirmedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  ticketConfirmedText: {
    fontSize: 13,
    color: '#166534',
  },
  ticketRefBold: {
    fontWeight: '800',
  },
  ticketFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5EAF0',
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  categoryPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  catPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  catPillActive: {
    backgroundColor: '#F05A22',
  },
  catPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  catPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inputField: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13.5,
    color: '#172B4D',
    marginBottom: 14,
  },
  textArea: {
    height: 90,
    paddingTop: 10,
  },
  submitBtn: {
    backgroundColor: '#F05A22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#F05A22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
});
