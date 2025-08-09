// ==UserScript==
// @name         YouTube Auto Pause After Each Sentence
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Pause YouTube video after each subtitle line (skip ads)
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let lastSubtitle = "";
    let player;

    function initPlayer() {
        player = document.querySelector('video');
    }

    function isAdPlaying() {
        // اگر تبلیغ باشد، کلاس ad-showing روی body یا پلیر می‌آید
        return document.querySelector('.ad-showing') !== null;
    }

    function checkSubtitles() {
        if (!player) {
            initPlayer();
            return;
        }

        if (isAdPlaying()) {
            console.log("⏳ تبلیغ در حال پخش است، صبر می‌کنیم...");
            return;
        }

        let subtitleElement = document.querySelector('.ytp-caption-segment');
        if (subtitleElement) {
            let currentSubtitle = subtitleElement.innerText.trim();
            if (currentSubtitle && currentSubtitle !== lastSubtitle) {
                lastSubtitle = currentSubtitle;
                console.log("⏸ مکث بعد از جمله:", currentSubtitle);
                player.pause();
            }
        }
    }

    // اجرا در بازه زمانی کوتاه
    setInterval(checkSubtitles, 500);

    // وقتی پلیر تغییر می‌کند
    const observer = new MutationObserver(initPlayer);
    observer.observe(document.body, { childList: true, subtree: true });

})();
