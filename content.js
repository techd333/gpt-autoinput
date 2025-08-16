console.log('Content script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'inputText') {
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.value = request.text;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      const submitButton = document.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.click();
      }
    }
  }
});
