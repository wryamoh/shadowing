// =================================================================
// FINAL SCRIPT FOR YOUTUBE SHADOWING TOOL (VERSION 4.5 - ROBUST PAUSE)
// Author: Wrya Zrebar & AI Assistant
// Changelog: Reliable pause using requestAnimationFrame watcher + fallback timeout
// =================================================================

// --- 1. DOM Element Connections ---
const youtubeLinkInput = document.getElementById('youtube-link');
const srtFileInput = document.getElementById('srt-file-input');
const loadBtn = document.getElementById('load-btn');
const playerContainer = document.getElementById('player-container');
const loadingIndicator = document.getElementById('loading-indicator');
const subtitleEnElem = document.getElementById('subtitle-en');
const subtitleTrElem = document.getElementById('subtitle-tr');
const prevBtn = document.getElementById('prev-btn');
const repeatBtn = document.getElementById('repeat-btn');
const nextBtn = document.getElementById('next-btn');
const sentenceGroupSelect = document.getElementById('sentence-group');
const translateLangSelect = document.getElementById('translate-lang');
const visitorCountElem = document.getElementById('visitor-count');
const videoCountElem = document.getElementById('video-count');

// --- 2. Global State Variables ---
let player;
let subtitles = [];
let currentIndex = 0;
let groupSize = 1;

// IDs / handles for timers/watchers (we'll clear these before starting a new group)
let playbackTimeoutId = null;     // fallback timeout
let playbackRafId = null;         // requestAnimationFrame id

// --- 3. Core Logic: Loading and Processing Video ---
loadBtn.addEventListener('click', async () => {
    const url = youtubeLinkInput.value.trim();
    if (!url) return alert('Please provide a YouTube link.');

    const videoId = extractVideoId(url);
    if (!videoId) return alert('Invalid YouTube link. Please check the URL format.');

    const srtFile = srtFileInput.files[0];
    if (!srtFile) {
        return alert('Please upload an SRT subtitle file.');
    }

    showLoading(true);
    
    try {
        const srtContent = await srtFile.text();
        const parsedSubtitles = parseSrt(srtContent);

        if (!parsedSubtitles || parsedSubtitles.length === 0) {
            alert('Could not parse any subtitles from the file. Please check the SRT format.');
            showLoading(false);
            return;
        }

        subtitles = parsedSubtitles;
        setupPlayer(videoId);
        updateVideoCount();
        
    } catch (error) {
        console.error('Error processing file:', error);
        alert('An error occurred while reading or parsing the file.');
        showLoading(false);
    }
});

// --- 4. YouTube Player Setup and Control ---
function onYouTubeIframeAPIReady() { /* if loader expects this global */ }

function setupPlayer(videoId) {
    if (player) {
        player.loadVideoById(videoId);
        playerContainer.classList.add('hidden');
        showLoading(true);
    } else {
        player = new YT.Player('video-player', {
            height: '390', width: '640', videoId: videoId,
            playerVars: { 'playsinline': 1, 'controls': 1, 'cc_load_policy': 0 },
            events: { 'onReady': onPlayerReady }
        });
    }
    currentIndex = 0;
}

function onPlayerReady(event) {
    showLoading(false);
    playerContainer.classList.remove('hidden');
    playCurrentGroup();
}

// --- 5. Reliable Pause Watcher Functions ---
function stopPauseWatchers() {
    if (playbackRafId) {
        cancelAnimationFrame(playbackRafId);
        playbackRafId = null;
    }
    if (playbackTimeoutId) {
        clearTimeout(playbackTimeoutId);
        playbackTimeoutId = null;
    }
}

function startPauseWatcher(endTimeSeconds) {
    stopPauseWatchers();
    const EPS = 0.04; // tolerance in seconds

    // Fallback timeout (in case RAF stalls); compute best-effort delay
    function scheduleFallback() {
        try {
            const ct = (player && typeof player.getCurrentTime === 'function') ? player.getCurrentTime() : 0;
            const ms = Math.max(0, (endTimeSeconds - ct) * 1000 + 150); // +150ms safety
            playbackTimeoutId = setTimeout(() => {
                try { player.pauseVideo(); } catch(e) { /* ignore */ }
                stopPauseWatchers();
                console.log('[shadow] fallback timeout fired, paused at', player && player.getCurrentTime && player.getCurrentTime());
            }, ms);
            console.log('[shadow] fallback scheduled in', ms, 'ms');
        } catch (e) {
            console.warn('[shadow] fallback scheduling failed', e);
        }
    }

    // Precise RAF-based watcher
    function rafTick() {
        try {
            if (!player || typeof player.getCurrentTime !== 'function') {
                playbackRafId = requestAnimationFrame(rafTick);
                return;
            }
            const ct = player.getCurrentTime();
            // If NaN or not ready yet, keep looping
            if (isNaN(ct)) {
                playbackRafId = requestAnimationFrame(rafTick);
                return;
            }
            // If we reached or passed endTime (with EPS tolerance) -> pause
            if (ct >= (endTimeSeconds - EPS) || (player.getPlayerState && player.getPlayerState() === YT.PlayerState.ENDED)) {
                try { player.pauseVideo(); } catch (e) {}
                stopPauseWatchers();
                console.log('[shadow] rafTick paused at', ct, 'target end', endTimeSeconds);
                return;
            } else {
                playbackRafId = requestAnimationFrame(rafTick);
            }
        } catch (err) {
            console.error('[shadow] rafTick error', err);
            playbackRafId = requestAnimationFrame(rafTick);
        }
    }

    // Start both RAF watcher and fallback timeout
    playbackRafId = requestAnimationFrame(rafTick);
    scheduleFallback();
    console.log('[shadow] pause watcher started for endTime', endTimeSeconds);
}

// --- 6. Play group with robust pause scheduling ---
function playCurrentGroup() {
    if (!subtitles || subtitles.length === 0) return;
    if (currentIndex >= subtitles.length) currentIndex = subtitles.length - 1;
    if (currentIndex < 0) currentIndex = 0;

    const group = subtitles.slice(currentIndex, currentIndex + groupSize);
    if (group.length === 0) return;

    const start = group[0].start;
    const end = group[group.length - 1].end;

    updateSubtitlesUI(group);

    // stop any existing watchers/timers before seeking/playing
    stopPauseWatchers();

    // Seek then play. some browsers/youtube need a short delay for seek to take effect,
    // but our RAF watcher will handle precise pausing.
    try {
        player.seekTo(start, true);
        // small delay to ensure seek applied in many environments, then play
        setTimeout(() => {
            try {
                player.playVideo();
                console.log('[shadow] playCurrentGroup -> started playback at requested start', start);
                // Start the watcher to pause precisely at 'end'
                startPauseWatcher(end);
            } catch (e) {
                console.error('[shadow] playVideo error', e);
            }
        }, 120); // 120ms small delay
    } catch (e) {
        console.error('[shadow] seek/play error', e);
    }
}

// --- 7. UI and Translation Logic ---
async function updateSubtitlesUI(group) {
    const enText = group.map(s => s.text).join(' ');
    subtitleEnElem.textContent = enText;
    const targetLang = translateLangSelect.value;
    if (targetLang === 'none' || !enText) { subtitleTrElem.textContent = ''; return; }
    subtitleTrElem.textContent = 'Translating...';
    try {
        const transResponse = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(enText)}&langpair=en|${targetLang}`);
        if (transResponse.data && transResponse.data.responseData) {
            const translatedText = transResponse.data.responseData.translatedText;
            subtitleTrElem.textContent = translatedText;
            subtitleTrElem.lang = targetLang;
            subtitleTrElem.dir = ['ar', 'fa', 'he', 'ur'].includes(targetLang) ? 'rtl' : 'ltr';
        } else { throw new Error('Invalid translation API response'); }
    } catch (error) { console.error('Translation API error:', error); subtitleTrElem.textContent = '(Translation failed)'; }
}

// --- 8. Event Listeners for Controls ---
nextBtn.addEventListener('click', () => { currentIndex += groupSize; playCurrentGroup(); });
prevBtn.addEventListener('click', () => { currentIndex -= groupSize; playCurrentGroup(); });
repeatBtn.addEventListener('click', () => { playCurrentGroup(); });
sentenceGroupSelect.addEventListener('change', (e) => { groupSize = parseInt(e.target.value, 10); });

// --- 9. Utility Functions ---
function extractVideoId(url) { const regex = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/; const match = url.match(regex); return match ? match[1] : null; }
function showLoading(isLoading) { loadingIndicator.classList.toggle('hidden', !isLoading); loadBtn.disabled = isLoading; }
function parseSrt(srtText) {
    const blocks = srtText.trim().replace(/\r\n/g, '\n').split(/\n\n/);
    const subtitles = [];
    for (const block of blocks) {
        const lines = block.split('\n');
        if (lines.length < 2) continue;
        const timeLineIndex = lines.findIndex(line => line.includes('-->'));
        if (timeLineIndex === -1) continue;
        const timeLine = lines[timeLineIndex];
        const timeMatch = timeLine.match(/(\S+)\s*-->\s*(\S+)/);
        if (timeMatch) {
            const start = timeToSeconds(timeMatch[1]);
            const end = timeToSeconds(timeMatch[2]);
            const text = lines.slice(timeLineIndex + 1).join(' ').replace(/<[^>]*>/g, "").trim();
            if (!isNaN(start) && !isNaN(end) && text) {
                subtitles.push({ start, end, text });
            }
        }
    }
    return subtitles;
}
function timeToSeconds(timeStr) {
    const timeParts = timeStr.replace(',', '.').split(':');
    let seconds = 0;
    try {
        if (timeParts.length === 3) {
            seconds += parseFloat(timeParts[0]) * 3600;
            seconds += parseFloat(timeParts[1]) * 60;
            seconds += parseFloat(timeParts[2]);
        } else if (timeParts.length === 2) {
            seconds += parseFloat(timeParts[0]) * 60;
            seconds += parseFloat(timeParts[1]);
        } else { return NaN; }
        return seconds;
    } catch (e) { return NaN; }
}

// --- 10. Stats Logic ---
function updateVisitorCount() { let visitors = localStorage.getItem('visitorCount_shadowingTool') || 0; visitors = parseInt(visitors) + 1; localStorage.setItem('visitorCount_shadowingTool', visitors); if (visitorCountElem) visitorCountElem.textContent = visitors; }
function updateVideoCount() { let videos = localStorage.getItem('videoCount_shadowingTool') || 0; videos = parseInt(videos) + 1; localStorage.setItem('videoCount_shadowingTool', videos); if (videoCountElem) videoCountElem.textContent = videos; }

// --- 11. Initial App Load ---
document.addEventListener('DOMContentLoaded', () => {
    groupSize = parseInt(sentenceGroupSelect.value, 10);
    updateVisitorCount();
    const storedVideos = localStorage.getItem('videoCount_shadowingTool') || 0;
    if (videoCountElem) videoCountElem.textContent = storedVideos;
});
