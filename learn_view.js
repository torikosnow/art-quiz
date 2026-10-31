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
// 10/31 点検の指摘: 答え（answer）にも名前を探す。短い呼び名（LEARN_ALIASES）も使う。全角・半角の＝はそろえて比べる
function relatedQuestions(key) {
  const norm = s => String(s).replace(/＝/g, "=");
  const aliases = (typeof LEARN_ALIASES !== "undefined" && LEARN_ALIASES[key]) || [];
  const names = [ARTISTS[key].name, ...aliases].map(norm);
  const skip = (typeof LEARN_EXCLUDE !== "undefined" && LEARN_EXCLUDE[key]) || [];
  return QUESTIONS.filter(q => {
    const text = norm([q.question, q.answer, q.explanation].join("\n")); // 区切りを入れてつなぐ（つなぎ目をまたいで一致しないように）
    return names.some(n => text.includes(n)) && !skip.includes(q.id);
  });
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
  const head = learnHead(era ? era.label.replace(/（.*）$/, "") : "画家", backFromArtist);
  app.appendChild(head);
  // 場所へ飛ぶバー（11/1 学習者「横にバーをつけてスライドできるように」）。上の帯（もどる）と一緒に画面の上に固定する
  // 飛び先は下で作る各部分の id。ない部分（関連する話が0件など）のボタンは出さない（下で消す）
  const tabDefs = [["learn-sec-text", "解説"], ["learn-sec-works", "作品"], ["learn-sec-related", "美術史の話"], ["learn-sec-quiz", "クイズ"]];
  const tabBar = el("nav", { class: "learn-tabs", "aria-label": "このページの中の場所" }, tabDefs.map(([id, label]) =>
    el("button", { class: "learn-tab", "data-target": id, onclick: () => scrollToSection(id), text: label })));
  head.appendChild(tabBar);

  // 名前・国・生没年（館のデータ）
  const facts = [a.nation, `${a.born}年〜${a.died}年`].filter(Boolean).join("　");
  app.appendChild(el("div", { class: "card learn-head" }, [
    el("p", { class: "learn-name", text: a.name }),
    el("p", { class: "muted", text: facts }),
    // 生年は館によって1年ずれることがある（例 ボッティチェリ: ワシントンは1446年、ロンドンとウフィツィは1445年）。出どころを書く
    el("p", { class: "muted small", text: `国・生没年: ${MUSEUM_NGA}のデータ` }),
  ]));

  // 1分で読める文章（確認に合格したものだけ）
  const t = learnTextOf(k);
  if (t) {
    app.appendChild(el("section", { class: "card learn-text", id: "learn-sec-text" }, [
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
    app.appendChild(el("p", { class: "card learn-pending", id: "learn-sec-text", text: "この画家の解説は準備中です。出典で確かめ終わったものから順に載せます。" }));
  }

  // 絵の一覧（タップで大きく）。11/1 から横にスライドする1列（20〜40点ある画家でもページが長くなりすぎないように）
  const works = WORKS.filter(w => w.artist === k);
  app.appendChild(el("h2", { class: "review-title", id: "learn-sec-works", text: `作品（${works.length}点）` }));
  if (works.length > 2) app.appendChild(el("p", { class: "muted small swipe-hint", text: "横にスライドすると、ほかの作品も見られます ›" }));
  app.appendChild(el("div", { class: "learn-gallery" }, works.map(w =>
    el("button", { class: "learn-work", onclick: () => showWork(w), "aria-label": `${w.title}（${w.date}）を大きく見る` }, [
      el("img", { src: w.file, alt: "", loading: "lazy" }),
    ]))));

  // 「美術史に挑戦」でこの画家が出てくる解説
  const rel = relatedQuestions(k);
  if (rel.length > 0) {
    app.appendChild(el("h2", { class: "review-title", id: "learn-sec-related", text: "「美術史に挑戦」に出てくる話" }));
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
  // クイズの途中から来たときは出さない（押すと解いている途中の答えが確認なしで消えるため。10/31 点検の指摘）
  if (questionsOf(eraId).length > 0 && !learnReturn) {
    app.appendChild(el("div", { class: "row", id: "learn-sec-quiz" }, [
      el("button", { class: "primary", onclick: () => startQuiz(eraId), text: "この時代のクイズに挑戦" }),
    ]));
  }

  // 前後の画家（同じ時代の一覧の順。11/1 続けて読めるように）。クイズから来たときは出さない（もどるでクイズに戻れなくなるため）
  if (!learnReturn) {
    const list = artistsOfEra(learnEra);
    const i = list.indexOf(k);
    const prev = list[i - 1], next = list[i + 1];
    app.appendChild(el("div", { class: "learn-nav" }, [
      prev ? el("button", { class: "secondary", onclick: () => openLearnArtist(prev), text: `‹ 前の画家（${ARTISTS[prev].name}）` }) : el("span"),
      next ? el("button", { class: "secondary", onclick: () => openLearnArtist(next), text: `次の画家（${ARTISTS[next].name}） ›` }) : el("span"),
    ]));
  }

  // 飛び先のない部分のボタンを消す（関連する話が0件、クイズの問題がない時代、クイズから来たとき）
  for (const b of [...tabBar.children]) if (!document.getElementById(b.dataset.target)) b.remove();
  markCurrentTab();
}

// バーのボタンを押したら、その部分へ。上に固定した帯の高さ分ずらして止める（CSS の scroll-margin-top）
function scrollToSection(id) {
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

// いま読んでいる部分のボタンを光らせる（帯のすぐ下より上に来た最後の部分）
function markCurrentTab() {
  if (state !== "learnArtist") return;
  const bar = app.querySelector(".learn-tabs");
  if (!bar) return;
  // 帯のすぐ下から 40px までに見出しが来たら「その部分にいる」とする（飛んだときの止まり位置 scroll-margin-top より少し下まで見る）
  const headBottom = app.querySelector(".pick-head").getBoundingClientRect().bottom + 40;
  let current = bar.children[0];
  for (const b of bar.children) {
    const sec = document.getElementById(b.dataset.target);
    if (sec && sec.getBoundingClientRect().top <= headBottom) current = b;
  }
  // いちばん下までスクロールしたら最後のボタン（最後の部分は短くて上まで来ないことがあるため）
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = bar.children[bar.children.length - 1];
  for (const b of bar.children) b.setAttribute("aria-current", b === current ? "true" : "false");
  current.scrollIntoView({ block: "nearest", inline: "nearest" }); // バーが横にはみ出しているとき、光ったボタンを見える位置へ
}
window.addEventListener("scroll", () => markCurrentTab(), { passive: true });

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
