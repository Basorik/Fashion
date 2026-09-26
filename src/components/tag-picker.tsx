import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { TagGroupNames, TagGroups, type Tag, type TagGroup } from '@/constants/tags';
import { Radius, Spacing } from '@/constants/theme';
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
        : [...value, { group, value: tagValue }],
    );
  }

  // Runs once on blur (submitting blurs the field). Typing a preset in another case picks the preset.
  function addCustom() {
    const typed = draft.trim();
    const tagValue =
      options.find((option) => option.toLowerCase() === typed.toLowerCase()) ?? typed;
    if (tagValue && !selected.some((tag) => tag.toLowerCase() === tagValue.toLowerCase())) {
      onChange([...value, { group, value: tagValue }]);
    }
    setDraft('');
    setAdding(false);
  }

  return (
    <View style={styles.group}>
      <ThemedText type="caption" themeColor="textSecondary">
        {group}
      </ThemedText>
      <View style={styles.chips}>
        {options.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={selected.includes(option)}
            onPress={() => toggle(option)}
            accessibilityRole="checkbox"
            accessibilityLabel={`${group}: ${option}`}
          />
        ))}
        {adding ? (
          <TextField
            autoFocus
            value={draft}
            onChangeText={setDraft}
            onBlur={addCustom}
            returnKeyType="done"
            placeholder={`New ${group.toLowerCase()}`}
            style={styles.input}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add a ${group.toLowerCase()} tag`}
            onPress={() => setAdding(true)}
            hitSlop={4}
            style={[styles.addChip, { borderColor: theme.border }]}>
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
  addChip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 1,
  },
  input: {
    minWidth: 140,
    minHeight: 32,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.one,
    fontSize: 14,
  },
});
