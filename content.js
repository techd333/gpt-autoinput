/**
 * コンテンツスクリプト
 * ページ上にWindow型UIを挿入し、ファイル処理・進捗表示を行う
 * ドラッグ移動・最小化/復帰対応
 */

console.log('Text File Auto Processor Content Script loaded');

const timeOutSeconds = 10 * 60;

// Window型UIのHTML
const windowHtml = `
<div id="tfap-window" class="minimum">
    <div id="tfap-header" class="minimum">
        <div class="tfap-header-right">
            <button id="tfap-min-btn" title="最小化">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h12v2H6z"/>
                </svg>
            </button>
        </div>
    </div>
    
    <div id="tfap-body">
        <!-- ファイル入力エリア -->
        <div id="tfap-file-area">
            <div class="tfap-file-drop-zone">
                <input type="file" id="tfap-file-input" multiple accept=".txt">
                <div class="tfap-drop-area">
                    <div class="tfap-drop-content">
                        <div class="tfap-drop-icon">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                            </svg>
                        </div>
                        <div>
                            <p class="tfap-drop-text">ファイルをドロップ</p>
                            <p class="tfap-drop-text">または</p>
                            <p class="tfap-drop-text">クリックして選択</p>
                        </div>
                    </div>
                </div>
            </div>
            <div id="tfap-file-list"></div>
        </div>

        <!-- コントロール -->
        <div id="tfap-controls">
            <button id="tfap-start-btn" class="tfap-btn" disabled>
                <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                </svg>
                <span>処理開始</span>
            </button>
            <button id="tfap-stop-btn" class="tfap-btn tfap-hidden">
                <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h12v12H6z"/>
                </svg>
                <span>処理停止</span>
            </button>
        </div>

        <!-- プログレスエリア -->
        <div id="tfap-progress-area">
            <div class="tfap-progress-header">
                <span id="tfap-progress-text">0 / 0</span>
                <span class="tfap-progress-time"></span>
            </div>
            <div class="tfap-progress-bar-container">
                <div id="tfap-progress-bar"></div>
            </div>
            <div class="tfap-status-container">
                <span id="tfap-status-message">待機中</span>
            </div>
        </div>

        <!-- エラーエリア -->
        <div id="tfap-error-area">
            <div class="tfap-error-content">
                <div class="tfap-error-icon">
                    <svg fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                </div>
                <div class="tfap-error-message"></div>
            </div>
        </div>
    </div>
</div>
`;

function injectWindowUI() {
  if (!document.getElementById('tfap-window')) {
    document.body.insertAdjacentHTML('beforeend', windowHtml);
    setupWindowUI();
    // tfap-window生成時に表示状態を通知
    chrome.runtime.sendMessage({ action: 'tfapWindowStateChanged', checked: true });
  }
}

function setupWindowUI() {
  const win = document.getElementById('tfap-window');
  const header = document.getElementById('tfap-header');
  const minBtn = document.getElementById('tfap-min-btn');
  const windowBody = document.getElementById('tfap-body');
  let isMinimized = true;

  // ドラッグ移動（requestAnimationFrameで軽量化）
  let offsetX, offsetY, dragging = false;

  windowBody.style.display = 'none';

  header.addEventListener('mousedown', (e) => {
    dragging = true;
    offsetX = e.clientX - win.offsetLeft;
    offsetY = e.clientY - win.offsetTop;
  });

  function onMouseMove(e) {
    if (!dragging) return;
    window.requestAnimationFrame(() => {
      win.style.left = (e.clientX - offsetX) + 'px';
      win.style.top = (e.clientY - offsetY) + 'px';
    });
  }

  document.addEventListener('mousemove', onMouseMove);

  document.addEventListener('mouseup', () => {
    dragging = false;
    document.body.style.userSelect = '';
  });

  minBtn.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  })
  // 最小化
  minBtn.addEventListener('click', () => {
    isMinimized = !isMinimized;
    windowBody.style.display = isMinimized ? 'none' : '';
    if (isMinimized) {
      win.classList.add("minimum");
      header.classList.add("minimum");
    } else {
      win.classList.remove("minimum");
      header.classList.remove("minimum");
    }
    minBtn.innerHTML = isMinimized
      ? '<svg width="20" height="20" fill="currentColor"><rect x="9" y="4" width="2" height="12"/></svg>'
      : '<svg width="20" height="20" fill="currentColor"><rect y="9" width="20" height="2"/></svg>';
  });

  // ファイル選択・処理ロジック
  setupFileProcessing();
}

let tfapSelectedFiles = [];
let tfapIsProcessing = false;
let tfapShouldStop = false;

function setupFileProcessing() {
  const fileInput = document.getElementById('tfap-file-input');
  const startBtn = document.getElementById('tfap-start-btn');
  const stopBtn = document.getElementById('tfap-stop-btn');
  const fileList = document.getElementById('tfap-file-list');
  const progressArea = document.getElementById('tfap-progress-area');
  const progressBar = document.getElementById('tfap-progress-bar');
  const progressText = document.getElementById('tfap-progress-text');
  const statusMessage = document.getElementById('tfap-status-message');
  const errorArea = document.getElementById('tfap-error-area');

  // ファイル入力変更
  fileInput.addEventListener('change', (e) => {
    tfapSelectedFiles = Array.from(e.target.files);
    updateFileList();

    if (tfapSelectedFiles.length === 0) {
      startBtn.disabled = true;
      return;
    }
    startBtn.disabled = false;
  });

  function updateFileList() {
    if (tfapSelectedFiles.length === 0) {
      fileList.textContent = 'ファイルが選択されていません';
      startBtn.disabled = true;
      return;
    }
    fileList.innerHTML = `<div>${tfapSelectedFiles.length}件のファイル</div>`;
    startBtn.disabled = false;
  }

  startBtn.addEventListener('click', startProcessing);
  stopBtn.addEventListener('click', stopProcessing);

  async function startProcessing() {
    if (tfapSelectedFiles.length === 0 || tfapIsProcessing) return;
    tfapIsProcessing = true;
    tfapShouldStop = false;

    startBtn.classList.add('tfap-hidden');
    stopBtn.classList.remove('tfap-hidden');
    progressArea.classList.remove('tfap-hidden');
    hideError();

    fileInput.disabled = true;
    fileInput.classList.add("disabled");
    document.querySelector(".tfap-drop-area").classList.add("disabled");

    for (let i = 0; i < tfapSelectedFiles.length; i++) {
      if (tfapShouldStop) {
        updateStatus('処理が停止されました');
        break;
      }
      const file = tfapSelectedFiles[i];
      updateProgress(i + 1, tfapSelectedFiles.length);
      updateStatus(`${file.name} を処理中...`);
      try {
        const content = await readFileContent(file);
        // テキストの入力
        document.querySelector("#prompt-textarea").textContent = content;

        const startButton = await waitForElement("#composer-submit-button", 5000)
        if (startButton) {
          console.log(`処理開始！：${file.name}`);
          startButton.click();

          // 1実行最短5秒待機（反映待ち）
          await sleep(5000);

          // 中断ボタンがなくなるまで待機(1出力10分以上で失敗)
          let timeLimit = timeOutSeconds * 1000 / 500;
          while (document.querySelector("#composer-submit-button")) {
            if (--timeLimit === 0) {
              throw new Error("出力がタイムアウトしました：#composer-submit-button");
            }
            await sleep(500);
          }
        } else {
          throw new Error("見つかりません：#composer-submit-button");
        }
      } catch (error) {
        showError(`${file.name} の処理中にエラー: ${error.message}`);
        break;
      }
    }

    if (!tfapShouldStop) {
      updateProgress(tfapSelectedFiles.length, tfapSelectedFiles.length);
      updateStatus('すべてのファイルの処理が完了しました');
    }

    fileInput.disabled = false;
    fileInput.classList.remove("disabled");
    document.querySelector(".tfap-drop-area").classList.remove("disabled");

    tfapIsProcessing = false;
    startBtn.classList.remove('tfap-hidden');
    stopBtn.classList.add('tfap-hidden');
  }

  function stopProcessing() {
    tfapShouldStop = true;
    updateStatus('処理を停止しています...');
  }

  function readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('ファイル読み取りエラー'));
      reader.readAsText(file);
    });
  }

  function updateProgress(current, total) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${current} / ${total}`;
  }

  function updateStatus(message) {
    statusMessage.textContent = message;
  }

  function showError(message) {
    errorArea.textContent = message;
    errorArea.classList.remove('tfap-hidden');
  }

  function hideError() {
    errorArea.textContent = "";
    errorArea.classList.add('tfap-hidden');
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  // ドラッグ＆ドロップ対応
  const dropZone = document.querySelector('.tfap-file-drop-zone');
  const dropArea = document.querySelector('.tfap-drop-area');

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', (e) => {
    dropArea.classList.remove('dragover');
  });

  dropZone.addEventListener('dragenter', (e) => {
    dropArea.classList.add('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      tfapSelectedFiles = Array.from(e.dataTransfer.files);
      updateFileList();
      startBtn.disabled = tfapSelectedFiles.length === 0;
    }
  });
}

// popupからのトグル指示でUI表示/非表示（チェックボックス対応＋デバッグログ）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[content.js] メッセージ受信:', request);
  if (request.action === 'toggleTfapWindow') {
    const win = document.getElementById('tfap-window');
    if (request.checked) {
      if (win) {
        win.style.display = '';
        console.log('[content.js] Window表示');
         chrome.runtime.sendMessage({ action: 'tfapWindowStateChanged', checked: true });
      } else {
        injectWindowUI();
        console.log('[content.js] Window生成＆表示');
      }
    } else {
      if (win) {
        win.style.display = 'none';
        console.log('[content.js] Window非表示');
         chrome.runtime.sendMessage({ action: 'tfapWindowStateChanged', checked: false });
      }
    }
    sendResponse({ result: 'ok' });
    return;
  }
  if (request.action === 'getTfapWindowState') {
    const win = document.getElementById('tfap-window');
    let state = 'hidden';
    if (win) {
      state = win.style.display === 'none' ? 'hidden' : 'visible';
    }
    sendResponse({ state });
    return;
  }
});

// ページロード時にUI自動挿入
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectWindowUI);
} else {
  injectWindowUI();
}

// DOM要素の存在確認用のヘルパー関数
function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const element = document.getElementById(selector.replace('#', ''));
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const element = document.getElementById(selector.replace('#', ''));
            if (element) {
                obs.disconnect();
                resolve(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        }, timeout);
    });
}

// ページ読み込み完了時の初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

function initialize() {
    console.log('Content script initialized on:', window.location.href);
    
    // 必要な要素の存在確認（デバッグ用）
    const promptTextarea = document.getElementById('prompt-textarea');
    const submitButton = document.getElementById('composer-submit-button');
    const speechButton = document.getElementById('composer-speech-button');

    console.log('Element check:', {
        'prompt-textarea': !!promptTextarea,
        'composer-submit-button': !!submitButton,
        'composer-speech-button': !!speechButton
    });
}