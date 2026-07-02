#!/usr/bin/env python3
import os
import sys
import json
import re
import time
import urllib.request
import urllib.parse

# Load local .env or .env.local if present
def load_env_file():
    for fn in [".env.local", ".env"]:
        if os.path.exists(fn):
            try:
                with open(fn, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            k, v = line.split('=', 1)
                            os.environ[k.strip()] = v.strip()
            except Exception:
                pass

load_env_file()

# Initialize Gemini REST Client configurations
api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if not api_key:
    print("WARNING: GEMINI_API_KEY or GOOGLE_API_KEY environment variable is missing.")
    print("The script will use proportional chunk mapping as a fallback.")

def call_gemini_realign_rest(verse_text, tokens):
    if not api_key:
        # Fallback to local proportional chunk mapping
        telugu_words = verse_text.split()
        segments = []
        for idx, t in enumerate(tokens):
            prop_idx = min(int(idx * len(telugu_words) / len(tokens)), len(telugu_words) - 1)
            segments.append({
                "hebrew": t.get("original", t.get("hb", "")),
                "translit": t.get("translit", t.get("tr", "")),
                "telugu_chunk": telugu_words[prop_idx] if telugu_words else "",
                "strongs": t.get("strongs", ""),
                "grammar": t.get("grammar", t.get("gr", ""))
            })
        return segments

    prompt = f"""
I have a list of Hebrew/Greek tokens and a target Telugu translation for this verse.
Keep the Telugu translation provided.
Partition the Telugu translation into chunks that correspond to the provided Hebrew/Greek tokens.
If a Hebrew/Greek token does not have a direct Telugu word, label it 'Grammatical Particle' or group it with the nearest semantic word.

Target Telugu: "{verse_text}"
Tokens: {json.dumps(tokens, ensure_ascii=False, indent=2)}

Output ONLY valid JSON representing an array of objects. Each object must contain keys:
"hebrew" (the original script string),
"translit" (the phonetic transliteration string),
"telugu_chunk" (the mapped Telugu segment string),
"strongs" (the Strong's number string),
"grammar" (the morphological code string).

Do not include markdown wraps or block texts outside the JSON.
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ]
    }
    
    headers = {
        "Content-Type": "application/json"
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers=headers,
            method='POST'
        )
        with urllib.request.urlopen(req) as res:
            response_data = json.loads(res.read().decode('utf-8'))
            text_response = response_data['candidates'][0]['content']['parts'][0]['text'].strip()
            
            # Clean markdown code block wraps
            if text_response.startswith("```"):
                text_response = re.sub(r'^```[a-z]*\n', '', text_response)
                text_response = re.sub(r'\n```$', '', text_response)
                
            parsed_json = json.loads(text_response)
            return parsed_json
    except Exception as e:
        print(f"Gemini REST Error: {e}. Falling back to proportional alignment...")
        # Fallback
        telugu_words = verse_text.split()
        segments = []
        for idx, t in enumerate(tokens):
            prop_idx = min(int(idx * len(telugu_words) / len(tokens)), len(telugu_words) - 1)
            segments.append({
                "hebrew": t.get("original", t.get("hb", "")),
                "translit": t.get("translit", t.get("tr", "")),
                "telugu_chunk": telugu_words[prop_idx] if telugu_words else "",
                "strongs": t.get("strongs", ""),
                "grammar": t.get("grammar", t.get("gr", ""))
            })
        return segments

def process_file_realign(file_path):
    print(f"Re-aligning {file_path} into Segmented Schema...")
    with open(file_path, 'r', encoding='utf-8') as f:
        chapter_data = json.load(f)
        
    book_name = chapter_data.get("book", "")
    chap_num = chapter_data.get("chapter", 1)
    
    realigned_verses = []
    data_list = chapter_data.get("data", [])
    
    for idx, verse_item in enumerate(data_list):
        v_num = verse_item.get("v") or verse_item.get("verse") or verse_item.get("verse_number")
        words_list = verse_item.get("words") or verse_item.get("segments") or []
        
        telugu_segments = [w.get("te") or w.get("telugu_gloss") or w.get("telugu_chunk") or "" for w in words_list]
        telugu_segments = [s for s in telugu_segments if s]
        verse_translation = " ".join(telugu_segments)
        
        if not verse_translation:
            verse_translation = ""
            
        print(f"  Verse {v_num}...")
        segments = call_gemini_realign_rest(verse_translation, words_list)
        
        realigned_verses.append({
            "verse": v_num,
            "text": verse_translation,
            "segments": segments
        })
        
        if api_key:
            time.sleep(1)
            
    output_schema = {
        "book": book_name,
        "chapter": chap_num,
        "language": "Telugu",
        "data": realigned_verses
    }
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(output_schema, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully migrated {file_path} to segmented schema!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: ./scripts/realign_segments.py <path_to_chapter_json>")
        sys.exit(1)
        
    target_path = sys.argv[1]
    if os.path.exists(target_path):
        process_file_realign(target_path)
    else:
        print(f"File not found: {target_path}")
