import { useWindowDimensions } from 'react-native';

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isSmall = width < 380;
  const isTablet = width >= 768;
  const horizontalPadding = isSmall ? 14 : isTablet ? 28 : 18;
  const maxContentWidth = isTablet ? 720 : undefined;

  return {
    width,
    height,
    isSmall,
    isTablet,
    horizontalPadding,
    maxContentWidth,
  };
}
