import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import PracticeScreen from './src/screens/PracticeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PinyinChartScreen from './src/screens/PinyinChartScreen';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeProvider';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
    Practice: {
        active: 'flash',
        inactive: 'flash-outline',
    },
    'Pinyin Chart': {
        active: 'grid',
        inactive: 'grid-outline',
    },
    Settings: {
        active: 'options',
        inactive: 'options-outline',
    },
};

const RootNavigator = ({ settings, updateSettings }) => {
    const { colors, shadows, typography, mode } = useAppTheme();
    const styles = useMemo(() => createStyles(colors, shadows, typography), [colors, shadows, typography]);
    const navigationTheme = useMemo(
        () => ({
            ...DefaultTheme,
            dark: mode === 'dark',
            colors: {
                ...DefaultTheme.colors,
                background: colors.background,
                card: colors.surface,
                primary: colors.primaryStrong,
                text: colors.text,
                border: colors.border,
                notification: colors.accent,
            },
        }),
        [colors, mode],
    );

    return (
        <NavigationContainer theme={navigationTheme}>
            <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
            <Tab.Navigator
                screenOptions={({ route }) => {
                    const iconSet = TAB_ICONS[route.name];

                    return {
                        headerShown: false,
                        sceneStyle: styles.scene,
                        tabBarHideOnKeyboard: true,
                        tabBarActiveTintColor: colors.primaryStrong,
                        tabBarInactiveTintColor: colors.textMuted,
                        tabBarStyle: styles.tabBar,
                        tabBarItemStyle: styles.tabBarItem,
                        tabBarLabelStyle: styles.tabBarLabel,
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons
                                color={color}
                                name={focused ? iconSet.active : iconSet.inactive}
                                size={size}
                            />
                        ),
                    };
                }}
            >
                <Tab.Screen name="Practice">
                    {(props) => <PracticeScreen {...props} settings={settings} />}
                </Tab.Screen>

                <Tab.Screen name="Pinyin Chart" component={PinyinChartScreen} />

                <Tab.Screen name="Settings">
                    {(props) => (
                        <SettingsScreen
                            {...props}
                            settings={settings}
                            updateSettings={updateSettings}
                        />
                    )}
                </Tab.Screen>
            </Tab.Navigator>
        </NavigationContainer>
    );
};

export default function App() {
    const [settings, setSettings] = useState({
        hskLevels: [1],
        inputMode: 'pinyin',
        outputMode: 'hanzi',
        themeMode: 'light',
    });

    const updateSettings = (newSettings) => {
        setSettings((current) => ({ ...current, ...newSettings }));
    };

    return (
        <SafeAreaProvider>
            <ThemeProvider mode={settings.themeMode}>
                <RootNavigator settings={settings} updateSettings={updateSettings} />
            </ThemeProvider>
        </SafeAreaProvider>
    );
}

const createStyles = (colors, shadows, typography) =>
    StyleSheet.create({
        scene: {
            backgroundColor: colors.background,
        },
        tabBar: {
            height: 74,
            paddingTop: 8,
            paddingBottom: 10,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            ...shadows.sm,
        },
        tabBarItem: {
            gap: 2,
        },
        tabBarLabel: {
            fontSize: 12,
            fontWeight: '700',
            fontFamily: typography.headingFont,
        },
    });
