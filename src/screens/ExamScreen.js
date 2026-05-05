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
import AudioButton from '../components/AudioButton';
import { getPracticeMode } from '../constants/practiceModes';
import { useAppState } from '../context/AppStateContext';
import { useAppTheme } from '../theme/ThemeProvider';
import { getResponsiveLayout } from '../utils/layout';
import {
    buildRound,
    createPracticeProgress,
    DEFAULT_PROFILE_ID,
    getDetailedMeaning,
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
    const { width, height } = useWindowDimensions();
    const { isWebWide, isWebDesktop, contentMaxWidth } = getResponsiveLayout(width);
    const desktopScale = isWebDesktop ? Math.min(Math.max((width - 1120) / 720, 0), 1) : 0;
    const desktopSidebarWidth = isWebDesktop
        ? Math.min(Math.max(width * 0.35, 500), 680)
        : 430;
    const desktopContentMinHeight = isWebDesktop ? Math.max(height - 40, 680) : height;
    const { colors, radii, shadows, typography } = useAppTheme();
    const styles = useMemo(
        () =>
            createStyles(colors, radii, shadows, typography, {
                isWebWide,
                isWebDesktop,
                contentMaxWidth,
                desktopScale,
                desktopSidebarWidth,
                desktopContentMinHeight,
            }),
        [
            colors,
            radii,
            shadows,
            typography,
            isWebWide,
            isWebDesktop,
            contentMaxWidth,
            desktopScale,
            desktopSidebarWidth,
            desktopContentMinHeight,
        ],
    );
    const compactLayout = !isWebDesktop && height < 780;
    const tightLayout = !isWebDesktop && height < 700;
    const veryTightLayout = !isWebDesktop && height < 640;
    const [selectedLevel, setSelectedLevel] = useState(settings.hskLevels[0] || 1);
    const [session, setSession] = useState(null);
    const [round, setRound] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [answerState, setAnswerState] = useState(null);
    const [report, setReport] = useState(null);
    const [detailVisibility, setDetailVisibility] = useState({
        question: false,
        selected: false,
        correct: false,
    });
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
    const optionButtonHeight = isWebDesktop
        ? Math.min(Math.max(width * 0.07, 120), 156)
        : veryTightLayout
          ? 72
          : tightLayout
            ? 80
            : compactLayout
              ? 88
              : 96;
    const isDesktopHanziAnswers = isWebDesktop && activeOutputMode.id === 'hanzi';
    const singleLinePinyinAnswers = activeOutputMode.id === 'pinyin';
    const meaningLines = currentQuestion
        ? getMeaningLines(currentQuestion).length > 0
            ? getMeaningLines(currentQuestion)
            : ['No meaning available.']
        : ['No meaning available.'];

    const resetDetailVisibility = () => {
        setDetailVisibility({
            question: false,
            selected: false,
            correct: false,
        });
    };

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
        resetDetailVisibility();
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
        resetDetailVisibility();
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
        resetDetailVisibility();
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
            { countAsWrong: outcome !== 'unknown' },
        );
        const nextProgress = createPracticeProgress(PROFILE_ID, nextCards);

        progressRef.current = nextProgress;
        updateProgress(nextProgress);

        setSelectedOption(option);
        setAnswerState(outcome);
        resetDetailVisibility();
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
        resetDetailVisibility();
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
                <View style={[styles.meaningStack, compactLayout && styles.meaningStackCompact]}>
                    {lines.map((line, index) => (
                        <Text
                            key={`${item.id}-${index}`}
                            style={[
                                styles.meaningLine,
                                isWebDesktop && styles.meaningLineDesktop,
                                compactLayout && styles.meaningLineCompact,
                                veryTightLayout && styles.meaningLineVeryCompact,
                            ]}
                        >
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
                    isWebDesktop && styles.questionTextDesktop,
                    isWebDesktop &&
                        inputModeId === 'pinyin' &&
                        styles.questionTextPinyinDesktop,
                    compactLayout && styles.questionTextCompact,
                    compactLayout &&
                        inputModeId === 'pinyin' &&
                        styles.questionTextPinyinCompact,
                    veryTightLayout && styles.questionTextVeryCompact,
                ]}
            >
                {getDisplayText(item, inputModeId)}
            </Text>
        );
    };

    const toggleDetailVisibility = (key) => {
        setDetailVisibility((current) => ({
            ...current,
            [key]: !current[key],
        }));
    };

    const renderDetailedMeaning = (item, detailKey, centered = false) => {
        const detailedMeaning = getDetailedMeaning(item);

        if (!detailedMeaning) {
            return null;
        }

        const isExpanded = detailVisibility[detailKey];

        return (
            <View style={[styles.detailSection, centered && styles.detailSectionCentered]}>
                <Pressable
                    onPress={() => toggleDetailVisibility(detailKey)}
                    style={({ pressed }) => [
                        styles.detailToggle,
                        centered && styles.detailToggleCentered,
                        pressed && styles.detailTogglePressed,
                    ]}
                >
                    <Ionicons
                        color={colors.accent}
                        name={isExpanded ? 'remove' : 'add'}
                        size={isWebDesktop ? 16 : 14}
                    />
                    <Text
                        style={[
                            styles.detailToggleLabel,
                            centered && styles.detailToggleLabelCentered,
                        ]}
                    >
                        {isExpanded ? 'Hide detail' : 'Detailed meaning'}
                    </Text>
                </Pressable>

                {isExpanded ? (
                    <View style={[styles.detailPanel, centered && styles.detailPanelCentered]}>
                        <Text
                            style={[
                                styles.detailText,
                                centered && styles.detailTextCentered,
                                isWebDesktop && styles.detailTextDesktop,
                            ]}
                        >
                            {detailedMeaning}
                        </Text>
                    </View>
                ) : null}
            </View>
        );
    };

    const renderAnswerRow = (item, label, detailKey, isSuccess = false, secondary = false) => (
        <View
            style={[
                styles.answerRow,
                secondary && styles.answerRowSecondary,
                isWebDesktop && styles.answerRowDesktop,
            ]}
        >
            <Text
                style={[
                    styles.answerLabel,
                    isSuccess && styles.answerLabelSuccess,
                    isWebDesktop && styles.answerLabelDesktop,
                ]}
            >
                {label}
            </Text>
            <View style={styles.answerSummaryRow}>
                <Text
                    style={[
                        styles.answerSummary,
                        isWebDesktop && styles.answerSummaryDesktop,
                    ]}
                >
                    {item.hanzi} · {item.pinyin}
                </Text>
                <AudioButton
                    hanzi={item.hanzi}
                    label={`Play ${item.hanzi} audio`}
                    style={styles.inlineAudioButton}
                />
            </View>
            <Text
                style={[
                    styles.answerTranslation,
                    isWebDesktop && styles.answerTranslationDesktop,
                ]}
            >
                {getMeaningSummary(item)}
            </Text>
            {renderDetailedMeaning(item, detailKey)}
        </View>
    );

    const optionGrid = round ? (
        <View style={[styles.optionsGrid, isWebDesktop && styles.optionsGridDesktop]}>
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
                    <View
                        key={item.id}
                        style={[
                            styles.optionWrapper,
                            isWebDesktop && styles.optionWrapperDesktop,
                        ]}
                    >
                        <ModernButton
                            title={
                                singleLinePinyinAnswers
                                    ? getDisplayText(item, activeOutputMode.id)
                                    : getDisplayLines(item, activeOutputMode.id)
                            }
                            onPress={() => handleSelection(item)}
                            variant={variant}
                            multiline={!singleLinePinyinAnswers}
                            fitText={singleLinePinyinAnswers}
                            minimumFontScale={isWebWide ? 0.86 : 0.78}
                            disabled={hasAnswered}
                            style={[
                                styles.optionButton,
                                { minHeight: optionButtonHeight },
                                compactLayout && styles.optionButtonCompact,
                                isWebDesktop && styles.optionButtonDesktop,
                            ]}
                            textStyle={[
                                styles.optionText,
                                compactLayout && styles.optionTextCompact,
                                singleLinePinyinAnswers && styles.optionTextPinyin,
                                isWebDesktop && styles.optionTextDesktop,
                                isDesktopHanziAnswers && styles.optionTextHanziDesktop,
                                isWebWide && singleLinePinyinAnswers && styles.optionTextPinyinWeb,
                            ]}
                        />
                    </View>
                );
            })}

            <View
                style={[
                    styles.revealOptionWrapper,
                    isWebDesktop && styles.revealOptionWrapperDesktop,
                ]}
            >
                <ModernButton
                    title="I don't know"
                    onPress={handleDontKnow}
                    variant="secondary"
                    disabled={hasAnswered}
                    style={[
                        styles.optionButton,
                        styles.revealButton,
                        styles.revealButtonCompact,
                        styles.revealButtonWidth,
                        compactLayout && styles.optionButtonCompact,
                        compactLayout && styles.revealButtonCompactMobile,
                        isWebDesktop && styles.optionButtonDesktop,
                        isWebDesktop && styles.revealButtonDesktop,
                        isWebDesktop && styles.revealButtonWidthDesktop,
                    ]}
                    textStyle={[
                        styles.optionText,
                        styles.revealButtonText,
                        compactLayout && styles.optionTextCompact,
                        isWebDesktop && styles.optionTextDesktop,
                        isWebDesktop && styles.revealButtonTextDesktop,
                    ]}
                />
            </View>
        </View>
    ) : null;

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
                                    as a retry for the practice scheduler.
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

                        <View
                            style={[
                                styles.practiceLayout,
                                isWebDesktop && styles.practiceLayoutDesktop,
                            ]}
                        >
                            <View
                                style={[
                                    styles.topSection,
                                    isWebDesktop && styles.topSectionDesktop,
                                ]}
                            >
                                <Card
                                    style={[
                                        styles.questionCard,
                                        isWebDesktop && styles.questionCardDesktop,
                                        compactLayout && styles.questionCardCompact,
                                        veryTightLayout && styles.questionCardVeryCompact,
                                        isCorrect && styles.questionCardCorrect,
                                        answerState === 'incorrect' && styles.questionCardWrong,
                                    ]}
                                >
                                    <View style={styles.chipRow}>
                                        <View
                                            style={[
                                                styles.modeChip,
                                                compactLayout && styles.modeChipCompact,
                                            ]}
                                        >
                                            <Ionicons
                                                color={colors.primaryStrong}
                                                name="eye"
                                                size={13}
                                            />
                                            <Text style={styles.modeChipText}>
                                                See {activeInputMode.label}
                                            </Text>
                                        </View>

                                        <View
                                            style={[
                                                styles.modeChip,
                                                styles.modeChipAccent,
                                                compactLayout && styles.modeChipCompact,
                                            ]}
                                        >
                                            <Ionicons
                                                color={colors.accent}
                                                name="checkmark-circle"
                                                size={13}
                                            />
                                            <Text
                                                style={[
                                                    styles.modeChipText,
                                                    styles.modeChipTextAccent,
                                                ]}
                                            >
                                                Answer {activeOutputMode.label}
                                            </Text>
                                        </View>
                                    </View>

                                    {renderQuestionPrompt(currentQuestion, session.inputMode)}
                                    {session.inputMode === 'eng'
                                        ? renderDetailedMeaning(currentQuestion, 'question', true)
                                        : null}

                                    <View style={styles.questionFooter}>
                                        <View style={styles.levelTag}>
                                            <Text style={styles.levelTagText}>
                                                HSK {currentQuestion?.level}
                                            </Text>
                                        </View>
                                    </View>

                                    {hasAnswered && isWebDesktop ? (
                                        <View style={styles.desktopFeedbackPanel}>
                                            <View style={styles.answerCopy}>
                                                <Text
                                                    style={[
                                                        styles.answerEyebrow,
                                                        isCorrect &&
                                                            styles.answerEyebrowSuccess,
                                                        didChooseUnknown &&
                                                            styles.answerEyebrowReveal,
                                                        isWebDesktop &&
                                                            styles.answerEyebrowDesktop,
                                                    ]}
                                                >
                                                    {isCorrect
                                                        ? 'Word details'
                                                        : didChooseUnknown
                                                          ? "Marked as I don't know"
                                                          : 'Review this pair'}
                                                </Text>
                                                {selectedOption
                                                    ? renderAnswerRow(
                                                          selectedOption,
                                                          isCorrect
                                                              ? 'Picked word'
                                                              : 'Your choice',
                                                          'selected',
                                                      )
                                                    : null}

                                                {didChooseUnknown ? (
                                                    <Text style={styles.revealNote}>
                                                        This still counts as a failed review for
                                                        the practice tab so the spaced-repetition
                                                        schedule stays honest.
                                                    </Text>
                                                ) : null}

                                                {!isCorrect ? (
                                                    renderAnswerRow(
                                                        currentQuestion,
                                                        'Correct answer',
                                                        'correct',
                                                        true,
                                                        !!selectedOption,
                                                    )
                                                ) : null}
                                            </View>

                                            <ModernButton
                                                title={
                                                    session.currentIndex + 1 ===
                                                    session.words.length
                                                        ? 'See report'
                                                        : 'Next word'
                                                }
                                                onPress={handleNextWord}
                                                style={styles.desktopFeedbackButton}
                                                variant="primary"
                                            />
                                        </View>
                                    ) : null}
                                </Card>

                                {hasAnswered && !isWebDesktop ? (
                                    <Card
                                        style={[
                                            styles.answerCard,
                                            compactLayout && styles.answerCardCompact,
                                            isWebDesktop && styles.answerCardDesktop,
                                        ]}
                                        tone={
                                            isCorrect
                                                ? 'accent'
                                                : didChooseUnknown
                                                  ? 'default'
                                                  : 'muted'
                                        }
                                    >
                                        <View style={styles.answerCopy}>
                                            <Text
                                                style={[
                                                    styles.answerEyebrow,
                                                    isCorrect && styles.answerEyebrowSuccess,
                                                    didChooseUnknown &&
                                                        styles.answerEyebrowReveal,
                                                ]}
                                            >
                                                {isCorrect
                                                    ? 'Word details'
                                                    : didChooseUnknown
                                                      ? "Marked as I don't know"
                                                      : 'Review this pair'}
                                            </Text>
                                            {selectedOption
                                                ? renderAnswerRow(
                                                      selectedOption,
                                                      isCorrect
                                                          ? 'Picked word'
                                                          : 'Your choice',
                                                      'selected',
                                                  )
                                                : null}

                                            {didChooseUnknown ? (
                                                <Text style={styles.revealNote}>
                                                    This still counts as a failed review for the
                                                    practice tab so the spaced-repetition schedule
                                                    stays honest.
                                                </Text>
                                            ) : null}

                                            {!isCorrect ? (
                                                renderAnswerRow(
                                                    currentQuestion,
                                                    'Correct answer',
                                                    'correct',
                                                    true,
                                                    !!selectedOption,
                                                )
                                            ) : null}
                                        </View>

                                        <ModernButton
                                            title={
                                                session.currentIndex + 1 === session.words.length
                                                    ? 'See report'
                                                    : tightLayout
                                                      ? 'Next'
                                                      : 'Next word'
                                            }
                                            onPress={handleNextWord}
                                            style={[
                                                styles.nextButton,
                                                compactLayout && styles.nextButtonCompact,
                                                isWebDesktop && styles.nextButtonDesktop,
                                            ]}
                                            variant="primary"
                                        />
                                    </Card>
                                ) : null}
                            </View>

                            {isWebDesktop ? (
                                <Card style={styles.optionsPanel}>
                                    <View style={styles.optionsPanelHeader}>
                                        <Text style={styles.optionsEyebrow}>Answer choices</Text>
                                    </View>

                                    {optionGrid}
                                </Card>
                            ) : (
                                <View
                                    style={[
                                        styles.optionsSection,
                                        hasAnswered && styles.optionsSectionAnswered,
                                    ]}
                                >
                                    {optionGrid}
                                </View>
                            )}
                        </View>
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
            color: colors.primaryStrong,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
        },
        heroTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 30,
            lineHeight: 34,
        },
        heroSubtitle: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 20,
            maxWidth: 760,
        },
        heroAside: {
            gap: 8,
            flex: layout.isWebDesktop ? 0.42 : undefined,
        },
        heroAsideEyebrow: {
            color: colors.accent,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
        },
        heroAsideTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 24,
            lineHeight: 28,
        },
        heroAsideText: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 20,
        },
        setupCard: {
            gap: 16,
        },
        sectionEyebrow: {
            color: colors.accent,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
        },
        sectionTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 24,
            lineHeight: 28,
        },
        sectionSubtitle: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 20,
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
            fontSize: 11,
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            color: colors.accent,
        },
        stateTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 24,
            lineHeight: 28,
        },
        stateText: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 20,
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
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 24,
            lineHeight: 28,
        },
        progressValue: {
            fontSize: 14,
            lineHeight: 20,
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
        practiceLayout: {
            gap: 12,
        },
        practiceLayoutDesktop: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 32,
        },
        topSection: {
            gap: 10,
        },
        topSectionDesktop: {
            width: layout.desktopSidebarWidth,
            gap: 18,
        },
        questionCard: {
            gap: 12,
            padding: 18,
        },
        questionCardDesktop: {
            gap: 18,
            padding: 26,
            minHeight: 390,
            justifyContent: 'center',
        },
        questionCardCompact: {
            gap: 10,
            padding: 16,
        },
        questionCardVeryCompact: {
            paddingVertical: 14,
        },
        questionCardCorrect: {
            borderColor: colors.success,
            shadowColor: colors.success,
        },
        questionCardWrong: {
            borderColor: colors.error,
            shadowColor: colors.error,
        },
        chipRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        modeChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        modeChipCompact: {
            paddingHorizontal: 9,
            paddingVertical: 5,
        },
        modeChipAccent: {
            backgroundColor: colors.accentSoft,
            borderColor: 'transparent',
        },
        modeChipText: {
            color: colors.textSecondary,
            fontSize: 12,
            lineHeight: 16,
            fontWeight: '700',
        },
        modeChipTextAccent: {
            color: colors.accent,
        },
        questionLabel: {
            color: colors.textSecondary,
            fontSize: 12,
            lineHeight: 16,
            fontWeight: '800',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
        },
        questionText: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 50,
            lineHeight: 54,
            textAlign: 'center',
        },
        questionTextDesktop: {
            fontSize: 70 + Math.round(layout.desktopScale * 10),
            lineHeight: 76 + Math.round(layout.desktopScale * 12),
        },
        questionTextCompact: {
            fontSize: 42,
            lineHeight: 46,
        },
        questionTextVeryCompact: {
            fontSize: 36,
            lineHeight: 40,
        },
        questionTextPinyin: {
            fontSize: 32,
            lineHeight: 38,
        },
        questionTextPinyinDesktop: {
            fontSize: 44 + Math.round(layout.desktopScale * 6),
            lineHeight: 50 + Math.round(layout.desktopScale * 8),
        },
        questionTextPinyinCompact: {
            fontSize: 28,
            lineHeight: 34,
        },
        meaningStack: {
            gap: 8,
            alignItems: 'center',
        },
        meaningStackCompact: {
            gap: 6,
        },
        meaningLine: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 24,
            lineHeight: 29,
            textAlign: 'center',
        },
        meaningLineDesktop: {
            fontSize: 30 + Math.round(layout.desktopScale * 4),
            lineHeight: 36 + Math.round(layout.desktopScale * 4),
        },
        meaningLineCompact: {
            fontSize: 21,
            lineHeight: 25,
        },
        meaningLineVeryCompact: {
            fontSize: 18,
            lineHeight: 22,
        },
        detailSection: {
            gap: 8,
            alignItems: 'flex-start',
        },
        detailSectionCentered: {
            width: '100%',
            alignItems: 'center',
        },
        detailToggle: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderRadius: radii.pill,
            backgroundColor: colors.accentSoft,
            borderWidth: 1,
            borderColor: 'transparent',
        },
        detailToggleCentered: {
            alignSelf: 'center',
        },
        detailTogglePressed: {
            transform: [{ scale: 0.98 }],
        },
        detailToggleLabel: {
            color: colors.accent,
            fontSize: 11,
            lineHeight: 14,
            fontWeight: '800',
            letterSpacing: 0.7,
            textTransform: 'uppercase',
        },
        detailToggleLabelCentered: {
            textAlign: 'center',
        },
        detailPanel: {
            width: '100%',
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        detailPanelCentered: {
            alignSelf: 'stretch',
        },
        detailText: {
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 19,
        },
        detailTextCentered: {
            textAlign: 'center',
        },
        detailTextDesktop: {
            fontSize: 15,
            lineHeight: 23,
        },
        questionFooter: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
        },
        levelTag: {
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: radii.pill,
            backgroundColor: colors.primarySoft,
            alignSelf: 'flex-start',
        },
        levelTagText: {
            color: colors.primaryStrong,
            fontSize: 11,
            lineHeight: 14,
            fontWeight: '800',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
        },
        answerCard: {
            flexDirection: 'row',
            alignItems: 'stretch',
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
        },
        answerCardCompact: {
            flexDirection: 'column',
            gap: 10,
        },
        answerCardDesktop: {
            gap: 14,
        },
        desktopFeedbackPanel: {
            marginTop: 6,
            gap: 18,
            paddingTop: 18,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        answerCopy: {
            flex: 1,
            gap: 8,
        },
        answerEyebrow: {
            color: colors.error,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1,
            textTransform: 'uppercase',
        },
        answerEyebrowDesktop: {
            fontSize: 14,
            letterSpacing: 1.3,
        },
        answerEyebrowSuccess: {
            color: colors.success,
        },
        answerEyebrowReveal: {
            color: colors.accent,
        },
        answerRow: {
            gap: 2,
        },
        answerRowDesktop: {
            gap: 8,
        },
        answerRowSecondary: {
            marginTop: 2,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        answerLabel: {
            color: colors.textSecondary,
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.9,
            textTransform: 'uppercase',
        },
        answerLabelDesktop: {
            fontSize: 12,
            letterSpacing: 1.1,
        },
        answerLabelSuccess: {
            color: colors.success,
        },
        answerSummaryRow: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
        },
        answerSummary: {
            color: colors.text,
            fontSize: 15,
            lineHeight: 19,
            fontWeight: '700',
        },
        answerSummaryDesktop: {
            fontSize: 24,
            lineHeight: 30,
        },
        inlineAudioButton: {
            marginTop: 1,
        },
        answerTranslation: {
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 17,
        },
        answerTranslationDesktop: {
            fontSize: 18,
            lineHeight: 27,
        },
        nextButton: {
            minHeight: 48,
            minWidth: 92,
            paddingHorizontal: 12,
            paddingVertical: 10,
            alignSelf: 'center',
        },
        nextButtonCompact: {
            minWidth: 0,
            alignSelf: 'stretch',
        },
        nextButtonDesktop: {
            minWidth: 0,
            alignSelf: 'stretch',
        },
        desktopFeedbackButton: {
            minHeight: 50,
            alignSelf: 'stretch',
        },
        optionsSection: {
            flexGrow: 1,
            justifyContent: 'center',
        },
        optionsSectionAnswered: {
            flexGrow: 0,
            justifyContent: 'flex-start',
        },
        optionsPanel: {
            flex: 1,
            gap: 18,
            padding: 24,
        },
        optionsPanelHeader: {
            gap: 10,
            width: '100%',
            maxWidth: 1120,
            alignSelf: 'center',
        },
        optionsEyebrow: {
            color: colors.primaryStrong,
            fontSize: 13,
            fontWeight: '800',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
        },
        optionsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            rowGap: 10,
        },
        optionsGridDesktop: {
            width: '100%',
            maxWidth: 1120,
            alignSelf: 'center',
            rowGap: 14,
        },
        optionWrapper: {
            width: '48%',
        },
        optionWrapperDesktop: {
            width: '48.7%',
        },
        revealOptionWrapper: {
            width: '100%',
            alignItems: 'center',
        },
        revealOptionWrapperDesktop: {
            width: '100%',
        },
        optionButton: {
            paddingHorizontal: 10,
        },
        revealButton: {
            backgroundColor: colors.surface,
            borderColor: colors.accentSoft,
        },
        revealButtonCompact: {
            minHeight: 62,
        },
        revealButtonWidth: {
            width: '48%',
        },
        revealButtonCompactMobile: {
            minHeight: 56,
        },
        revealButtonDesktop: {
            minHeight: 82,
        },
        revealButtonWidthDesktop: {
            width: '32%',
        },
        optionButtonCompact: {
            paddingHorizontal: 8,
        },
        optionButtonDesktop: {
            borderRadius: radii.lg,
            paddingHorizontal: 24,
        },
        optionText: {
            fontSize: 18,
            lineHeight: 24,
        },
        optionTextPinyin: {
            fontSize: 17,
            lineHeight: 24,
        },
        optionTextDesktop: {
            fontSize: 24 + Math.round(layout.desktopScale * 2),
            lineHeight: 31 + Math.round(layout.desktopScale * 2),
        },
        optionTextHanziDesktop: {
            fontSize: 34 + Math.round(layout.desktopScale * 4),
            lineHeight: 40 + Math.round(layout.desktopScale * 4),
        },
        optionTextPinyinWeb: {
            fontSize: 21,
            lineHeight: 30,
        },
        revealButtonText: {
            color: colors.text,
            fontSize: 16,
            lineHeight: 20,
        },
        revealButtonTextDesktop: {
            fontSize: 19,
            lineHeight: 24,
        },
        optionTextCompact: {
            fontSize: 16,
            lineHeight: 22,
        },
        revealNote: {
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 19,
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
