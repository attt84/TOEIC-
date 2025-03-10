from flask import Flask, request, jsonify, render_template
from newsapi import NewsApiClient
import google.generativeai as genai
import os
from dotenv import load_dotenv
import spacy
import nltk
from nltk.corpus import words
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
import json

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///toeic_news.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Initialize APIs
newsapi = NewsApiClient(api_key=os.getenv('NEWS_API_KEY'))
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
model = genai.GenerativeModel('gemini-pro')

# Download required NLTK data
nltk.download('words')
english_words = set(words.words())

# Load spaCy model for CEFR level analysis
nlp = spacy.load('en_core_web_sm')

# News API category mapping
CATEGORY_MAPPING = {
    'technology': 'technology',
    'politics': 'general',  # News API doesn't have a specific politics category
    'business': 'business',
    'science': 'science'
}

WORD_COUNTS = {
    '200': 200,
    '300': 300,
    '500': 500
}

class SavedArticle(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    translation = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class SavedVocabulary(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    word = db.Column(db.String(100), nullable=False)
    meaning = db.Column(db.String(200))
    example = db.Column(db.Text)  # 例文を保存
    article_id = db.Column(db.Integer, db.ForeignKey('saved_article.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class GrammarNote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sentence = db.Column(db.Text, nullable=False)
    grammar_point = db.Column(db.Text, nullable=False)
    explanation = db.Column(db.Text, nullable=False)
    article_id = db.Column(db.Integer, db.ForeignKey('saved_article.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

with app.app_context():
    db.drop_all()  # 既存のテーブルを削除
    db.create_all()  # 新しいテーブルを作成

def get_cefr_level(word):
    # This is a simplified version. In production, you would want to use a proper CEFR word list
    # For now, we'll consider longer words and less common words as more advanced
    if len(word) > 8 and word.lower() in english_words:
        return 'B2+'
    return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate_article', methods=['POST'])
def generate_article():
    try:
        data = request.json
        category = data.get('category', 'technology')
        word_count = int(data.get('word_count', 300))
        
        # Map the frontend category to News API category
        news_api_category = CATEGORY_MAPPING.get(category, 'general')
        
        # Get news from News API
        try:
            news = newsapi.get_top_headlines(category=news_api_category, language='en', page_size=5)
            
            if not news['articles']:
                return jsonify({'error': f'No news found for the category: {category}'}), 404
        except Exception as e:
            print(f"News API Error: {str(e)}")
            return jsonify({'error': f'Error fetching news: {str(e)}'}), 500
        
        # Generate article using Gemini
        latest_news = news['articles'][0]
        prompt = f"""
        Based on this news: "{latest_news['title']} - {latest_news['description']}"
        Write a TOEIC preparation article in {word_count} words.
        Include advanced vocabulary suitable for TOEIC.
        Focus on business and professional context.
        """
        
        try:
            response = model.generate_content(prompt)
            article_text = response.text
        except Exception as e:
            print(f"Gemini API Error: {str(e)}")
            # Fallback: Use the original news article with some modifications
            article_text = f"""
            {latest_news['title']}

            {latest_news['description']}

            {latest_news.get('content', '')}

            Note: This is the original news article as our AI article generator is currently unavailable. 
            Please try again later for AI-generated TOEIC-focused content.
            """
        
        # Analyze text for CEFR B2+ words
        doc = nlp(article_text)
        advanced_words = []
        for token in doc:
            if token.is_alpha and len(token.text) > 3:
                level = get_cefr_level(token.text)
                if level == 'B2+':
                    advanced_words.append({
                        'word': token.text,
                        'meaning': '...'  # In production, integrate with a dictionary API
                    })
        
        # Generate Japanese translation
        translation_prompt = f"Translate this English text to natural Japanese: {article_text}"
        try:
            translation_response = model.generate_content(translation_prompt)
            translation_text = translation_response.text
        except Exception as e:
            print(f"Translation Error: {str(e)}")
            translation_text = "申し訳ありませんが、現在翻訳サービスが利用できません。後ほど再度お試しください。"
        
        return jsonify({
            'article': article_text,
            'translation': translation_text,
            'vocabulary': [word['word'] for word in advanced_words]
        })
        
    except Exception as e:
        print(f"General Error: {str(e)}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@app.route('/save_article', methods=['POST'])
def save_article():
    try:
        data = request.json
        article = SavedArticle(
            title=data['title'],
            content=data['content'],
            translation=data['translation'],
            category=data['category']
        )
        db.session.add(article)
        db.session.commit()
        return jsonify({'success': True, 'id': article.id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/save_vocabulary', methods=['POST'])
def save_vocabulary():
    try:
        data = request.json
        vocab = SavedVocabulary(
            word=data['word'],
            meaning=data['meaning'],
            example=data.get('example', ''),  # デフォルト値を空文字列に設定
            article_id=data.get('article_id')
        )
        db.session.add(vocab)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/save_grammar_note', methods=['POST'])
def save_grammar_note():
    try:
        data = request.json
        note = GrammarNote(
            sentence=data['sentence'],
            grammar_point=data['grammar_point'],
            explanation=data['explanation'],
            article_id=data.get('article_id')
        )
        db.session.add(note)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_saved_articles', methods=['GET'])
def get_saved_articles():
    articles = SavedArticle.query.order_by(SavedArticle.created_at.desc()).all()
    return jsonify([{
        'id': a.id,
        'title': a.title,
        'category': a.category,
        'created_at': a.created_at.isoformat()
    } for a in articles])

@app.route('/get_saved_vocabulary', methods=['GET'])
def get_saved_vocabulary():
    vocab = SavedVocabulary.query.order_by(SavedVocabulary.created_at.desc()).all()
    return jsonify([{
        'id': v.id,
        'word': v.word,
        'meaning': v.meaning,
        'example': v.example or '',  # Noneの場合は空文字列を返す
        'article_id': v.article_id,
        'created_at': v.created_at.isoformat()
    } for v in vocab])

@app.route('/get_saved_grammar_notes', methods=['GET'])
def get_saved_grammar_notes():
    notes = GrammarNote.query.order_by(GrammarNote.created_at.desc()).all()
    return jsonify([{
        'id': n.id,
        'sentence': n.sentence,
        'grammar_point': n.grammar_point,
        'explanation': n.explanation,
        'article_id': n.article_id,
        'created_at': n.created_at.isoformat()
    } for n in notes])

@app.route('/translate', methods=['POST'])
def translate():
    try:
        data = request.json
        text = data.get('text', '')
        
        # Generate Japanese translation
        translation_prompt = f"Translate this English word or phrase to natural Japanese: {text}"
        try:
            translation_response = model.generate_content(translation_prompt)
            translation_text = translation_response.text
        except Exception as e:
            print(f"Translation Error: {str(e)}")
            translation_text = "翻訳エラー"
        
        return jsonify({
            'translation': translation_text
        })
        
    except Exception as e:
        print(f"General Error: {str(e)}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@app.route('/analyze_grammar', methods=['POST'])
def analyze_grammar():
    try:
        data = request.json
        text = data.get('text', '')
        
        # Gemini APIを使用して文法解析
        analysis_prompt = f"""
        Analyze the following English sentence for TOEIC study:
        "{text}"
        
        Provide a detailed explanation in Japanese including:
        1. Grammar points used
        2. Sentence structure
        3. Key expressions and their usage
        4. TOEIC test-taking tips related to this grammar
        
        Format the response as a JSON with these fields:
        - grammar_point: Main grammar point title
        - explanation: Detailed explanation
        """
        
        try:
            response = model.generate_content(analysis_prompt)
            analysis = response.text
            
            # レスポンスをJSONとしてパース
            try:
                analysis_json = json.loads(analysis)
            except:
                # JSONパースに失敗した場合は、シンプルな形式で返す
                analysis_json = {
                    'grammar_point': '文法ポイント',
                    'explanation': analysis
                }
            
            analysis_json['sentence'] = text
            return jsonify(analysis_json)
            
        except Exception as e:
            print(f"Grammar Analysis Error: {str(e)}")
            return jsonify({
                'sentence': text,
                'grammar_point': 'エラー',
                'explanation': '文法解析中にエラーが発生しました。'
            }), 500
            
    except Exception as e:
        print(f"General Error: {str(e)}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True)
