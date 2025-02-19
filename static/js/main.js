document.addEventListener('DOMContentLoaded', function() {
    // UI Elements
    const generateBtn = document.getElementById('generateBtn');
    const leftToggle = document.getElementById('leftToggle');
    const rightToggle = document.getElementById('rightToggle');
    const vocabularySidebar = document.getElementById('vocabularySidebar');
    const translationSidebar = document.getElementById('translationSidebar');
    const mainContent = document.querySelector('.main-content');
    const contextMenu = document.getElementById('contextMenu');
    
    let currentArticle = null;
    let sidebarState = {
        left: true,
        right: true
    };

    // Toast notification
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastBody = toast.querySelector('.toast-body');
        toastBody.textContent = message;
        toast.classList.add(`bg-${type === 'success' ? 'success' : 'danger'}`);
        toast.classList.add('text-white');
        
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    }

    // Toggle sidebars
    leftToggle.addEventListener('click', () => {
        sidebarState.left = !sidebarState.left;
        vocabularySidebar.classList.toggle('hidden');
        updateMainContentMargin();
    });

    rightToggle.addEventListener('click', () => {
        sidebarState.right = !sidebarState.right;
        translationSidebar.classList.toggle('hidden');
        updateMainContentMargin();
    });

    function updateMainContentMargin() {
        mainContent.style.marginLeft = sidebarState.left ? '320px' : '20px';
        mainContent.style.marginRight = sidebarState.right ? '320px' : '20px';
    }

    // Article generation
    generateBtn.addEventListener('click', async function() {
        const category = document.getElementById('category').value;
        const wordCount = document.getElementById('wordCount').value;
        
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...';
        
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
            
            // Display article
            document.getElementById('articleContent').innerHTML = `
                <div class="card article-card">
                    <div class="card-body">
                        <h3 class="card-title">${currentArticle.title}</h3>
                        <div class="article-text">${data.article}</div>
                        <button class="btn btn-primary mt-3" onclick="saveCurrentArticle()">
                            <i class="bi bi-save"></i> Save Article
                        </button>
                    </div>
                </div>
            `;
            
            // Display translation
            document.getElementById('translation').innerHTML = `
                <div class="card">
                    <div class="card-body translation-text">
                        ${data.translation}
                    </div>
                </div>
            `;
            
            // Display vocabulary
            const wordList = document.getElementById('wordList');
            wordList.innerHTML = '';
            
            if (data.vocabulary) {
                const uniqueWords = [...new Set(data.vocabulary)];
                uniqueWords.forEach(word => {
                    const wordDiv = document.createElement('div');
                    wordDiv.className = 'word-item';
                    wordDiv.innerHTML = `
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <strong class="highlight">${word}</strong>
                                <div class="word-translation">
                                    <div class="spinner-border spinner-border-sm text-secondary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            </div>
                            <button class="btn btn-sm btn-outline-primary save-word-btn">
                                <i class="bi bi-bookmark-plus"></i>
                            </button>
                        </div>
                    `;
                    
                    // Word click handler
                    wordDiv.querySelector('.highlight').addEventListener('click', () => {
                        const articleText = document.querySelector('.article-text');
                        clearHighlights(articleText);
                        highlightText(articleText, word);
                    });
                    
                    // Save word button handler
                    wordDiv.querySelector('.save-word-btn').addEventListener('click', async (e) => {
                        const btn = e.currentTarget;
                        try {
                            const translation = wordDiv.querySelector('.word-translation').textContent;
                            btn.disabled = true;
                            btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
                            
                            // Get example sentence
                            const example = findExampleSentence(word, currentArticle.content);
                            
                            await saveVocabulary(word, translation, example);
                            
                            btn.innerHTML = '<i class="bi bi-bookmark-check-fill"></i>';
                            btn.classList.add('btn-success');
                            loadSavedVocabulary();
                            showToast(`単語「${word}」を保存しました`);
                        } catch (error) {
                            console.error('Error saving word:', error);
                            btn.innerHTML = '<i class="bi bi-exclamation-triangle"></i>';
                            btn.classList.add('btn-danger');
                            showToast(`単語の保存に失敗しました: ${error.message}`, 'error');
                        }
                    });
                    
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
                            wordDiv.querySelector('.word-translation').innerHTML = data.translation;
                        }
                    })
                    .catch(console.error);
                    
                    wordList.appendChild(wordDiv);
                });
            }
            
        } catch (error) {
            console.error('Error generating article:', error);
            showToast(`記事の生成に失敗しました: ${error.message}`, 'error');
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="bi bi-magic"></i> Generate Article';
        }
    });

    // Text selection and grammar analysis
    document.addEventListener('mouseup', function(e) {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText && !contextMenu.contains(e.target)) {
            contextMenu.style.display = 'block';
            contextMenu.style.left = `${e.pageX}px`;
            contextMenu.style.top = `${e.pageY}px`;
            
            // Grammar analysis handler
            contextMenu.querySelector('.analyze-grammar').onclick = async () => {
                try {
                    const analysis = await analyzeGrammar(selectedText);
                    if (analysis) {
                        showGrammarNote(analysis);
                        showToast('文法解析が完了しました');
                    }
                } catch (error) {
                    console.error('Grammar analysis error:', error);
                    showToast('文法解析に失敗しました', 'error');
                }
                contextMenu.style.display = 'none';
            };
        } else {
            contextMenu.style.display = 'none';
        }
    });

    // Helper functions
    function findExampleSentence(word, text) {
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
        return sentences.find(sentence => 
            sentence.toLowerCase().includes(word.toLowerCase())
        ) || '';
    }

    function clearHighlights(element) {
        element.innerHTML = element.innerHTML.replace(/<span class="highlight-text">|<\/span>/g, '');
    }

    function highlightText(element, text) {
        const content = element.innerHTML;
        const regex = new RegExp(`(${text})`, 'gi');
        element.innerHTML = content.replace(regex, '<span class="highlight-text">$1</span>');
    }

    // Load initial data
    loadSavedVocabulary();
    loadSavedArticles();
    loadSavedGrammarNotes();
});

// Save current article
async function saveCurrentArticle() {
    if (!currentArticle) return;
    
    try {
        const response = await fetch('/save_article', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(currentArticle)
        });
        
        if (response.ok) {
            showToast('記事を保存しました');
            loadSavedArticles();
        } else {
            throw new Error('Failed to save article');
        }
    } catch (error) {
        console.error('Error saving article:', error);
        showToast('記事の保存に失敗しました', 'error');
    }
}

// Load saved articles
async function loadSavedArticles() {
    try {
        const response = await fetch('/get_saved_articles');
        const articles = await response.json();
        
        const container = document.getElementById('savedArticlesList');
        container.innerHTML = '';
        
        articles.forEach(article => {
            const articleElement = document.createElement('div');
            articleElement.className = 'saved-article-item';
            articleElement.innerHTML = `
                <h5>${article.title}</h5>
                <div class="text-muted small">
                    <i class="bi bi-calendar"></i> ${new Date(article.created_at).toLocaleDateString()}
                    <span class="ms-2"><i class="bi bi-tag"></i> ${article.category}</span>
                </div>
            `;
            
            // Click handler to load saved article
            articleElement.addEventListener('click', () => {
                document.getElementById('articleContent').innerHTML = `
                    <div class="card article-card">
                        <div class="card-body">
                            <h3 class="card-title">${article.title}</h3>
                            <div class="article-text">${article.content}</div>
                        </div>
                    </div>
                `;
                
                document.getElementById('translation').innerHTML = `
                    <div class="card">
                        <div class="card-body translation-text">
                            ${article.translation}
                        </div>
                    </div>
                `;
            });
            
            container.appendChild(articleElement);
        });
    } catch (error) {
        console.error('Error loading saved articles:', error);
    }
}

// Save vocabulary
async function saveVocabulary(word, meaning, example = '') {
    try {
        const response = await fetch('/save_vocabulary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                word,
                meaning,
                example,
                article_id: currentArticle?.id
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save vocabulary');
        }
    } catch (error) {
        console.error('Error saving vocabulary:', error);
        throw error;
    }
}

// Load saved vocabulary
async function loadSavedVocabulary() {
    try {
        const response = await fetch('/get_saved_vocabulary');
        const vocab = await response.json();
        
        const container = document.getElementById('savedWordList');
        container.innerHTML = '';
        
        vocab.forEach(word => {
            const wordElement = document.createElement('div');
            wordElement.className = 'word-item';
            wordElement.innerHTML = `
                <strong class="highlight">${word.word}</strong>
                <div class="word-translation">${word.meaning}</div>
                ${word.example ? `<div class="word-example">${word.example}</div>` : ''}
                <div class="text-muted small">${new Date(word.created_at).toLocaleDateString()}</div>
            `;
            
            // Click handler to highlight word in article
            wordElement.querySelector('.highlight').addEventListener('click', () => {
                const articleText = document.querySelector('.article-text');
                if (articleText) {
                    clearHighlights(articleText);
                    highlightText(articleText, word.word);
                }
            });
            
            container.appendChild(wordElement);
        });
    } catch (error) {
        console.error('Error loading saved vocabulary:', error);
    }
}
