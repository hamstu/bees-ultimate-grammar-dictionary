// Romaji search: node --test tests/js (or `make test-js`).
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

// romaji.js is a browser script; run it the way the page does.
const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL("../../website/assets/romaji.js", import.meta.url), "utf8"), context);
const { romajiToKana, looseKana } = context.Romaji;
const kana = query => [...(romajiToKana(query) || [])];

// The page's matcher, reduced: an entry matches when a converted form
// (folded with looseKana) appears in the entry's folded text.
const finds = (query, entry) => kana(query).some(form => looseKana(entry).includes(looseKana(form)));

test("converts Hepburn and its common variants", () => {
  assert.deepEqual(kana("nagara"), ["ながら"]);
  for (const [a, b] of [["shi", "si"], ["tsu", "tu"], ["chi", "ti"], ["ji", "zi"], ["fu", "hu"], ["sha", "sya"], ["cha", "tya"], ["ja", "jya"]]) {
    assert.deepEqual(kana(a), kana(b), `${a} / ${b}`);
  }
  assert.deepEqual(kana("kyou"), ["きょう"]);
  assert.deepEqual(kana("matcha"), ["まっちゃ"]);
});

test("double consonants become っ", () => {
  assert.deepEqual(kana("itte"), ["いって"]);
  assert.deepEqual(kana("tte"), ["って"]);
  assert.deepEqual(kana("zutto"), ["ずっと"]);
});

test("n, nn and n' become ん where they should", () => {
  assert.deepEqual(kana("onna"), ["おんな"]);
  assert.deepEqual(kana("konnichiwa"), ["こんにちわ"]);
  assert.equal(kana("kin'en")[0], "きんえん");
  assert.deepEqual(kana("benkyou"), ["べんきょう"]);
  assert.deepEqual(kana("nan desu"), ["なんです"]);
});

test("spaces are optional", () => {
  assert.deepEqual(kana("te mo"), kana("temo"));
  assert.deepEqual(kana("te mo"), ["ても"]);
  assert.ok(finds("te mo", "ても"));
  assert.ok(finds("temo", "ても"));
});

test("particles wa/ha, o/wo, e/he match either spelling", () => {
  assert.ok(finds("wake ni wa ikanai", "わけにはいかない"));
  assert.ok(finds("wakeniwaikanai", "わけにはいかない"));
  assert.ok(finds("wake ni ha ikanai", "わけにはいかない"));
  assert.ok(finds("o", "を"));
  assert.ok(finds("wo", "を"));
  assert.ok(finds("e", "へ"));
  assert.ok(finds("ni yotte wa", "によっては"));
});

test("long vowels match in any spelling", () => {
  assert.ok(finds("benkyō", "べんきょう"));
  assert.ok(finds("benkyoo", "べんきょう"));
  assert.ok(finds("sensee", "せんせい"));
  assert.ok(finds("teiru", "ている"));
  assert.ok(finds("ko-hi-", "コーヒー".replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))));
});

test("partial typing already finds the entry", () => {
  for (const query of ["na", "nag", "naga", "nagar", "nagara"]) {
    assert.ok(finds(query, "ながら"), query);
  }
  assert.ok(finds("wake n", "わけにはいかない"), "trailing n may still become に");
  assert.ok(finds("wake ni wa ik", "わけにはいかない"));
});

test("English words are not mistaken for romaji", () => {
  for (const word of ["although", "must", "should", "because", "while", "want to"]) {
    assert.equal(romajiToKana(word), null, word);
  }
  assert.equal(romajiToKana("ながら"), null);
  assert.equal(romajiToKana(""), null);
});

test("a particle typed as its own word is written as the particle", () => {
  assert.deepEqual(kana("wake ni wa ikanai"), ["わけにはいかない"]);
  assert.deepEqual(kana("hon o yomu"), ["ほんをよむ"]);
  assert.deepEqual(kana("gakkou e"), ["がっこうへ"]);
  assert.deepEqual(kana("wa"), ["わ"], "a lone first word is not a particle");
});
