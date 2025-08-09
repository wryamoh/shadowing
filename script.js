// =================================================================
// FINAL SCRIPT FOR YOUTUBE SHADOWING TOOL (VERSION 5.2 - FINAL & STABLE)
// Author: Wrya Zrebar & AI Assistant
// Changelog: Corrected the event listener attachment logic to fix the unresponsive button bug.
// =================================================================

// --- Global State Variables ---
let player;
let subtitles = [];
let currentIndex = 0;
let groupSize = 1;
let playbackTimer;
let isAdPlaying = false;

// --- YouTube Player API ready function ---
// This function is called automatically by the YouTube script once it's loaded.
function onYouTubeIframeAPIReady() {
    // This space is intentionally left blank. We will create the player instance on button click.
}

// --- Core Functions (defined globally to be accessible everywhere) ---

function setupPlayer(videoId) {
    // If a player already exists, load the new video into it.
    if (player && typeof player.loadVideoById === 'function') {
        player.loadVideoById(videoId);
    } else {
        // Otherwise, create a new player instance.
        player = new YT.Player('video-player', {
            height: '390', width: '640', videoId: videoId,
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
    document.getElementById('player-container').classList.remove('hidden');
    playCurrentGroup();
}

function onPlayerStateChange(event) {
    const videoData = player.getVideoData();
    const currentVideoId = extractVideoId(player.getVideoUrl());
    // An ad is playing if the video ID of the content is different from the main video ID
    isAdPlaying = videoData.video_id !== currentVideoId;

    // Only set the auto-pause timer if the main video is playing
    if (event.data === YT.PlayerState.PLAYING && !isAdPlaying) {
        clearTimeout(playbackTimer);
        const group = subtitles.slice(currentIndex, currentIndex + groupSize);
        if (group.length === 0) return;
        const end = group[group.length - 1].end;
        const currentTime = player.getCurrentTime();
        const timeUntilPause = (end - currentTime) * 1000;
        if (timeUntilPause > 0) {
            playbackTimer = setTimeout(() => {
                if (player && typeof player.pauseVideo === 'function') {
                    player.pauseVideo();
                }
            }, timeUntilPause);
        }
    } else {
        // If an ad is playing or the video is paused/buffering, cancel any pending timer.
        clearTimeout(playbackTimer);
    }
}

function playCurrentGroup() {
    if (!subtitles || subtitles.length === 0) return;
    if (currentIndex >= subtitles.length) currentIndex = subtitles.length - 1;
    if (currentIndex < 0) currentIndex = 0;
    const group = subtitles.slice(currentIndex, currentIndex + groupSize);
    if (group.length === 0) return;
    const start = group[0].start;
    updateSubtitlesUI(group);
    player.seekTo(start, true);
    player.playVideo();
}

async function updateSubtitlesUI(group) {
    const subtitleEnElem = document.getElementById('subtitle-en');
    const subtitleTrElem = document.getElementById('subtitle-tr');
    const translateLangSelect = document.getElementById('translate-lang');

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

function extractVideoId(url) { const regex = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/; const match = url.match(regex); return match ? match[1] : null; }
function showLoading(isLoading) { 
    document.getElementById('loading-indicator').classList.toggle('hidden', !isLoading);
    document.getElementById('load-btn').disabled = isLoading;
}
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

function updateVisitorCount() { 
    const visitorCountElem = document.getElementById('visitor-count');
    let visitors = localStorage.getItem('visitorCount_shadowingTool') || 0;
    visitors = parseInt(visitors) + 1;
    localStorage.setItem('visitorCount_shadowingTool', visitors);
    if (visitorCountElem) visitorCountElem.textContent = visitors;
}
function updateVideoCount() { 
    const videoCountElem = document.getElementById('video-count');
    let videos = localStorage.getItem('videoCount_shadowingTool') || 0;
    videos = parseInt(videos) + 1;
    localStorage.setItem('videoCount_shadowingTool', videos);
    if (videoCountElem) videoCountElem.textContent = videos;
}

// --- Main App Initialization ---
// This event listener ensures that we only try to access DOM elements after they have been fully loaded by the browser.
document.addEventListener('DOMContentLoaded', () => {
    // Get all DOM elements once the document is ready
    const youtubeLinkInput = document.getElementById('youtube-link');
    const srtFileInput = document.getElementById('srt-file-input');
    const loadBtn = document.getElementById('load-btn');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const repeatBtn = document.getElementById('repeat-btn');
    const sentenceGroupSelect = document.getElementById('sentence-group');
    const videoCountElem = document.getElementById('video-count');

    // Attach the main event listener for the "Start Shadowing" button
    loadBtn.addEventListener('click', async () => {
        console.log("Start Shadowing button clicked.");
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

    // Attach other listeners
    nextBtn.addEventListener('click', () => { currentIndex += groupSize; playCurrentGroup(); });
    prevBtn.addEventListener('click', () => { currentIndex -= groupSize; playCurrentGroup(); });
    repeatBtn.addEventListener('click', () => { playCurrentGroup(); });
    sentenceGroupSelect.addEventListener('change', (e) => { groupSize = parseInt(e.target.value, 10); });

    // Initial setup on page load
    groupSize = parseInt(sentenceGroupSelect.value, 10);
    updateVisitorCount();
    const storedVideos = localStorage.getItem('videoCount_shadowingTool') || 0;
    if (videoCountElem) videoCountElem.textContent = storedVideos;
});
