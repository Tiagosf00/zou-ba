import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../theme/ThemeProvider';
import { getWordExamples } from '../utils/wordExamples';
import { getListeningAudioUrl } from '../utils/listeningPractice';
import { claimWebAudio, releaseWebAudio, stopWebAudio } from '../utils/audio';

const ExampleContent = ({ item }) => {
    const { colors, typography } = useAppTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 768;
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
        <View testID="word-example-card" style={[
            styles.container,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong },
            isWide && styles.containerWide,
        ]}>
            <View style={styles.header}>
                <View style={styles.heading}>
                    <Text style={[styles.label, { color: colors.text }]}>Examples</Text>
                    <View style={[styles.counter, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.counterText, { color: colors.textSecondary }]}>
                            {index + 1}/{examples.length}
                        </Text>
                    </View>
                </View>
                <View style={styles.controls}>
                    {canPlay ? (
                        <Pressable accessibilityRole="button" accessibilityLabel="Play example sentence"
                            disabled={playState === 'loading'} onPress={play}
                            style={({ pressed, hovered }) => [
                                styles.control,
                                {
                                    backgroundColor: playState === 'playing' ? colors.primaryStrong : colors.surface,
                                    borderColor: playState === 'playing' ? colors.primaryStrong : colors.borderStrong,
                                },
                                (pressed || hovered) && styles.interacting,
                                playState === 'loading' && styles.loading,
                            ]}>
                            <Ionicons name={playState === 'loading' ? 'hourglass-outline' : 'volume-high-outline'}
                                size={21} color={playState === 'playing' ? colors.onPrimary : colors.primaryStrong} />
                        </Pressable>
                    ) : null}
                    {examples.length > 1 ? (
                        <Pressable accessibilityRole="button" accessibilityLabel="Another example"
                            onPress={() => { stop(); setPlayState('idle'); setIndex((value) => (value + 1) % examples.length); }}
                            style={({ pressed, hovered }) => [
                                styles.control,
                                { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                                (pressed || hovered) && styles.interacting,
                            ]}>
                            <Ionicons name="arrow-forward" size={21} color={colors.primaryStrong} />
                        </Pressable>
                    ) : null}
                </View>
            </View>
            <Text selectable testID="word-example-chinese" style={[
                styles.sentence, isWide && styles.sentenceWide,
                { color: colors.text, fontFamily: typography.studyFont },
            ]}>
                {parts.map((part, index) => (
                    <React.Fragment key={`${item.id}-${index}`}>
                        {part}
                        {index < parts.length - 1 ? (
                            <Text style={[styles.target, { color: colors.primaryStrong, backgroundColor: colors.primarySoft }]}>
                                {target}
                            </Text>
                        ) : null}
                    </React.Fragment>
                ))}
            </Text>
            {pinyin ? <Text selectable style={[styles.pinyin, { color: colors.textSecondary }]}>{pinyin}</Text> : null}
            {translation ? (
                <View style={[styles.translationBlock, { borderTopColor: colors.border }]}>
                    <Text selectable style={[styles.translation, { color: colors.text }]}>
                        {translation}
                    </Text>
                </View>
            ) : null}
            {playState === 'error' ? (
                <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>
                    Could not play this sentence. Tap the speaker to retry.
                </Text>
            ) : null}
            {example.audioNormal ? (
                <Pressable accessibilityRole="link" accessibilityLabel="Example source: NewHSK3 Anki deck"
                    onPress={() => Linking.openURL('https://ankiweb.net/shared/info/258311532')}
                    style={styles.source}>
                    <Text style={[styles.credit, { color: colors.textSecondary }]}>
                        Source: NewHSK3 · AI audio ↗
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 18,
        padding: 18,
        borderWidth: 1,
        borderRadius: 20,
        gap: 12,
        minWidth: 0,
    },
    containerWide: { padding: 24, gap: 14 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 4,
    },
    heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    counter: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20 },
    counterText: { fontSize: 13, fontWeight: '600', lineHeight: 20 },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    control: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        flexShrink: 0,
    },
    interacting: { opacity: 0.84 },
    loading: { opacity: 0.7 },
    source: { alignSelf: 'flex-start', paddingVertical: 4 },
    credit: { fontSize: 12, lineHeight: 18 },
    label: {
        fontSize: 16,
        fontWeight: '700',
    },
    sentence: {
        fontSize: 26,
        lineHeight: 42,
        fontWeight: '500',
    },
    sentenceWide: { fontSize: 30, lineHeight: 46 },
    target: {
        fontWeight: '900',
    },
    pinyin: {
        fontSize: 17,
        lineHeight: 28,
    },
    translationBlock: { borderTopWidth: 1, paddingTop: 14, marginTop: 2 },
    translation: {
        fontSize: 17,
        lineHeight: 27,
    },
    error: { fontSize: 14, lineHeight: 22 },
});

const ExampleSentence = ({ item }) => (
    <ExampleContent key={`${item?.id}-${item?.hanzi}-${item?.pinyin}`} item={item} />
);

export default ExampleSentence;
