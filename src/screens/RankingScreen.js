import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';

import BackdropOrbs from '../components/BackdropOrbs';
import Card from '../components/Card';
import ModernButton from '../components/ModernButton';
import { useAppState } from '../context/AppStateContext';
import { useAppTheme } from '../theme/ThemeProvider';
import { fetchLeaderboard } from '../utils/cloudApi';
import { getResponsiveLayout } from '../utils/layout';

const getRankAccent = (rank, colors) => {
    if (rank === 1) {
        return {
            backgroundColor: colors.primary,
            textColor: colors.onPrimary,
            icon: 'trophy',
        };
    }

    if (rank === 2) {
        return {
            backgroundColor: colors.backgroundMuted,
            textColor: colors.text,
            icon: 'medal',
        };
    }

    if (rank === 3) {
        return {
            backgroundColor: colors.primarySoft,
            textColor: colors.primaryStrong,
            icon: 'ribbon',
        };
    }

    return {
        backgroundColor: colors.surfaceMuted,
        textColor: colors.textSecondary,
        icon: 'stats-chart',
    };
};

const RankingScreen = () => {
    const isFocused = useIsFocused();
    const { auth, cloud, isHydrated } = useAppState();
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
    const [leaderboardState, setLeaderboardState] = useState({
        loading: cloud.isConfigured,
        refreshing: false,
        error: null,
        leaderboard: [],
        totalUsers: 0,
        generatedAt: null,
    });

    useEffect(() => {
        if (!cloud.isConfigured || !isFocused || !isHydrated) {
            return;
        }

        let isActive = true;

        const loadLeaderboard = async () => {
            setLeaderboardState((current) => ({
                ...current,
                loading: current.leaderboard.length === 0,
                refreshing: current.leaderboard.length > 0,
                error: null,
            }));

            try {
                const response = await fetchLeaderboard(auth.session?.token);

                if (!isActive) {
                    return;
                }

                setLeaderboardState({
                    loading: false,
                    refreshing: false,
                    error: null,
                    leaderboard: response?.leaderboard || [],
                    totalUsers: response?.totalUsers || 0,
                    generatedAt: response?.generatedAt || null,
                });
            } catch (error) {
                if (!isActive) {
                    return;
                }

                setLeaderboardState((current) => ({
                    ...current,
                    loading: false,
                    refreshing: false,
                    error: error?.message || 'We could not load the ranking right now.',
                }));
            }
        };

        void loadLeaderboard();

        return () => {
            isActive = false;
        };
    }, [auth.session?.token, cloud.isConfigured, isFocused, isHydrated]);

    const refreshLeaderboard = async () => {
        if (!cloud.isConfigured || !isHydrated) {
            return;
        }

        setLeaderboardState((current) => ({
            ...current,
            refreshing: true,
            error: null,
        }));

        try {
            const response = await fetchLeaderboard(auth.session?.token);

            setLeaderboardState({
                loading: false,
                refreshing: false,
                error: null,
                leaderboard: response?.leaderboard || [],
                totalUsers: response?.totalUsers || 0,
                generatedAt: response?.generatedAt || null,
            });
        } catch (error) {
            setLeaderboardState((current) => ({
                ...current,
                loading: false,
                refreshing: false,
                error: error?.message || 'We could not load the ranking right now.',
            }));
        }
    };

    const currentUsername = auth.session?.user?.username || null;
    const currentUserEntry = currentUsername
        ? leaderboardState.leaderboard.find((entry) => entry.username === currentUsername) || null
        : null;
    const topEntry = leaderboardState.leaderboard[0] || null;
    const generatedAtLabel = leaderboardState.generatedAt
        ? new Date(leaderboardState.generatedAt).toLocaleString()
        : null;
    const hasLeaderboardData = leaderboardState.leaderboard.length > 0;

    if (!isHydrated) {
        return (
            <SafeAreaView style={styles.container}>
                <BackdropOrbs />
                <View style={styles.centeredState}>
                    <Card style={styles.stateCard}>
                        <ActivityIndicator color={colors.primaryStrong} size="small" />
                        <Text style={styles.stateTitle}>Loading ranking</Text>
                        <Text style={styles.stateText}>
                            Restoring your session first so the ranking request uses the right
                            account state.
                        </Text>
                    </Card>
                </View>
            </SafeAreaView>
        );
    }

    if (!cloud.isConfigured) {
        return (
            <SafeAreaView style={styles.container}>
                <BackdropOrbs />
                <View style={styles.centeredState}>
                    <Card style={styles.stateCard}>
                        <Text style={styles.stateEyebrow}>Ranking</Text>
                        <Text style={styles.stateTitle}>Cloud ranking is not available yet.</Text>
                        <Text style={styles.stateText}>
                            Set `EXPO_PUBLIC_API_BASE_URL` so the app can load the shared
                            leaderboard from your backend database.
                        </Text>
                    </Card>
                </View>
            </SafeAreaView>
        );
    }

    if (leaderboardState.loading) {
        return (
            <SafeAreaView style={styles.container}>
                <BackdropOrbs />
                <View style={styles.centeredState}>
                    <Card style={styles.stateCard}>
                        <ActivityIndicator color={colors.primaryStrong} size="small" />
                        <Text style={styles.stateTitle}>Loading ranking</Text>
                        <Text style={styles.stateText}>
                            Pulling every saved user score from the cloud leaderboard.
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
                        <Text style={styles.eyebrow}>Ranking</Text>
                        <Text style={[styles.heroTitle, isWebDesktop && styles.heroTitleDesktop]}>
                            Global user ranking
                        </Text>
                        <Text
                            style={[
                                styles.heroSubtitle,
                                isWebDesktop && styles.heroSubtitleDesktop,
                            ]}
                        >
                            Scores are weighted by HSK level: HSK 1 cards are worth ±1, HSK 2
                            cards are worth ±2, and so on through HSK 6.
                        </Text>
                    </View>

                    <Card tone="accent" style={[styles.summaryCard, isWebDesktop && styles.summaryCardDesktop]}>
                        <Text style={styles.summaryEyebrow}>Leaderboard</Text>
                        <Text style={styles.summaryTitle}>
                            {leaderboardState.totalUsers} users ranked
                        </Text>
                        <Text style={styles.summarySubtitle}>
                            {topEntry
                                ? `@${topEntry.username} is leading with ${topEntry.score} points.`
                                : 'No ranked users yet.'}
                        </Text>
                        {generatedAtLabel ? (
                            <Text style={styles.summaryTimestamp}>
                                Updated {generatedAtLabel}
                            </Text>
                        ) : null}
                        <ModernButton
                            title={leaderboardState.refreshing ? 'Refreshing...' : 'Refresh'}
                            onPress={refreshLeaderboard}
                            variant="secondary"
                            disabled={leaderboardState.refreshing}
                            style={styles.summaryAction}
                        />
                    </Card>
                </View>

                {leaderboardState.error ? (
                    <Card style={styles.messageCard}>
                        <Text style={styles.messageTitle}>Could not load the ranking</Text>
                        <Text style={styles.messageText}>{leaderboardState.error}</Text>
                        <ModernButton
                            title={leaderboardState.refreshing ? 'Refreshing...' : 'Try again'}
                            onPress={refreshLeaderboard}
                            variant="secondary"
                            disabled={leaderboardState.refreshing}
                            style={styles.messageAction}
                        />
                    </Card>
                ) : null}

                {!leaderboardState.error && !currentUsername ? (
                    <Card style={styles.messageCard}>
                        <Text style={styles.messageTitle}>Guest mode</Text>
                        <Text style={styles.messageText}>
                            You can browse the ranking already. Sign in from Settings if you want
                            your own synced score to appear here.
                        </Text>
                    </Card>
                ) : !leaderboardState.error && currentUserEntry ? (
                    <Card style={styles.currentUserCard}>
                        <Text style={styles.currentUserEyebrow}>Your standing</Text>
                        <Text style={styles.currentUserTitle}>
                            #{currentUserEntry.rank} with {currentUserEntry.score} points
                        </Text>
                        <Text style={styles.currentUserText}>
                            {currentUserEntry.correctCount} correct, {currentUserEntry.wrongCount}{' '}
                            wrong, and {currentUserEntry.unknownCount || 0} I don't know across{' '}
                            {currentUserEntry.studiedCount} tracked words.
                        </Text>
                    </Card>
                ) : !leaderboardState.error ? (
                    <Card style={styles.messageCard}>
                        <Text style={styles.messageTitle}>You are not ranked yet</Text>
                        <Text style={styles.messageText}>
                            Your account is signed in, but there is no synced cloud progress in the
                            leaderboard yet. Practice a few cards and let the app sync.
                        </Text>
                    </Card>
                ) : null}

                {!leaderboardState.error && !hasLeaderboardData ? (
                    <Card style={styles.messageCard}>
                        <Text style={styles.messageTitle}>No users in the ranking yet</Text>
                        <Text style={styles.messageText}>
                            As soon as users create accounts and sync progress, their weighted
                            scores will appear here.
                        </Text>
                    </Card>
                ) : hasLeaderboardData ? (
                    <View style={styles.listColumn}>
                        {leaderboardState.leaderboard.map((entry) => {
                            const isCurrentUser = currentUsername === entry.username;
                            const accent = getRankAccent(entry.rank, colors);

                            return (
                                <Card
                                    key={entry.userId}
                                    tone={isCurrentUser ? 'accent' : 'default'}
                                    style={[
                                        styles.rankCard,
                                        isCurrentUser && styles.rankCardCurrentUser,
                                    ]}
                                >
                                    <View style={styles.rankRow}>
                                        <View
                                            style={[
                                                styles.rankBadge,
                                                { backgroundColor: accent.backgroundColor },
                                            ]}
                                        >
                                            <Ionicons
                                                color={accent.textColor}
                                                name={accent.icon}
                                                size={15}
                                            />
                                            <Text
                                                style={[
                                                    styles.rankBadgeText,
                                                    { color: accent.textColor },
                                                ]}
                                            >
                                                #{entry.rank}
                                            </Text>
                                        </View>

                                        <View style={styles.rankIdentity}>
                                            <Text style={styles.rankUsername}>
                                                @{entry.username}
                                            </Text>
                                            <Text style={styles.rankMeta}>
                                                {entry.correctCount} correct · {entry.wrongCount}{' '}
                                                wrong · {entry.unknownCount || 0} I don't know ·{' '}
                                                {entry.studiedCount} words
                                            </Text>
                                        </View>

                                        <View style={styles.rankScoreBlock}>
                                            <Text style={styles.rankScore}>{entry.score}</Text>
                                            <Text style={styles.rankScoreLabel}>points</Text>
                                        </View>
                                    </View>
                                </Card>
                            );
                        })}
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
        scrollContentWeb: {
            width: '100%',
            maxWidth: layout.contentMaxWidth,
            alignSelf: 'center',
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 148,
            gap: 18,
        },
        scrollContentDesktop: {
            minHeight: 760,
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
            letterSpacing: 0.8,
            textTransform: 'uppercase',
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
        heroRow: {
            gap: 14,
        },
        heroRowDesktop: {
            flexDirection: 'row',
            alignItems: 'stretch',
        },
        hero: {
            gap: 8,
        },
        heroDesktop: {
            flex: 1,
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
        heroTitleDesktop: {
            fontSize: 40,
            lineHeight: 46,
        },
        heroSubtitle: {
            fontFamily: typography.uiFont,
            fontSize: 16,
            lineHeight: 24,
            color: colors.textSecondary,
            maxWidth: 760,
        },
        heroSubtitleDesktop: {
            fontSize: 17,
            lineHeight: 26,
        },
        summaryCard: {
            gap: 10,
        },
        summaryCardDesktop: {
            width: layout.desktopAsideWidth,
        },
        summaryEyebrow: {
            fontFamily: typography.headingFont,
            fontSize: 13,
            lineHeight: 18,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: colors.accent,
        },
        summaryTitle: {
            fontFamily: typography.headingFont,
            fontSize: 28,
            lineHeight: 34,
            fontWeight: '700',
            color: colors.text,
        },
        summarySubtitle: {
            fontFamily: typography.uiFont,
            fontSize: 15,
            lineHeight: 22,
            color: colors.textSecondary,
        },
        summaryTimestamp: {
            fontFamily: typography.uiFont,
            fontSize: 13,
            lineHeight: 18,
            color: colors.textMuted,
        },
        summaryAction: {
            minHeight: 62,
        },
        currentUserCard: {
            gap: 8,
        },
        currentUserEyebrow: {
            fontFamily: typography.headingFont,
            fontSize: 13,
            lineHeight: 18,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: colors.accent,
        },
        currentUserTitle: {
            fontFamily: typography.headingFont,
            fontSize: 28,
            lineHeight: 34,
            fontWeight: '700',
            color: colors.text,
        },
        currentUserText: {
            fontFamily: typography.uiFont,
            fontSize: 15,
            lineHeight: 22,
            color: colors.textSecondary,
        },
        messageCard: {
            gap: 8,
        },
        messageTitle: {
            fontFamily: typography.headingFont,
            fontSize: 24,
            lineHeight: 30,
            fontWeight: '700',
            color: colors.text,
        },
        messageText: {
            fontFamily: typography.uiFont,
            fontSize: 15,
            lineHeight: 22,
            color: colors.textSecondary,
        },
        messageAction: {
            marginTop: 4,
            minHeight: 58,
            alignSelf: layout.isWebDesktop ? 'flex-start' : 'stretch',
        },
        listColumn: {
            gap: 12,
        },
        rankCard: {
            paddingVertical: 18,
        },
        rankCardCurrentUser: {
            borderColor: 'transparent',
        },
        rankRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
        },
        rankBadge: {
            minWidth: 74,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: radii.pill,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
        },
        rankBadgeText: {
            fontFamily: typography.uiFont,
            fontSize: 14,
            lineHeight: 18,
            fontWeight: '800',
        },
        rankIdentity: {
            flex: 1,
            gap: 3,
        },
        rankUsername: {
            fontFamily: typography.headingFont,
            fontSize: 24,
            lineHeight: 30,
            fontWeight: '700',
            color: colors.text,
        },
        rankMeta: {
            fontFamily: typography.uiFont,
            fontSize: 14,
            lineHeight: 20,
            color: colors.textSecondary,
        },
        rankScoreBlock: {
            minWidth: 90,
            alignItems: 'flex-end',
            gap: 2,
        },
        rankScore: {
            fontFamily: typography.headingFont,
            fontSize: 30,
            lineHeight: 36,
            fontWeight: '700',
            color: colors.text,
        },
        rankScoreLabel: {
            fontFamily: typography.uiFont,
            fontSize: 13,
            lineHeight: 18,
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
        },
    });

export default RankingScreen;
