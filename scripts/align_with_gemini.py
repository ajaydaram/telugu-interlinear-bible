#!/usr/bin/env python3
import os
import sys
import json
import re
import xml.etree.ElementTree as ET
import urllib.request
import urllib.parse
import time

WLC_GENESIS_URL = "https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc/Gen.xml"
TELUGU_GENESIS_URL = "https://raw.githubusercontent.com/aruljohn/Bible-telugu/master/Genesis.json"

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
    print("The script will use proportional fallback alignment.")

def load_strongs_xlit():
    xlit_map = {}
    strongs_path = "public/strongs.json"
    if os.path.exists(strongs_path):
        with open(strongs_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for entry in data:
                num = entry.get("number", "")
                xlit = entry.get("xlit", "")
                if num and xlit:
                    xlit_map[num] = xlit
    return xlit_map

def clean_strongs_id(lemma):
    if not lemma:
        return ""
    nums = re.findall(r'\d+', lemma)
    if nums:
        return f"H{nums[0].zfill(4)}"
    return ""

def parse_wlc_genesis(xml_path, xlit_map):
    namespaces = {'ns': 'http://www.bibletechnologies.net/2003/OSIS/namespace'}
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    wlc_data = {}
    for verse_node in root.findall('.//ns:verse', namespaces):
        osis_id = verse_node.get('osisID', '')
        if not osis_id.startswith('Gen.'):
            continue
            
        parts = osis_id.split('.')
        if len(parts) < 3:
            continue
            
        chap_num = int(parts[1])
        verse_num = int(parts[2])
        
        words = []
        for w_node in verse_node.findall('.//ns:w', namespaces):
            hb_word = w_node.text or ""
            hb_word = hb_word.strip()
            lemma = w_node.get('lemma', '')
            morph = w_node.get('morph', '')
            strongs_id = clean_strongs_id(lemma)
            xlit = xlit_map.get(strongs_id, strongs_id)
            
            words.append({
                "hebrew": hb_word,
                "translit": xlit,
                "strongs": strongs_id,
                "gr": morph
            })
            
        if chap_num not in wlc_data:
            wlc_data[chap_num] = {}
        wlc_data[chap_num][verse_num] = words
        
    return wlc_data

def call_gemini_alignment_rest(batch_data):
    if not api_key:
        # Fallback to proportional alignment
        fallback_verses = []
        for verse in batch_data:
            words = []
            target_words = verse["target"].split()
            for idx, w in enumerate(verse["source"]):
                prop_idx = min(int(idx * len(target_words) / len(verse["source"])), len(target_words) - 1)
                words.append({
                    "hebrew": w["hebrew"],
                    "translit": w["translit"],
                    "telugu": target_words[prop_idx] if target_words else ""
                })
            fallback_verses.append({
                "v": verse["v"],
                "words": words
            })
        return fallback_verses

    # Format the prompt using the user's exact template
    prompt = f"""
Align the following Hebrew tokens to the Telugu translation for each verse. 
Ensure the Telugu segment correctly maps to the corresponding Hebrew token.

Example:
Source: [ {{"hebrew": "וַיִּשְׁמַע", "translit": "wayyishmâʻ"}}, {{"hebrew": "לָבָן", "translit": "lâbân"}} ]
Target: "లాబాను వినెను"
Output: [ {{"hebrew": "וַיִּשְׁמַע", "translit": "wayyishmâʻ", "telugu": "వినెను"}}, {{"hebrew": "לָבָן", "translit": "lâbân", "telugu": "లాబాను"}} ]

Now, process these verses:
{json.dumps(batch_data, ensure_ascii=False, indent=2)}

Output ONLY valid JSON representing an array of objects where each object has key "v" (verse number) and "words" (array of aligned hebrew-translit-telugu words matching the format above).
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
            
            if text_response.startswith("```"):
                text_response = re.sub(r'^```[a-z]*\n', '', text_response)
                text_response = re.sub(r'\n```$', '', text_response)
                
            parsed_json = json.loads(text_response)
            return parsed_json
    except Exception as e:
        print(f"Gemini REST Error: {e}. Falling back to proportional alignment...")
        # Fallback
        fallback_verses = []
        for verse in batch_data:
            words = []
            target_words = verse["target"].split()
            for idx, w in enumerate(verse["source"]):
                prop_idx = min(int(idx * len(target_words) / len(verse["source"])), len(target_words) - 1)
                words.append({
                    "hebrew": w["hebrew"],
                    "translit": w["translit"],
                    "telugu": target_words[prop_idx] if target_words else ""
                })
            fallback_verses.append({
                "v": verse["v"],
                "words": words
            })
        return fallback_verses

def align_and_compile():
    os.makedirs("scripts/temp", exist_ok=True)
    xml_dest = "scripts/temp/Gen.xml"
    json_dest = "scripts/temp/Genesis.json"
    
    if not os.path.exists(xml_dest):
        try:
            download_file(WLC_GENESIS_URL, xml_dest)
        except Exception as e:
            print(f"Error downloading Gen.xml: {e}")
            return
            
    if not os.path.exists(json_dest):
        try:
            download_file(TELUGU_GENESIS_URL, json_dest)
        except Exception as e:
            print(f"Error downloading Genesis.json: {e}")
            return
        
    xlit_map = load_strongs_xlit()
    wlc_genesis = parse_wlc_genesis(xml_dest, xlit_map)
    
    with open(json_dest, 'r', encoding='utf-8') as f:
        tel_data = json.load(f)
        
    out_dir = "public/bibles/telugu/OT/Genesis"
    os.makedirs(out_dir, exist_ok=True)
    
    for chapter_item in tel_data.get("chapters", []):
        chap_str = chapter_item.get("chapter", "1")
        chap_num = int(chap_str)
        
        if chap_num != 1 and not api_key:
            continue
            
        print(f"Processing Chapter {chap_num}...")
        
        batch_verses = []
        morph_map = {}
        
        for verse_item in chapter_item.get("verses", []):
            v_str = verse_item.get("verse", "1")
            v_num = int(v_str)
            v_text = verse_item.get("text", "").strip()
            
            hebrew_words = wlc_genesis.get(chap_num, {}).get(v_num, [])
            if not hebrew_words:
                continue
                
            source_tokens = []
            for hw in hebrew_words:
                source_tokens.append({
                    "hebrew": hw["hebrew"],
                    "translit": hw["translit"]
                })
                morph_map[(v_num, hw["hebrew"])] = {
                    "strongs": hw["strongs"],
                    "gr": hw["gr"]
                }
                
            batch_verses.append({
                "v": v_num,
                "source": source_tokens,
                "target": v_text
            })
            
        aligned_result = []
        batch_size = 5
        for i in range(0, len(batch_verses), batch_size):
            batch = batch_verses[i:i+batch_size]
            print(f"Aligning verses {batch[0]['v']} - {batch[-1]['v']} using Gemini REST API...")
            aligned_batch = call_gemini_alignment_rest(batch)
            aligned_result.extend(aligned_batch)
            if api_key:
                time.sleep(1)
            
        final_verses = []
        for av in aligned_result:
            v_num = av.get("v")
            words = []
            for w in av.get("words", []):
                hb_tok = w.get("hebrew", "")
                te_gloss = w.get("telugu", "")
                tr_tok = w.get("translit", "")
                
                meta = morph_map.get((v_num, hb_tok), {})
                words.append({
                    "hb": hb_tok,
                    "tr": tr_tok,
                    "te": te_gloss,
                    "gr": meta.get("gr", ""),
                    "strongs": meta.get("strongs", "")
                })
            final_verses.append({
                "v": v_num,
                "words": words
            })
            
        chap_file_name = f"{chap_str.zfill(2)}.json"
        chap_file_path = os.path.join(out_dir, chap_file_name)
        
        output_schema = {
            "book": "ఆదికాండము",
            "chapter": chap_num,
            "language": "Telugu",
            "data": final_verses
        }
        
        with open(chap_file_path, 'w', encoding='utf-8') as out_f:
            json.dump(output_schema, out_f, ensure_ascii=False, indent=2)
            
    print("=== PIPELINE ALIGNMENT STEP COMPLETE ===")

def download_file(url, dest):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        with open(dest, 'wb') as f:
            f.write(response.read())

if __name__ == "__main__":
    align_and_compile()
