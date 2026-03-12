export const PRACTICE_MODES = [
    {
        id: 'hanzi',
        label: 'Characters',
        detail: '汉字',
        chipLabel: 'Hanzi',
        description: 'Train recognition with written Chinese.',
    },
    {
        id: 'pinyin',
        label: 'Pinyin',
        detail: '拼音',
        chipLabel: 'Pinyin',
        description: 'Focus on pronunciation and tones.',
    },
    {
        id: 'eng',
        label: 'English',
        detail: 'Meaning',
        chipLabel: 'English',
        description: 'Practice vocabulary recall from meaning.',
    },
];

const practiceModeMap = PRACTICE_MODES.reduce((result, mode) => {
    result[mode.id] = mode;
    return result;
}, {});

export const getPracticeMode = (modeId) => {
    return practiceModeMap[modeId] || practiceModeMap.hanzi;
};
