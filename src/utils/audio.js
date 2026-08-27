import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

import hskAudioAssets from '../data/hskAudioAssets';

const AUDIO_PATH_PREFIX = 'assets/audio/hsk';

let activeAudio = null;

export const claimWebAudio = (audio) => {
    if (!audio || Platform.OS !== 'web') {
        return null;
    }

    if (activeAudio && activeAudio !== audio) {
        activeAudio.pause();
    }

    activeAudio = audio;
    return activeAudio;
};

export const releaseWebAudio = (audio) => {
    if (activeAudio === audio) {
        activeAudio = null;
    }
};

export const stopWebAudio = (audio = activeAudio, { reset = false } = {}) => {
    if (!audio) {
        return;
    }

    audio.pause();
    if (reset) {
        audio.currentTime = 0;
    }
    releaseWebAudio(audio);
};

const getBundledAssetUri = (bundledAsset) => {
    if (!bundledAsset) {
        return null;
    }

    if (typeof bundledAsset === 'string') {
        return bundledAsset;
    }

    if (typeof bundledAsset === 'object' && typeof bundledAsset.uri === 'string') {
        return bundledAsset.uri;
    }

    try {
        return Asset.fromModule(bundledAsset).uri;
    } catch {
        return null;
    }
};

const getStaticBaseUrl = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
        return '';
    }

    const scripts = Array.from(window.document?.scripts || []);
    const expoScript = scripts.find((script) => script.src?.includes('/_expo/'));

    if (expoScript?.src) {
        return expoScript.src.slice(0, expoScript.src.indexOf('/_expo/') + 1);
    }

    const bundleScript = scripts.find((script) => script.src?.includes('/index.bundle'));

    if (bundleScript?.src) {
        return new URL('/', bundleScript.src).href;
    }

    return new URL('/', window.location.href).href;
};

export const getHskAudioUrl = (hanzi) => {
    if (!hanzi) {
        return null;
    }

    const bundledUri = getBundledAssetUri(hskAudioAssets[hanzi]);

    if (bundledUri) {
        return bundledUri;
    }

    const encodedFileName = encodeURIComponent(`cmn-${hanzi}.mp3`);
    return `${getStaticBaseUrl()}${AUDIO_PATH_PREFIX}/${encodedFileName}`;
};

export const playHskAudio = async (hanzi) => {
    const audioUrl = getHskAudioUrl(hanzi);

    if (!audioUrl || Platform.OS !== 'web' || typeof window === 'undefined' || !window.Audio) {
        return null;
    }

    const audio = new window.Audio(audioUrl);
    audio.preload = 'auto';
    claimWebAudio(audio);

    await audio.play();
    return audio;
};
