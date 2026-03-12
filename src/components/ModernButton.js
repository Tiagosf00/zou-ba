import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/ThemeProvider';

const ModernButton = ({
    title,
    onPress,
    style,
    textStyle,
    disabled,
    variant = 'primary',
    multiline = false,
    fitText = false,
    minimumFontScale = 0.82,
}) => {
    const { colors, radii, shadows, typography } = useAppTheme();
    const styles = useMemo(
        () => createStyles(colors, radii, typography),
        [colors, radii, typography],
    );
    const variantStyles = useMemo(
        () => ({
            primary: {
                backgroundColor: colors.primary,
                borderColor: 'transparent',
                textColor: colors.onPrimary,
            },
            secondary: {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                textColor: colors.text,
            },
            success: {
                backgroundColor: colors.successSoft,
                borderColor: 'transparent',
                textColor: colors.success,
            },
            danger: {
                backgroundColor: colors.errorSoft,
                borderColor: 'transparent',
                textColor: colors.error,
            },
        }),
        [colors],
    );
    const resolvedVariant = variantStyles[variant] || variantStyles.primary;
    const lines = Array.isArray(title) ? title : [title];
    const resolvedNumberOfLines = Array.isArray(title) ? 1 : multiline ? 3 : 1;

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.button,
                {
                    backgroundColor: resolvedVariant.backgroundColor,
                    borderColor: resolvedVariant.borderColor,
                },
                variant === 'primary' && shadows.md,
                pressed && !disabled && styles.buttonPressed,
                disabled && styles.buttonDisabled,
                style,
            ]}
        >
            <View style={styles.content}>
                {lines.map((line, index) => (
                    <Text
                        adjustsFontSizeToFit={fitText && resolvedNumberOfLines === 1}
                        key={`${line}-${index}`}
                        minimumFontScale={
                            fitText && resolvedNumberOfLines === 1 ? minimumFontScale : undefined
                        }
                        numberOfLines={resolvedNumberOfLines}
                        style={[
                            styles.text,
                            { color: resolvedVariant.textColor },
                            index > 0 && styles.secondaryLine,
                            textStyle,
                        ]}
                    >
                        {line}
                    </Text>
                ))}
            </View>
        </Pressable>
    );
};

const createStyles = (colors, radii, typography) =>
    StyleSheet.create({
        button: {
            minHeight: 84,
            paddingHorizontal: 16,
            paddingVertical: 15,
            borderRadius: radii.md,
            borderWidth: 1,
            justifyContent: 'center',
        },
        buttonPressed: {
            transform: [{ scale: 0.985 }],
        },
        buttonDisabled: {
            opacity: 0.92,
        },
        content: {
            width: '100%',
            gap: 4,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: Platform.OS === 'web' ? 3 : 2,
        },
        text: {
            fontFamily: typography.studyFont,
            fontSize: 18,
            fontWeight: '700',
            lineHeight: 26,
            textAlign: 'center',
            flexShrink: 1,
            paddingTop: 1,
            paddingBottom: Platform.OS === 'web' ? 3 : 2,
        },
        secondaryLine: {
            fontSize: 15,
            lineHeight: 23,
            opacity: 0.88,
        },
    });

export default ModernButton;
