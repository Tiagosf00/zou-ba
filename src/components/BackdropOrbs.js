import React, { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { useAppTheme } from '../theme/ThemeProvider';
import { getResponsiveLayout } from '../utils/layout';

const BackdropOrbs = () => {
    const { width } = useWindowDimensions();
    const { backgroundScale, isWebWide } = getResponsiveLayout(width);
    const { colors, mode } = useAppTheme();
    const styles = useMemo(
        () => createStyles(colors, mode, { backgroundScale, isWebWide }),
        [backgroundScale, colors, isWebWide, mode],
    );

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

const createStyles = (colors, mode, layout) => {
    const skylineFill = mode === 'dark' ? colors.surfaceMuted : colors.primarySoft;
    const skylineAccent = colors.primaryStrong;
    const scale = (value) => (layout.isWebWide ? Math.round(value * layout.backgroundScale) : value);

    return StyleSheet.create({
        orb: {
            position: 'absolute',
            borderRadius: 999,
        },
        primaryOrb: {
            width: scale(220),
            height: scale(220),
            top: -scale(80),
            right: -scale(40),
            backgroundColor: colors.primarySoft,
            opacity: mode === 'dark' ? 0.42 : 0.65,
        },
        accentOrb: {
            width: scale(180),
            height: scale(180),
            top: scale(120),
            left: -scale(70),
            backgroundColor: colors.accentSoft,
            opacity: mode === 'dark' ? 0.5 : 0.7,
        },
        sealMark: {
            position: 'absolute',
            top: scale(92),
            right: scale(26),
            width: scale(58),
            height: scale(58),
            borderWidth: 1.5,
            borderColor: skylineAccent,
            opacity: mode === 'dark' ? 0.16 : 0.12,
            transform: [{ rotate: '10deg' }],
        },
        sealInner: {
            position: 'absolute',
            top: scale(10),
            left: scale(10),
            right: scale(10),
            bottom: scale(10),
            borderWidth: 1,
            borderColor: skylineAccent,
        },
        skyline: {
            position: 'absolute',
            left: scale(14),
            right: scale(14),
            bottom: scale(12),
            height: scale(92),
            opacity: mode === 'dark' ? 0.18 : 0.14,
        },
        horizon: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: scale(12),
            borderRadius: 999,
            backgroundColor: skylineFill,
        },
        building: {
            position: 'absolute',
            bottom: scale(12),
            borderTopLeftRadius: scale(8),
            borderTopRightRadius: scale(8),
            backgroundColor: skylineFill,
        },
        buildingOne: {
            left: scale(12),
            width: scale(30),
            height: scale(34),
        },
        buildingTwo: {
            left: scale(48),
            width: scale(22),
            height: scale(52),
        },
        buildingThree: {
            right: scale(74),
            width: scale(34),
            height: scale(42),
        },
        buildingFour: {
            right: scale(28),
            width: scale(24),
            height: scale(30),
        },
        pearlStem: {
            position: 'absolute',
            left: scale(92),
            bottom: scale(12),
            width: scale(10),
            height: scale(58),
            borderRadius: 999,
            backgroundColor: skylineAccent,
        },
        pearlSphere: {
            position: 'absolute',
            left: scale(85),
            borderRadius: 999,
            backgroundColor: skylineAccent,
        },
        pearlSphereLarge: {
            bottom: scale(28),
            width: scale(24),
            height: scale(24),
        },
        pearlSphereSmall: {
            bottom: scale(56),
            left: scale(89),
            width: scale(16),
            height: scale(16),
        },
        pearlTip: {
            position: 'absolute',
            left: scale(95),
            bottom: scale(72),
            width: scale(4),
            height: scale(18),
            borderRadius: 999,
            backgroundColor: skylineAccent,
        },
        modernTowerCluster: {
            position: 'absolute',
            left: scale(126),
            bottom: scale(12),
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: scale(10),
        },
        financialTower: {
            width: scale(18),
            height: scale(62),
            borderTopLeftRadius: scale(6),
            borderTopRightRadius: scale(6),
            backgroundColor: skylineAccent,
            transform: [{ skewX: '-2deg' }],
        },
        financialTowerSpire: {
            position: 'absolute',
            top: -scale(10),
            left: scale(7),
            width: scale(3),
            height: scale(12),
            borderRadius: 999,
            backgroundColor: skylineAccent,
        },
        shanghaiTower: {
            width: scale(22),
            height: scale(78),
            borderTopLeftRadius: scale(12),
            borderTopRightRadius: scale(7),
            backgroundColor: skylineAccent,
            overflow: 'hidden',
            transform: [{ skewX: '-7deg' }],
        },
        shanghaiTowerRidge: {
            position: 'absolute',
            top: scale(10),
            right: scale(4),
            width: scale(6),
            height: scale(54),
            borderRadius: 999,
            backgroundColor: skylineFill,
            opacity: mode === 'dark' ? 0.52 : 0.42,
        },
        shanghaiTowerSpire: {
            position: 'absolute',
            top: -scale(12),
            right: scale(5),
            width: scale(3),
            height: scale(14),
            borderRadius: 999,
            backgroundColor: skylineAccent,
        },
    });
};

export default BackdropOrbs;
