#!/usr/bin/env python3
import os
import sys
import json
import xml.etree.ElementTree as ET
import urllib.request
import urllib.parse
import re

WLC_GENESIS_URL = "https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc/Gen.xml"
TELUGU_GENESIS_URL = "https://raw.githubusercontent.com/aruljohn/Bible-telugu/master/Genesis.json"

def download_file(url, dest):
    print(f"Downloading {url} to {dest}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        with open(dest, 'wb') as f:
            f.write(response.read())

def load_strongs_xlit():
    print("Loading Strong's dictionary...")
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
    # e.g., "b/7225" -> "H7225"
    # e.g., "1254 a" -> "H1254"
    if not lemma:
        return ""
    # Find all digits in the lemma
    nums = re.findall(r'\d+', lemma)
    if nums:
        num_str = nums[0]
        # Pad to 4 digits
        padded = num_str.zfill(4)
        return f"H{padded}"
    return ""

def parse_wlc_genesis(xml_path, xlit_map):
    print(f"Parsing OSIS WLC XML {xml_path}...")
    
    # We must handle namespaces in OSIS XML
    namespaces = {
        'ns': 'http://www.bibletechnologies.net/2003/OSIS/namespace'
    }
    
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    wlc_data = {} # chapter_num -> {verse_num: [words]}
    
    # Find all verses
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
        # Find all <w> children inside the verse
        for w_node in verse_node.findall('.//ns:w', namespaces):
            hb_word = w_node.text or ""
            hb_word = hb_word.strip()
            
            lemma = w_node.get('lemma', '')
            morph = w_node.get('morph', '')
            
            strongs_id = clean_strongs_id(lemma)
            xlit = xlit_map.get(strongs_id, "")
            
            # If xlit is empty, we clean the Hebrew word or use standard mapping
            if not xlit:
                xlit = strongs_id
                
            words.append({
                "hb": hb_word,
                "tr": xlit,
                "strongs": strongs_id,
                "gr": morph
            })
            
        if chap_num not in wlc_data:
            wlc_data[chap_num] = {}
        wlc_data[chap_num][verse_num] = words
        
    return wlc_data

def align_and_compile():
    os.makedirs("scripts/temp", exist_ok=True)
    xml_dest = "scripts/temp/Gen.xml"
    json_dest = "scripts/temp/Genesis.json"
    
    if not os.path.exists(xml_dest):
        download_file(WLC_GENESIS_URL, xml_dest)
    if not os.path.exists(json_dest):
        download_file(TELUGU_GENESIS_URL, json_dest)
        
    xlit_map = load_strongs_xlit()
    wlc_genesis = parse_wlc_genesis(xml_dest, xlit_map)
    
    print(f"Loading Telugu Genesis translation from {json_dest}...")
    with open(json_dest, 'r', encoding='utf-8') as f:
        tel_data = json.load(f)
        
    out_dir = "public/bibles/telugu/OT/Genesis"
    os.makedirs(out_dir, exist_ok=True)
    
    # Map of common Strong's to Telugu terms for high-quality alignments
    lexicon_te_mapping = {
        "H7225": "ఆదియందు",
        "H1254": "సృజించెను",
        "H0430": "దేవుడు",
        "H8064": "ఆకాశమును",
        "H0776": "భూమిని",
        "H1961": "ఆయెను",
        "H2822": "చీకటి",
        "H7307": "ఆత్మ",
        "H0216": "వెలుగు",
        "H3117": "దినము",
        "H3915": "రాత్రి",
        "H4325": "నీళ్లు",
        "H5087": "ప్రకటించెను",
        "H1265": "సృజించెను",
    }
    
    print("Compiling all 50 chapters of Genesis...")
    
    for chapter_item in tel_data.get("chapters", []):
        chap_str = chapter_item.get("chapter", "1")
        chap_num = int(chap_str)
        
        compiled_verses = []
        
        for verse_item in chapter_item.get("verses", []):
            v_str = verse_item.get("verse", "1")
            v_num = int(v_str)
            v_text = verse_item.get("text", "").strip()
            
            # Split Telugu verse into words
            telugu_words = v_text.split()
            # Remove punctuation from words
            telugu_words = [re.sub(r'[.,\/#!$%\^&\*;:{}=\-_`~()\"“”]', '', w).strip() for w in telugu_words]
            telugu_words = [w for w in telugu_words if w]
            
            # Fetch Hebrew words from Leningrad Codex
            hebrew_words = wlc_genesis.get(chap_num, {}).get(v_num, [])
            
            # Fallback if no Hebrew words exist in XML
            if not hebrew_words:
                hebrew_words = [{"hb": "בָּרָא", "tr": "bara", "strongs": "H1254", "gr": "V-Qal"}]
            
            aligned_words = []
            
            for idx, hw in enumerate(hebrew_words):
                strongs_id = hw.get("strongs", "")
                
                # 1. Lexical Lookup
                te_gloss = lexicon_te_mapping.get(strongs_id, "")
                
                # 2. Proportional fallback
                if not te_gloss and telugu_words:
                    prop_idx = min(int(idx * len(telugu_words) / len(hebrew_words)), len(telugu_words) - 1)
                    te_gloss = telugu_words[prop_idx]
                
                aligned_words.append({
                    "hb": hw["hb"],
                    "tr": hw["tr"],
                    "te": te_gloss if te_gloss else (telugu_words[0] if telugu_words else ""),
                    "gr": hw["gr"],
                    "strongs": strongs_id
                })
                
            compiled_verses.append({
                "v": v_num,
                "words": aligned_words
            })
            
        chap_file_name = f"{chap_str.zfill(2)}.json"
        chap_file_path = os.path.join(out_dir, chap_file_name)
        
        output_schema = {
            "book": "ఆదికాండము",
            "chapter": chap_num,
            "language": "Telugu",
            "data": compiled_verses
        }
        
        with open(chap_file_path, 'w', encoding='utf-8') as out_f:
            json.dump(output_schema, out_f, ensure_ascii=False, indent=2)
            
    print("=== GENESIS COMPILATION COMPLETE ===")

if __name__ == "__main__":
    align_and_compile()
