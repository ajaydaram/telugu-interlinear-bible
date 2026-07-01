#!/usr/bin/env python3
import os
import json

def build_concordance(bibles_dir):
    print("=== STARTING CONCORDANCE REVERSE INDEX BUILD ===")
    concordance = {}

    telugu_dir = os.path.join(bibles_dir, "telugu")
    if not os.path.exists(telugu_dir):
        print(f"Telugu directory not found at {telugu_dir}")
        return

    # Loop through OT and NT
    testaments = ["OT", "NT"]
    for test in testaments:
        test_path = os.path.join(telugu_dir, test)
        if not os.path.exists(test_path):
            continue

        for book_name in os.listdir(test_path):
            book_path = os.path.join(test_path, book_name)
            if not os.path.isdir(book_path):
                continue

            for filename in os.listdir(book_path):
                if not filename.endswith(".json"):
                    continue

                chapter_path = os.path.join(book_path, filename)
                try:
                    with open(chapter_path, 'r', encoding='utf-8') as f:
                        chap_data = json.load(f)
                except Exception as e:
                    print(f"Error reading {chapter_path}: {e}")
                    continue

                chapter_num = chap_data.get("chapter", 0)

                for verse_obj in chap_data.get("data", []):
                    verse_num = verse_obj.get("v", 0)
                    words = verse_obj.get("words", [])

                    for w_idx, w_obj in enumerate(words):
                        # NT uses 'strongs', OT uses Hebrew lemmas which might not have strongs in some raw files
                        strongs_id = w_obj.get("strongs", "")
                        
                        # Fallback for OT if strongs not populated: construct a key based on lemma
                        # e.g., if hb is בְּרֵאשִׁ֖ית, use it to group occurrences!
                        lemma_key = strongs_id if strongs_id else w_obj.get("hb", "")
                        if not lemma_key:
                            continue

                        # Clean any whitespace or formatting
                        lemma_key = lemma_key.strip()
                        
                        telugu_gloss = w_obj.get("te") or w_obj.get("telugu_gloss") or ""
                        original_word = w_obj.get("hb") or w_obj.get("original") or ""

                        if lemma_key not in concordance:
                            concordance[lemma_key] = []

                        # Store reference details: [Book, Chapter, Verse, Telugu Gloss, Original Word]
                        concordance[lemma_key].append([
                            book_name,
                            chapter_num,
                            verse_num,
                            telugu_gloss,
                            original_word
                        ])

    # Save to public/bibles/concordance.json
    output_path = os.path.join(bibles_dir, "concordance.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(concordance, f, ensure_ascii=False, indent=2)

    print(f"=== CONCORDANCE BUILD COMPLETE! index written to {output_path} ===")
    print(f"Indexed {len(concordance)} unique lemmas.")

if __name__ == "__main__":
    base_bibles_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "bibles"))
    build_concordance(base_bibles_dir)
