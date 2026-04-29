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

- Do NOT use emojis inside ANY source file: `.js`, `.jsx`, `.groovy`, `.sql`, `.json`, or `.yaml`.
- **No exceptions** - emojis cause mojibake encoding corruption on Windows (ODBC driver). See Rule 15.
- Use plain ASCII alternatives in all code, comments, and log output:

  | Avoid       | Use instead |
  |-------------|-------------|
  | emoji OK    | `[OK]`      |
  | emoji WARN  | `[WARN]`    |
  | emoji ERROR | `[ERROR]`   |
  | arrow       | `->`        |
  | ellipsis    | `...`       |
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
|-- src/                   # Express backend
|     |-- app.js             # Main entry point
|     |-- config/            # DB connections (SQL Server, MongoDB)
|     |-- middleware/        # Auth, error handlers
|     |-- routes/            # Express routers
|     `-- services/          # Business logic
|  
|-- frontend/              # React (Vite) frontend
|     `-- src/
|         |-- components/    # Reusable UI components
|         |-- pages/         # Page-level components (route targets)
|         |-- services/      # API call helpers (axios / fetch wrappers)
|         `-- assets/        # Static images, fonts
|  
|-- database/
|     |-- sql/               # SQL Server migration / seed scripts
|     `-- mongodb/           # MongoDB seed / migration scripts
|  
|-- tests/                 # Playwright end-to-end tests
|-- hotel/                 # Static preview of the frontend (for review)
|-- docs/                  # Documentation, ERD diagrams, reports
`-- .agent/                # AI agent instructions (AGENT.md, etc.)
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
  written in Vietnamese with full tone marks (cĂ³ dáº¥u).
- Only the **code content itself** must be in English (see Rule 1).

**Example:**
- Code comment: `// Wait for the booking to be confirmed`
- User reply: "Script sáº½ chá» cho Ä‘áº¿n khi Ä‘áº·t phòng Ä‘Æ°á»£c xĂ¡c nháº­n."

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

## Rule 14: Advanced Database-First — process at DB layer, not BE/FE

This is an Advanced Database course. Any logic that can be handled at the DB layer MUST be handled at the DB layer.
Do NOT let BE or FE handle what the DB can do better.

### 14.1 - Prioritize Advanced DB Techniques

| Scenario | DB technique to use | Do NOT use |
|---|---|---|
| Data integrity with concurrent users | `SELECT ... WITH (UPDLOCK, ROWLOCK)` or Serializable transaction | Application-level flag |
| Totals, averages, rankings | Window functions: `ROW_NUMBER()`, `RANK()`, `SUM() OVER()`, `AVG() OVER()` | Compute in JS array |
| Hierarchical / recursive queries | CTE (`WITH ... AS`) or recursive CTE | Multiple SQL round-trips |
| Complex business rule validation | CHECK constraint, trigger, stored procedure | Validation in route handler |
| Auto-logging history on change | Trigger (AFTER INSERT/UPDATE) | `setInterval` in app.js |
| Paginating large result sets | `OFFSET ... FETCH NEXT` (SQL Server) | Fetch all then filter in JS |
| Upsert | `MERGE` statement or `INSERT ... ON CONFLICT` | Separate SELECT-check then INSERT/UPDATE |
| Multi-dimensional reports/stats | CTE + Window function + GROUP BY combined | Many small queries merged in JS |
| Hold lock through transaction | `BEGIN TRANSACTION ... WITH (UPDLOCK)` + `COMMIT` | Check a flag then insert later |

### 14.2 - Mandatory Rules

1. **Concurrency**: Any read-write operation that can occur simultaneously MUST use
   the appropriate lock hint or isolation level. Example: room booking must use
   `SELECT ... WITH (UPDLOCK, HOLDLOCK)` to prevent double-booking.

2. **Aggregation**: Any computation over a dataset (total revenue, room ranking,
   average review score...) MUST use SQL Window functions or GROUP BY.
   Do NOT fetch raw data into JS and compute there.

3. **CTE instead of nested subqueries**: When a query is complex (more than 2 join
   levels or has loop-dependent conditions), use CTE for clarity and to allow
   the DB optimizer to cache the plan.

4. **Trigger for audit log**: Every change on a sensitive table (Reservation, Payment,
   Guest, GuestAuth) MUST be written to AuditLog via a trigger, not manually
   inside a route handler.

5. **Stored Procedure for complex business logic**: Logic with more than 3 related
   SQL steps (e.g. check-in flow, cancel flow) should be moved into a Stored
   Procedure to guarantee atomicity and avoid BE re-implementing it.

### 14.3 - Pre-coding Checklist

Before writing any data-related logic, ask yourself:
- Can this be written in a single SQL statement? -> If yes, use SQL.
- Is there a race condition risk? -> If yes, apply lock/transaction at the DB level.
- Does this compute over multiple rows? -> If yes, use a Window function.
- Is this logic repeated in multiple places? -> If yes, create a Stored Procedure or View.


---


## Rule 15: SQL Server Driver — msnodesqlv8 (ODBC) Compatibility

This project uses `msnodesqlv8` (ODBC driver) when `SQL_TRUSTED_CONNECTION=true` (Windows Authentication).
This driver has specific limitations compared to the default `mssql` (Tedious driver).

```js
// src/config/database.js
const sql = process.env.SQL_TRUSTED_CONNECTION === 'true'
  ? require('mssql/msnodesqlv8')   // ODBC — Windows Auth
  : require('mssql');              // Tedious — SQL Auth
```

### 15.1 - Unsupported Data Types in ODBC Driver

| Unsupported Type | Replace With | Correct Value Format |
|---|---|---|
| `sql.Date` | `sql.VarChar(10)` | String `'YYYY-MM-DD'` |
| `sql.Time` | `sql.VarChar(8)` | String `'HH:MM:SS'` |

**Error symptom:** `[Microsoft][ODBC SQL Server Driver]Invalid SQL data type`

### 15.2 - Mandatory Rules for Passing Date Parameters

**DO NOT DO THIS:**
```js
// Will fail with ODBC driver
request.input('stay_date', sql.Date, new Date(dateStr));
request.input('stay_date', sql.VarChar(10), new Date(dateStr)); // fails because Date object is passed
```

**DO THIS INSTEAD:**
```js
// Correct — pass string 'YYYY-MM-DD' directly into VarChar(10)
const dateStr = new Date(someDate).toISOString().slice(0, 10); // 'YYYY-MM-DD'
request.input('stay_date', sql.VarChar(10), dateStr);          // plain string, NOT a Date object
```

**General Rules:**
- All `DATE` type parameters in SQL Server must be passed via `sql.VarChar(10)` with string format `'YYYY-MM-DD'`.
- NEVER pass `new Date(...)` directly to `sql.VarChar(...)` — the ODBC driver will crash.
- SQL Server will automatically (implicitly) convert the `'YYYY-MM-DD'` string to a `DATE` type inside the query or stored procedure.

### 15.3 - Quick Debugging Guide

If you encounter `Invalid SQL data type`:
1. Find all `sql.Date` usages in the failing route -> change to `sql.VarChar(10)`.
2. Find all `new Date(...)` wrappers used alongside `sql.VarChar(10)` -> remove them, pass the string directly (use `.toISOString().slice(0, 10)` if needed).
3. Scan codebase: `Select-String -Path "src\routes\*.js" -Pattern "sql\.Date[^T]"` to quickly find issues.
