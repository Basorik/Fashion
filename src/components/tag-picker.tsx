import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TagGroupNames, TagGroups, type Tag, type TagGroup } from '@/constants/tags';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
};

// Chips for each tag group: the presets plus any custom tags the item already has.
export function TagPicker({ value, onChange }: Props) {
  return (
    <View style={styles.groups}>
      {TagGroupNames.map((group) => (
        <TagGroupRow key={group} group={group} value={value} onChange={onChange} />
      ))}
    </View>
  );
}

function TagGroupRow({ group, value, onChange }: Props & { group: TagGroup }) {
  const theme = useTheme();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const presets: readonly string[] = TagGroups[group];
  const selected = value.filter((tag) => tag.group === group).map((tag) => tag.value);
  const options = [...presets, ...selected.filter((tag) => !presets.includes(tag))];

  function toggle(tagValue: string) {
    const isSelected = selected.includes(tagValue);
    onChange(
      isSelected
        ? value.filter((tag) => !(tag.group === group && tag.value === tagValue))
        : [...value, { group, value: tagValue }]
    );
  }

  function addCustom() {
    const tagValue = draft.trim();
    if (tagValue && !selected.some((tag) => tag.toLowerCase() === tagValue.toLowerCase())) {
      onChange([...value, { group, value: tagValue }]);
    }
    setDraft('');
    setAdding(false);
  }

  return (
    <View style={styles.group}>
      <ThemedText type="small" themeColor="textSecondary">
        {group}
      </ThemedText>
      <View style={styles.chips}>
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <Pressable
              key={option}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${group}: ${option}`}
              onPress={() => toggle(option)}
              style={[styles.chip, { backgroundColor: active ? theme.text : theme.backgroundElement }]}>
              <ThemedText type="small" style={{ color: active ? theme.background : theme.text }}>
                {option}
              </ThemedText>
            </Pressable>
          );
        })}
        {adding ? (
          <TextInput
            autoFocus
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addCustom}
            onBlur={addCustom}
            returnKeyType="done"
            placeholder={`New ${group.toLowerCase()}`}
            placeholderTextColor={theme.textSecondary}
            style={[styles.chip, styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add a ${group.toLowerCase()} tag`}
            onPress={() => setAdding(true)}
            style={[styles.chip, { borderColor: theme.backgroundSelected, borderWidth: 1 }]}>
            <ThemedText type="small" themeColor="textSecondary">
              + Add
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  groups: {
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  group: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  input: {
    minWidth: 120,
    fontSize: 14,
  },
});
