# Chrome Extensions

このリポジトリには、Chrome拡張機能のプロジェクトが含まれています。

## Chrome拡張機能の設定方法

### 1. 拡張機能をダウンロードまたはクローン

```bash
git clone https://github.com/hirokita117/chrome-extensions.git
cd chrome-extensions
```

### 2. Chromeで拡張機能を読み込む

1. Chromeブラウザを開く
2. アドレスバーに `chrome://extensions/` と入力してEnterキーを押す
   - または、メニュー（三点リーダー）→「拡張機能」→「拡張機能を管理」を選択
3. 右上の「デベロッパーモード」をオンにする
4. 「パッケージ化されていない拡張機能を読み込む」ボタンをクリック
5. 読み込みたい拡張機能のフォルダを選択（例：`contents-to-markdown`）
6. 拡張機能が読み込まれ、ツールバーにアイコンが表示されます

### 3. 拡張機能の使用方法

各拡張機能のフォルダ内のREADMEを参照してください。

### 4. 拡張機能の更新

拡張機能のコードを変更した場合：

1. `chrome://extensions/` ページを開く
2. 該当する拡張機能の「再読み込み」ボタン（🔄）をクリック

### 5. 拡張機能の削除

1. `chrome://extensions/` ページを開く
2. 削除したい拡張機能の「削除」ボタンをクリック

## 含まれる拡張機能

### Contents to Markdown

Webページの記事コンテンツをMarkdown形式に変換する拡張機能です。

詳細は `contents-to-markdown/` フォルダを参照してください。

## 開発者向け情報

### ファイル構造

```
chrome-extensions/
├── README.md
├── .gitignore
└── [拡張機能名]/
    ├── manifest.json
    ├── popup.html
    ├── popup.js
    ├── content.js
    └── ...
```

### 新しい拡張機能を追加する場合

1. 新しいフォルダを作成
2. 必要なファイル（`manifest.json` など）を配置
3. このREADMEに追加情報を記載

## ライセンス

各拡張機能のライセンスは、それぞれのフォルダ内のLICENSEファイルを参照してください。

