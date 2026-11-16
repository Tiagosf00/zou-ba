import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import PracticeScreen from './src/screens/PracticeScreen';
import ListeningScreen from './src/screens/ListeningScreen';
import BooksScreen from './src/screens/BooksScreen';
import ExamScreen from './src/screens/ExamScreen';
import RankingScreen from './src/screens/RankingScreen';
import StatsScreen from './src/screens/StatsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { AppStateProvider, useAppState } from './src/context/AppStateContext';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeProvider';
import { getResponsiveLayout } from './src/utils/layout';
import AppNavigation from './src/components/AppNavigation';

const Tab = createBottomTabNavigator();

const RootNavigator = () => {
    const { colors, mode } = useAppTheme();
    const { width } = useWindowDimensions();
    const layout = getResponsiveLayout(width);
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
                tabBar={(props) => <AppNavigation {...props} desktop={layout.isWebWide} />}
                screenOptions={{
                    headerShown: false,
                    sceneStyle: { backgroundColor: colors.background },
                    tabBarPosition: layout.isWebWide ? 'left' : 'bottom',
                    tabBarHideOnKeyboard: true,
                }}
            >
                <Tab.Screen name="Practice" component={PracticeScreen} />

                <Tab.Screen name="Listen" component={ListeningScreen} />

                <Tab.Screen name="Books" component={BooksScreen} />

                <Tab.Screen name="Exam" component={ExamScreen} />

                <Tab.Screen name="Ranking" component={RankingScreen} />

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
