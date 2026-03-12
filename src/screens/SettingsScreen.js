import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import Card from '../components/Card';
import BackdropOrbs from '../components/BackdropOrbs';
import { getPracticeMode, PRACTICE_MODES } from '../constants/practiceModes';
import { useAppTheme } from '../theme/ThemeProvider';

const LEVELS = [1, 2, 3, 4, 5, 6];

const MODE_ICONS = {
    hanzi: 'language',
    pinyin: 'musical-notes',
    eng: 'chatbubble-ellipses',
};

const THEME_OPTIONS = [
    {
        id: 'light',
        label: 'Day',
        detail: 'Warm paper palette',
        icon: 'sunny',
    },
    {
        id: 'dark',
        label: 'Night',
        detail: 'Low-light study mode',
        icon: 'moon',
    },
];

const SettingsScreen = ({ settings, updateSettings }) => {
    const { colors, radii, shadows, typography } = useAppTheme();
    const styles = useMemo(
        () => createStyles(colors, radii, shadows, typography),
        [colors, radii, shadows, typography],
    );
    const inputMode = getPracticeMode(settings.inputMode);
    const outputMode = getPracticeMode(settings.outputMode);
    const themeMode = settings.themeMode || 'light';
    const levelSummary =
        settings.hskLevels.length === 6
            ? 'HSK 1-6'
            : settings.hskLevels.map((level) => `HSK ${level}`).join(' · ');

    const toggleLevel = (level) => {
        const currentLevels = settings.hskLevels;
        const nextLevels = currentLevels.includes(level)
            ? currentLevels.filter((currentLevel) => currentLevel !== level)
            : [...currentLevels, level].sort((left, right) => left - right);

        if (nextLevels.length === 0) {
            return;
        }

        updateSettings({ hskLevels: nextLevels });
    };

    const setMode = (type, modeId) => {
        updateSettings({ [type]: modeId });
    };

    const renderModeRow = (type, selectedModeId) => {
        return PRACTICE_MODES.map((mode) => {
            const isActive = selectedModeId === mode.id;

            return (
                <Pressable
                    key={`${type}-${mode.id}`}
                    onPress={() => setMode(type, mode.id)}
                    style={({ pressed }) => [
                        styles.modeRow,
                        isActive && styles.modeRowActive,
                        pressed && styles.modeRowPressed,
                    ]}
                >
                    <View style={[styles.modeIcon, isActive && styles.modeIconActive]}>
                        <Ionicons
                            color={isActive ? colors.onPrimary : colors.primaryStrong}
                            name={MODE_ICONS[mode.id]}
                            size={18}
                        />
                    </View>

                    <View style={styles.modeCopy}>
                        <Text style={styles.modeLabel}>
                            {mode.label} <Text style={styles.modeDetail}>{mode.detail}</Text>
                        </Text>
                        <Text style={styles.modeDescription}>{mode.description}</Text>
                    </View>

                    <View style={[styles.modeCheck, isActive && styles.modeCheckActive]}>
                        {isActive ? (
                            <Ionicons color={colors.onPrimary} name="checkmark" size={16} />
                        ) : null}
                    </View>
                </Pressable>
            );
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <BackdropOrbs />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <Text style={styles.eyebrow}>Practice setup</Text>
                    <Text style={styles.heroTitle}>Tune the study flow to match your pace.</Text>
                    <Text style={styles.heroSubtitle}>
                        Right now you see {inputMode.label.toLowerCase()} and answer with{' '}
                        {outputMode.label.toLowerCase()}.
                    </Text>
                </View>

                <Card tone="accent" style={styles.summaryCard}>
                    <Text style={styles.summaryEyebrow}>Current session</Text>
                    <Text style={styles.summaryTitle}>
                        See {inputMode.label}. Answer with {outputMode.label}.
                    </Text>
                    <View style={styles.summaryChipRow}>
                        <View style={styles.summaryChip}>
                            <Ionicons color={colors.accent} name="albums" size={14} />
                            <Text style={styles.summaryChipText}>{levelSummary}</Text>
                        </View>
                        <View style={styles.summaryChip}>
                            <Ionicons
                                color={colors.accent}
                                name={themeMode === 'dark' ? 'moon' : 'sunny'}
                                size={14}
                            />
                            <Text style={styles.summaryChipText}>
                                {themeMode === 'dark' ? 'Night mode' : 'Day mode'}
                            </Text>
                        </View>
                    </View>
                </Card>

                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>Appearance</Text>
                    <Text style={styles.sectionSubtitle}>Switch between day and night study themes.</Text>
                    <View style={styles.themeRow}>
                        {THEME_OPTIONS.map((option) => {
                            const isActive = themeMode === option.id;

                            return (
                                <Pressable
                                    key={option.id}
                                    onPress={() => setMode('themeMode', option.id)}
                                    style={({ pressed }) => [
                                        styles.themeOption,
                                        isActive && styles.themeOptionActive,
                                        pressed && styles.themeOptionPressed,
                                    ]}
                                >
                                    <View style={[styles.themeIcon, isActive && styles.themeIconActive]}>
                                        <Ionicons
                                            color={isActive ? colors.onPrimary : colors.primaryStrong}
                                            name={option.icon}
                                            size={18}
                                        />
                                    </View>
                                    <Text style={[styles.themeLabel, isActive && styles.themeLabelActive]}>
                                        {option.label}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.themeDetail,
                                            isActive && styles.themeDetailActive,
                                        ]}
                                    >
                                        {option.detail}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </Card>

                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>HSK levels</Text>
                    <Text style={styles.sectionSubtitle}>Choose the vocabulary pool for each round.</Text>

                    <View style={styles.levelGrid}>
                        {LEVELS.map((level) => {
                            const isActive = settings.hskLevels.includes(level);

                            return (
                                <Pressable
                                    key={level}
                                    onPress={() => toggleLevel(level)}
                                    style={({ pressed }) => [
                                        styles.levelButton,
                                        isActive && styles.levelButtonActive,
                                        pressed && styles.levelButtonPressed,
                                    ]}
                                >
                                    <Text style={[styles.levelText, isActive && styles.levelTextActive]}>
                                        HSK {level}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </Card>

                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>Prompt format</Text>
                    <Text style={styles.sectionSubtitle}>What appears on the main study card.</Text>
                    <View style={styles.modeList}>{renderModeRow('inputMode', settings.inputMode)}</View>
                </Card>

                <Card style={styles.card}>
                    <Text style={styles.sectionTitle}>Answer format</Text>
                    <Text style={styles.sectionSubtitle}>What you tap in the answer grid.</Text>
                    <View style={styles.modeList}>{renderModeRow('outputMode', settings.outputMode)}</View>
                </Card>
            </ScrollView>
        </SafeAreaView>
    );
};

const createStyles = (colors, radii, shadows, typography) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        scrollContent: {
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 120,
            gap: 18,
        },
        hero: {
            gap: 8,
        },
        eyebrow: {
            color: colors.primaryStrong,
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
        },
        heroTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 34,
            lineHeight: 39,
        },
        heroSubtitle: {
            color: colors.textSecondary,
            fontSize: 16,
            lineHeight: 24,
        },
        summaryCard: {
            gap: 12,
        },
        summaryEyebrow: {
            color: colors.accent,
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
        },
        summaryTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 28,
            lineHeight: 32,
        },
        summaryChipRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
        },
        summaryChip: {
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
        },
        summaryChipText: {
            color: colors.text,
            fontSize: 13,
            fontWeight: '700',
        },
        card: {
            gap: 16,
        },
        sectionTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 27,
            lineHeight: 31,
        },
        sectionSubtitle: {
            color: colors.textSecondary,
            fontSize: 15,
            lineHeight: 22,
            marginTop: -6,
        },
        themeRow: {
            flexDirection: 'row',
            gap: 12,
        },
        themeOption: {
            flex: 1,
            paddingHorizontal: 14,
            paddingVertical: 16,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
        },
        themeOptionActive: {
            backgroundColor: colors.surface,
            borderColor: colors.primarySoft,
            ...shadows.sm,
        },
        themeOptionPressed: {
            transform: [{ scale: 0.99 }],
        },
        themeIcon: {
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primarySoft,
        },
        themeIconActive: {
            backgroundColor: colors.primary,
        },
        themeLabel: {
            color: colors.text,
            fontSize: 16,
            fontWeight: '800',
        },
        themeLabelActive: {
            color: colors.primaryStrong,
        },
        themeDetail: {
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 18,
        },
        themeDetailActive: {
            color: colors.text,
        },
        levelGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
        },
        levelButton: {
            minWidth: '30%',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        levelButtonActive: {
            backgroundColor: colors.primary,
            borderColor: 'transparent',
            ...shadows.sm,
        },
        levelButtonPressed: {
            transform: [{ scale: 0.985 }],
        },
        levelText: {
            color: colors.text,
            fontSize: 15,
            fontWeight: '700',
        },
        levelTextActive: {
            color: colors.onPrimary,
        },
        modeList: {
            gap: 12,
        },
        modeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 16,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        modeRowActive: {
            backgroundColor: colors.surface,
            borderColor: colors.primarySoft,
            ...shadows.sm,
        },
        modeRowPressed: {
            transform: [{ scale: 0.99 }],
        },
        modeIcon: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primarySoft,
        },
        modeIconActive: {
            backgroundColor: colors.primary,
        },
        modeCopy: {
            flex: 1,
            gap: 4,
        },
        modeLabel: {
            color: colors.text,
            fontSize: 16,
            fontWeight: '800',
        },
        modeDetail: {
            color: colors.primaryStrong,
            fontWeight: '700',
        },
        modeDescription: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 19,
        },
        modeCheck: {
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.borderStrong,
        },
        modeCheckActive: {
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            borderColor: 'transparent',
        },
    });

export default SettingsScreen;
