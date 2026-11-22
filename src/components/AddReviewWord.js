import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeProvider';
import { createWordSearchIndex, searchVocabulary } from '../utils/wordSearch';
import { getMeaningLines } from '../utils/practice';
import hskData from '../../assets/hsk_1_6_pdf_dataset_english.json';

const searchIndex = createWordSearchIndex(hskData);

export default function AddReviewWord({ cards, items, reviewCardIds, onAdd, disabled }) {
    const { colors: c, typography: t } = useAppTheme();
    const styles = useMemo(() => createStyles(c, t), [c, t]);
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(8);
    const matches = useMemo(() => searchVocabulary(searchIndex, query), [query]);
    const enrolled = useMemo(() => new Set([
        ...reviewCardIds, ...items.filter(item => cards[item.id]).map(item => Number(item.id)),
    ]), [reviewCardIds, items, cards]);
    const changeQuery = value => { setQuery(value); setLimit(8); };

    return <View testID="add-review-word" style={styles.container}>
        <View style={styles.search}>
            <Ionicons name="search-outline" size={19} color={c.textSecondary} />
            <TextInput accessibilityLabel="Search words to add to review" placeholder="Search Chinese, pinyin or English"
                placeholderTextColor={c.textMuted} value={query} onChangeText={changeQuery}
                autoCapitalize="none" autoCorrect={false} style={styles.input} />
            {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Clear word search"
                onPress={() => changeQuery('')} style={styles.clear}>
                <Ionicons name="close" size={18} color={c.textSecondary} />
            </Pressable>}
        </View>
        {!!query.trim() && <View testID="word-search-results" style={styles.results}>
            {matches.slice(0, limit).map(word => {
                const added = enrolled.has(Number(word.id));
                return <View key={word.id} testID={`word-search-result-${word.id}`} style={styles.result}>
                    <View style={styles.word}>
                        <View style={styles.reading}>
                            <Text selectable style={styles.hanzi}>{word.hanzi}</Text>
                            <Text selectable style={styles.pinyin}>{word.pinyin}</Text>
                        </View>
                        <Text selectable style={styles.meaning}>{getMeaningLines(word).slice(0, 2).join(', ')}</Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${added ? 'In review' : 'Add to review'}: ${word.hanzi}, ${word.pinyin}`}
                        accessibilityState={{ disabled: added || disabled }} disabled={added || disabled}
                        onPress={() => onAdd(word)} style={[styles.add, added && styles.added]}>
                        <Ionicons name={added ? 'checkmark' : 'add'} size={16} color={added ? c.textSecondary : c.primaryStrong} />
                        <Text style={[styles.addText, added && { color: c.textSecondary }]}>{added ? 'In review' : 'Add to review'}</Text>
                    </Pressable>
                </View>;
            })}
            {matches.length === 0 && <Text accessibilityLiveRegion="polite" style={styles.empty}>No matching words.</Text>}
            {matches.length > limit && <Pressable accessibilityRole="button" onPress={() => setLimit(value => value + 8)} style={styles.more}>
                <Text style={styles.addText}>Show more</Text>
            </Pressable>}
        </View>}
    </View>;
}

const createStyles = (c, t) => StyleSheet.create({
    container: { borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.surface, overflow: 'hidden' },
    search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 6, minHeight: 50 },
    input: { flex: 1, minWidth: 0, minHeight: 48, color: c.text, fontFamily: t.uiFont, fontSize: 14, outlineStyle: 'none' },
    clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    results: { borderTopWidth: 1, borderColor: c.border },
    result: { padding: 14, gap: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', borderBottomWidth: 1, borderColor: c.border },
    word: { flexGrow: 1, flexBasis: 180, minWidth: 0, gap: 4 },
    reading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 },
    hanzi: { color: c.text, fontFamily: t.studyFont, fontSize: 24, lineHeight: 34 },
    pinyin: { color: c.textSecondary, fontFamily: t.uiFont, fontSize: 15, lineHeight: 24 },
    meaning: { color: c.textSecondary, fontFamily: t.uiFont, fontSize: 14, lineHeight: 22 },
    add: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 10, paddingHorizontal: 11 },
    added: { borderColor: 'transparent' },
    addText: { color: c.primaryStrong, fontFamily: t.uiFont, fontSize: 13, fontWeight: '500' },
    empty: { padding: 18, color: c.textSecondary, fontFamily: t.uiFont, fontSize: 14 },
    more: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
