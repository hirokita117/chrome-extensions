(function() {
    // HTML要素をMarkdownに変換する簡易ヘルパー関数
    function htmlToMarkdown(element) {
      let md = '';
      
      // 子ノードをループ
      element.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          // テキストノード
          md += node.textContent.trim() ? node.textContent : '';
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = node.tagName.toLowerCase();
          
          switch (tagName) {
            case 'h1':
              md += `\n# ${node.textContent}\n\n`;
              break;
            case 'h2':
              md += `\n## ${node.textContent}\n\n`;
              break;
            case 'h3':
              md += `\n### ${node.textContent}\n\n`;
              break;
            case 'p':
              // 空のPタグは無視
              if (node.textContent.trim() || node.querySelector('img')) {
                 md += `${htmlToMarkdown(node)}\n\n`;
              }
              break;
            case 'a':
              md += `[${node.textContent}](${node.getAttribute('href')})`;
              break;
            case 'img':
              const src = node.getAttribute('data-src') || node.getAttribute('src');
              const alt = node.getAttribute('alt') || 'image';
              if (src) {
                md += `![${alt}](${src})`;
              }
              break;
            case 'figure':
              md += `${htmlToMarkdown(node)}\n\n`;
              break;
            case 'ul':
              node.querySelectorAll('li').forEach(li => {
                md += `- ${li.textContent.trim()}\n`;
              });
              md += '\n';
              break;
            case 'ol':
              node.querySelectorAll('li').forEach((li, index) => {
                md += `${index + 1}. ${li.textContent.trim()}\n`;
              });
              md += '\n';
              break;
            case 'blockquote':
              md += `> ${node.textContent.trim()}\n\n`;
              break;
            case 'pre':
            case 'code':
              md += `\`\`\`\n${node.textContent.trim()}\n\`\`\`\n\n`;
              break;
            case 'br':
              md += '  \n';
              break;
            case 'strong':
            case 'b':
              md += `**${node.textContent}**`;
              break;
            case 'em':
            case 'i':
              md += `*${node.textContent}*`;
              break;
            case 'div':
            case 'span':
            case 'section':
              // レイアウト用のタグは中身だけ再帰的に処理
              md += htmlToMarkdown(node);
              break;
            default:
              // その他のタグも中身を処理
              md += htmlToMarkdown(node);
          }
        }
      });
      
      return md;
    }
  
    const contentSelectors = [
      '[data-name="body"]',
      '.p-article__content',
      '.o-noteContentText',
      '.note-common-styles',
      'article.o-noteContent',
      '.o-noteContent',
      'main article',
      'article',
      '#main',
      'main'
    ];
  
    let targetElement = null;
    for (const selector of contentSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        console.log(`Found content with selector: ${selector}`); // デバッグ用ログ
        targetElement = el;
        break;
      }
    }
  
    if (!targetElement) {
      console.error('Content not found. Tried selectors:', contentSelectors);
      return null;
    }
  
    // タイトル取得ロジックも強化
    const titleSelectors = [
      '.o-noteContentHeader__title',
      '.p-article__title',
      '[data-name="title"]',
      'h1'
    ];
    
    let titleElement = null;
    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        titleElement = el;
        break;
      }
    }
  
    let resultMarkdown = '';
    if (titleElement) {
      resultMarkdown += `# ${titleElement.textContent.trim()}\n\n`;
    }
  
    // 本文変換実行
    resultMarkdown += htmlToMarkdown(targetElement);
  
    return resultMarkdown;
  })();
