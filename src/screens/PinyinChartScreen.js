import React, { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import Card from '../components/Card';
import BackdropOrbs from '../components/BackdropOrbs';
import { useAppTheme } from '../theme/ThemeProvider';
import { initials, finals } from '../data/pinyinData';
import { validSyllables } from '../data/validPinyin';
import { getResponsiveLayout } from '../utils/layout';

const CELL_WIDTH = 68;
const CELL_HEIGHT = 54;
const LEFT_COL_WIDTH = 68;

const getPinyinSyllable = (initial, final) => {
    if (
        (initial === 'j' || initial === 'q' || initial === 'x' || initial === 'y') &&
        final.startsWith('ü')
    ) {
        return `${initial}u${final.slice(1)}`;
    }

    return `${initial}${final}`;
};

const PinyinChartScreen = () => {
    const { width } = useWindowDimensions();
    const { isWebWide, isWebDesktop, contentMaxWidth } = getResponsiveLayout(width);
    const { colors, radii, typography } = useAppTheme();
    const styles = useMemo(
        () =>
            createStyles(colors, radii, typography, {
                isWebWide,
                isWebDesktop,
                contentMaxWidth,
            }),
        [colors, radii, typography, isWebWide, isWebDesktop, contentMaxWidth],
    );
    const leftColRef = useRef(null);
    const rightGridRef = useRef(null);
    const isSyncingLeft = useRef(false);
    const isSyncingRight = useRef(false);

    const handleLeftScroll = (event) => {
        if (isSyncingLeft.current) {
            return;
        }

        isSyncingRight.current = true;
        rightGridRef.current?.scrollTo({
            y: event.nativeEvent.contentOffset.y,
            animated: false,
        });

        setTimeout(() => {
            isSyncingRight.current = false;
        }, 50);
    };

    const handleRightScroll = (event) => {
        if (isSyncingRight.current) {
            return;
        }

        isSyncingLeft.current = true;
        leftColRef.current?.scrollTo({
            y: event.nativeEvent.contentOffset.y,
            animated: false,
        });

        setTimeout(() => {
            isSyncingLeft.current = false;
        }, 50);
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
                <View style={[styles.overviewRow, isWebDesktop && styles.overviewRowDesktop]}>
                    <View style={[styles.hero, isWebDesktop && styles.heroDesktop]}>
                        <Text style={styles.eyebrow}>Reference chart</Text>
                        <Text style={[styles.heroTitle, isWebDesktop && styles.heroTitleDesktop]}>
                            Explore initials and finals together.
                        </Text>
                        <Text
                            style={[
                                styles.heroSubtitle,
                                isWebDesktop && styles.heroSubtitleDesktop,
                            ]}
                        >
                            Scroll sideways for finals and vertically for initials. Filled cells
                            mark valid Mandarin syllables.
                        </Text>
                    </View>

                    <Card
                        tone="accent"
                        style={[styles.legendCard, isWebDesktop && styles.legendCardDesktop]}
                    >
                        <View style={styles.legendItem}>
                            <Ionicons color={colors.accent} name="ellipse" size={12} />
                            <Text style={styles.legendText}>Filled cells are valid syllables.</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <Ionicons
                                color={colors.primaryStrong}
                                name="swap-horizontal"
                                size={14}
                            />
                            <Text style={styles.legendText}>
                                Swipe in both directions to browse the full table.
                            </Text>
                        </View>
                    </Card>
                </View>

                <Card style={[styles.chartCard, isWebDesktop && styles.chartCardDesktop]}>
                    <View style={[styles.chartShell, isWebDesktop && styles.chartShellDesktop]}>
                        <View style={styles.leftPane}>
                            <View style={[styles.cell, styles.cornerCell]}>
                                <Text style={styles.cornerText}>Init.</Text>
                            </View>

                            <ScrollView
                                ref={leftColRef}
                                showsVerticalScrollIndicator={false}
                                scrollEventThrottle={16}
                                onScroll={handleLeftScroll}
                            >
                                {initials.map((initial) => (
                                    <View key={initial || 'empty'} style={[styles.cell, styles.leftHeaderCell]}>
                                        <Text style={styles.headerText}>{initial || 'Ø'}</Text>
                                    </View>
                                ))}
                                <View style={styles.scrollSpacer} />
                            </ScrollView>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rightPane}>
                            <View>
                                <View style={styles.row}>
                                    {finals.map((final) => (
                                        <View key={final} style={[styles.cell, styles.headerCell]}>
                                            <Text style={styles.headerText}>{final}</Text>
                                        </View>
                                    ))}
                                </View>

                                <ScrollView
                                    ref={rightGridRef}
                                    showsVerticalScrollIndicator={false}
                                    scrollEventThrottle={16}
                                    onScroll={handleRightScroll}
                                >
                                    {initials.map((initial) => (
                                        <View key={initial || 'row-empty'} style={styles.row}>
                                            {finals.map((final) => {
                                                const syllable = getPinyinSyllable(initial, final);
                                                const isValid = validSyllables.has(syllable);

                                                return (
                                                    <View
                                                        key={`${initial}-${final}`}
                                                        style={[
                                                            styles.cell,
                                                            isValid ? styles.contentCell : styles.emptyCell,
                                                        ]}
                                                    >
                                                        {isValid ? (
                                                            <Text style={styles.cellText}>{syllable}</Text>
                                                        ) : null}
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    ))}
                                    <View style={styles.scrollSpacer} />
                                </ScrollView>
                            </View>
                        </ScrollView>
                    </View>
                </Card>
            </ScrollView>
        </SafeAreaView>
    );
};

const createStyles = (colors, radii, typography, layout) =>
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
        overviewRow: {
            gap: 18,
        },
        overviewRowDesktop: {
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
            maxWidth: 620,
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
            maxWidth: 560,
        },
        legendCard: {
            gap: 10,
        },
        legendCardDesktop: {
            width: 360,
            justifyContent: 'center',
        },
        legendItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        legendText: {
            flex: 1,
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 20,
        },
        chartCard: {
            padding: 0,
        },
        chartCardDesktop: {
            overflow: 'hidden',
        },
        chartShell: {
            flexDirection: 'row',
            borderRadius: radii.lg,
            overflow: 'hidden',
        },
        chartShellDesktop: {
            minHeight: 760,
        },
        leftPane: {
            width: LEFT_COL_WIDTH,
            backgroundColor: colors.surfaceMuted,
            borderRightWidth: 1,
            borderRightColor: colors.border,
        },
        rightPane: {
            flex: 1,
            backgroundColor: colors.surface,
        },
        row: {
            flexDirection: 'row',
        },
        cell: {
            width: CELL_WIDTH,
            height: CELL_HEIGHT,
            justifyContent: 'center',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderRightWidth: 1,
            borderColor: colors.border,
        },
        cornerCell: {
            width: LEFT_COL_WIDTH,
            backgroundColor: colors.primary,
        },
        cornerText: {
            color: colors.onPrimary,
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
        },
        headerCell: {
            backgroundColor: colors.surfaceMuted,
        },
        leftHeaderCell: {
            width: LEFT_COL_WIDTH,
            backgroundColor: colors.surfaceMuted,
        },
        headerText: {
            color: colors.textSecondary,
            fontSize: 12,
            fontWeight: '800',
        },
        contentCell: {
            backgroundColor: colors.surface,
        },
        emptyCell: {
            backgroundColor: colors.backgroundMuted,
        },
        cellText: {
            color: colors.primaryStrong,
            fontSize: 12,
            fontWeight: '700',
        },
        scrollSpacer: {
            height: 48,
        },
    });

export default PinyinChartScreen;
