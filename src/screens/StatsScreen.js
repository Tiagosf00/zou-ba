import React, { useEffect, useMemo, useState } from 'react';
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
import { useIsFocused } from '@react-navigation/native';

import Card from '../components/Card';
import BackdropOrbs from '../components/BackdropOrbs';
import AudioButton from '../components/AudioButton';
import { useAppState } from '../context/AppStateContext';
import { useAppTheme } from '../theme/ThemeProvider';
import { getResponsiveLayout } from '../utils/layout';
import { getWordStatsSnapshot } from '../utils/practice';

import hskData from '../../assets/hsk_1_6_pdf_dataset_english.json';

const StatsScreen = () => {
    const isFocused = useIsFocused();
    const { progress, isHydrated } = useAppState();
    const { width } = useWindowDimensions();
    const { isWebWide, isWebDesktop, contentMaxWidth } = getResponsiveLayout(width);
    const desktopAsideWidth = isWebDesktop
        ? Math.min(Math.max(width * 0.24, 380), 480)
        : 380;
    const { colors, radii, shadows, typography } = useAppTheme();
    const styles = useMemo(
        () =>
            createStyles(colors, radii, shadows, typography, {
                isWebWide,
                isWebDesktop,
                contentMaxWidth,
                desktopAsideWidth,
            }),
        [
            colors,
            radii,
            shadows,
            typography,
            isWebWide,
            isWebDesktop,
            contentMaxWidth,
            desktopAsideWidth,
        ],
    );
    const [expandedLevel, setExpandedLevel] = useState(null);
    const [hasInitializedExpandedLevel, setHasInitializedExpandedLevel] = useState(false);

    const stats = useMemo(
        () => getWordStatsSnapshot(hskData, progress.cards),
        [progress.cards],
    );

    useEffect(() => {
        if (hasInitializedExpandedLevel || stats.levels.length === 0) {
            return;
        }

        const defaultLevel =
            stats.levels.find((level) => level.studiedCount > 0)?.level ||
            stats.levels[0].level;

        setExpandedLevel(defaultLevel);
        setHasInitializedExpandedLevel(true);
    }, [hasInitializedExpandedLevel, stats.levels]);

    const toggleLevel = (level) => {
        setExpandedLevel((currentLevel) => (currentLevel === level ? null : level));
    };

    const summaryTitle =
        stats.totalCorrectCount > 0
            ? `${stats.totalCorrectCount} correct answers saved`
            : 'No correct answers saved yet';
    const summarySubtitle =
        stats.studiedCount > 0
            ? `${stats.studiedCount} words tracked so far across your saved training history.`
            : 'Start a few rounds and each word will begin building its own answer history here.';
    const lastUpdatedLabel = progress.updatedAt
        ? new Date(progress.updatedAt).toLocaleString()
        : null;

    if (!isHydrated || !isFocused) {
        return (
            <SafeAreaView style={styles.container}>
                <BackdropOrbs />
                <View style={styles.loadingState}>
                    <Card style={styles.loadingCard}>
                        <ActivityIndicator color={colors.primaryStrong} size="small" />
                        <Text style={styles.loadingTitle}>Loading training stats</Text>
                        <Text style={styles.loadingText}>
                            Restoring your saved word history so the stats tab reflects your
                            latest training.
                        </Text>
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
                    isWebWide && styles.scrollContentWeb,
                    isWebDesktop && styles.scrollContentDesktop,
                ]}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.heroRow, isWebDesktop && styles.heroRowDesktop]}>
                    <View style={[styles.hero, isWebDesktop && styles.heroDesktop]}>
                        <Text style={styles.eyebrow}>Stats</Text>
                        <Text style={[styles.heroTitle, isWebDesktop && styles.heroTitleDesktop]}>
                            Word stats by HSK level
                        </Text>
                        <Text
                            style={[
                                styles.heroSubtitle,
                                isWebDesktop && styles.heroSubtitleDesktop,
                            ]}
                        >
                            Expand any level to see every word and how many times you answered it
                            correctly.
                        </Text>
                    </View>

                    <Card
                        tone="accent"
                        style={[styles.summaryCard, isWebDesktop && styles.summaryCardDesktop]}
                    >
                        <Text style={styles.summaryEyebrow}>All levels</Text>
                        <Text
                            style={[
                                styles.summaryTitle,
                                isWebDesktop && styles.summaryTitleDesktop,
                            ]}
                        >
                            {summaryTitle}
                        </Text>
                        <Text style={styles.summarySubtitle}>{summarySubtitle}</Text>
                        <View style={styles.summaryChipRow}>
                            <View style={styles.summaryChip}>
                                <Ionicons color={colors.accent} name="library" size={14} />
                                <Text style={styles.summaryChipText}>
                                    {stats.totalWords} words
                                </Text>
                            </View>
                            <View style={styles.summaryChip}>
                                <Ionicons color={colors.accent} name="school" size={14} />
                                <Text style={styles.summaryChipText}>
                                    {stats.masteredCount} mastered
                                </Text>
                            </View>
                            <View style={styles.summaryChip}>
                                <Ionicons
                                    color={colors.accent}
                                    name="close-circle-outline"
                                    size={14}
                                />
                                <Text style={styles.summaryChipText}>
                                    {stats.totalWrongCount} wrong
                                </Text>
                            </View>
                            <View style={styles.summaryChip}>
                                <Ionicons
                                    color={colors.accent}
                                    name="help-circle-outline"
                                    size={14}
                                />
                                <Text style={styles.summaryChipText}>
                                    {stats.totalUnknownCount} I don't know
                                </Text>
                            </View>
                        </View>
                        {lastUpdatedLabel ? (
                            <Text style={styles.summaryTimestamp}>
                                Updated {lastUpdatedLabel}
                            </Text>
                        ) : null}
                    </Card>
                </View>

                <View style={styles.statsColumn}>
                    <View style={[styles.metricsGrid, isWebDesktop && styles.metricsGridDesktop]}>
                        {[
                            {
                                id: 'correct',
                                label: 'Correct answers',
                                value: stats.totalCorrectCount,
                                icon: 'checkmark-circle',
                            },
                            {
                                id: 'studied',
                                label: 'Words studied',
                                value: stats.studiedCount,
                                icon: 'bar-chart',
                            },
                        ].map((metric) => (
                            <Card key={metric.id} style={styles.metricCard}>
                                <View style={styles.metricIcon}>
                                    <Ionicons
                                        color={colors.primaryStrong}
                                        name={metric.icon}
                                        size={18}
                                    />
                                </View>
                                <Text style={styles.metricValue}>{metric.value}</Text>
                                <Text style={styles.metricLabel}>{metric.label}</Text>
                            </Card>
                        ))}
                    </View>

                    <View style={styles.levelSection}>
                        {stats.levels.map((levelStats) => {
                            const isExpanded = expandedLevel === levelStats.level;
                            const masteryRatio =
                                levelStats.totalWords > 0
                                    ? levelStats.masteredCount / levelStats.totalWords
                                    : 0;
                            const levelSubtitle =
                                levelStats.studiedCount > 0
                                    ? `${levelStats.totalCorrectCount} correct answers across ${levelStats.studiedCount}/${levelStats.totalWords} studied words.`
                                    : `${levelStats.totalWords} words ready to track once you practice this level.`;

                            return (
                                <Card key={levelStats.level} style={styles.levelCard}>
                                    <Pressable
                                        onPress={() => toggleLevel(levelStats.level)}
                                        style={({ pressed }) => [
                                            styles.levelHeader,
                                            pressed && styles.levelHeaderPressed,
                                        ]}
                                    >
                                        <View style={styles.levelHeaderCopy}>
                                            <Text style={styles.levelEyebrow}>
                                                HSK {levelStats.level}
                                            </Text>
                                            <Text style={styles.levelTitle}>
                                                {levelStats.totalCorrectCount} correct
                                            </Text>
                                            <Text style={styles.levelSubtitle}>
                                                {levelSubtitle}
                                            </Text>

                                            <View style={styles.levelProgressSection}>
                                                <View style={styles.levelProgressLabelRow}>
                                                    <Text style={styles.levelProgressLabel}>
                                                        Mastered progress
                                                    </Text>
                                                    <Text style={styles.levelProgressValue}>
                                                        {levelStats.masteredCount}/
                                                        {levelStats.totalWords}
                                                    </Text>
                                                </View>
                                                <View style={styles.levelProgressTrack}>
                                                    <View
                                                        style={[
                                                            styles.levelProgressFill,
                                                            {
                                                                width: `${Math.max(
                                                                    masteryRatio * 100,
                                                                    levelStats.masteredCount > 0
                                                                        ? 4
                                                                        : 0,
                                                                )}%`,
                                                            },
                                                        ]}
                                                    />
                                                </View>
                                            </View>
                                        </View>

                                        <View style={styles.levelHeaderMeta}>
                                            <View style={styles.levelMetaChip}>
                                                <Text style={styles.levelMetaChipText}>
                                                    {levelStats.masteredCount} mastered
                                                </Text>
                                            </View>
                                            <Ionicons
                                                color={colors.textSecondary}
                                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                                size={20}
                                            />
                                        </View>
                                    </Pressable>

                                    {isExpanded ? (
                                        <View style={styles.wordList}>
                                            {levelStats.words.map((word, index) => (
                                                <View
                                                    key={word.id}
                                                    style={[
                                                        styles.wordRow,
                                                        index > 0 && styles.wordRowBorder,
                                                    ]}
                                                >
                                                    <View style={styles.wordCopy}>
                                                        <View style={styles.wordHeading}>
                                                            <Text style={styles.wordHanzi}>
                                                                {word.hanzi}
                                                            </Text>
                                                            <Text style={styles.wordPinyin}>
                                                                {word.pinyin}
                                                            </Text>
                                                            <AudioButton
                                                                hanzi={word.hanzi}
                                                                label={`Play ${word.hanzi} audio`}
                                                                style={styles.wordAudioButton}
                                                            />
                                                        </View>
                                                        <Text style={styles.wordMeaning}>
                                                            {word.meaningSummary}
                                                        </Text>
                                                    </View>

                                                    <View style={styles.wordPills}>
                                                        <View
                                                            style={[
                                                                styles.countPill,
                                                                word.correctCount > 0
                                                                    ? styles.countPillSuccess
                                                                    : word.attemptCount > 0
                                                                      ? styles.countPillMuted
                                                                      : styles.countPillNeutral,
                                                            ]}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.countPillText,
                                                                    word.correctCount > 0 &&
                                                                        styles.countPillTextSuccess,
                                                                ]}
                                                            >
                                                                {word.correctCount} correct
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}
                                </Card>
                            );
                        })}
                    </View>
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
        loadingState: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
        },
        loadingCard: {
            width: '100%',
            maxWidth: 520,
            gap: 14,
            alignItems: 'center',
            paddingVertical: 28,
        },
        loadingTitle: {
            fontSize: 22,
            fontWeight: '700',
            color: colors.text,
            fontFamily: typography.headingFont,
            textAlign: 'center',
        },
        loadingText: {
            fontSize: 15,
            lineHeight: 22,
            color: colors.textSecondary,
            fontFamily: typography.uiFont,
            textAlign: 'center',
        },
        scrollContent: {
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: layout.isWebDesktop ? 124 : 36,
            gap: 18,
        },
        scrollContentWeb: {
            alignSelf: 'center',
            width: '100%',
            maxWidth: layout.contentMaxWidth,
        },
        scrollContentDesktop: {
            paddingTop: 26,
            gap: 22,
        },
        heroRow: {
            gap: 16,
        },
        heroRowDesktop: {
            flexDirection: 'row',
            alignItems: 'stretch',
        },
        hero: {
            gap: 12,
            flex: 1,
            paddingTop: 10,
        },
        heroDesktop: {
            maxWidth: layout.contentMaxWidth - layout.desktopAsideWidth - 24,
            paddingTop: 18,
        },
        eyebrow: {
            color: colors.primaryStrong,
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            fontFamily: typography.uiFont,
        },
        heroTitle: {
            color: colors.text,
            fontSize: 34,
            lineHeight: 40,
            fontWeight: '700',
            fontFamily: typography.headingFont,
        },
        heroTitleDesktop: {
            fontSize: 50,
            lineHeight: 56,
        },
        heroSubtitle: {
            color: colors.textSecondary,
            fontSize: 16,
            lineHeight: 24,
            maxWidth: 760,
            fontFamily: typography.uiFont,
        },
        heroSubtitleDesktop: {
            fontSize: 18,
            lineHeight: 28,
            maxWidth: 860,
        },
        summaryCard: {
            gap: 10,
            padding: 18,
        },
        summaryCardDesktop: {
            width: layout.desktopAsideWidth,
            flexShrink: 0,
        },
        summaryEyebrow: {
            color: colors.accent,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            fontFamily: typography.uiFont,
        },
        summaryTitle: {
            color: colors.text,
            fontSize: 28,
            lineHeight: 34,
            fontWeight: '700',
            fontFamily: typography.headingFont,
        },
        summaryTitleDesktop: {
            fontSize: 32,
            lineHeight: 38,
        },
        summarySubtitle: {
            color: colors.textSecondary,
            fontSize: 15,
            lineHeight: 22,
            fontFamily: typography.uiFont,
        },
        summaryChipRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
        },
        summaryChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        summaryChipText: {
            color: colors.text,
            fontSize: 13,
            fontWeight: '600',
            fontFamily: typography.uiFont,
        },
        summaryTimestamp: {
            color: colors.textMuted,
            fontSize: 12,
            fontFamily: typography.uiFont,
        },
        statsColumn: {
            width: '100%',
            maxWidth: layout.isWebDesktop ? 980 : undefined,
            alignSelf: 'center',
            gap: 12,
        },
        metricsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'stretch',
        },
        metricsGridDesktop: {
            justifyContent: 'flex-start',
        },
        metricCard: {
            gap: 7,
            minHeight: 92,
            padding: 14,
            width: layout.isWebDesktop ? 204 : '100%',
            maxWidth: layout.isWebDesktop ? 204 : undefined,
        },
        metricIcon: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primarySoft,
        },
        metricValue: {
            color: colors.text,
            fontSize: 26,
            lineHeight: 30,
            fontWeight: '700',
            fontFamily: typography.headingFont,
        },
        metricLabel: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 20,
            fontFamily: typography.uiFont,
        },
        levelSection: {
            gap: 12,
        },
        levelCard: {
            gap: 12,
            padding: 16,
        },
        levelHeader: {
            flexDirection: layout.isWebDesktop ? 'row' : 'column',
            justifyContent: 'space-between',
            gap: 12,
        },
        levelHeaderPressed: {
            opacity: 0.85,
        },
        levelHeaderCopy: {
            flex: 1,
            gap: 6,
        },
        levelEyebrow: {
            color: colors.primaryStrong,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 1.1,
            textTransform: 'uppercase',
            fontFamily: typography.uiFont,
        },
        levelTitle: {
            color: colors.text,
            fontSize: 22,
            lineHeight: 26,
            fontWeight: '700',
            fontFamily: typography.headingFont,
        },
        levelSubtitle: {
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 19,
            fontFamily: typography.uiFont,
        },
        levelProgressSection: {
            gap: 8,
            marginTop: 4,
        },
        levelProgressLabelRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
        },
        levelProgressLabel: {
            color: colors.textSecondary,
            fontSize: 13,
            fontFamily: typography.uiFont,
        },
        levelProgressValue: {
            color: colors.text,
            fontSize: 13,
            fontWeight: '700',
            fontFamily: typography.uiFont,
        },
        levelProgressTrack: {
            height: 10,
            borderRadius: radii.pill,
            overflow: 'hidden',
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        levelProgressFill: {
            height: '100%',
            borderRadius: radii.pill,
            backgroundColor: colors.success,
        },
        levelHeaderMeta: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: layout.isWebDesktop ? 'flex-end' : 'space-between',
            gap: 12,
        },
        levelMetaChip: {
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        levelMetaChipText: {
            color: colors.text,
            fontSize: 12,
            fontWeight: '600',
            fontFamily: typography.uiFont,
        },
        wordList: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        wordRow: {
            flexDirection: layout.isWebDesktop ? 'row' : 'column',
            justifyContent: 'space-between',
            gap: 10,
            paddingVertical: 10,
        },
        wordRowBorder: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        wordCopy: {
            flex: 1,
            gap: 6,
        },
        wordHeading: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
        },
        wordHanzi: {
            color: colors.text,
            fontSize: 21,
            lineHeight: 24,
            fontWeight: '700',
            fontFamily: typography.studyFont,
        },
        wordPinyin: {
            color: colors.primaryStrong,
            fontSize: 14,
            lineHeight: 18,
            fontWeight: '600',
            fontFamily: typography.uiFont,
        },
        wordAudioButton: {
            marginLeft: 2,
        },
        wordMeaning: {
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 19,
            fontFamily: typography.uiFont,
        },
        wordPills: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            justifyContent: layout.isWebDesktop ? 'flex-end' : 'flex-start',
        },
        countPill: {
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: radii.pill,
            borderWidth: 1,
        },
        countPillSuccess: {
            backgroundColor: colors.successSoft,
            borderColor: colors.success,
        },
        countPillMuted: {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
        },
        countPillNeutral: {
            backgroundColor: colors.accentSoft,
            borderColor: colors.accent,
        },
        countPillText: {
            color: colors.text,
            fontSize: 12,
            fontWeight: '600',
            fontFamily: typography.uiFont,
        },
        countPillTextSuccess: {
            color: colors.success,
        },
    });

export default StatsScreen;
