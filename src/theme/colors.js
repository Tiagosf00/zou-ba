import { Platform } from 'react-native';
const uiFont = Platform.select({ ios: 'System', android: 'sans-serif', default: '"Segoe UI", "Helvetica Neue", Arial, sans-serif' });
const studyFont = Platform.select({ ios: 'PingFang SC', android: 'sans-serif', default: '"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif' });
export const lightColors = {
 primary: '#AD4936', primaryStrong: '#AD4936', primarySoft: '#F3E7E0', accent: '#427963', accentSoft: '#E9F1EB',
 background: '#F5F3EF', backgroundMuted: '#F0EFEA', surface: '#FFFEFA', surfaceMuted: '#FAF9F6',
 text: '#2D3031', textSecondary: '#626965', textMuted: '#727674', onPrimary: '#FFFAF6',
 success: '#427963', successSoft: '#E9F1EB', error: '#A44C3A', errorSoft: '#F7EAE3',
 border: '#DEDFD9', borderStrong: '#BBBFB7', shadow: '#555A55', overlay: 'rgba(29,34,31,0.3)', skyline: '#B98A70',
};
export const darkColors = {
 primary: '#79C5AF', primaryStrong: '#93D4C1', primarySoft: '#292929', accent: '#95B4CF', accentSoft: '#252525',
 background: '#141414', backgroundMuted: '#2A2A2A', surface: '#202020', surfaceMuted: '#191919',
 text: '#F1EDE5', textSecondary: '#BDC5CF', textMuted: '#A0ADBD', onPrimary: '#142A23',
 success: '#8BCBA5', successSoft: '#252525', error: '#DFB07D', errorSoft: '#2B2B2B',
 border: '#383838', borderStrong: '#555555', shadow: '#000000', overlay: 'rgba(0,0,0,0.6)', skyline: '#7C9BA7',
};
export const radii = { sm: 8, md: 12, lg: 14, pill: 999 };
export const spacing = { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 };
export const typography = { headingFont: uiFont, uiFont, studyFont, brandFont: 'Georgia' };
export const createShadows = () => ({ sm: {}, md: {}, lg: {} });
export const getTheme = (mode = 'light') => {
 const colors = mode === 'dark' ? darkColors : lightColors;
 return { mode, colors, radii, spacing, typography, shadows: createShadows(colors) };
};
export const colors = lightColors;
export const shadows = createShadows(lightColors);
