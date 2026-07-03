import { Platform } from 'react-native';

/**
 * react-native-web's Modal keeps pointer-events disabled until the CSS
 * animation's animationend event fires. Browsers where animations are disabled
 * (prefers-reduced-motion forced, some embedded/headless browsers) never fire
 * it, leaving every modal visible but untouchable. 'none' skips the wait
 * entirely, so on web we always use it. Native keeps the requested animation.
 */
export function modalAnimation(type: 'slide' | 'fade'): 'slide' | 'fade' | 'none' {
  return Platform.OS === 'web' ? 'none' : type;
}
