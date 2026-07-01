import { useState, useEffect, useRef } from 'react';

function App() {
  const [bibleStructure, setBibleStructure] = useState({});
  const [activeBook, setActiveBook] = useState("");
  const [activeChapter, setActiveChapter] = useState("");
  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Parallel Reader states
  const [showParallel, setShowParallel] = useState(false);
  const [parallelTranslation, setParallelTranslation] = useState("kjv");
  const [parallelVerses, setParallelVerses] = useState([]);
  const [parallelLoading, setParallelLoading] = useState(false);

  // Modal interaction states
  const [modalWord, setModalWord] = useState(null);
  const [modalWordInfo, setModalWordInfo] = useState(null); // stores { verse: verseNum, index: wordIdx }
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalStrongsEntry, setModalStrongsEntry] = useState(null);

  // Strong's Dictionary lookup cache
  const [strongsDict, setStrongsDict] = useState(null);
  const isFetchingDict = useRef(false);

  // Concordance Search states
  const [isConcordanceOpen, setIsConcordanceOpen] = useState(false);
  const [concordanceSearchKey, setConcordanceSearchKey] = useState("");
  const [concordanceResults, setConcordanceResults] = useState([]);
  const [concordanceIndex, setConcordanceIndex] = useState(null);
  const [selectedWordHighlight, setSelectedWordHighlight] = useState(null);

  // Display Preference and Themes states (persisted in local storage)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('pref_theme') || 'dark';
  });
  const [showOriginal, setShowOriginal] = useState(() => {
    const val = localStorage.getItem('pref_showOriginal');
    return val !== null ? JSON.parse(val) : true;
  });
  const [showTranslit, setShowTranslit] = useState(() => {
    const val = localStorage.getItem('pref_showTranslit');
    return val !== null ? JSON.parse(val) : true;
  });
  const [showGloss, setShowGloss] = useState(() => {
    const val = localStorage.getItem('pref_showGloss');
    return val !== null ? JSON.parse(val) : true;
  });
  const [fontSizeOriginal, setFontSizeOriginal] = useState(() => {
    const val = localStorage.getItem('pref_fontSizeOriginal');
    return val !== null ? parseFloat(val) : 1.45;
  });
  const [fontSizeTranslit, setFontSizeTranslit] = useState(() => {
    const val = localStorage.getItem('pref_fontSizeTranslit');
    return val !== null ? parseFloat(val) : 0.95;
  });
  const [fontSizeGloss, setFontSizeGloss] = useState(() => {
    const val = localStorage.getItem('pref_fontSizeGloss');
    return val !== null ? parseFloat(val) : 1.1;
  });

  // Active Study states (Highlights, Notes, Bookmarks)
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [activeNoteEditors, setActiveNoteEditors] = useState({}); // track open textarea UI panels (verseNum: boolean)
  
  const [bookmarks, setBookmarks] = useState(() => {
    const val = localStorage.getItem('study_bookmarks');
    return val !== null ? JSON.parse(val) : [];
  });
  const [verseHighlights, setVerseHighlights] = useState(() => {
    const val = localStorage.getItem('study_highlights_verses');
    return val !== null ? JSON.parse(val) : {};
  });
  const [wordHighlights, setWordHighlights] = useState(() => {
    const val = localStorage.getItem('study_highlights_words');
    return val !== null ? JSON.parse(val) : {};
  });
  const [notes, setNotes] = useState(() => {
    const val = localStorage.getItem('study_notes');
    return val !== null ? JSON.parse(val) : {};
  });

  // Sync settings updates to localStorage
  useEffect(() => {
    localStorage.setItem('pref_theme', theme);
    document.body.className = ''; // Reset
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('pref_showOriginal', JSON.stringify(showOriginal));
  }, [showOriginal]);

  useEffect(() => {
    localStorage.setItem('pref_showTranslit', JSON.stringify(showTranslit));
  }, [showTranslit]);

  useEffect(() => {
    localStorage.setItem('pref_showGloss', JSON.stringify(showGloss));
  }, [showGloss]);

  useEffect(() => {
    localStorage.setItem('pref_fontSizeOriginal', fontSizeOriginal.toString());
  }, [fontSizeOriginal]);

  useEffect(() => {
    localStorage.setItem('pref_fontSizeTranslit', fontSizeTranslit.toString());
  }, [fontSizeTranslit]);

  useEffect(() => {
    localStorage.setItem('pref_fontSizeGloss', fontSizeGloss.toString());
  }, [fontSizeGloss]);

  // Sync study updates to localStorage
  useEffect(() => {
    localStorage.setItem('study_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('study_highlights_verses', JSON.stringify(verseHighlights));
  }, [verseHighlights]);

  useEffect(() => {
    localStorage.setItem('study_highlights_words', JSON.stringify(wordHighlights));
  }, [wordHighlights]);

  useEffect(() => {
    localStorage.setItem('study_notes', JSON.stringify(notes));
  }, [notes]);

  // 1. Fetch dynamic Bible structure configuration on startup
  useEffect(() => {
    fetch('/bibles/structure.json')
      .then(res => {
        if (!res.ok) throw new Error('Could not load Bible structure index.');
        return res.json();
      })
      .then(data => {
        setBibleStructure(data);
      })
      .catch(err => {
        console.error('Error loading Bible structure:', err);
        setError('Failed to load Bible structure index. Please run the compilation script.');
      });
  }, []);

  // 2. Client-Side Hash Routing Effect
  useEffect(() => {
    if (Object.keys(bibleStructure).length === 0) return;

    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/^#\/([^\/]+)\/([^\/]+)$/);

      if (match) {
        const parsedBook = decodeURIComponent(match[1]);
        const parsedChapter = decodeURIComponent(match[2]);

        if (bibleStructure[parsedBook] && bibleStructure[parsedBook].chapters.includes(parsedChapter)) {
          setActiveBook(parsedBook);
          setActiveChapter(parsedChapter);
          return;
        }
      }

      // Default redirect to first book (Genesis)
      const firstBook = Object.keys(bibleStructure)[0];
      if (firstBook) {
        window.location.hash = `/${firstBook}/1`;
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Initial route handling
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [bibleStructure]);

  // 3. Fetch active chapter content effect (Telugu Interlinear)
  useEffect(() => {
    if (Object.keys(bibleStructure).length === 0 || !activeBook || !activeChapter) return;

    const bookInfo = bibleStructure[activeBook];
    if (!bookInfo) return;

    const chapNum = parseInt(activeChapter);
    let fileName = `${chapNum.toString().padStart(2, '0')}.json`;
    
    // Support John 1 legacy override: 01_John.json
    if (activeBook === "John" && chapNum === 1) {
      fileName = "01_John.json";
    }

    const filePath = `/${bookInfo.folder}/${fileName}`;

    setLoading(true);
    setError(null);

    fetch(filePath)
      .then(res => {
        if (!res.ok) throw new Error(`Could not load ${filePath}`);
        return res.json();
      })
      .then(data => {
        let parsedVerses = [];
        if (data.data) {
          parsedVerses = data.data;
        } else if (data.chapters && data.chapters[0] && data.chapters[0].verses) {
          parsedVerses = data.chapters[0].verses;
        } else if (data.verses) {
          parsedVerses = data.verses;
        }
        setVerses(parsedVerses);
        setLoading(false);
        // Reset local note textareas expand state on chapter change
        setActiveNoteEditors({});
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [bibleStructure, activeBook, activeChapter]);

  // 4. Fetch Parallel Translation Effect
  useEffect(() => {
    if (!showParallel || !activeBook || !activeChapter || Object.keys(bibleStructure).length === 0) {
      setParallelVerses([]);
      return;
    }

    // Only load English assets if KJV, WEB, or 3-Pane is selected
    const needsEnglishFetch = parallelTranslation === "kjv" || parallelTranslation === "web" || parallelTranslation === "three-column";
    if (!needsEnglishFetch) {
      setParallelVerses([]);
      return;
    }

    const bookInfo = bibleStructure[activeBook];
    if (!bookInfo) return;

    const chapNum = parseInt(activeChapter);
    const fileName = `${chapNum.toString().padStart(2, '0')}.json`;

    // In 3-Pane layout, English column defaults to KJV
    const targetTranslation = parallelTranslation === "three-column" ? "kjv" : parallelTranslation;

    // Fetch from local folder served statically
    const url = `/bibles/english/${targetTranslation.toUpperCase()}/${activeBook}/${fileName}`;

    setParallelLoading(true);

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Could not fetch parallel translation.');
        return res.json();
      })
      .then(data => {
        setParallelVerses(data.verses || []);
        setParallelLoading(false);
      })
      .catch(err => {
        console.error(err);
        setParallelLoading(false);
      });
  }, [showParallel, bibleStructure, activeBook, activeChapter, parallelTranslation]);

  // 5. Modal Keydown Listener (Escape key)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        setIsConcordanceOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 6. Highlight Timeout cleanup effect
  useEffect(() => {
    if (selectedWordHighlight) {
      const timer = setTimeout(() => {
        setSelectedWordHighlight(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [selectedWordHighlight]);

  // Sync select input changes back to Hash route
  const handleBookChange = (e) => {
    const book = e.target.value;
    window.location.hash = `/${book}/1`;
  };

  const handleChapterChange = (e) => {
    const chapter = e.target.value;
    window.location.hash = `/${activeBook}/${chapter}`;
  };

  // Open Strong's Concordance Details Modal
  const handleWordClick = (word, verseNum, wordIdx) => {
    setModalWord(word);
    setModalWordInfo({ verse: verseNum, index: wordIdx });
    setModalError(null);
    const strongsId = word.strongs || '';

    if (!strongsId) {
      setModalStrongsEntry(null);
      setModalLoading(false);
      return;
    }

    if (strongsDict) {
      setModalStrongsEntry(strongsDict[strongsId] || null);
      setModalLoading(false);
    } else {
      setModalLoading(true);
      setModalStrongsEntry(null);

      if (!isFetchingDict.current) {
        isFetchingDict.current = true;
        fetch('/strongs.json')
          .then(res => {
            if (!res.ok) throw new Error('Could not fetch Strong\'s definitions.');
            return res.json();
          })
          .then(data => {
            const dict = {};
            data.forEach(entry => {
              if (entry.number) {
                dict[entry.number] = entry;
              }
            });
            setStrongsDict(dict);
            setModalStrongsEntry(dict[strongsId] || null);
            setModalLoading(false);
            isFetchingDict.current = false;
          })
          .catch(err => {
            console.error(err);
            setModalError(err.message);
            setModalLoading(false);
            isFetchingDict.current = false;
          });
      }
    }
  };

  // Trigger Concordance search for occurrences
  const handleSearchOccurrences = (lemmaKey) => {
    closeModal();
    setConcordanceSearchKey(lemmaKey);
    setIsConcordanceOpen(true);

    if (concordanceIndex) {
      setConcordanceResults(concordanceIndex[lemmaKey] || []);
    } else {
      setParallelLoading(true);
      fetch('/bibles/concordance.json')
        .then(res => {
          if (!res.ok) throw new Error("Could not load concordance index.");
          return res.json();
        })
        .then(data => {
          setConcordanceIndex(data);
          setConcordanceResults(data[lemmaKey] || []);
          setParallelLoading(false);
        })
        .catch(err => {
          console.error(err);
          setParallelLoading(false);
        });
    }
  };

  const handleOccurrenceClick = (book, chap, verse, originalWord) => {
    setIsConcordanceOpen(false);
    setSelectedWordHighlight({ verse, original: originalWord });
    window.location.hash = `/${book}/${chap}`;
  };

  const isWordHighlightedInModal = () => {
    if (!modalWordInfo) return false;
    const key = `${activeBook}/${activeChapter}/${modalWordInfo.verse}`;
    return wordHighlights[key]?.includes(modalWordInfo.index) || false;
  };

  const toggleWordHighlightInModal = () => {
    if (!modalWordInfo) return;
    const key = `${activeBook}/${activeChapter}/${modalWordInfo.verse}`;
    const currentList = wordHighlights[key] || [];
    let newList;
    if (currentList.includes(modalWordInfo.index)) {
      newList = currentList.filter(idx => idx !== modalWordInfo.index);
    } else {
      newList = [...currentList, modalWordInfo.index];
    }
    setWordHighlights({ ...wordHighlights, [key]: newList });
  };

  // Star / Bookmark toggler
  const toggleBookmark = (book, chap, verse) => {
    const isSaved = bookmarks.some(bm => bm.book === book && bm.chapter === chap && bm.verse === verse);
    if (isSaved) {
      setBookmarks(bookmarks.filter(bm => !(bm.book === book && bm.chapter === chap && bm.verse === verse)));
    } else {
      setBookmarks([...bookmarks, { book, chapter: chap, verse }]);
    }
  };

  const isBookmarked = (verseNum) => {
    return bookmarks.some(bm => bm.book === activeBook && bm.chapter === activeChapter && bm.verse === verseNum);
  };

  // Full Verse Highlight toggler
  const toggleVerseHighlight = (verseNum) => {
    const key = `${activeBook}/${activeChapter}`;
    const currentList = verseHighlights[key] || [];
    let newList;
    if (currentList.includes(verseNum)) {
      newList = currentList.filter(v => v !== verseNum);
    } else {
      newList = [...currentList, verseNum];
    }
    setVerseHighlights({ ...verseHighlights, [key]: newList });
  };

  const isVerseHighlighted = (verseNum) => {
    const key = `${activeBook}/${activeChapter}`;
    return verseHighlights[key]?.includes(verseNum) || false;
  };

  // Study Notes editor handler
  const toggleNoteEditor = (verseNum) => {
    setActiveNoteEditors({
      ...activeNoteEditors,
      [verseNum]: !activeNoteEditors[verseNum]
    });
  };

  const saveNote = (verseNum, text) => {
    const key = `${activeBook}/${activeChapter}/${verseNum}`;
    setNotes({
      ...notes,
      [key]: text
    });
  };

  const hasNoteContent = (verseNum) => {
    const key = `${activeBook}/${activeChapter}/${verseNum}`;
    return !!notes[key];
  };

  const handleBookmarkClick = (bm) => {
    setIsBookmarksOpen(false);
    window.location.hash = `/${bm.book}/${bm.chapter}`;
    // Highlight coordinate temporarily
    setSelectedWordHighlight({ verse: bm.verse, original: '' });
  };

  const isSearchResultHighlighted = (verseNum, word) => {
    if (!selectedWordHighlight) return false;
    const isVerseMatch = selectedWordHighlight.verse === verseNum;
    if (!selectedWordHighlight.original) {
      return isVerseMatch;
    }
    const targetWord = word.hb || word.original || '';
    const isWordMatch = selectedWordHighlight.original === targetWord;
    return isVerseMatch && isWordMatch;
  };

  const isWordCustomHighlighted = (verseNum, wordIdx) => {
    const key = `${activeBook}/${activeChapter}/${verseNum}`;
    return wordHighlights[key]?.includes(wordIdx) || false;
  };

  const closeModal = () => {
    setModalWord(null);
    setModalWordInfo(null);
  };

  const getParallelVerseText = (verseNum) => {
    const found = parallelVerses.find(v => v.verse === verseNum);
    return found ? found.text.trim() : "Parallel translation text not found.";
  };

  const isOT = bibleStructure[activeBook]?.testament === "OT";
  const bookChapters = bibleStructure[activeBook]?.chapters || [];

  return (
    <>
      <header className="app-header">
        <div className="header-top">
          <h1>Telugu Interlinear Bible</h1>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className="btn-action-star-header"
              onClick={() => setIsBookmarksOpen(!isBookmarksOpen)}
              title="Saved Bookmarks"
            >
              ⭐ Bookmarks ({bookmarks.length})
            </button>
            <button 
              className={`btn-settings-toggle ${isSettingsOpen ? 'active' : ''}`}
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              title="Display settings"
            >
              ⚙️ Preferences
            </button>
          </div>
        </div>

        {isBookmarksOpen && (
          <div className="bookmarks-panel animate-slide-down">
            <h4>Saved Bookmarks</h4>
            {bookmarks.length === 0 ? (
              <p className="no-bookmarks">No bookmarks saved yet. Click the star icon on any verse to bookmark it.</p>
            ) : (
              <div className="bookmarks-list">
                {bookmarks.map((bm, idx) => (
                  <div 
                    key={idx} 
                    className="bookmark-item"
                    onClick={() => handleBookmarkClick(bm)}
                  >
                    <span>{bm.book} {bm.chapter}:{bm.verse}</span>
                    <button 
                      className="btn-remove-bookmark"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBookmark(bm.book, bm.chapter, bm.verse);
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isSettingsOpen && (
          <div className="settings-panel animate-slide-down">
            <div className="settings-section">
              <h4>Theme Mode</h4>
              <div className="theme-pills">
                <button 
                  className={`theme-pill ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  Dark
                </button>
                <button 
                  className={`theme-pill ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  Light
                </button>
                <button 
                  className={`theme-pill ${theme === 'sepia' ? 'active' : ''}`}
                  onClick={() => setTheme('sepia')}
                >
                  Sepia
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h4>Display Fields</h4>
              <div className="toggle-group">
                <label className="checkbox-wrapper">
                  <input 
                    type="checkbox" 
                    checked={showOriginal} 
                    onChange={(e) => setShowOriginal(e.target.checked)} 
                  />
                  <span>Original Script</span>
                </label>
                <label className="checkbox-wrapper">
                  <input 
                    type="checkbox" 
                    checked={showTranslit} 
                    onChange={(e) => setShowTranslit(e.target.checked)} 
                  />
                  <span>Transliteration</span>
                </label>
                <label className="checkbox-wrapper">
                  <input 
                    type="checkbox" 
                    checked={showGloss} 
                    onChange={(e) => setShowGloss(e.target.checked)} 
                  />
                  <span>Telugu Gloss</span>
                </label>
              </div>
            </div>

            <div className="settings-section">
              <h4>Font Sizing</h4>
              <div className="slider-group">
                <div className="slider-item">
                  <label>
                    <span>Original text</span>
                    <span>{fontSizeOriginal}rem</span>
                  </label>
                  <input 
                    type="range" 
                    min="1.0" 
                    max="2.5" 
                    step="0.05" 
                    value={fontSizeOriginal} 
                    onChange={(e) => setFontSizeOriginal(parseFloat(e.target.value))} 
                  />
                </div>
                <div className="slider-item">
                  <label>
                    <span>Transliteration</span>
                    <span>{fontSizeTranslit}rem</span>
                  </label>
                  <input 
                    type="range" 
                    min="0.7" 
                    max="1.5" 
                    step="0.05" 
                    value={fontSizeTranslit} 
                    onChange={(e) => setFontSizeTranslit(parseFloat(e.target.value))} 
                  />
                </div>
                <div className="slider-item">
                  <label>
                    <span>Telugu gloss</span>
                    <span>{fontSizeGloss}rem</span>
                  </label>
                  <input 
                    type="range" 
                    min="0.8" 
                    max="1.8" 
                    step="0.05" 
                    value={fontSizeGloss} 
                    onChange={(e) => setFontSizeGloss(parseFloat(e.target.value))} 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {Object.keys(bibleStructure).length > 0 && (
          <div className="nav-controls">
            <div className="select-wrapper">
              <label htmlFor="book-select">Book</label>
              <select 
                id="book-select" 
                value={activeBook}
                onChange={handleBookChange}
              >
                {Object.keys(bibleStructure).map(bookKey => (
                  <option key={bookKey} value={bookKey}>
                    {bibleStructure[bookKey].displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="select-wrapper">
              <label htmlFor="chapter-select">Chapter</label>
              <select 
                id="chapter-select" 
                value={activeChapter}
                onChange={handleChapterChange}
              >
                {bookChapters.map(chap => (
                  <option key={chap} value={chap}>
                    Chapter {chap}
                  </option>
                ))}
              </select>
            </div>

            <div className="control-divider"></div>

            <div className="select-wrapper checkbox-wrapper">
              <input 
                type="checkbox" 
                id="parallel-toggle"
                checked={showParallel}
                onChange={(e) => setShowParallel(e.target.checked)}
              />
              <label htmlFor="parallel-toggle">Parallel View</label>
            </div>

            {showParallel && (
              <div className="select-wrapper animate-fade-in">
                <label htmlFor="translation-select">Parallel Translation</label>
                <select 
                  id="translation-select"
                  value={parallelTranslation}
                  onChange={(e) => setParallelTranslation(e.target.value)}
                >
                  <option value="kjv">KJV (English)</option>
                  <option value="web">WEB (English)</option>
                  <option value="bsi">Telugu BSI (Standard)</option>
                  <option value="three-column">3-Pane (Interlinear + Telugu + KJV)</option>
                </select>
              </div>
            )}
          </div>
        )}
      </header>

      <main id="bible-container">
        {loading && <div className="loading">Loading bible data...</div>}
        {error && <div className="error">Failed to load bible data: {error}</div>}
        
        {!loading && !error && verses.map((verse, idx) => {
          const verseNum = verse.v || verse.verse || verse.verse_number;
          return (
            <div 
              key={idx} 
              className={`verse ${isOT ? 'rtl-verse' : ''} ${isVerseHighlighted(verseNum) ? 'highlighted-verse' : ''}`}
            >
              <div className="verse-header">
                <span className="verse-num">{verseNum}</span>
                <div className="verse-actions">
                  <button 
                    className={`btn-action-star ${isBookmarked(verseNum) ? 'active' : ''}`}
                    onClick={() => toggleBookmark(activeBook, activeChapter, verseNum)}
                    title={isBookmarked(verseNum) ? "Remove Bookmark" : "Bookmark Verse"}
                  >
                    ★
                  </button>
                  <button 
                    className={`btn-action-highlight ${isVerseHighlighted(verseNum) ? 'active' : ''}`}
                    onClick={() => toggleVerseHighlight(verseNum)}
                    title={isVerseHighlighted(verseNum) ? "Remove Highlight" : "Highlight Verse"}
                  >
                    🎨
                  </button>
                  <button 
                    className={`btn-action-note ${hasNoteContent(verseNum) ? 'has-content' : ''}`}
                    onClick={() => toggleNoteEditor(verseNum)}
                    title="Write study notes"
                  >
                    ✍️
                  </button>
                </div>
              </div>
              
              <div className={`verse-content-layout ${showParallel ? 'split-layout' : ''} ${parallelTranslation === 'three-column' ? 'three-pane-layout' : ''}`}>
                
                {/* 1. Interlinear Pane */}
                <div className="interlinear-pane">
                  <div className="words-container">
                    {verse.words && verse.words.map((word, wordIdx) => (
                      <div 
                        key={wordIdx} 
                        className={`word-box ${isSearchResultHighlighted(verseNum, word) ? 'highlighted-box' : ''} ${isWordCustomHighlighted(verseNum, wordIdx) ? 'highlighted-word' : ''}`}
                        onClick={() => handleWordClick(word, verseNum, wordIdx)}
                      >
                        {showOriginal && (
                          <div 
                            className="original-text"
                            style={{ fontSize: `${fontSizeOriginal}rem` }}
                          >
                            {word.hb || word.original || ''}
                          </div>
                        )}
                        {showTranslit && (
                          <div 
                            className="translit-text"
                            style={{ fontSize: `${fontSizeTranslit}rem` }}
                          >
                            {word.tr || word.translit_english || ''}
                          </div>
                        )}
                        {showGloss && (
                          <div 
                            className="telugu-text"
                            style={{ fontSize: `${fontSizeGloss}rem` }}
                          >
                            {word.te || word.telugu_gloss || ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Standard Telugu BSI Pane */}
                {showParallel && (parallelTranslation === 'bsi' || parallelTranslation === 'three-column') && (
                  <div className="telugu-bsi-pane">
                    <p className="telugu-bsi-text">
                      {verse.words ? verse.words.map(w => w.te || w.telugu_gloss || '').join(' ').trim() : ''}
                    </p>
                  </div>
                )}

                {/* 3. English Pane */}
                {showParallel && (parallelTranslation === 'kjv' || parallelTranslation === 'web' || parallelTranslation === 'three-column') && (
                  <div className="english-pane">
                    {parallelLoading ? (
                      <span className="loading-small">Loading translation...</span>
                    ) : (
                      <p className="parallel-text">
                        {getParallelVerseText(verseNum)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {activeNoteEditors[verseNum] && (
                <div className="note-editor-panel animate-slide-down">
                  <textarea
                    placeholder="Write your study notes for this verse here (saves automatically)..."
                    value={notes[`${activeBook}/${activeChapter}/${verseNum}`] || ''}
                    onChange={(e) => saveNote(verseNum, e.target.value)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* Strong's Concordance Details Modal */}
      {modalWord && (
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target.classList.contains('modal-overlay')) closeModal();
          }}
        >
          <div className="modal-content">
            <button 
              className="modal-close-btn" 
              aria-label="Close modal"
              onClick={closeModal}
            >
              &times;
            </button>
            <div className="modal-body">
              {modalLoading && (
                <div id="modal-loading">
                  <div className="spinner"></div>
                  <p>Loading Concordance definitions...</p>
                </div>
              )}

              {!modalLoading && (
                <div id="modal-data">
                  <div className="modal-header-data">
                    {modalWord.strongs && (
                      <span className="strongs-tag">{modalWord.strongs}</span>
                    )}
                    <h2 
                      id="modal-word-lemma"
                      style={{ direction: isOT ? 'rtl' : 'ltr' }}
                    >
                      {modalStrongsEntry?.lemma || modalWord.hb || modalWord.original || ''}
                    </h2>
                    <span className="xlit-tag">
                      {modalStrongsEntry?.xlit || modalWord.tr || modalWord.translit_english || ''}
                    </span>
                  </div>

                  <div className="modal-section">
                    <h3>Pronunciation</h3>
                    <p className="pronounce-text">
                      {modalStrongsEntry ? (modalStrongsEntry.pronounce || 'N/A') : (
                        'Pronunciation details are not available for this Old Testament word in the current dataset.'
                      )}
                    </p>
                  </div>

                  <div className="modal-section">
                    <h3>Grammatical Parsing</h3>
                    <p className="grammar-text">
                      {modalWord.gr || modalWord.grammar || 'N/A'}
                    </p>
                  </div>

                  <div className="modal-section">
                    <h3>Concordance Definition</h3>
                    <p className="definition-text">
                      {modalError ? `Error loading definition: ${modalError}` : (
                        modalStrongsEntry ? (modalStrongsEntry.description || 'No definition available.') : (
                          modalWord.strongs ? `Strong's ID "${modalWord.strongs}" not found in database.` :
                          'Strong\'s Concordance identifier is not available in the source file for this word. Direct grammatical morphological parsing is provided above.'
                        )
                      )}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem' }}>
                    {(modalWord.strongs || modalWord.hb || modalWord.original) && (
                      <button 
                        className="btn-concordance-search"
                        style={{ margin: 0 }}
                        onClick={() => handleSearchOccurrences(modalWord.strongs || modalWord.hb || modalWord.original)}
                      >
                        🔍 Find all occurrences in Bible
                      </button>
                    )}
                    
                    <button 
                      className="btn-concordance-search"
                      style={{ 
                        margin: 0,
                        background: isWordHighlightedInModal() ? '#10b981' : 'rgba(16, 185, 129, 0.15)',
                        color: isWordHighlightedInModal() ? '#0f172a' : '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)'
                      }}
                      onClick={toggleWordHighlightInModal}
                    >
                      🎨 {isWordHighlightedInModal() ? 'Remove Word Highlight' : 'Highlight Word'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reverse Concordance side drawer overlay */}
      {isConcordanceOpen && (
        <div 
          className="concordance-drawer-overlay" 
          onClick={() => setIsConcordanceOpen(false)}
        >
          <div 
            className="concordance-drawer animate-slide-in" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <h2>Concordance: {concordanceSearchKey}</h2>
              <button 
                className="drawer-close" 
                onClick={() => setIsConcordanceOpen(false)}
              >
                &times;
              </button>
            </div>
            
            <div className="drawer-body">
              {parallelLoading ? (
                <div id="modal-loading">
                  <div className="spinner"></div>
                  <p>Searching Bible occurrences...</p>
                </div>
              ) : (
                <>
                  <p className="results-count">{concordanceResults.length} occurrences found</p>
                  <div className="results-list">
                    {concordanceResults.map((res, idx) => {
                      const [book, chap, verse, gloss, orig] = res;
                      return (
                        <div 
                          key={idx} 
                          className="concordance-item"
                          onClick={() => handleOccurrenceClick(book, chap, verse, orig)}
                        >
                          <div className="item-meta">
                            <strong>{book} {chap}:{verse}</strong>
                            <span className="orig-tag">{orig}</span>
                          </div>
                          <p className="item-preview">
                            Gloss: <span className="highlight-gloss">"{gloss}"</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
