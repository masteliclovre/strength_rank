// components/haptic-tab.tsx
import * as React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';

type TabBtnProps = {
  children?: React.ReactNode;
  style?: PressableProps['style'];
  onPress?: () => void;
  onLongPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  accessibilityRole?: PressableProps['accessibilityRole'];
  testID?: string;
  hitSlop?: PressableProps['hitSlop'];
};

export function HapticTab({
  children,
  style,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  accessibilityRole = 'button',
  testID,
  hitSlop,
}: TabBtnProps) {
  const handlePressIn = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPressIn?.();
  }, [onPressIn]);

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      testID={testID}
      hitSlop={hitSlop}
      style={style}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={onPressOut}
    >
      {children}
    </Pressable>
  );
}
