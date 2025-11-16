(function () {
    const container = document.getElementById('heroSwap');
    const video = document.getElementById('introVideo');
    const skipBtn = container.querySelector('.skip-btn');

    // When the video finishes, switch to the image
    video.addEventListener('ended', () => {
    container.classList.add('show-image');
    // Ensure video is fully stopped (saves battery/CPU)
    try {
        video.pause();
        video.currentTime = video.duration || 0;
        video.removeAttribute('src'); // frees up memory (optional)
        video.load();
    } catch (_e) {
        /* swallow */
    }
    }, { passive: true });

    // If autoplay is blocked, start on click
    video.addEventListener('play', () => {
        // no-op, but ensures we know autoplay worked
    });

    video.addEventListener('error', () => {
        // If video fails, just show image
        container.classList.add('show-image');
    });

    // Let users skip to the image
    skipBtn.addEventListener('click', () => {
        video.dispatchEvent(new Event('ended'));
    });
})();