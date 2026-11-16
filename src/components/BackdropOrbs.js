import React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
import { getResponsiveLayout, SIDEBAR_WIDTH } from '../utils/layout';

// A layered, filled Pudong panorama. Landmark proportions and negative space
// carry the detail; no window grids or architectural outlines are needed.
const BackdropOrbs = () => {
    const { colors, mode } = useAppTheme();
    const { width } = useWindowDimensions();
    const paneWidth = width - (getResponsiveLayout(width).isWebWide ? SIDEBAR_WIDTH : 0);
    // Desktop landmarks keep the same scale. Only narrow phones scale them down.
    const landmarkWidth = Math.min(900, paneWidth * 2.05);
    const neighborhood = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="76" viewBox="0 0 480 76" fill="${colors.skyline}">
      <g opacity=".32"><path d="M0 76V53H18V39H35V31H50V47H64V55H83V35H99V24H115V32H128V49H144V38H163V29H177V50H196V43H215V22H229V15H239V34H251V54H274V42H292V29H309V39H325V53H346V37H363V26H382V42H399V51H420V34H438V46H457V53H480V76Z"/></g>
      <g opacity=".6"><path d="M0 76V61H23V51H47V61H63V76ZM82 76V56H96V45H111V55H124V76ZM146 76V53H157V42H178V54H193V76ZM217 76V60H237V49H253V60H268V76ZM292 76V54H310V43H325V54H341V76ZM365 76V58H380V45H398V57H413V76ZM436 76V58H447V50H467V61H480V76Z"/></g>
      <path d="M0 65Q60 63 120 65T240 65T360 65T480 65V76H0Z"/>
    </svg>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="330" viewBox="0 0 1440 330" fill="${colors.skyline}">
      <g opacity=".32">
        <path d="M0 312V285H26V274H43V252H69V245H79V274H105V267H119V238H145V232H164V263H179V280H209V252H224V235H249V243H259V278H283V264H311V240H332V225H350V234H361V276H389V312Z"/>
        <path d="M461 312V280H483V247H498V230H526V247H537V277H563V257H585V238H603V247H616V277H637V259H664V277H688V254H707V229H724V240H736V312Z"/>
        <path d="M803 312V269H816V245H832V256H846V312ZM918 312V258H933V246H947V225H959V239H970V312Z"/>
        <path d="M1057 312V263H1081V244H1102V252H1117V280H1139V260H1159V223H1180V212H1191V258H1209V280H1233V257H1257V237H1277V249H1294V281H1323V265H1345V249H1365V276H1388V263H1416V283H1440V330H1057Z"/>
      </g>
      <g opacity=".64">
        <path d="M45 312V286H74V276H111V284H127V312ZM151 312V275H164V263H184V275H198V312ZM289 312V272H307V254H339V264H350V312Z"/>
        <path d="M491 312V270H504V257H538V270H551V312ZM575 312V247H589V232H617V247H629V312Z"/>
        <path d="M650 312V239H657V220H663V208L674 196L685 208H691V220H698V239H704V312Z"/>
        <path d="M1069 312V277H1083V259H1110V270H1121V312ZM1142 312V285H1160V273H1194V285H1207V312ZM1236 312V273H1251V261H1284V274H1297V312ZM1332 312V286H1346V270H1375V280H1390V312Z"/>
      </g>
      <g id="oriental-pearl">
        <path d="M429 97H431V136H429ZM427 136H433V176H427ZM424 197H436V247H424Z"/>
        <ellipse cx="430" cy="145" rx="4.6" ry="7"/>
        <ellipse cx="430" cy="187" rx="13" ry="13.6"/>
        <path d="M418 182Q430 175 442 182Q430 179 418 182Z" fill="${colors.background}" opacity=".25"/>
        <path d="M427 202H429V246H427ZM432 202H434V246H432Z" fill="${colors.background}" opacity=".28"/>
        <ellipse cx="430" cy="266" rx="23" ry="23.5"/>
        <path d="M408 260Q430 248 452 260Q430 254 408 260Z" fill="${colors.background}" opacity=".22"/>
        <path d="M419 282C416 292 410 301 405 309H414C418 301 423 292 425 287ZM435 287C437 292 442 301 446 309H455C450 301 444 292 441 282ZM427 288H433V310H427Z"/>
        <path d="M398 310Q402 304 413 304H447Q458 304 462 310V314H398Z"/>
      </g>
      <g id="jin-mao">
        <path d="M740 312V252H744V230H748V211H752V193H756V176H759V160H762V145H764V131H766V113H768V131H770V145H772V160H775V176H778V193H782V211H786V230H790V252H794V312Z"/>
        <path d="M768 147L772 160H775V176H778V193H782V211H786V230H790V252H794V312H768Z" fill="${colors.background}" opacity=".19"/>
      </g>
      <g id="world-financial-center">
        <path d="M847 312L859 78H883L896 312ZM864 87L878 87L877 105H865Z" fill-rule="evenodd"/>
        <path d="M877 108L883 104L894 310H877Z" fill="${colors.background}" opacity=".2"/>
      </g>
      <g id="shanghai-tower">
        <path d="M978 312C980 260 984 195 988 128C991 82 995 43 1002 26Q1009 9 1015 16C1022 27 1025 44 1027 72C1030 129 1031 244 1034 312Z"/>
        <path d="M1002 26C997 90 1017 150 1005 312H1016C1027 208 1009 72 1015 16Q1009 9 1002 26Z" fill="${colors.background}" opacity=".23"/>
      </g>
      <g opacity=".82">
        <path d="M200 313V297H223V289H242Q270 267 298 289H318V298H337V313Z"/>
        <path d="M517 313V294H543V282H565V293H588V313ZM707 313V288H727V278H744V289H759V313ZM795 313V287H808V276H826V286H841V313Z"/>
        <path d="M905 313V293H918V282H943V292H961V313ZM1041 313V290H1053V281H1074V292H1090V313Z"/>
      </g>
      <path d="M0 311C133 309 206 314 326 311C447 308 513 313 634 311C755 309 826 313 949 311C1084 309 1175 314 1300 311L1440 312V330H0Z"/>
    </svg>`;
    return <View testID="skyline-backdrop" pointerEvents="none" accessibilityElementsHidden
        style={[StyleSheet.absoluteFill, { overflow: 'hidden', opacity: mode === 'dark' ? 0.18 : 0.2 }]}>
        <View testID="skyline-neighborhood" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 76 }}>
            {Array.from({ length: Math.ceil(paneWidth / 480) }, (_, index) => <Image key={index} accessible={false}
                source={{ uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(neighborhood)}` }} resizeMode="stretch"
                style={{ position: 'absolute', bottom: 0, left: index * 480, width: 480, height: 76 }} />)}
        </View>
        <Image testID="skyline-image" accessible={false}
            source={{ uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` }} resizeMode="stretch"
            style={{ position: 'absolute', bottom: 0, left: '50%', width: landmarkWidth, height: landmarkWidth * 330 / 1440, transform: [{ translateX: -landmarkWidth / 2 }] }} />
    </View>;
};
export default BackdropOrbs;
