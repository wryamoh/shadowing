// =================================================================
// FINAL SCRIPT FOR YOUTUBE SHADOWING TOOL (VERSION 6.0 - DIRECT VIDEO PLAYER)
// Author: Wrya Zrebar & AI Assistant
// Changelog: Switched from YouTube IFrame API to a direct HTML5 video player to bypass ads and control issues.
// =================================================================

// --- Global State Variables ---
let subtitles = [];
let currentIndex = 0;
let groupSize = 1;
let playbackTimer;

// --- Main App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Get all DOM elements once the document is ready
    const youtubeLinkInput = document.getElementById('youtube-link');
    const srtFileInput = document.getElementById('srt-file-input');
    const loadBtn = document.getElementById('load-btn');
    const videoPlayer = document.getElementById('video-player');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const repeatBtn = document.getElementById('repeat-btn');
    const sentenceGroupSelect = document.getElementById('sentence-group');
    
    // Attach the main event listener for the "Start Shadowing" button
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
            // 1. Parse the user's SRT file
            const srtContent = await srtFile.text();
            const parsedSubtitles = parseSrt(srtContent);

            if (!parsedSubtitles || parsedSubtitles.length === 0) {
                alert('Could not parse any subtitles from the file. Please check the SRT format.');
                showLoading(false);
                return;
            }
            subtitles = parsedSubtitles;
            currentIndex = 0;

            // 2. Fetch the direct, ad-free video URL
            const directVideoUrl = await getDirectVideoUrl(videoId);
            if (!directVideoUrl) {
                alert('Could not fetch the direct video stream. The video might be private or restricted.');
                showLoading(false);
                return;
            }

            // 3. Load the video and prepare the player
            videoPlayer.src = directVideoUrl;
            videoPlayer.load();
            
            videoPlayer.onloadeddata = () => {
                showLoading(false);
                document.getElementById('player-container').classList.remove('hidden');
                updateVideoCount();
                playCurrentGroup(); // Play the first sentence automatically
            };

        } catch (error) {
            console.error('Error during loading process:', error);
            alert('An error occurred. The video might be unavailable or the service is down.');
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
    document.getElementById('video-count').textContent = storedVideos;
});

// --- Core Functions ---

async function getDirectVideoUrl(videoId) {
    try {
        // Using a public Invidious API instance as a proxy to get direct video links
        // This is more reliable than scraping.
        const apiUrl = `https://invidious.io.lol/api/v1/videos/${videoId}`;
        const response = await axios.get(apiUrl);
        
        // Find the best available quality (prefer 720p, fallback to others)
        const streams = response.data.formatStreams;
        const videoStream = streams.find(f => f.qualityLabel === '720p' && f.container === 'mp4') || 
                            streams.find(f => f.qualityLabel === '480p' && f.container === 'mp4') ||
                            streams.find(f => f.qualityLabel === '360p' && f.container === 'mp4');

        return videoStream ? videoStream.url : null;
    } catch (error) {
        console.error("Failed to get direct video URL:", error);
        return null;
    }
}

function playCurrentGroup() {
    const videoPlayer = document.getElementById('video-player');
    if (!videoPlayer || !subtitles || subtitles.length === 0) return;

    if (currentIndex >= subtitles.length) currentIndex = subtitles.length - 1;
    if (currentIndex < 0) currentIndex = 0;

    clearTimeout(playbackTimer);

    const group = subtitles.slice(currentIndex, currentIndex + groupSize);
    if (group.length === 0) return;

    const start = group[0].start;
    const end = group[group.length - 1].end;

    updateSubtitlesUI(group);

    videoPlayer.currentTime = start;
    videoPlayer.play();

    const duration = (end - start) * 1000;

    if (duration > 0) {
        playbackTimer = setTimeout(() => {
            videoPlayer.pause();
        }, duration);
    }
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

// --- Utility Functions ---
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

// --- Stats Logic ---
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
