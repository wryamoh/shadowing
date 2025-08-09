<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>YouTube Subtitle Player</title>
  <style>
    body { font-family: Arial; background: #f0f0f0; }
    #player { margin-bottom: 10px; }
    .subtitle-line { padding: 5px; cursor: pointer; }
    .active { background: yellow; }
  </style>
</head>
<body>

<div id="player"></div>
<div id="subtitles"></div>

<script src="https://www.youtube.com/iframe_api"></script>
<script>
let player;
let subtitles = [];
let currentIndex = -1;
let stopTimeout = null;

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '390',
    width: '640',
    videoId: 'M7lc1UVf-VE', // اینجا ID ویدیوی خودتان را بگذارید
    events: { 'onReady': onPlayerReady }
  });
}

function onPlayerReady() {
  loadSubtitles();
}

function loadSubtitles() {
  // به جای این قسمت، ساب‌تایتل فایل خودتان را بخوانید
  subtitles = [
    { start: 0, end: 3, text: "Hello and welcome" },
    { start: 3, end: 6, text: "This is a test" },
    { start: 6, end: 9, text: "Stopping works now" }
  ];
  displaySubtitles();
}

function displaySubtitles() {
  const container = document.getElementById('subtitles');
  container.innerHTML = '';
  subtitles.forEach((line, index) => {
    const div = document.createElement('div');
    div.textContent = line.text;
    div.className = 'subtitle-line';
    div.onclick = () => playSubtitle(index);
    container.appendChild(div);
  });
}

function playSubtitle(index) {
  // لغو تایمر قبلی
  if (stopTimeout) {
    clearTimeout(stopTimeout);
    stopTimeout = null;
  }

  currentIndex = index;
  highlightCurrentSubtitle();

  const line = subtitles[index];
  player.seekTo(line.start, true);
  
  // کمی تأخیر برای اطمینان از این که ویدیو به موقعیت جدید رفته
  setTimeout(() => {
    player.playVideo();

    // محاسبه زمان توقف و تنظیم تایمر
    const duration = (line.end - line.start) * 1000;
    stopTimeout = setTimeout(() => {
      player.pauseVideo();
    }, duration);
  }, 300);
}

function highlightCurrentSubtitle() {
  const lines = document.querySelectorAll('.subtitle-line');
  lines.forEach((line, i) => {
    line.classList.toggle('active', i === currentIndex);
  });
}
</script>

</body>
</html>
