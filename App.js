import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import PracticeScreen from './src/screens/PracticeScreen';
import StatsScreen from './src/screens/StatsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { AppStateProvider, useAppState } from './src/context/AppStateContext';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeProvider';
import { getFloatingTabMetrics, getResponsiveLayout } from './src/utils/layout';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
    Practice: {
        active: 'flash',
        inactive: 'flash-outline',
    },
    Stats: {
        active: 'stats-chart',
        inactive: 'stats-chart-outline',
    },
    Settings: {
        active: 'options',
        inactive: 'options-outline',
    },
};

const RootNavigator = () => {
    const { colors, shadows, typography, mode } = useAppTheme();
    const { width } = useWindowDimensions();
    const layout = getResponsiveLayout(width);
    const tabMetrics = getFloatingTabMetrics(width);
    const styles = useMemo(
        () => createStyles(colors, shadows, typography, layout, tabMetrics),
        [colors, shadows, typography, layout, tabMetrics],
    );
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
                <Tab.Screen name="Practice" component={PracticeScreen} />

                <Tab.Screen name="Stats" component={StatsScreen} />

                <Tab.Screen name="Settings" component={SettingsScreen} />
            </Tab.Navigator>
        </NavigationContainer>
    );
};

const AppShell = () => {
    const { settings } = useAppState();

    return (
        <ThemeProvider mode={settings.themeMode}>
            <RootNavigator />
        </ThemeProvider>
    );
};

export default function App() {
    return (
        <SafeAreaProvider>
            <AppStateProvider>
                <AppShell />
            </AppStateProvider>
        </SafeAreaProvider>
    );
}

const createStyles = (colors, shadows, typography, layout, tabMetrics) =>
    StyleSheet.create({
        scene: {
            backgroundColor: colors.background,
        },
        tabBar: {
            height: layout.isWebDesktop ? 78 : 74,
            width: layout.isWebDesktop ? tabMetrics.tabBarWidth : undefined,
            left: layout.isWebDesktop ? tabMetrics.tabBarLeft : undefined,
            bottom: layout.isWebDesktop ? 24 : undefined,
            position: layout.isWebDesktop ? 'absolute' : 'relative',
            paddingTop: layout.isWebDesktop ? 10 : 8,
            paddingBottom: layout.isWebDesktop ? 10 : 10,
            paddingHorizontal: layout.isWebDesktop ? 12 : 0,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderWidth: layout.isWebDesktop ? 1 : 0,
            borderColor: colors.border,
            borderTopColor: colors.border,
            borderRadius: layout.isWebDesktop ? 28 : 0,
            ...shadows[layout.isWebDesktop ? 'md' : 'sm'],
        },
        tabBarItem: {
            gap: layout.isWebDesktop ? 4 : 2,
            borderRadius: 18,
            marginHorizontal: layout.isWebDesktop ? 6 : 0,
        },
        tabBarLabel: {
            fontSize: layout.isWebDesktop ? 13 : 12,
            fontWeight: '700',
            fontFamily: typography.headingFont,
        },
    });
