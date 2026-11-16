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
 primary: '#9AC9BB', primaryStrong: '#9AC9BB', primarySoft: '#2B3E39', accent: '#93C5AD', accentSoft: '#273B32',
 background: '#171C1E', backgroundMuted: '#2A3335', surface: '#202628', surfaceMuted: '#1A2022',
 text: '#E8EDEB', textSecondary: '#B2BEB9', textMuted: '#A1ADA9', onPrimary: '#172521',
 success: '#93C5AD', successSoft: '#273B32', error: '#DDBA7B', errorSoft: '#3B3426',
 border: '#354043', borderStrong: '#53625F', shadow: '#000000', overlay: 'rgba(0,0,0,0.5)', skyline: '#729B8D',
};
export const radii = { sm: 6, md: 8, lg: 10, pill: 999 };
export const spacing = { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 };
export const typography = { headingFont: uiFont, uiFont, studyFont, brandFont: 'Georgia' };
export const createShadows = () => ({ sm: {}, md: {}, lg: {} });
export const getTheme = (mode = 'light') => {
 const colors = mode === 'dark' ? darkColors : lightColors;
 return { mode, colors, radii, spacing, typography, shadows: createShadows(colors) };
};
export const colors = lightColors;
export const shadows = createShadows(lightColors);
