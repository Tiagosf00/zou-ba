import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

import { useAppTheme } from '../theme/ThemeProvider';

const Card = ({ children, style, tone = 'default' }) => {
    const { colors, radii, shadows } = useAppTheme();
    const styles = useMemo(
        () => createStyles(colors, radii, shadows),
        [colors, radii, shadows],
    );
    const toneStyles = useMemo(
        () =>
            StyleSheet.create({
                default: {
                    backgroundColor: colors.surface,
                },
                muted: {
                    backgroundColor: colors.surfaceMuted,
                },
                accent: {
                    backgroundColor: colors.accentSoft,
                    borderColor: 'transparent',
                },
            }),
        [colors],
    );

    return <View style={[styles.card, toneStyles[tone], style]}>{children}</View>;
};

const createStyles = (colors, radii, shadows) =>
    StyleSheet.create({
        card: {
            borderRadius: radii.lg,
            padding: 22,
            ...shadows.md,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
        },
    });

export default Card;
