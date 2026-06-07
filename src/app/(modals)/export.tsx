import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, Keyboard, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';

import { BarcodeMark } from '@/components/ui/barcode-mark';
import { MonoLabel } from '@/components/ui/mono-label';
import { SectionTag } from '@/components/ui/section-tag';
import { EddiesColors, EddiesSpacing } from '@/constants/theme';
import { useStore } from '@/store';
import { exportAsCSV, exportAsJSON } from '@/lib/export';

type DateRange = 'all' | 'week' | 'month';
type Format = 'csv' | 'json';

export default function ExportModal() {
  const db = useSQLiteContext();
  const { showToast, firstDayOfWeek } = useStore();
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [format, setFormat] = useState<Format>('csv');
  const [exporting, setExporting] = useState(false);

  function getDateRangeLabel(range: DateRange): string {
    const now = new Date();
    switch (range) {
      case 'all': return 'All data';
      case 'week': {
        const s = new Date(now);
        s.setDate(now.getDate() - now.getDay());
        return `This week (${s.toLocaleDateString()})`;
      }
      case 'month':
        return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  }

  function getExportRange(): { from?: number; to?: number } | undefined {
    const now = Date.now();
    switch (dateRange) {
      case 'all': return undefined;
      case 'week': {
        const s = new Date(now);
        s.setDate(s.getDate() - ((s.getDay() - firstDayOfWeek + 7) % 7));
        s.setHours(0, 0, 0, 0);
        return { from: s.getTime(), to: now };
      }
      case 'month': {
        const s = new Date(now);
        s.setDate(1);
        s.setHours(0, 0, 0, 0);
        return { from: s.getTime(), to: now };
      }
    }
  }

  async function handleExport() {
    if (exporting) return;
    try {
      setExporting(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const range = getExportRange();
      const today = new Date().toISOString().split('T')[0];
      const content = format === 'csv'
        ? await exportAsCSV(db, range)
        : await exportAsJSON(db, range);
      await Share.share({ title: `eddies_${today}.${format}`, message: content });
      showToast(`${format.toUpperCase()} export ready`);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => router.back(), 600);
    } catch (err) {
      console.error('Export error:', err);
      showToast('Export failed', 'err');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setExporting(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <SectionTag label="EDDIES // EXPORT 01-A" />
        <BarcodeMark height={16} />
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setTimeout(() => router.back(), 100);
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <MonoLabel size={11} weight="bold" color={EddiesColors.steel}>CLOSE</MonoLabel>
        </Pressable>
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
        {/* Date Range */}
        <View style={s.section}>
          <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>DATE RANGE</MonoLabel>
          <View style={s.optionGroup}>
            {(['all', 'week', 'month'] as DateRange[]).map((option) => (
              <Pressable
                key={option}
                style={[s.option, dateRange === option && s.optionActive]}
                onPress={() => {
                  setDateRange(option);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                accessibilityRole="radio"
                accessibilityLabel={getDateRangeLabel(option)}
                accessibilityState={{ checked: dateRange === option }}
              >
                <View style={[s.optionRadio, dateRange === option && s.optionRadioActive]} />
                <Text style={s.optionText}>{getDateRangeLabel(option)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Format */}
        <View style={s.section}>
          <MonoLabel size={10} letterSpacing={2} color={EddiesColors.steel}>FORMAT</MonoLabel>
          <View style={s.optionGroup}>
            {(['csv', 'json'] as Format[]).map((option) => (
              <Pressable
                key={option}
                style={[s.option, format === option && s.optionActive]}
                onPress={() => {
                  setFormat(option);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                accessibilityRole="radio"
                accessibilityLabel={option === 'csv' ? 'CSV — Spreadsheet' : 'JSON — Full fidelity'}
                accessibilityState={{ checked: format === option }}
              >
                <View style={[s.optionRadio, format === option && s.optionRadioActive]} />
                <Text style={s.optionText}>
                  {option === 'csv' ? 'CSV — Spreadsheet' : 'JSON — Full fidelity'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={s.description}>
          <Text style={s.descriptionText}>
            {format === 'csv'
              ? 'Spreadsheet-compatible. Works with Excel, Google Sheets, and Numbers.'
              : 'Full fidelity JSON with all fields. Use for backup or custom analysis.'}
          </Text>
        </View>

        {/* Export Button */}
        <Pressable
          style={[s.button, exporting && s.buttonDisabled]}
          onPress={handleExport}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityLabel={`Export as ${format.toUpperCase()}`}
        >
          {exporting ? (
            <ActivityIndicator color={EddiesColors.bone} />
          ) : (
            <MonoLabel size={12} weight="bold" color={EddiesColors.bone} letterSpacing={1}>
              EXPORT {format.toUpperCase()}
            </MonoLabel>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: EddiesColors.ink },
  header: {
    paddingHorizontal: EddiesSpacing.md,
    paddingTop: EddiesSpacing.md,
    paddingBottom: EddiesSpacing.md,
    gap: EddiesSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: EddiesColors.steel + '1A',
  },
  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md,
    gap: EddiesSpacing.lg,
  },
  section: { gap: EddiesSpacing.sm },
  optionGroup: { gap: EddiesSpacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.sm,
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '33',
    borderRadius: 6,
    gap: EddiesSpacing.md,
  },
  optionActive: {
    borderColor: EddiesColors.alert,
    backgroundColor: EddiesColors.alert + '11',
  },
  optionRadio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: EddiesColors.steel,
  },
  optionRadioActive: {
    borderColor: EddiesColors.alert,
    backgroundColor: EddiesColors.alert,
  },
  optionText: {
    flex: 1,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    color: EddiesColors.bone,
  },
  description: {
    paddingHorizontal: EddiesSpacing.md,
    paddingVertical: EddiesSpacing.md,
    backgroundColor: EddiesColors.surface,
    borderWidth: 1,
    borderColor: EddiesColors.steel + '1A',
    borderRadius: 6,
  },
  descriptionText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    lineHeight: 17,
    color: EddiesColors.steel,
  },
  button: {
    paddingVertical: EddiesSpacing.md,
    paddingHorizontal: EddiesSpacing.md,
    backgroundColor: EddiesColors.alert,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: EddiesSpacing.xl,
  },
  buttonDisabled: { opacity: 0.6 },
});
