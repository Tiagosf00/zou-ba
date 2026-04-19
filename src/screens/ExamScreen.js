import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import BackdropOrbs from '../components/BackdropOrbs';
import Card from '../components/Card';
import ModernButton from '../components/ModernButton';
import { getPracticeMode } from '../constants/practiceModes';
import { useAppState } from '../context/AppStateContext';
import { useAppTheme } from '../theme/ThemeProvider';
import { getResponsiveLayout } from '../utils/layout';
import {
    buildRound,
    createPracticeProgress,
    DEFAULT_PROFILE_ID,
    getDisplayLines,
    getDisplayText,
    getMeaningLines,
    recordRoundResult,
} from '../utils/practice';

import hskData from '../../assets/hsk_1_6_pdf_dataset_english.json';

const PROFILE_ID = DEFAULT_PROFILE_ID;
const EXAM_LEVELS = [1, 2, 3, 4, 5, 6];

const shuffleItems = (items) => {
    const copy = [...items];

    for (let index = copy.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
    }

    return copy;
};

const formatPercentage = (count, total) => {
    if (!total) {
        return '0%';
    }

    const percentage = (count / total) * 100;
    const rounded = Math.round(percentage * 10) / 10;

    return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
};

const getExamSummary = (results, totalWords) => {
    const counts = results.reduce(
        (summary, result) => {
            if (result.outcome === 'correct') {
                summary.correct += 1;
            } else if (result.outcome === 'incorrect') {
                summary.incorrect += 1;
            } else if (result.outcome === 'unknown') {
                summary.unknown += 1;
            }

            return summary;
        },
        {
            correct: 0,
            incorrect: 0,
            unknown: 0,
        },
    );

    return {
        totalWords,
        correctCount: counts.correct,
        incorrectCount: counts.incorrect,
        unknownCount: counts.unknown,
        correctPercentage: formatPercentage(counts.correct, totalWords),
        incorrectPercentage: formatPercentage(counts.incorrect, totalWords),
        unknownPercentage: formatPercentage(counts.unknown, totalWords),
    };
};

const getMeaningSummary = (item) => {
    const meanings = getMeaningLines(item);
    return meanings.length > 0 ? meanings.slice(0, 2).join(', ') : 'No meaning available.';
};

const createExamRound = (word, outputMode) => {
    if (!word) {
        return null;
    }

    return buildRound(hskData, word, outputMode);
};

const ExamScreen = () => {
    const { settings, progress, updateProgress, isHydrated } = useAppState();
    const { width } = useWindowDimensions();
    const { isWebWide, isWebDesktop, contentMaxWidth } = getResponsiveLayout(width);
    const { colors, radii, shadows, typography } = useAppTheme();
    const styles = useMemo(
        () =>
            createStyles(colors, radii, shadows, typography, {
                isWebWide,
                isWebDesktop,
                contentMaxWidth,
            }),
        [colors, radii, shadows, typography, isWebWide, isWebDesktop, contentMaxWidth],
    );
    const [selectedLevel, setSelectedLevel] = useState(settings.hskLevels[0] || 1);
    const [session, setSession] = useState(null);
    const [round, setRound] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [answerState, setAnswerState] = useState(null);
    const [report, setReport] = useState(null);
    const progressRef = useRef(progress);

    useEffect(() => {
        progressRef.current = progress;
    }, [progress]);

    const wordsByLevel = useMemo(
        () =>
            EXAM_LEVELS.reduce((result, level) => {
                result[level] = hskData.filter((item) => item.level === level);
                return result;
            }, {}),
        [],
    );
    const selectedLevelWords = wordsByLevel[selectedLevel] || [];
    const activeInputMode = getPracticeMode(session?.inputMode || settings.inputMode);
    const activeOutputMode = getPracticeMode(session?.outputMode || settings.outputMode);
    const liveSummary = useMemo(
        () => getExamSummary(session?.results || [], session?.words.length || 0),
        [session],
    );
    const currentQuestion = round?.question || null;
    const hasAnswered = answerState !== null;
    const isCorrect = answerState === 'correct';
    const didChooseUnknown = answerState === 'unknown';
    const optionButtonHeight = isWebDesktop ? 120 : 92;

    const startExamForLevel = (level) => {
        const wordsForLevel = wordsByLevel[level] || [];

        if (!isHydrated || wordsForLevel.length === 0) {
            return;
        }

        const words = shuffleItems(wordsForLevel);
        const nextSession = {
            level,
            words,
            currentIndex: 0,
            results: [],
            inputMode: settings.inputMode,
            outputMode: settings.outputMode,
            startedAt: new Date().toISOString(),
        };

        setSession(nextSession);
        setRound(createExamRound(words[0], nextSession.outputMode));
        setSelectedOption(null);
        setAnswerState(null);
        setReport(null);
    };

    const startExam = () => {
        startExamForLevel(selectedLevel);
    };

    const rebuildCurrentRound = () => {
        if (!session) {
            return;
        }

        setRound(createExamRound(session.words[session.currentIndex], session.outputMode));
        setSelectedOption(null);
        setAnswerState(null);
    };

    const finishExam = (finishedSession) => {
        setReport({
            ...getExamSummary(finishedSession.results, finishedSession.words.length),
            level: finishedSession.level,
            inputMode: finishedSession.inputMode,
            outputMode: finishedSession.outputMode,
            completedAt: new Date().toISOString(),
        });
        setSession(null);
        setRound(null);
        setSelectedOption(null);
        setAnswerState(null);
    };

    const recordExamOutcome = (outcome, option = null) => {
        if (!session || !round || hasAnswered || !isHydrated) {
            return;
        }

        const reviewedAt = new Date();

        // Feed exam answers into the same spaced-repetition history used by practice.
        const nextCards = recordRoundResult(
            progressRef.current.cards,
            round.question,
            outcome === 'correct',
            reviewedAt,
        );
        const nextProgress = createPracticeProgress(PROFILE_ID, nextCards);

        progressRef.current = nextProgress;
        updateProgress(nextProgress);

        setSelectedOption(option);
        setAnswerState(outcome);
        setSession((currentSession) =>
            currentSession
                ? {
                      ...currentSession,
                      results: [
                          ...currentSession.results,
                          {
                              itemId: round.question.id,
                              outcome,
                              answeredAt: reviewedAt.toISOString(),
                          },
                      ],
                  }
                : currentSession,
        );
    };

    const handleSelection = (item) => {
        if (!round) {
            return;
        }

        recordExamOutcome(item.id === round.question.id ? 'correct' : 'incorrect', item);
    };

    const handleDontKnow = () => {
        recordExamOutcome('unknown');
    };

    const handleNextWord = () => {
        if (!session || !hasAnswered) {
            return;
        }

        const nextIndex = session.currentIndex + 1;

        if (nextIndex >= session.words.length) {
            finishExam(session);
            return;
        }

        setSession((currentSession) =>
            currentSession
                ? {
                      ...currentSession,
                      currentIndex: nextIndex,
                  }
                : currentSession,
        );
        setRound(createExamRound(session.words[nextIndex], session.outputMode));
        setSelectedOption(null);
        setAnswerState(null);
    };

    const resetReport = () => {
        setReport(null);
    };

    const renderQuestionPrompt = (item, inputModeId) => {
        if (!item) {
            return null;
        }

        if (inputModeId === 'eng') {
            const meanings = getMeaningLines(item);
            const lines = meanings.length > 0 ? meanings : ['No meaning available.'];

            return (
                <View style={styles.meaningStack}>
                    {lines.map((line, index) => (
                        <Text key={`${item.id}-${index}`} style={styles.meaningLine}>
                            {line}
                        </Text>
                    ))}
                </View>
            );
        }

        return (
            <Text
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                numberOfLines={inputModeId === 'pinyin' ? 2 : 1}
                style={[
                    styles.questionText,
                    inputModeId === 'pinyin' && styles.questionTextPinyin,
                ]}
            >
                {getDisplayText(item, inputModeId)}
            </Text>
        );
    };

    const renderFeedbackRow = (title, item, tone = 'default') => {
        if (!item) {
            return null;
        }

        return (
            <View
                style={[
                    styles.feedbackRow,
                    tone === 'success' && styles.feedbackRowSuccess,
                    tone === 'danger' && styles.feedbackRowDanger,
                ]}
            >
                <Text
                    style={[
                        styles.feedbackLabel,
                        tone === 'success' && styles.feedbackLabelSuccess,
                        tone === 'danger' && styles.feedbackLabelDanger,
                    ]}
                >
                    {title}
                </Text>
                <Text style={styles.feedbackWord}>
                    {item.hanzi} · {item.pinyin}
                </Text>
                <Text style={styles.feedbackMeaning}>{getMeaningSummary(item)}</Text>
            </View>
        );
    };

    if (!isHydrated) {
        return (
            <SafeAreaView style={styles.container}>
                <BackdropOrbs />
                <View style={styles.centeredState}>
                    <Card style={styles.stateCard}>
                        <ActivityIndicator color={colors.primaryStrong} size="small" />
                        <Text style={styles.stateTitle}>Loading exam mode</Text>
                        <Text style={styles.stateText}>
                            Restoring your saved progress so exam answers can update the same word
                            history used in practice.
                        </Text>
                    </Card>
                </View>
            </SafeAreaView>
        );
    }

    if (session && !round) {
        return (
            <SafeAreaView style={styles.container}>
                <BackdropOrbs />
                <View style={styles.centeredState}>
                    <Card style={styles.stateCard}>
                        <Text style={styles.stateEyebrow}>Exam</Text>
                        <Text style={styles.stateTitle}>We couldn&apos;t build this question.</Text>
                        <Text style={styles.stateText}>
                            The exam is still intact. Try regenerating the answer choices for the
                            current word.
                        </Text>
                        <ModernButton
                            title="Try this word again"
                            onPress={rebuildCurrentRound}
                            style={styles.primaryAction}
                        />
                    </Card>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <BackdropOrbs />
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    isWebWide && styles.scrollContentWide,
                    isWebDesktop && styles.scrollContentDesktop,
                ]}
                showsVerticalScrollIndicator={false}
            >
                {!session && !report ? (
                    <View style={styles.stack}>
                        <View style={[styles.hero, isWebDesktop && styles.heroDesktop]}>
                            <View style={styles.heroCopy}>
                                <Text style={styles.eyebrow}>Exam</Text>
                                <Text style={styles.heroTitle}>One-pass HSK exam</Text>
                                <Text style={styles.heroSubtitle}>
                                    Pick one HSK level, answer each word once in random order, and
                                    finish with a full report. Every exam result also updates the
                                    same review history used in practice.
                                </Text>
                            </View>

                            <Card tone="accent" style={styles.heroAside}>
                                <Text style={styles.heroAsideEyebrow}>Current format</Text>
                                <Text style={styles.heroAsideTitle}>
                                    See {getPracticeMode(settings.inputMode).chipLabel.toLowerCase()}
                                </Text>
                                <Text style={styles.heroAsideText}>
                                    Answer with{' '}
                                    {getPracticeMode(settings.outputMode).chipLabel.toLowerCase()}.
                                    Change this any time in settings before you start the exam.
                                </Text>
                            </Card>
                        </View>

                        <Card style={styles.setupCard}>
                            <Text style={styles.sectionEyebrow}>Choose level</Text>
                            <Text style={styles.sectionTitle}>Select the HSK level to test</Text>
                            <Text style={styles.sectionSubtitle}>
                                The exam will include all {selectedLevelWords.length} words from
                                HSK {selectedLevel}, shuffled once.
                            </Text>

                            <View style={styles.levelGrid}>
                                {EXAM_LEVELS.map((level) => {
                                    const isSelected = level === selectedLevel;
                                    const wordCount = wordsByLevel[level]?.length || 0;

                                    return (
                                        <Pressable
                                            key={level}
                                            onPress={() => setSelectedLevel(level)}
                                            style={({ pressed }) => [
                                                styles.levelChip,
                                                isSelected && styles.levelChipSelected,
                                                pressed && styles.levelChipPressed,
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
                                                    styles.levelChipMeta,
                                                    isSelected && styles.levelChipMetaSelected,
                                                ]}
                                            >
                                                {wordCount} words
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <View style={styles.setupFooter}>
                                <Text style={styles.setupNote}>
                                    I don&apos;t know appears separately in the report and counts
                                    as an incorrect review for the practice scheduler.
                                </Text>
                                <ModernButton
                                    title={`Start HSK ${selectedLevel} exam`}
                                    onPress={startExam}
                                    style={styles.primaryAction}
                                />
                            </View>
                        </Card>
                    </View>
                ) : null}

                {session ? (
                    <View style={styles.stack}>
                        <View style={[styles.hero, isWebDesktop && styles.heroDesktop]}>
                            <View style={styles.heroCopy}>
                                <Text style={styles.eyebrow}>Exam in progress</Text>
                                <Text style={styles.heroTitle}>HSK {session.level}</Text>
                                <Text style={styles.heroSubtitle}>
                                    Word {session.currentIndex + 1} of {session.words.length}. Each
                                    word appears once, in random order.
                                </Text>
                            </View>

                            <Card tone="accent" style={styles.heroAside}>
                                <Text style={styles.heroAsideEyebrow}>Live score</Text>
                                <Text style={styles.heroAsideTitle}>
                                    {liveSummary.correctCount} correct so far
                                </Text>
                                <Text style={styles.heroAsideText}>
                                    {liveSummary.incorrectCount} incorrect and{' '}
                                    {liveSummary.unknownCount} marked as I don&apos;t know.
                                </Text>
                            </Card>
                        </View>

                        <Card style={styles.progressCard}>
                            <View style={styles.progressHeader}>
                                <Text style={styles.progressTitle}>Progress</Text>
                                <Text style={styles.progressValue}>
                                    {session.currentIndex + 1}/{session.words.length}
                                </Text>
                            </View>
                            <View style={styles.progressTrack}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            width: `${Math.max(
                                                ((session.currentIndex + (hasAnswered ? 1 : 0)) /
                                                    session.words.length) *
                                                    100,
                                                3,
                                            )}%`,
                                        },
                                    ]}
                                />
                            </View>
                            <View style={styles.summaryGrid}>
                                {[
                                    {
                                        key: 'correct',
                                        label: 'Correct',
                                        value: liveSummary.correctCount,
                                        icon: 'checkmark-circle',
                                    },
                                    {
                                        key: 'incorrect',
                                        label: 'Incorrect',
                                        value: liveSummary.incorrectCount,
                                        icon: 'close-circle',
                                    },
                                    {
                                        key: 'unknown',
                                        label: "I don't know",
                                        value: liveSummary.unknownCount,
                                        icon: 'help-circle',
                                    },
                                ].map((metric) => (
                                    <View key={metric.key} style={styles.summaryChip}>
                                        <Ionicons
                                            color={colors.primaryStrong}
                                            name={metric.icon}
                                            size={15}
                                        />
                                        <Text style={styles.summaryChipValue}>{metric.value}</Text>
                                        <Text style={styles.summaryChipLabel}>{metric.label}</Text>
                                    </View>
                                ))}
                            </View>
                        </Card>

                        <View style={[styles.examLayout, isWebDesktop && styles.examLayoutDesktop]}>
                            <Card style={styles.questionCard}>
                                <View style={styles.modeChipRow}>
                                    <View style={styles.modeChip}>
                                        <Ionicons color={colors.primaryStrong} name="eye" size={13} />
                                        <Text style={styles.modeChipText}>
                                            See {activeInputMode.label}
                                        </Text>
                                    </View>
                                    <View style={[styles.modeChip, styles.modeChipAccent]}>
                                        <Ionicons
                                            color={colors.accent}
                                            name="checkmark-circle"
                                            size={13}
                                        />
                                        <Text
                                            style={[styles.modeChipText, styles.modeChipTextAccent]}
                                        >
                                            Answer {activeOutputMode.label}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.questionLabel}>Exam word</Text>
                                {renderQuestionPrompt(currentQuestion, session.inputMode)}

                                <View style={styles.questionFooter}>
                                    <View style={styles.levelTag}>
                                        <Text style={styles.levelTagText}>
                                            HSK {currentQuestion?.level}
                                        </Text>
                                    </View>
                                    <Text style={styles.questionHint}>
                                        {hasAnswered
                                            ? 'Review the result, then move to the next word.'
                                            : 'Choose one answer or mark it as unknown.'}
                                    </Text>
                                </View>
                            </Card>

                            <Card style={styles.optionsCard}>
                                <Text style={styles.sectionEyebrow}>Answer choices</Text>
                                <Text style={styles.optionsTitle}>
                                    {hasAnswered
                                        ? 'This word is locked in. Move on when you are ready.'
                                        : 'Pick the matching answer. You only see each word once.'}
                                </Text>

                                <View style={styles.optionsGrid}>
                                    {round.options.map((item) => {
                                        const isSelected = selectedOption?.id === item.id;
                                        const isAnswer = item.id === currentQuestion?.id;
                                        let variant = 'secondary';

                                        if (hasAnswered) {
                                            if (isAnswer) {
                                                variant = 'success';
                                            } else if (isSelected) {
                                                variant = 'danger';
                                            }
                                        }

                                        return (
                                            <View key={item.id} style={styles.optionWrapper}>
                                                <ModernButton
                                                    title={
                                                        activeOutputMode.id === 'pinyin'
                                                            ? getDisplayText(
                                                                  item,
                                                                  activeOutputMode.id,
                                                              )
                                                            : getDisplayLines(
                                                                  item,
                                                                  activeOutputMode.id,
                                                              )
                                                    }
                                                    onPress={() => handleSelection(item)}
                                                    variant={variant}
                                                    multiline={activeOutputMode.id !== 'pinyin'}
                                                    fitText={activeOutputMode.id === 'pinyin'}
                                                    minimumFontScale={0.82}
                                                    disabled={hasAnswered}
                                                    style={[
                                                        styles.optionButton,
                                                        { minHeight: optionButtonHeight },
                                                    ]}
                                                    textStyle={styles.optionText}
                                                />
                                            </View>
                                        );
                                    })}
                                </View>

                                <ModernButton
                                    title="I don't know"
                                    onPress={handleDontKnow}
                                    variant="secondary"
                                    disabled={hasAnswered}
                                    style={styles.unknownButton}
                                    textStyle={styles.unknownButtonText}
                                />
                            </Card>
                        </View>

                        {hasAnswered ? (
                            <Card
                                tone={isCorrect ? 'accent' : 'default'}
                                style={styles.feedbackCard}
                            >
                                <Text
                                    style={[
                                        styles.feedbackEyebrow,
                                        isCorrect && styles.feedbackEyebrowSuccess,
                                        didChooseUnknown && styles.feedbackEyebrowUnknown,
                                    ]}
                                >
                                    {isCorrect
                                        ? 'Correct'
                                        : didChooseUnknown
                                          ? "Marked as I don't know"
                                          : 'Incorrect'}
                                </Text>

                                {selectedOption
                                    ? renderFeedbackRow(
                                          isCorrect ? 'Your answer' : 'Your choice',
                                          selectedOption,
                                          isCorrect ? 'success' : 'danger',
                                      )
                                    : null}

                                {!isCorrect
                                    ? renderFeedbackRow('Correct answer', currentQuestion, 'success')
                                    : null}

                                {didChooseUnknown ? (
                                    <Text style={styles.feedbackNote}>
                                        This still counts as a failed review for the practice tab
                                        so the spaced-repetition schedule stays honest.
                                    </Text>
                                ) : null}

                                <ModernButton
                                    title={
                                        session.currentIndex + 1 === session.words.length
                                            ? 'See report'
                                            : 'Next word'
                                    }
                                    onPress={handleNextWord}
                                    style={styles.primaryAction}
                                />
                            </Card>
                        ) : null}
                    </View>
                ) : null}

                {report ? (
                    <View style={styles.stack}>
                        <View style={[styles.hero, isWebDesktop && styles.heroDesktop]}>
                            <View style={styles.heroCopy}>
                                <Text style={styles.eyebrow}>Exam report</Text>
                                <Text style={styles.heroTitle}>HSK {report.level} complete</Text>
                                <Text style={styles.heroSubtitle}>
                                    {report.correctCount} correct out of {report.totalWords} words
                                    in one pass.
                                </Text>
                            </View>

                            <Card tone="accent" style={styles.heroAside}>
                                <Text style={styles.heroAsideEyebrow}>Format used</Text>
                                <Text style={styles.heroAsideTitle}>
                                    {getPracticeMode(report.inputMode).label} to{' '}
                                    {getPracticeMode(report.outputMode).label}
                                </Text>
                                <Text style={styles.heroAsideText}>
                                    Finished{' '}
                                    {report.completedAt
                                        ? new Date(report.completedAt).toLocaleString()
                                        : 'just now'}
                                    .
                                </Text>
                            </Card>
                        </View>

                        <Card style={styles.reportCard}>
                            <Text style={styles.sectionEyebrow}>Breakdown</Text>
                            <Text style={styles.sectionTitle}>Final percentages</Text>
                            <Text style={styles.sectionSubtitle}>
                                Every answer already updated the same spaced-repetition history used
                                on the practice tab.
                            </Text>

                            <View style={styles.reportGrid}>
                                {[
                                    {
                                        key: 'correct',
                                        label: 'Correct',
                                        count: report.correctCount,
                                        percentage: report.correctPercentage,
                                        icon: 'checkmark-circle',
                                    },
                                    {
                                        key: 'incorrect',
                                        label: 'Incorrect',
                                        count: report.incorrectCount,
                                        percentage: report.incorrectPercentage,
                                        icon: 'close-circle',
                                    },
                                    {
                                        key: 'unknown',
                                        label: "I don't know",
                                        count: report.unknownCount,
                                        percentage: report.unknownPercentage,
                                        icon: 'help-circle',
                                    },
                                ].map((metric) => (
                                    <View key={metric.key} style={styles.reportMetric}>
                                        <Ionicons
                                            color={colors.primaryStrong}
                                            name={metric.icon}
                                            size={18}
                                        />
                                        <Text style={styles.reportMetricPercentage}>
                                            {metric.percentage}
                                        </Text>
                                        <Text style={styles.reportMetricLabel}>
                                            {metric.label}
                                        </Text>
                                        <Text style={styles.reportMetricCount}>
                                            {metric.count} words
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.reportActions}>
                                <ModernButton
                                    title={`Retake HSK ${report.level}`}
                                    onPress={() => {
                                        setSelectedLevel(report.level);
                                        startExamForLevel(report.level);
                                    }}
                                    style={styles.secondaryAction}
                                />
                                <ModernButton
                                    title="Choose another level"
                                    onPress={resetReport}
                                    variant="secondary"
                                    style={styles.secondaryAction}
                                />
                            </View>
                        </Card>
                    </View>
                ) : null}
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
            flexGrow: 1,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 18,
            gap: 14,
        },
        scrollContentWide: {
            width: '100%',
            maxWidth: layout.contentMaxWidth,
            alignSelf: 'center',
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 140,
            gap: 18,
        },
        scrollContentDesktop: {
            paddingBottom: 148,
        },
        stack: {
            gap: 14,
        },
        hero: {
            gap: 14,
        },
        heroDesktop: {
            flexDirection: 'row',
            alignItems: 'stretch',
        },
        heroCopy: {
            flex: 1,
            gap: 8,
        },
        eyebrow: {
            fontFamily: typography.headingFont,
            fontSize: 14,
            fontWeight: '700',
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: colors.accent,
        },
        heroTitle: {
            fontFamily: typography.headingFont,
            fontSize: 34,
            lineHeight: 40,
            fontWeight: '700',
            color: colors.text,
        },
        heroSubtitle: {
            fontFamily: typography.uiFont,
            fontSize: 16,
            lineHeight: 24,
            color: colors.textSecondary,
            maxWidth: 760,
        },
        heroAside: {
            gap: 8,
            flex: layout.isWebDesktop ? 0.42 : undefined,
        },
        heroAsideEyebrow: {
            fontFamily: typography.headingFont,
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: colors.accent,
        },
        heroAsideTitle: {
            fontFamily: typography.headingFont,
            fontSize: 24,
            lineHeight: 29,
            fontWeight: '700',
            color: colors.text,
        },
        heroAsideText: {
            fontFamily: typography.uiFont,
            fontSize: 15,
            lineHeight: 22,
            color: colors.textSecondary,
        },
        setupCard: {
            gap: 16,
        },
        sectionEyebrow: {
            fontFamily: typography.headingFont,
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: colors.accent,
        },
        sectionTitle: {
            fontFamily: typography.headingFont,
            fontSize: 28,
            lineHeight: 34,
            fontWeight: '700',
            color: colors.text,
        },
        sectionSubtitle: {
            fontFamily: typography.uiFont,
            fontSize: 15,
            lineHeight: 23,
            color: colors.textSecondary,
        },
        levelGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
        },
        levelChip: {
            minWidth: layout.isWebDesktop ? 154 : 140,
            paddingHorizontal: 16,
            paddingVertical: 16,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
            gap: 4,
        },
        levelChipSelected: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
            ...shadows.sm,
        },
        levelChipPressed: {
            transform: [{ scale: 0.985 }],
        },
        levelChipLabel: {
            fontFamily: typography.headingFont,
            fontSize: 18,
            lineHeight: 24,
            fontWeight: '700',
            color: colors.text,
        },
        levelChipLabelSelected: {
            color: colors.onPrimary,
        },
        levelChipMeta: {
            fontFamily: typography.uiFont,
            fontSize: 14,
            lineHeight: 20,
            color: colors.textSecondary,
        },
        levelChipMetaSelected: {
            color: colors.onPrimary,
            opacity: 0.88,
        },
        setupFooter: {
            gap: 14,
        },
        setupNote: {
            fontFamily: typography.uiFont,
            fontSize: 14,
            lineHeight: 22,
            color: colors.textSecondary,
        },
        primaryAction: {
            alignSelf: layout.isWebDesktop ? 'flex-start' : 'stretch',
            minWidth: layout.isWebDesktop ? 260 : undefined,
        },
        secondaryAction: {
            flex: 1,
        },
        centeredState: {
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: 16,
        },
        stateCard: {
            gap: 12,
            alignSelf: 'center',
            width: '100%',
            maxWidth: 620,
        },
        stateEyebrow: {
            fontFamily: typography.headingFont,
            fontSize: 13,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            color: colors.accent,
        },
        stateTitle: {
            fontFamily: typography.headingFont,
            fontSize: 28,
            lineHeight: 34,
            fontWeight: '700',
            color: colors.text,
        },
        stateText: {
            fontFamily: typography.uiFont,
            fontSize: 15,
            lineHeight: 23,
            color: colors.textSecondary,
        },
        progressCard: {
            gap: 14,
        },
        progressHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        progressTitle: {
            fontFamily: typography.headingFont,
            fontSize: 20,
            lineHeight: 25,
            fontWeight: '700',
            color: colors.text,
        },
        progressValue: {
            fontFamily: typography.uiFont,
            fontSize: 15,
            lineHeight: 22,
            fontWeight: '700',
            color: colors.textSecondary,
        },
        progressTrack: {
            height: 10,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceMuted,
            overflow: 'hidden',
        },
        progressFill: {
            height: '100%',
            borderRadius: radii.pill,
            backgroundColor: colors.primary,
        },
        summaryGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
        },
        summaryChip: {
            flexGrow: 1,
            minWidth: layout.isWebDesktop ? 160 : 120,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            gap: 4,
        },
        summaryChipValue: {
            fontFamily: typography.headingFont,
            fontSize: 22,
            lineHeight: 28,
            fontWeight: '700',
            color: colors.text,
        },
        summaryChipLabel: {
            fontFamily: typography.uiFont,
            fontSize: 13,
            lineHeight: 18,
            color: colors.textSecondary,
            textAlign: 'center',
        },
        examLayout: {
            gap: 14,
        },
        examLayoutDesktop: {
            flexDirection: 'row',
            alignItems: 'flex-start',
        },
        questionCard: {
            gap: 14,
            flex: layout.isWebDesktop ? 1.05 : undefined,
        },
        optionsCard: {
            gap: 14,
            flex: layout.isWebDesktop ? 0.95 : undefined,
        },
        modeChipRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
        },
        modeChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        modeChipAccent: {
            backgroundColor: colors.accentSoft,
            borderColor: 'transparent',
        },
        modeChipText: {
            fontFamily: typography.uiFont,
            fontSize: 13,
            lineHeight: 18,
            fontWeight: '700',
            color: colors.text,
        },
        modeChipTextAccent: {
            color: colors.accent,
        },
        questionLabel: {
            fontFamily: typography.uiFont,
            fontSize: 13,
            lineHeight: 18,
            fontWeight: '700',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: colors.textMuted,
        },
        questionText: {
            fontFamily: typography.studyFont,
            fontSize: layout.isWebDesktop ? 64 : 54,
            lineHeight: layout.isWebDesktop ? 78 : 66,
            fontWeight: '700',
            color: colors.text,
            textAlign: 'center',
        },
        questionTextPinyin: {
            fontSize: layout.isWebDesktop ? 44 : 36,
            lineHeight: layout.isWebDesktop ? 56 : 46,
        },
        meaningStack: {
            alignItems: 'center',
            gap: 8,
            paddingVertical: 6,
        },
        meaningLine: {
            fontFamily: typography.uiFont,
            fontSize: layout.isWebDesktop ? 24 : 21,
            lineHeight: layout.isWebDesktop ? 34 : 30,
            fontWeight: '700',
            color: colors.text,
            textAlign: 'center',
        },
        questionFooter: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        levelTag: {
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radii.pill,
            backgroundColor: colors.primarySoft,
        },
        levelTagText: {
            fontFamily: typography.uiFont,
            fontSize: 13,
            lineHeight: 18,
            fontWeight: '700',
            color: colors.primaryStrong,
        },
        questionHint: {
            flex: 1,
            minWidth: 220,
            fontFamily: typography.uiFont,
            fontSize: 14,
            lineHeight: 20,
            color: colors.textSecondary,
            textAlign: layout.isWebDesktop ? 'right' : 'left',
        },
        optionsTitle: {
            fontFamily: typography.uiFont,
            fontSize: 15,
            lineHeight: 23,
            color: colors.textSecondary,
        },
        optionsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
        },
        optionWrapper: {
            width: layout.isWebDesktop ? '48.8%' : '100%',
        },
        optionButton: {
            width: '100%',
        },
        optionText: {
            fontSize: layout.isWebDesktop ? 19 : 18,
            lineHeight: layout.isWebDesktop ? 28 : 26,
        },
        unknownButton: {
            minHeight: 72,
        },
        unknownButtonText: {
            fontSize: 17,
        },
        feedbackCard: {
            gap: 14,
        },
        feedbackEyebrow: {
            fontFamily: typography.headingFont,
            fontSize: 14,
            lineHeight: 18,
            fontWeight: '700',
            letterSpacing: 0.7,
            textTransform: 'uppercase',
            color: colors.textSecondary,
        },
        feedbackEyebrowSuccess: {
            color: colors.success,
        },
        feedbackEyebrowUnknown: {
            color: colors.accent,
        },
        feedbackRow: {
            gap: 4,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        feedbackRowSuccess: {
            backgroundColor: colors.successSoft,
            borderColor: 'transparent',
        },
        feedbackRowDanger: {
            backgroundColor: colors.errorSoft,
            borderColor: 'transparent',
        },
        feedbackLabel: {
            fontFamily: typography.uiFont,
            fontSize: 12,
            lineHeight: 16,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            color: colors.textMuted,
        },
        feedbackLabelSuccess: {
            color: colors.success,
        },
        feedbackLabelDanger: {
            color: colors.error,
        },
        feedbackWord: {
            fontFamily: typography.studyFont,
            fontSize: 22,
            lineHeight: 29,
            fontWeight: '700',
            color: colors.text,
        },
        feedbackMeaning: {
            fontFamily: typography.uiFont,
            fontSize: 15,
            lineHeight: 22,
            color: colors.textSecondary,
        },
        feedbackNote: {
            fontFamily: typography.uiFont,
            fontSize: 14,
            lineHeight: 22,
            color: colors.textSecondary,
        },
        reportCard: {
            gap: 16,
        },
        reportGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
        },
        reportMetric: {
            flexGrow: 1,
            minWidth: layout.isWebDesktop ? 190 : 150,
            paddingHorizontal: 16,
            paddingVertical: 16,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
            alignItems: 'center',
            gap: 6,
        },
        reportMetricPercentage: {
            fontFamily: typography.headingFont,
            fontSize: 30,
            lineHeight: 36,
            fontWeight: '700',
            color: colors.text,
        },
        reportMetricLabel: {
            fontFamily: typography.uiFont,
            fontSize: 14,
            lineHeight: 20,
            fontWeight: '700',
            color: colors.text,
            textAlign: 'center',
        },
        reportMetricCount: {
            fontFamily: typography.uiFont,
            fontSize: 13,
            lineHeight: 18,
            color: colors.textSecondary,
        },
        reportActions: {
            flexDirection: layout.isWebDesktop ? 'row' : 'column',
            gap: 12,
        },
    });

export default ExamScreen;
