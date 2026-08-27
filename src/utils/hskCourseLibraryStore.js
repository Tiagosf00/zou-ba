import AsyncStorage from '@react-native-async-storage/async-storage';

import courseCatalog from '../../assets/hsk_standard_course_audio.json';


const LIBRARY_STORAGE_KEY = 'zou-ba:hsk-course-library:v1';
const DEFAULT_BOOK_ID = 'hsk1';
const validBookIds = new Set(courseCatalog.books.map((book) => book.bookId));
const validResourceIds = new Set(
    courseCatalog.books.flatMap((book) =>
        book.tracks.map((track) => track.resourceId),
    ),
);

export const createHskCourseLibraryState = () => ({
    version: 1,
    lastBookId: DEFAULT_BOOK_ID,
    transcripts: {},
});

export const normalizeHskCourseLibraryState = (value) => {
    const transcripts = {};

    if (value?.transcripts && typeof value.transcripts === 'object') {
        Object.entries(value.transcripts).forEach(([resourceId, transcript]) => {
            if (validResourceIds.has(resourceId) && typeof transcript === 'string' && transcript) {
                transcripts[resourceId] = transcript;
            }
        });
    }

    return {
        version: 1,
        lastBookId: validBookIds.has(value?.lastBookId)
            ? value.lastBookId
            : DEFAULT_BOOK_ID,
        transcripts,
    };
};

export const loadHskCourseLibraryState = async () => {
    try {
        const storedValue = await AsyncStorage.getItem(LIBRARY_STORAGE_KEY);
        return normalizeHskCourseLibraryState(
            storedValue ? JSON.parse(storedValue) : null,
        );
    } catch {
        return createHskCourseLibraryState();
    }
};

export const saveHskCourseLibraryState = async (value) => {
    const normalizedValue = normalizeHskCourseLibraryState(value);
    await AsyncStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(normalizedValue));
    return normalizedValue;
};
