import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '../theme/ThemeProvider';

const BackdropOrbs = () => {
    const { colors, mode } = useAppTheme();
    const styles = useMemo(() => createStyles(colors, mode), [colors, mode]);

    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={[styles.orb, styles.primaryOrb]} />
            <View style={[styles.orb, styles.accentOrb]} />
            <View style={styles.sealMark}>
                <View style={styles.sealInner} />
            </View>
            <View style={styles.skyline}>
                <View style={styles.horizon} />
                <View style={[styles.building, styles.buildingOne]} />
                <View style={[styles.building, styles.buildingTwo]} />
                <View style={[styles.building, styles.buildingThree]} />
                <View style={[styles.building, styles.buildingFour]} />
                <View style={styles.pearlStem} />
                <View style={[styles.pearlSphere, styles.pearlSphereLarge]} />
                <View style={[styles.pearlSphere, styles.pearlSphereSmall]} />
                <View style={styles.pearlTip} />
                <View style={styles.modernTowerCluster}>
                    <View style={styles.financialTower}>
                        <View style={styles.financialTowerSpire} />
                    </View>
                    <View style={styles.shanghaiTower}>
                        <View style={styles.shanghaiTowerRidge} />
                        <View style={styles.shanghaiTowerSpire} />
                    </View>
                </View>
            </View>
        </View>
    );
};

const createStyles = (colors, mode) => {
    const skylineFill = mode === 'dark' ? colors.surfaceMuted : colors.primarySoft;
    const skylineAccent = colors.primaryStrong;

    return StyleSheet.create({
        orb: {
            position: 'absolute',
            borderRadius: 999,
        },
        primaryOrb: {
            width: 220,
            height: 220,
            top: -80,
            right: -40,
            backgroundColor: colors.primarySoft,
            opacity: mode === 'dark' ? 0.42 : 0.65,
        },
        accentOrb: {
            width: 180,
            height: 180,
            top: 120,
            left: -70,
            backgroundColor: colors.accentSoft,
            opacity: mode === 'dark' ? 0.5 : 0.7,
        },
        sealMark: {
            position: 'absolute',
            top: 92,
            right: 26,
            width: 58,
            height: 58,
            borderWidth: 1.5,
            borderColor: skylineAccent,
            opacity: mode === 'dark' ? 0.16 : 0.12,
            transform: [{ rotate: '10deg' }],
        },
        sealInner: {
            position: 'absolute',
            top: 10,
            left: 10,
            right: 10,
            bottom: 10,
            borderWidth: 1,
            borderColor: skylineAccent,
        },
        skyline: {
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: 12,
            height: 92,
            opacity: mode === 'dark' ? 0.18 : 0.14,
        },
        horizon: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 12,
            borderRadius: 999,
            backgroundColor: skylineFill,
        },
        building: {
            position: 'absolute',
            bottom: 12,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            backgroundColor: skylineFill,
        },
        buildingOne: {
            left: 12,
            width: 30,
            height: 34,
        },
        buildingTwo: {
            left: 48,
            width: 22,
            height: 52,
        },
        buildingThree: {
            right: 74,
            width: 34,
            height: 42,
        },
        buildingFour: {
            right: 28,
            width: 24,
            height: 30,
        },
        pearlStem: {
            position: 'absolute',
            left: 92,
            bottom: 12,
            width: 10,
            height: 58,
            borderRadius: 999,
            backgroundColor: skylineAccent,
        },
        pearlSphere: {
            position: 'absolute',
            left: 85,
            borderRadius: 999,
            backgroundColor: skylineAccent,
        },
        pearlSphereLarge: {
            bottom: 28,
            width: 24,
            height: 24,
        },
        pearlSphereSmall: {
            bottom: 56,
            left: 89,
            width: 16,
            height: 16,
        },
        pearlTip: {
            position: 'absolute',
            left: 95,
            bottom: 72,
            width: 4,
            height: 18,
            borderRadius: 999,
            backgroundColor: skylineAccent,
        },
        modernTowerCluster: {
            position: 'absolute',
            left: 126,
            bottom: 12,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
        },
        financialTower: {
            width: 18,
            height: 62,
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
            backgroundColor: skylineAccent,
            transform: [{ skewX: '-2deg' }],
        },
        financialTowerSpire: {
            position: 'absolute',
            top: -10,
            left: 7,
            width: 3,
            height: 12,
            borderRadius: 999,
            backgroundColor: skylineAccent,
        },
        shanghaiTower: {
            width: 22,
            height: 78,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 7,
            backgroundColor: skylineAccent,
            overflow: 'hidden',
            transform: [{ skewX: '-7deg' }],
        },
        shanghaiTowerRidge: {
            position: 'absolute',
            top: 10,
            right: 4,
            width: 6,
            height: 54,
            borderRadius: 999,
            backgroundColor: skylineFill,
            opacity: mode === 'dark' ? 0.52 : 0.42,
        },
        shanghaiTowerSpire: {
            position: 'absolute',
            top: -12,
            right: 5,
            width: 3,
            height: 14,
            borderRadius: 999,
            backgroundColor: skylineAccent,
        },
    });
};

export default BackdropOrbs;
