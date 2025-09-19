// Fallback icon component that always renders MaterialIcons,
// while letting you pass SF-style names in code.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import type { OpaqueColorValue, StyleProp, TextStyle } from 'react-native';

type IconSymbolName = string;

type Props = {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
};

type MaterialName = ComponentProps<typeof MaterialIcons>['name'];

// Map your SF-style names → MaterialIcons names you actually want to show.
const MAPPING: Record<string, MaterialName> = {
  'house.fill': 'home',
  'trophy.fill': 'emoji-events',
  'add.fill': 'add-circle',
  'profile.fill': 'person',
  'paperplane.fill': 'send',
  'chevron.right': 'chevron-right',
  'chevron.left.forwardslash.chevron.right': 'code',
};

export function IconSymbol({ name, size = 24, color, style }: Props) {
  const material = (MAPPING[name] ?? (name as MaterialName)) || ('help-outline' as const);
  const isValid = (MaterialIcons.glyphMap as any)[material] != null;
  const safeName: MaterialName = isValid ? material : ('help-outline' as const);
  return <MaterialIcons name={safeName} size={size} color={color} style={style} />;
}
