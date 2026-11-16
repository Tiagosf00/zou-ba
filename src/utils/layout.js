import { Platform } from 'react-native';

export const IS_WEB = Platform.OS === 'web';
export const WEB_WIDE_BREAKPOINT = 900;
export const WEB_DESKTOP_BREAKPOINT = 1120;
export const SIDEBAR_WIDTH = 208;
export const WEB_CONTENT_MAX_WIDTH = 1200;
export const WEB_CONTENT_NARROW_WIDTH = 1000;

export const getResponsiveLayout = (width) => {
    const isWebWide = IS_WEB && width >= WEB_WIDE_BREAKPOINT;
    const isWebDesktop = IS_WEB && width >= WEB_DESKTOP_BREAKPOINT;
    const desktopContentWidth = Math.min(
        Math.max(width - SIDEBAR_WIDTH - 64, 0),
        WEB_CONTENT_MAX_WIDTH,
    );
    const wideContentWidth = Math.min(
        Math.max(width - SIDEBAR_WIDTH - 48, 0),
        WEB_CONTENT_NARROW_WIDTH,
    );

    return {
        isWeb: IS_WEB,
        isWebWide,
        isWebDesktop,
        backgroundScale: IS_WEB ? Math.min(Math.max(width / 1440, 1), 1.55) : 1,
        contentMaxWidth: isWebDesktop
            ? desktopContentWidth
            : isWebWide
              ? wideContentWidth
              : width,
    };
};

export const getFloatingTabMetrics = (viewportWidth) => {
    const horizontalInset = 24;
    const tabBarWidth = Math.min(Math.max(viewportWidth - horizontalInset * 2, 360), 940);

    return {
        tabBarWidth,
        tabBarLeft: Math.max((viewportWidth - tabBarWidth) / 2, horizontalInset),
    };
};
