import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import BackdropOrbs from '../components/BackdropOrbs';
import ModernButton from '../components/ModernButton';
import AudioButton from '../components/AudioButton';
import AudioChoiceButton from '../components/AudioChoiceButton';
import AudioPrompt from '../components/AudioPrompt';
import ExampleSentence, { ExampleSource } from '../components/ExampleSentence';
import AddReviewWord from '../components/AddReviewWord';
import { Brand, ThemeButton } from '../components/AppNavigation';
import { getPracticeMode } from '../constants/practiceModes';
import { useAppState } from '../context/AppStateContext';
import { useAppTheme } from '../theme/ThemeProvider';
import { getResponsiveLayout } from '../utils/layout';
import { getPracticePoolItems } from '../utils/vocabularyPool';
import { buildRound, addExtraNewWords, getDisplayLines, getDisplayText, getDetailedMeaning, getMeaningLines,
    getTrainingSnapshot, getDailyStudySnapshot, MINIMUM_ITEMS_PER_ROUND, pickNextQuestion, recordStudyAnswer } from '../utils/practice';
import hskData from '../../assets/hsk_1_6_pdf_dataset_english.json';

const PracticeScreen = ({ navigation }) => {
    const { settings, progress, updateSettings, updateProgress, isHydrated } = useAppState();
    const { colors, typography } = useAppTheme();
    const { width } = useWindowDimensions();
    const { isWebWide, contentMaxWidth } = getResponsiveLayout(width);
    const split = width >= 1120;
    const styles = useMemo(() => createStyles(colors, typography, split), [colors, typography, split]);
    const isFocused = useIsFocused();
    const [queue, setQueue] = useState(null);
    const [round, setRound] = useState(null);
    const [selected, setSelected] = useState(null);
    const [answer, setAnswer] = useState(null);
    const [selfAnswerVisible, setSelfAnswerVisible] = useState(false);
    const [choiceGridWidth, setChoiceGridWidth] = useState(0);
    const [details, setDetails] = useState({});
    const [snapshotVisible, setSnapshotVisible] = useState(false);
    const [now, setNow] = useState(() => new Date());
    const progressRef = useRef(progress);
    const recentIds = useRef([]);
    const answerLock = useRef(false);
    const scrollRef = useRef(null);
    const cardTop = useRef(0);
    const feedbackScrolled = useRef(false);
    const queueTabs = useRef({});
    const poolKey = [settings.vocabularyPool, settings.hskLevels.join('-'), settings.customCardIds.join('-'), settings.reviewCardIds.join('-')].join(':');
    const items = useMemo(() => getPracticePoolItems(hskData, settings), [poolKey]);
    const training = useMemo(() => getTrainingSnapshot(items, progress.cards, now, settings.reviewCardIds), [items, progress.cards, now]);
    const daily = getDailyStudySnapshot(progress.cards, settings, progress.dailyStudy, now);
    const remaining = Math.min(training.newCount, Math.max(0, daily.allowance - daily.introducedToday));
    const isSelfReview = settings.practiceAnswerStyle === 'self-review';
    const minimumItems = isSelfReview || queue === 'review' ? 1 : MINIMUM_ITEMS_PER_ROUND;
    const hasRevealed = Boolean(answer) || selfAnswerVisible;
    // Keep the full reading on one line; long words get a wider choice, not tiny text.
    const widePinyinChoices = settings.outputMode === 'pinyin' && choiceGridWidth > 0
        && round?.options.some(item => item.pinyin.length * 10 + 36 > (choiceGridWidth - 10) / 2);

    const loadRound = (current = progressRef.current) => {
        const at = new Date();
        const study = getDailyStudySnapshot(current.cards, settings, current.dailyStudy, at);
        const next = items.length >= minimumItems
            ? pickNextQuestion(items, current.cards, at, recentIds.current, study, queue, settings.reviewCardIds) : null;
        if (next) recentIds.current = [next.id, ...recentIds.current.filter(id => id !== next.id)].slice(0, items.length <= 12 ? 4 : 8);
        // A single personally added word can still be reviewed with six answer options.
        const choicePool = queue === 'review' && items.length < MINIMUM_ITEMS_PER_ROUND ? hskData : items;
        setRound(next ? (isSelfReview ? { question: next, options: [] } : buildRound(choicePool, next, settings.outputMode)) : null);
        setSelfAnswerVisible(false);
        setAnswer(null); setSelected(null); setDetails({}); answerLock.current = false; feedbackScrolled.current = false;
    };
    useEffect(() => { progressRef.current = progress; }, [progress]);
    useEffect(() => {
        if (isHydrated && queue === null) setQueue(getTrainingSnapshot(items, progress.cards, new Date(), settings.reviewCardIds).dueCount ? 'review' : 'new');
    }, [isHydrated, queue, poolKey]);
    useEffect(() => {
        if (!isHydrated || !isFocused || !queue) return;
        recentIds.current = [];
        loadRound();
    }, [isHydrated, isFocused, queue, poolKey, settings.inputMode, settings.outputMode, settings.practiceAnswerStyle, settings.newWordsPerDay, settings.studyTimeZone]);
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);
    useEffect(() => { if (isHydrated && isFocused && queue && !round) loadRound(); }, [now, isHydrated, isFocused]);

    const submit = (item, reveal = false) => {
        if (!round || answerLock.current || !isHydrated) return;
        answerLock.current = true;
        const correct = !reveal && item.id === round.question.id;
        const next = recordStudyAnswer(progressRef.current, round.question, correct, settings, new Date(), { countAsWrong: !reveal });
        progressRef.current = next; updateProgress(next);
        setSelected(item); setAnswer(reveal ? 'revealed' : correct ? 'correct' : 'wrong'); setDetails({});
        setNow(new Date());
    };
    const gradeRecall = (remembered) => {
        // Revealing is read-only; only a deliberate rating advances the schedule.
        if (!isSelfReview || !selfAnswerVisible || !round || answerLock.current || !isHydrated) return;
        answerLock.current = true;
        const next = recordStudyAnswer(progressRef.current, round.question, remembered, settings, new Date());
        progressRef.current = next;
        updateProgress(next);
        setAnswer(remembered ? 'correct' : 'wrong');
        setNow(new Date());
    };
    const learnMore = () => {
        const next = addExtraNewWords(progressRef.current, settings);
        progressRef.current = next; updateProgress(next); setNow(new Date());
        if (queue !== 'new') setQueue('new'); else if (!round) loadRound(next);
    };
    const nextWord = () => { loadRound(); scrollRef.current?.scrollTo({ y: 0, animated: true }); };
    const meaning = item => getMeaningLines(item).join(', ');
    const detail = (item, key) => {
        const text = getDetailedMeaning(item);
        if (!text) return null;
        return <View style={{ gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: Boolean(details[key]) }}
                onPress={() => setDetails(value => ({ ...value, [key]: !value[key] }))} style={styles.detailToggle}>
                <Ionicons name={details[key] ? 'remove' : 'add'} size={16} color={colors.primaryStrong} />
                <Text style={styles.link}>Detailed meaning</Text>
            </Pressable>
            {details[key] && <Text selectable style={styles.body}>{text}</Text>}
        </View>;
    };
    const answerWord = (item, key, complete = false, showDetails = true) => <View style={{ gap: 8 }}>
        <View style={styles.inline}>
            <Text selectable style={styles.answerHanzi}>{item.hanzi}</Text>
            <Text selectable style={styles.pinyin}>{item.pinyin}</Text>
            <AudioButton hanzi={item.hanzi} label={`Play ${item.hanzi} audio`} />
        </View>
        <Text selectable style={styles.body}>{meaning(item)}</Text>
        {complete ? (getDetailedMeaning(item) && <Text selectable style={styles.body}>{getDetailedMeaning(item)}</Text>) : showDetails && detail(item, key)}
    </View>;
    const emptyTitle = !isHydrated ? 'Loading your practice…'
        : items.length < minimumItems ? (minimumItems === 1 ? 'Choose a word to practice' : 'Choose at least 6 words to practice')
        : queue === 'review' ? 'No reviews due'
        : training.newCount === 0 ? 'All words in this set introduced'
        : "Today's new-word allowance is complete.";

    return <SafeAreaView style={styles.container}>
        <BackdropOrbs />
        <ScrollView ref={scrollRef} contentContainerStyle={[styles.scroll, { maxWidth: Math.min(contentMaxWidth, 1120) }]}>
            {!isWebWide && <View style={styles.mobileBrand}><Brand /><ThemeButton /></View>}
            <View style={styles.pageHeader}>
                <Text role="heading" aria-level={1} style={styles.title}>Practice</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Practice settings" onPress={() => navigation.navigate('Settings')} style={styles.settingsButton}>
                    <Ionicons name="options-outline" size={18} color={colors.textSecondary} /><Text style={styles.meta}>Settings</Text>
                </Pressable>
            </View>
            <View style={styles.toolbar}>
                <View accessibilityRole="tablist" style={styles.tabs}>
                    {[['review', 'Review', training.dueCount], ['new', 'New words', remaining]].map(([id, label, count]) =>
                        <Pressable key={id} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: queue === id }}
                            ref={node => { queueTabs.current[id] = node; }} nativeID={`queue-${id}`} aria-controls="practice-panel"
                            onKeyDown={event => {
                                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                                    event.preventDefault();
                                    const target = event.key === 'Home' ? 'review' : event.key === 'End' ? 'new' : id === 'review' ? 'new' : 'review';
                                    setQueue(target); queueTabs.current[target]?.focus();
                                }
                            }}
                            onPress={() => setQueue(id)} style={[styles.tab, queue === id && styles.tabActive]}>
                            <Text style={[styles.tabLabel, queue === id && { color: colors.primaryStrong }]}>{label}</Text>
                            <Text style={[styles.tabCount, queue === id && { color: colors.primaryStrong }]}>{count}</Text>
                        </Pressable>)}
                </View>
                <Text style={styles.meta}>{getPracticeMode(settings.inputMode).chipLabel} → {isSelfReview ? 'Self review' : getPracticeMode(settings.outputMode).chipLabel}</Text>
            </View>
            {queue === 'new' && <AddReviewWord cards={progress.cards} items={items} reviewCardIds={settings.reviewCardIds}
                disabled={!isHydrated} onAdd={word => updateSettings(current => ({ reviewCardIds: [...new Set([...current.reviewCardIds, Number(word.id)])] }))} />}
            {round ? <View nativeID="practice-panel" role="tabpanel" aria-labelledby={`queue-${queue}`} style={styles.card} onLayout={event => { cardTop.current = event.nativeEvent.layout.y; }}>
                <View style={[styles.studyRow, isSelfReview && styles.selfStudyRow]}>
                    <View style={[styles.prompt, isSelfReview && styles.selfPrompt]}>
                        {settings.inputMode === 'audio' ? <AudioPrompt hanzi={round.question.hanzi} label="Play audio prompt" />
                            : <Text selectable testID="practice-prompt" style={[styles.hanzi, settings.inputMode !== 'hanzi' && styles.textPrompt,
                                hasRevealed && settings.inputMode === 'hanzi' && { fontSize: split ? 76 : 64, lineHeight: 104 }]}>
                                {getDisplayText(round.question, settings.inputMode)}
                            </Text>}
                        {settings.inputMode === 'eng' && detail(round.question, 'prompt')}
                        {answer && !isSelfReview && settings.inputMode === 'hanzi' && <Text style={styles.pinyin}>{round.question.pinyin}</Text>}
                        {answer && !isSelfReview && <AudioButton hanzi={round.question.hanzi} label={`Play ${round.question.hanzi} audio`} />}
                    </View>
                    {isSelfReview ? (!hasRevealed && <View style={styles.revealSelfRow}>
                        <ModernButton title="Show answer" onPress={() => setSelfAnswerVisible(true)} style={styles.showAnswer} />
                    </View>) : <View style={styles.answers}>
                        <Text style={styles.answerHeading}>{settings.outputMode === 'audio' ? 'Choose the matching audio' : 'Choose the ' + (settings.outputMode === 'eng' ? 'meaning' : getPracticeMode(settings.outputMode).label.toLowerCase())}</Text>
                        <View style={styles.grid} onLayout={event => setChoiceGridWidth(event.nativeEvent.layout.width)}>
                            {round.options.map((item, index) => {
                                const correct = Boolean(answer) && item.id === round.question.id;
                                const wrong = answer === 'wrong' && item.id === selected?.id;
                                const variant = correct ? 'success' : wrong ? 'danger' : 'secondary';
                                return <View key={item.id} testID="practice-choice" style={[styles.option, widePinyinChoices && { width: '100%' }]}>
                                    {settings.outputMode === 'audio' ? <AudioChoiceButton choiceLabel={`Audio ${String.fromCharCode(65 + index)}`} hideLabel
                                        actionLabel={correct ? 'Correct' : wrong ? 'Picked' : 'Choose'} hanzi={item.hanzi} variant={variant}
                                        disabled={Boolean(answer)} onSelect={() => submit(item)} style={{ minHeight: 94 }} />
                                        : <ModernButton title={settings.outputMode === 'pinyin' ? getDisplayText(item, 'pinyin') : getDisplayLines(item, settings.outputMode)}
                                            multiline={settings.outputMode !== 'pinyin'} wrapText={settings.outputMode !== 'pinyin'} fitText={settings.outputMode === 'pinyin'}
                                            variant={variant} disabled={Boolean(answer)} onPress={() => submit(item)}
                                            style={styles.answerButton} textStyle={[styles.answerText, settings.outputMode === 'hanzi' && { fontFamily: typography.studyFont, fontSize: 28, lineHeight: 40 }]} />}
                                    {(correct || wrong) && settings.outputMode !== 'audio' && <View pointerEvents="none" style={styles.choiceStatus}>
                                        <Ionicons name={correct ? 'checkmark-circle' : 'close-circle'} size={16} color={correct ? colors.success : colors.error} />
                                    </View>}
                                </View>;
                            })}
                        </View>
                        {!answer && <ModernButton title="I don't know" variant="secondary" onPress={() => submit(null, true)} style={styles.unknown} textStyle={{ fontSize: 15 }} />}
                    </View>}
                </View>
                {hasRevealed && <View testID="practice-feedback" style={styles.feedback} onLayout={event => {
                    if (!split && !feedbackScrolled.current) {
                        feedbackScrolled.current = true;
                        scrollRef.current?.scrollTo({ y: cardTop.current + event.nativeEvent.layout.y - 16, animated: true });
                    }
                }}>
                    {answer && <View accessibilityLiveRegion="polite" role="status" style={[styles.status, { backgroundColor: answer === 'correct' ? colors.successSoft : answer === 'wrong' ? colors.errorSoft : colors.backgroundMuted }]}>
                        <Ionicons name={answer === 'correct' ? 'checkmark-circle-outline' : answer === 'wrong' ? 'close-circle-outline' : 'eye-outline'}
                            size={22} color={answer === 'correct' ? colors.success : answer === 'wrong' ? colors.error : colors.textSecondary} />
                        <View style={{ flex: 1, gap: 4 }}>
                            <Text style={[styles.statusTitle, { color: answer === 'correct' ? colors.success : answer === 'wrong' ? colors.error : colors.text }]}>
                                {isSelfReview ? (answer === 'correct' ? 'Remembered' : 'Not remembered') : answer === 'correct' ? 'Correct' : answer === 'wrong' ? 'Not quite' : 'Answer revealed'}
                            </Text>
                            {!isSelfReview && <Text style={styles.body}>{answer === 'wrong' && selected ? `You chose “${meaning(selected)}”. Correct: ${meaning(round.question)}.` : meaning(round.question)}</Text>}
                        </View>
                    </View>}
                    <View style={styles.feedbackContent}>
                        {isSelfReview ? <View testID="self-review-answer" style={styles.selfAnswer}>{answerWord(round.question, 'correct', true)}</View>
                            : settings.inputMode !== 'hanzi' ? answerWord(round.question, 'correct', false, false) : null}
                        <ExampleSentence item={round.question} showSource={false} />
                        {answer === 'wrong' && selected && !isSelfReview && <View style={styles.selectedDetail}>
                            <Pressable accessibilityRole="button" accessibilityState={{ expanded: Boolean(details.selected) }}
                                style={styles.detailToggle} onPress={() => setDetails(value => ({ ...value, selected: !value.selected }))}>
                                <Ionicons name={details.selected ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
                                <Text style={styles.meta}>Your answer: {selected.hanzi} · {meaning(selected)}</Text>
                            </Pressable>
                            {details.selected && <View style={{ gap: 8, paddingTop: 12 }}>{answerWord(selected, 'selectedMeaning')}<ExampleSentence item={selected} /></View>}
                        </View>}
                        {isSelfReview && !answer ? <View testID="recall-rating" style={styles.recallRating}>
                            <ModernButton title="Didn't remember" variant="secondary" onPress={() => gradeRecall(false)} style={styles.recallButton} textStyle={{ color: colors.error }} />
                            <ModernButton title="Remembered" onPress={() => gradeRecall(true)} style={styles.recallButton} />
                        </View> : <View style={styles.feedbackActions}>
                            {!isSelfReview && <View style={styles.feedbackMeaning}>{detail(round.question, 'correct')}</View>}
                            <ModernButton title="Next word →" onPress={nextWord} style={styles.next} />
                        </View>}
                    </View>
                </View>}
            </View> : <View nativeID="practice-panel" role="tabpanel" aria-labelledby={`queue-${queue}`} style={[styles.card, styles.empty]}>
                <Ionicons name={queue === 'review' ? 'checkmark-circle-outline' : 'library-outline'} size={32} color={colors.primaryStrong} />
                <Text style={styles.emptyTitle}>{emptyTitle}</Text>
                {isHydrated && items.length >= minimumItems && <Text style={[styles.body, { textAlign: 'center' }]}>
                    {queue === 'review' ? `${training.scheduledCount} words scheduled for later.` : `${daily.introducedToday} of ${daily.allowance} new words introduced today.`}
                </Text>}
                {items.length < minimumItems ? <ModernButton title="Choose vocabulary" onPress={() => navigation.navigate('Settings')} />
                    : queue === 'review' && remaining > 0 ? <ModernButton title="Practice new words" onPress={() => setQueue('new')} />
                    : queue === 'new' && training.dueCount > 0 ? <ModernButton title="Review words" onPress={() => setQueue('review')} /> : null}
            </View>}
            <View style={styles.progressRow}>
                <Text style={styles.meta}>New today: {daily.introducedToday} / {daily.allowance}</Text>
                <Pressable accessibilityRole="button" onPress={() => setSnapshotVisible(true)} style={styles.detailToggle}>
                    <Text style={styles.link}>Study progress</Text><Ionicons name="arrow-forward" size={16} color={colors.primaryStrong} />
                </Pressable>
            </View>
            {hasRevealed && round && <ExampleSource item={round.question} style={styles.sourceFooter} />}
            {!daily.canIntroduce && daily.daily.extraNewWords < 1000 && training.newCount > 0 && <ModernButton title="Learn 5 more today" variant="secondary" onPress={learnMore} style={{ alignSelf: 'flex-start' }} />}
        </ScrollView>
        <Modal visible={snapshotVisible} transparent animationType="fade" onRequestClose={() => setSnapshotVisible(false)}>
            <View style={styles.modalOverlay}>
                <Pressable accessibilityLabel="Close study progress" onPress={() => setSnapshotVisible(false)} style={StyleSheet.absoluteFill} />
                <View accessibilityViewIsModal style={styles.modal}>
                    <View style={styles.pageHeader}><Text style={styles.emptyTitle}>Study progress</Text><Pressable accessibilityRole="button" accessibilityLabel="Close study progress" onPress={() => setSnapshotVisible(false)} style={{ padding: 12 }}><Ionicons name="close" size={22} color={colors.text} /></Pressable></View>
                    <ScrollView contentContainerStyle={{ gap: 20 }}>
                        <Text style={styles.body}>{training.studiedCount} / {training.totalCount} words introduced · {training.masteredCount} mastered</Text>
                        <Text style={styles.meta}>{training.dueCount} due now · {training.scheduledCount} scheduled · {training.newCount} unseen</Text>
                        <Text style={styles.answerHeading}>Review stages</Text>
                        {training.boxCounts.map((count, index) => <View key={index} style={styles.inline}>
                            <Text style={[styles.meta, { width: 62 }]}>Stage {index}</Text>
                            <View style={{ flex: 1, height: 8, backgroundColor: colors.backgroundMuted, borderRadius: 4 }}><View style={{ height: 8, borderRadius: 4, backgroundColor: colors.primary, width: `${count / Math.max(1, ...training.boxCounts) * 100}%` }} /></View>
                            <Text style={[styles.meta, { width: 36, textAlign: 'right' }]}>{count}</Text>
                        </View>)}
                        <ModernButton title="View your progress" onPress={() => { setSnapshotVisible(false); navigation.navigate('Stats'); }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    </SafeAreaView>;
};

const createStyles = (c, t, split) => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    scroll: { width: '100%', alignSelf: 'center', paddingHorizontal: split ? 24 : 18, paddingTop: split ? 42 : 16, paddingBottom: 110, gap: split ? 24 : 18 },
    mobileBrand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    title: { fontFamily: t.uiFont, fontSize: 30, lineHeight: 40, fontWeight: '600', color: c.text },
    settingsButton: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: 1, borderColor: c.border, borderRadius: 6 },
    toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
    tabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: c.border, gap: 20 },
    tab: { flexDirection: 'row', gap: 9, alignItems: 'center', minHeight: 48, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: c.primary },
    tabLabel: { fontFamily: t.uiFont, color: c.textSecondary, fontSize: 15, fontWeight: '600' },
    tabCount: { color: c.textSecondary, fontSize: 13, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: c.backgroundMuted, borderRadius: 4 },
    meta: { fontFamily: t.uiFont, fontSize: 13, color: c.textSecondary, lineHeight: 21, flexShrink: 1 },
    card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 10, overflow: 'hidden' },
    studyRow: { flexDirection: split ? 'row' : 'column' },
    selfStudyRow: { flexDirection: 'column' },
    selfPrompt: { width: '100%', minHeight: split ? 220 : 160, borderRightWidth: 0, borderBottomWidth: 0 },
    revealSelfRow: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 28 },
    showAnswer: { width: '100%', maxWidth: 320, minHeight: 48 },
    selfAnswer: { paddingBottom: 20, borderBottomWidth: 1, borderColor: c.border, marginBottom: 8 },
    recallRating: { flexDirection: split ? 'row' : 'column', gap: 12, marginTop: 16 },
    recallButton: { flex: split ? 1 : undefined, minHeight: 48 },
    prompt: { width: split ? '41%' : '100%', alignItems: 'center', justifyContent: 'center', padding: split ? 30 : 16, gap: split ? 14 : 8, minHeight: split ? 350 : 160, borderRightWidth: split ? 1 : 0, borderBottomWidth: split ? 0 : 1, borderColor: c.border },
    hanzi: { color: c.text, fontFamily: t.studyFont, fontSize: split ? 94 : 72, lineHeight: split ? 140 : 108, textAlign: 'center', fontWeight: '400', maxWidth: '100%' },
    textPrompt: { fontSize: split ? 30 : 26, lineHeight: 42 },
    pinyin: { color: c.textSecondary, fontFamily: t.studyFont, fontSize: 18, lineHeight: 28 },
    answers: { flex: 1, minWidth: 0, padding: split ? 28 : 16, gap: split ? 16 : 12 },
    answerHeading: { color: c.textSecondary, fontFamily: t.uiFont, fontSize: 14, fontWeight: '500' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    option: { width: '48%', flexGrow: 1, minWidth: 0 },
    answerButton: { minHeight: split ? 78 : 64, height: '100%', paddingHorizontal: 14, paddingVertical: 12 },
    answerText: { fontFamily: t.uiFont, fontSize: 18, lineHeight: 27, fontWeight: '400' },
    choiceStatus: { position: 'absolute', right: 6, top: 6 },
    unknown: { minHeight: 46, backgroundColor: c.backgroundMuted, borderColor: c.borderStrong },
    feedback: { borderTopWidth: 1, borderColor: c.border },
    status: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: split ? 28 : 20, paddingVertical: 18 },
    statusTitle: { fontSize: 16, fontWeight: '600', fontFamily: t.uiFont },
    feedbackContent: { paddingHorizontal: split ? 28 : 20, paddingVertical: 22, gap: 12 },
    feedbackActions: { flexDirection: split ? 'row' : 'column', alignItems: split ? 'flex-end' : 'stretch', justifyContent: 'flex-end', gap: 12, borderTopWidth: 1, borderColor: c.border, paddingTop: 12, marginTop: 4 },
    feedbackMeaning: { flex: split ? 1 : undefined, minWidth: 0 },
    sourceFooter: { alignSelf: 'flex-end', marginTop: -18 },
    body: { color: c.text, fontFamily: t.uiFont, fontSize: 16, lineHeight: 26 },
    detailToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
    link: { color: c.primaryStrong, fontFamily: t.uiFont, fontSize: 14, fontWeight: '500' },
    inline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
    answerHanzi: { fontFamily: t.studyFont, fontSize: 28, lineHeight: 40, color: c.text },
    selectedDetail: { borderTopWidth: 1, borderColor: c.border, paddingTop: 10 },
    nextRow: { alignItems: split ? 'flex-end' : 'stretch', marginTop: 8 },
    next: { minWidth: 156, minHeight: 48 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    empty: { alignItems: 'center', padding: 36, gap: 20, minHeight: 280, justifyContent: 'center' },
    emptyTitle: { fontFamily: t.uiFont, fontSize: 22, lineHeight: 32, fontWeight: '600', color: c.text },
    modalOverlay: { flex: 1, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center', padding: 20 },
    modal: { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 10, padding: 24, width: '100%', maxWidth: 560, maxHeight: '85%', gap: 22 },
});
export default PracticeScreen;
