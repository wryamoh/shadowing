(function() {
    function getVideo() {
        return document.querySelector('video');
    }

    function isAdPlaying(video) {
        // تبلیغات معمولا یا تگ خاص دارند یا طول کوتاه
        return video && (video.duration < 60 || document.querySelector('.ad-showing'));
    }

    function waitForMainVideo(callback) {
        let checkInterval = setInterval(() => {
            let video = getVideo();
            if (video && !isAdPlaying(video)) {
                clearInterval(checkInterval);
                callback(video);
            }
        }, 500);
    }

    function setupPlayPauseControl(video) {
        console.log("🎬 ویدئوی اصلی پیدا شد، کنترل فعال شد");

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') { // با Space پلی/پاز کن
                e.preventDefault();
                if (video.paused) {
                    video.play();
                } else {
                    video.pause();
                }
            }
        });

        // اگر ویدئو تمام شد، دوباره صبر می‌کنیم تا ویدئوی بعدی بیاید
        video.addEventListener('ended', () => {
            console.log("⏳ ویدئو تمام شد، منتظر ویدئوی بعدی هستیم...");
            waitForMainVideo(setupPlayPauseControl);
        });
    }

    // شروع کار
    waitForMainVideo(setupPlayPauseControl);
})();
