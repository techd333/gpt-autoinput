const allowedUrlPattern = /^https:\/\/chatgpt\.com/;

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => updatePopup(tabId, tab.url));
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.url) {
    updatePopup(tabId, tab.url);
  }
});

function updatePopup(tabId, url) {
  const isAllowed = allowedUrlPattern.test(url);
  chrome.action.setPopup({ tabId, popup: isAllowed ? 'popup.html' : '' });
  chrome.action.setTitle({
    tabId,
    title: isAllowed ? '拡張機能を使用できます' : 'このページでは使用できません',
  });
}

const DB_NAME = 'gptAutoinput';
const STORE_NAME = 'files';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function loadFiles() {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = (e) => resolve(e.target.result.map((r) => r.content));
    req.onerror = () => resolve([]);
  });
}

let queue = [];
let isRunning = false;
let isPaused = false;

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'run') {
    if (!isRunning) {
      loadFiles().then((files) => {
        queue = files.slice();
        isRunning = true;
        isPaused = false;
        processQueue();
      });
    } else {
      isPaused = false;
      processQueue();
    }
  } else if (request.action === 'pause') {
    isPaused = true;
  } else if (request.action === 'stop') {
    isRunning = false;
    isPaused = false;
    queue = [];
  }
});

function processQueue() {
  if (!isRunning || isPaused) return;
  const text = queue.shift();
  if (text) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'inputText', text });
      }
      if (queue.length > 0) {
        setTimeout(processQueue, 1000);
      } else {
        isRunning = false;
      }
    });
  } else {
    isRunning = false;
  }
}
