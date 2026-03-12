import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import Card from '../components/Card';
import BackdropOrbs from '../components/BackdropOrbs';
import ModernButton from '../components/ModernButton';
import { getPracticeMode } from '../constants/practiceModes';
import { useAppTheme } from '../theme/ThemeProvider';
import { getResponsiveLayout } from '../utils/layout';
import {
    buildRound,
    createPracticeScheduler,
    getDisplayLines,
    getDisplayText,
    getMeaningLines,
    pickNextQuestion,
    recordRoundResult,
} from '../utils/practice';

import hskData from '../../assets/hsk.json';

const PracticeScreen = ({ settings }) => {
    const { width, height } = useWindowDimensions();
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
    const compactLayout = !isWebDesktop && height < 780;
    const tightLayout = !isWebDesktop && height < 700;
    const veryTightLayout = !isWebDesktop && height < 640;
    const optionButtonHeight = isWebDesktop
        ? 112
        : veryTightLayout
          ? 72
          : tightLayout
            ? 80
            : compactLayout
              ? 88
              : 96;
    const [round, setRound] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isCorrect, setIsCorrect] = useState(null);
    const [streak, setStreak] = useState(0);
    const schedulerRef = useRef({});
    const reviewStepRef = useRef(0);
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

    const loadRound = (step = reviewStepRef.current) => {
        const nextQuestion = pickNextQuestion(
            filteredData,
            schedulerRef.current,
            step,
            recentQuestionIdsRef.current,
        );

        if (nextQuestion) {
            rememberQuestion(nextQuestion.id);
        }

        setRound(buildRound(filteredData, nextQuestion));
        setSelectedOption(null);
        setIsCorrect(null);
    };

    useEffect(() => {
        schedulerRef.current = createPracticeScheduler(filteredData);
        reviewStepRef.current = 0;
        recentQuestionIdsRef.current = [];
        setStreak(0);
        loadRound(0);
    }, [levelKey]);

    const handleSelection = (item) => {
        if (!round || selectedOption) {
            return;
        }

        const answerIsCorrect = item.id === round.question.id;

        setSelectedOption(item);
        setIsCorrect(answerIsCorrect);
        schedulerRef.current = recordRoundResult(
            schedulerRef.current,
            round.question,
            answerIsCorrect,
            reviewStepRef.current,
        );

        if (answerIsCorrect) {
            setStreak((current) => current + 1);
            return;
        }

        setStreak(0);
    };

    const handleNextCard = () => {
        reviewStepRef.current += 1;
        loadRound(reviewStepRef.current);
    };

    if (!round) {
        return (
            <SafeAreaView style={styles.container}>
                <BackdropOrbs />
                <View style={[styles.emptyState, isWebWide && styles.emptyStateWeb]}>
                    <Card style={[styles.emptyCard, isWebWide && styles.emptyCardWeb]}>
                        <Text style={styles.emptyEyebrow}>Practice</Text>
                        <Text style={styles.emptyTitle}>Not enough words for a round yet.</Text>
                        <Text style={styles.emptyText}>
                            Choose a few HSK levels in settings so we can build six answer choices.
                        </Text>
                    </Card>
                </View>
            </SafeAreaView>
        );
    }

    const { question, options } = round;
    const hasAnswered = !!selectedOption;
    const meanings = getMeaningLines(question);
    const meaningLines = meanings.length > 0 ? meanings : ['No meaning available.'];
    const meaningSummary = meaningLines.join(', ');
    const selectedMeaningSummary = selectedOption ? getMeaningSummary(selectedOption) : '';
    const optionGrid = (
        <View style={[styles.optionsGrid, isWebDesktop && styles.optionsGridDesktop]}>
            {options.map((item) => {
                const isSelected = selectedOption?.id === item.id;
                const isAnswer = item.id === question.id;
                let variant = 'secondary';

                if (selectedOption) {
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
                            title={getDisplayLines(item, settings.outputMode)}
                            onPress={() => handleSelection(item)}
                            variant={variant}
                            multiline
                            disabled={!!selectedOption}
                            style={[
                                styles.optionButton,
                                { minHeight: optionButtonHeight },
                                compactLayout && styles.optionButtonCompact,
                                isWebDesktop && styles.optionButtonDesktop,
                            ]}
                            textStyle={[
                                styles.optionText,
                                compactLayout && styles.optionTextCompact,
                                isWebDesktop && styles.optionTextDesktop,
                            ]}
                        />
                    </View>
                );
            })}
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
                                <Text style={styles.eyebrow}>Daily practice</Text>
                                <Text
                                    style={[
                                        styles.heroTitle,
                                        isWebDesktop && styles.heroTitleDesktop,
                                        compactLayout && styles.heroTitleCompact,
                                        veryTightLayout && styles.heroTitleVeryCompact,
                                    ]}
                                >
                                    Quick recognition drills.
                                </Text>
                                <Text
                                    numberOfLines={
                                        isWebDesktop ? 3 : selectedOption ? 1 : compactLayout ? 2 : 3
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
                                isCorrect === true && styles.questionCardCorrect,
                                isCorrect === false && styles.questionCardWrong,
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

                            <Text style={styles.questionLabel}>Pick the matching answer</Text>

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
                                        {selectedOption
                                            ? 'Review the word details, then move to the next card.'
                                            : 'Choose from six options.'}
                                    </Text>
                                ) : null}
                            </View>

                            {selectedOption && isWebDesktop ? (
                                <View style={styles.desktopFeedbackPanel}>
                                    <View style={styles.answerCopy}>
                                        <Text
                                            style={[
                                                styles.answerEyebrow,
                                                isCorrect && styles.answerEyebrowSuccess,
                                            ]}
                                        >
                                            {isCorrect ? 'Word details' : 'Review this pair'}
                                        </Text>
                                        <View style={styles.answerRow}>
                                            <Text style={styles.answerLabel}>
                                                {isCorrect ? 'Picked word' : 'Your choice'}
                                            </Text>
                                            <Text style={styles.answerSummary}>
                                                {selectedOption.hanzi} · {selectedOption.pinyin}
                                            </Text>
                                            <Text style={styles.answerTranslation}>
                                                {selectedMeaningSummary}
                                            </Text>
                                        </View>

                                        {!isCorrect ? (
                                            <View style={[styles.answerRow, styles.answerRowSecondary]}>
                                                <Text
                                                    style={[
                                                        styles.answerLabel,
                                                        styles.answerLabelSuccess,
                                                    ]}
                                                >
                                                    Correct answer
                                                </Text>
                                                <Text style={styles.answerSummary}>
                                                    {question.hanzi} · {question.pinyin}
                                                </Text>
                                                <Text style={styles.answerTranslation}>
                                                    {meaningSummary}
                                                </Text>
                                            </View>
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

                        {selectedOption && !isWebDesktop ? (
                            <Card
                                style={[
                                    styles.answerCard,
                                    compactLayout && styles.answerCardCompact,
                                    isWebDesktop && styles.answerCardDesktop,
                                ]}
                                tone={isCorrect ? 'accent' : 'muted'}
                            >
                                <View style={styles.answerCopy}>
                                    <Text
                                        style={[
                                            styles.answerEyebrow,
                                            isCorrect && styles.answerEyebrowSuccess,
                                        ]}
                                    >
                                        {isCorrect ? 'Word details' : 'Review this pair'}
                                    </Text>
                                    <View style={styles.answerRow}>
                                        <Text style={styles.answerLabel}>
                                            {isCorrect ? 'Picked word' : 'Your choice'}
                                        </Text>
                                        <Text style={styles.answerSummary}>
                                            {selectedOption.hanzi} · {selectedOption.pinyin}
                                        </Text>
                                        <Text style={styles.answerTranslation}>
                                            {selectedMeaningSummary}
                                        </Text>
                                    </View>

                                    {!isCorrect ? (
                                        <View style={[styles.answerRow, styles.answerRowSecondary]}>
                                            <Text
                                                style={[
                                                    styles.answerLabel,
                                                    styles.answerLabelSuccess,
                                                ]}
                                            >
                                                Correct answer
                                            </Text>
                                            <Text style={styles.answerSummary}>
                                                {question.hanzi} · {question.pinyin}
                                            </Text>
                                            <Text style={styles.answerTranslation}>
                                                {meaningSummary}
                                            </Text>
                                        </View>
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
                                        ? 'Review the result, then keep the streak moving.'
                                        : 'Choose the matching word from the grid.'}
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
            paddingTop: 34,
            paddingHorizontal: 28,
            gap: 24,
        },
        practiceLayout: {
            gap: 12,
        },
        practiceLayoutDesktop: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 24,
        },
        topSection: {
            gap: 10,
        },
        topSectionDesktop: {
            width: 430,
            gap: 14,
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
            fontSize: 40,
            lineHeight: 44,
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
            fontSize: 15,
            lineHeight: 23,
            maxWidth: 320,
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
            minWidth: 96,
            paddingHorizontal: 16,
            paddingVertical: 14,
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
            fontSize: 30,
            lineHeight: 34,
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
        questionCard: {
            gap: 12,
            padding: 18,
        },
        questionCardDesktop: {
            gap: 16,
            padding: 22,
            minHeight: 330,
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
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1.1,
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
            fontSize: 68,
            lineHeight: 74,
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
            fontSize: 42,
            lineHeight: 48,
        },
        questionTextPinyinCompact: {
            fontSize: 28,
            lineHeight: 34,
        },
        meaningStack: {
            gap: 8,
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
            fontSize: 29,
            lineHeight: 34,
        },
        meaningLineCompact: {
            fontSize: 21,
            lineHeight: 25,
        },
        meaningLineVeryCompact: {
            fontSize: 18,
            lineHeight: 22,
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
            flexDirection: 'column',
            gap: 14,
        },
        desktopFeedbackPanel: {
            marginTop: 6,
            gap: 14,
            paddingTop: 14,
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
        answerEyebrowSuccess: {
            color: colors.success,
        },
        answerRow: {
            gap: 2,
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
        answerLabelSuccess: {
            color: colors.success,
        },
        answerSummary: {
            color: colors.text,
            fontSize: 15,
            lineHeight: 19,
            fontWeight: '700',
        },
        answerTranslation: {
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 17,
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
            gap: 20,
            padding: 22,
            minHeight: 640,
        },
        optionsPanelHeader: {
            gap: 8,
        },
        optionsEyebrow: {
            color: colors.primaryStrong,
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
        },
        optionsTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 32,
            lineHeight: 36,
            maxWidth: 420,
        },
        optionsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            rowGap: 10,
        },
        optionsGridDesktop: {
            rowGap: 16,
        },
        optionWrapper: {
            width: '48%',
        },
        optionWrapperDesktop: {
            width: '48.7%',
        },
        optionButton: {
            paddingHorizontal: 10,
        },
        optionButtonCompact: {
            paddingHorizontal: 8,
        },
        optionButtonDesktop: {
            borderRadius: radii.lg,
            paddingHorizontal: 18,
        },
        optionText: {
            fontSize: 18,
            lineHeight: 20,
        },
        optionTextDesktop: {
            fontSize: 20,
            lineHeight: 24,
        },
        optionTextCompact: {
            fontSize: 16,
            lineHeight: 18,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: 20,
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
