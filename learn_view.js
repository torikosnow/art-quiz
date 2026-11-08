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
  const tabDefs = [["learn-sec-text", "解説"], ["learn-sec-roadmap", "年表"], ["learn-sec-works", "作品"], ["learn-sec-related", "美術史の話"], ["learn-sec-quiz", "クイズ"]];
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

  // 人生のロードマップ（11/8 学習者の案。確認に合格した年表があるときだけ）
  const tl = timelineOf(k);
  if (tl) app.appendChild(renderRoadmap(tl));

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

// ---- 人生のロードマップ（11/8 学習者の案「どの時代の、どんな出来事の中で、どんな絵を描いたか」） ----
// 見た目: 年ごとの箱が矢印でつながるブロック図。「次へ」で1つずつポンと現れる（学習者「ポンポンポンって飛んでいく」）
// 理由: 全部を一度に見せるより「次は何が起きた？」と思いながら読めて、印象に残るため（クイズで答えを先に見せないのと同じ）
// 世の中の出来事（world）は点線の箱にして、画家本人の話ではないと一目でわかるようにする。
// 出来事どうしは「並べて置くだけ」。つながり（〜の影響で）は、出典にそう書いてあるときだけ detail に書く（年表の共通指示.md）
const ROADMAP_KIND = { life: "人生", work: "作品", world: "世の中" };

// 確認に合格した年表（出来事と出典がそろっているものだけ）
function timelineOf(key) {
  if (typeof TIMELINE === "undefined") return null;
  const t = TIMELINE.find(x => x.artist === key);
  if (!t || !Array.isArray(t.events) || t.events.length === 0 || !Array.isArray(t.sources) || t.sources.length === 0) return null;
  return t;
}

function renderRoadmap(tl) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sec = el("section", { class: "card roadmap", id: "learn-sec-roadmap" }, [
    el("h2", { text: "人生のロードマップ" }),
    el("p", { class: "muted small", text: "「次へ」を押すと、年の順に出来事が1つずつ出てきます。箱を押すと、くわしい説明が開きます。" }),
    el("p", { class: "roadmap-legend small" }, [
      el("span", { class: "roadmap-swatch own", "aria-hidden": "true" }), el("span", { text: "画家の人生と作品" }),
      el("span", { class: "roadmap-swatch world", "aria-hidden": "true" }), el("span", { text: "世の中の出来事" }),
    ]),
  ]);

  // 箱と矢印を交互に並べる。見せる・隠すは hidden（隠れている箱は読み上げもされない）
  const flow = el("ol", { class: "roadmap-flow", "aria-live": "polite" });
  const steps = [];
  tl.events.forEach((ev, i) => {
    const kind = ROADMAP_KIND[ev.kind] ? ev.kind : "life";
    const hasDetail = !!(ev.detail && ev.detail.trim());
    const srcText = "出典 " + (ev.src || []).map(n => `[${n}]`).join("");
    const detail = el("p", { class: "roadmap-detail", hidden: "" }, [
      el("span", { text: hasDetail ? ev.detail + " " : "" }),
      el("span", { class: "muted", text: srcText }),
    ]);
    const box = el("button", { class: `roadmap-block ${kind === "world" ? "world" : "own"}`, "aria-expanded": "false" }, [
      el("span", { class: "roadmap-when" }, [
        el("span", { text: ev.when }),
        el("span", { class: "roadmap-kind", text: ROADMAP_KIND[kind] }),
      ]),
      el("span", { class: "roadmap-title", text: ev.title }),
      detail,
    ]);
    box.addEventListener("click", () => {
      const open = box.getAttribute("aria-expanded") === "true";
      box.setAttribute("aria-expanded", open ? "false" : "true");
      if (open) detail.setAttribute("hidden", ""); else detail.removeAttribute("hidden");
    });
    const item = el("li", { class: "roadmap-item" }, [
      i > 0 ? el("span", { class: "roadmap-arrow", "aria-hidden": "true", text: "↓" }) : el("span"),
      box,
    ]);
    steps.push(item);
    flow.appendChild(item);
  });
  sec.appendChild(flow);

  // 出典（全部見終わったら出す。番号は箱の「出典 [1]」と対応）
  const srcList = el("ol", { class: "sources roadmap-sources", hidden: "" }, tl.sources.map(s => el("li", {}, [
    el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer", text: s.name }),
    el("span", { text: `（${s.accessed} 閲覧）` }),
  ])));

  const nextBtn = el("button", { class: "primary" , text: "次へ" });
  const allBtn = el("button", { class: "secondary", text: "全部見る" });
  const resetBtn = el("button", { class: "tertiary", text: "最初から" });
  const counter = el("span", { class: "muted small roadmap-count" });
  let shown = 0, timer = null;

  function show(n) {
    shown = Math.max(1, Math.min(n, steps.length));
    steps.forEach((s, i) => {
      const was = !s.hidden;
      if (i < shown) { s.hidden = false; if (!was && !reduce) { s.classList.remove("pop"); void s.offsetWidth; s.classList.add("pop"); } }
      else s.hidden = true;
    });
    const done = shown >= steps.length;
    counter.textContent = `${shown} / ${steps.length}`;
    nextBtn.textContent = done ? "おわり" : "次へ";
    if (done) srcList.removeAttribute("hidden"); else srcList.setAttribute("hidden", "");
  }
  nextBtn.addEventListener("click", () => {
    if (shown >= steps.length) return;
    show(shown + 1);
    steps[shown - 1].scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  });
  allBtn.addEventListener("click", () => {
    clearInterval(timer);
    if (reduce) { show(steps.length); return; }
    timer = setInterval(() => { if (shown >= steps.length) { clearInterval(timer); return; } show(shown + 1); }, 320);
  });
  resetBtn.addEventListener("click", () => { clearInterval(timer); show(1); });

  sec.appendChild(el("div", { class: "row roadmap-controls" }, [nextBtn, allBtn, resetBtn, counter]));
  sec.appendChild(srcList);
  show(1);
  return sec;
}
