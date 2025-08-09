// --- DOM Elements ---
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

// --- Global State ---
let player;
let subtitles = [];
let currentIndex = 0;
let groupSize = 1;
let playbackTimer;

// --- YouTube IFrame API ---
function onYouTubeIframeAPIReady() {
    // This function is called by the YouTube API script
}

// --- Main Logic ---
loadBtn.addEventListener('click', async () => {
    const url = youtubeLinkInput.value.trim();
    if (!url) {
        alert('Please paste a YouTube link.');
        return;
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
        alert('Invalid YouTube link. Please check the URL.');
        return;
    }

    showLoading(true);
    try {
        // We need a proxy to bypass CORS issues for fetching subtitles
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const subtitlesUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=srv3`;
        
        const response = await axios.get(proxyUrl + subtitlesUrl);
        subtitles = parseSrt(response.data);

        if (subtitles.length === 0) {
            alert('No English subtitles found for this video.');
            showLoading(false);
            return;
        }

        setupPlayer(videoId);
        updateVideoCount();
        showLoading(false);
        playerContainer.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading subtitles:', error);
        alert('Could not load subtitles. The video might not have English subtitles, or there was a network error.');
        showLoading(false);
    }
});

function setupPlayer(videoId) {
    if (player) {
        player.loadVideoById(videoId);
    } else {
        player = new YT.Player('video-player', {
            height: '390',
            width: '640',
            videoId: videoId,
            playerVars: { 'playsinline': 1, 'controls': 1 },
            events: {
                'onReady': onPlayerReady
            }
        });
    }
    currentIndex = 0;
}

function onPlayerReady(event) {
    playCurrentGroup();
}

function playCurrentGroup() {
    if (currentIndex >= subtitles.length) {
        currentIndex = subtitles.length - 1;
    }
    if (currentIndex < 0) {
        currentIndex = 0;
    }

    clearTimeout(playbackTimer);

    const group = subtitles.slice(currentIndex, currentIndex + groupSize);
    if (group.length === 0) return;

    const start = group[0].start;
    const end = group[group.length - 1].end;

    player.seekTo(start, true);
    player.playVideo();

    updateSubtitlesUI(group);

    const duration = (end - start) * 1000;
    playbackTimer = setTimeout(() => {
        if (player && typeof player.pauseVideo === 'function') {
            player.pauseVideo();
        }
    }, duration);
}

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
        // Using a free, public translation API
        const transResponse = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(enText)}&langpair=en|${targetLang}`);
        if (transResponse.data && transResponse.data.responseData) {
            const translatedText = transResponse.data.responseData.translatedText;
            subtitleTrElem.textContent = translatedText;
            subtitleTrElem.lang = targetLang;
            subtitleTrElem.dir = ['ar', 'fa', 'he', 'ur'].includes(targetLang) ? 'rtl' : 'ltr';
        } else {
            throw new Error('Invalid translation response');
        }
    } catch (error) {
        console.error('Translation error:', error);
        subtitleTrElem.textContent = '(Translation not available)';
    }
}

// --- Event Listeners for Controls ---
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

// --- Utility Functions ---
function extractVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function showLoading(isLoading) {
    if (isLoading) {
        loadingIndicator.classList.remove('hidden');
        loadBtn.disabled = true;
    } else {
        loadingIndicator.classList.add('hidden');
        loadBtn.disabled = false;
    }
}

function parseSrt(data) {
    const srtRegex = /(\d+)\s*(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\s*([\s\S]*?)(?=\n\n|\n*$)/g;
    let match;
    const result = [];
    while ((match = srtRegex.exec(data)) !== null) {
        result.push({
            start: timeToSeconds(match[2]),
            end: timeToSeconds(match[3]),
            text: match[4].replace(/\n/g, ' ').trim()
        });
    }
    return result;
}

function timeToSeconds(time) {
    const parts = time.split(/[:,]/);
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10) + parseInt(parts[3], 10) / 1000;
}

// --- Stats Logic ---
function updateVisitorCount() {
    // This is a simple simulation. Real stats need a backend.
    let visitors = localStorage.getItem('visitorCount') || 0;
    visitors = parseInt(visitors) + 1;
    localStorage.setItem('visitorCount', visitors);
    if (visitorCountElem) visitorCountElem.textContent = visitors;
}

function updateVideoCount() {
    let videos = localStorage.getItem('videoCount') || 0;
    videos = parseInt(videos) + 1;
    localStorage.setItem('videoCount', videos);
    if (videoCountElem) videoCountElem.textContent = videos;
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    groupSize = parseInt(sentenceGroupSelect.value, 10);
    updateVisitorCount();
    const storedVideos = localStorage.getItem('videoCount') || 0;
    if (videoCountElem) videoCountElem.textContent = storedVideos;
});
