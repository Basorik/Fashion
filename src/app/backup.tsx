import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { useTheme } from '@/hooks/use-theme';
import { successFeedback, warningFeedback } from '@/lib/haptics';
import { canShare } from '@/lib/share';
import {
  applyRestore,
  discardRestore,
  exportBackup,
  readBackup,
  shareBackup,
  type BackupSummary,
} from '@/lib/backup';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function describe(summary: BackupSummary) {
  const made = new Date(summary.createdAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `Made ${made}, with ${plural(summary.items, 'item')}, ${plural(summary.outfits, 'outfit')} and ${plural(summary.photos, 'photo')}.`;
}

function confirm(title: string, message: string, action: string) {
  warningFeedback();
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: action, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export default function BackupScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [exporting, runExport] = useBusy();
  const [sending, runSend] = useBusy();
  const [restoring, runRestore] = useBusy();
  const [progress, setProgress] = useState<string | null>(null);

  function exportNow() {
    runExport(async () => {
      try {
        const name = await exportBackup(db, (done, total) =>
          setProgress(total > 0 ? `Adding photos, ${done} of ${total}` : null),
        );
        if (name) {
          successFeedback();
          Alert.alert('Backup saved', `${name} is in the folder you picked.`);
        }
      } finally {
        setProgress(null);
      }
    }, 'Could not save backup');
  }

  function sendNow() {
    runSend(async () => {
      try {
        await shareBackup(db, (done, total) =>
          setProgress(total > 0 ? `Adding photos, ${done} of ${total}` : null),
        );
      } finally {
        setProgress(null);
      }
    }, 'Could not send backup');
  }

  function restoreNow() {
    runRestore(async () => {
      setProgress('Reading backup');
      let pending;
      try {
        pending = await readBackup(db);
      } finally {
        setProgress(null);
      }
      if (!pending) return;

      const ok = await confirm(
        'Replace your wardrobe?',
        `${describe(pending.summary)}\n\nEverything in Bella now, including items, outfits, wears, lists and photos, will be replaced by this backup. This can't be undone.`,
        'Replace',
      );
      if (!ok) {
        await discardRestore(pending);
        return;
      }
      setProgress('Restoring');
      try {
        await applyRestore(db, pending);
      } finally {
        setProgress(null);
      }
      successFeedback();
      Alert.alert('Wardrobe restored', describe(pending.summary));
      router.back();
    }, 'Could not restore backup');
  }

  const busy = exporting || sending || restoring;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="subtitle">Back up</ThemedText>
          <ThemedText themeColor="textSecondary">
            Save everything in Bella, photos included, as one file. Keep it somewhere safe, like
            your computer or a cloud drive folder, to move to a new phone or recover after a reset.
            {canShare
              ? ' Send backup opens the share menu, so it can go straight to Drive, email or a chat.'
              : ''}
          </ThemedText>
          <View style={styles.row}>
            <Button
              label="Save backup"
              variant="primary"
              onPress={exportNow}
              busy={exporting}
              disabled={busy}
            />
            {canShare && (
              <Button label="Send backup" onPress={sendNow} busy={sending} disabled={busy} />
            )}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="subtitle">Restore</ThemedText>
          <ThemedText themeColor="textSecondary">
            Pick a Bella backup file to replace what&apos;s in the app now. You&apos;ll see
            what&apos;s in the backup before anything changes.
          </ThemedText>
          <View style={styles.row}>
            <Button
              label="Restore from backup"
              variant="danger"
              onPress={restoreNow}
              busy={restoring}
              disabled={busy}
            />
          </View>
        </View>

        {progress ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {progress}
          </ThemedText>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    gap: Spacing.two,
    borderRadius: Radius.large,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
});
