import React, { createContext, useContext, useMemo } from 'react';

import { getTheme } from './colors';

const ThemeContext = createContext(getTheme());

export const ThemeProvider = ({ children, mode = 'light' }) => {
    const theme = useMemo(() => getTheme(mode), [mode]);

    return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = () => useContext(ThemeContext);
