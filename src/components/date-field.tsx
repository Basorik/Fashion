import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, fromDateString, toDateString } from '@/lib/dates';

type Props = {
  // A YYYY-MM-DD date, or '' for none.
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  accessibilityLabel: string;
};

// An optional past date, picked from the phone's calendar. On Android the
// picker opens as a dialog; on iOS it opens under the field. The web has no
// native picker, so it keeps a typed YYYY-MM-DD field.
export function DateField({
  value,
  onChange,
  placeholder = 'Optional',
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const [open, setOpen] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <TextField
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        autoCorrect={false}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  const today = new Date();

  function pick(date: Date) {
    onChange(toDateString(date));
    if (Platform.OS === 'android') setOpen(false);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.field, { backgroundColor: theme.backgroundElement }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel}: ${value ? formatDate(value) : 'not set'}`}
          accessibilityHint="Opens a calendar"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((current) => !current)}
          style={styles.value}>
          <ThemedText themeColor={value ? 'text' : 'textSecondary'} numberOfLines={1}>
            {value ? formatDate(value) : placeholder}
          </ThemedText>
        </Pressable>
        {value !== '' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${accessibilityLabel.toLowerCase()}`}
            onPress={() => {
              onChange('');
              setOpen(false);
            }}
            style={styles.clear}>
            <ThemedText themeColor="textSecondary">×</ThemedText>
          </Pressable>
        )}
      </View>
      {open && (
        <View style={Platform.OS === 'ios' && styles.inline}>
          <DateTimePicker
            value={value ? fromDateString(value) : today}
            maximumDate={today}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            accentColor={theme.accent}
            themeVariant={scheme === 'dark' ? 'dark' : 'light'}
            onValueChange={(_, date) => pick(date)}
            onDismiss={() => setOpen(false)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: Radius.medium,
  },
  value: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: Spacing.three,
  },
  clear: {
    minWidth: 44,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: {
    minHeight: 340,
  },
});
