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
    article_id = db.Column(db.Integer, db.ForeignKey('saved_article.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

with app.app_context():
    db.create_all()

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
            'advanced_words': advanced_words
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
            article_id=data.get('article_id')
        )
        db.session.add(vocab)
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
        'article_id': v.article_id,
        'created_at': v.created_at.isoformat()
    } for v in vocab])

if __name__ == '__main__':
    app.run(debug=True)
