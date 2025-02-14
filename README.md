# TOEIC News Study App

このアプリケーションは、最新のニュースを活用してTOEIC学習をサポートする Web アプリケーションです。

## 主な機能

- 最新ニュースの自動取得と英語記事生成
- 記事の長さを選択可能（200/300/500単語）
- 4つのジャンル（IT/政治/経済/サイエンス）から選択可能
- CEFR B2以上の単語のハイライトと意味表示
- 日本語訳の表示（サイドバーで簡単に切り替え可能）
- マウスオーバーで単語の意味を表示

## セットアップ方法

1. 必要なパッケージのインストール:
```bash
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

2. 環境変数の設定:
- `.env.example` を `.env` にコピー
- News API キーを取得: https://newsapi.org/
- Gemini API キーを取得: https://makersuite.google.com/
- `.env` ファイルに API キーを設定

3. アプリケーションの起動:
```bash
python app.py
```

## 使用している主なテクノロジー

- Flask (Webフレームワーク)
- News API (ニュース取得)
- Google Gemini API (テキスト生成)
- spaCy (自然言語処理)
- NLTK (単語分析)
- Bootstrap (UIフレームワーク)
