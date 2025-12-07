document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('convertBtn');
    const resultArea = document.getElementById('result');
    const statusDiv = document.getElementById('status');
  
    btn.addEventListener('click', async () => {
      // アクティブなタブを取得
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
      statusDiv.textContent = '変換中...';
  
      // content.js を実行して結果を受け取る
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }, (results) => {
        if (chrome.runtime.lastError || !results || !results[0]) {
          statusDiv.textContent = 'エラーが発生しました。';
          console.error(chrome.runtime.lastError);
          return;
        }
  
        const markdown = results[0].result;
        if (markdown) {
          resultArea.value = markdown;
          
          // クリップボードにコピー
          resultArea.select();
          document.execCommand('copy');
          
          statusDiv.textContent = 'コピーしました！';
          statusDiv.style.color = '#2cb696';
        } else {
          statusDiv.textContent = '記事本文が見つかりませんでした。';
          resultArea.value = '';
        }
      });
    });
  });
