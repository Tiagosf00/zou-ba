import { Platform } from 'react-native';

const headingFont = Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'serif',
});

export const lightColors = {
    primary: '#C56C49',
    primaryStrong: '#A55335',
    primarySoft: '#F3D3C1',
    accent: '#2F7B73',
    accentSoft: '#DCEDE9',

    background: '#F6F0E7',
    backgroundMuted: '#EDE1D2',
    surface: '#FFF9F1',
    surfaceMuted: '#F4E8DA',

    text: '#2C241C',
    textSecondary: '#6F6256',
    textMuted: '#9B8D80',
    onPrimary: '#FFF8F3',

    success: '#3E7E68',
    successSoft: '#D9ECE4',
    error: '#B75D4E',
    errorSoft: '#F7DED9',

    border: '#DECDBC',
    borderStrong: '#CCB09A',
    shadow: '#7E624D',
    overlay: 'rgba(44, 33, 24, 0.22)',
};

export const darkColors = {
    primary: '#D38C67',
    primaryStrong: '#F0B493',
    primarySoft: '#4A2F24',
    accent: '#6DB8AC',
    accentSoft: '#1E3C3A',

    background: '#161210',
    backgroundMuted: '#1E1916',
    surface: '#221C18',
    surfaceMuted: '#2B2420',

    text: '#F6EFE6',
    textSecondary: '#C8B8A6',
    textMuted: '#8F7F71',
    onPrimary: '#1A130F',

    success: '#79C3A2',
    successSoft: '#1F3A31',
    error: '#E69484',
    errorSoft: '#472A24',

    border: '#3B312B',
    borderStrong: '#5A493E',
    shadow: '#000000',
    overlay: 'rgba(0, 0, 0, 0.42)',
};

export const radii = {
    sm: 14,
    md: 20,
    lg: 28,
    pill: 999,
};

export const spacing = {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
};

export const typography = {
    headingFont,
};

export const createShadows = (colors) => ({
    sm: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: colors.shadow === '#000000' ? 0.2 : 0.08,
        shadowRadius: 12,
        elevation: 2,
    },
    md: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: colors.shadow === '#000000' ? 0.24 : 0.12,
        shadowRadius: 18,
        elevation: 5,
    },
    lg: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: colors.shadow === '#000000' ? 0.3 : 0.16,
        shadowRadius: 28,
        elevation: 10,
    },
});

export const getTheme = (mode = 'light') => {
    const colors = mode === 'dark' ? darkColors : lightColors;

    return {
        mode,
        colors,
        radii,
        spacing,
        typography,
        shadows: createShadows(colors),
    };
};

export const colors = lightColors;
export const shadows = createShadows(lightColors);
