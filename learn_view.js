// 美術を学ぶ（10/31 学習者「クイズに正答するための勉強も必要。学ぶ場所を作ろう」）
// 設計書/2026-10-31_美術を学ぶ_設計.md・作業計画.md のタスク2
// 流れ: 最初の画面「美術を学ぶ」→ 時代を選ぶ（learnEras）→ 画家を選ぶ（learnArtists）→ 画家のページ（learnArtist）
// app.js の el・ERAS・WORKS・ARTISTS・QUESTIONS などを使う。app.js より先に読み込むが、使うのは押したあとなので問題ない
// 載せるのは裏付けのある情報だけ: 館のデータ（名前・国・生没年・絵）、確認済みの問題の解説、確認に合格した文章（data/learn.js）

let learnEra = null;        // 選んだ時代の id
let learnArtistKey = null;  // 見ている画家の key
let learnReturn = null;     // クイズから来たときの戻り先 { state, index }（「もどる」で同じ問題・結果画面へ。解いた分を消さないため）

// 画家の時代: その画家の作品の年の真ん中（artistYear）で決める（設計書 4章）
// 理由: 生まれた年だと、晩年に活躍した人がずれるため
function eraOfArtist(key) {
  const y = artistYear(key);
  if (y < 1600) return "c14-16";
  if (y < 1700) return "c17";
  if (y < 1800) return "c18";
  if (y <= 1945) return "c19-20";
  return "c20post";
}

// その時代の画家（名前の五十音順）
function artistsOfEra(eraId) {
  return Object.keys(ARTISTS).filter(k => WORKS.some(w => w.artist === k) && eraOfArtist(k) === eraId)
    .sort((a, b) => ARTISTS[a].name.localeCompare(ARTISTS[b].name, "ja"));
}

// 確認に合格した文章（3つの部分と出典がそろっているものだけ。欠けていたら「準備中」として扱う）
function learnTextOf(key) {
  if (typeof LEARN === "undefined") return null;
  const t = LEARN.find(x => x.artist === key);
  if (!t || !t.where || !t.works || !t.tips || !Array.isArray(t.sources) || t.sources.length === 0) return null;
  return t;
}

// 「美術史に挑戦」でこの画家が出てくる問題（問題文か解説に名前がある、公開中＝確認済みの問題）
// LEARN_EXCLUDE: 名前が別の言葉の一部と重なって一致してしまう問題（Claude が全件読んで決めた）
function relatedQuestions(key) {
  const name = ARTISTS[key].name;
  const skip = (typeof LEARN_EXCLUDE !== "undefined" && LEARN_EXCLUDE[key]) || [];
  return QUESTIONS.filter(q => (q.question + q.explanation).includes(name) && !skip.includes(q.id));
}

// ---- 遷移 ----
function openLearn() {
  learnReturn = null;
  state = "learnEras";
  render();
}
function openLearnEra(eraId) {
  learnReturn = null;
  learnEra = eraId;
  state = "learnArtists";
  render();
}
// opts.fromQuiz: クイズの答えの画面・結果の見返しから来た（もどるでそこへ戻る）
function openLearnArtist(key, opts = {}) {
  learnReturn = opts.fromQuiz ? { state, index } : null;
  learnArtistKey = key;
  learnEra = eraOfArtist(key);
  state = "learnArtist";
  render();
}
function backFromArtist() {
  if (!learnReturn) { openLearnEra(learnEra); return; }
  state = learnReturn.state;
  index = learnReturn.index;
  learnReturn = null;
  render();
}

function learnHead(title, onBack) {
  return el("div", { class: "pick-head" }, [
    el("button", { class: "tertiary small-button", onclick: onBack, text: "‹ もどる" }),
    el("h1", { class: "pick-title", text: title }),
  ]);
}

// ---- 画面 ----
function renderLearnEras() {
  app.appendChild(learnHead("美術を学ぶ", backToSelect));
  app.appendChild(el("p", { class: "muted", text: "時代を選ぶと、その時代の画家が出ます。画家の作品の年の真ん中で時代を分けています。" }));
  const menu = el("div", { class: "menu" });
  for (const e of ERAS) {
    const n = artistsOfEra(e.id).length;
    if (n === 0) continue; // 画家0人の時代は出さない（設計書 3章）
    menu.appendChild(el("button", { class: "menu-item learn-era", onclick: () => openLearnEra(e.id) }, [
      el("span", { text: e.label }),
      el("span", { class: "count", text: `${n}人` }),
    ]));
  }
  app.appendChild(menu);
}

function renderLearnArtists() {
  const e = ERAS.find(x => x.id === learnEra);
  app.appendChild(learnHead(e ? e.label : "画家を選ぶ", openLearn));
  const list = el("div", { class: "learn-artists" });
  for (const k of artistsOfEra(learnEra)) {
    const first = WORKS.find(w => w.artist === k);
    list.appendChild(el("button", { class: "learn-artist", "data-artist": k, onclick: () => openLearnArtist(k) }, [
      el("img", { src: first.file, alt: "", loading: "lazy" }),
      el("span", { class: "learn-artist-name", text: ARTISTS[k].name }),
      el("span", { class: "way-arrow", "aria-hidden": "true", text: "›" }),
    ]));
  }
  app.appendChild(list);
}

function renderLearnArtist() {
  const k = learnArtistKey;
  const a = ARTISTS[k];
  // 上の見出しは時代（どの一覧に戻るかがわかるように）。名前は下のカードに大きく出す（同じ名前が2つ並ばないように）
  const era = ERAS.find(x => x.id === learnEra);
  app.appendChild(learnHead(era ? era.label.replace(/（.*）$/, "") : "画家", backFromArtist));

  // 名前・国・生没年（館のデータ）
  const facts = [a.nation, `${a.born}年〜${a.died}年`].filter(Boolean).join("　");
  app.appendChild(el("div", { class: "card learn-head" }, [
    el("p", { class: "learn-name", text: a.name }),
    el("p", { class: "muted", text: facts }),
  ]));

  // 1分で読める文章（確認に合格したものだけ）
  const t = learnTextOf(k);
  if (t) {
    app.appendChild(el("section", { class: "card learn-text" }, [
      el("h2", { text: "どこの国・いつの人" }), el("p", { text: t.where }),
      el("h2", { text: "どんな絵を描いたか" }), el("p", { text: t.works }),
      el("h2", { text: "見分けるコツ" }), el("p", { text: t.tips }),
      el("ul", { class: "sources" }, t.sources.map(s => el("li", {}, [
        el("span", { text: "出典: " }),
        el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer", text: s.name }),
        el("span", { text: `（${s.accessed} 閲覧）` }),
      ]))),
    ]));
  } else {
    app.appendChild(el("p", { class: "card learn-pending", text: "この画家の解説は準備中です。出典で確かめ終わったものから順に載せます。" }));
  }

  // 絵の一覧（タップで大きく）
  const works = WORKS.filter(w => w.artist === k);
  app.appendChild(el("h2", { class: "review-title", text: `作品（${works.length}点）` }));
  app.appendChild(el("div", { class: "learn-gallery" }, works.map(w =>
    el("button", { class: "learn-work", onclick: () => showWork(w), "aria-label": `${w.title}（${w.date}）を大きく見る` }, [
      el("img", { src: w.file, alt: "", loading: "lazy" }),
    ]))));

  // 「美術史に挑戦」でこの画家が出てくる解説
  const rel = relatedQuestions(k);
  if (rel.length > 0) {
    app.appendChild(el("h2", { class: "review-title", text: "「美術史に挑戦」に出てくる話" }));
    app.appendChild(el("div", { class: "learn-related" }, rel.map(q => el("section", { class: "review-item related-item" }, [
      el("p", { class: "review-question", text: q.question }),
      el("p", { text: `答え: ${q.answer}` }),
      el("p", { text: q.explanation }),
      el("ul", { class: "sources" }, q.sources.map(s => el("li", {}, [
        el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer", text: s.name }),
      ]))),
    ]))));
  }

  // この時代のクイズに挑戦（その時代の問題があるときだけ）
  const eraId = eraOfArtist(k);
  if (questionsOf(eraId).length > 0) {
    app.appendChild(el("div", { class: "row" }, [
      el("button", { class: "primary", onclick: () => startQuiz(eraId), text: "この時代のクイズに挑戦" }),
    ]));
  }
}

// 絵を大きく見る（題名・年・出典リンクつき）。「閉じる」で戻る
function showWork(w) {
  const close = el("button", { class: "secondary", onclick: () => box.remove(), text: "閉じる" });
  const box = el("div", { class: "dialog-backdrop learn-viewer" }, [
    el("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-label": w.title }, [
      el("img", { src: w.file, alt: w.title }),
      el("p", { text: workLabel(w) }),
      el("p", { class: "small" }, [el("a", { href: w.url, target: "_blank", rel: "noopener noreferrer", text: `出典: ${w.museum}` })]),
      el("div", { class: "row" }, [close]),
    ]),
  ]);
  app.appendChild(box);
  close.focus();
}
