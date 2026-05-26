import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../theme/ThemeProvider';
import AudioButton from './AudioButton';

const AudioChoiceButton = ({
    actionLabel = 'Choose',
    choiceLabel,
    disabled = false,
    hanzi,
    isDesktop = false,
    onSelect,
    style,
    variant = 'secondary',
}) => {
    const { colors, radii, shadows, typography } = useAppTheme();
    const styles = useMemo(
        () => createStyles(colors, radii, shadows, typography),
        [colors, radii, shadows, typography],
    );
    const variants = useMemo(
        () => ({
            secondary: {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                textColor: colors.text,
                actionBackgroundColor: colors.surfaceMuted,
                actionTextColor: colors.textSecondary,
                icon: 'ellipse-outline',
            },
            success: {
                backgroundColor: colors.successSoft,
                borderColor: 'transparent',
                textColor: colors.success,
                actionBackgroundColor: colors.surface,
                actionTextColor: colors.success,
                icon: 'checkmark-circle',
            },
            danger: {
                backgroundColor: colors.errorSoft,
                borderColor: 'transparent',
                textColor: colors.error,
                actionBackgroundColor: colors.surface,
                actionTextColor: colors.error,
                icon: 'close-circle',
            },
        }),
        [colors],
    );
    const resolvedVariant = variants[variant] || variants.secondary;

    return (
        <View
            style={[
                styles.container,
                isDesktop && styles.containerDesktop,
                {
                    backgroundColor: resolvedVariant.backgroundColor,
                    borderColor: resolvedVariant.borderColor,
                },
                style,
            ]}
        >
            <View style={styles.audioCluster}>
                <AudioButton
                    hanzi={hanzi}
                    label={`Play ${choiceLabel} audio`}
                    size={isDesktop ? 'large' : 'small'}
                />
                <View style={styles.copy}>
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.choiceLabel,
                            isDesktop && styles.choiceLabelDesktop,
                            { color: resolvedVariant.textColor },
                        ]}
                    >
                        {choiceLabel}
                    </Text>
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.choiceHint,
                            isDesktop && styles.choiceHintDesktop,
                            { color: resolvedVariant.textColor },
                        ]}
                    >
                        Audio
                    </Text>
                </View>
            </View>

            <Pressable
                accessibilityLabel={`Select ${choiceLabel}`}
                accessibilityRole="button"
                disabled={disabled}
                onPress={onSelect}
                style={({ pressed }) => [
                    styles.action,
                    isDesktop && styles.actionDesktop,
                    {
                        backgroundColor: resolvedVariant.actionBackgroundColor,
                    },
                    pressed && !disabled && styles.actionPressed,
                    disabled && styles.actionDisabled,
                ]}
            >
                <Ionicons
                    color={resolvedVariant.actionTextColor}
                    name={resolvedVariant.icon}
                    size={isDesktop ? 18 : 16}
                />
                <Text
                    style={[
                        styles.actionLabel,
                        isDesktop && styles.actionLabelDesktop,
                        { color: resolvedVariant.actionTextColor },
                    ]}
                >
                    {actionLabel}
                </Text>
            </Pressable>
        </View>
    );
};

const createStyles = (colors, radii, shadows, typography) =>
    StyleSheet.create({
        container: {
            minHeight: 84,
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderRadius: radii.md,
            borderWidth: 1,
            justifyContent: 'space-between',
            gap: 10,
        },
        containerDesktop: {
            borderRadius: radii.lg,
            paddingHorizontal: 20,
            paddingVertical: 18,
        },
        audioCluster: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
        },
        copy: {
            minWidth: 0,
            gap: 1,
        },
        choiceLabel: {
            fontFamily: typography.studyFont,
            fontSize: 16,
            lineHeight: 21,
            fontWeight: '800',
        },
        choiceLabelDesktop: {
            fontSize: 22,
            lineHeight: 28,
        },
        choiceHint: {
            fontSize: 11,
            lineHeight: 14,
            fontWeight: '800',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            opacity: 0.78,
        },
        choiceHintDesktop: {
            fontSize: 12,
            lineHeight: 16,
        },
        action: {
            minHeight: 34,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: colors.border,
            ...shadows.sm,
        },
        actionDesktop: {
            minHeight: 40,
            paddingHorizontal: 14,
        },
        actionPressed: {
            transform: [{ scale: 0.985 }],
        },
        actionDisabled: {
            opacity: 0.9,
        },
        actionLabel: {
            fontSize: 12,
            lineHeight: 15,
            fontWeight: '800',
        },
        actionLabelDesktop: {
            fontSize: 14,
            lineHeight: 18,
        },
    });

export default AudioChoiceButton;
