const allowedUrlPattern = /^https:\/\/chatgpt\.com/;

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    updatePopup(tabId, tab.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete" && tab.url) {
    updatePopup(tabId, tab.url);
  }
});

function updatePopup(tabId, url) {
  const isAllowed = allowedUrlPattern.test(url);

  chrome.action.setPopup({
    tabId: tabId,
    popup: isAllowed ? "popup.html" : ""
  });

  chrome.action.setTitle({
    tabId: tabId,
    title: isAllowed ? "拡張機能を使用できます" : "このページでは使用できません"
  });
}
