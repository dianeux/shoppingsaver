# ShoppingSaver

跨品牌基本款選購網站，分女裝與男裝兩區。每晚索引七個品牌美國站的目錄，把材質、顏色、尺寸、品類正規化成同一套 schema，依「材質 × 價格」的性價比排序。

> 價格和材質之間的取捨，找出 CP 值最高的衣服。

## 架構

```
GitHub Actions (nightly)            Vercel (Next.js 16)
  adapters/<brand>.ts   ──┐           /            女裝品類入口（男裝：/men 開頭，其餘路徑相同）
  fetcher.ts（白名單/robots/限速）      /g/[l1]      大分類：子分類切換、分類內搜尋、權重滑桿、篩選
  extract.ts（parser → Haiku 4.5）     /c/[l2]      子分類瀏覽
  rescore.ts（性別 × L2 內價格百分位）  /brand/[id]  品牌交叉檢視
                                       /deals       本週降價（比前一天便宜，追蹤 7 天）
  drops.ts（降價偵測）   ──┴──► Postgres (Supabase) ◄──┘
```

| 目錄 | 內容 |
|---|---|
| `src/domain/` | 純函式：taxonomy、纖維字典與係數、成分解析、色族、尺寸、性價比公式。有單元測試。 |
| `src/pipeline/` | 夜間索引：抓取、抽取、正規化、算分、降價偵測、品質報表。 |
| `src/pipeline/adapters/` | 每個品牌一個 adapter + 手工分類映射表（版本化）。 |
| `src/db/` | Drizzle schema 與 migration。 |
| `src/views/` | 各頁面的內容，女裝與男裝路由共用（`src/app/…` 與 `src/app/men/…` 只是薄包裝）。 |
| `src/app/`, `src/components/` | 前端。滑桿與篩選全部在前端運算，不打後端。 |

## 品牌接入狀態

| 品牌 | 狀態 | 資料來源 | 每晚請求數 |
|---|---|---|---|
| Muji | ✓ | Shopify `collections/<handle>/products.json` + 商品頁「Material & Care」（只抓新增或變動的商品） | ~10（清單）+ 變動商品數 |
| Pact | ✓ | 自建平台（非 Shopify）。商品頁用的 `POST /controller/product`，不帶分類時一次回傳整個 apparel / underwear / clearance，含成分、各尺寸庫存與價格 | 3 |
| Quince | ✓ | Next.js 網站。女裝服飾列表頁前 30 件在伺服器端渲染，其餘由網站自己的 presentation-layer API 分頁（與頁面捲動時的呼叫相同）；成分只在商品頁，新品或變動時才抓 | ~43（列表）+ 變動商品數 |
| Uniqlo、GU | ✗ 暫無法接入 | 兩站對所有非瀏覽器程式都不回應（連 robots.txt 都逾時），要取得資料只能偽裝成瀏覽器，違反本專案「標明 User-Agent、不偽裝」原則 | — |
| H&M、Zara | 未接 | — | — |

Pact 的正價與清倉版本用款號（style code）合併成同一件商品；多件組與套組排除，因為價格基準不同。

Quince 的列表依顏色重複列出同一件商品，以 productId 合併；它的「traditional retail price」是對照其他品牌的價格，不是自己的原價，所以不當作原價。泳裝不在 taxonomy 內而排除；伴娘服歸入擴充節點「正裝與宴會服」。只抓到內裡成分的商品標為「成分待補」，不以內裡計分。

## 本機開發

```bash
npm install
cp .env.example .env        # 本機預設連 PGlite
npm run db                  # 終端機 1：本機 Postgres（PGlite socket server，資料在 .data/）
npm run db:migrate
npm run index               # 抓所有已接入品牌；也可指定：npm run index -- muji pact
                            # Muji 首次約 25 分鐘，之後只抓有變動的商品；Pact 約 10 秒
npm run report              # 目錄重疊表 + 各站抽取品質
npm run dev                 # 終端機 2：http://localhost:3000
npm test
```

`ANTHROPIC_API_KEY` 沒設也能跑：解析器處理不了的成分會標成 `extraction_failed`（顯示「成分待補」），不會亂猜。

## 部署

1. 合併到 `main`（Vercel 的正式站部署 `main`）。
2. vercel.com 以 GitHub 登入 → Add New → Project → 匯入 `dianeux/shoppingsaver`。
3. supabase.com 建立專案（地區選 East US (North Virginia)，與 Vercel 預設地區相同）。在 Connect 取得兩個 pooler 連線字串，並在 Database settings → SSL Configuration 下載根憑證（Supabase 的憑證不是公開 CA 簽的，程式會用它驗證連線）。
4. 本機 `.env.production.local`（已被 git 忽略）寫入 **Session pooler（:5432）** 的 `DATABASE_URL=…` 與 `DATABASE_CA_CERT="…PEM…"`；
   Vercel → Settings → Environment Variables 加入 **Transaction pooler（:6543）** 的 `DATABASE_URL` 與同一份 `DATABASE_CA_CERT`。
5. 對雲端資料庫跑 migration，並把本機已索引的資料搬上去（免去數小時的首次抓取）：
   ```bash
   npm run db:migrate:prod   # 讀 .env.production.local
   npm run db:copy           # 本機 PGlite → .env.production.local 的資料庫；可重複執行
   ```
6. Vercel 按 Redeploy（頁面預先產生時會讀資料庫；之後每小時 ISR 更新）。
7. GitHub Actions 夜間排程需要 secrets：`gh secret set DATABASE_URL`（Session pooler 連線字串）與 `gh secret set DATABASE_CA_CERT < 憑證檔`；可選 `ANTHROPIC_API_KEY`。

CI（`.github/workflows/ci.yml`）在每次推送與 PR 跑 lint、型別檢查與單元測試。

## 關鍵設計決策

- **成分三態**：`extracted` / `extraction_failed`（是 bug，要修）/ `not_disclosed`（事實）。兩種缺值材質分都以 0 計，但卡片上會分開標示。
- **LLM 只做格式整理**：Haiku 把雜亂文字整理成「纖維 + 百分比」，再送回同一個解析器驗證；纖維分類與係數永遠由程式決定。
- **只對變動的商品抽取**：內容雜湊（含抽取器版本號）沒變就沿用上次結果；先前失敗的商品只用新版解析器重跑存下的文字，不重抓也不打 LLM。
- **價格百分位在所有品牌載入後重算**：新品牌會改變每件商品的百分位。
- **書籤小工具（/add）**：Uniqlo、GU、Zara、H&M 擋爬蟲，所以改由訪客在自己的瀏覽器裡、在正在看的商品頁點書籤，把頁面的 JSON-LD（壓成每色一筆）與頁面文字放在網址 `#` 後帶到 `/add`；解析、預覽在瀏覽器端完成，伺服器只收結構化欄位並重新驗證（只收官方網址與官方圖庫、成分必須解析得過、每個訪客每小時 20 次）。這些商品 `source = 'user'`，不會影響爬蟲商品的百分位（只算自己落在哪），也不進降價榜；30 天沒人重新加入或被 2 位訪客回報已下架就隱藏。訪客 IP 只存加鹽雜湊（可設 `SUBMISSION_SALT`）。
- **中英雙語**：頁面都在 `app/[lang]` 底下；`src/proxy.ts` 把沒有前綴的網址（中文，原本的網址不變）轉到 `/zh`，英文是 `/en/…`。右上角切換會記在 `lang` cookie；沒選過時，瀏覽器第一語言是英文的訪客會被導到 `/en`。字典在 `src/i18n/dict.ts`（型別保證英文版不會漏 key），品類、色系、纖維、搜尋詞典標籤都有英文名，卡片的成分在瀏覽器端依語言格式化。
- **女裝、男裝分區**：每件商品有 `gender`，百分位分區計算（男裝 T 恤只和男裝 T 恤比）。女裝沿用原本的網址與商品 id（`品牌:編號`），男裝在 `/men` 底下、id 為 `品牌:men:編號`；男女通用的商品（如 Muji 襪子）兩區各一筆。
- **本週降價 = 比前一天便宜**：降價前一天的價格記為第 0 天價格；追蹤 7 天（降價當天算第 1 天），期間再降就重新計時但第 0 天價格不變；價格漲回第 0 天就立即移除。
- **售完商品不顯示**：所有顏色、尺寸都賣完才算售完，從頁面、百分位計算、降價榜和首頁代表圖中排除，但持續記錄價格，補貨後自動回來；部分缺貨的商品只顯示有貨的顏色與尺寸，價格也以有貨的款式計算。
- **皮革（PRD 未解問題 3，已決議）**：天然皮革（含麂皮、羊毛皮）係數 1.0；人造皮革（faux／vegan／PU leather 等，名稱帶 faux、vegan、synthetic 一律視為人造）係數 0。
- **依顏色而異的成分**：同一商品不同顏色成分不同時，以第一組顏色計分。
- **站點降級可見**：每頁都顯示資料更新時間；品牌只要曾經成功抓過，之後失敗或超過 36 小時沒更新，黃色提示框會說明顯示的是哪個時間點的資料。
