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

const CELL_WIDTH = 56;
const CELL_HEIGHT = 46;
const LEFT_COL_WIDTH = 86;
const CHART_GRID_WIDTH = initials.length * CELL_WIDTH;
const CHART_TOTAL_WIDTH = LEFT_COL_WIDTH + CHART_GRID_WIDTH + 2;

const FINAL_LOOKUP_MAP = {
    iou: 'iu',
    uei: 'ui',
    uen: 'un',
};

const getPinyinSyllable = (initial, final) => {
    const normalizedFinal = FINAL_LOOKUP_MAP[final] || final;

    if (
        (initial === 'j' || initial === 'q' || initial === 'x') &&
        normalizedFinal.startsWith('ü')
    ) {
        return `${initial}u${normalizedFinal.slice(1)}`;
    }

    return `${initial}${normalizedFinal}`;
};

const PinyinChartScreen = () => {
    const { width } = useWindowDimensions();
    const { isWebWide, isWebDesktop, contentMaxWidth } = getResponsiveLayout(width);
    const desktopAsideWidth = isWebDesktop
        ? Math.min(Math.max(width * 0.23, 360), 460)
        : 360;
    const { colors, radii, typography } = useAppTheme();
    const styles = useMemo(
        () =>
            createStyles(colors, radii, typography, {
                isWebWide,
                isWebDesktop,
                contentMaxWidth,
                desktopAsideWidth,
            }),
        [
            colors,
            radii,
            typography,
            isWebWide,
            isWebDesktop,
            contentMaxWidth,
            desktopAsideWidth,
        ],
    );
    const finalsColRef = useRef(null);
    const headerRowRef = useRef(null);
    const gridVerticalRef = useRef(null);
    const gridHorizontalRef = useRef(null);
    const isSyncingFinals = useRef(false);
    const isSyncingGridY = useRef(false);
    const isSyncingHeader = useRef(false);
    const isSyncingGridX = useRef(false);

    const handleFinalsScroll = (event) => {
        if (isSyncingFinals.current) {
            return;
        }

        isSyncingGridY.current = true;
        gridVerticalRef.current?.scrollTo({
            y: event.nativeEvent.contentOffset.y,
            animated: false,
        });

        setTimeout(() => {
            isSyncingGridY.current = false;
        }, 50);
    };

    const handleGridVerticalScroll = (event) => {
        if (isSyncingGridY.current) {
            return;
        }

        isSyncingFinals.current = true;
        finalsColRef.current?.scrollTo({
            y: event.nativeEvent.contentOffset.y,
            animated: false,
        });

        setTimeout(() => {
            isSyncingFinals.current = false;
        }, 50);
    };

    const handleHeaderScroll = (event) => {
        if (isSyncingHeader.current) {
            return;
        }

        isSyncingGridX.current = true;
        gridHorizontalRef.current?.scrollTo({
            x: event.nativeEvent.contentOffset.x,
            animated: false,
        });

        setTimeout(() => {
            isSyncingGridX.current = false;
        }, 50);
    };

    const handleGridHorizontalScroll = (event) => {
        if (isSyncingGridX.current) {
            return;
        }

        isSyncingHeader.current = true;
        headerRowRef.current?.scrollTo({
            x: event.nativeEvent.contentOffset.x,
            animated: false,
        });

        setTimeout(() => {
            isSyncingHeader.current = false;
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
                        <Text style={styles.eyebrow}>Pinyin</Text>
                        <Text style={[styles.heroTitle, isWebDesktop && styles.heroTitleDesktop]}>
                            Pinyin Chart
                        </Text>
                        <Text
                            style={[
                                styles.heroSubtitle,
                                isWebDesktop && styles.heroSubtitleDesktop,
                            ]}
                        >
                            Scroll sideways for initials and vertically for finals. Filled cells
                            show valid Mandarin syllables in the new study order.
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
                                Horizontal scroll moves initials. Vertical scroll moves finals.
                            </Text>
                        </View>
                    </Card>
                </View>

                <Card style={[styles.chartCard, isWebDesktop && styles.chartCardDesktop]}>
                    <View style={[styles.chartShell, isWebDesktop && styles.chartShellDesktop]}>
                        <View style={styles.leftPane}>
                            <View style={[styles.cell, styles.cornerCell]}>
                                <Text style={styles.cornerText}>Final</Text>
                            </View>

                            <ScrollView
                                ref={finalsColRef}
                                showsVerticalScrollIndicator={false}
                                scrollEventThrottle={16}
                                onScroll={handleFinalsScroll}
                            >
                                {finals.map((final, index) => (
                                    <View
                                        key={`${final}-${index}`}
                                        style={[styles.cell, styles.leftHeaderCell]}
                                    >
                                        <Text style={styles.headerText}>{final}</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>

                        <View style={styles.rightPane}>
                            <ScrollView
                                ref={headerRowRef}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                scrollEventThrottle={16}
                                onScroll={handleHeaderScroll}
                                style={styles.topHeaderStrip}
                            >
                                <View style={styles.row}>
                                    {initials.map((initial) => (
                                        <View key={initial} style={[styles.cell, styles.headerCell]}>
                                            <Text style={styles.headerText}>{initial}</Text>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>

                            <ScrollView
                                ref={gridVerticalRef}
                                showsVerticalScrollIndicator={false}
                                scrollEventThrottle={16}
                                onScroll={handleGridVerticalScroll}
                            >
                                <ScrollView
                                    ref={gridHorizontalRef}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    scrollEventThrottle={16}
                                    onScroll={handleGridHorizontalScroll}
                                >
                                    <View>
                                        {finals.map((final, finalIndex) => (
                                            <View key={`${final}-${finalIndex}`} style={styles.row}>
                                                {initials.map((initial) => {
                                                    const syllable = getPinyinSyllable(initial, final);
                                                    const isValid = validSyllables.has(syllable);

                                                    return (
                                                        <View
                                                            key={`${final}-${initial}`}
                                                            style={[
                                                                styles.cell,
                                                                isValid
                                                                    ? styles.contentCell
                                                                    : styles.emptyCell,
                                                            ]}
                                                        >
                                                            {isValid ? (
                                                                <Text style={styles.cellText}>
                                                                    {syllable}
                                                                </Text>
                                                            ) : null}
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>
                            </ScrollView>
                        </View>
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
            maxWidth: 760,
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
            maxWidth: 620,
        },
        legendCard: {
            gap: 10,
        },
        legendCardDesktop: {
            width: layout.desktopAsideWidth,
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
            width: '100%',
            maxWidth: CHART_TOTAL_WIDTH,
            alignSelf: 'center',
        },
        chartShell: {
            flexDirection: 'row',
            borderRadius: radii.lg,
            overflow: 'hidden',
        },
        chartShellDesktop: {
            minHeight: 720,
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
        topHeaderStrip: {
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceMuted,
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
            fontFamily: typography.uiFont,
            fontSize: 11,
            fontWeight: '800',
            lineHeight: 14,
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
            fontFamily: typography.studyFont,
            fontSize: 11,
            fontWeight: '800',
            lineHeight: 15,
        },
        contentCell: {
            backgroundColor: colors.surface,
        },
        emptyCell: {
            backgroundColor: colors.backgroundMuted,
        },
        cellText: {
            color: colors.primaryStrong,
            fontFamily: typography.studyFont,
            fontSize: 11,
            fontWeight: '700',
            lineHeight: 15,
        },
    });

export default PinyinChartScreen;
