import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import sentenceDeck from '../../assets/hsk_sentences_audio.json';
import BackdropOrbs from '../components/BackdropOrbs';
import Card from '../components/Card';
import { useAppState } from '../context/AppStateContext';
import { useAppTheme } from '../theme/ThemeProvider';
import { claimWebAudio, releaseWebAudio, stopWebAudio } from '../utils/audio';
import { getResponsiveLayout } from '../utils/layout';
import {
    getListeningAudioUrls,
    isListeningAnswerCorrect,
    pickNextListeningSentence,
} from '../utils/listeningPractice';

const LEVELS = [1, 2, 3, 4, 5, 6];
const RECENT_CARD_LIMIT = 8;

const titleCase = (value) =>
    value
        ? value
              .split('_')
              .filter(Boolean)
              .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
              .join(' ')
        : 'General';

const ListeningScreen = () => {
    const { settings } = useAppState();
    const { width } = useWindowDimensions();
    const { isWebDesktop, isWebWide, contentMaxWidth } = getResponsiveLayout(width);
    const { colors, radii, shadows, typography } = useAppTheme();
    const styles = useMemo(
        () =>
            createStyles(colors, radii, shadows, typography, {
                isWebDesktop,
                isWebWide,
                contentMaxWidth,
            }),
        [colors, contentMaxWidth, isWebDesktop, isWebWide, radii, shadows, typography],
    );
    const [selectedLevels, setSelectedLevels] = useState(() =>
        settings.hskLevels?.length ? [...settings.hskLevels] : LEVELS,
    );
    const [sentence, setSentence] = useState(null);
    const [answer, setAnswer] = useState('');
    const [result, setResult] = useState(null);
    const [audioState, setAudioState] = useState({ kind: 'idle', mode: null });
    const [session, setSession] = useState({ attempts: 0, correct: 0, streak: 0 });
    const audioRef = useRef(null);
    const recentIdsRef = useRef([]);
    const answerInputRef = useRef(null);

    const filteredSentences = useMemo(() => {
        const levelSet = new Set(selectedLevels);
        return sentenceDeck.sentences.filter((item) => levelSet.has(item.level));
    }, [selectedLevels]);
    const filterKey = selectedLevels.join('-');
    const accuracy = session.attempts
        ? Math.round((session.correct / session.attempts) * 100)
        : 0;

    const clearAudio = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.onended = null;
            audio.onerror = null;
            stopWebAudio(audio, { reset: true });
            audioRef.current = null;
        }
        setAudioState({ kind: 'idle', mode: null });
    }, []);

    const loadNextSentence = useCallback(() => {
        clearAudio();
        const nextSentence = pickNextListeningSentence(
            filteredSentences,
            recentIdsRef.current,
        );
        if (nextSentence) {
            recentIdsRef.current = [
                nextSentence.id,
                ...recentIdsRef.current.filter((id) => id !== nextSentence.id),
            ].slice(0, RECENT_CARD_LIMIT);
        }
        setSentence(nextSentence);
        setAnswer('');
        setResult(null);
        setTimeout(() => answerInputRef.current?.focus(), 80);
    }, [clearAudio, filteredSentences]);

    useEffect(() => {
        recentIdsRef.current = [];
        loadNextSentence();
    }, [filterKey]);

    useEffect(() => () => clearAudio(), [clearAudio]);

    const toggleLevel = (level) => {
        setSelectedLevels((currentLevels) => {
            if (currentLevels.includes(level)) {
                return currentLevels.length === 1
                    ? currentLevels
                    : currentLevels.filter((currentLevel) => currentLevel !== level);
            }
            return [...currentLevels, level].sort((left, right) => left - right);
        });
    };

    const playAudio = async (mode) => {
        if (!sentence) {
            return;
        }
        if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.Audio) {
            setAudioState({ kind: 'error', mode });
            return;
        }

        clearAudio();
        const audioPath = mode === 'slow' ? sentence.audioSlow : sentence.audioNormal;
        const audioUrls = getListeningAudioUrls(audioPath);
        if (audioUrls.length === 0) {
            setAudioState({ kind: 'error', mode });
            return;
        }

        setAudioState({ kind: 'loading', mode });

        for (const audioUrl of audioUrls) {
            const audio = new window.Audio(audioUrl);
            audio.preload = 'auto';
            audioRef.current = audio;
            audio.onended = () => {
                if (audioRef.current === audio) {
                    releaseWebAudio(audio);
                    audioRef.current = null;
                    setAudioState({ kind: 'idle', mode: null });
                }
            };
            claimWebAudio(audio);

            try {
                await audio.play();
                if (audioRef.current === audio) {
                    audio.onerror = () => {
                        if (audioRef.current === audio) {
                            releaseWebAudio(audio);
                            audioRef.current = null;
                            setAudioState({ kind: 'error', mode });
                        }
                    };
                    setAudioState({ kind: 'playing', mode });
                }
                return;
            } catch {
                audio.onended = null;
                audio.onerror = null;
                stopWebAudio(audio, { reset: true });
                if (audioRef.current === audio) {
                    audioRef.current = null;
                }
            }
        }

        setAudioState({ kind: 'error', mode });
    };

    const submitAnswer = () => {
        if (!sentence || !answer.trim() || result) {
            return;
        }

        const isCorrect = isListeningAnswerCorrect(answer, sentence);
        setResult({ kind: isCorrect ? 'correct' : 'incorrect', submittedAnswer: answer });
        setSession((currentSession) => ({
            attempts: currentSession.attempts + 1,
            correct: currentSession.correct + (isCorrect ? 1 : 0),
            streak: isCorrect ? currentSession.streak + 1 : 0,
        }));
    };

    const revealAnswer = () => {
        if (!sentence || result) {
            return;
        }

        setResult({ kind: 'revealed', submittedAnswer: answer });
        setSession((currentSession) => ({
            ...currentSession,
            attempts: currentSession.attempts + 1,
            streak: 0,
        }));
    };

    const renderAudioButton = (mode, label, detail, icon) => {
        const isThisAudio = audioState.mode === mode;
        const isLoading = isThisAudio && audioState.kind === 'loading';
        const isPlaying = isThisAudio && audioState.kind === 'playing';

        return (
            <Pressable
                accessibilityLabel={`Play sentence at ${label.toLowerCase()}`}
                accessibilityRole="button"
                onPress={() => playAudio(mode)}
                style={({ pressed }) => [
                    styles.audioOption,
                    isPlaying && styles.audioOptionActive,
                    pressed && styles.pressed,
                ]}
            >
                <View style={[styles.audioOptionIcon, isPlaying && styles.audioOptionIconActive]}>
                    {isLoading ? (
                        <ActivityIndicator color={colors.onPrimary} size="small" />
                    ) : (
                        <Ionicons
                            color={isPlaying ? colors.onPrimary : colors.primaryStrong}
                            name={isPlaying ? 'volume-high' : icon}
                            size={22}
                        />
                    )}
                </View>
                <View style={styles.audioOptionCopy}>
                    <Text style={[styles.audioOptionTitle, isPlaying && styles.audioOptionTitleActive]}>
                        {isPlaying ? 'Playing…' : label}
                    </Text>
                    <Text style={[styles.audioOptionDetail, isPlaying && styles.audioOptionDetailActive]}>
                        {detail}
                    </Text>
                </View>
            </Pressable>
        );
    };

    const renderSessionCard = () => (
        <View style={styles.sideColumn}>
            <Card tone="accent" style={styles.sessionCard}>
                <Text style={styles.sectionEyebrow}>This session</Text>
                <View style={styles.sessionMetricRow}>
                    <View style={styles.sessionMetric}>
                        <Text style={styles.sessionMetricValue}>{session.attempts}</Text>
                        <Text style={styles.sessionMetricLabel}>heard</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.sessionMetric}>
                        <Text style={styles.sessionMetricValue}>{accuracy}%</Text>
                        <Text style={styles.sessionMetricLabel}>accuracy</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.sessionMetric}>
                        <Text style={styles.sessionMetricValue}>{session.streak}</Text>
                        <Text style={styles.sessionMetricLabel}>streak</Text>
                    </View>
                </View>
            </Card>

            <Card style={styles.howToCard}>
                <View style={styles.howToIcon}>
                    <Ionicons color={colors.accent} name="ear-outline" size={22} />
                </View>
                <Text style={styles.howToTitle}>Listen before you peek</Text>
                <Text style={styles.howToText}>
                    Play the recording as often as you need, type what you hear, then check your
                    answer. Spaces and punctuation do not affect grading.
                </Text>
                <View style={styles.howToHint}>
                    <Ionicons color={colors.accent} name="checkmark-circle" size={16} />
                    <Text style={styles.howToHintText}>Simplified and traditional are accepted.</Text>
                </View>
            </Card>
        </View>
    );

    const renderFeedback = () => {
        if (!result || !sentence) {
            return null;
        }

        const isCorrect = result.kind === 'correct';
        const feedbackTitle = isCorrect
            ? 'Exactly right.'
            : result.kind === 'revealed'
              ? 'Answer revealed.'
              : 'Not quite—compare below.';

        return (
            <View
                accessibilityLiveRegion="polite"
                style={[
                    styles.feedback,
                    isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect,
                ]}
            >
                <View style={styles.feedbackHeader}>
                    <Ionicons
                        color={isCorrect ? colors.success : colors.error}
                        name={isCorrect ? 'checkmark-circle' : 'information-circle'}
                        size={22}
                    />
                    <Text
                        style={[
                            styles.feedbackTitle,
                            { color: isCorrect ? colors.success : colors.error },
                        ]}
                    >
                        {feedbackTitle}
                    </Text>
                </View>

                {!isCorrect && result.submittedAnswer.trim() ? (
                    <View style={styles.answerComparison}>
                        <Text style={styles.answerLabel}>You wrote</Text>
                        <Text style={styles.submittedAnswer}>{result.submittedAnswer}</Text>
                    </View>
                ) : null}

                <View style={styles.solutionBlock}>
                    <Text style={styles.answerLabel}>Answer</Text>
                    <Text style={styles.chineseAnswer}>{sentence.chinese}</Text>
                    {sentence.traditional && sentence.traditional !== sentence.chinese ? (
                        <Text style={styles.traditionalAnswer}>{sentence.traditional}</Text>
                    ) : null}
                    <Text style={styles.pinyin}>{sentence.pinyin}</Text>
                    <Text style={styles.translation}>{sentence.translation}</Text>
                </View>
            </View>
        );
    };

    const renderPracticeCard = () => (
        <Card style={styles.practiceCard}>
            <View style={styles.cardTopRow}>
                <View style={styles.cardTagRow}>
                    <View style={styles.levelTag}>
                        <Text style={styles.levelTagText}>HSK {sentence?.level || '—'}</Text>
                    </View>
                    <Text style={styles.topicTag}>{titleCase(sentence?.topic)}</Text>
                </View>
                <Text style={styles.deckPosition}>{filteredSentences.length.toLocaleString()} cards</Text>
            </View>

            <View style={styles.promptBlock}>
                <View style={styles.promptIcon}>
                    <Ionicons color={colors.primaryStrong} name="headset" size={34} />
                </View>
                <Text style={styles.promptEyebrow}>Listening card</Text>
                <Text style={styles.promptTitle}>What did you hear?</Text>
                <Text style={styles.promptText}>
                    The sentence stays hidden until you submit or reveal it.
                </Text>
            </View>

            <View style={styles.audioRow}>
                {renderAudioButton('normal', 'Normal', 'Natural pace', 'play')}
                {renderAudioButton('slow', 'Slow', 'Careful pace', 'speedometer-outline')}
            </View>

            {audioState.kind === 'error' ? (
                <View style={styles.audioError}>
                    <Ionicons color={colors.error} name="cloud-offline-outline" size={17} />
                    <Text style={styles.audioErrorText}>
                        Audio could not be played. Check your connection and try again.
                    </Text>
                </View>
            ) : null}

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Write the sentence in Chinese</Text>
                <TextInput
                    accessibilityLabel="Chinese sentence answer"
                    autoCapitalize="none"
                    autoCorrect={false}
                    blurOnSubmit={false}
                    editable={!result}
                    onChangeText={setAnswer}
                    onSubmitEditing={submitAnswer}
                    placeholder="在这里写你听到的句子…"
                    placeholderTextColor={colors.textMuted}
                    ref={answerInputRef}
                    returnKeyType="done"
                    style={[styles.answerInput, result && styles.answerInputLocked]}
                    value={answer}
                />
                <Text style={styles.inputHint}>Punctuation and spaces are optional.</Text>
            </View>

            {renderFeedback()}

            {result ? (
                <Pressable
                    accessibilityRole="button"
                    onPress={loadNextSentence}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                >
                    <Text style={styles.primaryButtonText}>Next sentence</Text>
                    <Ionicons color={colors.onPrimary} name="arrow-forward" size={19} />
                </Pressable>
            ) : (
                <View style={styles.actionRow}>
                    <Pressable
                        accessibilityRole="button"
                        disabled={!answer.trim()}
                        onPress={submitAnswer}
                        style={({ pressed }) => [
                            styles.primaryButton,
                            styles.submitButton,
                            !answer.trim() && styles.disabled,
                            pressed && answer.trim() && styles.pressed,
                        ]}
                    >
                        <Ionicons color={colors.onPrimary} name="checkmark" size={19} />
                        <Text style={styles.primaryButtonText}>Check answer</Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        onPress={revealAnswer}
                        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                    >
                        <Ionicons color={colors.primaryStrong} name="eye-outline" size={18} />
                        <Text style={styles.secondaryButtonText}>Reveal</Text>
                    </Pressable>
                </View>
            )}
        </Card>
    );

    return (
        <SafeAreaView style={styles.container}>
            <BackdropOrbs />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.hero}>
                    <View style={styles.heroCopy}>
                        <Text style={styles.heroEyebrow}>Sentence dictation</Text>
                        <Text style={styles.heroTitle}>Hear it. Write it.</Text>
                        <Text style={styles.heroSubtitle}>
                            Train your ear with {sentenceDeck.count.toLocaleString()} graded Chinese
                            sentences, one focused card at a time.
                        </Text>
                    </View>
                    <View style={styles.heroBadge}>
                        <Ionicons color={colors.accent} name="sparkles" size={17} />
                        <Text style={styles.heroBadgeText}>HSK 1–6 · two speeds</Text>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.levelSelectorContent}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.levelSelector}
                >
                    {LEVELS.map((level) => {
                        const isSelected = selectedLevels.includes(level);
                        return (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ selected: isSelected }}
                                key={level}
                                onPress={() => toggleLevel(level)}
                                style={({ pressed }) => [
                                    styles.levelChip,
                                    isSelected && styles.levelChipSelected,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.levelChipLabel,
                                        isSelected && styles.levelChipLabelSelected,
                                    ]}
                                >
                                    HSK {level}
                                </Text>
                                <Text
                                    style={[
                                        styles.levelChipCount,
                                        isSelected && styles.levelChipCountSelected,
                                    ]}
                                >
                                    {sentenceDeck.levelCounts[level]}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>

                <View style={styles.columns}>
                    {isWebDesktop ? renderSessionCard() : null}
                    <View style={styles.practiceColumn}>
                        {sentence ? renderPracticeCard() : (
                            <Card style={styles.emptyCard}>
                                <ActivityIndicator color={colors.primaryStrong} />
                                <Text style={styles.howToText}>Preparing your next sentence…</Text>
                            </Card>
                        )}
                    </View>
                    {!isWebDesktop ? renderSessionCard() : null}
                </View>

                <Pressable
                    accessibilityRole="link"
                    onPress={() => Linking.openURL(sentenceDeck.source)}
                    style={({ pressed }) => [styles.attribution, pressed && styles.pressed]}
                >
                    <Ionicons color={colors.textMuted} name="information-circle-outline" size={15} />
                    <Text style={styles.attributionText}>
                        CC BY-SA 4.0 dataset by no7z · synthetic CosyVoice2 speech · local audio
                        with a Hugging Face fallback
                    </Text>
                    <Ionicons color={colors.textMuted} name="open-outline" size={14} />
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
};

const createStyles = (colors, radii, shadows, typography, layout) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        scrollContent: {
            width: '100%',
            maxWidth: layout.contentMaxWidth,
            alignSelf: 'center',
            paddingHorizontal: layout.isWebWide ? 36 : 18,
            paddingTop: layout.isWebDesktop ? 46 : 24,
            paddingBottom: layout.isWebDesktop ? 132 : 34,
            gap: 24,
        },
        hero: {
            flexDirection: layout.isWebWide ? 'row' : 'column',
            alignItems: layout.isWebWide ? 'flex-end' : 'flex-start',
            justifyContent: 'space-between',
            gap: 20,
        },
        heroCopy: {
            maxWidth: 780,
            gap: 8,
        },
        heroEyebrow: {
            color: colors.primaryStrong,
            fontFamily: typography.uiFont,
            fontSize: 13,
            fontWeight: '800',
            letterSpacing: 1.3,
            textTransform: 'uppercase',
        },
        heroTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: layout.isWebDesktop ? 50 : 37,
            fontWeight: '700',
            lineHeight: layout.isWebDesktop ? 58 : 44,
        },
        heroSubtitle: {
            color: colors.textSecondary,
            fontFamily: typography.uiFont,
            fontSize: layout.isWebWide ? 17 : 15,
            lineHeight: layout.isWebWide ? 27 : 23,
            maxWidth: 720,
        },
        heroBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 15,
            paddingVertical: 10,
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            ...shadows.sm,
        },
        heroBadgeText: {
            color: colors.accent,
            fontFamily: typography.uiFont,
            fontSize: 12,
            fontWeight: '800',
        },
        levelSelector: {
            marginHorizontal: layout.isWebWide ? -4 : -18,
        },
        levelSelectorContent: {
            paddingHorizontal: layout.isWebWide ? 4 : 18,
            gap: 10,
        },
        levelChip: {
            minWidth: 104,
            paddingHorizontal: 16,
            paddingVertical: 11,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 11,
        },
        levelChipSelected: {
            borderColor: colors.primaryStrong,
            backgroundColor: colors.primaryStrong,
        },
        levelChipLabel: {
            color: colors.text,
            fontFamily: typography.uiFont,
            fontSize: 14,
            fontWeight: '800',
        },
        levelChipLabelSelected: {
            color: colors.onPrimary,
        },
        levelChipCount: {
            color: colors.textMuted,
            fontFamily: typography.uiFont,
            fontSize: 11,
            fontWeight: '700',
        },
        levelChipCountSelected: {
            color: colors.onPrimary,
            opacity: 0.78,
        },
        columns: {
            flexDirection: layout.isWebDesktop ? 'row' : 'column',
            alignItems: 'flex-start',
            gap: layout.isWebDesktop ? 28 : 20,
        },
        sideColumn: {
            width: layout.isWebDesktop ? 340 : '100%',
            gap: 16,
        },
        practiceColumn: {
            flex: layout.isWebDesktop ? 1 : undefined,
            width: layout.isWebDesktop ? 0 : '100%',
            maxWidth: layout.isWebDesktop ? 920 : undefined,
        },
        sessionCard: {
            padding: 20,
            gap: 14,
        },
        sectionEyebrow: {
            color: colors.accent,
            fontFamily: typography.uiFont,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1.1,
            textTransform: 'uppercase',
        },
        sessionMetricRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        sessionMetric: {
            flex: 1,
            alignItems: 'center',
            gap: 2,
        },
        sessionMetricValue: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 25,
            fontWeight: '800',
        },
        sessionMetricLabel: {
            color: colors.textSecondary,
            fontFamily: typography.uiFont,
            fontSize: 10,
            fontWeight: '800',
            textTransform: 'uppercase',
        },
        metricDivider: {
            width: 1,
            height: 38,
            backgroundColor: colors.borderStrong,
            opacity: 0.65,
        },
        howToCard: {
            padding: 20,
            gap: 10,
        },
        howToIcon: {
            width: 42,
            height: 42,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 15,
            backgroundColor: colors.accentSoft,
            marginBottom: 2,
        },
        howToTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 21,
            fontWeight: '700',
        },
        howToText: {
            color: colors.textSecondary,
            fontFamily: typography.uiFont,
            fontSize: 14,
            lineHeight: 22,
        },
        howToHint: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            marginTop: 4,
        },
        howToHintText: {
            color: colors.accent,
            fontFamily: typography.uiFont,
            fontSize: 12,
            fontWeight: '700',
            flex: 1,
        },
        practiceCard: {
            padding: layout.isWebWide ? 30 : 20,
            gap: 22,
        },
        cardTopRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
        },
        cardTagRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            flexShrink: 1,
        },
        levelTag: {
            paddingHorizontal: 11,
            paddingVertical: 6,
            borderRadius: radii.pill,
            backgroundColor: colors.primarySoft,
        },
        levelTagText: {
            color: colors.primaryStrong,
            fontFamily: typography.uiFont,
            fontSize: 11,
            fontWeight: '900',
        },
        topicTag: {
            color: colors.textMuted,
            fontFamily: typography.uiFont,
            fontSize: 12,
            fontWeight: '700',
        },
        deckPosition: {
            color: colors.textMuted,
            fontFamily: typography.uiFont,
            fontSize: 11,
            fontWeight: '700',
        },
        promptBlock: {
            alignItems: 'center',
            gap: 7,
            paddingVertical: layout.isWebWide ? 8 : 2,
        },
        promptIcon: {
            width: 74,
            height: 74,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 26,
            backgroundColor: colors.primarySoft,
            marginBottom: 5,
        },
        promptEyebrow: {
            color: colors.primaryStrong,
            fontFamily: typography.uiFont,
            fontSize: 11,
            fontWeight: '900',
            letterSpacing: 1.1,
            textTransform: 'uppercase',
        },
        promptTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: layout.isWebWide ? 31 : 27,
            fontWeight: '700',
            textAlign: 'center',
        },
        promptText: {
            color: colors.textSecondary,
            fontFamily: typography.uiFont,
            fontSize: 13,
            lineHeight: 20,
            textAlign: 'center',
        },
        audioRow: {
            flexDirection: 'row',
            gap: 12,
        },
        audioOption: {
            flex: 1,
            minHeight: 72,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: layout.isWebWide ? 17 : 13,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceMuted,
        },
        audioOptionActive: {
            backgroundColor: colors.primaryStrong,
            borderColor: colors.primaryStrong,
        },
        audioOptionIcon: {
            width: 42,
            height: 42,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 15,
            backgroundColor: colors.primarySoft,
        },
        audioOptionIconActive: {
            backgroundColor: colors.primary,
        },
        audioOptionCopy: {
            flex: 1,
            gap: 1,
        },
        audioOptionTitle: {
            color: colors.text,
            fontFamily: typography.uiFont,
            fontSize: 14,
            fontWeight: '800',
        },
        audioOptionTitleActive: {
            color: colors.onPrimary,
        },
        audioOptionDetail: {
            color: colors.textMuted,
            fontFamily: typography.uiFont,
            fontSize: 11,
        },
        audioOptionDetailActive: {
            color: colors.onPrimary,
            opacity: 0.74,
        },
        audioError: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 13,
            paddingVertical: 10,
            borderRadius: radii.sm,
            backgroundColor: colors.errorSoft,
        },
        audioErrorText: {
            color: colors.error,
            fontFamily: typography.uiFont,
            fontSize: 12,
            lineHeight: 18,
            flex: 1,
        },
        inputGroup: {
            gap: 7,
        },
        inputLabel: {
            color: colors.text,
            fontFamily: typography.uiFont,
            fontSize: 13,
            fontWeight: '800',
        },
        answerInput: {
            minHeight: 64,
            paddingHorizontal: 18,
            paddingVertical: 14,
            borderRadius: radii.md,
            borderWidth: 1.5,
            borderColor: colors.borderStrong,
            backgroundColor: colors.background,
            color: colors.text,
            fontFamily: typography.studyFont,
            fontSize: 21,
            lineHeight: 29,
            outlineStyle: 'none',
        },
        answerInputLocked: {
            opacity: 0.72,
        },
        inputHint: {
            color: colors.textMuted,
            fontFamily: typography.uiFont,
            fontSize: 11,
        },
        feedback: {
            padding: 18,
            borderRadius: radii.md,
            gap: 14,
        },
        feedbackCorrect: {
            backgroundColor: colors.successSoft,
        },
        feedbackIncorrect: {
            backgroundColor: colors.errorSoft,
        },
        feedbackHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        feedbackTitle: {
            fontFamily: typography.headingFont,
            fontSize: 18,
            fontWeight: '800',
        },
        answerComparison: {
            paddingBottom: 13,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            gap: 4,
        },
        answerLabel: {
            color: colors.textMuted,
            fontFamily: typography.uiFont,
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 0.9,
            textTransform: 'uppercase',
        },
        submittedAnswer: {
            color: colors.textSecondary,
            fontFamily: typography.studyFont,
            fontSize: 17,
            lineHeight: 25,
        },
        solutionBlock: {
            gap: 4,
        },
        chineseAnswer: {
            color: colors.text,
            fontFamily: typography.studyFont,
            fontSize: layout.isWebWide ? 28 : 24,
            fontWeight: '800',
            lineHeight: layout.isWebWide ? 40 : 35,
        },
        traditionalAnswer: {
            color: colors.textSecondary,
            fontFamily: typography.studyFont,
            fontSize: 16,
            lineHeight: 24,
        },
        pinyin: {
            color: colors.primaryStrong,
            fontFamily: typography.studyFont,
            fontSize: 15,
            lineHeight: 23,
            marginTop: 4,
        },
        translation: {
            color: colors.textSecondary,
            fontFamily: typography.uiFont,
            fontSize: 14,
            lineHeight: 22,
        },
        actionRow: {
            flexDirection: layout.isWebWide ? 'row' : 'column',
            gap: 11,
        },
        primaryButton: {
            minHeight: 54,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderRadius: radii.md,
            backgroundColor: colors.primary,
            ...shadows.sm,
        },
        submitButton: {
            flex: layout.isWebWide ? 1 : 0,
        },
        primaryButtonText: {
            color: colors.onPrimary,
            fontFamily: typography.uiFont,
            fontSize: 15,
            fontWeight: '900',
        },
        secondaryButton: {
            minHeight: 54,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        secondaryButtonText: {
            color: colors.primaryStrong,
            fontFamily: typography.uiFont,
            fontSize: 14,
            fontWeight: '800',
        },
        disabled: {
            opacity: 0.42,
        },
        pressed: {
            opacity: 0.82,
            transform: [{ scale: 0.988 }],
        },
        emptyCard: {
            minHeight: 420,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
        },
        attribution: {
            alignSelf: 'center',
            maxWidth: 780,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            paddingHorizontal: 12,
            paddingVertical: 8,
        },
        attributionText: {
            color: colors.textMuted,
            fontFamily: typography.uiFont,
            fontSize: 11,
            lineHeight: 17,
            textAlign: 'center',
            flexShrink: 1,
        },
    });

export default ListeningScreen;
