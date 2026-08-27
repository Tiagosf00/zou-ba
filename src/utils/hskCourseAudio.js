import { Platform } from 'react-native';


const BLCUP_BASE_URL = 'https://www.blcup.com';
const resolvedAudioUrls = new Map();

export const getHskCourseResourceUrl = (resourceId) =>
    `${BLCUP_BASE_URL}/MobileResource?rid=${encodeURIComponent(resourceId)}`;

export const getHskCourseViewUrl = (resourceId) =>
    `${BLCUP_BASE_URL}/MobileResource/ViewRes?rid=${encodeURIComponent(resourceId)}`;

const parseAudioSource = (html) => {
    if (typeof window === 'undefined' || !window.DOMParser) {
        return null;
    }

    const document = new window.DOMParser().parseFromString(html, 'text/html');
    return document.querySelector('audio[src]')?.getAttribute('src') || null;
};

export const resolveHskCourseAudioUrl = async (resourceId) => {
    if (!resourceId || Platform.OS !== 'web' || typeof window === 'undefined') {
        throw new Error('Textbook audio is only available in the web app.');
    }

    if (resolvedAudioUrls.has(resourceId)) {
        return resolvedAudioUrls.get(resourceId);
    }

    const resolution = (async () => {
        const viewUrl = getHskCourseViewUrl(resourceId);
        const response = await window.fetch(viewUrl, {
            headers: {
                Accept: 'text/html',
            },
        });

        if (!response.ok) {
            throw new Error(`BLCUP returned ${response.status}.`);
        }

        const audioSource = parseAudioSource(await response.text());
        if (!audioSource) {
            throw new Error('BLCUP did not provide an audio source for this track.');
        }

        const audioUrl = new URL(audioSource, BLCUP_BASE_URL);
        const isBlcupHost = audioUrl.hostname === 'blcup.com'
            || audioUrl.hostname.endsWith('.blcup.com');
        if (audioUrl.protocol !== 'https:' || !isBlcupHost) {
            throw new Error('BLCUP returned an unexpected audio URL.');
        }

        return audioUrl.href;
    })();

    resolvedAudioUrls.set(resourceId, resolution);

    try {
        const audioUrl = await resolution;
        resolvedAudioUrls.set(resourceId, Promise.resolve(audioUrl));
        return audioUrl;
    } catch (error) {
        resolvedAudioUrls.delete(resourceId);
        throw error;
    }
};
