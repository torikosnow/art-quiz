// 背景に使う名画の一覧（10/31 フェーズ6-3）
// 画像はメトロポリタン美術館の Open Access（CC0）。公式APIで isPublicDomain: true を確かめてから取り、横か縦の長い方を1600pxに小さくした。
// 作品名は、確認済みの問題文に日本語の題があるものはそれを使い、ないものは館の英語の題のまま（推測で訳さない）。
// 年は館のデータ（objectDate）のまま。調べた記録: 調査メモ/2026-10-31_Webデザインと名画の背景.md
const BACKGROUNDS = [
  { file: "images/met-437394.jpg", artist: "レンブラント", title: "ホメロスの胸像を見つめるアリストテレス", date: "1653", url: "https://www.metmuseum.org/art/collection/search/437394" },
  { file: "images/met-437529.jpg", artist: "ルーベンス", title: "聖家族と聖エリサベト、聖ヨハネ、鳩", date: "ca. 1608–9", url: "https://www.metmuseum.org/art/collection/search/437529" },
  { file: "images/met-36669.jpg", artist: "歌川豊春", title: "Perspective Print (Uki-e) of the Theaters in Sakaichō and Fukiyachō on Opening Night", date: "ca. 1780", url: "https://www.metmuseum.org/art/collection/search/36669" },
  { file: "images/met-436455.jpg", artist: "ジェリコー", title: "夕暮れ：水道橋のある風景", date: "1818", url: "https://www.metmuseum.org/art/collection/search/436455" },
  { file: "images/met-438814.jpg", artist: "ドラクロワ", title: "レベッカの誘拐", date: "1846", url: "https://www.metmuseum.org/art/collection/search/438814" },
  { file: "images/met-56689.jpg", artist: "歌川広重", title: "名所江戸百景 浅草金龍山", date: "1856", url: "https://www.metmuseum.org/art/collection/search/56689" },
  { file: "images/met-439631.jpg", artist: "ドラクロワ", title: "スキタイ人の中のオウィディウス", date: "1862", url: "https://www.metmuseum.org/art/collection/search/439631" },
  { file: "images/met-436095.jpg", artist: "ドーミエ", title: "三等客車", date: "1864", url: "https://www.metmuseum.org/art/collection/search/436095" },
  { file: "images/met-10819.jpg", artist: "エイキンズ", title: "チャンピオン・シングルスカル（マックス・シュミット）", date: "1871", url: "https://www.metmuseum.org/art/collection/search/10819" },
  { file: "images/met-437658.jpg", artist: "スーラ", title: "Study for \"A Sunday on La Grande Jatte\"", date: "1884", url: "https://www.metmuseum.org/art/collection/search/437658" },
  { file: "images/met-436526.jpg", artist: "ゴッホ", title: "最初の一歩", date: "1890", url: "https://www.metmuseum.org/art/collection/search/436526" },
  { file: "images/met-435868.jpg", artist: "セザンヌ", title: "The Card Players", date: "1890–92", url: "https://www.metmuseum.org/art/collection/search/435868" },
  { file: "images/met-437999.jpg", artist: "ゴーガン", title: "ティーポットと果物のある静物", date: "1896", url: "https://www.metmuseum.org/art/collection/search/437999" },
  { file: "images/met-436446.jpg", artist: "ゴーガン", title: "二人のタヒチの女", date: "1899", url: "https://www.metmuseum.org/art/collection/search/436446" },
];
