document.addEventListener('DOMContentLoaded', function() {
    const generateBtn = document.getElementById('generateBtn');
    const saveArticleBtn = document.getElementById('saveArticleBtn');
    const leftToggle = document.getElementById('leftToggle');
    const rightToggle = document.getElementById('rightToggle');
    const vocabularySidebar = document.getElementById('vocabularySidebar');
    const translationSidebar = document.getElementById('translationSidebar');
    
    let currentArticle = null;

    // Toggle sidebars
    leftToggle.addEventListener('click', () => {
        vocabularySidebar.classList.toggle('hidden');
    });

    rightToggle.addEventListener('click', () => {
        translationSidebar.classList.toggle('hidden');
    });

    generateBtn.addEventListener('click', async function() {
        const category = document.getElementById('category').value;
        const wordCount = document.getElementById('wordCount').value;
        
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';
        
        try {
            const response = await fetch('/generate_article', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ category, word_count: wordCount })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            currentArticle = {
                title: data.title || 'Generated Article',
                content: data.article,
                translation: data.translation,
                category: category
            };
            
            document.getElementById('articleContent').innerHTML = `
                <h2>${currentArticle.title}</h2>
                <div class="article-text">${data.article}</div>
            `;
            
            document.getElementById('translation').innerHTML = data.translation;
            
            // Display vocabulary
            const wordList = document.getElementById('wordList');
            wordList.innerHTML = '';
            
            if (data.vocabulary) {
                data.vocabulary.forEach(word => {
                    const wordDiv = document.createElement('div');
                    wordDiv.className = 'word-item';
                    wordDiv.innerHTML = `
                        <strong>${word}</strong>
                        <div class="word-translation"></div>
                        <button class="btn btn-sm btn-outline-primary save-word-btn">Save</button>
                    `;
                    
                    // Translate word
                    fetch('/translate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ text: word })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.translation) {
                            wordDiv.querySelector('.word-translation').textContent = data.translation;
                        }
                    })
                    .catch(console.error);
                    
                    // Save word button
                    wordDiv.querySelector('.save-word-btn').addEventListener('click', async () => {
                        try {
                            const translation = wordDiv.querySelector('.word-translation').textContent;
                            await saveVocabulary(word, translation);
                            alert('Word saved successfully!');
                            loadSavedVocabulary();
                        } catch (error) {
                            console.error('Error saving word:', error);
                            alert('Failed to save word');
                        }
                    });
                    
                    wordList.appendChild(wordDiv);
                });
            }
            
            saveArticleBtn.style.display = 'block';
            
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('articleContent').innerHTML = `
                <div class="alert alert-danger">Error: ${error.message}</div>
            `;
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Article';
        }
    });

    // Save article
    saveArticleBtn.addEventListener('click', async () => {
        if (!currentArticle) return;
        
        try {
            const response = await fetch('/save_article', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(currentArticle)
            });
            
            const data = await response.json();
            if (data.success) {
                alert('Article saved successfully!');
                loadSavedArticles();
            } else {
                throw new Error(data.error || 'Failed to save article');
            }
        } catch (error) {
            console.error('Error saving article:', error);
            alert('Failed to save article');
        }
    });

    // Save vocabulary
    async function saveVocabulary(word, meaning) {
        const response = await fetch('/save_vocabulary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                word,
                meaning,
                article_id: currentArticle ? currentArticle.id : null
            })
        });
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to save vocabulary');
        }
    }

    // Load saved articles
    async function loadSavedArticles() {
        try {
            const response = await fetch('/get_saved_articles');
            const articles = await response.json();
            
            const savedArticleList = document.getElementById('savedArticleList');
            savedArticleList.innerHTML = articles.map(article => `
                <div class="saved-article">
                    <h5>${article.title}</h5>
                    <small>${new Date(article.created_at).toLocaleDateString()}</small>
                    <div>${article.category}</div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading saved articles:', error);
        }
    }

    // Load saved vocabulary
    async function loadSavedVocabulary() {
        try {
            const response = await fetch('/get_saved_vocabulary');
            const vocabulary = await response.json();
            
            const savedWordList = document.getElementById('savedWordList');
            savedWordList.innerHTML = vocabulary.map(word => `
                <div class="saved-word">
                    <strong>${word.word}</strong>
                    <div>${word.meaning || ''}</div>
                    <small>${new Date(word.created_at).toLocaleDateString()}</small>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading saved vocabulary:', error);
        }
    }

    // Initial load of saved items
    loadSavedArticles();
    loadSavedVocabulary();
});
