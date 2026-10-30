// 美術史クイズ v1
// 画面の流れは設計3（レクチャー/設計3_画面の流れ.md）のステートマシンそのまま。
//   状態: "select"（①区分選択） → "question"（②出題） → "answer"（③正誤・解説） → "result"（④結果）

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

// ---- 覚えておく値（Verilogのレジスタにあたる） ----------------------
let state = "select";
let era = null;        // 選んだ区分
let quiz = [];         // 出題するN問（選択肢は並べ替え済み）
let index = 0;         // 今何問目か（0から数える）
let score = 0;         // 正解数
let mistakes = [];     // 間違えた問題と選んだ答え
let lastChoice = null; // ③で表示するため、②で選んだ答え

const app = document.getElementById("app");

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
  mistakes = [];
  state = "question";
  render();
}

function choose(choice) {
  if (state !== "question") return; // 2回押し対策: ②以外では受け付けない
  const q = quiz[index];
  lastChoice = choice;
  if (choice === q.answer) score++;
  else mistakes.push({ question: q.question, yours: choice, correct: q.answer });
  state = "answer";
  render();
}

function next() {
  index++;
  state = index < quiz.length ? "question" : "result";
  render();
}

function quit() {
  state = "select";
  render();
}

// ---- 画面（状態ごとの出力） -----------------------------------------

function render() {
  app.replaceChildren();
  window.scrollTo(0, 0);
  switch (state) {
    case "select": renderSelect(); break;
    case "question": renderQuestion(); break;
    case "answer": renderAnswer(); break;
    case "result": renderResult(); break;
    default: // 想定外の状態（Verilogの default と同じ考え方）
      app.appendChild(el("p", { text: "エラー: 想定外の状態です。ページを読み込み直してください。" }));
  }
}

function renderSelect() {
  app.appendChild(el("h1", { text: "美術史クイズ" }));
  app.appendChild(el("p", { class: "muted", text: "時代を選ぶと、最大10問を出題します。1問ごとに解説と出典を表示します。" }));

  const card = el("div", { class: "card" });
  const options = [...ERAS, { id: ALL, label: "全時代ミックス" }];
  for (const e of options) {
    const count = questionsOf(e.id).length;
    if (count === 0) continue; // 0問の区分はボタンを出さない（設計3）
    card.appendChild(el("button", { class: "choice", onclick: () => startQuiz(e.id) }, [
      el("span", { text: e.label }),
      el("span", { class: "count", text: `${count}問` }),
    ]));
  }
  app.appendChild(card);
  app.appendChild(el("p", { class: "muted", text: "時代区分は、国立西洋美術館の作品紹介の分け方を参考にしました。" }));

  // ジャンルで選ぶ（出典で様式などが確かめられた問題だけが入る）
  const genres = GENRES.filter(g => questionsOf(GENRE_KEY + g).length >= GENRE_MIN);
  if (genres.length > 0) {
    app.appendChild(el("h2", { class: "section", text: "ジャンルで選ぶ" }));
    const gcard = el("div", { class: "card" });
    for (const g of genres) {
      gcard.appendChild(el("button", { class: "choice", onclick: () => startQuiz(GENRE_KEY + g) }, [
        el("span", { text: g }),
        el("span", { class: "count", text: `${questionsOf(GENRE_KEY + g).length}問` }),
      ]));
    }
    app.appendChild(gcard);
    app.appendChild(el("p", { class: "muted", text: "ジャンルは、出典の美術館などのページで確かめられた問題にだけ付けています。" }));
  }

  // このアプリについて（10/30 公開の準備で追加。レクチャー/フェーズ6-1）。開いたときだけ読めるよう details にする
  const about = [
    "問題と解説は、各問題の出典（美術館などのページ）を読んで確かめた事実をもとに、自分の言葉で書いています。解説のあとに出典へのリンクがあります。",
    "作るときにAI（Claude）を使いました。出典との照らし合わせはしていますが、誤りが残っている可能性があります。正確な情報は出典のページでご確認ください。",
    "出典にしている美術館などとは関係のない、個人が作ったアプリです。",
    "名前・成績などの情報は、保存も送信もしません。",
  ];
  app.appendChild(el("details", { class: "about" }, [
    el("summary", { text: "このアプリについて" }),
    ...about.map(t => el("p", { class: "muted", text: t })),
  ]));
}

function progress() {
  return el("p", { class: "muted", text: `${index + 1} / ${quiz.length}` });
}

function renderQuestion() {
  const q = quiz[index];
  app.appendChild(progress());
  const card = el("div", { class: "card" }, [el("h2", { text: q.question })]);
  q.choices.forEach((c, i) => {
    const mark = "ABCD"[i];
    card.appendChild(el("button", { class: "choice", onclick: () => choose(c), text: `${mark}. ${c}` }));
  });
  app.appendChild(card);
  app.appendChild(el("div", { class: "row" }, [
    el("button", { class: "secondary", onclick: quit, text: "やめる" }),
  ]));
}

function renderAnswer() {
  const q = quiz[index];
  const ok = lastChoice === q.answer;
  app.appendChild(progress());

  const card = el("div", { class: "card" }, [
    el("p", { class: ok ? "result-correct" : "result-wrong", text: ok ? "正解！" : "不正解" }),
    el("p", { text: `正しい答え: ${q.answer}` }),
  ]);
  if (!ok) card.appendChild(el("p", { class: "muted", text: `あなたの答え: ${lastChoice}` }));
  card.appendChild(el("p", { text: q.explanation }));

  // 出典（新しいタブで開く。クイズの画面が消えないように）
  const list = el("ul", { class: "sources" });
  for (const s of q.sources) {
    list.appendChild(el("li", {}, [
      el("span", { text: "出典: " }),
      el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer", text: s.name }),
      el("span", { text: `（${s.accessed} 閲覧）` }),
    ]));
  }
  card.appendChild(list);
  app.appendChild(card);

  const isLast = index + 1 >= quiz.length;
  app.appendChild(el("div", { class: "row" }, [
    el("button", { class: "secondary", onclick: quit, text: "やめる" }),
    el("button", { class: "primary", onclick: next, text: isLast ? "結果を見る" : "次へ" }),
  ]));
}

function renderResult() {
  app.appendChild(el("h1", { text: "結果" }));
  const card = el("div", { class: "card" }, [
    el("h2", { text: `${quiz.length}問中 ${score}問正解` }),
  ]);
  if (mistakes.length === 0) {
    card.appendChild(el("p", { text: "全問正解です！" }));
  } else {
    card.appendChild(el("p", { class: "muted", text: "間違えた問題" }));
    for (const m of mistakes) {
      card.appendChild(el("div", { class: "mistake" }, [
        el("p", { text: m.question }),
        el("p", { class: "muted", text: `あなたの答え: ${m.yours}` }),
        el("p", { text: `正しい答え: ${m.correct}` }),
      ]));
    }
  }
  app.appendChild(card);
  app.appendChild(el("div", { class: "row" }, [
    el("button", { class: "secondary", onclick: quit, text: "区分選択へ" }),
    el("button", { class: "primary", onclick: () => startQuiz(era), text: "もう一度" }),
  ]));
}

// ---- 起動 ----------------------------------------------------------
// データが読めなかった場合（ファイルがない、書き間違いなど）も、真っ白にせず理由を出す
if (typeof QUESTIONS === "undefined" || !Array.isArray(QUESTIONS)) {
  app.replaceChildren(el("p", { text: "問題データ（data/questions.js）を読み込めませんでした。" }));
} else {
  render();
}
