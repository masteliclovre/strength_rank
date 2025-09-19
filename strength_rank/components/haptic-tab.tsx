// components/haptic-tab.tsx
import * as React from 'react';
import { PlatformPressable } from '@react-navigation/elements';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';

export function HapticTab({ onPressIn, style, ...rest }: BottomTabBarButtonProps) {
  const handlePressIn = React.useCallback<NonNullable<BottomTabBarButtonProps['onPressIn']>>(
    (event) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onPressIn?.(event);
    },
    [onPressIn],
  );

  return <PlatformPressable {...rest} style={style} onPressIn={handlePressIn} />;
}
