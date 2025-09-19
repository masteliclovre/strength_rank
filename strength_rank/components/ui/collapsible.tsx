// components/ui/collapsible.tsx
import React, { useMemo, useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';

type CollapsibleProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

export default function Collapsible({ title, children, defaultOpen = false }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const rot = useSharedValue(defaultOpen ? 90 : 0);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    rot.value = withTiming(next ? 90 : 0, { duration: 150 });
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={toggle} style={styles.header}>
        <Animated.View style={chevronStyle}>
          {/* ⬇️ removed weight="medium" */}
          <IconSymbol name="chevron.right" size={16} color="#666" />
        </Animated.View>
        <ThemedText type="defaultSemiBold" style={styles.title}>{title}</ThemedText>
      </Pressable>

      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 12, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: { flex: 1 },
  body: { paddingHorizontal: 12, paddingBottom: 10 },
});
