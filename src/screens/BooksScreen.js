import React, {
    createElement,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import courseCatalog from '../../assets/hsk_standard_course_audio.json';
import BackdropOrbs from '../components/BackdropOrbs';
import Card from '../components/Card';
import { useAppTheme } from '../theme/ThemeProvider';
import { claimWebAudio, stopWebAudio } from '../utils/audio';
import {
    getHskCourseResourceUrl,
    resolveHskCourseAudioUrl,
} from '../utils/hskCourseAudio';
import {
    createHskCourseLibraryState,
    loadHskCourseLibraryState,
    saveHskCourseLibraryState,
} from '../utils/hskCourseLibraryStore';
import { getResponsiveLayout } from '../utils/layout';


const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5];

const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return '0:00';
    }

    const roundedSeconds = Math.floor(seconds);
    const minutes = Math.floor(roundedSeconds / 60);
    return `${minutes}:${String(roundedSeconds % 60).padStart(2, '0')}`;
};

const getTrackLabel = (track) => (track.code ? `Track ${track.code}` : track.title);

const buildLessonGroups = (tracks) => {
    const groups = [];

    tracks.forEach((track) => {
        const baseKey = track.lessonNumber === null ? 'extra' : `lesson-${track.lessonNumber}`;
        const lastGroup = groups[groups.length - 1];

        if (!lastGroup || lastGroup.baseKey !== baseKey) {
            groups.push({
                baseKey,
                key: `${baseKey}-${groups.length}`,
                lessonNumber: track.lessonNumber,
                tracks: [track],
            });
        } else {
            lastGroup.tracks.push(track);
        }
    });

    return groups;
};

const copyText = async (value) => {
    if (window.navigator?.clipboard?.writeText) {
        await window.navigator.clipboard.writeText(value);
        return;
    }

    const textarea = window.document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    window.document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = window.document.execCommand('copy');
    window.document.body.removeChild(textarea);

    if (!copied) {
        throw new Error('Copy failed.');
    }
};

const WebRangeInput = ({ colors, disabled, maximumValue, onChange, value }) =>
    createElement('input', {
        'aria-label': 'Audio position',
        disabled,
        max: Math.max(maximumValue || 0, 0),
        min: 0,
        onChange: (event) => onChange(Number(event.target.value)),
        onInput: (event) => onChange(Number(event.target.value)),
        step: 0.1,
        style: {
            accentColor: colors.primaryStrong,
            cursor: disabled ? 'default' : 'pointer',
            height: 28,
            margin: 0,
            opacity: disabled ? 0.45 : 1,
            width: '100%',
        },
        type: 'range',
        value: Math.min(value || 0, maximumValue || 0),
    });

const useCourseAudioPlayer = (book) => {
    const audioRef = useRef(null);
    const cleanupAudioRef = useRef(null);
    const requestIdRef = useRef(0);
    const [selectedTrack, setSelectedTrack] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [repeatOne, setRepeatOne] = useState(false);
    const [error, setError] = useState(null);

    const disposeAudio = useCallback(({ reset = false } = {}) => {
        cleanupAudioRef.current?.();
        cleanupAudioRef.current = null;

        if (audioRef.current) {
            stopWebAudio(audioRef.current, { reset });
            audioRef.current = null;
        }
    }, []);

    const attachAudioEvents = useCallback((audio) => {
        const updateDuration = () => {
            setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
        };
        const updateTime = () => setCurrentTime(audio.currentTime || 0);
        const handlePlay = () => {
            setIsLoading(false);
            setIsPlaying(true);
        };
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(Number.isFinite(audio.duration) ? audio.duration : 0);
        };
        const handleError = () => {
            setIsLoading(false);
            setIsPlaying(false);
            setError('This track could not be played from BLCUP.');
        };

        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('durationchange', updateDuration);
        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);

        cleanupAudioRef.current = () => {
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('durationchange', updateDuration);
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
        };
    }, []);

    const startTrack = useCallback(
        async (track) => {
            if (!track || typeof window === 'undefined' || !window.Audio) {
                return;
            }

            const requestId = requestIdRef.current + 1;
            requestIdRef.current = requestId;
            disposeAudio({ reset: true });
            setSelectedTrack(track);
            setIsLoading(true);
            setIsPlaying(false);
            setCurrentTime(0);
            setDuration(0);
            setError(null);

            try {
                const audioUrl = await resolveHskCourseAudioUrl(track.resourceId);
                if (requestId !== requestIdRef.current) {
                    return;
                }

                const audio = new window.Audio(audioUrl);
                audio.preload = 'metadata';
                audio.playbackRate = playbackRate;
                audio.loop = repeatOne;
                audioRef.current = audio;
                attachAudioEvents(audio);
                claimWebAudio(audio);
                await audio.play();
            } catch (playError) {
                if (requestId === requestIdRef.current) {
                    setIsLoading(false);
                    setIsPlaying(false);
                    setError(
                        playError?.message ||
                            'This track could not be loaded from BLCUP.',
                    );
                }
            }
        },
        [attachAudioEvents, disposeAudio, playbackRate, repeatOne],
    );

    const togglePlayPause = useCallback(async () => {
        const audio = audioRef.current;
        if (!selectedTrack || isLoading) {
            return;
        }

        if (!audio) {
            await startTrack(selectedTrack);
            return;
        }

        if (!audio.paused) {
            audio.pause();
            return;
        }

        try {
            setError(null);
            claimWebAudio(audio);
            await audio.play();
        } catch (playError) {
            setError(playError?.message || 'This track could not resume.');
        }
    }, [isLoading, selectedTrack, startTrack]);

    const seek = useCallback((nextTime) => {
        const audio = audioRef.current;
        if (!audio || !Number.isFinite(nextTime)) {
            return;
        }

        const clampedTime = Math.min(Math.max(nextTime, 0), audio.duration || 0);
        audio.currentTime = clampedTime;
        setCurrentTime(clampedTime);
    }, []);

    const cyclePlaybackRate = useCallback(() => {
        setPlaybackRate((currentRate) => {
            const currentIndex = PLAYBACK_RATES.indexOf(currentRate);
            return PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length];
        });
    }, []);

    const toggleRepeatOne = useCallback(() => {
        setRepeatOne((currentValue) => !currentValue);
    }, []);

    const clear = useCallback(() => {
        requestIdRef.current += 1;
        disposeAudio({ reset: true });
        setSelectedTrack(null);
        setIsLoading(false);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setError(null);
    }, [disposeAudio]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.loop = repeatOne;
        }
    }, [repeatOne]);

    useEffect(
        () => () => {
            requestIdRef.current += 1;
            disposeAudio();
        },
        [disposeAudio],
    );

    const selectedIndex = selectedTrack
        ? book.tracks.findIndex(
              (track) => track.resourceId === selectedTrack.resourceId,
          )
        : -1;

    return {
        selectedTrack,
        isLoading,
        isPlaying,
        currentTime,
        duration,
        playbackRate,
        repeatOne,
        error,
        hasPrevious: selectedIndex > 0,
        hasNext: selectedIndex >= 0 && selectedIndex < book.tracks.length - 1,
        startTrack,
        togglePlayPause,
        seek,
        cyclePlaybackRate,
        toggleRepeatOne,
        playPrevious: () => selectedIndex > 0 && startTrack(book.tracks[selectedIndex - 1]),
        playNext: () =>
            selectedIndex >= 0 &&
            selectedIndex < book.tracks.length - 1 &&
            startTrack(book.tracks[selectedIndex + 1]),
        clear,
    };
};

const EmptyPlayer = ({ styles }) => (
    <Card tone="accent" style={styles.playerCard}>
        <View style={styles.emptyPlayerIcon}>
            <Ionicons name="headset-outline" size={28} style={styles.emptyPlayerIconGlyph} />
        </View>
        <Text style={styles.playerEyebrow}>Study player</Text>
        <Text style={styles.emptyPlayerTitle}>Choose a track to start listening</Text>
        <Text style={styles.emptyPlayerText}>
            Open a lesson and select any recording. Your player and private transcript editor
            will appear here.
        </Text>
    </Card>
);

const StudyPlayer = ({
    colors,
    copied,
    onCopy,
    onTranscriptChange,
    player,
    styles,
    transcript,
}) => {
    const track = player.selectedTrack;
    const canSeek = player.duration > 0 && !player.isLoading;

    return (
        <Card style={styles.playerCard}>
            <View style={styles.playerSourceRow}>
                <View style={styles.sourceBadge}>
                    <Ionicons color={colors.accent} name="shield-checkmark" size={14} />
                    <Text style={styles.sourceBadgeText}>Official BLCUP audio</Text>
                </View>
                <Pressable
                    accessibilityRole="link"
                    onPress={() => Linking.openURL(getHskCourseResourceUrl(track.resourceId))}
                    style={({ pressed }) => [
                        styles.sourceLink,
                        pressed && styles.pressed,
                    ]}
                >
                    <Text style={styles.sourceLinkText}>Open at BLCUP</Text>
                    <Ionicons color={colors.primaryStrong} name="open-outline" size={14} />
                </Pressable>
            </View>

            <Text style={styles.playerEyebrow}>Now studying</Text>
            <Text style={styles.playerTitle}>{getTrackLabel(track)}</Text>
            <Text numberOfLines={2} style={styles.playerSubtitle}>
                {track.title}
            </Text>

            <View style={styles.timelineSection}>
                <WebRangeInput
                    colors={colors}
                    disabled={!canSeek}
                    maximumValue={player.duration}
                    onChange={player.seek}
                    value={player.currentTime}
                />
                <View style={styles.timeRow}>
                    <Text style={styles.timeText}>{formatTime(player.currentTime)}</Text>
                    <Text style={styles.timeText}>{formatTime(player.duration)}</Text>
                </View>
            </View>

            <View style={styles.playerControls}>
                <Pressable
                    accessibilityLabel="Previous textbook track"
                    accessibilityRole="button"
                    disabled={!player.hasPrevious || player.isLoading}
                    onPress={player.playPrevious}
                    style={({ pressed }) => [
                        styles.secondaryControl,
                        (!player.hasPrevious || player.isLoading) && styles.controlDisabled,
                        pressed && styles.pressed,
                    ]}
                >
                    <Ionicons color={colors.primaryStrong} name="play-skip-back" size={20} />
                </Pressable>

                <Pressable
                    accessibilityLabel={player.isPlaying ? 'Pause textbook audio' : 'Play textbook audio'}
                    accessibilityRole="button"
                    disabled={player.isLoading}
                    onPress={player.togglePlayPause}
                    style={({ pressed }) => [
                        styles.primaryControl,
                        pressed && styles.pressed,
                    ]}
                >
                    {player.isLoading ? (
                        <ActivityIndicator color={colors.onPrimary} size="small" />
                    ) : (
                        <Ionicons
                            color={colors.onPrimary}
                            name={player.isPlaying ? 'pause' : 'play'}
                            size={27}
                        />
                    )}
                </Pressable>

                <Pressable
                    accessibilityLabel="Next textbook track"
                    accessibilityRole="button"
                    disabled={!player.hasNext || player.isLoading}
                    onPress={player.playNext}
                    style={({ pressed }) => [
                        styles.secondaryControl,
                        (!player.hasNext || player.isLoading) && styles.controlDisabled,
                        pressed && styles.pressed,
                    ]}
                >
                    <Ionicons color={colors.primaryStrong} name="play-skip-forward" size={20} />
                </Pressable>
            </View>

            <View style={styles.studyControlRow}>
                <Pressable
                    accessibilityLabel="Change playback speed"
                    accessibilityRole="button"
                    onPress={player.cyclePlaybackRate}
                    style={({ pressed }) => [styles.studyControl, pressed && styles.pressed]}
                >
                    <Ionicons color={colors.accent} name="speedometer-outline" size={16} />
                    <Text style={styles.studyControlText}>{player.playbackRate}× speed</Text>
                </Pressable>
                <Pressable
                    accessibilityLabel="Repeat this track"
                    accessibilityRole="button"
                    accessibilityState={{ selected: player.repeatOne }}
                    onPress={player.toggleRepeatOne}
                    style={({ pressed }) => [
                        styles.studyControl,
                        player.repeatOne && styles.studyControlActive,
                        pressed && styles.pressed,
                    ]}
                >
                    <Ionicons
                        color={player.repeatOne ? colors.onPrimary : colors.accent}
                        name="repeat"
                        size={16}
                    />
                    <Text
                        style={[
                            styles.studyControlText,
                            player.repeatOne && styles.studyControlTextActive,
                        ]}
                    >
                        Repeat one
                    </Text>
                </Pressable>
            </View>

            {player.error ? (
                <View style={styles.errorBanner}>
                    <Ionicons color={colors.error} name="alert-circle" size={17} />
                    <Text style={styles.errorText}>{player.error}</Text>
                </View>
            ) : null}

            <View style={styles.transcriptDivider} />
            <View style={styles.transcriptHeader}>
                <View style={styles.transcriptHeadingCopy}>
                    <Text style={styles.transcriptEyebrow}>Private to this browser</Text>
                    <Text style={styles.transcriptTitle}>Transcript or notes</Text>
                </View>
                <Pressable
                    accessibilityLabel="Copy transcript"
                    accessibilityRole="button"
                    disabled={!transcript}
                    onPress={onCopy}
                    style={({ pressed }) => [
                        styles.copyButton,
                        !transcript && styles.controlDisabled,
                        pressed && styles.pressed,
                    ]}
                >
                    <Ionicons
                        color={colors.primaryStrong}
                        name={copied ? 'checkmark' : 'copy-outline'}
                        size={16}
                    />
                    <Text style={styles.copyButtonText}>{copied ? 'Copied' : 'Copy'}</Text>
                </Pressable>
            </View>
            <TextInput
                accessibilityLabel={`Private transcript for ${getTrackLabel(track)}`}
                multiline
                onChangeText={onTranscriptChange}
                placeholder="Paste the conversation from your book, or add your own listening notes…"
                placeholderTextColor={colors.textMuted}
                style={styles.transcriptInput}
                textAlignVertical="top"
                value={transcript}
            />
            <Text style={styles.transcriptHint}>
                Autosaved on this device only. It is never uploaded or included in cloud sync.
            </Text>
        </Card>
    );
};

const BooksScreen = () => {
    const { width } = useWindowDimensions();
    const { isWebDesktop, isWebWide, contentMaxWidth } = getResponsiveLayout(width);
    const { colors, radii, shadows, typography } = useAppTheme();
    const styles = useMemo(
        () =>
            createStyles(colors, radii, shadows, typography, {
                isWebDesktop,
                isWebWide,
                contentMaxWidth,
            }),
        [
            colors,
            contentMaxWidth,
            isWebDesktop,
            isWebWide,
            radii,
            shadows,
            typography,
        ],
    );
    const [libraryState, setLibraryState] = useState(createHskCourseLibraryState);
    const [isLibraryHydrated, setIsLibraryHydrated] = useState(false);
    const [selectedBookId, setSelectedBookId] = useState('hsk1');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroupKey, setExpandedGroupKey] = useState(null);
    const [copied, setCopied] = useState(false);
    const libraryStateRef = useRef(libraryState);
    const isLibraryHydratedRef = useRef(false);
    const copiedTimeoutRef = useRef(null);

    const selectedBook =
        courseCatalog.books.find((book) => book.bookId === selectedBookId) ||
        courseCatalog.books[0];
    const player = useCourseAudioPlayer(selectedBook);

    const filteredTracks = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
        if (!normalizedQuery) {
            return selectedBook.tracks;
        }

        return selectedBook.tracks.filter((track) =>
            `${track.code || ''} ${track.title}`
                .toLocaleLowerCase()
                .includes(normalizedQuery),
        );
    }, [searchQuery, selectedBook]);
    const lessonGroups = useMemo(() => buildLessonGroups(filteredTracks), [filteredTracks]);
    const transcript = player.selectedTrack
        ? libraryState.transcripts[player.selectedTrack.resourceId] || ''
        : '';

    useEffect(() => {
        let isMounted = true;

        loadHskCourseLibraryState().then((storedState) => {
            if (!isMounted) {
                return;
            }

            setLibraryState(storedState);
            setSelectedBookId(storedState.lastBookId);
            libraryStateRef.current = storedState;
            isLibraryHydratedRef.current = true;
            setIsLibraryHydrated(true);
        });

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        libraryStateRef.current = libraryState;
        if (!isLibraryHydrated) {
            return undefined;
        }

        const saveTimeout = setTimeout(() => {
            saveHskCourseLibraryState(libraryState).catch(() => {});
        }, 500);

        return () => clearTimeout(saveTimeout);
    }, [isLibraryHydrated, libraryState]);

    useEffect(
        () => () => {
            if (isLibraryHydratedRef.current) {
                saveHskCourseLibraryState(libraryStateRef.current).catch(() => {});
            }
            if (copiedTimeoutRef.current) {
                clearTimeout(copiedTimeoutRef.current);
            }
        },
        [],
    );

    useEffect(() => {
        const defaultGroup =
            lessonGroups.find((group) => group.lessonNumber !== null) || lessonGroups[0];
        setExpandedGroupKey(defaultGroup?.key || null);
    }, [selectedBookId]);

    useEffect(() => {
        if (!player.selectedTrack || searchQuery) {
            return;
        }

        const group = buildLessonGroups(selectedBook.tracks).find((candidate) =>
            candidate.tracks.some(
                (track) => track.resourceId === player.selectedTrack.resourceId,
            ),
        );
        if (group) {
            setExpandedGroupKey(group.key);
        }
    }, [player.selectedTrack, searchQuery, selectedBook.tracks]);

    const selectBook = (bookId) => {
        if (bookId === selectedBookId) {
            return;
        }

        player.clear();
        setSelectedBookId(bookId);
        setSearchQuery('');
        setCopied(false);
        setLibraryState((currentState) => ({
            ...currentState,
            lastBookId: bookId,
        }));
    };

    const updateTranscript = (value) => {
        if (!player.selectedTrack) {
            return;
        }

        setCopied(false);
        setLibraryState((currentState) => ({
            ...currentState,
            transcripts: {
                ...currentState.transcripts,
                [player.selectedTrack.resourceId]: value,
            },
        }));
    };

    const copyTranscript = async () => {
        if (!transcript) {
            return;
        }

        try {
            await copyText(transcript);
            setCopied(true);
            if (copiedTimeoutRef.current) {
                clearTimeout(copiedTimeoutRef.current);
            }
            copiedTimeoutRef.current = setTimeout(() => setCopied(false), 1600);
        } catch {
            setCopied(false);
        }
    };

    const renderPlayer = () => (
        <View style={styles.playerColumn}>
            {player.selectedTrack ? (
                <StudyPlayer
                    colors={colors}
                    copied={copied}
                    onCopy={copyTranscript}
                    onTranscriptChange={updateTranscript}
                    player={player}
                    styles={styles}
                    transcript={transcript}
                />
            ) : (
                <EmptyPlayer styles={styles} />
            )}
        </View>
    );

    const renderCatalog = () => (
        <View style={styles.catalogColumn}>
            <View style={styles.catalogHeader}>
                <View style={styles.catalogHeaderCopy}>
                    <Text style={styles.sectionEyebrow}>{selectedBook.label}</Text>
                    <Text style={styles.sectionTitle}>Textbook recordings</Text>
                    <Text style={styles.sectionSubtitle}>
                        {selectedBook.trackCount} official tracks grouped in publisher order.
                    </Text>
                </View>
                <Pressable
                    accessibilityRole="link"
                    onPress={() => Linking.openURL(selectedBook.seriesUrl)}
                    style={({ pressed }) => [
                        styles.publisherButton,
                        pressed && styles.pressed,
                    ]}
                >
                    <Ionicons color={colors.primaryStrong} name="open-outline" size={16} />
                    <Text style={styles.publisherButtonText}>BLCUP index</Text>
                </Pressable>
            </View>

            <View style={styles.searchBox}>
                <Ionicons color={colors.textMuted} name="search" size={19} />
                <TextInput
                    accessibilityLabel="Search textbook tracks"
                    onChangeText={setSearchQuery}
                    placeholder="Search track 03-2, lesson, or title"
                    placeholderTextColor={colors.textMuted}
                    style={styles.searchInput}
                    value={searchQuery}
                />
                {searchQuery ? (
                    <Pressable
                        accessibilityLabel="Clear track search"
                        onPress={() => setSearchQuery('')}
                        style={({ pressed }) => pressed && styles.pressed}
                    >
                        <Ionicons color={colors.textMuted} name="close-circle" size={19} />
                    </Pressable>
                ) : null}
            </View>

            {lessonGroups.length > 0 ? (
                <View style={styles.lessonList}>
                    {lessonGroups.map((group) => {
                        const isExpanded = searchQuery || expandedGroupKey === group.key;
                        const groupTitle =
                            group.lessonNumber === null
                                ? 'Introduction & extras'
                                : `Lesson ${group.lessonNumber}`;

                        return (
                            <Card key={group.key} style={styles.lessonCard}>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityState={{ expanded: Boolean(isExpanded) }}
                                    onPress={() =>
                                        setExpandedGroupKey((currentKey) =>
                                            currentKey === group.key ? null : group.key,
                                        )
                                    }
                                    style={({ pressed }) => [
                                        styles.lessonHeader,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <View style={styles.lessonHeaderCopy}>
                                        <Text style={styles.lessonTitle}>{groupTitle}</Text>
                                        <Text style={styles.lessonCount}>
                                            {group.tracks.length}{' '}
                                            {group.tracks.length === 1 ? 'track' : 'tracks'}
                                        </Text>
                                    </View>
                                    <Ionicons
                                        color={colors.primaryStrong}
                                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                        size={19}
                                    />
                                </Pressable>

                                {isExpanded ? (
                                    <View style={styles.trackList}>
                                        {group.tracks.map((track, index) => {
                                            const isSelected =
                                                player.selectedTrack?.resourceId ===
                                                track.resourceId;
                                            const isCurrentLoading =
                                                isSelected && player.isLoading;

                                            return (
                                                <Pressable
                                                    accessibilityLabel={`Play ${getTrackLabel(track)}`}
                                                    accessibilityRole="button"
                                                    key={track.resourceId}
                                                    onPress={() => player.startTrack(track)}
                                                    style={({ pressed }) => [
                                                        styles.trackRow,
                                                        index > 0 && styles.trackRowBorder,
                                                        isSelected && styles.trackRowSelected,
                                                        pressed && styles.trackRowPressed,
                                                    ]}
                                                >
                                                    <View
                                                        style={[
                                                            styles.trackPlayIcon,
                                                            isSelected && styles.trackPlayIconSelected,
                                                        ]}
                                                    >
                                                        {isCurrentLoading ? (
                                                            <ActivityIndicator
                                                                color={colors.onPrimary}
                                                                size="small"
                                                            />
                                                        ) : (
                                                            <Ionicons
                                                                color={
                                                                    isSelected
                                                                        ? colors.onPrimary
                                                                        : colors.primaryStrong
                                                                }
                                                                name={
                                                                    isSelected && player.isPlaying
                                                                        ? 'volume-high'
                                                                        : 'play'
                                                                }
                                                                size={17}
                                                            />
                                                        )}
                                                    </View>
                                                    <View style={styles.trackCopy}>
                                                        <Text
                                                            style={[
                                                                styles.trackTitle,
                                                                isSelected && styles.trackTitleSelected,
                                                            ]}
                                                        >
                                                            {getTrackLabel(track)}
                                                        </Text>
                                                        <Text numberOfLines={1} style={styles.trackSubtitle}>
                                                            {track.title}
                                                        </Text>
                                                    </View>
                                                    {libraryState.transcripts[track.resourceId] ? (
                                                        <View style={styles.noteIndicator}>
                                                            <Ionicons
                                                                color={colors.accent}
                                                                name="document-text-outline"
                                                                size={15}
                                                            />
                                                        </View>
                                                    ) : null}
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                ) : null}
                            </Card>
                        );
                    })}
                </View>
            ) : (
                <Card tone="muted" style={styles.noResultsCard}>
                    <Ionicons color={colors.textMuted} name="search-outline" size={24} />
                    <Text style={styles.noResultsTitle}>No matching tracks</Text>
                    <Text style={styles.noResultsText}>
                        Try a track code such as 03-2 or clear the search.
                    </Text>
                </Card>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <BackdropOrbs />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.hero}>
                    <View style={styles.heroCopy}>
                        <Text style={styles.heroEyebrow}>HSK Standard Course</Text>
                        <Text style={styles.heroTitle}>Listen alongside your books</Text>
                        <Text style={styles.heroSubtitle}>
                            Browse all {courseCatalog.totalTracks} official textbook recordings,
                            slow them down, repeat difficult passages, and keep private notes.
                        </Text>
                    </View>
                    <View style={styles.heroMetricRow}>
                        <View style={styles.heroMetric}>
                            <Text style={styles.heroMetricValue}>9</Text>
                            <Text style={styles.heroMetricLabel}>books</Text>
                        </View>
                        <View style={styles.heroMetricDivider} />
                        <View style={styles.heroMetric}>
                            <Text style={styles.heroMetricValue}>{courseCatalog.totalTracks}</Text>
                            <Text style={styles.heroMetricLabel}>tracks</Text>
                        </View>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.bookSelectorContent}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.bookSelector}
                >
                    {courseCatalog.books.map((book) => {
                        const isSelected = book.bookId === selectedBookId;
                        return (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ selected: isSelected }}
                                key={book.bookId}
                                onPress={() => selectBook(book.bookId)}
                                style={({ pressed }) => [
                                    styles.bookChip,
                                    isSelected && styles.bookChipSelected,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.bookChipLabel,
                                        isSelected && styles.bookChipLabelSelected,
                                    ]}
                                >
                                    {book.label}
                                </Text>
                                <Text
                                    style={[
                                        styles.bookChipCount,
                                        isSelected && styles.bookChipCountSelected,
                                    ]}
                                >
                                    {book.trackCount}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>

                {!isLibraryHydrated ? (
                    <View style={styles.hydrationRow}>
                        <ActivityIndicator color={colors.primaryStrong} size="small" />
                        <Text style={styles.hydrationText}>Restoring your private notes…</Text>
                    </View>
                ) : null}

                <View style={styles.columns}>
                    {isWebDesktop ? (
                        <>
                            {renderCatalog()}
                            {renderPlayer()}
                        </>
                    ) : (
                        <>
                            {renderPlayer()}
                            {renderCatalog()}
                        </>
                    )}
                </View>

                <Text style={styles.attribution}>
                    Audio is streamed from Beijing Language and Culture University Press. Source
                    availability remains under the publisher's control.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
};

const createStyles = (colors, radii, shadows, typography, layout) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        scrollContent: {
            width: '100%',
            maxWidth: layout.contentMaxWidth,
            alignSelf: 'center',
            paddingHorizontal: layout.isWebWide ? 36 : 18,
            paddingTop: layout.isWebDesktop ? 46 : 24,
            paddingBottom: layout.isWebDesktop ? 132 : 34,
            gap: 24,
        },
        hero: {
            flexDirection: layout.isWebWide ? 'row' : 'column',
            alignItems: layout.isWebWide ? 'flex-end' : 'stretch',
            justifyContent: 'space-between',
            gap: 22,
        },
        heroCopy: {
            maxWidth: 780,
            gap: 8,
        },
        heroEyebrow: {
            color: colors.primaryStrong,
            fontFamily: typography.uiFont,
            fontSize: 13,
            fontWeight: '800',
            letterSpacing: 1.3,
            textTransform: 'uppercase',
        },
        heroTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: layout.isWebDesktop ? 48 : 36,
            fontWeight: '700',
            lineHeight: layout.isWebDesktop ? 56 : 42,
        },
        heroSubtitle: {
            color: colors.textSecondary,
            fontFamily: typography.uiFont,
            fontSize: layout.isWebWide ? 17 : 15,
            lineHeight: layout.isWebWide ? 26 : 23,
            maxWidth: 720,
        },
        heroMetricRow: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: layout.isWebWide ? 'auto' : 'flex-start',
            paddingHorizontal: 20,
            paddingVertical: 14,
            gap: 18,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            ...shadows.sm,
        },
        heroMetric: {
            alignItems: 'center',
            minWidth: 62,
        },
        heroMetricValue: {
            color: colors.primaryStrong,
            fontFamily: typography.headingFont,
            fontSize: 24,
            fontWeight: '800',
        },
        heroMetricLabel: {
            color: colors.textMuted,
            fontFamily: typography.uiFont,
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
        },
        heroMetricDivider: {
            width: 1,
            height: 38,
            backgroundColor: colors.border,
        },
        bookSelector: {
            marginHorizontal: layout.isWebWide ? -4 : -18,
        },
        bookSelectorContent: {
            paddingHorizontal: layout.isWebWide ? 4 : 18,
            gap: 10,
        },
        bookChip: {
            minWidth: 104,
            paddingHorizontal: 17,
            paddingVertical: 12,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
        },
        bookChipSelected: {
            backgroundColor: colors.primaryStrong,
            borderColor: colors.primaryStrong,
        },
        bookChipLabel: {
            color: colors.text,
            fontFamily: typography.uiFont,
            fontSize: 14,
            fontWeight: '800',
        },
        bookChipLabelSelected: {
            color: colors.onPrimary,
        },
        bookChipCount: {
            color: colors.textMuted,
            fontFamily: typography.uiFont,
            fontSize: 12,
            fontWeight: '700',
        },
        bookChipCountSelected: {
            color: colors.onPrimary,
            opacity: 0.82,
        },
        hydrationRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
        },
        hydrationText: {
            color: colors.textSecondary,
            fontFamily: typography.uiFont,
            fontSize: 13,
        },
        columns: {
            flexDirection: layout.isWebDesktop ? 'row' : 'column',
            alignItems: 'flex-start',
            gap: layout.isWebDesktop ? 28 : 20,
        },
        catalogColumn: {
            width: layout.isWebDesktop ? 0 : '100%',
            flexBasis: layout.isWebDesktop ? 0 : 'auto',
            flexGrow: layout.isWebDesktop ? 1.62 : 0,
            gap: 18,
        },
        playerColumn: {
            width: layout.isWebDesktop ? 0 : '100%',
            flexBasis: layout.isWebDesktop ? 0 : 'auto',
            flexGrow: layout.isWebDesktop ? 1 : 0,
        },
        catalogHeader: {
            flexDirection: layout.isWebWide ? 'row' : 'column',
            alignItems: layout.isWebWide ? 'center' : 'flex-start',
            justifyContent: 'space-between',
            gap: 14,
        },
        catalogHeaderCopy: {
            gap: 3,
        },
        sectionEyebrow: {
            color: colors.primaryStrong,
            fontFamily: typography.uiFont,
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 1,
            textTransform: 'uppercase',
        },
        sectionTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 28,
            fontWeight: '700',
        },
        sectionSubtitle: {
            color: colors.textSecondary,
            fontFamily: typography.uiFont,
            fontSize: 14,
            lineHeight: 21,
        },
        publisherButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            paddingHorizontal: 13,
            paddingVertical: 9,
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        publisherButtonText: {
            color: colors.primaryStrong,
            fontFamily: typography.uiFont,
            fontSize: 12,
            fontWeight: '800',
        },
        searchBox: {
            minHeight: 50,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        searchInput: {
            flex: 1,
            color: colors.text,
            fontFamily: typography.uiFont,
            fontSize: 14,
            outlineStyle: 'none',
        },
        lessonList: {
            gap: 12,
        },
        lessonCard: {
            padding: 0,
            borderRadius: radii.md,
        },
        lessonHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingVertical: 16,
        },
        lessonHeaderCopy: {
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 10,
        },
        lessonTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 18,
            fontWeight: '700',
        },
        lessonCount: {
            color: colors.textMuted,
            fontFamily: typography.uiFont,
            fontSize: 12,
            fontWeight: '700',
        },
        trackList: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        trackRow: {
            minHeight: 66,
            paddingHorizontal: 16,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: colors.surface,
        },
        trackRowBorder: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        trackRowSelected: {
            backgroundColor: colors.accentSoft,
        },
        trackRowPressed: {
            backgroundColor: colors.surfaceMuted,
        },
        trackPlayIcon: {
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        trackPlayIconSelected: {
            borderColor: colors.primaryStrong,
            backgroundColor: colors.primaryStrong,
        },
        trackCopy: {
            flex: 1,
            gap: 2,
        },
        trackTitle: {
            color: colors.text,
            fontFamily: typography.uiFont,
            fontSize: 14,
            fontWeight: '800',
        },
        trackTitleSelected: {
            color: colors.accent,
        },
        trackSubtitle: {
            color: colors.textMuted,
            fontFamily: typography.studyFont,
            fontSize: 12,
        },
        noteIndicator: {
            width: 28,
            height: 28,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
        },
        noResultsCard: {
            alignItems: 'center',
            gap: 8,
            paddingVertical: 34,
        },
        noResultsTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 19,
            fontWeight: '700',
        },
        noResultsText: {
            color: colors.textSecondary,
            fontFamily: typography.uiFont,
            fontSize: 13,
            textAlign: 'center',
        },
        playerCard: {
            width: '100%',
            padding: layout.isWebWide ? 24 : 20,
        },
        emptyPlayerIcon: {
            width: 54,
            height: 54,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
            marginBottom: 18,
        },
        emptyPlayerIconGlyph: {
            color: colors.accent,
        },
        playerEyebrow: {
            color: colors.primaryStrong,
            fontFamily: typography.uiFont,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1,
            textTransform: 'uppercase',
        },
        emptyPlayerTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 24,
            fontWeight: '700',
            lineHeight: 30,
            marginTop: 5,
        },
        emptyPlayerText: {
            color: colors.textSecondary,
            fontFamily: typography.uiFont,
            fontSize: 14,
            lineHeight: 22,
            marginTop: 8,
        },
        playerSourceRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 22,
        },
        sourceBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            flexShrink: 1,
        },
        sourceBadgeText: {
            color: colors.accent,
            fontFamily: typography.uiFont,
            fontSize: 11,
            fontWeight: '800',
        },
        sourceLink: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
        },
        sourceLinkText: {
            color: colors.primaryStrong,
            fontFamily: typography.uiFont,
            fontSize: 11,
            fontWeight: '800',
        },
        playerTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 30,
            fontWeight: '700',
            lineHeight: 36,
            marginTop: 5,
        },
        playerSubtitle: {
            color: colors.textSecondary,
            fontFamily: typography.studyFont,
            fontSize: 13,
            lineHeight: 20,
            marginTop: 5,
        },
        timelineSection: {
            marginTop: 22,
        },
        timeRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
        },
        timeText: {
            color: colors.textMuted,
            fontFamily: typography.uiFont,
            fontSize: 11,
            fontVariant: ['tabular-nums'],
        },
        playerControls: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            marginTop: 13,
        },
        secondaryControl: {
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        primaryControl: {
            width: 62,
            height: 62,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii.pill,
            backgroundColor: colors.primaryStrong,
            ...shadows.sm,
        },
        controlDisabled: {
            opacity: 0.4,
        },
        studyControlRow: {
            flexDirection: 'row',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 9,
            marginTop: 20,
        },
        studyControl: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            paddingHorizontal: 13,
            paddingVertical: 9,
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        studyControlActive: {
            backgroundColor: colors.accent,
            borderColor: colors.accent,
        },
        studyControlText: {
            color: colors.accent,
            fontFamily: typography.uiFont,
            fontSize: 12,
            fontWeight: '800',
        },
        studyControlTextActive: {
            color: colors.onPrimary,
        },
        errorBanner: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
            padding: 12,
            borderRadius: radii.sm,
            backgroundColor: colors.errorSoft,
            marginTop: 18,
        },
        errorText: {
            flex: 1,
            color: colors.error,
            fontFamily: typography.uiFont,
            fontSize: 12,
            lineHeight: 18,
        },
        transcriptDivider: {
            height: 1,
            backgroundColor: colors.border,
            marginVertical: 24,
        },
        transcriptHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
        },
        transcriptHeadingCopy: {
            flex: 1,
        },
        transcriptEyebrow: {
            color: colors.accent,
            fontFamily: typography.uiFont,
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.9,
            textTransform: 'uppercase',
        },
        transcriptTitle: {
            color: colors.text,
            fontFamily: typography.headingFont,
            fontSize: 20,
            fontWeight: '700',
            marginTop: 2,
        },
        copyButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radii.pill,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        copyButtonText: {
            color: colors.primaryStrong,
            fontFamily: typography.uiFont,
            fontSize: 11,
            fontWeight: '800',
        },
        transcriptInput: {
            minHeight: 180,
            maxHeight: 360,
            marginTop: 14,
            padding: 14,
            color: colors.text,
            fontFamily: typography.studyFont,
            fontSize: 15,
            lineHeight: 24,
            borderRadius: radii.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
            outlineStyle: 'none',
        },
        transcriptHint: {
            color: colors.textMuted,
            fontFamily: typography.uiFont,
            fontSize: 11,
            lineHeight: 17,
            marginTop: 9,
        },
        attribution: {
            color: colors.textMuted,
            fontFamily: typography.uiFont,
            fontSize: 11,
            lineHeight: 17,
            textAlign: 'center',
            alignSelf: 'center',
            maxWidth: 720,
        },
        pressed: {
            opacity: 0.72,
        },
    });

export default BooksScreen;
