import { Platform } from 'react-native';

export const IS_WEB = Platform.OS === 'web';
export const WEB_WIDE_BREAKPOINT = 900;
export const WEB_DESKTOP_BREAKPOINT = 1120;
export const WEB_CONTENT_MAX_WIDTH = 1320;
export const WEB_CONTENT_NARROW_WIDTH = 1080;

export const getResponsiveLayout = (width) => {
    const isWebWide = IS_WEB && width >= WEB_WIDE_BREAKPOINT;
    const isWebDesktop = IS_WEB && width >= WEB_DESKTOP_BREAKPOINT;

    return {
        isWeb: IS_WEB,
        isWebWide,
        isWebDesktop,
        contentMaxWidth: isWebDesktop
            ? WEB_CONTENT_MAX_WIDTH
            : isWebWide
              ? WEB_CONTENT_NARROW_WIDTH
              : width,
    };
};

export const getFloatingTabMetrics = (viewportWidth) => {
    const horizontalInset = 24;
    const tabBarWidth = Math.min(Math.max(viewportWidth - horizontalInset * 2, 320), 720);

    return {
        tabBarWidth,
        tabBarLeft: Math.max((viewportWidth - tabBarWidth) / 2, horizontalInset),
    };
};
