// =================================================================
// FINAL SCRIPT FOR YOUTUBE SHADOWING TOOL (VERSION 1.2 - STABLE PROXY)
// Author: Wrya Zrebar & AI Assistant
// Changelog: Switched to a more reliable, no-activation-needed CORS proxy.
// =================================================================

// --- 1. DOM Element Connections ---
const youtubeLinkInput = document.getElementById('youtube-link');
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
let playbackTimer;

// --- 3. Core Logic: Loading and Processing Video ---
loadBtn.addEventListener('click', async () => {
    const url = youtubeLinkInput.value.trim();
    if (!url) return alert('Please paste a YouTube link.');

    const videoId = extractVideoId(url);
    if (!videoId) return alert('Invalid YouTube link. Please check the URL format.');

    showLoading(true);
    
    try {
        console.log(`Attempting to fetch subtitles for video ID: ${videoId}`);
        
        // Smart Subtitle Fetching Strategy
        let fetchedSubtitles = await fetchSubtitles(videoId, 'en'); // 1. Try for manual English

        if (!fetchedSubtitles) {
            console.log("Manual 'en' subs not found. Trying auto-generated 'a.en'...");
            fetchedSubtitles = await fetchSubtitles(videoId, 'a.en'); // 2. Fallback to auto-generated
        }

        if (!fetchedSubtitles) {
            alert('No English subtitles (manual or auto-generated) found for this video.');
            showLoading(false);
            return;
        }

        console.log(`Successfully loaded ${fetchedSubtitles.length} subtitle entries.`);
        subtitles = fetchedSubtitles;
        setupPlayer(videoId);
        updateVideoCount();
        
    } catch (error) {
        console.error('Critical error during video load process:', error);
        alert('A critical error occurred. Please check the browser console (F12) for details.');
        showLoading(false);
    }
});

async function fetchSubtitles(videoId, langCode) {
    // Using a more reliable, no-activation-needed CORS proxy
    const proxyUrl = 'https://api.allorigins.win/raw?url=';
    const subtitlesUrl = `https://www.youtube.com/api/timedtext?lang=${langCode}&v=${videoId}&fmt=srv3`;
    
    try {
        // The URL must be encoded for the new proxy
        const response = await axios.get(proxyUrl + encodeURIComponent(subtitlesUrl), { timeout: 15000 }); // Increased timeout
        
        if (response.status === 200 && response.data) {
            const parsedSubs = parseSrt(response.data);
            return parsedSubs.length > 0 ? parsedSubs : null;
        }
        return null;
    } catch (error) {
        console.log(`Failed to fetch subtitles for lang=${langCode}. Status: ${error.response?.status}. This is often expected.`);
        return null;
    }
}

// --- 4. YouTube Player Setup and Control ---
function onYouTubeIframeAPIReady() {}

function setupPlayer(videoId) {
    if (player) {
        player.loadVideoById(videoId);
        playerContainer.classList.add('hidden');
        showLoading(true);
    } else {
        player = new YT.Player('video-player', {
            height: '390',
            width: '640',
            videoId: videoId,
            playerVars: { 'playsinline': 1, 'controls': 1, 'cc_load_policy': 0 },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    }
    currentIndex = 0;
}

function onPlayerReady(event) {
    showLoading(false);
    playerContainer.classList.remove('hidden');
    playCurrentGroup();
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        clearTimeout(playbackTimer);
    }
}

function playCurrentGroup() {
    if (!subtitles || subtitles.length === 0) return;
    if (currentIndex >= subtitles.length) currentIndex = subtitles.length - 1;
    if (currentIndex < 0) currentIndex = 0;

    clearTimeout(playbackTimer);

    const group = subtitles.slice(currentIndex, currentIndex + groupSize);
    if (group.length === 0) return;

    const start = group[0].start;
    const end = group[group.length - 1].end;

    player.seekTo(start, true);
    player.playVideo();

    updateSubtitlesUI(group);

    const duration = (end - start) * 1000 + 200;
    playbackTimer = setTimeout(() => {
        if (player && typeof player.pauseVideo === 'function') {
            player.pauseVideo();
        }
    }, duration > 0 ? duration : 200);
}

// --- 5. UI and Translation Logic ---
async function updateSubtitlesUI(group) {
    const enText = group.map(s => s.text).join(' ');
    subtitleEnElem.textContent = enText;

    const targetLang = translateLangSelect.value;
    if (targetLang === 'none' || !enText) {
        subtitleTrElem.textContent = '';
        return;
    }

    subtitleTrElem.textContent = 'Translating...';
    try {
        const transResponse = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(enText)}&langpair=en|${targetLang}`);
        if (transResponse.data && transResponse.data.responseData) {
            const translatedText = transResponse.data.responseData.translatedText;
            subtitleTrElem.textContent = translatedText;
            subtitleTrElem.lang = targetLang;
            subtitleTrElem.dir = ['ar', 'fa', 'he', 'ur'].includes(targetLang) ? 'rtl' : 'ltr';
        } else {
            throw new Error('Invalid translation API response');
        }
    } catch (error) {
        console.error('Translation API error:', error);
        subtitleTrElem.textContent = '(Translation failed)';
    }
}

// --- 6. Event Listeners for Controls ---
nextBtn.addEventListener('click', () => {
    currentIndex += groupSize;
    playCurrentGroup();
});

prevBtn.addEventListener('click', () => {
    currentIndex -= groupSize;
    playCurrentGroup();
});

repeatBtn.addEventListener('click', () => {
    playCurrentGroup();
});

sentenceGroupSelect.addEventListener('change', (e) => {
    groupSize = parseInt(e.target.value, 10);
});

// --- 7. Utility Functions ---
function extractVideoId(url) {
    const regex = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function showLoading(isLoading) {
    loadingIndicator.classList.toggle('hidden', !isLoading);
    loadBtn.disabled = isLoading;
}

function parseSrt(data) {
    const srtRegex = /(\d+)\s*(\d{2}:\d{2}:\d{2}[,.]\d{3}) --> (\d{2}:\d{2}:\d{2}[,.]\d{3})\s*([\s\S]*?)(?=\n\n|\n*$)/g;
    let match;
    const result = [];
    while ((match = srtRegex.exec(data)) !== null) {
        result.push({
            start: timeToSeconds(match[2]),
            end: timeToSeconds(match[3]),
            text: match[4].replace(/<[^>]*>/g, "").replace(/\n/g, ' ').trim()
        });
    }
    return result;
}

function timeToSeconds(time) {
    const parts = time.replace(',', '.').split(/[:.]/);
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10) + parseInt(parts[3], 10) / 1000;
}

// --- 8. Stats Logic ---
function updateVisitorCount() {
    let visitors = localStorage.getItem('visitorCount_shadowingTool') || 0;
    visitors = parseInt(visitors) + 1;
    localStorage.setItem('visitorCount_shadowingTool', visitors);
    if (visitorCountElem) visitorCountElem.textContent = visitors;
}

function updateVideoCount() {
    let videos = localStorage.getItem('videoCount_shadowingTool') || 0;
    videos = parseInt(videos) + 1;
    localStorage.setItem('videoCount_shadowingTool', videos);
    if (videoCountElem) videoCountElem.textContent = videos;
}

// --- 9. Initial App Load ---
document.addEventListener('DOMContentLoaded', () => {
    groupSize = parseInt(sentenceGroupSelect.value, 10);
    updateVisitorCount();
    const storedVideos = localStorage.getItem('videoCount_shadowingTool') || 0;
    if (videoCountElem) videoCountElem.textContent = storedVideos;
});
