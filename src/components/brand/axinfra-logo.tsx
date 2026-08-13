import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

// Same asset as the web app's dark-mode logo (public/dark.png in the web
// repo) — the login/register screens there are always the dark "Obsidian"
// theme regardless of the logged-in user's theme preference, so this is the
// one logo variant the mobile auth screens need.
const LOGO = require('@/assets/images/brand/axinfra-logo-dark.png');
const NATIVE_ASPECT_RATIO = 949 / 263;

type LogoSize = 'sm' | 'md' | 'lg';

const HEIGHTS: Record<LogoSize, number> = {
  sm: 28,
  md: 40,
  lg: 52,
};

export function AxinfraLogo({ size = 'md' }: { size?: LogoSize }) {
  const height = HEIGHTS[size];
  return (
    <Image
      source={LOGO}
      style={[styles.image, { height, width: height * NATIVE_ASPECT_RATIO }]}
      contentFit="contain"
      accessibilityLabel="Axinfra"
    />
  );
}

const styles = StyleSheet.create({
  image: {
    alignSelf: 'center',
  },
});
