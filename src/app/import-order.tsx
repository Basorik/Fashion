import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { CategoryChips } from '@/components/category-chips';
import { FooterBar } from '@/components/footer-bar';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useBusy } from '@/hooks/use-busy';
import { useTheme } from '@/hooks/use-theme';
import { parseDateString } from '@/lib/dates';
import { today } from '@/lib/db';
import { formatPrice } from '@/lib/money';
import { parseOrderEmail, type Order } from '@/lib/order-email';
import { addOrderItems, type OrderChoice } from '@/lib/order-import';
import { onSharedEmail, takeSharedEmail } from '@/lib/share-intake';
import { inferCategory } from '@/lib/tag-inference';

type Row = OrderChoice & { key: string; selected: boolean };

type Found = { ok: true; order: Order; rows: Row[] } | { ok: false; message: string };

function findItems(input: string): Found {
  const order = parseOrderEmail(input);
  if (order.items.length === 0) {
    return {
      ok: false,
      message:
        "Couldn't find any items in that email. Copy the whole email, including the list of items, or open the saved email file.",
    };
  }
  const rows = order.items.map((item, index) => ({
    ...item,
    key: String(index),
    selected: true,
    category: inferCategory({ name: item.name }) ?? 'Other',
  }));
  return { ok: true, order, rows };
}

// Plain text that couldn't be read is shown so it can be checked; HTML would be noise.
function shownText(input: string) {
  return /<[a-z][^>]*>/i.test(input) ? '' : input;
}

// Adds the items from an order confirmation email: the user pastes the email's
// text, opens a saved .eml file or shares the email to Bella from a mail app,
// then picks which of the items found to add.
export default function ImportOrderScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  // An email shared to Bella that opened this screen.
  const [shared] = useState(() => {
    const input = takeSharedEmail();
    return input ? { input, found: findItems(input) } : null;
  });
  const first = shared?.found;
  const [text, setText] = useState(shared && !first?.ok ? shownText(shared.input) : '');
  const [message, setMessage] = useState<string | null>(first && !first.ok ? first.message : null);
  const [order, setOrder] = useState<Order | null>(first?.ok ? first.order : null);
  const [rows, setRows] = useState<Row[]>(first?.ok ? first.rows : []);
  const [editing, setEditing] = useState<string | null>(null);
  const [store, setStore] = useState(first?.ok ? (first.order.shop ?? '') : '');
  const [purchasedOn, setPurchasedOn] = useState(first?.ok ? (first.order.orderedOn ?? '') : '');
  const [lookUpLinks, setLookUpLinks] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  const [saving, runSave] = useBusy();
  const [opening, runOpen] = useBusy();

  function read(input: string) {
    const found = findItems(input);
    setEditing(null);
    if (!found.ok) {
      setOrder(null);
      setMessage(found.message);
      return;
    }
    setMessage(null);
    setOrder(found.order);
    setStore(found.order.shop ?? '');
    setPurchasedOn(found.order.orderedOn ?? '');
    setRows(found.rows);
  }

  // Another email shared to Bella while this screen is open replaces this one.
  useEffect(
    () =>
      onSharedEmail(() => {
        const input = takeSharedEmail();
        if (!input) return;
        setText(shownText(input));
        read(input);
      }),
    [],
  );

  function openFile() {
    runOpen(async () => {
      const picked = await File.pickFileAsync();
      if (picked.canceled) return;
      const content = await picked.result.text();
      setText('');
      read(content);
    }, "Couldn't open that file");
  }

  function update(key: string, change: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  }

  function startOver() {
    setOrder(null);
    setRows([]);
    setEditing(null);
  }

  const chosen = rows.filter((row) => row.selected && row.name.trim() !== '');
  const parsedPurchasedOn = purchasedOn.trim() === '' ? null : parseDateString(purchasedOn);
  const purchasedOnIsValid = purchasedOn.trim() === '' || parsedPurchasedOn !== null;
  const hasLinks = rows.some((row) => row.selected && row.link);

  function save() {
    if (chosen.length === 0 || !purchasedOnIsValid) return;
    runSave(async () => {
      try {
        await addOrderItems(
          db,
          chosen.map(({ key, selected, ...choice }) => ({ ...choice, name: choice.name.trim() })),
          {
            store: store.trim() || null,
            brand: order?.brand ?? null,
            purchasedOn: parsedPurchasedOn,
            lookUpLinks: lookUpLinks && hasLinks,
            onProgress: (done, total) =>
              setProgress(done < total ? `Adding ${done + 1} of ${total}…` : null),
          },
        );
      } finally {
        setProgress(null);
      }
      router.dismissAll();
    }, 'Could not add the items');
  }

  if (!order) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets>
          <ThemedText themeColor="textSecondary">
            Copy an order confirmation email from your mail app and paste it here, or open the email
            saved as a file (.eml). It&apos;s read on this phone and isn&apos;t sent anywhere.
          </ThemedText>
          <TextField
            value={text}
            onChangeText={setText}
            placeholder="Paste the email here"
            multiline
            textAlignVertical="top"
            autoCorrect={false}
            accessibilityLabel="Order email"
            style={styles.paste}
          />
          <Button label="Open an email file" onPress={openFile} busy={opening} />
          {message && (
            <ThemedText type="small" themeColor="danger">
              {message}
            </ThemedText>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            Works best with the shop&apos;s order confirmation, which lists each item with its
            color, size and price. Uniqlo, Zara, H&amp;M, ASOS, Amazon and most online shops are
            recognized.
          </ThemedText>
        </ScrollView>
        <FooterBar>
          <Button
            label="Find items"
            onPress={() => read(text)}
            disabled={!text.trim()}
            variant="primary"
          />
        </FooterBar>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets>
        <ThemedText type="subtitle">
          Found {rows.length} item{rows.length === 1 ? '' : 's'}
          {order.shop ? ` from ${order.shop}` : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Untick anything you don&apos;t want to add. Tap an item to fix its name or category.
        </ThemedText>

        {rows.map((row) => {
          const facts = [
            row.color,
            row.size && `Size ${row.size}`,
            row.price !== null && formatPrice(row.price),
            row.quantity > 1 && `×${row.quantity}`,
          ].filter(Boolean);
          const isEditing = editing === row.key;
          return (
            <View
              key={row.key}
              style={[
                styles.row,
                { backgroundColor: theme.backgroundElement },
                !row.selected && styles.unselected,
              ]}>
              <View style={styles.rowTop}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: row.selected }}
                  accessibilityLabel={`Add ${row.name}`}
                  onPress={() => update(row.key, { selected: !row.selected })}
                  hitSlop={8}
                  style={[
                    styles.check,
                    { borderColor: theme.text },
                    row.selected && { backgroundColor: theme.accent, borderColor: theme.accent },
                  ]}>
                  {row.selected && (
                    <ThemedText type="small" style={{ color: theme.onAccent }}>
                      ✓
                    </ThemedText>
                  )}
                </Pressable>
                {row.image ? (
                  <Image
                    source={{ uri: row.image }}
                    style={[styles.thumb, { backgroundColor: theme.background }]}
                    contentFit="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint="Edit the name and category"
                  onPress={() => setEditing(isEditing ? null : row.key)}
                  style={styles.rowText}>
                  <ThemedText numberOfLines={2}>{row.name || 'Unnamed item'}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {[row.category, ...facts].join(' · ')}
                  </ThemedText>
                </Pressable>
              </View>
              {isEditing && (
                <View style={styles.edit}>
                  <TextField
                    value={row.name}
                    onChangeText={(name) => update(row.key, { name })}
                    placeholder="Name"
                    accessibilityLabel="Name"
                    style={{ backgroundColor: theme.background }}
                  />
                  <View style={styles.chips}>
                    <CategoryChips
                      selected={row.category}
                      onSelect={(category) => category && update(row.key, { category })}
                      allowAll={false}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.fields}>
          <View style={styles.flex}>
            <ThemedText type="caption" themeColor="textSecondary">
              Bought at
            </ThemedText>
            <TextField value={store} onChangeText={setStore} placeholder="Optional" />
          </View>
          <View style={styles.flex}>
            <ThemedText type="caption" themeColor="textSecondary">
              Bought on
            </ThemedText>
            <TextField
              value={purchasedOn}
              onChangeText={setPurchasedOn}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
            />
          </View>
        </View>
        {!purchasedOnIsValid && (
          <ThemedText type="small" themeColor="danger">
            Enter a past date like {today()}
          </ThemedText>
        )}

        {hasLinks && (
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <ThemedText>Look up product pages</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Opens each item&apos;s link from the email for a better photo and more tags.
              </ThemedText>
            </View>
            <Switch
              value={lookUpLinks}
              onValueChange={setLookUpLinks}
              accessibilityLabel="Look up product pages"
              trackColor={{ true: theme.accent }}
            />
          </View>
        )}

        {progress && (
          <ThemedText type="small" themeColor="textSecondary">
            {progress}
          </ThemedText>
        )}
        <Button label="Use a different email" onPress={startOver} variant="plain" />
      </ScrollView>
      <FooterBar>
        <Button
          label={
            chosen.length === 0
              ? 'Pick items to add'
              : `Add ${chosen.length} item${chosen.length === 1 ? '' : 's'}`
          }
          onPress={save}
          busy={saving}
          disabled={chosen.length === 0 || !purchasedOnIsValid}
          variant="primary"
        />
      </FooterBar>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  paste: {
    minHeight: 220,
  },
  row: {
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  unselected: {
    opacity: 0.55,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 48,
    height: 60,
    borderRadius: Radius.small,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  edit: {
    gap: Spacing.two,
  },
  chips: {
    marginHorizontal: -Spacing.three,
  },
  fields: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
    gap: Spacing.two,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
