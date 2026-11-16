import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/ThemeProvider';
import { useAppState } from '../context/AppStateContext';
import { SIDEBAR_WIDTH } from '../utils/layout';

const icons = { Practice: 'flash-outline', Listen: 'headset-outline', Books: 'library-outline', Exam: 'school-outline', Ranking: 'trophy-outline', Stats: 'stats-chart-outline', Settings: 'options-outline' };
const labels = { Stats: 'Progress' };
const primaryRoutes = ['Practice', 'Listen', 'Books', 'Stats'];

export const Brand = () => {
    const { colors, typography } = useAppTheme();
    return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ backgroundColor: colors.primary, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 4, transform: [{ rotate: '-2deg' }] }}>
            <Text style={{ color: colors.onPrimary, fontFamily: typography.studyFont, fontSize: 14, lineHeight: 17 }}>{'走\n吧'}</Text>
        </View>
        <Text style={{ fontFamily: typography.brandFont, fontSize: 27, fontWeight: '600', color: colors.text }}>Zou Ba</Text>
    </View>;
};

export const ThemeButton = () => {
    const { colors, mode } = useAppTheme();
    const { updateSettings } = useAppState();
    return <Pressable accessibilityRole="button" accessibilityLabel={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
        onPress={() => updateSettings({ themeMode: mode === 'dark' ? 'light' : 'dark' })}
        style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: pressed ? colors.backgroundMuted : 'transparent' })}>
        <Ionicons name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.textSecondary} />
    </Pressable>;
};

export default function AppNavigation({ state, navigation, desktop }) {
    const { colors, typography } = useAppTheme();
    const insets = useSafeAreaInsets();
    const [more, setMore] = useState(false);
    const focused = state.routes[state.index].name;
    const select = (route) => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!event.defaultPrevented) navigation.navigate(route.name);
        setMore(false);
    };
    const item = (route, vertical = false) => {
        const active = route.name === focused;
        return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={labels[route.name] || route.name}
            accessibilityState={{ selected: active }} onPress={() => select(route)}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={({ hovered, pressed }) => [styles.item, vertical ? styles.verticalItem : styles.mobileItem,
                { backgroundColor: active ? colors.primarySoft : hovered || pressed ? colors.backgroundMuted : 'transparent' }]}>
            <Ionicons name={icons[route.name]} size={20} color={active ? colors.primaryStrong : colors.textMuted} />
            <Text style={{ color: active ? colors.primaryStrong : colors.textSecondary, fontFamily: typography.uiFont, fontWeight: active ? '600' : '400', fontSize: vertical ? 15 : 11 }}>{labels[route.name] || route.name}</Text>
        </Pressable>;
    };
    if (desktop) return <View style={[styles.sidebar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 42 }}><Brand /></View>
        <View accessibilityRole="tablist" style={{ gap: 5 }}>
            {primaryRoutes.map(name => item(state.routes.find(route => route.name === name), true))}
            <View style={{ height: 1, backgroundColor: colors.border, margin: 14 }} />
            {state.routes.filter(route => !primaryRoutes.includes(route.name)).map(route => item(route, true))}
        </View>
        <View style={{ marginTop: 'auto', padding: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Appearance</Text><ThemeButton />
        </View>
    </View>;
    return <>
        <View accessibilityRole="tablist" style={[styles.bottom, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
            {primaryRoutes.map(name => item(state.routes.find(route => route.name === name)))}
            <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={() => setMore(true)} style={styles.mobileItem}>
                <Ionicons name="ellipsis-horizontal" size={20} color={!primaryRoutes.includes(focused) ? colors.primaryStrong : colors.textMuted} />
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>More</Text>
            </Pressable>
        </View>
        <Modal visible={more} transparent animationType="fade" onRequestClose={() => setMore(false)}>
            <Pressable accessibilityLabel="Close menu" onPress={() => setMore(false)} style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} />
            <View accessibilityViewIsModal style={[styles.more, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 20) }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 18 }}><Brand /><ThemeButton /></View>
                {state.routes.filter(route => !primaryRoutes.includes(route.name)).map(route => item(route, true))}
                <Pressable accessibilityRole="button" onPress={() => setMore(false)} style={styles.verticalItem}><Text style={{ color: colors.textSecondary }}>Close</Text></Pressable>
            </View>
        </Modal>
    </>;
}
const styles = StyleSheet.create({
    sidebar: { width: SIDEBAR_WIDTH, padding: 16, paddingTop: 36, borderRightWidth: 1 },
    item: { borderRadius: 6, gap: 12 },
    verticalItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 46 },
    mobileItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 50, borderRadius: 6 },
    bottom: { flexDirection: 'row', paddingHorizontal: 8, paddingTop: 7, borderTopWidth: 1 },
    more: { position: 'absolute', left: 12, right: 12, bottom: 12, borderWidth: 1, borderRadius: 12, padding: 20, gap: 5 },
});
