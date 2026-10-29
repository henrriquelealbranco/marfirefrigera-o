// Muted inline playback, with a gesture fallback for mobile autoplay policies.
(() => {
  const video = document.querySelector('.hero-bg-video');
  const playButton = document.querySelector('.hero-video-play');
  if (!video || !playButton) return;

  let enabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pending = false;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;

  function attemptPlayback() {
    if (!enabled || document.hidden || pending || !video.paused) return;
    pending = true;
    // Set the property as well as the HTML attribute before every attempt.
    video.muted = true;
    let playback;
    try {
      playback = video.play();
    } catch (error) {
      pending = false;
      playButton.hidden = error.name !== 'NotAllowedError';
      return;
    }
    Promise.resolve(playback).then(() => {
      pending = false;
      playButton.hidden = true;
    }).catch(error => {
      pending = false;
      // A missing/unsupported media file should retain the poster, not a dead CTA.
      playButton.hidden = error.name !== 'NotAllowedError';
    });
  }

  video.addEventListener('playing', () => { playButton.hidden = true; });
  video.addEventListener('canplay', attemptPlayback);
  video.addEventListener('error', () => { playButton.hidden = true; });
  document.addEventListener('visibilitychange', attemptPlayback);
  window.addEventListener('pageshow', attemptPlayback);

  // These calls stay in the user-gesture event, as required by iOS.
  document.addEventListener('pointerdown', attemptPlayback, { passive: true });
  document.addEventListener('touchstart', attemptPlayback, { passive: true });
  document.addEventListener('keydown', attemptPlayback);
  playButton.addEventListener('click', () => {
    enabled = true;
    video.classList.add('is-enabled');
    attemptPlayback();
  });

  if (enabled) attemptPlayback();
  else {
    video.pause();
    playButton.hidden = false;
  }
})();
