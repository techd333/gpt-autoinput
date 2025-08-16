document.getElementById('runBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'run' });
});

document.getElementById('pauseBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'pause' });
});

document.getElementById('stopBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stop' });
});
