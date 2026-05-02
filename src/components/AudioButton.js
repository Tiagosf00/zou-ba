import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppState } from '../context/AppStateContext';
import { useAppTheme } from '../theme/ThemeProvider';

const AUDIO_ACCESS_USERNAME = 'tiagodfs';

export const canUseHskAudio = (auth) => {
    const username = auth?.session?.user?.username;

    return typeof username === 'string' && username.toLowerCase() === AUDIO_ACCESS_USERNAME;
};

const AudioButton = ({ hanzi, label, size = 'small', style }) => {
    const { auth } = useAppState();
    const { colors, radii } = useAppTheme();
    const timeoutRef = useRef(null);
    const [playState, setPlayState] = useState('idle');
    const styles = useMemo(() => createStyles(colors, radii), [colors, radii]);
    const hasAudioAccess = canUseHskAudio(auth);
    const isLarge = size === 'large';
    const isBusy = playState === 'loading';
    const isPlaying = playState === 'playing';
    const iconName = isBusy ? 'hourglass-outline' : isPlaying ? 'volume-high' : 'volume-medium';

    useEffect(
        () => () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        },
        [],
    );

    if (!hasAudioAccess) {
        return null;
    }

    const resetSoon = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setPlayState('idle');
        }, 1200);
    };

    const handlePress = async () => {
        if (!hanzi || isBusy) {
            return;
        }

        setPlayState('loading');

        try {
            const { playHskAudio } = await import('../utils/audio');
            const audio = await playHskAudio(hanzi);

            if (!audio) {
                setPlayState('idle');
                return;
            }

            setPlayState('playing');
            audio.addEventListener('ended', () => setPlayState('idle'), { once: true });
            audio.addEventListener('pause', () => setPlayState('idle'), { once: true });
            audio.addEventListener('error', () => resetSoon(), { once: true });
        } catch {
            resetSoon();
        }
    };

    return (
        <Pressable
            accessibilityLabel={label || `Play ${hanzi} audio`}
            accessibilityRole="button"
            disabled={!hanzi}
            onPress={handlePress}
            style={({ pressed }) => [
                styles.button,
                isLarge ? styles.buttonLarge : styles.buttonSmall,
                isPlaying && styles.buttonPlaying,
                pressed && styles.buttonPressed,
                !hanzi && styles.buttonDisabled,
                style,
            ]}
        >
            <Ionicons
                color={isPlaying ? colors.onPrimary : colors.primaryStrong}
                name={iconName}
                size={isLarge ? 19 : 15}
            />
        </Pressable>
    );
};

const createStyles = (colors, radii) =>
    StyleSheet.create({
        button: {
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        buttonSmall: {
            width: 30,
            height: 30,
        },
        buttonLarge: {
            width: 38,
            height: 38,
        },
        buttonPlaying: {
            borderColor: colors.primaryStrong,
            backgroundColor: colors.primaryStrong,
        },
        buttonPressed: {
            opacity: 0.74,
        },
        buttonDisabled: {
            opacity: 0.4,
        },
    });

export default AudioButton;
