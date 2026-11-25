"use strict";

// Romaji → kana for grammar search, so a search can be typed without a
// Japanese keyboard. No dependencies; site.js reads it as globalThis.Romaji,
// and tests/js/romaji.test.mjs loads it the same way.
(function (global) {
  const ROWS = {
    "": "あいうえお", k: "かきくけこ", g: "がぎぐげご", s: "さしすせそ", z: "ざじずぜぞ",
    t: "たちつてと", d: "だぢづでど", n: "なにぬねの", h: "はひふへほ", b: "ばびぶべぼ",
    p: "ぱぴぷぺぽ", m: "まみむめも", r: "らりるれろ",
  };
  const TABLE = {};
  for (const [consonant, kana] of Object.entries(ROWS)) {
    [..."aiueo"].forEach((vowel, i) => { TABLE[consonant + vowel] = kana[i]; });
  }
  // The i-column kana that take a small ゃ/ゅ/ょ (kya, sha, cha, ...).
  const YOUON = { k: "き", g: "ぎ", s: "し", z: "じ", t: "ち", d: "ぢ", n: "に", h: "ひ", b: "び", p: "ぴ", m: "み", r: "り" };
  for (const [consonant, kana] of Object.entries(YOUON)) {
    TABLE[consonant + "ya"] = kana + "ゃ"; TABLE[consonant + "yu"] = kana + "ゅ"; TABLE[consonant + "yo"] = kana + "ょ";
  }
  Object.assign(TABLE, {
    ya: "や", yu: "ゆ", yo: "よ", ye: "いぇ", wa: "わ", wi: "うぃ", we: "うぇ", wo: "を",
    shi: "し", sha: "しゃ", shu: "しゅ", she: "しぇ", sho: "しょ",
    chi: "ち", cha: "ちゃ", chu: "ちゅ", che: "ちぇ", cho: "ちょ", cya: "ちゃ", cyu: "ちゅ", cyo: "ちょ",
    tsu: "つ", tsa: "つぁ", fu: "ふ", fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ",
    ji: "じ", ja: "じゃ", ju: "じゅ", je: "じぇ", jo: "じょ", jya: "じゃ", jyu: "じゅ", jyo: "じょ",
    ti: "ち", tu: "つ", si: "し", zi: "じ", hu: "ふ", di: "ぢ", du: "づ",
    thi: "てぃ", dhi: "でぃ", vu: "ゔ", va: "ゔぁ", vi: "ゔぃ", ve: "ゔぇ", vo: "ゔぉ",
    xa: "ぁ", xi: "ぃ", xu: "ぅ", xe: "ぇ", xo: "ぉ", la: "ぁ", li: "ぃ", lu: "ぅ", le: "ぇ", lo: "ぉ",
    xtu: "っ", xtsu: "っ", ltu: "っ", ltsu: "っ", xya: "ゃ", xyu: "ゅ", xyo: "ょ", lya: "ゃ", lyu: "ゅ", lyo: "ょ",
    "-": "ー",
  });
  const KEYS = Object.keys(TABLE);
  const VOWELS = "aiueo";
  const MACRONS = { "ā": "aa", "ī": "ii", "ū": "uu", "ē": "ee", "ō": "ou", "â": "aa", "î": "ii", "û": "uu", "ê": "ee", "ô": "ou" };

  // True when `fragment` could still grow into a syllable ("r", "ch", "ts").
  const isPrefix = fragment => KEYS.some(key => key.length > fragment.length && key.startsWith(fragment));

  // One space-free romaji word → { kana, partial }. `partial` is the
  // unfinished syllable left at the end while typing ("nagar" → なが + "r");
  // null when the word is not romaji at all ("must", "although").
  function convertWord(word) {
    let kana = "";
    let i = 0;
    while (i < word.length) {
      const char = word[i];
      const next = word[i + 1];
      if (char === "'") { i += 1; continue; }
      if (char === "n" && next === undefined) { kana += "ん"; i += 1; return { kana, partial: "", trailingN: true }; }
      if (char === "n" && next !== undefined && !VOWELS.includes(next) && next !== "y") {
        // ん: "n'" and "nn" (unless "nn" starts a な-row syllable, as in "onna"),
        // or n before another consonant.
        kana += "ん";
        const third = word[i + 2];
        i += (next === "'" || (next === "n" && (third === undefined || (!VOWELS.includes(third) && third !== "y")))) ? 2 : 1;
        continue;
      }
      if (next === char && !VOWELS.includes(char) && /[a-z]/.test(char) && char !== "n") {
        kana += "っ"; i += 1; continue; // tte, kka, ssh...
      }
      if (char === "t" && word.startsWith("ch", i + 1)) { kana += "っ"; i += 1; continue; } // matcha
      let matched = false;
      for (let length = 4; length > 0; length -= 1) {
        const piece = word.slice(i, i + length);
        if (piece.length === length && TABLE[piece]) { kana += TABLE[piece]; i += length; matched = true; break; }
      }
      if (matched) continue;
      const rest = word.slice(i);
      if (isPrefix(rest)) return { kana, partial: rest };
      return null;
    }
    return { kana, partial: "" };
  }

  const PARTICLE_WORDS = { wa: "は", ha: "は", wo: "を", o: "を", e: "へ", he: "へ" };

  // Romaji query → the hiragana it spells, or null when it is not romaji.
  // Spaces are dropped ("te mo" → ても). A trailing half-typed syllable is
  // left off, and a trailing "n" may still become な/に/…, so "wake n" also
  // offers わけ. Katakana needs no separate form: search folds katakana into
  // hiragana on both sides.
  function romajiToKana(query) {
    let text = String(query).normalize("NFC").toLowerCase().trim();
    text = text.replace(/[āīūēōâîûêô]/g, char => MACRONS[char]);
    if (!/^[a-z'\- ]+$/.test(text) || !/[aiueo]/.test(text)) return null;
    const words = text.split(/\s+/).filter(Boolean);
    let kana = "";
    const forms = [];
    for (const [index, word] of words.entries()) {
      // A word on its own that is a particle reads as one: "wake ni wa" → わけには.
      if (index > 0 && PARTICLE_WORDS[word]) { kana += PARTICLE_WORDS[word]; continue; }
      const result = convertWord(word);
      if (!result) return null;
      const last = index === words.length - 1;
      if (result.partial && !last) return null;
      kana += result.kana;
      if (result.trailingN && !last) continue;
      if (result.trailingN) forms.push(kana.slice(0, -1));
    }
    if (!kana) return null;
    return [kana, ...forms].filter(Boolean);
  }

  // The vowel each kana ends on, for long-vowel folding.
  const VOWEL_OF = {};
  for (const kana of Object.values(ROWS)) [...kana].forEach((char, i) => { VOWEL_OF[char] = "aiueo"[i]; });
  Object.assign(VOWEL_OF, { "や": "a", "ゃ": "a", "わ": "a", "ゆ": "u", "ゅ": "u", "よ": "o", "ょ": "o", "を": "o", "ぁ": "a", "ぃ": "i", "ぅ": "u", "ぇ": "e", "ぉ": "o", "ゔ": "u" });
  const LONG = { a: "あ", i: "い", u: "う", e: "え", o: "お" };
  const PARTICLES = { "は": "わ", "を": "お", "へ": "え", "ぢ": "じ", "づ": "ず" };

  // Folds hiragana so spellings that sound the same compare equal: particle
  // は/を/へ read as わ/お/え, ぢ/づ as じ/ず, おう/おお and えい/ええ and ー
  // as plain long vowels. Applied to both the query and the entries, so
  // "wa" finds は, "benkyou" and "benkyō" agree, and "teiru" finds ている.
  // Spaces and punctuation between kana are dropped.
  function looseKana(text) {
    let out = "";
    for (const raw of String(text)) {
      const char = PARTICLES[raw] || raw;
      const previous = VOWEL_OF[out[out.length - 1]];
      if (char === "ー" && previous) out += LONG[previous];
      else if (char === "う" && previous === "o") out += "お";
      else if (char === "い" && previous === "e") out += "え";
      else out += char;
    }
    return out.replace(/[\s・、。,，.()（）［］\[\]「」『』〈〉【】/／…~〜]+/g, "");
  }

  const api = { romajiToKana, looseKana, convertWord };
  global.Romaji = api;
})(globalThis);
