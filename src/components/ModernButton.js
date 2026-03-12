import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/ThemeProvider';

const ModernButton = ({
    title,
    onPress,
    style,
    textStyle,
    disabled,
    variant = 'primary',
    multiline = false,
}) => {
    const { colors, radii, shadows } = useAppTheme();
    const styles = useMemo(
        () => createStyles(colors, radii),
        [colors, radii],
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
                        key={`${line}-${index}`}
                        numberOfLines={Array.isArray(title) ? 1 : multiline ? 3 : 1}
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

const createStyles = (colors, radii) =>
    StyleSheet.create({
        button: {
            minHeight: 84,
            paddingHorizontal: 16,
            paddingVertical: 14,
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
            gap: 3,
            alignItems: 'center',
            justifyContent: 'center',
        },
        text: {
            fontSize: 17,
            fontWeight: '700',
            lineHeight: 21,
            textAlign: 'center',
            flexShrink: 1,
        },
        secondaryLine: {
            fontSize: 14,
            lineHeight: 18,
            opacity: 0.88,
        },
    });

export default ModernButton;
