import { useThemeContext } from '@/providers/theme-provider';

export function useColorScheme() {
  return useThemeContext().colorScheme;
}
