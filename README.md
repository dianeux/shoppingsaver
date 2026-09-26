# ShoppingSaver

跨品牌女裝基本款選購網站。每晚索引七個品牌美國站的目錄，把材質、顏色、尺寸、品類正規化成同一套 schema，依「材質 × 價格」的性價比排序。

> 不是找最低價，是看清楚每個價格帶買到什麼。

## 架構

```
GitHub Actions (nightly)            Vercel (Next.js 16)
  adapters/<brand>.ts   ──┐           /            品類入口（覆蓋數門檻）
  fetcher.ts（白名單/robots/限速）      /c/[l2]      品類瀏覽：權重滑桿、篩選、分數拆解
  extract.ts（parser → Haiku 4.5）     /brand/[id]  品牌交叉檢視
  rescore.ts（L2 內價格百分位）         /deals       本週降價（對 30 天中位價）
  drops.ts（降價偵測）   ──┴──► Postgres (Neon) ◄──┘
```

| 目錄 | 內容 |
|---|---|
| `src/domain/` | 純函式：taxonomy、纖維字典與係數、成分解析、色族、尺寸、性價比公式。有單元測試。 |
| `src/pipeline/` | 夜間索引：抓取、抽取、正規化、算分、降價偵測、品質報表。 |
| `src/pipeline/adapters/` | 每個品牌一個 adapter + 手工分類映射表（版本化）。 |
| `src/db/` | Drizzle schema 與 migration。 |
| `src/app/`, `src/components/` | 前端。滑桿與篩選全部在前端運算，不打後端。 |

## 本機開發

```bash
npm install
cp .env.example .env        # 本機預設連 PGlite；MIN_BRANDS_PER_L2=1 讓單一品牌也能看到頁面
npm run db                  # 終端機 1：本機 Postgres（PGlite socket server，資料在 .data/）
npm run db:migrate
npm run index -- muji       # 抓 Muji（首次約 25 分鐘；之後只抓有變動的商品）
npm run report              # 目錄重疊表 + 各站抽取品質
npm run dev                 # 終端機 2：http://localhost:3000
npm test
```

`ANTHROPIC_API_KEY` 沒設也能跑：解析器處理不了的成分會標成 `extraction_failed`（顯示「成分待補」），不會亂猜。

## 部署

1. 在 Neon 建立資料庫，取得 pooled connection string。
2. Vercel 匯入此 repo，設定環境變數 `DATABASE_URL`。
3. GitHub repo 設定 secrets：`DATABASE_URL`、`ANTHROPIC_API_KEY`；可選 variable `LLM_BUDGET_USD`。
4. `.github/workflows/nightly-index.yml` 每天 07:30 UTC 執行；也可手動觸發並指定品牌。

## 關鍵設計決策

- **成分三態**：`extracted` / `extraction_failed`（是 bug，要修）/ `not_disclosed`（事實）。兩種缺值材質分都以 0 計，但卡片上會分開標示。
- **LLM 只做格式整理**：Haiku 把雜亂文字整理成「纖維 + 百分比」，再送回同一個解析器驗證；纖維分類與係數永遠由程式決定。
- **只對變動的商品抽取**：內容雜湊（含抽取器版本號）沒變就沿用上次結果；先前失敗的商品只用新版解析器重跑存下的文字，不重抓也不打 LLM。
- **價格百分位在所有品牌載入後重算**：新品牌會改變每件商品的百分位。
- **降價 = 現價 ≤ 30 天中位價 × 0.9**，且需至少 7 天快照。永久特價的商品中位價就是特價，不會上榜。
- **站點降級可見**：品牌只要曾經成功抓過，之後失敗或超過 36 小時沒更新，就會在頁面上點名。
