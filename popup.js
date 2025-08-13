// popup.js: チェックボックスと content.js の tfap-window 表示状態を連動
document.addEventListener('DOMContentLoaded', function() {
    const toggle = document.getElementById('toggleTfapWindow');
    if (toggle) {
        // タブに現在の表示状態を問い合わせる
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(
                tabs[0].id,
                { action: 'getTfapWindowState' },
                function(response) {
                    // content.js から state を取得
                    if (response && typeof response.state === 'string') {
                        toggle.checked = response.state === 'visible';
                    }
                }
            );
        });

        toggle.addEventListener('change', function() {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                chrome.tabs.sendMessage(
                    tabs[0].id,
                    { action: 'toggleTfapWindow', checked: toggle.checked },
                    function(response) {
                        // 必要ならレスポンス処理
                    }
                );
            });
        });
    }
});
