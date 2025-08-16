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

async function saveFiles(files) {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const file of files) {
    const text = await file.text();
    store.put({ name: file.name, content: text });
    addFileToList(file.name, text);
  }
}

function addFileToList(name, text) {
  const list = document.getElementById('fileList');
  const container = document.createElement('div');
  container.className = 'border p-2';
  const title = document.createElement('div');
  title.className = 'font-bold';
  title.textContent = name;
  const pre = document.createElement('pre');
  pre.textContent = text;
  container.appendChild(title);
  container.appendChild(pre);
  list.appendChild(container);
}

document.getElementById('fileInput').addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  saveFiles(files);
});

(async function init() {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const req = store.getAll();
  req.onsuccess = (e) => {
    const result = e.target.result;
    result.forEach((item) => addFileToList(item.name, item.content));
  };
})();
