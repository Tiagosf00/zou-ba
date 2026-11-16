import React from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Card from './Card';
import { useAppTheme } from '../theme/ThemeProvider';
import { useAppState } from '../context/AppStateContext';
import { getDailyStudySnapshot, getStudyDay, MAX_BOX } from '../utils/practice';

export default function ProgressOverview({ stats, progress }) {
    const { colors: c, typography: t } = useAppTheme();
    const { settings } = useAppState();
    const { width } = useWindowDimensions();
    const wide = width >= 1120;
    const body = { fontFamily: t.uiFont, color: c.textSecondary, fontSize: 14, lineHeight: 22 };
    const heading = { fontFamily: t.uiFont, color: c.text, fontSize: 17, fontWeight: '600' };
    const attempts = stats.totalCorrectCount + stats.totalWrongCount + stats.totalUnknownCount;
    const daily = getDailyStudySnapshot(progress.cards, settings, progress.dailyStudy);
    const today = getStudyDay(new Date(), settings.studyTimeZone);
    const days = Array.from({ length: 7 }, (_, index) => {
        const at = new Date(`${today}T12:00:00Z`);
        at.setUTCDate(at.getUTCDate() + index);
        return { key: at.toISOString().slice(0, 10), label: index === 0 ? 'Today' : at.toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' }), count: 0 };
    });
    const stages = [
        { label: 'Learning', count: 0, color: c.primary },
        { label: 'Reviewing', count: 0, color: c.accent },
        { label: 'Mastered', count: 0, color: c.success },
    ];
    Object.values(progress.cards).forEach(entry => {
        const day = entry.nextReviewAt && getStudyDay(entry.nextReviewAt, settings.studyTimeZone);
        const bucket = days.find(value => day && (value.key === day || value.key === today && day < today));
        if (bucket) bucket.count++;
        stages[entry.box === MAX_BOX && entry.lastResult === 'correct' ? 2 : entry.box >= 3 ? 1 : 0].count++;
    });
    days[0].count += settings.reviewCardIds.filter(id => !progress.cards[id]).length;
    const max = Math.max(1, ...days.map(day => day.count));
    return <View style={{ gap: 20 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {[
                ['Words introduced', stats.studiedCount.toLocaleString()],
                ['Accuracy', attempts ? `${Math.round(stats.totalCorrectCount / attempts * 100)}%` : '—'],
                ['New today', `${daily.introducedToday} / ${daily.allowance}`],
            ].map(([label, value]) => <Card key={label} style={{ flex: 1, minWidth: width < 500 ? 135 : 180, gap: 12, padding: 22 }}>
                <Text style={body}>{label}</Text><Text style={{ ...heading, fontSize: 32, fontWeight: '500' }}>{value}</Text>
            </Card>)}
        </View>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
            <Card style={{ flex: wide ? 1.3 : undefined, gap: 20 }}>
                <Text style={heading}>Upcoming reviews</Text>
                <View accessibilityLabel={days.map(day => `${day.label}: ${day.count} reviews`).join(', ')} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                    {days.map(day => <View key={day.key} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                        <Text style={{ ...body, fontSize: 13 }}>{day.count}</Text>
                        <View style={{ height: 100, width: '100%', justifyContent: 'flex-end' }}>
                            <View style={{ height: Math.max(2, day.count / max * 100), borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: day.key === today ? c.primary : c.borderStrong }} />
                        </View><Text style={{ ...body, fontSize: 12 }}>{day.label}</Text>
                    </View>)}
                </View>
                <Text style={{ ...body, fontSize: 12 }}>Today includes overdue words. Dates follow your study time zone.</Text>
            </Card>
            <Card style={{ flex: wide ? 1 : undefined, gap: 20 }}>
                <Text style={heading}>Your vocabulary</Text>
                {stages.map(stage => <View key={stage.label} style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={body}>{stage.label}</Text><Text style={{ ...body, color: c.text }}>{stage.count}</Text></View>
                    <View style={{ height: 5, borderRadius: 4, backgroundColor: c.backgroundMuted }}><View style={{ width: `${stage.count / Math.max(1, stats.studiedCount) * 100}%`, height: 5, borderRadius: 4, backgroundColor: stage.color }} /></View>
                </View>)}
            </Card>
        </View>
        <Text style={body}>{stats.totalCorrectCount} correct · {stats.totalWrongCount} incorrect · {stats.totalUnknownCount} revealed</Text>
    </View>;
}
