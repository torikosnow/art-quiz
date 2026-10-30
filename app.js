// 美術史クイズ v2（10/31 見た目と効果音を作り直した）
// 画面の流れは設計3（レクチャー/設計3_画面の流れ.md）のステートマシンそのまま。
//   状態: "select"（①区分選択） → "question"（②出題） → "answer"（③正誤・解説） → "result"（④結果）
// 見た目の考え方: レクチャー/フェーズ6-2_デザインと効果音.md

// ---- 定数 ----------------------------------------------------------
const MAX_QUESTIONS = 10; // 1回の出題数の上限

// 時代区分（国立西洋美術館の作品紹介の分け方を参考にした）
const ERAS = [
  { id: "c14-16", label: "14世紀〜16世紀（ゴシック後期・ルネサンス・マニエリスム）" },
  { id: "c17", label: "17世紀（バロックなど）" },
  { id: "c18", label: "18世紀（ロココなど）" },
  { id: "c19-20", label: "19・20世紀（第二次大戦前）" },
  { id: "c20post", label: "20世紀（第二次大戦後）" },
];
const ALL = "all"; // 全時代ミックス

// ジャンル（様式など。10/30 追加）。名前は tools/check_questions.ps1 の一覧と同じ。並びは時代順
const GENRES = ["ルネサンス", "北方ルネサンス", "マニエリスム", "バロック", "オランダ黄金時代", "ロココ", "新古典主義",
  "ロマン主義", "写実主義", "印象派", "ポスト印象派", "象徴主義", "アール・ヌーヴォー", "フォーヴィスム", "キュビスム", "表現主義", "シュルレアリスム",
  "抽象表現主義", "ポップ・アート", "ミニマリズム", "オプ・アート", "ヌーヴォー・レアリスム", "空間主義",
  "日本の美術", "浮世絵", "具体", "もの派"];
const GENRE_MIN = 5;      // これより少ないジャンルはボタンを出さない（すぐ終わってしまうため）
const GENRE_KEY = "g:";   // 区分の id とぶつからないよう、ジャンルは "g:印象派" の形で持つ

// 結果の3段階（正解の割合で分ける）。音・アイコン・言葉を段階ごとに変える
const TIERS = [
  { min: 0.8, level: 3, icon: "🏆", title: "すばらしい！", text: "美術史マスターまであと少し。ほかの時代にも挑戦してみましょう。" },
  { min: 0.5, level: 2, icon: "🎨", title: "いい調子！", text: "半分以上正解です。間違えた問題の解説を読むと、次はもっと伸びます。" },
  { min: 0, level: 1, icon: "📚", title: "ここからスタート！", text: "解説と出典を読んで、もう一度挑戦してみましょう。" },
];

// ---- 覚えておく値（Verilogのレジスタにあたる） ----------------------
let state = "select";
let era = null;        // 選んだ区分
let quiz = [];         // 出題するN問（選択肢は並べ替え済み）
let index = 0;         // 今何問目か（0から数える）
let score = 0;         // 正解数
let streak = 0;        // 連続正解の数
let history = [];      // 解いた問題と選んだ答え（結果画面で全問を見返すため。10/31 間違いだけ→全問に）
let lastChoice = null; // ③で表示するため、②で選んだ答え

const app = document.getElementById("app");

// ---- 背景の名画（10/31 フェーズ6-3。一覧は data/backgrounds.js） ----------
const bgLayer = document.getElementById("bg");
let currentBg = null;  // いま背景にしている絵
let viewArt = false;   // 「絵を見る」中か（カードを隠して絵だけを見せる）

// クイズを始めるたび・区分選択に戻るたびに、前と違う絵をランダムに選ぶ
function pickBackground() {
  if (!bgLayer || typeof BACKGROUNDS === "undefined" || BACKGROUNDS.length === 0) return;
  let b;
  do { b = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]; }
  while (BACKGROUNDS.length > 1 && b === currentBg);
  currentBg = b;
  bgLayer.style.backgroundImage = `url("${b.file}")`;
  bgLayer.classList.remove("fade");
  void bgLayer.offsetWidth; // 動きを最初からやり直すため（クラスを付け直しても動かないことがある）
  bgLayer.classList.add("fade");
}

// 画面のいちばん下の「背景: 作者『作品名』」。作品ページへのリンクつき
function bgCredit() {
  if (!currentBg || state === "select" || state === "pick") return el("span"); // 最初の2画面は絵を出さない
  return el("p", { class: "bg-credit" }, [
    el("span", { text: "背景: " }),
    el("a", { href: currentBg.url, target: "_blank", rel: "noopener noreferrer", text: `${currentBg.artist}『${currentBg.title}』（${currentBg.date}）` }),
    el("span", { text: "　メトロポリタン美術館（CC0）" }),
  ]);
}

function setViewArt(on) {
  viewArt = on;
  document.body.classList.toggle("view-art", on);
}

// ---- 効果音（Web Audio API で、その場で音を合成する。音声ファイルは使わない） ----
// 理由: 他のアプリの音を使うと著作権の問題になりうる。合成すればファイルも要らず、すべて自作になる
const SOUND_KEY = "artquiz.sound";
let soundOn = readSoundSetting();
let audioCtx = null;

// 音のオン・オフだけはこの端末に覚えておく（個人を特定する情報ではない）。使えない環境では毎回オン
function readSoundSetting() {
  try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch (e) { return true; }
}
function setSound(on) {
  soundOn = on;
  try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch (e) { /* 保存できなくても動く */ }
}

// notes: [周波数Hz, 開始秒, 長さ秒] の並び
function play(notes, type = "triangle", volume = 0.18) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime + 0.02;
    for (const [freq, start, dur] of notes) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      // 「プツッ」と鳴らないよう、音量を短く立ち上げて、なめらかに消す
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(volume, t0 + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.02);
    }
  } catch (e) { /* 音が出せない環境でもクイズは続ける */ }
}

const SOUNDS = {
  correct: () => play([[1318.5, 0, 0.22], [1046.5, 0.2, 0.9]], "sine", 0.22),         // ピンポーン（高いピン→少し低いポーンを長く。10/31 学習者の希望）
  wrong: () => play([[311, 0, 0.18], [233, 0.16, 0.3]], "sine", 0.2),                 // ポワン（下がる2音・やわらかく）
  tier3: () => play([[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [1047, 0.36, 0.5], [1319, 0.36, 0.5]]), // ファンファーレ
  tier2: () => play([[392, 0, 0.16], [523, 0.15, 0.16], [659, 0.3, 0.4]]),            // 明るい3音
  tier1: () => play([[440, 0, 0.2], [392, 0.18, 0.2], [440, 0.36, 0.4]], "sine", 0.18), // 「また挑戦しよう」の3音
};

// ---- 小さな道具 ----------------------------------------------------

// 配列を混ぜた新しい配列を返す（フィッシャー–イェーツのシャッフル）
function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 要素を作る。文字は textContent で入れる（データの文字がHTMLとして動かないように）
function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "text") e.textContent = v;
    else if (k === "onclick") e.addEventListener("click", v);
    else e.setAttribute(k, v);
  }
  for (const c of children) e.appendChild(c);
  return e;
}

function questionsOf(eraId) {
  if (eraId === ALL) return QUESTIONS;
  if (eraId.startsWith(GENRE_KEY)) {
    const g = eraId.slice(GENRE_KEY.length);
    return QUESTIONS.filter(q => (q.genres || []).includes(g));
  }
  return QUESTIONS.filter(q => q.era === eraId);
}

function tierOf(ratio) {
  return TIERS.find(t => ratio >= t.min);
}

// ---- 遷移（状態を変えて描き直す） -----------------------------------

function startQuiz(eraId) {
  era = eraId;
  const n = Math.min(MAX_QUESTIONS, questionsOf(eraId).length);
  quiz = shuffle(questionsOf(eraId)).slice(0, n).map(q => ({
    ...q,
    choices: shuffle([q.answer, ...q.wrongChoices]),
  }));
  index = 0;
  score = 0;
  streak = 0;
  history = [];
  state = "question";
  pickBackground();
  render();
}

function choose(choice) {
  if (state !== "question") return; // 2回押し対策: ②以外では受け付けない
  const q = quiz[index];
  lastChoice = choice;
  const ok = choice === q.answer;
  history.push({ q, yours: choice, ok });
  if (ok) {
    score++;
    streak++;
    SOUNDS.correct();
  } else {
    streak = 0;
    SOUNDS.wrong();
  }
  state = "answer";
  render();
}

function next() {
  index++;
  state = index < quiz.length ? "question" : "result";
  render();
  if (state === "result") SOUNDS["tier" + tierOf(score / quiz.length).level]();
}

function quit() {
  state = "select";
  pickBackground();
  render();
}

// 「やめる」: 1問でも答えていたら、消えてよいかを先に聞く（10/31 押し間違いで答えが全部消える弱点への対策）
function askQuit() {
  if (history.length === 0 || state === "result") { quit(); return; }
  const keep = el("button", { class: "primary", onclick: () => box.remove(), text: "続ける" });
  const box = el("div", { class: "dialog-backdrop" }, [
    el("div", { class: "dialog", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "quit-title" }, [
      el("h2", { id: "quit-title", text: "クイズをやめますか？" }),
      el("p", { text: `ここまでの答え（${history.length}問）は消えます。` }),
      el("div", { class: "row" }, [
        el("button", { class: "secondary", onclick: quit, text: "やめる" }),
        keep,
      ]),
    ]),
  ]);
  app.appendChild(box);
  keep.focus(); // 間違って Enter を押しても、続ける方になるように
}

// ---- 画面（状態ごとの出力） -----------------------------------------

function render() {
  app.replaceChildren();
  window.scrollTo(0, 0);
  setViewArt(false); // 画面が変わったら「絵を見る」は終わり
  document.body.dataset.state = state; // 出題中は背景を控えめにする（CSS）
  app.appendChild(topbar());
  switch (state) {
    case "select": renderSelect(); break;
    case "pick": renderPick(); break;
    case "question":
    case "answer": renderQuestion(); break;
    case "result": renderResult(); break;
    default: // 想定外の状態（Verilogの default と同じ考え方）
      app.appendChild(el("p", { text: "エラー: 想定外の状態です。ページを読み込み直してください。" }));
  }
  app.appendChild(bgCredit());
}

// アイコンと文字のボタン（10/31 アイコンだけだと意味が伝わりにくいので、文字はいつも出す）
function setIconLabel(button, icon, label) {
  button.replaceChildren(el("span", { "aria-hidden": "true", text: icon }), el("span", { class: "label", text: label }));
}

// 上の帯: アプリ名・絵を見る・音のオン・オフ（どの画面でも同じ場所）
function topbar() {
  const button = el("button", {
    class: "icon-button",
    "aria-pressed": String(soundOn),
    onclick: () => {
      setSound(!soundOn);
      setIconLabel(button, soundOn ? "🔊" : "🔇", soundOn ? "音あり" : "音なし");
      button.setAttribute("aria-pressed", String(soundOn));
      const note = app.querySelector(".sound-note");
      if (note) note.textContent = soundNote();
      if (soundOn) SOUNDS.correct(); // オンにしたら1回鳴らして知らせる
    },
  });
  setIconLabel(button, soundOn ? "🔊" : "🔇", soundOn ? "音あり" : "音なし");
  // 選択画面は大きな題字があるので、帯のアプリ名は出さない（同じ名前が2つ並ぶため）
  const brand = state === "select" ? el("span") :
    el("p", { class: "brand" }, [el("span", { class: "mark", "aria-hidden": "true", text: "◆" }), el("span", { text: "美術史クイズ" })]);
  // 「絵を見る」: カードを隠して背景の絵だけを見る。もう一度押すと戻る
  const art = el("button", {
    class: "icon-button",
    "aria-pressed": "false",
    onclick: () => {
      setViewArt(!viewArt);
      setIconLabel(art, viewArt ? "✕" : "🖼", viewArt ? "戻る" : "絵を見る");
      art.setAttribute("aria-pressed", String(viewArt));
    },
  });
  setIconLabel(art, "🖼", "絵を見る");
  // 最初の2画面は絵を出さないので「絵を見る」も出さない
  const showsArt = currentBg && state !== "select" && state !== "pick";
  const tools = el("div", { class: "tools" }, showsArt ? [art, button] : [button]);
  return el("div", { class: "topbar" }, [brand, tools]);
}

function menuButton(label, count, onclick) {
  return el("button", { class: "menu-item", onclick }, [
    el("span", { text: label }),
    el("span", { class: "count", text: `${count}問` }),
  ]);
}

let pickType = "era"; // 2段目の画面で出す一覧（"era" 時代 / "genre" ジャンル）

// 1段目 → 2段目（10/31 学習者「ボタンが多い。まず時代かジャンルかの2つで選び、次で選択肢を出す」）
function openPick(type) {
  pickType = type;
  state = "pick";
  render();
}
function backToSelect() {
  state = "select";
  render();
}

function soundNote() {
  return soundOn ? "♪ 正解・不正解で効果音が鳴ります。右上の「音あり」で消せます。"
    : "♪ いまは音なしです。右上の「音なし」を押すと効果音が鳴ります。";
}

function availableGenres() {
  return GENRES.filter(g => questionsOf(GENRE_KEY + g).length >= GENRE_MIN);
}

// 1段目: 「時代で選ぶ」「ジャンルで選ぶ」の2つだけ（10/31）
function renderSelect() {
  app.appendChild(el("div", { class: "hero" }, [
    el("div", { class: "frame" }, [el("h1", { text: "美術史クイズ" })]),
    el("p", { text: "4択で答える美術史のクイズ。1回10問、1問ごとに解説と出典つき。" }),
  ]));

  const eraCount = ERAS.filter(e => questionsOf(e.id).length > 0).length;
  app.appendChild(el("div", { class: "choose-way" }, [
    el("button", { class: "way", onclick: () => openPick("era") }, [
      el("span", { class: "way-icon", "aria-hidden": "true", text: "🏛" }),
      el("span", { class: "way-text" }, [
        el("span", { class: "way-title", text: "時代で選ぶ" }),
        el("span", { class: "way-sub", text: `14世紀から第二次大戦後まで ${eraCount}つの時代` }),
      ]),
      el("span", { class: "way-arrow", "aria-hidden": "true", text: "›" }),
    ]),
    el("button", { class: "way", onclick: () => openPick("genre") }, [
      el("span", { class: "way-icon", "aria-hidden": "true", text: "🎨" }),
      el("span", { class: "way-text" }, [
        el("span", { class: "way-title", text: "ジャンルで選ぶ" }),
        el("span", { class: "way-sub", text: `印象派・浮世絵など ${availableGenres().length}種類` }),
      ]),
      el("span", { class: "way-arrow", "aria-hidden": "true", text: "›" }),
    ]),
  ]));

  // 画面の下に、音の注意と「このアプリについて」を同じ形でそろえて置く（10/31 学習者の希望）
  // 音の注意は、電車の中などで驚かないように先に知らせるため
  const foot = el("div", { class: "home-foot" }, [el("p", { class: "foot-item sound-note", text: soundNote() })]);
  app.appendChild(foot);

  // このアプリについて（10/30 公開の準備で追加。レクチャー/フェーズ6-1）。開いたときだけ読めるよう details にする
  const about = [
    "問題と解説は、各問題の出典（美術館などのページ）を読んで確かめた事実をもとに、自分の言葉で書いています。解説のあとに出典へのリンクがあります。",
    "作るときにAI（Claude）を使いました。出典との照らし合わせはしていますが、誤りが残っている可能性があります。正確な情報は出典のページでご確認ください。",
    "出典にしている美術館などとは関係のない、個人が作ったアプリです。",
    "音のオン・オフの設定だけを、この端末のブラウザに保存します。名前・成績などの情報は、保存も送信もしません。",
    "画面の作りは、デジタル庁デザインシステムのガイドライン（https://design.digital.go.jp/dads/）を参考にしました。効果音はこのアプリのために合成したものです。",
    "背景の絵は、メトロポリタン美術館のオープンアクセス（CC0。著作権の切れた作品の画像を誰でも使える仕組み）の画像を、小さくして使っています。作品名は画面の下に出します。",
  ];
  foot.appendChild(el("details", { class: "foot-item about" }, [
    el("summary", { text: "このアプリについて" }),
    ...about.map(t => el("p", { text: t })),
  ]));
}

// 2段目: 選んだ方の一覧。左上の「もどる」で1段目へ
function renderPick() {
  app.appendChild(el("div", { class: "pick-head" }, [
    el("button", { class: "tertiary small-button", onclick: backToSelect, text: "‹ もどる" }),
    el("h1", { class: "pick-title", text: pickType === "era" ? "時代で選ぶ" : "ジャンルで選ぶ" }),
  ]));

  if (pickType === "era") {
    const eraMenu = el("div", { class: "menu" });
    for (const e of [...ERAS, { id: ALL, label: "全時代ミックス" }]) {
      const count = questionsOf(e.id).length;
      if (count === 0) continue; // 0問の区分はボタンを出さない（設計3）
      eraMenu.appendChild(menuButton(e.label, count, () => startQuiz(e.id)));
    }
    app.appendChild(eraMenu);
    app.appendChild(el("p", { class: "muted small", text: "時代区分は、国立西洋美術館の作品紹介の分け方を参考にしました。" }));
  } else {
    // ジャンルで選ぶ（出典で様式などが確かめられた問題だけが入る）
    const genreMenu = el("div", { class: "menu genres" });
    for (const g of availableGenres()) genreMenu.appendChild(menuButton(g, questionsOf(GENRE_KEY + g).length, () => startQuiz(GENRE_KEY + g)));
    app.appendChild(genreMenu);
    app.appendChild(el("p", { class: "muted small", text: "ジャンルは、出典の美術館などのページで確かめられた問題にだけ付けています。" }));
  }
}

// 出題（②）と正誤・解説（③）は同じ画面。③では選択肢に正解・あなたの答えの印を付け、下に解説を出す
function renderQuestion() {
  const q = quiz[index];
  const answered = state === "answer";
  const ok = answered && lastChoice === q.answer;

  // 進み具合（③では今の問題も終わった分として数える）
  const done = index + (answered ? 1 : 0);
  // 「やめる」は上に置く（10/31 下の「次へ」の隣だと押し間違えやすかったため）
  app.appendChild(el("div", { class: "quiz-head" }, [
    el("button", { class: "tertiary small-button", onclick: askQuit, text: "やめる" }),
    el("div", {
      class: "progress", role: "progressbar", "aria-label": "進み具合",
      "aria-valuemin": "0", "aria-valuemax": String(quiz.length), "aria-valuenow": String(done),
    }, [el("div", { class: "progress-bar", style: `width: ${(done / quiz.length) * 100}%` })]),
    el("span", { class: "counter", text: `${index + 1} / ${quiz.length}` }),
  ]));
  if (streak >= 2) app.appendChild(el("p", { class: "streak" + (ok ? " pop" : ""), text: `★ ${streak}問連続正解！` }));

  const card = el("div", { class: "card" }, [el("h2", { class: "question", text: q.question })]);
  const list = el("div", { class: "choices" });
  q.choices.forEach((c, i) => {
    let cls = "choice";
    let mark = "";
    if (answered) {
      if (c === q.answer) { cls += " is-correct" + (ok ? " pop" : ""); mark = "✓ 正解"; }
      else if (c === lastChoice) { cls += " is-wrong shake"; mark = "✕ あなたの答え"; }
      else cls += " is-dim";
    }
    const b = el("button", { class: cls, "data-choice": c, onclick: () => choose(c) }, [
      el("span", { class: "key", "aria-hidden": "true", text: "ABCD"[i] }),
      el("span", { text: c }),
    ]);
    if (mark) b.appendChild(el("span", { class: "mark", text: mark }));
    if (answered) b.disabled = true;
    list.appendChild(b);
  });
  card.appendChild(list);

  if (answered) card.appendChild(feedback(q, ok));
  app.appendChild(card);

  const isLast = index + 1 >= quiz.length;
  // 答えたあとは「次へ」だけを画面の下に貼りつける（長い解説を読んでいる途中でもすぐ押せるように）
  if (answered) {
    app.appendChild(el("div", { class: "row sticky" }, [
      el("button", { class: "primary", onclick: next, text: isLast ? "結果を見る" : "次へ" }),
    ]));
  }

  // 答えたら、解説のパネルが見えるところまで動かす（スマホでは下に隠れるため）
  if (answered) {
    const panel = card.querySelector(".feedback");
    if (panel.scrollIntoView) panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function feedback(q, ok) {
  const panel = el("div", { class: "feedback rise " + (ok ? "ok" : "ng"), role: "status" }, [
    el("p", { class: "verdict" }, [
      el("span", { class: "badge", "aria-hidden": "true", text: ok ? "✓" : "✕" }),
      el("span", { text: ok ? "正解！" : "不正解" }),
    ]),
    el("p", { class: "answer-line", text: `正しい答え: ${q.answer}` }),
  ]);
  if (!ok) panel.appendChild(el("p", { text: `あなたの答え: ${lastChoice}` }));
  panel.appendChild(el("p", { class: "explanation", text: q.explanation }));

  // 出典（新しいタブで開く。クイズの画面が消えないように）
  const list = el("ul", { class: "sources" });
  for (const s of q.sources) {
    list.appendChild(el("li", {}, [
      el("span", { text: "出典: " }),
      el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer", text: s.name }),
      el("span", { text: `（${s.accessed} 閲覧）` }),
    ]));
  }
  panel.appendChild(list);
  return panel;
}

function renderResult() {
  const ratio = score / quiz.length;
  const tier = tierOf(ratio);
  const card = el("div", { class: `card result tier-${tier.level}` }, [
    el("p", { class: "tier-icon bounce", "aria-hidden": "true", text: tier.icon }),
    el("h1", { class: "tier-title", text: score === quiz.length ? "満点！" : tier.title }),
    el("p", { class: "score" }, [document.createTextNode(String(score)), el("small", { text: ` / ${quiz.length}` })]),
    el("p", { class: "muted", text: `${quiz.length}問中 ${score}問正解（${Math.round(ratio * 100)}%）` }),
    el("p", { text: tier.text }),
  ]);
  app.appendChild(card);
  // ボタンは見返しの上に置く（10問の見返しの下だと、スクロールしないと押せないため）
  app.appendChild(el("div", { class: "row" }, [
    el("button", { class: "secondary", onclick: quit, text: "区分選択へ" }),
    el("button", { class: "primary", onclick: () => startQuiz(era), text: "もう一度" }),
  ]));

  // 全問の見返し（10/31 学習者の希望）。1問ずつ別の枠にし、番号と「正解／不正解」を見出しに置く
  // 理由: 区切りがないと、どの答えがどの問題のものか分かりにくかったため
  app.appendChild(el("h2", { class: "review-title", text: `${quiz.length}問の見返し` }));
  history.forEach((h, i) => {
    const item = el("section", { class: "review-item " + (h.ok ? "ok" : "ng") }, [
      el("div", { class: "review-head" }, [
        el("span", { class: "review-no", text: `第${i + 1}問` }),
        el("span", { class: "review-verdict", text: h.ok ? "✓ 正解" : "✕ 不正解" }),
      ]),
      el("p", { class: "review-question", text: h.q.question }),
    ]);
    const answers = el("dl", { class: "review-answers" }, [
      el("dt", { text: "あなたの答え" }), el("dd", { text: h.yours }),
    ]);
    if (!h.ok) answers.append(el("dt", { text: "正しい答え" }), el("dd", { class: "right", text: h.q.answer }));
    item.appendChild(answers);
    // 解説は開いたときだけ（10問分を全部出すと長くなりすぎるため）
    item.appendChild(el("details", { class: "review-more" }, [
      el("summary", { text: "解説と出典を見る" }),
      el("p", { text: h.q.explanation }),
      el("ul", { class: "sources" }, h.q.sources.map(s => el("li", {}, [
        el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer", text: s.name }),
      ]))),
    ]));
    app.appendChild(item);
  });

  if (tier.level === 3) confetti();
}

// 紙吹雪（いちばん上の段階のときだけ。CSS で「動きを減らす」設定の人には出さない）
function confetti() {
  const colors = ["#c99a2e", "#7a2337", "#1e6b38", "#3a6ea5", "#e07a5f"];
  const box = el("div", { class: "confetti", "aria-hidden": "true" });
  for (let i = 0; i < 40; i++) {
    const piece = el("i", {
      style: `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random() * 0.6}s;`,
    });
    box.appendChild(piece);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3500);
}

// ---- 起動 ----------------------------------------------------------
// データが読めなかった場合（ファイルがない、書き間違いなど）も、真っ白にせず理由を出す
if (typeof QUESTIONS === "undefined" || !Array.isArray(QUESTIONS)) {
  app.replaceChildren(el("p", { text: "問題データ（data/questions.js）を読み込めませんでした。" }));
} else {
  pickBackground();
  render();
}
