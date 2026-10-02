# Data Plan

## Context provenance
- `1차 MVP는 ① 매물 등록(주소→좌표) ② 가격·입지 대시보드 ③ 체크리스트+사진 기록 ④ 내비 전송까지 제작해.` (verbatim request defining the original four workflows)
- `둘 다 고려` (prior user statement; investment and owner-occupier views share one property record)
- `a로 가자` (current accepted direction: connect to the official Ministry of Land, Infrastructure and Transport transaction API)
- The current implementation treats official rows as reported historical transactions, never as current asking prices or appraisals.

## Official apartment sale transactions
**Primary official listing**: https://www.data.go.kr/data/15126469/openapi.do

**Endpoint strategy**
- Primary: `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev`
- Fallback only: `https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade`
- The detailed endpoint is used first because it includes the base transaction fields plus the newer fields for transaction type, registration date, buyer/seller classification, agent district, apartment building and land-leasehold status. The basic endpoint is called only if the detailed endpoint is unavailable or rejects the request; a rate-limit response is not retried through the fallback.

**Implementation references checked**
- https://github.com/earthskyisbig/onbid/blob/HEAD/.claude/skills/molit-market-data/SKILL.md (request parameters, XML success codes and cancellation handling)
- https://github.com/WooilJeong/PublicDataReader/pull/73 (detailed service endpoint)
- https://github.com/childyouth/estate_predictor (observed detailed response field names: `aptDong`, `aptNm`, `buildYear`, `buyerGbn`, `cdealDay`, `cdealType`, `dealAmount`, `dealDay`, `dealMonth`, `dealYear`, `dealingGbn`, `estateAgentSggNm`, `excluUseAr`, `floor`, `jibun`, `landLeaseholdGbn`, `rgstDate`, `sggCd`, `slerGbn`, `umdNm`)
- https://karri-file.kar.or.kr/board/199/1764735362418_9477.pdf (district code reference)
- https://github.com/david61756/apt-price-monitor (region/month XML integration pattern)

**Request shape**: district code (`LAWD_CD`, five digits), contract month (`DEAL_YMD`, YYYYMM), page 1, up to 1,000 rows. Common metropolitan districts are matched automatically; a five-digit district-code field remains available when a geocoded region is outside that bundled mapping. The request builder accepts either public-data Encoding or Decoding key form without double-encoding percent escapes, and accepts documented success-code variants (`0`, `00`, `000`) as well as valid empty-result envelopes. The server reads an approved runtime secret named `MOLIT_API_KEY` or `DATA_GO_KR_SERVICE_KEY`; it never stores or returns the secret.

**Processing and storage**
- XML is parsed into typed rows with contract date, apartment, legal dong/jibun or road address, exclusive area, floor, reported amount, build year, transaction type and detailed fields when provided.
- Rows marked as cancelled (`cdealType=O`) are excluded. A deterministic fingerprint deduplicates the same reported deal.
- Each district/month refresh replaces that cache slice and preserves previously resolved coordinates for matching rows. Fetch time and whether the detailed or fallback endpoint produced the row are stored.
- A small, rate-limited subset of unique addresses is geocoded with Nominatim for map pins. Rows without verified coordinates remain visible in the list and are never assigned approximate pins.
- Importing a transaction creates a normal inspection record with `priceBasis=official_trade`, the official contract date in the memo, and the source URL. The UI labels that value as a reported transaction, not an asking price.
- Latest reports can be delayed, corrected or cancelled. The UI shows contract month, row date, source, fetch time and transaction count; it avoids unsupported trend claims from thin samples.

**Empty and failure behavior**
- Without an approved runtime key, the search returns cached rows if any and an explicit connection-required state with the official application link. No sample transaction is created.
- Invalid credentials, source outages and empty months render explicit error/empty states. A failed refresh does not erase cached rows.

## Map basemap and OpenStreetMap Nominatim
**Basemap**: OpenStreetMap standard raster tiles at `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with visible `© OpenStreetMap contributors` attribution on both the explorer map and the course map (changed 2026-10-02). The earlier Esri World Street Map layer (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}`) was verified by direct tile probes to return its gray "Map data not yet available" placeholder for all of South Korea at zoom 14 and above (Seoul City Hall, Gangnam, Daegu center/west, and Busan sample grids, 25/25 placeholder tiles at z14–z16), which is why regional cities went blank when zooming in. OpenStreetMap standard tiles were verified by direct probes to serve real street tiles across Seoul, Daegu center, and rural Daegu at zooms 14, 16, 18, and 19. Esri had previously replaced a direct OSM layer after a reported 403 policy block in the hosted client; if that block reappears, the tile-error warning keeps the transaction/property list usable and offers a Google Maps regional fallback, and the basemap should then move to another OSM-based tile host rather than back to Esri (whose Korea high-zoom coverage gap is the original defect).

**Nominatim used by**: `geocodeProperty`, `geocodeArea`, and limited coordinate verification for official transaction addresses.

**Tested request**: `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=kr&q=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C%20%EC%86%A1%ED%8C%8C%EA%B5%AC%20%EC%98%AC%EB%A6%BC%ED%94%BD%EB%A1%9C%20300` with an identifying User-Agent returned HTTP 200 and a matching first result at latitude `37.5137422`, longitude `127.1042466`.

**Processing**: Korean-country constrained search; user-entered property registration returns candidates for explicit selection. Official transactions keep an honest list-only fallback when geocoding does not resolve an address.

## NAVER Maps handoff
**Official app-link documentation**
- https://guide.ncloud-docs.com/docs/maps-url-scheme
- https://guide.ncloud-docs.com/docs/en/maps-url-scheme

**Browser-safe destination link**: `https://map.naver.com/p/search/{url-encoded-query}`

The previous `nmap://route/car` link depended on a custom URL scheme that a sandboxed iframe can block silently and that cannot work on a Windows desktop without the mobile app. The artifact now opens NAVER Maps' verified HTTPS search page in a new tab using the saved property name plus address. This preserves a working browser path on desktop and mobile without an API key; the user can start directions from the resolved place in NAVER Maps. This HTTPS search form was live-tested signed out on 2026-09-28; unlike the official app scheme, NAVER does not document the HTTPS share-link format, so it remains an explicit de-facto integration rather than an API contract.

## Address-specific web references
**Delivered by**: `refreshReferences`

**Processing**: preserve search-result title, exact returned URL, source domain, snippet and published date when present. These remain external reference cards; snippet numbers are not promoted into authoritative prices or distance facts.

## Long-term data behavior
- **Refresh policy**: official transaction data is fetched only on an explicit district/month lookup; reference search and nearby-place refresh also remain explicit. There is no background cron.
- **Growth**: property, checklist, note and photo rows grow with user input. Official transaction rows are cached by district/month and replaced on refresh.
- **Ordering**: property records sort by most recently updated. Official transactions sort by contract date then amount.
- **Time semantics**: creation, update and fetch instants are stored as UTC timestamps and rendered viewer-locally. Contract and visit dates remain calendar dates without invented times.

## Comparison evaluation mode
**Feature reference**: https://github.com/ljhdy/dotherich

- The comparison board follows the researched pattern of comparing up to three apartment/property candidates with photos, notes, value assessment, conclusion, and one final selected candidate.
- Candidate selection, comparison notes, value assessments, conclusions, and final selection are user-owned records. The artifact does not invent ratings, conclusions, or default candidate history.
- Existing property facts and uploaded photos are reused from their authoritative in-app records. The board labels official transaction-backed prices separately from user-entered asking prices.
- Comparison selections and evaluations persist in `property_comparisons`; removing a property cascades its comparison entry.

## Image slots
- No sourced imagery on first load: this is an operational field tool. Property photos enter only through explicit user upload/camera input, are stored as owned runtime blobs, and are never fabricated or hotlinked.

## Rejected approaches
- **Bulk or approximate map pins**: rejected because district centroids and guessed complex locations misrepresent exact properties. Only verified coordinates render as pins.
- **Treating web-search snippets as structured transactions**: rejected because representative results mix district reports, news and venue pages.
- **Storing the public-data API key in the artifact database**: rejected because it would persist a credential as ordinary row data. The app uses only a runtime secret and otherwise shows the connection-required state.

## Final-selection follow-up tools
**Feature references**
- Markdown report structure: https://github.com/devsmilekang/notion-house
- Price tracking pattern: https://github.com/klyhyeon/imjang-mate
- Price-alert product reference: https://hogangnono.com
- Buy-scenario reference: https://github.com/tae0y/real-estate-mcp

**Revisit plan**
- The selected property's current checklist is the sole source. Because the present checklist stores completion and notes but no numeric ratings, generation uses unfinished items and completed items with an empty field note; the UI states this limitation explicitly.
- Generated rows are replaceable derived tasks. User-added custom tasks remain when the generated portion is refreshed. Completion and follow-up notes persist in `revisit_tasks`.

**Decision report**
- The client assembles a Markdown download from the selected comparison row, all comparison candidates, current checklist entries, photo count, revisit tasks, saved price snapshots, and the saved finance scenario.
- The report contains no invented conclusion or evidence. Missing user fields remain visibly marked as not written. The artifact does not provide a print/PDF control inside the sandboxed host.

**Price tracking**
- `price_trackers` stores whether tracking is active and an optional user-entered target price. `price_snapshots` stores only values explicitly recorded by the user or the selected property's existing official-transaction-backed value.
- The first tracking activation records the selected property's current price as a baseline. Later entries are append-only and compared with the immediately preceding entry. A target is considered reached when the latest recorded value is at or below the user's threshold.
- No crawler, scheduler, or push notification is claimed. The research could not verify sustained NAVER listing crawling, so this version is an honest manual observation log with in-app condition status.

**Buy simulator**
- The simulator uses only user-entered purchase price, own funds, annual income, other annual debt service, loan rate, term, LTV, acquisition-tax rate, and brokerage rate. No statutory rates or lending limits are prefilled.
- Calculations are deterministic: taxes and brokerage are rate × purchase price; loan is the lesser of funding need and the entered LTV cap; monthly payment uses equal principal-and-interest amortization; simple DSR is annualized calculated payment plus entered other annual debt service divided by annual income.
- Results are planning estimates, not lender approval or tax advice, and the UI tells the user to verify real rates and eligibility externally.

## Watchlist price tracking (2026-09-29)
**Feature reference**: functionality #2 from the research report (`~/workspace/research_notes/imjang-app-features-20260928-1331/report.md`): interest-district price-change alerts plus market tracking.

**Inspiration sources (verbatim from the report)**
- https://hogangnono.com
- https://github.com/klyhyeon/imjang-mate
- https://github.com/ckh3455/naver_land_daily

**What the alert engine genuinely uses**
- `watch_items` stores per-district watch settings: district code/name, exact complex name, target exclusive area with a tolerance, drop-alert percent, optional target price, optional bargain-below amount, and an active flag.
- `watch_price_series` stores monthly aggregates of `official_transactions` filtered by exact district code, exact complex name, and exclusive area within tolerance: average, median, min, max, and trade count. Months with no trades keep nulls and are never drawn as zero.
- `checkWatchPrices` (manual "지금 시세 확인") refreshes the last 3 contract months per watch via the same privileged MOLIT endpoint contract above, deduplicates into `official_transactions`, recomputes series, and evaluates: (a) price_drop — latest month with trades is at least `dropAlertPct` below the previous month with trades; (b) target_reached — latest monthly average at or below `targetPriceMan`; (c) bargain — any individual reported deal at or below `bargainBelowMan`. All three dedupe on (watchId, type, month).
- `watch_ask_records` stores only user-typed asking prices. A new record generates target_reached/bargain alerts when it satisfies those thresholds; it never enters the official series.
- `fetchWatchHistory` backfills up to 24 months into `official_transactions`/`watch_price_series` with a 24-hour slice freshness cut, but explicitly does NOT create alerts, so existing rows never generate surprise notifications.
- `watch_check_runs` records every check attempt per watch (status, months checked, new trades, alerts created, message). Failures keep all previously stored rows.

**Honest limitations stated in the UI**
- No scheduler or push channel is implemented in this version. `getAutoCheck` returns `supported: false` and the UI shows a disabled toggle explaining that only manual checks create alerts. A `scheduled` flag exists in the action for a future verified schedule, and the platform contract requires approval before any background cadence ships.
- Asking-price tracking is manual only; NAVER/listing crawling was not verified sustainable and is neither implemented nor claimed.
- MOLIT detailed API requires the user's own public-data key saved in Settings (manual checks) or a runtime secret `MOLIT_API_KEY` for future scheduled checks. Without one, checks return `needs_key` and stored data remains.
- Alert comparisons use month-level reported averages from the `official_transactions` store; low-count months are not treated as representative market values, and the UI says so. Reporting lag, corrections, and cancellations in official data can later shift past values.
- The "daily changes/news" component of the report's #2 feature is not implemented; complex names must be written exactly as the official dataset reports them.

## Auto check schedule (2026-09-29)
- Scheduled refresh installed: `cron.add_artifact_action` id `space-2-watch-price-check`, daily ~06:53 user-local time, silent execution kind `space_action` calling `checkWatchPrices({"scheduled": true})`; recorded in `space.json.managedCronJobs`.
- `checkWatchPrices(scheduled: true)` reads `app_settings` key `auto_check.enabled`. Off → returns `skipped` without touching prices. On → checks every active watch against the last 3 contract months using the privileged MOLIT endpoint and the `MOLIT_API_KEY` (or `DATA_GO_KR_SERVICE_KEY`) server environment secret, recomputes `watch_price_series`, and creates `price_alerts` for drop/target/bargain conditions.
- Honest prerequisites stated in the UI: the browser-stored settings key cannot be read by the scheduled run; if no server key is provisioned, each run records a per-watch `needs_key` run entry and creates no alerts. Enabling the toggle does not register a server key by itself.
- Ask-sourced alerts (`addWatchAskRecord`) store an empty `sourceUrl` and render "사용자 직접 입력 · 출처 미등록" in the UI; only official-series alerts link to the public-data portal page.

## Official apartment rent transactions (2026-09-30)
**Feature reference**: functionality #3 from the research report (`~/workspace/research_notes/imjang-app-features-20260928-1331/report.md`): integrate apartment jeonse/wolse real-transaction data.

**Official listing**: https://www.data.go.kr/data/15126474/openapi.do

**Endpoint**: `https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent` (apartment rent service; request shape mirrors the sale service: `LAWD_CD` five digits, `DEAL_YMD` YYYYMM, page 1, up to 1,000 rows). The sale detailed/basic endpoint pair and the existing service key are reused; the rent API may require its own usage approval on the public-data portal, so `checkOfficialApiConnection` now probes the rent endpoint after the sale endpoint and reports `rentAvailable` with an explicit message when the rent service is not approved.

**Implementation references checked**
- https://github.com/earthskyisbig/onbid/blob/HEAD/.claude/skills/molit-market-data/SKILL.md (request parameters, XML success codes, cancellation handling; also lists the rent endpoint `1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent`)
- https://github.com/WooilJeong/PublicDataReader/pull/73 (detailed service endpoint family; rent fields observed: `deposit`, `monthlyRent`, `dealYear`, `dealMonth`, `dealDay`, `floor`, `buildYear`, `cntrTerm`, `estateAgentSggNm`, `aptDong`, `landLeaseholdGbn`, `excluUseAr`, `umdNm`, `jibun`, `sggCd`, `aptNm`)
- https://github.com/childyouth/estate_predictor (response field vocabulary shared with the sale service)

**Processing and classification**
- `searchOfficialRentTransactions(lawdCd, regionLabel, dealMonth)` fetches the rent XML through the `fetchMolitApartmentRents` privileged contract (network + runtime-key read stays in privileged), parses rows, and replaces that district/month cache slice in `official_rent_transactions`.
- Transaction kind is classified mechanically and never blended: `monthlyRent = 0` → jeonse; `monthlyRent > 0` → wolse. Markers labelled as cancelled (`cdealType=O`) are excluded.
- Jeonse statistics use only jeonse deposits; wolse statistics keep the deposit and the monthly rent separate in every aggregate, chart, and sentence. Averages of jeonse deposits, wolse deposits, and wolse monthly amounts are never mixed.
- A deterministic fingerprint (district, rent kind, deal date, complex, dong/jibun, area, deposit, monthly) deduplicates rows; per-slice geocoding and coordinate preservation work exactly like the sale flow.
- Empty months, invalid keys, and API outages render explicit states and leave cached rows intact; nothing synthetic is ever generated.

**Watchlist rent tracking**
- `watch_rent_series` stores monthly rent aggregates per watch filtered by exact district code, exact complex name, and exclusive area within tolerance: jeonse avg/median/min/max/count plus wolse avg/median deposit, average monthly amount, and count.
- `checkWatchPrices` and `fetchWatchHistory` refresh rent slices alongside sale slices; `listWatchItems` now also returns the latest rent summary (`latestRent`) and `getWatchDetail` returns the rent series (`rentSeries`).
- The jeonse-ratio table is computed only for months where both the sale median and the jeonse median exist for the same complex, area, and month; months where either side has no reports are skipped rather than interpolated. Alerts remain sale-based only in this version; no rent-threshold alerts are claimed.

**Property dashboard rent context**
- `getPropertyRentContext(propertyId, lawdCd|null, areaSqm)` summarizes the stored rent/sale rows for the exact complex and ±1.5㎡ area: jeonse median and count, wolse deposit median, wolse average monthly, sale median and count, jeonse ratio (jeonse median ÷ sale median, only when both exist), and the sale-minus-jeonse gap.
- The property record still decides its own `depositMan`/`monthlyRentMan`; rent context is presented as read-only market context and never auto-writes into the record.

**Honest limitations stated in the UI**
- The official rent dataset derives from reported/registered lease contracts and, for privacy, publishes no dong/ho (unit) detail; the UI says so wherever rent rows appear.
- Late reports, corrections, and cancellations shift past values; low-count months are labeled with their sample size and are not presented as representative market values.

## Tour routes (2026-09-30)
**Feature reference**: functionality #13 from the research report (`~/workspace/research_notes/imjang-app-features-20260928-1331/report.md`): plan and save the visit order and route of multiple complexes.

**Inspiration sources (verbatim from the report)**
- https://github.com/ljhdy/dotherich
- https://github.com/sachol/seongsu-imjang

**What the feature genuinely uses**
- `tour_courses` stores user-created courses: title, optional visit date (`YYYY-MM-DD`), free-form notes. `tour_course_stops` stores the ordered property ids of each course with position, per-stop memo, and completed flag. Course title, order, memos, and completion are user-owned records; the artifact never invents routes, orders, or visit history and starts with no sample course.
- Stop coordinates and addresses come only from the existing verified `properties` records (user-entered coordinates or their selected geocode candidate); no new geocoding is performed for tour legs.
- `listTourCourses`/`getTourCourse` compute straight-line leg distances per consecutive stop with the haversine formula and add an estimated walking time at a flat **4 km/h** (`walkMinutesForMeters`, minimum 1 minute for non-zero legs); the response also returns `revisitOpenCount` and checklist completion beside each property, sourced from `revisit_tasks` and `checklist_entries`.
- Comparison candidates can be sent to `createTourCourse` via "선택 후보로 코스 만들기"; stops are then reordered with `setCourseStops`, which preserves each stop's memo and completion when the order changes. Deleting a property or a course cascades its stops.

**Honest limitations stated in the UI**
- There is no road-routing API integration in this version; leg times are labelled explicitly as **직선거리 기준 · 도보 시속 4km 가정** on the summary, per-leg labels, and list cards, and the caption notes they are not real road routes and do not reflect roads, crossings, or slopes. Nothing is ever labelled a real road route or a car/navigation time.
- The map draws the visit order as a dashed straight-line polyline through numbered stop pins; it is drawn only from saved stop coordinates. Each stop shows one outbound real link: "내비 전송" (Kakao Map `link/to` with the saved coordinates, same contract as the NavigationPanel in the records view).

## Nearby radius labels (2026-10-02)
**User request**: “내가 특정 장소에서 위치 버튼을 누르면 내 주변 2km, 5km, 10km 이내의 아파트 이름과 실거래가격이 라벨로 나오면 좋겠어” / “다른 앱들은 실시간 호가거래를 어떻게 이용해서 앱을 만드는 거니?”

**What was built**
- MapExplorer gets a 4th mode `nearby` plus a “내 위치” button using the browser Geolocation API. Radius toggle is exactly 2 / 5 / 10 km. The map draws a radius ring polygon for the chosen radius, a center marker, and per-complex label markers showing apartment name + latest reported price + area (평). Selecting a label shows latest deal date, floor when present, trade count in the stored slice, median of stored prices for that complex, and the fetch time.
- Basemap (2026-10-02 교체): 외국 타일 소스(Esri·OSM·CARTO)는 한국 고줌 데이터 부재·정책 차단·API 키 요구로 모두 실패해, 국토교통부 브이월드(VWorld) WMTS Base 타일(`https://api.vworld.kr/req/wmts/1.0.0/{key}/Base/{z}/{y}/{x}.png`, 최대 줌 19)로 교체했다. VWorld 키는 설정 화면의 "VWorld 지도 키" 카드에서 서버 인증키와 같은 방식으로 서버(`app_settings`의 `vworld.api_key`)에 등록·삭제하고, 클라이언트는 `getMapTileConfig`로 받아 타일 URL을 만든다. 키가 없으면 타일 레이어를 만들지 않고 등록 안내를 띄우며, 마커·팝업·목록은 그대로 동작한다.
- Server action `getNearbyApartments(latitude, longitude, radiusKm)` computes haversine distance in TypeScript over rows already stored in `official_transactions` (only rows with verified latitude/longitude) and over saved `properties`. Complexes are grouped by apartment name + road address/legal dong; the representative price is the latest `dealYmd` row in the group, sorted by distance ascending, capped at 120 complexes and 60 saved properties.
- The list below the map mirrors the same data: distance (straight-line), latest price/date/area, trade count, and saved properties are separated into their own group. Every label carries the official source link `https://www.data.go.kr/data/15126469/openapi.do`.

**Honest limitations stated in the UI**
- Labels are **reported transactions (실거래), not current asking prices (호가)**. Reporting lag and later corrections can make the latest label differ from today’s 호가; the panel says this explicitly.
- Only complexes whose addresses were previously geocoded during a district/month lookup appear. When the radius has no stored complexes, the UI says the district must be fetched first instead of inventing pins. No approximate centroid pins are created.
- Distances are straight-line (haversine) distances, not walking/road distances.

**How other apps use “real-time” asking prices — answer embedded in the UI**
- There is no public real-time 호가 API. Services such as 네이버부동산·직방·호갱노노 keep their own listing databases / broker feeds internally.
- The research report lists crawler approaches (https://github.com/freelife1191/naver-real-estate-crawling, https://github.com/ckh3455/naver_land_daily) and marks NAVER crawling sustainability as **unverified** because of bot blocking; 호갱노노 is cited for alert features (https://hogangnono.com) but exposes no public API to reuse.
- This artifact therefore keeps the official MOLIT transaction feed as the price source and manual asking-price records for 호가, and the nearby panel explains that split with the same source links instead of claiming live 호가.

## Voice recording memos (2026-10-01)
**Feature reference**: functionality #8 from the research report (`~/workspace/research_notes/imjang-app-features-20260928-1331/report.md`): 현장에서 사진·텍스트와 함께 음성으로 메모를 남기는 기능.

**Inspiration source (verbatim from the report)**
- https://github.com/juinjang/juinjang_ios

**What the feature genuinely does**
- `voice_memos` stores user-recorded audio only: property id (required), optional listing record link, optional checklist item key, title, blob key, MIME type, duration in seconds, and created-at. Rows are user-owned; no sample recordings are created.
- Recording uses the browser `MediaRecorder` API with no external service. Acceptable storage formats are `audio/webm`, `audio/mp4`, `audio/ogg`, `audio/wav`; unsupported formats are rejected with an explicit message. Audio bytes are stored as owned runtime blobs (`voice_memos/<propertyId>/<uuid>.<ext>`). Deleting a memo, its listing record, or its property deletes the audio blob as well.
- The Field (현장 기록) tab has an "음성 메모" section: record (max 10 minutes, auto-stop), preview playback before saving, optional title, and optional checklist-item link. Saved memos render a native audio player with date, duration, and link label, plus rename and delete. Checklist rows show a count badge when memos are linked to them.
- Each listing (매물 단위 기록) detail modal has its own voice memo section bound to that listing.
- The decision report carries voice memos into the output: a count line in 선정 근거, a dedicated `## 음성 메모` section listing title, link label, and duration, and a preview metric.

**Honest limitations stated in the UI**
- A microphone permission grant is required; `MediaRecorder` or the microphone may be unavailable in an embedded or restricted browser context, in which case the UI shows an explicit unsupported/permissions message.
- There is no transcription: titles and checklist links are entered by the user.
- Signed playback URLs expire after an hour; the app re-serves them through its own detail action.
