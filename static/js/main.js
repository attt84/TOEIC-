let currentArticle = '';
let currentTranslation = '';
let advancedWords = [];

function generateArticle() {
    const category = document.getElementById('category').value;
    const wordCount = document.getElementById('wordCount').value;
    
    // Show loading state
    document.getElementById('articleContent').innerHTML = 'Generating article...';
    document.getElementById('translationContent').innerHTML = '';
    document.getElementById('vocabularyList').innerHTML = '';
    
    fetch('/generate_article', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            category: category,
            word_count: wordCount
        })
    })
    .then(response => response.json())
    .then(data => {
        currentArticle = data.article;
        currentTranslation = data.translation;
        advancedWords = data.advanced_words;
        
        // Display article with highlighted words
        displayArticle();
        displayTranslation();
        displayVocabulary();
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('articleContent').innerHTML = 'Error generating article. Please try again.';
    });
}

function displayArticle() {
    let articleHtml = currentArticle;
    
    // Highlight advanced words
    advancedWords.forEach(word => {
        const regex = new RegExp(`\\b${word.word}\\b`, 'gi');
        articleHtml = articleHtml.replace(regex, `<span class="highlighted-word">${word.word}<span class="word-tooltip">${word.meaning}</span></span>`);
    });
    
    document.getElementById('articleContent').innerHTML = articleHtml;
}

function displayTranslation() {
    document.getElementById('translationContent').innerHTML = currentTranslation;
}

function displayVocabulary() {
    const vocabularyHtml = advancedWords.map(word => 
        `<div class="mb-2">
            <strong>${word.word}</strong>: ${word.meaning}
        </div>`
    ).join('');
    
    document.getElementById('vocabularyList').innerHTML = vocabularyHtml;
}

function toggleVocabularySidebar() {
    const sidebar = document.querySelector('.vocabulary-sidebar');
    sidebar.classList.toggle('hidden');
    adjustMainContentMargin();
}

function toggleTranslationSidebar() {
    const sidebar = document.querySelector('.translation-sidebar');
    sidebar.classList.toggle('hidden');
    adjustMainContentMargin();
}

function adjustMainContentMargin() {
    const mainContent = document.querySelector('.main-content');
    const vocabSidebar = document.querySelector('.vocabulary-sidebar');
    const transSidebar = document.querySelector('.translation-sidebar');
    
    const vocabHidden = vocabSidebar.classList.contains('hidden');
    const transHidden = transSidebar.classList.contains('hidden');
    
    if (vocabHidden && transHidden) {
        mainContent.style.margin = '0 5%';
    } else if (vocabHidden) {
        mainContent.style.margin = '0 25% 0 5%';
    } else if (transHidden) {
        mainContent.style.margin = '0 5% 0 25%';
    } else {
        mainContent.style.margin = '0 25%';
    }
}
