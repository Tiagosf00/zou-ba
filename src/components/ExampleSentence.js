import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../theme/ThemeProvider';
import { getWordExamples } from '../utils/wordExamples';
import { getListeningAudioUrl } from '../utils/listeningPractice';
import { claimWebAudio, releaseWebAudio, stopWebAudio } from '../utils/audio';

const ExampleContent = ({ item, showSource }) => {
    const { colors, typography } = useAppTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 768;
    const isFocused = useIsFocused();
    const examples = useMemo(() => getWordExamples(item), [item]);
    const [index, setIndex] = useState(0);
    const [playState, setPlayState] = useState('idle');
    const [showPinyin, setShowPinyin] = useState(false);
    const [showEnglish, setShowEnglish] = useState(false);
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
        setShowPinyin(false);
        setShowEnglish(false);
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
        <View testID="word-example-card" accessibilityLabel="Example sentence" style={styles.container}>
            <Text selectable testID="word-example-chinese" style={[
                styles.sentence, isWide && styles.sentenceWide,
                { color: colors.text, fontFamily: typography.studyFont },
            ]}>
                {parts.map((part, index) => (
                    <React.Fragment key={`${item.id}-${index}`}>
                        {part}
                        {index < parts.length - 1 ? (
                            <Text testID="word-example-highlight" style={[styles.target, { color: colors.primaryStrong }]}>{target}</Text>
                        ) : null}
                    </React.Fragment>
                ))}
            </Text>
            {pinyin && showPinyin ? <Text selectable testID="word-example-pinyin" style={[styles.pinyin, { color: colors.textSecondary }]}>{pinyin}</Text> : null}
            {translation && showEnglish ? <Text selectable testID="word-example-english" style={[styles.translation, { color: colors.textSecondary }]}>{translation}</Text> : null}
            <View testID="example-controls" style={styles.controls}>
                <View style={styles.readingControls}>
                    {canPlay ? <Pressable accessibilityRole="button" accessibilityLabel="Play example sentence"
                        disabled={playState === 'loading'} onPress={play}
                        style={({ pressed, hovered }) => [styles.quietControl, (pressed || hovered) && styles.interacting]}>
                        <Ionicons name={playState === 'loading' ? 'hourglass-outline' : 'volume-high-outline'} size={18}
                            color={playState === 'playing' ? colors.primaryStrong : colors.textMuted} />
                        <Text style={[styles.controlText, { color: playState === 'playing' ? colors.primaryStrong : colors.textSecondary }]}>Listen</Text>
                    </Pressable> : null}
                    {pinyin ? <Pressable accessibilityRole="button" accessibilityLabel={showPinyin ? 'Hide example pinyin' : 'Show example pinyin'}
                        accessibilityState={{ expanded: showPinyin }} onPress={() => setShowPinyin(value => !value)}
                        style={({ pressed, hovered }) => [styles.quietControl, (pressed || hovered) && styles.interacting]}>
                        <Text style={[styles.controlText, showPinyin && styles.activeControl, { color: showPinyin ? colors.primaryStrong : colors.textSecondary }]}>Pinyin</Text>
                    </Pressable> : null}
                    {translation ? <Pressable accessibilityRole="button" accessibilityLabel={showEnglish ? 'Hide example English' : 'Show example English'}
                        accessibilityState={{ expanded: showEnglish }} onPress={() => setShowEnglish(value => !value)}
                        style={({ pressed, hovered }) => [styles.quietControl, (pressed || hovered) && styles.interacting]}>
                        <Text style={[styles.controlText, showEnglish && styles.activeControl, { color: showEnglish ? colors.primaryStrong : colors.textSecondary }]}>English</Text>
                    </Pressable> : null}
                </View>
                {examples.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel="Another example"
                    onPress={() => { stop(); setPlayState('idle'); setIndex(value => (value + 1) % examples.length); }}
                    style={({ pressed, hovered }) => [styles.quietControl, styles.nextExample, (pressed || hovered) && styles.interacting]}>
                    <Text style={[styles.counter, { color: colors.textMuted }]}>{index + 1} / {examples.length}</Text>
                    <Ionicons name="arrow-forward" size={17} color={colors.textSecondary} />
                </Pressable> : null}
            </View>
            {playState === 'error' ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>
                Could not play this sentence. Tap Listen to retry.
            </Text> : null}
            {showSource ? <ExampleSource item={item} /> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { gap: 10, minWidth: 0 },
    sentence: { fontSize: 32, lineHeight: 52, fontWeight: '400', paddingBottom: 3 },
    sentenceWide: { fontSize: 42, lineHeight: 66 },
    target: {
        fontWeight: '400', textDecorationLine: 'underline',
        ...Platform.select({ web: { textUnderlineOffset: '0.18em', textDecorationThickness: '1.5px', textDecorationSkipInk: 'none' } }),
    },
    pinyin: { fontSize: 18, lineHeight: 29 },
    translation: { fontSize: 17, lineHeight: 28 },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
    readingControls: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
    quietControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, minWidth: 44, borderRadius: 4 },
    controlText: { fontSize: 13, lineHeight: 22 },
    activeControl: { textDecorationLine: 'underline', ...Platform.select({ web: { textUnderlineOffset: '4px' } }) },
    counter: { fontSize: 12, lineHeight: 20 },
    nextExample: { marginLeft: 'auto', gap: 10 },
    interacting: { opacity: 0.7 },
    error: { fontSize: 14, lineHeight: 22 },
    source: { alignSelf: 'flex-start', paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
    credit: { fontSize: 11, lineHeight: 18 },
});

export const ExampleSource = ({ item, style }) => {
    const { colors } = useAppTheme();
    const hasSourceAudio = useMemo(() => getWordExamples(item).some(example => example.audioNormal), [item]);
    if (!hasSourceAudio) return null;
    return <Pressable testID="example-source" accessibilityRole="link" accessibilityLabel="Example source: NewHSK3 Anki deck"
        onPress={() => Linking.openURL('https://ankiweb.net/shared/info/258311532')} style={[styles.source, style]}>
        <Text style={[styles.credit, { color: colors.textMuted }]}>Source: NewHSK3 · AI audio ↗</Text>
    </Pressable>;
};

const ExampleSentence = ({ item, showSource = true }) => (
    <ExampleContent key={`${item?.id}-${item?.hanzi}-${item?.pinyin}`} item={item} showSource={showSource} />
);
export default ExampleSentence;
