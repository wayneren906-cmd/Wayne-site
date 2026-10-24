// Local test controls. Timing and synthetic clicks stay outside the shipped app.
const journalFrame = document.querySelector('iframe');
const journalTools = document.createElement('nav');
const journalOutput = document.createElement('pre');
journalOutput.id = 'journal-motion-proof';
document.querySelector('nav').after(journalTools, journalOutput);
function journalButton(label, action) {
  const button = document.createElement('button');
  button.textContent = label;
  button.onclick = action;
  journalTools.append(button);
}
journalButton('定位日志记录', () => {
  const w = journalFrame.contentWindow, heading = w.document.querySelector('#journal-records');
  w.scrollTo({ top: w.scrollY + heading.getBoundingClientRect().top - 110, behavior: 'instant' });
});
for (const [label, rapid] of [['采样日志开合', false], ['采样快速切换', true]]) {
  journalButton(label, () => {
    const w = journalFrame.contentWindow, entry = w.document.querySelector('.entry');
    const summary = entry.querySelector('summary'), samples = [], start = performance.now();
    const initial = entry.open;
    const sample = () => {
      const elapsed = performance.now() - start;
      samples.push({ ms: Math.round(elapsed), height: entry.getBoundingClientRect().height, summaryHeight: summary.getBoundingClientRect().height, open: entry.open });
      if (elapsed < 900) requestAnimationFrame(sample);
      else journalOutput.textContent = JSON.stringify({ initial, final: entry.open, expected: rapid ? initial : !initial,
        supports: w.CSS.supports('interpolate-size: allow-keywords') && w.CSS.supports('selector(details::details-content)'),
        transition: w.getComputedStyle(entry, '::details-content').transitionDuration,
        reduced: w.matchMedia('(prefers-reduced-motion: reduce)').matches,
        samples }, null, 2);
    };
    sample();
    summary.click();
    if (rapid) for (const delay of [90, 180, 270]) setTimeout(() => summary.click(), delay);
  });
}
function readingState(target) {
  const w = journalFrame.contentWindow;
  return { revealed: target.classList.contains('is-journal-revealed'), opacity: w.getComputedStyle(target).opacity,
    animations: target.getAnimations().map(a => ({ state: a.playState, time: a.currentTime })) };
}
journalButton('检查正文动画', () => {
  const entry = journalFrame.contentDocument.querySelector('.entry');
  journalOutput.textContent = JSON.stringify({ first: readingState(entry.querySelector('.note')),
    blocks: [...entry.querySelectorAll('[data-journal-reveal]')].map(readingState) });
});
journalButton('采样滚动入场', () => {
  const w = journalFrame.contentWindow, target = [...w.document.querySelectorAll('.entry[open] .note')].at(-1);
  const before = readingState(target);
  w.scrollTo({ top: w.scrollY + target.getBoundingClientRect().top - 140, behavior: 'instant' });
  setTimeout(() => {
    const during = readingState(target);
    setTimeout(() => { journalOutput.textContent = JSON.stringify({ before, during, after: readingState(target) }); }, 650);
  }, 80);
});
