import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
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

import Card from '../components/Card';
import BackdropOrbs from '../components/BackdropOrbs';
import ModernButton from '../components/ModernButton';
import { getPracticeMode, PRACTICE_MODES } from '../constants/practiceModes';
import { useAppState } from '../context/AppStateContext';
import { useAppTheme } from '../theme/ThemeProvider';
import { getResponsiveLayout } from '../utils/layout';

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

const getSyncBadge = (syncState) => {
    if (!syncState) {
        return {
            icon: 'cloud-offline-outline',
            label: 'Backup available',
            tone: 'muted',
        };
    }

    if (syncState.kind === 'synced') {
        return {
            icon: 'cloud-done-outline',
            label: 'Cloud synced',
            tone: 'success',
        };
    }

    if (syncState.kind === 'syncing') {
        return {
            icon: 'sync-outline',
            label: 'Syncing',
            tone: 'accent',
        };
    }

    if (syncState.kind === 'error') {
        return {
            icon: 'alert-circle-outline',
            label: 'Sync issue',
            tone: 'error',
        };
    }

    if (syncState.kind === 'disabled') {
        return {
            icon: 'cloud-offline-outline',
            label: 'Backup unavailable',
            tone: 'muted',
        };
    }

    return {
        icon: 'cloud-outline',
        label: 'Backup available',
        tone: 'muted',
    };
};

const SettingsScreen = () => {
    const {
        settings,
        updateSettings,
        auth,
        cloud,
    } = useAppState();
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
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [feedback, setFeedback] = useState(null);

    const inputMode = getPracticeMode(settings.inputMode);
    const outputMode = getPracticeMode(settings.outputMode);
    const themeMode = settings.themeMode || 'light';
    const levelSummary =
        settings.hskLevels.length === 6
            ? 'HSK 1-6'
            : settings.hskLevels.map((level) => `HSK ${level}`).join(' · ');
    const syncBadge = getSyncBadge(cloud.syncState);
    const trimmedUsername = username.trim().toLowerCase();
    const canSubmitCredentials =
        trimmedUsername.length >= 3 && password.length >= 6 && auth.action === 'idle';

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

    const handleAuthError = (error) => {
        setFeedback({
            tone: 'error',
            message: error?.message || 'Something went wrong while contacting the backend.',
        });
    };

    const handleSignUp = async () => {
        if (!canSubmitCredentials || !cloud.isConfigured) {
            return;
        }

        setFeedback(null);

        try {
            await cloud.signUp(trimmedUsername, password);
            setPassword('');
            setFeedback({
                tone: 'success',
                message: `Account @${trimmedUsername} created. Your local progress is now backed up to the cloud.`,
            });
        } catch (error) {
            handleAuthError(error);
        }
    };

    const handleLogIn = async () => {
        if (!canSubmitCredentials || !cloud.isConfigured) {
            return;
        }

        setFeedback(null);

        try {
            await cloud.logIn(trimmedUsername, password);
            setPassword('');
            setFeedback({
                tone: 'success',
                message: `Signed in as @${trimmedUsername}. Your latest saved state has been restored.`,
            });
        } catch (error) {
            handleAuthError(error);
        }
    };

    const handleLogOut = async () => {
        setFeedback(null);

        try {
            await cloud.logOut();
            setFeedback({
                tone: 'success',
                message: 'Signed out. This browser is back in local-only guest mode.',
            });
        } catch (error) {
            handleAuthError(error);
        }
    };

    const handleSyncNow = async () => {
        setFeedback(null);

        try {
            await cloud.syncNow();
            setFeedback({
                tone: 'success',
                message: 'Cloud backup refreshed.',
            });
        } catch (error) {
            handleAuthError(error);
        }
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
                        isWebDesktop && styles.modeRowDesktop,
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
                        <Text style={[styles.modeLabel, isWebDesktop && styles.modeLabelDesktop]}>
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
                        <Text style={styles.eyebrow}>Settings</Text>
                        <Text style={[styles.heroTitle, isWebDesktop && styles.heroTitleDesktop]}>
                            Settings
                        </Text>
                        <Text
                            style={[
                                styles.heroSubtitle,
                                isWebDesktop && styles.heroSubtitleDesktop,
                            ]}
                        >
                            Right now you see {inputMode.label.toLowerCase()} and answer with{' '}
                            {outputMode.label.toLowerCase()}.
                        </Text>
                    </View>

                    <Card
                        tone="accent"
                        style={[
                            styles.summaryCard,
                            isWebDesktop && styles.summaryCardDesktop,
                        ]}
                    >
                        <Text style={styles.summaryEyebrow}>Current session</Text>
                        <Text
                            style={[
                                styles.summaryTitle,
                                isWebDesktop && styles.summaryTitleDesktop,
                            ]}
                        >
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
                            <View style={styles.summaryChip}>
                                <Ionicons color={colors.accent} name={syncBadge.icon} size={14} />
                                <Text style={styles.summaryChipText}>{syncBadge.label}</Text>
                            </View>
                        </View>
                    </Card>
                </View>

                <View style={[styles.sectionsGrid, isWebDesktop && styles.sectionsGridDesktop]}>
                    <View style={[styles.sectionSlot, styles.accountSectionSlot]}>
                        <Card style={[styles.card, styles.accountCard]}>
                            <View style={styles.accountHeaderRow}>
                                <View style={styles.accountHeaderCopy}>
                                    <Text style={styles.sectionTitle}>Account & cloud backup</Text>
                                    <Text style={styles.sectionSubtitle}>
                                        Keep practicing locally, then sign in to back up your
                                        settings and training history to the backend.
                                    </Text>
                                </View>

                                <View
                                    style={[
                                        styles.syncBadge,
                                        styles[`syncBadge${capitalize(syncBadge.tone)}`],
                                    ]}
                                >
                                    <Ionicons
                                        color={styles[`syncBadge${capitalize(syncBadge.tone)}`].color}
                                        name={syncBadge.icon}
                                        size={15}
                                    />
                                    <Text
                                        style={[
                                            styles.syncBadgeText,
                                            styles[
                                                `syncBadgeText${capitalize(syncBadge.tone)}`
                                            ],
                                        ]}
                                    >
                                        {syncBadge.label}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.accountStatusCard}>
                                <View style={styles.accountStatusRow}>
                                    <View style={styles.accountIdentity}>
                                        <Text style={styles.accountEyebrow}>
                                            {auth.isAuthenticated ? 'Signed in' : 'Cloud backup optional'}
                                        </Text>
                                        <Text style={styles.accountTitle}>
                                            {auth.isAuthenticated
                                                ? `@${auth.session.user.username}`
                                                : 'Progress is saved on this browser'}
                                        </Text>
                                    </View>

                                    {auth.action !== 'idle' || cloud.syncState.kind === 'syncing' ? (
                                        <ActivityIndicator
                                            color={colors.primaryStrong}
                                            size="small"
                                        />
                                    ) : null}
                                </View>

                                <Text style={styles.accountDescription}>
                                    {cloud.syncState.message}
                                </Text>
                                <Text style={styles.accountNote}>
                                    Password recovery is not available yet, so choose a password
                                    you will remember.
                                </Text>
                            </View>

                            {!cloud.isConfigured ? (
                                <View style={styles.feedbackCardMuted}>
                                    <Text style={styles.feedbackTitleMuted}>
                                        Cloud backup unavailable
                                    </Text>
                                    <Text style={styles.feedbackTextMuted}>
                                        This build was published without a backend connection.
                                    </Text>
                                </View>
                            ) : auth.isAuthenticated ? (
                                <View style={styles.accountActions}>
                                    <ModernButton
                                        onPress={handleSyncNow}
                                        style={styles.accountButton}
                                        title={cloud.syncState.kind === 'syncing' ? 'Syncing…' : 'Sync now'}
                                        variant="secondary"
                                    />
                                    <ModernButton
                                        onPress={handleLogOut}
                                        style={styles.accountButton}
                                        title={
                                            auth.action === 'logging-out' ? 'Signing out…' : 'Sign out'
                                        }
                                        variant="danger"
                                    />
                                </View>
                            ) : (
                                <View style={styles.authForm}>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Username</Text>
                                        <TextInput
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            onChangeText={setUsername}
                                            placeholder="Choose a username"
                                            placeholderTextColor={colors.textMuted}
                                            style={styles.textInput}
                                            value={username}
                                        />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Password</Text>
                                        <TextInput
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            onChangeText={setPassword}
                                            placeholder="At least 6 characters"
                                            placeholderTextColor={colors.textMuted}
                                            secureTextEntry
                                            style={styles.textInput}
                                            value={password}
                                        />
                                    </View>

                                    <View style={styles.accountActions}>
                                        <ModernButton
                                            disabled={!canSubmitCredentials}
                                            onPress={handleSignUp}
                                            style={styles.accountButton}
                                            title={
                                                auth.action === 'signing-up'
                                                    ? 'Creating account…'
                                                    : 'Sign up'
                                            }
                                        />
                                        <ModernButton
                                            disabled={!canSubmitCredentials}
                                            onPress={handleLogIn}
                                            style={styles.accountButton}
                                            title={
                                                auth.action === 'logging-in'
                                                    ? 'Signing in…'
                                                    : 'Log in'
                                            }
                                            variant="secondary"
                                        />
                                    </View>
                                </View>
                            )}

                            {feedback ? (
                                <View
                                    style={[
                                        feedback.tone === 'error'
                                            ? styles.feedbackCardError
                                            : styles.feedbackCardSuccess,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            feedback.tone === 'error'
                                                ? styles.feedbackTitleError
                                                : styles.feedbackTitleSuccess,
                                        ]}
                                    >
                                        {feedback.tone === 'error' ? 'Action needed' : 'Saved'}
                                    </Text>
                                    <Text
                                        style={[
                                            feedback.tone === 'error'
                                                ? styles.feedbackTextError
                                                : styles.feedbackTextSuccess,
                                        ]}
                                    >
                                        {feedback.message}
                                    </Text>
                                </View>
                            ) : null}
                        </Card>
                    </View>

                    <View style={[styles.sectionSlot, isWebDesktop && styles.sectionSlotHalf]}>
                        <Card style={styles.card}>
                            <Text style={styles.sectionTitle}>Appearance</Text>
                            <Text style={styles.sectionSubtitle}>
                                Switch between day and night study themes.
                            </Text>
                            <View style={[styles.themeRow, isWebDesktop && styles.themeRowDesktop]}>
                                {THEME_OPTIONS.map((option) => {
                                    const isActive = themeMode === option.id;

                                    return (
                                        <Pressable
                                            key={option.id}
                                            onPress={() => setMode('themeMode', option.id)}
                                            style={({ pressed }) => [
                                                styles.themeOption,
                                                isWebDesktop && styles.themeOptionDesktop,
                                                isActive && styles.themeOptionActive,
                                                pressed && styles.themeOptionPressed,
                                            ]}
                                        >
                                            <View
                                                style={[
                                                    styles.themeIcon,
                                                    isActive && styles.themeIconActive,
                                                ]}
                                            >
                                                <Ionicons
                                                    color={isActive ? colors.onPrimary : colors.primaryStrong}
                                                    name={option.icon}
                                                    size={18}
                                                />
                                            </View>
                                            <Text
                                                style={[
                                                    styles.themeLabel,
                                                    isActive && styles.themeLabelActive,
                                                ]}
                                            >
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
                    </View>

                    <View style={[styles.sectionSlot, isWebDesktop && styles.sectionSlotHalf]}>
                        <Card style={styles.card}>
                            <Text style={styles.sectionTitle}>HSK levels</Text>
                            <Text style={styles.sectionSubtitle}>
                                Choose the vocabulary pool for each round.
                            </Text>

                            <View style={styles.levelGrid}>
                                {LEVELS.map((level) => {
                                    const isActive = settings.hskLevels.includes(level);

                                    return (
                                        <Pressable
                                            key={level}
                                            onPress={() => toggleLevel(level)}
                                            style={({ pressed }) => [
                                                styles.levelButton,
                                                isWebDesktop && styles.levelButtonDesktop,
                                                isActive && styles.levelButtonActive,
                                                pressed && styles.levelButtonPressed,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.levelText,
                                                    isActive && styles.levelTextActive,
                                                ]}
                                            >
                                                HSK {level}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </Card>
                    </View>

                    <View style={[styles.sectionSlot, isWebDesktop && styles.sectionSlotHalf]}>
                        <Card style={styles.card}>
                            <Text style={styles.sectionTitle}>Prompt format</Text>
                            <Text style={styles.sectionSubtitle}>
                                What appears on the main study card.
                            </Text>
                            <View style={styles.modeList}>
                                {renderModeRow('inputMode', settings.inputMode)}
                            </View>
                        </Card>
                    </View>

                    <View style={[styles.sectionSlot, isWebDesktop && styles.sectionSlotHalf]}>
                        <Card style={styles.card}>
                            <Text style={styles.sectionTitle}>Answer format</Text>
                            <Text style={styles.sectionSubtitle}>
                                What you tap in the answer grid.
                            </Text>
                            <View style={styles.modeList}>
                                {renderModeRow('outputMode', settings.outputMode)}
                            </View>
                        </Card>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const createStyles = (colors, radii, shadows, typography, layout) =>
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
        scrollContentWeb: {
            width: '100%',
            maxWidth: layout.contentMaxWidth,
            alignSelf: 'center',
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 148,
            gap: 22,
        },
        scrollContentDesktop: {
            paddingTop: 34,
            paddingHorizontal: 28,
            gap: 24,
        },
        heroRow: {
            gap: 18,
        },
        heroRowDesktop: {
            flexDirection: 'row',
            alignItems: 'stretch',
            gap: 24,
        },
        hero: {
            gap: 8,
        },
        heroDesktop: {
            flex: 1,
            justifyContent: 'center',
            maxWidth: 560,
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
        heroTitleDesktop: {
            fontSize: 46,
            lineHeight: 52,
        },
        heroSubtitle: {
            color: colors.textSecondary,
            fontSize: 16,
            lineHeight: 24,
        },
        heroSubtitleDesktop: {
            fontSize: 17,
            lineHeight: 26,
            maxWidth: 520,
        },
        summaryCard: {
            gap: 12,
        },
        summaryCardDesktop: {
            width: layout.desktopAsideWidth,
            gap: 16,
            padding: 26,
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
        summaryTitleDesktop: {
            fontSize: 34,
            lineHeight: 38,
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
        sectionsGrid: {
            gap: 18,
        },
        sectionsGridDesktop: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            rowGap: 24,
        },
        sectionSlot: {
            width: '100%',
        },
        accountSectionSlot: {
            alignItems: 'center',
        },
        sectionSlotHalf: {
            width: '48.8%',
        },
        card: {
            gap: 16,
        },
        accountCard: {
            width: '94%',
            maxWidth: layout.isWebDesktop ? 920 : 760,
            alignSelf: 'center',
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
        accountHeaderRow: {
            gap: 14,
        },
        accountHeaderCopy: {
            gap: 8,
        },
        syncBadge: {
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radii.pill,
        },
        syncBadgeAccent: {
            backgroundColor: colors.accentSoft,
            color: colors.accent,
        },
        syncBadgeSuccess: {
            backgroundColor: colors.successSoft,
            color: colors.success,
        },
        syncBadgeError: {
            backgroundColor: colors.errorSoft,
            color: colors.error,
        },
        syncBadgeMuted: {
            backgroundColor: colors.surfaceMuted,
            color: colors.textSecondary,
        },
        syncBadgeText: {
            fontSize: 13,
            fontWeight: '800',
        },
        syncBadgeTextAccent: {
            color: colors.accent,
        },
        syncBadgeTextSuccess: {
            color: colors.success,
        },
        syncBadgeTextError: {
            color: colors.error,
        },
        syncBadgeTextMuted: {
            color: colors.textSecondary,
        },
        accountStatusCard: {
            gap: 10,
            padding: 18,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        accountStatusRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
        },
        accountIdentity: {
            gap: 4,
            flex: 1,
        },
        accountEyebrow: {
            color: colors.primaryStrong,
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 1,
            textTransform: 'uppercase',
        },
        accountTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 24,
            lineHeight: 28,
        },
        accountDescription: {
            color: colors.text,
            fontSize: 15,
            lineHeight: 22,
        },
        accountNote: {
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 19,
        },
        authForm: {
            gap: 14,
        },
        inputGroup: {
            gap: 8,
        },
        inputLabel: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '800',
        },
        textInput: {
            minHeight: 52,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
            paddingHorizontal: 16,
            paddingVertical: 12,
            color: colors.text,
            fontSize: 16,
        },
        accountActions: {
            flexDirection: layout.isWebDesktop ? 'row' : 'column',
            gap: 12,
        },
        accountButton: {
            flex: 1,
            minHeight: 64,
        },
        feedbackCardSuccess: {
            gap: 6,
            padding: 16,
            borderRadius: radii.md,
            backgroundColor: colors.successSoft,
        },
        feedbackCardError: {
            gap: 6,
            padding: 16,
            borderRadius: radii.md,
            backgroundColor: colors.errorSoft,
        },
        feedbackCardMuted: {
            gap: 6,
            padding: 16,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceMuted,
        },
        feedbackTitleSuccess: {
            color: colors.success,
            fontSize: 14,
            fontWeight: '800',
        },
        feedbackTitleError: {
            color: colors.error,
            fontSize: 14,
            fontWeight: '800',
        },
        feedbackTitleMuted: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '800',
        },
        feedbackTextSuccess: {
            color: colors.text,
            fontSize: 14,
            lineHeight: 20,
        },
        feedbackTextError: {
            color: colors.text,
            fontSize: 14,
            lineHeight: 20,
        },
        feedbackTextMuted: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 20,
        },
        themeRow: {
            flexDirection: 'row',
            gap: 12,
        },
        themeRowDesktop: {
            gap: 16,
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
        themeOptionDesktop: {
            paddingHorizontal: 18,
            paddingVertical: 18,
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
        levelButtonDesktop: {
            minWidth: '31.5%',
            paddingVertical: 16,
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
        modeRowDesktop: {
            padding: 18,
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
        modeLabelDesktop: {
            fontSize: 17,
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
