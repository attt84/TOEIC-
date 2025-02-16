from flask import Flask, render_template, request, jsonify
import os
from dotenv import load_dotenv
import google.generativeai as genai
from newsapi import NewsApiClient
import json
import spacy
import nltk
from nltk.corpus import words

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Initialize APIs
newsapi = NewsApiClient(api_key=os.getenv('NEWS_API_KEY'))
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
model = genai.GenerativeModel('gemini-pro')

# Download required NLTK data
nltk.download('words')
english_words = set(words.words())

# Load spaCy model for CEFR level analysis
nlp = spacy.load('en_core_web_sm')

CATEGORIES = {
    'technology': 'technology',
    'politics': 'politics',
    'business': 'business',
    'science': 'science'
}

WORD_COUNTS = {
    '200': 200,
    '300': 300,
    '500': 500
}

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
        
        # Get news from News API
        try:
            news = newsapi.get_top_headlines(category=category, language='en', page_size=5)
            
            if not news['articles']:
                return jsonify({'error': 'No news found for the selected category'}), 404
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

if __name__ == '__main__':
    app.run(debug=True)
