import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/ThemeProvider';
import AudioButton from './AudioButton';

const AudioPrompt = ({ compact = false, hanzi, label }) => {
    const { colors, typography } = useAppTheme();
    const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);

    return (
        <View style={[styles.container, compact && styles.containerCompact]}>
            <AudioButton
                hanzi={hanzi}
                label={label || 'Play audio prompt'}
                size="hero"
            />
            <Text style={[styles.label, compact && styles.labelCompact]}>Audio prompt</Text>
        </View>
    );
};

const createStyles = (colors, typography) =>
    StyleSheet.create({
        container: {
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            paddingVertical: 12,
        },
        containerCompact: {
            gap: 8,
            paddingVertical: 6,
        },
        label: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 24,
            lineHeight: 29,
            textAlign: 'center',
        },
        labelCompact: {
            fontSize: 20,
            lineHeight: 24,
        },
    });

export default AudioPrompt;
