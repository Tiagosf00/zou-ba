import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../theme/ThemeProvider';
import { getWordExamples } from '../utils/wordExamples';
import { getListeningAudioUrl } from '../utils/listeningPractice';
import { claimWebAudio, releaseWebAudio, stopWebAudio } from '../utils/audio';

const ExampleContent = ({ item }) => {
    const { colors, typography } = useAppTheme();
    const isFocused = useIsFocused();
    const examples = useMemo(() => getWordExamples(item), [item]);
    const [index, setIndex] = useState(0);
    const [playState, setPlayState] = useState('idle');
    const audioRef = useRef(null);
    const example = examples[index % (examples.length || 1)];
    const sentence = example?.chinese;
    const target = item?.hanzi;
    const canPlay = Platform.OS === 'web' && Boolean(example?.audioNormal);

    const stop = () => {
        const audio = audioRef.current;
        audioRef.current = null;
        if (audio) {
            audio.onended = null;
            audio.onpause = null;
            audio.onerror = null;
            stopWebAudio(audio);
            audio.removeAttribute('src');
            audio.load();
        }
    };

    useEffect(() => {
        setPlayState('idle');
        return stop;
    }, [example?.id, isFocused]);

    const play = async () => {
        if (!isFocused || typeof window === 'undefined' || !window.Audio) return;
        stop();
        const url = getListeningAudioUrl(example.audioNormal);
        if (!url) return;
        const audio = new window.Audio(url);
        audioRef.current = audio;
        setPlayState('loading');
        audio.onended = () => {
            releaseWebAudio(audio);
            if (audioRef.current === audio) setPlayState('idle');
        };
        audio.onpause = () => {
            if (audioRef.current === audio) setPlayState('idle');
        };
        audio.onerror = () => {
            releaseWebAudio(audio);
            if (audioRef.current === audio) setPlayState('error');
        };
        claimWebAudio(audio);
        try {
            await audio.play();
            if (audioRef.current === audio && !audio.paused) setPlayState('playing');
        } catch {
            releaseWebAudio(audio);
            if (audioRef.current === audio) setPlayState('error');
        }
    };

    if (!sentence || !target) {
        return null;
    }

    const parts = sentence.split(target);
    const pinyin = example.pinyin;
    const translation = example.translation;

    return (
        <View style={styles.container}>
            <View style={styles.controls}>
                <Text style={[styles.label, { color: colors.accent }]}>Example</Text>
                {canPlay ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Play example sentence"
                        disabled={playState === 'loading'} onPress={play}
                        style={styles.control}>
                        <Ionicons name={playState === 'loading' ? 'hourglass-outline' : 'volume-high-outline'}
                            size={18} color={colors.primaryStrong} />
                        <Text style={{ color: colors.primaryStrong }}>
                            {playState === 'playing' ? 'Replay sentence' : 'Play sentence'}
                        </Text>
                    </Pressable>
                ) : null}
            </View>
            <Text style={[styles.sentence, { color: colors.text, fontFamily: typography.headingFont }]}>
                {parts.map((part, index) => (
                    <React.Fragment key={`${item.id}-${index}`}>
                        {part}
                        {index < parts.length - 1 ? (
                            <Text style={[styles.target, { color: colors.primaryStrong }]}>
                                {target}
                            </Text>
                        ) : null}
                    </React.Fragment>
                ))}
            </Text>
            {pinyin ? <Text style={[styles.pinyin, { color: colors.textSecondary }]}>{pinyin}</Text> : null}
            {translation ? (
                <Text style={[styles.translation, { color: colors.textSecondary }]}>
                    {translation}
                </Text>
            ) : null}
            {playState === 'error' ? (
                <Text accessibilityRole="alert" style={{ color: colors.error }}>
                    Could not play this sentence. Tap Play sentence to retry.
                </Text>
            ) : null}
            {examples.length > 1 ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Another example"
                    onPress={() => { stop(); setPlayState('idle'); setIndex((value) => (value + 1) % examples.length); }}
                    style={styles.control}>
                    <Text style={{ color: colors.primaryStrong }}>Another example</Text>
                    <Text style={{ color: colors.textSecondary }}>{index + 1}/{examples.length}</Text>
                </Pressable>
            ) : null}
            {example.audioNormal ? (
                <Pressable accessibilityRole="link" accessibilityLabel="Example source: NewHSK3 Anki deck"
                    onPress={() => Linking.openURL('https://ankiweb.net/shared/info/258311532')}
                    style={styles.source}>
                    <Text style={[styles.credit, { color: colors.textSecondary }]}>
                        Sentences & AI audio: NewHSK3 ↗
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
    },
    control: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        minHeight: 40,
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    source: { alignSelf: 'flex-start', paddingVertical: 6 },
    credit: { fontSize: 11 },
    container: {
        gap: 3,
        marginTop: 12,
    },
    label: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    sentence: {
        fontSize: 17,
        lineHeight: 24,
    },
    target: {
        fontWeight: '900',
    },
    pinyin: {
        fontSize: 12,
        lineHeight: 17,
    },
    translation: {
        fontSize: 13,
        lineHeight: 19,
    },
});

const ExampleSentence = ({ item }) => (
    <ExampleContent key={`${item?.id}-${item?.hanzi}-${item?.pinyin}`} item={item} />
);

export default ExampleSentence;
