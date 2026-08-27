import { getStaticBaseUrl } from './audio';

const DATASET_RESOLVE_URL =
    'https://huggingface.co/datasets/no7z/hsk-sentences-audio/resolve/main/';
const LOCAL_AUDIO_PATH = 'audio/hsk-sentences';
const SAFE_AUDIO_PATH = /^audio\/hsk[1-6]-\d{4}(?:_slow)?\.mp3$/;

const IGNORED_CHARACTERS =
    /[\s\u3000,，.。!！?？、;；:：'"“”‘’…—\-()（）\[\]【】《》〈〉]/g;

export const normalizeChineseAnswer = (value) =>
    String(value || '')
        .normalize('NFKC')
        .replace(IGNORED_CHARACTERS, '')
        .trim();

export const isListeningAnswerCorrect = (answer, sentence) => {
    const normalizedAnswer = normalizeChineseAnswer(answer);
    if (!normalizedAnswer || !sentence) {
        return false;
    }

    const acceptedAnswers = [sentence.chinese, sentence.traditional]
        .map(normalizeChineseAnswer)
        .filter(Boolean);

    return acceptedAnswers.includes(normalizedAnswer);
};

export const getListeningAudioUrls = (audioPath) => {
    if (!SAFE_AUDIO_PATH.test(audioPath || '')) {
        return [];
    }

    return [
        `${getStaticBaseUrl()}${LOCAL_AUDIO_PATH}/${audioPath}`,
        `${DATASET_RESOLVE_URL}${audioPath}`,
    ];
};

export const getListeningAudioUrl = (audioPath) => getListeningAudioUrls(audioPath)[0] || null;

export const pickNextListeningSentence = (sentences, recentIds = [], random = Math.random) => {
    if (!Array.isArray(sentences) || sentences.length === 0) {
        return null;
    }

    const recentIdSet = new Set(recentIds);
    const candidates = sentences.filter((sentence) => !recentIdSet.has(sentence.id));
    const pool = candidates.length > 0 ? candidates : sentences;
    const index = Math.min(Math.floor(random() * pool.length), pool.length - 1);

    return pool[Math.max(0, index)];
};
