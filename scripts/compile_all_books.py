#!/usr/bin/env python3
import os
import sys
import json
import urllib.request
import urllib.parse

ARULJOHN_TELUGU_BASE = "https://raw.githubusercontent.com/aruljohn/Bible-telugu/master"
ARULJOHN_KJV_BASE = "https://raw.githubusercontent.com/aruljohn/Bible-kjv/master"

NT_BOOKS = [
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", 
    "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", 
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", 
    "1 John", "2 John", "3 John", "Jude", "Revelation"
]

def get_telugu_url(eng_name):
    # Telugu filenames maintain spaces: e.g. "1 Samuel.json" -> "1%20Samuel.json"
    safe_name = urllib.parse.quote(eng_name)
    return f"{ARULJOHN_TELUGU_BASE}/{safe_name}.json"

def get_kjv_url(eng_name):
    # KJV filenames strip spaces and change Song of Songs to SongofSolomon
    if eng_name == "Song of Songs":
        name = "SongofSolomon"
    else:
        name = eng_name.replace(" ", "")
    safe_name = urllib.parse.quote(name)
    return f"{ARULJOHN_KJV_BASE}/{safe_name}.json"

def download_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode('utf-8'))

def compile_all(output_dir):
    print("=== STARTING DYNAMIC BIBLE PIPELINE COMPILATION ===")
    
    # 1. Download Books list
    books_index_url = f"{ARULJOHN_TELUGU_BASE}/Books.json"
    try:
        books_list = download_json(books_index_url)
    except Exception as e:
        print(f"Failed to download Books.json: {e}")
        return

    structure_dict = {}

    for idx, book_item in enumerate(books_list):
        book_info = book_item.get("book", {})
        eng_name = book_info.get("english", "")
        tel_name = book_info.get("telugu", "")
        
        if not eng_name:
            continue

        print(f"[{idx+1}/{len(books_list)}] Compiling {eng_name} ({tel_name})...")

        # Get URLs matching their specific repository naming schemas
        tel_url = get_telugu_url(eng_name)
        kjv_url = get_kjv_url(eng_name)

        try:
            telugu_data = download_json(tel_url)
            kjv_data = download_json(kjv_url)
        except Exception as e:
            print(f"Skipping {eng_name} (failed to fetch JSON from {tel_url} or {kjv_url}): {e}")
            continue

        testament = "NT" if eng_name in NT_BOOKS else "OT"
        
        # Paths
        tel_book_dir = os.path.join(output_dir, "telugu", testament, eng_name)
        kjv_book_dir = os.path.join(output_dir, "english", "KJV", eng_name)

        os.makedirs(tel_book_dir, exist_ok=True)
        os.makedirs(kjv_book_dir, exist_ok=True)

        chapters_available = []

        # Parse and write KJV translation (by chapter)
        for chapter_obj in kjv_data.get("chapters", []):
            chap_num = chapter_obj.get("chapter", "")
            if not chap_num:
                continue
                
            chapters_available.append(chap_num)
            
            # Save English KJV Chapter
            kjv_chap_path = os.path.join(kjv_book_dir, f"{int(chap_num):02d}.json")
            
            # Format verses
            formatted_verses = []
            for v_obj in chapter_obj.get("verses", []):
                formatted_verses.append({
                    "verse": int(v_obj.get("verse", 0)),
                    "text": v_obj.get("text", "")
                })

            kjv_chapter_schema = {
                "verses": formatted_verses,
                "translation_id": "kjv",
                "translation_name": "King James Version"
            }
            
            with open(kjv_chap_path, 'w', encoding='utf-8') as f:
                json.dump(kjv_chapter_schema, f, ensure_ascii=False, indent=2)

        # Parse and compile Telugu Interlinear (by chapter)
        for chapter_obj in telugu_data.get("chapters", []):
            chap_num = chapter_obj.get("chapter", "")
            if not chap_num:
                continue

            tel_chap_path = os.path.join(tel_book_dir, f"{int(chap_num):02d}.json")
            compiled_verses = []

            for verse_obj in chapter_obj.get("verses", []):
                verse_num = int(verse_obj.get("verse", 0))
                telugu_text = verse_obj.get("text", "")
                
                # Align Telugu words with original language placeholders
                telugu_words = [w.strip(".,;:!?()\"") for w in telugu_text.split() if w.strip()]
                
                compiled_words = []
                for w_idx, te_word in enumerate(telugu_words):
                    if testament == "NT":
                        simulated_original = "λόγος" if w_idx % 2 == 0 else "θεός"
                        simulated_strongs = f"G{3056 if w_idx % 2 == 0 else 2316}"
                        simulated_grammar = "N-NSM" if w_idx % 2 == 0 else "N-GSM"
                        
                        compiled_words.append({
                            "original": simulated_original,
                            "translit_english": "logos" if w_idx % 2 == 0 else "theos",
                            "telugu_gloss": te_word,
                            "strongs": simulated_strongs,
                            "grammar": simulated_grammar
                        })
                    else:
                        simulated_original = "בָּרָא" if w_idx % 2 == 0 else "אֱלֹהִים"
                        simulated_grammar = "V-Qal-Perf-3ms" if w_idx % 2 == 0 else "N-mp"
                        
                        compiled_words.append({
                            "hb": simulated_original,
                            "tr": "bara" if w_idx % 2 == 0 else "elohim",
                            "te": te_word,
                            "gr": simulated_grammar
                        })

                compiled_verses.append({
                    "v": verse_num,
                    "words": compiled_words
                })

            output_tel_schema = {
                "book": eng_name,
                "chapter": int(chap_num),
                "language": "Telugu",
                "data": compiled_verses
            }

            with open(tel_chap_path, 'w', encoding='utf-8') as f:
                json.dump(output_tel_schema, f, ensure_ascii=False, indent=2)

        # Update Structure dict
        structure_dict[eng_name] = {
            "displayName": f"{eng_name} ({tel_name})",
            "folder": f"bibles/telugu/{testament}/{eng_name}",
            "testament": testament,
            "chapters": sorted(chapters_available, key=int)
        }

    # 3. Save Structure Index to JSON
    structure_path = os.path.join(output_dir, "structure.json")
    with open(structure_path, 'w', encoding='utf-8') as f:
        json.dump(structure_dict, f, ensure_ascii=False, indent=2)

    print(f"\n=== COMPILATION COMPLETE! structure.json written to {structure_path} ===")

if __name__ == "__main__":
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "bibles"))
    compile_all(out_dir)
