document.addEventListener('DOMContentLoaded', function() {
    const generateBtn = document.getElementById('generateBtn');
    const saveArticleBtn = document.getElementById('saveArticleBtn');
    const leftToggle = document.getElementById('leftToggle');
    const rightToggle = document.getElementById('rightToggle');
    const vocabularySidebar = document.getElementById('vocabularySidebar');
    const translationSidebar = document.getElementById('translationSidebar');
    const mainContent = document.querySelector('.main-content');
    
    let currentArticle = null;
    let sidebarState = {
        left: true,
        right: true
    };

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
        if (sidebarState.left && sidebarState.right) {
            mainContent.classList.add('sidebar-active');
        } else {
            mainContent.classList.remove('sidebar-active');
        }
    }

    generateBtn.addEventListener('click', async function() {
        const category = document.getElementById('category').value;
        const wordCount = document.getElementById('wordCount').value;
        
        // Show loading state
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...';
        
        document.getElementById('articleContent').innerHTML = `
            <div class="card">
                <div class="card-body text-center">
                    <div class="loading-spinner"></div>
                    <p class="text-muted">Generating article, please wait...</p>
                </div>
            </div>
        `;
        
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
            
            // Display article with animation
            document.getElementById('articleContent').innerHTML = `
                <div class="card article-card">
                    <div class="card-body">
                        <h3 class="card-title">${currentArticle.title}</h3>
                        <div class="article-text">${data.article}</div>
                    </div>
                </div>
            `;
            
            // Display translation with animation
            document.getElementById('translation').innerHTML = `
                <div class="card">
                    <div class="card-body">
                        ${data.translation}
                    </div>
                </div>
            `;
            
            // Display vocabulary
            const wordList = document.getElementById('wordList');
            wordList.innerHTML = '';
            
            if (data.vocabulary) {
                data.vocabulary.forEach(word => {
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
                            <button class="save-btn">
                                <i class="bi bi-bookmark-plus"></i>
                            </button>
                        </div>
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
                            wordDiv.querySelector('.word-translation').innerHTML = data.translation;
                        }
                    })
                    .catch(console.error);
                    
                    // Save word button
                    wordDiv.querySelector('.save-btn').addEventListener('click', async (e) => {
                        const btn = e.currentTarget;
                        try {
                            const translation = wordDiv.querySelector('.word-translation').textContent;
                            btn.disabled = true;
                            btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
                            
                            await saveVocabulary(word, translation);
                            
                            btn.innerHTML = '<i class="bi bi-bookmark-check-fill"></i>';
                            btn.classList.add('btn-success');
                            loadSavedVocabulary();
                        } catch (error) {
                            console.error('Error saving word:', error);
                            btn.innerHTML = '<i class="bi bi-exclamation-triangle"></i>';
                            btn.classList.add('btn-danger');
                        }
                    });
                    
                    wordList.appendChild(wordDiv);
                });
            }
            
            saveArticleBtn.style.display = 'block';
            
        } catch (error) {
            console.error('Error:', error);
            document.getElementById('articleContent').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Error: ${error.message}
                </div>
            `;
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="bi bi-magic"></i> Generate Article';
        }
    });

    // Save article
    saveArticleBtn.addEventListener('click', async () => {
        if (!currentArticle) return;
        
        const btn = saveArticleBtn;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        
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
                btn.innerHTML = '<i class="bi bi-check-circle"></i> Saved Successfully';
                btn.classList.remove('btn-success');
                btn.classList.add('btn-outline-success');
                loadSavedArticles();
            } else {
                throw new Error(data.error || 'Failed to save article');
            }
        } catch (error) {
            console.error('Error saving article:', error);
            btn.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Save Failed';
            btn.classList.remove('btn-success');
            btn.classList.add('btn-danger');
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
                <div class="saved-item">
                    <h5 class="mb-1">${article.title}</h5>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">
                            <i class="bi bi-calendar"></i> ${new Date(article.created_at).toLocaleDateString()}
                        </small>
                        <span class="badge bg-secondary">${article.category}</span>
                    </div>
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
                <div class="saved-item">
                    <strong class="highlight">${word.word}</strong>
                    <div class="text-muted">${word.meaning || ''}</div>
                    <small class="text-muted">
                        <i class="bi bi-calendar"></i> ${new Date(word.created_at).toLocaleDateString()}
                    </small>
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
