# CODING CONVENTIONS — LuxeReserve Project

> Stack: React (Vite) · Node.js / Express · SQL Server · MongoDB · Playwright · Groovy

---

## Rule 1: English-only in code

- All text inside code files MUST be written in English.
- This includes: comments, string literals, `console.log` / `res.json` messages,
  variable names, error messages, log output, and JSON / YAML values.
- Applies to ALL file types: `.js`, `.jsx`, `.ts`, `.groovy`, `.sql`, `.json`,
  `.yaml`, `.md` (code blocks inside markdown).
- Vietnamese is allowed ONLY in: user-facing UI text rendered in the browser
  (e.g. `<h1>Đặt phòng</h1>`), and in plain-text documentation files
  (e.g. `README.md`, `NOTE.md`, `docs/`).

**Good:**
```js
// Fetch available rooms for the selected date range
const rooms = await RoomService.getAvailable(checkIn, checkOut);
```

**Bad:**
```js
// Lay danh sach phong trong theo ngay check-in va check-out
const rooms = await RoomService.getAvailable(checkIn, checkOut);
```

---

## Rule 2: No emojis or special Unicode characters in code

- Do NOT use emojis (e.g. ✅, ⚠️, 🎉) inside `.js`, `.jsx`, `.groovy`,
  `.sql`, `.json`, or `.yaml` files.
- Exception: emoji are allowed inside React JSX/TSX **only when they are
  intentional UI elements** visible to the user (e.g. hotel rating stars,
  decorative icons). They must NOT appear in comments or log messages.
- Use plain ASCII alternatives in all log / console output:

  | Avoid       | Use instead |
  |-------------|-------------|
  | ✅ / OK     | `[OK]`      |
  | ⚠️ / WARN   | `[WARN]`    |
  | ❌ / ERROR  | `[ERROR]`   |
  | →           | `->`        |
  | …           | `...`       |

---

## Rule 3: File encoding

- All `.js` and `.jsx` files must be saved as **UTF-8 without BOM**.
- All `.groovy` and `.sql` files must be saved as **UTF-8 without BOM**.
- Vite / Node.js tooling expects UTF-8 without BOM; a BOM will break
  some parsers.
- If you suspect encoding corruption (mojibake in the browser or SQL
  Server), open the file in VS Code and check the status bar — it must
  read `UTF-8`.

---

## Rule 4: Project structure — where to put new files

```
d:\HCSDLNC\
├── src/                   # Express backend
│   ├── app.js             # Main entry point
│   ├── config/            # DB connections (SQL Server, MongoDB)
│   ├── middleware/        # Auth, error handlers
│   ├── routes/            # Express routers
│   └── services/          # Business logic
│
├── frontend/              # React (Vite) frontend
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── pages/         # Page-level components (route targets)
│       ├── services/      # API call helpers (axios / fetch wrappers)
│       └── assets/        # Static images, fonts
│
├── database/
│   ├── sql/               # SQL Server migration / seed scripts
│   └── mongodb/           # MongoDB seed / migration scripts
│
├── tests/                 # Playwright end-to-end tests
├── hotel/                 # Static preview of the frontend (for review)
├── docs/                  # Documentation, ERD diagrams, reports
└── .agent/                # AI agent instructions (AGENT.md, etc.)
```

- Do NOT place business logic inside route files — put it in `src/services/`.
- Do NOT import backend modules from the `frontend/` directory or vice versa.

---

## Rule 5: Naming conventions

| Context                     | Convention              | Example                          |
|-----------------------------|-------------------------|----------------------------------|
| JS / JSX variables          | `camelCase`             | `checkInDate`, `roomList`        |
| React components            | `PascalCase`            | `BookingCard`, `HotelPage`       |
| CSS class names             | `kebab-case`            | `booking-card`, `hotel-header`   |
| CSS custom properties       | `--kebab-case`          | `--accent`, `--panel-strong`     |
| SQL table / column names    | `snake_case`            | `hotel_id`, `check_in_date`      |
| MongoDB collection names    | `camelCase` (plural)    | `bookings`, `guestProfiles`      |
| File names (JS/JSX)         | `PascalCase` for components, `camelCase` for utilities | `BookingCard.jsx`, `dateUtils.js` |
| Environment variables       | `UPPER_SNAKE_CASE`      | `DB_HOST`, `JWT_SECRET`          |

---

## Rule 6: Express API conventions

- All routes must be prefixed with `/api/v1/`.
- HTTP status codes must match the semantic meaning:
  - `200` — successful read
  - `201` — successful create
  - `400` — bad request / validation error
  - `401` — unauthenticated
  - `403` — forbidden
  - `404` — resource not found
  - `500` — unexpected server error
- All error responses must follow this shape:
  ```json
  { "success": false, "message": "Human-readable error description" }
  ```
- All success responses must follow this shape:
  ```json
  { "success": true, "data": { ... } }
  ```

---

## Rule 7: Database conventions

### SQL Server
- Table names: `PascalCase` singular (e.g. `Booking`, `HotelRoom`).
- Primary keys: `<TableName>ID` (e.g. `BookingID`, `RoomID`).
- Foreign keys: `<ReferencedTable>ID` (e.g. `HotelID`, `GuestID`).
- Always use parameterized queries — never string-interpolate user input into SQL.

### MongoDB
- Collection names: `camelCase` plural (e.g. `reviews`, `loyaltyPoints`).
- Always define a Mongoose schema; avoid schemaless documents in production code.
- Use `lean()` for read-only queries to improve performance.

---

## Rule 8: Frontend (React / Vite) conventions

- Use the **CSS custom properties** defined in `frontend/src/index.css`
  (color palette, spacing tokens). Do NOT hard-code hex colors inside
  component files.
- Component files must export a single default export.
- API calls must go through wrapper functions in `frontend/src/services/`
  — do NOT call `fetch` / `axios` directly inside a component.
- All user-visible strings may be in Vietnamese (they are UI content,
  not code). Comments in the same file must still be in English.

---

## Rule 9: Groovy / JMeter scripts

- Groovy files (`.groovy`) follow the same English-only rule as JavaScript.
- Do NOT use `println` with Vietnamese strings or emojis.
- Use `log.info("[OK] ...")`, `log.warn("[WARN] ...")`, `log.error("[ERROR] ...")`
  for all logging inside JMeter Groovy samplers.

---

## Rule 10: Playwright tests

- Test file names must describe the feature being tested:
  `booking-flow.spec.js`, `loyalty-rewards.spec.js`.
- Each `test()` description must be in English and clearly state the
  expected behavior:
  ```js
  test('should display available rooms for selected dates', async ({ page }) => { ... });
  ```
- Use `data-testid` attributes on interactive elements instead of relying
  on brittle CSS selectors.

---

## Rule 11: After every change — update NOTE.md

- After completing any set of code changes, append an entry to `NOTE.md`
  listing the files modified and a brief English summary of what changed.
- Format:
  ```
  ## YYYY-MM-DD — <short title>
  - src/routes/bookingRoutes.js (line 45-60): Added loyalty points endpoint
  - frontend/src/pages/BookingPage.jsx (line 12): Imported LoyaltyBadge component
  ```

---

# AGENT RESPONSE LANGUAGE

## Rule 12: Reply to the user in Vietnamese (with diacritics)

- All explanations, summaries, and questions directed at the user must be
  written in Vietnamese with full tone marks (có dấu).
- Only the **code content itself** must be in English (see Rule 1).

**Example:**
- Code comment: `// Wait for the booking to be confirmed`
- User reply: "Script sẽ chờ cho đến khi đặt phòng được xác nhận."

---

## Rule 13: Verify names BEFORE writing code — never guess

- **Before** creating or modifying any file that references database objects
  (tables, columns, views, triggers, procedures), the agent MUST verify
  the exact names against the live schema or `02_create_tables.sql`.
  Do NOT rely on memory or assume names like `HotelBrand` when the real
  table is `Brand`.
- **Before** adding frontend API calls, verify that the target backend
  route actually exists (check `src/routes/*.js` and `src/app.js`).
- **Before** writing backend queries that return data to the frontend,
  verify what field names the frontend component expects (check the
  `.jsx` file that consumes the response).
- **Verification checklist** (run before writing code):

  | Layer change          | Verify against                             |
  |-----------------------|--------------------------------------------|
  | New/modified SQL      | `INFORMATION_SCHEMA.TABLES / COLUMNS`      |
  | New backend route     | `src/app.js` mount + existing route files   |
  | New FE API call       | Registered routes in `src/routes/*.js`      |
  | New FE field access   | Backend SELECT aliases in the route handler |
  | New backend SELECT    | Live DB column names via `sqlcmd` or schema |

- This rule exists because fixing a wrong name after the fact wastes
  time and creates unnecessary commits. Get it right the first time.

---

## Rule 14: Advanced Database-First � xu ly o DB, khong phai BE/FE

Day la mon Advance Database. Moi logic co the xu ly o DB phai duoc xu ly o DB.
Khong duoc de BE hay FE xu ly nhung gi ma DB da co kha nang lam tot hon.

### 14.1 - Uu tien cac ky thuat Advanced DB

| Tinh huong | Ky thuat DB can dung | Khong duoc dung |
|---|---|---|
| Giu toan ven du lieu khi nhieu user dong thoi | `SELECT ... WITH (UPDLOCK, ROWLOCK)` hoac Serializable transaction | Application-level flag |
| Tinh toan tong, trung binh, xep hang | Window functions: `ROW_NUMBER()`, `RANK()`, `SUM() OVER()`, `AVG() OVER()` | Tinh trong JS array |
| Truy van phan cap / de quy | CTE (`WITH ... AS`) hoac recursive CTE | Nhieu round-trip SQL |
| Kiem tra business rules phuc tap | CHECK constraint, trigger, stored procedure | Validation trong route handler |
| Cap nhat/ghi lich su tu dong | Trigger (AFTER INSERT/UPDATE) | setInterval trong app.js |
| Phan trang ket qua lon | `OFFSET ... FETCH NEXT` (SQL Server) | Lay toan bo roi filter JS |
| Upsert | `MERGE` statement hoac `INSERT ... ON CONFLICT` | SELECT kiem tra roi INSERT/UPDATE rieng |
| Bao cao / thong ke theo nhieu chieu | CTE + Window function + GROUP BY ket hop | Nhieu query nho roi gop JS |
| Giu lock trong suot transaction | `BEGIN TRANSACTION ... WITH (UPDLOCK)` + `COMMIT` | Truong check roi insert sau |

### 14.2 - Quy tac bat buoc

1. **Concurrency**: Moi thao tac doc-ghi co the xay ra dong thoi BAT BUOC dung
   lock hint hoac isolation level phu hop. Vi du: dat phong phai dung
   `SELECT ... WITH (UPDLOCK, HOLDLOCK)` de chong double-booking.

2. **Aggregation**: Moi tinh toan tren tap du lieu (tong doanh thu, xep hang phong,
   diem trung binh review...) phai dung SQL Window function hoac GROUP BY,
   KHONG duoc lay raw data ve JS roi tinh.

3. **CTE thay vi subquery long nhau**: Khi query phuc tap (tren 2 level join hoac
   co dieu kien phu thuoc vong lap), dung CTE de code ro rang va DB optimizer
   co the cache.

4. **Trigger cho audit log**: Moi thay doi tren bang nhay cam (Reservation, Payment,
   Guest, GuestAuth) phai duoc ghi AuditLog bang trigger, khong phai bang tay
   trong route handler.

5. **Stored Procedure cho business logic phuc tap**: Logic co tren 3 buoc SQL
   lien quan (vi du: check-in flow, cancel flow) nen chuyen vao Stored Procedure
   de dam bao atomicity va tranh BE viet lai.

### 14.3 - Kiem tra truoc khi code

Truoc khi viet bat ky logic nao lien quan den du lieu, tu hoi:
- Co the viet nay trong 1 SQL statement khong? -> Neu co, dung SQL.
- Co race condition khong? -> Neu co, dung lock/transaction ngay tai DB.
- Co can tinh toan tren nhieu row khong? -> Neu co, dung Window function.
- Co lap lai logic nay o nhieu cho khong? -> Neu co, tao Stored Procedure hoac View.

