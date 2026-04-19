import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import Card from '../components/Card';
import BackdropOrbs from '../components/BackdropOrbs';
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
    getDetailedMeaning,
    getMeaningLines,
    getTrainingSnapshot,
    MINIMUM_ITEMS_PER_ROUND,
    pickNextQuestion,
    recordRoundResult,
} from '../utils/practice';

import hskData from '../../assets/hsk_1_6_pdf_dataset_english.json';

const PROFILE_ID = DEFAULT_PROFILE_ID;

const PracticeScreen = () => {
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
                desktopContentMinHeight,
                desktopScale,
                desktopSidebarWidth,
            }),
        [
            colors,
            radii,
            shadows,
            typography,
            isWebWide,
            isWebDesktop,
            contentMaxWidth,
            desktopContentMinHeight,
            desktopScale,
            desktopSidebarWidth,
        ],
    );
    const compactLayout = !isWebDesktop && height < 780;
    const tightLayout = !isWebDesktop && height < 700;
    const veryTightLayout = !isWebDesktop && height < 640;
    const optionButtonHeight = isWebDesktop
        ? Math.min(Math.max(width * 0.07, 120), 156)
        : veryTightLayout
          ? 72
          : tightLayout
            ? 80
            : compactLayout
              ? 88
              : 96;
    const [round, setRound] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [answerState, setAnswerState] = useState(null);
    const [streak, setStreak] = useState(0);
    const [isSnapshotVisible, setIsSnapshotVisible] = useState(false);
    const [detailVisibility, setDetailVisibility] = useState({
        question: false,
        selected: false,
        correct: false,
    });
    const progressRef = useRef(createPracticeProgress(PROFILE_ID));
    const recentQuestionIdsRef = useRef([]);

    const inputMode = getPracticeMode(settings.inputMode);
    const outputMode = getPracticeMode(settings.outputMode);
    const levelKey = settings.hskLevels.join('-');
    const filteredData = useMemo(
        () => hskData.filter((item) => settings.hskLevels.includes(item.level)),
        [levelKey],
    );
    const recentQuestionLimit =
        filteredData.length <= 12 ? 4 : filteredData.length <= 40 ? 6 : 8;
    const levelSummary =
        settings.hskLevels.length === 6
            ? 'HSK 1-6'
            : settings.hskLevels.map((level) => `HSK ${level}`).join(' · ');

    const getMeaningSummary = (item) => {
        const lines = getMeaningLines(item);
        const safeLines = lines.length > 0 ? lines : ['No meaning available.'];

        return safeLines.join(', ');
    };

    const rememberQuestion = (questionId) => {
        recentQuestionIdsRef.current = [
            questionId,
            ...recentQuestionIdsRef.current.filter((recentId) => recentId !== questionId),
        ].slice(0, recentQuestionLimit);
    };

    const resetDetailVisibility = () => {
        setDetailVisibility({
            question: false,
            selected: false,
            correct: false,
        });
    };

    const loadRound = (cards = progressRef.current.cards) => {
        if (filteredData.length < MINIMUM_ITEMS_PER_ROUND) {
            setRound(null);
            setSelectedOption(null);
            setAnswerState(null);
            resetDetailVisibility();
            return;
        }

        const nextQuestion = pickNextQuestion(
            filteredData,
            cards,
            new Date(),
            recentQuestionIdsRef.current,
        );

        if (nextQuestion) {
            rememberQuestion(nextQuestion.id);
        }

        setRound(
            nextQuestion ? buildRound(filteredData, nextQuestion, settings.outputMode) : null,
        );
        setSelectedOption(null);
        setAnswerState(null);
        resetDetailVisibility();
    };

    useEffect(() => {
        progressRef.current = progress;
    }, [progress]);

    useEffect(() => {
        if (!isHydrated) {
            return;
        }

        recentQuestionIdsRef.current = [];
        setStreak(0);
        loadRound(progressRef.current.cards);
    }, [isHydrated, levelKey]);

    const handleSelection = (item) => {
        if (!round || answerState || !isHydrated) {
            return;
        }

        const answerIsCorrect = item.id === round.question.id;
        const nextCards = recordRoundResult(
            progressRef.current.cards,
            round.question,
            answerIsCorrect,
            new Date(),
        );

        setSelectedOption(item);
        setAnswerState(answerIsCorrect ? 'correct' : 'wrong');
        resetDetailVisibility();
        const nextProgress = createPracticeProgress(PROFILE_ID, nextCards);
        progressRef.current = nextProgress;
        updateProgress(nextProgress);

        if (answerIsCorrect) {
            setStreak((current) => current + 1);
            return;
        }

        setStreak(0);
    };

    const handleRevealAnswer = () => {
        if (!round || answerState || !isHydrated) {
            return;
        }

        setSelectedOption(null);
        setAnswerState('revealed');
        resetDetailVisibility();
    };

    const handleNextCard = () => {
        loadRound(progressRef.current.cards);
    };
    const openTrainingSnapshot = () => {
        setIsSnapshotVisible(true);
    };
    const closeTrainingSnapshot = () => {
        setIsSnapshotVisible(false);
    };

    const trainingSnapshot =
        isHydrated && filteredData.length > 0
            ? getTrainingSnapshot(filteredData, progress.cards, new Date())
            : null;
    const reviewLadderMax = trainingSnapshot
        ? Math.max(1, ...trainingSnapshot.boxCounts)
        : 1;
    const trainingSnapshotTrigger = trainingSnapshot ? (
        <Pressable
            onPress={openTrainingSnapshot}
            style={({ pressed }) => [
                styles.snapshotTrigger,
                pressed && styles.snapshotTriggerPressed,
            ]}
        >
            <Ionicons color={colors.accent} name="stats-chart" size={16} />
            <View style={styles.snapshotTriggerCopy}>
                <Text style={styles.snapshotTriggerLabel}>Progress</Text>
                <Text style={styles.snapshotTriggerValue}>
                    {trainingSnapshot.readyNowCount} ready now
                </Text>
            </View>
            <Ionicons color={colors.textMuted} name="chevron-forward" size={16} />
        </Pressable>
    ) : null;
    const trainingSnapshotContent = trainingSnapshot ? (
        <View style={styles.snapshotContent}>
            <View style={styles.snapshotHeader}>
                <Text style={styles.snapshotEyebrow}>Training snapshot</Text>
                <Text style={[styles.snapshotTitle, isWebDesktop && styles.snapshotTitleDesktop]}>
                    {trainingSnapshot.studiedCount}/{trainingSnapshot.totalCount} words introduced
                </Text>
                <Text style={styles.snapshotSubtitle}>
                    {trainingSnapshot.readyNowCount} ready now, {trainingSnapshot.scheduledCount}{' '}
                    scheduled later.
                </Text>
            </View>

            <View style={styles.snapshotProgressTrack}>
                <View
                    style={[
                        styles.snapshotProgressFill,
                        {
                            width: `${Math.max(
                                trainingSnapshot.completionRatio * 100,
                                trainingSnapshot.studiedCount > 0 ? 8 : 0,
                            )}%`,
                        },
                    ]}
                />
            </View>

            <View style={styles.snapshotMetricsGrid}>
                {[
                    {
                        id: 'ready',
                        label: 'Ready now',
                        value: trainingSnapshot.readyNowCount,
                    },
                    {
                        id: 'new',
                        label: 'New',
                        value: trainingSnapshot.newCount,
                    },
                    {
                        id: 'scheduled',
                        label: 'Scheduled',
                        value: trainingSnapshot.scheduledCount,
                    },
                    {
                        id: 'mastered',
                        label: 'Mastered',
                        value: trainingSnapshot.masteredCount,
                    },
                ].map((metric) => (
                    <View key={metric.id} style={styles.snapshotMetric}>
                        <Text style={styles.snapshotMetricValue}>{metric.value}</Text>
                        <Text style={styles.snapshotMetricLabel}>{metric.label}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.snapshotSectionHeader}>
                <Text style={styles.snapshotSectionTitle}>Review ladder</Text>
                <Text style={styles.snapshotSectionHint}>Words currently in each stage</Text>
            </View>

            <View style={[styles.ladderGrid, isWebDesktop && styles.ladderGridDesktop]}>
                {trainingSnapshot.boxCounts.map((count, index) => (
                    <View
                        key={`box-${index + 1}`}
                        style={[styles.ladderCard, isWebDesktop && styles.ladderCardDesktop]}
                    >
                        <Text style={styles.ladderLabel}>Box {index + 1}</Text>
                        <Text
                            style={[
                                styles.ladderValue,
                                index === trainingSnapshot.boxCounts.length - 1 &&
                                    styles.ladderValueMastered,
                            ]}
                        >
                            {count}
                        </Text>
                        <View style={styles.ladderTrack}>
                            <View
                                style={[
                                    styles.ladderFill,
                                    {
                                        width: `${Math.max(
                                            (count / reviewLadderMax) * 100,
                                            count > 0 ? 16 : 0,
                                        )}%`,
                                    },
                                    index === trainingSnapshot.boxCounts.length - 1 &&
                                        styles.ladderFillMastered,
                                ]}
                            />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    ) : null;

    if (!round) {
        const showRefreshButton =
            isHydrated && filteredData.length >= MINIMUM_ITEMS_PER_ROUND;
        const emptyState = !isHydrated
            ? {
                  eyebrow: 'Practice',
                  title: 'Restoring your review memory.',
                  text: 'Loading the words you have already studied so your next cards stay meaningful.',
              }
            : filteredData.length < MINIMUM_ITEMS_PER_ROUND
              ? {
                    eyebrow: 'Practice',
                    title: 'Not enough words for a round yet.',
                    text: 'Choose a few HSK levels in settings so we can build six answer choices.',
                }
              : {
                    eyebrow: 'Caught up',
                    title: "You're done for now.",
                    text: `No review or new cards are due across ${levelSummary}. Come back a little later or switch HSK levels to study a different pool.`,
                };

        return (
            <SafeAreaView style={styles.container}>
                <BackdropOrbs />
                <View style={[styles.emptyState, isWebWide && styles.emptyStateWeb]}>
                    <Card style={[styles.emptyCard, isWebWide && styles.emptyCardWeb]}>
                        <Text style={styles.emptyEyebrow}>{emptyState.eyebrow}</Text>
                        <Text style={styles.emptyTitle}>{emptyState.title}</Text>
                        <Text style={styles.emptyText}>{emptyState.text}</Text>
                        {trainingSnapshotTrigger}
                        {showRefreshButton ? (
                            <ModernButton
                                title="Check again"
                                onPress={handleNextCard}
                                style={styles.emptyAction}
                            />
                        ) : null}
                    </Card>
                </View>
                {trainingSnapshot ? (
                    <Modal
                        animationType="fade"
                        onRequestClose={closeTrainingSnapshot}
                        transparent
                        visible={isSnapshotVisible}
                    >
                        <View style={styles.snapshotModalRoot}>
                            <Pressable
                                onPress={closeTrainingSnapshot}
                                style={styles.snapshotBackdrop}
                            />
                            <ScrollView
                                contentContainerStyle={styles.snapshotModalScroll}
                                showsVerticalScrollIndicator={false}
                            >
                                <Card
                                    style={[
                                        styles.snapshotCard,
                                        styles.snapshotModalCard,
                                        isWebDesktop && styles.snapshotCardDesktop,
                                        isWebDesktop && styles.snapshotModalCardDesktop,
                                    ]}
                                >
                                    <View style={styles.snapshotModalTopRow}>
                                        <View style={styles.snapshotModalBadge}>
                                            <Ionicons
                                                color={colors.accent}
                                                name="stats-chart"
                                                size={15}
                                            />
                                            <Text style={styles.snapshotModalBadgeText}>
                                                Progress
                                            </Text>
                                        </View>

                                        <Pressable
                                            onPress={closeTrainingSnapshot}
                                            style={({ pressed }) => [
                                                styles.snapshotCloseButton,
                                                pressed && styles.snapshotCloseButtonPressed,
                                            ]}
                                        >
                                            <Ionicons
                                                color={colors.textSecondary}
                                                name="close"
                                                size={18}
                                            />
                                        </Pressable>
                                    </View>

                                    {trainingSnapshotContent}
                                </Card>
                            </ScrollView>
                        </View>
                    </Modal>
                ) : null}
            </SafeAreaView>
        );
    }

    const { question, options } = round;
    const hasAnswered = answerState !== null;
    const isCorrect = answerState === 'correct';
    const didRevealAnswer = answerState === 'revealed';
    const isDesktopHanziAnswers = isWebDesktop && settings.outputMode === 'hanzi';
    const singleLinePinyinAnswers = settings.outputMode === 'pinyin';
    const meanings = getMeaningLines(question);
    const meaningLines = meanings.length > 0 ? meanings : ['No meaning available.'];
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
            <Text
                style={[
                    styles.answerSummary,
                    isWebDesktop && styles.answerSummaryDesktop,
                ]}
            >
                {item.hanzi} · {item.pinyin}
            </Text>
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
    const optionGrid = (
        <View style={[styles.optionsGrid, isWebDesktop && styles.optionsGridDesktop]}>
            {options.map((item) => {
                const isSelected = selectedOption?.id === item.id;
                const isAnswer = item.id === question.id;
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
                        style={[styles.optionWrapper, isWebDesktop && styles.optionWrapperDesktop]}
                    >
                        <ModernButton
                            title={
                                singleLinePinyinAnswers
                                    ? getDisplayText(item, settings.outputMode)
                                    : getDisplayLines(item, settings.outputMode)
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
                    onPress={handleRevealAnswer}
                    variant="secondary"
                    disabled={hasAnswered}
                    style={[
                        styles.optionButton,
                        styles.revealButton,
                        styles.revealButtonCompact,
                        compactLayout && styles.optionButtonCompact,
                        compactLayout && styles.revealButtonCompactMobile,
                        isWebDesktop && styles.optionButtonDesktop,
                        isWebDesktop && styles.revealButtonDesktop,
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
    );

    return (
        <SafeAreaView style={styles.container}>
            <BackdropOrbs />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.content,
                    compactLayout && styles.contentCompact,
                    isWebWide && styles.contentWeb,
                    isWebDesktop && styles.contentDesktop,
                ]}
                showsVerticalScrollIndicator={false}
            >
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
                        <View style={styles.hero}>
                            <View style={styles.heroCopy}>
                                <Text style={styles.eyebrow}>Practice</Text>
                                <Text
                                    style={[
                                        styles.heroTitle,
                                        isWebDesktop && styles.heroTitleDesktop,
                                        compactLayout && styles.heroTitleCompact,
                                        veryTightLayout && styles.heroTitleVeryCompact,
                                    ]}
                                >
                                    Practice
                                </Text>
                                <Text
                                    numberOfLines={
                                        isWebDesktop ? 3 : hasAnswered ? 1 : compactLayout ? 2 : 3
                                    }
                                    style={[
                                        styles.heroSubtitle,
                                        isWebDesktop && styles.heroSubtitleDesktop,
                                        compactLayout && styles.heroSubtitleCompact,
                                    ]}
                                >
                                    See {inputMode.chipLabel.toLowerCase()}, answer with{' '}
                                    {outputMode.chipLabel.toLowerCase()}, across {levelSummary}.
                                </Text>
                                {trainingSnapshotTrigger}
                            </View>

                            <View
                                style={[
                                    styles.streakBadge,
                                    compactLayout && styles.streakBadgeCompact,
                                    isWebDesktop && styles.streakBadgeDesktop,
                                ]}
                            >
                                <Ionicons
                                    color={colors.primaryStrong}
                                    name="flame"
                                    size={compactLayout ? 16 : 18}
                                />
                                <Text
                                    style={[
                                        styles.streakValue,
                                        compactLayout && styles.streakValueCompact,
                                        isWebDesktop && styles.streakValueDesktop,
                                    ]}
                                >
                                    {streak}
                                </Text>
                                <Text
                                    style={[
                                        styles.streakLabel,
                                        isWebDesktop && styles.streakLabelDesktop,
                                    ]}
                                >
                                    streak
                                </Text>
                            </View>
                        </View>

                        <Card
                            style={[
                                styles.questionCard,
                                isWebDesktop && styles.questionCardDesktop,
                                compactLayout && styles.questionCardCompact,
                                veryTightLayout && styles.questionCardVeryCompact,
                                isCorrect && styles.questionCardCorrect,
                                answerState === 'wrong' && styles.questionCardWrong,
                            ]}
            >
                            <View style={styles.chipRow}>
                                <View style={[styles.modeChip, compactLayout && styles.modeChipCompact]}>
                                    <Ionicons color={colors.primaryStrong} name="eye" size={13} />
                                    <Text style={styles.modeChipText}>See {inputMode.label}</Text>
                                </View>

                                <View
                                    style={[
                                        styles.modeChip,
                                        styles.modeChipAccent,
                                        compactLayout && styles.modeChipCompact,
                                    ]}
                                >
                                    <Ionicons color={colors.accent} name="checkmark-circle" size={13} />
                                    <Text style={[styles.modeChipText, styles.modeChipTextAccent]}>
                                        Answer {outputMode.label}
                                    </Text>
                                </View>
                            </View>

                            <Text
                                style={[
                                    styles.questionLabel,
                                    isWebDesktop && styles.questionLabelDesktop,
                                ]}
                            >
                                Pick the matching answer
                            </Text>

                            {settings.inputMode === 'eng' ? (
                                <View style={[styles.meaningStack, compactLayout && styles.meaningStackCompact]}>
                                    {meaningLines.map((line) => (
                                        <Text
                                            key={line}
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
                                    {renderDetailedMeaning(question, 'question', true)}
                                </View>
                            ) : (
                                <Text
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.72}
                                    numberOfLines={settings.inputMode === 'pinyin' ? 2 : 1}
                                    style={[
                                        styles.questionText,
                                        settings.inputMode === 'pinyin' && styles.questionTextPinyin,
                                        isWebDesktop && styles.questionTextDesktop,
                                        isWebDesktop &&
                                            settings.inputMode === 'pinyin' &&
                                            styles.questionTextPinyinDesktop,
                                        compactLayout && styles.questionTextCompact,
                                        compactLayout &&
                                            settings.inputMode === 'pinyin' &&
                                            styles.questionTextPinyinCompact,
                                        veryTightLayout && styles.questionTextVeryCompact,
                                    ]}
                                >
                                    {getDisplayText(question, settings.inputMode)}
                                </Text>
                            )}

                            <View style={styles.questionFooter}>
                                <View style={styles.levelTag}>
                                    <Text style={styles.levelTagText}>HSK {question.level}</Text>
                                </View>
                                {!tightLayout && !isWebDesktop ? (
                                    <Text style={styles.helperText}>
                                        {hasAnswered
                                            ? 'Review the answer, then move to the next card.'
                                            : "Choose from six options, or reveal the answer if you're stuck."}
                                    </Text>
                                ) : null}
                            </View>

                            {hasAnswered && isWebDesktop ? (
                                <View style={styles.desktopFeedbackPanel}>
                                    <View style={styles.answerCopy}>
                                        <Text
                                            style={[
                                                styles.answerEyebrow,
                                                isCorrect && styles.answerEyebrowSuccess,
                                                didRevealAnswer && styles.answerEyebrowReveal,
                                                isWebDesktop && styles.answerEyebrowDesktop,
                                            ]}
                                        >
                                            {isCorrect
                                                ? 'Word details'
                                                : didRevealAnswer
                                                  ? 'Answer revealed'
                                                  : 'Review this pair'}
                                        </Text>
                                        {selectedOption
                                            ? renderAnswerRow(
                                                  selectedOption,
                                                  isCorrect ? 'Picked word' : 'Your choice',
                                                  'selected',
                                              )
                                            : null}

                                        {didRevealAnswer ? (
                                            <Text style={styles.revealNote}>
                                                This card was revealed without counting as correct
                                                or wrong.
                                            </Text>
                                        ) : null}

                                        {!isCorrect ? (
                                            renderAnswerRow(
                                                question,
                                                didRevealAnswer ? 'Answer' : 'Correct answer',
                                                'correct',
                                                true,
                                                !!selectedOption,
                                            )
                                        ) : null}
                                    </View>

                                    <ModernButton
                                        title="Next card"
                                        onPress={handleNextCard}
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
                                tone={isCorrect ? 'accent' : didRevealAnswer ? 'default' : 'muted'}
                            >
                                <View style={styles.answerCopy}>
                                    <Text
                                        style={[
                                            styles.answerEyebrow,
                                            isCorrect && styles.answerEyebrowSuccess,
                                            didRevealAnswer && styles.answerEyebrowReveal,
                                        ]}
                                    >
                                        {isCorrect
                                            ? 'Word details'
                                            : didRevealAnswer
                                              ? 'Answer revealed'
                                              : 'Review this pair'}
                                    </Text>
                                    {selectedOption
                                        ? renderAnswerRow(
                                              selectedOption,
                                              isCorrect ? 'Picked word' : 'Your choice',
                                              'selected',
                                          )
                                        : null}

                                    {didRevealAnswer ? (
                                        <Text style={styles.revealNote}>
                                            This card was revealed without counting as correct or
                                            wrong.
                                        </Text>
                                    ) : null}

                                    {!isCorrect ? (
                                        renderAnswerRow(
                                            question,
                                            didRevealAnswer ? 'Answer' : 'Correct answer',
                                            'correct',
                                            true,
                                            !!selectedOption,
                                        )
                                    ) : null}
                                </View>

                                <ModernButton
                                    title={tightLayout ? 'Next' : 'Next card'}
                                    onPress={handleNextCard}
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
                                <Text style={styles.optionsTitle}>
                                    {hasAnswered
                                        ? didRevealAnswer
                                            ? 'The answer is revealed. Move on when you are ready.'
                                            : 'Review the result, then keep the streak moving.'
                                        : "Choose the matching word, or reveal it if you truly don't know."}
                                </Text>
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
            </ScrollView>
            {trainingSnapshot ? (
                <Modal
                    animationType="fade"
                    onRequestClose={closeTrainingSnapshot}
                    transparent
                    visible={isSnapshotVisible}
                >
                    <View style={styles.snapshotModalRoot}>
                        <Pressable onPress={closeTrainingSnapshot} style={styles.snapshotBackdrop} />
                        <ScrollView
                            contentContainerStyle={styles.snapshotModalScroll}
                            showsVerticalScrollIndicator={false}
                        >
                            <Card
                                style={[
                                    styles.snapshotCard,
                                    styles.snapshotModalCard,
                                    isWebDesktop && styles.snapshotCardDesktop,
                                    isWebDesktop && styles.snapshotModalCardDesktop,
                                ]}
                            >
                                <View style={styles.snapshotModalTopRow}>
                                    <View style={styles.snapshotModalBadge}>
                                        <Ionicons
                                            color={colors.accent}
                                            name="stats-chart"
                                            size={15}
                                        />
                                        <Text style={styles.snapshotModalBadgeText}>Progress</Text>
                                    </View>

                                    <Pressable
                                        onPress={closeTrainingSnapshot}
                                        style={({ pressed }) => [
                                            styles.snapshotCloseButton,
                                            pressed && styles.snapshotCloseButtonPressed,
                                        ]}
                                    >
                                        <Ionicons
                                            color={colors.textSecondary}
                                            name="close"
                                            size={18}
                                        />
                                    </Pressable>
                                </View>

                                {trainingSnapshotContent}
                            </Card>
                        </ScrollView>
                    </View>
                </Modal>
            ) : null}
        </SafeAreaView>
    );
};

const createStyles = (colors, radii, shadows, typography, layout) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        scrollView: {
            flex: 1,
        },
        content: {
            flexGrow: 1,
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 12,
            gap: 12,
        },
        contentCompact: {
            gap: 10,
            paddingTop: 6,
        },
        contentWeb: {
            width: '100%',
            maxWidth: layout.contentMaxWidth,
            alignSelf: 'center',
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 148,
            gap: 18,
        },
        contentDesktop: {
            minHeight: layout.desktopContentMinHeight,
            justifyContent: 'center',
            paddingTop: 32,
            paddingBottom: 108,
            paddingHorizontal: 36,
            gap: 28,
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
        hero: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
        },
        heroCopy: {
            flex: 1,
            gap: 4,
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
        heroTitleDesktop: {
            fontSize: 40 + Math.round(layout.desktopScale * 6),
            lineHeight: 44 + Math.round(layout.desktopScale * 8),
        },
        heroTitleCompact: {
            fontSize: 25,
            lineHeight: 28,
        },
        heroTitleVeryCompact: {
            fontSize: 22,
            lineHeight: 25,
        },
        heroSubtitle: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 20,
        },
        heroSubtitleDesktop: {
            fontSize: 16,
            lineHeight: 24,
            maxWidth: 360,
        },
        heroSubtitleCompact: {
            fontSize: 13,
            lineHeight: 18,
        },
        streakBadge: {
            minWidth: 76,
            paddingHorizontal: 12,
            paddingVertical: 10,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            ...shadows.sm,
        },
        streakBadgeCompact: {
            minWidth: 70,
            paddingVertical: 8,
        },
        streakBadgeDesktop: {
            minWidth: 104,
            paddingHorizontal: 18,
            paddingVertical: 16,
            borderRadius: radii.lg,
        },
        streakValue: {
            color: colors.text,
            fontSize: 24,
            fontWeight: '800',
            lineHeight: 28,
        },
        streakValueCompact: {
            fontSize: 22,
            lineHeight: 24,
        },
        streakValueDesktop: {
            fontSize: 30 + Math.round(layout.desktopScale * 4),
            lineHeight: 34 + Math.round(layout.desktopScale * 4),
        },
        streakLabel: {
            color: colors.textSecondary,
            fontSize: 10,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        streakLabelDesktop: {
            fontSize: 11,
            letterSpacing: 1.2,
        },
        snapshotTrigger: {
            marginTop: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            alignSelf: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: radii.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            ...shadows.sm,
        },
        snapshotTriggerPressed: {
            transform: [{ scale: 0.985 }],
        },
        snapshotTriggerCopy: {
            gap: 1,
        },
        snapshotTriggerLabel: {
            color: colors.textSecondary,
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
        },
        snapshotTriggerValue: {
            color: colors.text,
            fontSize: 13,
            lineHeight: 17,
            fontWeight: '700',
        },
        snapshotCard: {
            gap: 14,
            padding: 18,
        },
        snapshotCardDesktop: {
            gap: 18,
            padding: 22,
        },
        snapshotContent: {
            gap: 14,
        },
        snapshotHeader: {
            gap: 4,
        },
        snapshotEyebrow: {
            color: colors.accent,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
        },
        snapshotTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 24,
            lineHeight: 28,
        },
        snapshotTitleDesktop: {
            fontSize: 28,
            lineHeight: 32,
        },
        snapshotSubtitle: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 20,
        },
        snapshotProgressTrack: {
            height: 10,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceMuted,
            overflow: 'hidden',
        },
        snapshotProgressFill: {
            height: '100%',
            borderRadius: radii.pill,
            backgroundColor: colors.primaryStrong,
        },
        snapshotMetricsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        snapshotMetric: {
            width: '48%',
            gap: 2,
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        snapshotMetricValue: {
            color: colors.text,
            fontSize: 22,
            lineHeight: 26,
            fontWeight: '800',
        },
        snapshotMetricLabel: {
            color: colors.textSecondary,
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
        },
        snapshotSectionHeader: {
            gap: 2,
        },
        snapshotSectionTitle: {
            color: colors.text,
            fontSize: 15,
            lineHeight: 20,
            fontWeight: '800',
        },
        snapshotSectionHint: {
            color: colors.textMuted,
            fontSize: 12,
            lineHeight: 17,
        },
        ladderGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        ladderGridDesktop: {
            gap: 10,
        },
        ladderCard: {
            width: '31%',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        ladderCardDesktop: {
            width: '15.4%',
        },
        ladderLabel: {
            color: colors.textMuted,
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
        },
        ladderValue: {
            color: colors.text,
            fontSize: 22,
            lineHeight: 26,
            fontWeight: '800',
        },
        ladderValueMastered: {
            color: colors.success,
        },
        ladderTrack: {
            height: 7,
            borderRadius: radii.pill,
            backgroundColor: colors.backgroundMuted,
            overflow: 'hidden',
        },
        ladderFill: {
            height: '100%',
            borderRadius: radii.pill,
            backgroundColor: colors.accent,
        },
        ladderFillMastered: {
            backgroundColor: colors.success,
        },
        snapshotModalRoot: {
            flex: 1,
            justifyContent: 'center',
        },
        snapshotBackdrop: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: colors.overlay,
        },
        snapshotModalScroll: {
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 18,
            paddingVertical: 28,
        },
        snapshotModalCard: {
            width: '100%',
            maxWidth: 760,
            alignSelf: 'center',
        },
        snapshotModalCardDesktop: {
            maxWidth: 820,
        },
        snapshotModalTopRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
        },
        snapshotModalBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: radii.pill,
            backgroundColor: colors.accentSoft,
            alignSelf: 'flex-start',
        },
        snapshotModalBadgeText: {
            color: colors.accent,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1,
            textTransform: 'uppercase',
        },
        snapshotCloseButton: {
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        snapshotCloseButtonPressed: {
            transform: [{ scale: 0.96 }],
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
            fontWeight: '700',
        },
        modeChipTextAccent: {
            color: colors.accent,
        },
        questionLabel: {
            color: colors.textSecondary,
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
        },
        questionLabelDesktop: {
            fontSize: 15,
            letterSpacing: 1.6,
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
            fontWeight: '800',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
        },
        helperText: {
            flex: 1,
            color: colors.textSecondary,
            fontSize: 12,
            lineHeight: 16,
            textAlign: 'right',
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
        optionsTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 38 + Math.round(layout.desktopScale * 4),
            lineHeight: 42 + Math.round(layout.desktopScale * 6),
            maxWidth: 600,
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
            width: '48%',
            alignSelf: 'center',
        },
        revealOptionWrapperDesktop: {
            width: '32%',
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
        revealButtonCompactMobile: {
            minHeight: 56,
        },
        revealButtonDesktop: {
            minHeight: 82,
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
        answerEyebrowReveal: {
            color: colors.accent,
        },
        revealNote: {
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 19,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: 20,
            gap: 12,
        },
        emptyStateWeb: {
            width: '100%',
            maxWidth: 760,
            alignSelf: 'center',
        },
        emptyCard: {
            gap: 10,
        },
        emptyCardWeb: {
            padding: 28,
        },
        emptyAction: {
            marginTop: 6,
        },
        emptyEyebrow: {
            color: colors.primaryStrong,
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
        },
        emptyTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 30,
            lineHeight: 34,
        },
        emptyText: {
            color: colors.textSecondary,
            fontSize: 16,
            lineHeight: 24,
        },
    });

export default PracticeScreen;
