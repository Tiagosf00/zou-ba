import React, { useMemo, useState } from 'react';
import {
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../theme/ThemeProvider';
import { getResponsiveLayout } from '../utils/layout';
import { getMeaningLines } from '../utils/practice';

import hskData from '../../assets/hsk_1_6_pdf_dataset_english.json';

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'selected', label: 'Selected' },
    { id: 'hsk-1', label: 'HSK 1' },
    { id: 'hsk-2', label: 'HSK 2' },
    { id: 'hsk-3', label: 'HSK 3' },
    { id: 'hsk-4', label: 'HSK 4' },
    { id: 'hsk-5', label: 'HSK 5' },
    { id: 'hsk-6', label: 'HSK 6' },
];

const HANZI_INDEX = hskData.reduce((index, item) => {
    const matches = index.get(item.hanzi) || [];
    index.set(item.hanzi, [...matches, item]);
    return index;
}, new Map());

const normalizeSearchText = (value) => String(value || '').trim().toLowerCase();

const getWordSearchText = (item) =>
    normalizeSearchText(
        [
            item.hanzi,
            item.pinyin,
            item.rawEnglish,
            item.detailedEnglishTranslation,
            ...(item.translations?.eng || []),
        ].join(' '),
    );

const getMeaningSummary = (item) => {
    const lines = getMeaningLines(item);
    return lines.length > 0 ? lines.slice(0, 2).join(', ') : 'No meaning available.';
};

const sortCardIds = (cardIds) =>
    Array.from(new Set(cardIds.map((cardId) => Number(cardId)))).sort(
        (left, right) => left - right,
    );

const splitImportTokens = (value) =>
    String(value || '')
        .split(/[\s,，;；、]+/)
        .map((token) => token.trim())
        .filter(Boolean);

const CustomVocabularyEditor = ({
    visible,
    customCardIds,
    onChangeCardIds,
    onClose,
}) => {
    const { width } = useWindowDimensions();
    const { isWebDesktop } = getResponsiveLayout(width);
    const { colors, radii, shadows, typography } = useAppTheme();
    const styles = useMemo(
        () => createStyles(colors, radii, shadows, typography, { isWebDesktop }),
        [colors, radii, shadows, typography, isWebDesktop],
    );
    const [query, setQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [pasteText, setPasteText] = useState('');
    const [importFeedback, setImportFeedback] = useState(null);

    const selectedKey = customCardIds.join('-');
    const selectedIds = useMemo(() => new Set(customCardIds), [selectedKey]);
    const normalizedQuery = normalizeSearchText(query);

    const filteredWords = useMemo(() => {
        return hskData.filter((item) => {
            if (activeFilter === 'selected' && !selectedIds.has(item.id)) {
                return false;
            }

            if (activeFilter.startsWith('hsk-')) {
                const level = Number(activeFilter.replace('hsk-', ''));

                if (item.level !== level) {
                    return false;
                }
            }

            if (!normalizedQuery) {
                return true;
            }

            return getWordSearchText(item).includes(normalizedQuery);
        });
    }, [activeFilter, normalizedQuery, selectedIds]);

    const visibleSelectedCount = filteredWords.reduce(
        (count, item) => count + (selectedIds.has(item.id) ? 1 : 0),
        0,
    );

    const updateSelectedIds = (nextCardIds) => {
        onChangeCardIds(sortCardIds(nextCardIds));
    };

    const toggleWord = (item) => {
        if (selectedIds.has(item.id)) {
            updateSelectedIds(customCardIds.filter((cardId) => cardId !== item.id));
            return;
        }

        updateSelectedIds([...customCardIds, item.id]);
    };

    const addVisibleWords = () => {
        updateSelectedIds([...customCardIds, ...filteredWords.map((item) => item.id)]);
    };

    const removeVisibleWords = () => {
        const visibleIds = new Set(filteredWords.map((item) => item.id));
        updateSelectedIds(customCardIds.filter((cardId) => !visibleIds.has(cardId)));
    };

    const clearSelection = () => {
        updateSelectedIds([]);
    };

    const importPastedWords = () => {
        const tokens = splitImportTokens(pasteText);

        if (tokens.length === 0) {
            setImportFeedback({
                tone: 'muted',
                message: 'Paste a teacher list first.',
            });
            return;
        }

        const matchedIds = [];
        const unmatchedTokens = [];
        const matchedTokens = new Set();

        tokens.forEach((token) => {
            const matches = HANZI_INDEX.get(token) || [];

            if (matches.length === 0) {
                unmatchedTokens.push(token);
                return;
            }

            matchedTokens.add(token);
            matches.forEach((item) => matchedIds.push(item.id));
        });

        const nextCardIds = sortCardIds([...customCardIds, ...matchedIds]);
        const addedCount = nextCardIds.length - customCardIds.length;

        updateSelectedIds(nextCardIds);
        setImportFeedback({
            tone: unmatchedTokens.length > 0 ? 'warning' : 'success',
            message:
                unmatchedTokens.length > 0
                    ? `Added ${addedCount} new words. Could not match: ${unmatchedTokens
                          .slice(0, 8)
                          .join(', ')}${unmatchedTokens.length > 8 ? ', ...' : ''}`
                    : `Added ${addedCount} new words from ${matchedTokens.size} matched entries.`,
        });
    };

    const renderFilter = ({ id, label }) => {
        const isActive = activeFilter === id;

        return (
            <Pressable
                key={id}
                onPress={() => setActiveFilter(id)}
                style={({ pressed }) => [
                    styles.filterChip,
                    isActive && styles.filterChipActive,
                    pressed && styles.pressed,
                ]}
            >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {label}
                </Text>
            </Pressable>
        );
    };

    const renderWordRow = ({ item }) => {
        const isSelected = selectedIds.has(item.id);

        return (
            <Pressable
                onPress={() => toggleWord(item)}
                style={({ pressed }) => [
                    styles.wordRow,
                    isSelected && styles.wordRowSelected,
                    pressed && styles.wordRowPressed,
                ]}
            >
                <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                    {isSelected ? (
                        <Ionicons color={colors.onPrimary} name="checkmark" size={16} />
                    ) : null}
                </View>

                <View style={styles.wordCopy}>
                    <View style={styles.wordHeading}>
                        <Text style={styles.wordHanzi}>{item.hanzi}</Text>
                        <Text style={styles.wordPinyin}>{item.pinyin}</Text>
                    </View>
                    <Text numberOfLines={2} style={styles.wordMeaning}>
                        {getMeaningSummary(item)}
                    </Text>
                </View>

                <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>HSK {item.level}</Text>
                </View>
            </Pressable>
        );
    };

    return (
        <Modal
            animationType="slide"
            onRequestClose={onClose}
            presentationStyle="fullScreen"
            visible={visible}
        >
            <SafeAreaView style={styles.container}>
                <View style={[styles.panel, isWebDesktop && styles.panelDesktop]}>
                    <View style={styles.header}>
                        <View style={styles.headerCopy}>
                            <Text style={styles.eyebrow}>Custom vocabulary</Text>
                            <Text style={styles.title}>{customCardIds.length} selected</Text>
                            <Text style={styles.subtitle}>
                                Search the full deck, import a teacher list, and choose the words
                                that should appear in practice.
                            </Text>
                        </View>

                        <Pressable
                            onPress={onClose}
                            style={({ pressed }) => [
                                styles.closeButton,
                                pressed && styles.pressed,
                            ]}
                        >
                            <Ionicons color={colors.text} name="close" size={20} />
                        </Pressable>
                    </View>

                    <View style={styles.controls}>
                        <View style={styles.searchBox}>
                            <Ionicons color={colors.textMuted} name="search" size={18} />
                            <TextInput
                                autoCapitalize="none"
                                autoCorrect={false}
                                onChangeText={setQuery}
                                placeholder="Search hanzi, pinyin, or meaning"
                                placeholderTextColor={colors.textMuted}
                                style={styles.searchInput}
                                value={query}
                            />
                            {query ? (
                                <Pressable onPress={() => setQuery('')} style={styles.clearSearch}>
                                    <Ionicons color={colors.textMuted} name="close-circle" size={18} />
                                </Pressable>
                            ) : null}
                        </View>

                        <View style={styles.filterRow}>{FILTERS.map(renderFilter)}</View>

                        <View style={styles.importBox}>
                            <Text style={styles.importLabel}>Paste teacher words</Text>
                            <TextInput
                                multiline
                                onChangeText={setPasteText}
                                placeholder="例如: 爱 老师 学校"
                                placeholderTextColor={colors.textMuted}
                                style={styles.pasteInput}
                                value={pasteText}
                            />
                            <View style={styles.importActions}>
                                <Pressable
                                    onPress={importPastedWords}
                                    style={({ pressed }) => [
                                        styles.actionButton,
                                        styles.actionButtonPrimary,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Ionicons color={colors.onPrimary} name="add" size={16} />
                                    <Text style={styles.actionButtonTextPrimary}>Import matches</Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => {
                                        setPasteText('');
                                        setImportFeedback(null);
                                    }}
                                    style={({ pressed }) => [
                                        styles.actionButton,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text style={styles.actionButtonText}>Clear paste</Text>
                                </Pressable>
                            </View>

                            {importFeedback ? (
                                <Text
                                    style={[
                                        styles.importFeedback,
                                        importFeedback.tone === 'success' && styles.importFeedbackSuccess,
                                        importFeedback.tone === 'warning' && styles.importFeedbackWarning,
                                    ]}
                                >
                                    {importFeedback.message}
                                </Text>
                            ) : null}
                        </View>

                        <View style={styles.bulkRow}>
                            <Text style={styles.resultText}>
                                {filteredWords.length} visible · {visibleSelectedCount} selected here
                            </Text>
                            <View style={styles.bulkActions}>
                                <Pressable
                                    onPress={addVisibleWords}
                                    style={({ pressed }) => [
                                        styles.smallButton,
                                        styles.smallButtonAccent,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text style={styles.smallButtonTextAccent}>Add visible</Text>
                                </Pressable>
                                <Pressable
                                    onPress={removeVisibleWords}
                                    style={({ pressed }) => [
                                        styles.smallButton,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text style={styles.smallButtonText}>Remove visible</Text>
                                </Pressable>
                                <Pressable
                                    onPress={clearSelection}
                                    style={({ pressed }) => [
                                        styles.smallButton,
                                        styles.smallButtonDanger,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text style={styles.smallButtonTextDanger}>Clear all</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>

                    <FlatList
                        contentContainerStyle={styles.listContent}
                        data={filteredWords}
                        initialNumToRender={24}
                        keyboardShouldPersistTaps="handled"
                        keyExtractor={(item) => String(item.id)}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyTitle}>No matching words</Text>
                                <Text style={styles.emptyText}>
                                    Try another search or switch the filter back to all words.
                                </Text>
                            </View>
                        }
                        maxToRenderPerBatch={32}
                        renderItem={renderWordRow}
                        style={styles.list}
                        windowSize={12}
                    />
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const createStyles = (colors, radii, shadows, typography, layout) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        panel: {
            flex: 1,
            paddingHorizontal: 18,
            paddingTop: 12,
            paddingBottom: 18,
            gap: 14,
        },
        panelDesktop: {
            width: '100%',
            maxWidth: 1180,
            alignSelf: 'center',
            paddingHorizontal: 28,
            paddingTop: 24,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 16,
        },
        headerCopy: {
            flex: 1,
            gap: 6,
        },
        eyebrow: {
            color: colors.primaryStrong,
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 1.1,
            textTransform: 'uppercase',
        },
        title: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: layout.isWebDesktop ? 38 : 30,
            lineHeight: layout.isWebDesktop ? 43 : 34,
        },
        subtitle: {
            color: colors.textSecondary,
            fontSize: 15,
            lineHeight: 22,
            maxWidth: 760,
        },
        closeButton: {
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            ...shadows.sm,
        },
        pressed: {
            transform: [{ scale: 0.98 }],
        },
        controls: {
            gap: 12,
        },
        searchBox: {
            minHeight: 52,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 14,
            borderRadius: radii.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        searchInput: {
            flex: 1,
            color: colors.text,
            fontSize: 16,
            paddingVertical: 12,
        },
        clearSearch: {
            padding: 4,
        },
        filterRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        filterChip: {
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        filterChipActive: {
            backgroundColor: colors.primary,
            borderColor: 'transparent',
        },
        filterChipText: {
            color: colors.text,
            fontSize: 13,
            fontWeight: '800',
        },
        filterChipTextActive: {
            color: colors.onPrimary,
        },
        importBox: {
            gap: 10,
            padding: 14,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
        },
        importLabel: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '800',
        },
        pasteInput: {
            minHeight: 70,
            maxHeight: 118,
            textAlignVertical: 'top',
            color: colors.text,
            fontSize: 16,
            lineHeight: 22,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: radii.sm,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        importActions: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
        },
        actionButton: {
            minHeight: 42,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            paddingHorizontal: 14,
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        actionButtonPrimary: {
            backgroundColor: colors.primary,
            borderColor: 'transparent',
        },
        actionButtonText: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '800',
        },
        actionButtonTextPrimary: {
            color: colors.onPrimary,
            fontSize: 14,
            fontWeight: '800',
        },
        importFeedback: {
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 18,
        },
        importFeedbackSuccess: {
            color: colors.success,
        },
        importFeedbackWarning: {
            color: colors.primaryStrong,
        },
        bulkRow: {
            gap: 10,
        },
        resultText: {
            color: colors.textSecondary,
            fontSize: 13,
            fontWeight: '700',
        },
        bulkActions: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        smallButton: {
            minHeight: 38,
            justifyContent: 'center',
            paddingHorizontal: 12,
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        smallButtonAccent: {
            backgroundColor: colors.accentSoft,
            borderColor: 'transparent',
        },
        smallButtonDanger: {
            backgroundColor: colors.errorSoft,
            borderColor: 'transparent',
        },
        smallButtonText: {
            color: colors.text,
            fontSize: 13,
            fontWeight: '800',
        },
        smallButtonTextAccent: {
            color: colors.accent,
            fontSize: 13,
            fontWeight: '800',
        },
        smallButtonTextDanger: {
            color: colors.error,
            fontSize: 13,
            fontWeight: '800',
        },
        list: {
            flex: 1,
        },
        listContent: {
            gap: 10,
            paddingBottom: 28,
        },
        wordRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            borderRadius: radii.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        wordRowSelected: {
            borderColor: colors.primarySoft,
            backgroundColor: colors.accentSoft,
        },
        wordRowPressed: {
            transform: [{ scale: 0.995 }],
        },
        checkCircle: {
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            alignItems: 'center',
            justifyContent: 'center',
        },
        checkCircleSelected: {
            backgroundColor: colors.primary,
            borderColor: 'transparent',
        },
        wordCopy: {
            flex: 1,
            gap: 5,
            minWidth: 0,
        },
        wordHeading: {
            flexDirection: 'row',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: 9,
        },
        wordHanzi: {
            color: colors.text,
            fontFamily: typography.studyFont,
            fontSize: 24,
            fontWeight: '800',
            lineHeight: 30,
        },
        wordPinyin: {
            color: colors.primaryStrong,
            fontSize: 15,
            fontWeight: '800',
            lineHeight: 21,
        },
        wordMeaning: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 20,
        },
        levelBadge: {
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceMuted,
        },
        levelBadgeText: {
            color: colors.textSecondary,
            fontSize: 12,
            fontWeight: '800',
        },
        emptyState: {
            paddingVertical: 42,
            alignItems: 'center',
            gap: 8,
        },
        emptyTitle: {
            color: colors.text,
            fontSize: 19,
            fontWeight: '800',
        },
        emptyText: {
            color: colors.textSecondary,
            fontSize: 14,
            lineHeight: 20,
            textAlign: 'center',
        },
    });

export default CustomVocabularyEditor;

