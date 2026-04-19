# UI Rebuild Plan Based on Booking.com Structure

## 1. UI Reset Rationale

The current frontend should not be treated as a foundation for future work.

Reasons:

- It was started too early, before the core public booking journey was stabilized.
- Several screens were built as working tools instead of product-grade customer journeys.
- Guest flow, loyalty flow, reservation self-service, and admin operations were mixed too soon.
- Layout and navigation decisions were made before the correct page architecture was locked.
- The next frontend pass should start from business flow first, not from the current component tree.

This document is the new source of truth for rebuilding the frontend from zero.

The old frontend is not a baseline.

## 2. Product Scope For This Hotel-Only Platform

The rebuilt product is a hotel-chain booking website, not a travel super-app.

In scope:

- search destinations where the chain has hotels
- compare hotels inside the chain only
- open a hotel detail page before booking
- complete booking as anonymous or logged-in loyalty guest
- guest reservation lookup and self-service
- guest account basics
- separate admin portal for operations

Out of scope:

- flights
- flight + hotel
- car rental
- attractions
- airport taxi
- marketplace-scale review ecosystem
- large-scale third-party property listings
- deep smart filters not supported by backend truth
- wallet, reward redemption, or voucher marketplace in v1

## 3. Reference Patterns Taken From Booking.com

The Booking.com screenshots in the [`hotel`](C:\Users\cbzer\Downloads\HCSDLNC\hotel) folder should be used as structural references only.

Adopt:

- homepage with a dominant search bar above the fold
- destination-first search entry
- separate search results page
- left sidebar filters on search results
- top sort row above hotel cards
- list/grid results concept
- hotel detail page before booking
- checkout-style booking page with a right or left summary sidebar
- account area separated from public browsing

Do not adopt:

- Booking.com branding, color system, or full visual clone
- tabs for flights, taxis, attractions, or rental cars
- large review-led marketplace complexity
- filters that require data the backend does not expose

Visual direction:

- use Booking.com for information hierarchy and page order
- keep LuxeReserve as the product identity
- visual polish is secondary to workflow correctness in the rebuild

## 4. Page Architecture

The rebuild should use this route map:

- `/`
  - public homepage
- `/search`
  - destination search results
- `/hotel/:id`
  - hotel detail page
- `/booking/:hotelId`
  - booking flow entry for a selected hotel
- `/booking/:hotelId/:roomId`
  - booking flow for a selected room option
- `/reservation`
  - guest reservation lookup and self-service
- `/login`
  - guest login
- `/register`
  - guest registration
- `/account`
  - guest account overview
- `/admin/login`
  - admin login
- `/admin/*`
  - admin operational portal

These routes should replace the earlier mixed-page model.

## 5. Core User Journeys

### 5.1 Anonymous Guest Journey

Flow:

1. Open homepage
2. Enter destination, dates, and guest count in the hero search bar
3. Move to `/search`
4. Compare chain hotels in the destination
5. Open `/hotel/:id`
6. Review hotel content, amenities, room options, and promotions
7. Select a room and move to booking
8. Enter guest details manually
9. Confirm booking and payment details
10. Land on reservation confirmation and later use `/reservation` for lookup

Rules:

- anonymous users must be able to book without creating an account
- anonymous users must never see account-only assumptions in the booking form
- hotel comparison comes before room selection

### 5.2 Loyalty Guest Journey

Flow:

1. Guest signs in through `/login`
2. Search and browse exactly like anonymous flow
3. Booking form is prefilled using guest profile
4. Member context is visible during booking
5. Applicable member-only promotions can be shown
6. Reservation is visible later in `/account` and `/reservation`

Rules:

- loyalty is an enhancement to booking, not a separate booking model
- v1 loyalty scope is profile + status + offers only
- no points redemption or wallet behavior in v1

### 5.3 Guest Reservation Self-Service

`/reservation` should remain guest-facing only.

Allowed:

- lookup by reservation code
- reservation summary
- payment summary
- guest-facing payment actions if enabled
- guest cancellation if backend rules allow it
- read-only lifecycle/status timeline

Not allowed:

- check-in
- check-out
- invoice issue
- service operations
- housekeeping or maintenance actions
- hotel-side operational workflows

### 5.4 Admin Journey

Admin should be a separate product area.

Flow:

1. Login via `/admin/login`
2. Enter admin portal
3. Access front desk, inventory, and operational tools
4. Manage reservation lifecycle and hotel-side operations

Admin owns:

- reservation operations
- check-in
- check-out
- hotel cancellation
- inventory management
- invoice issue
- housekeeping and maintenance views
- operational feeds and reporting

Public guest pages must never expose admin actions.

## 6. Page-Level Behavior

### 6.1 Homepage `/`

Homepage sections:

- header with brand and auth entry points
- hero banner with main search bar
- curated hot destinations
- featured hotels or promotions
- trust/value section
- footer

Hero search bar fields:

- destination
- check-in / check-out
- guests
- search button

Homepage must not contain:

- booking steps
- room cards
- admin workflow shortcuts
- large operational widgets

### 6.2 Search Results `/search`

Purpose:

- compare hotels in the selected destination before entering a hotel detail page

Layout:

- top persistent search row
- top sort row
- optional map placeholder area
- left filter sidebar
- right result list or grid

Result cards should show:

- hotel name
- location summary
- star rating
- brand
- chain
- a starting price if available
- a few highlights or amenity cues
- CTA to open hotel detail

Search results should compare hotels first, not individual room variants.

Allowed filters in v1:

- budget per night
- district / area
- brand
- hotel type
- star rating

Deferred filters:

- smart filters based on natural language
- review-score filters unless backed by real data
- landmark distance filters
- accessibility filters
- pet-friendly filters
- breakfast-specific filters unless backend truth exists
- marketplace-scale checkbox walls like Booking.com

### 6.3 Hotel Detail `/hotel/:id`

This page must always exist before booking.

Sections:

- image gallery
- hotel title and location summary
- address and map summary
- overview / description
- amenities
- room options
- active promotions
- primary reserve CTA

Room options should be the bridge from hotel browsing to booking.

Reserve CTA behavior:

- selecting a room opens `/booking/:hotelId/:roomId`
- if a room is not yet selected, the hotel page should encourage choosing a room first

### 6.4 Booking `/booking/:hotelId` or `/booking/:hotelId/:roomId`

This page should behave like a checkout flow, not like search.

Booking steps:

1. selected hotel and room summary
2. guest details
3. payment / confirmation

Layout:

- main form area
- summary sidebar

Summary sidebar should include:

- hotel
- stay dates
- guest count
- selected room
- pricing summary
- guarantee/payment summary

Rules:

- anonymous guests enter details manually
- logged-in guests get autofill and loyalty context
- booking page must not include admin or service operations
- hotel comparison and room discovery should already be done before this page

### 6.5 Account `/account`

This is the basic guest account area.

Sections:

- profile basics
- account identity
- upcoming stays
- reservation history
- loyalty summary if applicable

Do not build in v1:

- wallet
- reward redemption
- voucher center
- complex preference center

### 6.6 Admin `/admin/*`

Admin remains fully separate from the guest/public journey.

Admin page groups:

- front desk
- inventory
- operations
- reports

This area should not share workflow assumptions with public pages.

## 7. Rebuild Phases

The rebuild must happen in this order:

### Phase 1: Architecture And Routing

- finalize page map
- create global shell
- separate public routes, account routes, and admin routes
- define auth entry points

### Phase 2: Homepage

- build header and footer
- build hero banner and destination search
- build hot destination cards
- build featured properties/promotions section
- build trust/value section

### Phase 3: Search Results

- build `/search`
- implement destination-driven hotel comparison
- implement allowed filters only
- add sort row
- add result list/grid mode if needed
- add optional map placeholder block

### Phase 4: Hotel Detail

- build `/hotel/:id`
- add gallery, overview, amenities, room options, and promotions
- connect reserve CTA to booking flow

### Phase 5: Booking Flow

- build checkout-style booking page
- support anonymous booking
- support logged-in loyalty autofill
- build summary sidebar
- finalize confirmation state

### Phase 6: Reservation Self-Service

- build guest lookup page
- add summary, timeline, payment summary, and guest actions
- keep admin actions out

### Phase 7: Account

- build guest account shell
- add profile summary, upcoming stays, history, and loyalty snapshot

### Phase 8: Admin

- build separate admin login
- rebuild admin portal independently from public flow

### Phase 9: Polish

- refine responsive behavior
- improve visual system
- improve consistency and accessibility

No advanced UI polish should start before Phase 1 through Phase 6 are structurally correct.

## 8. Backend Mapping

The new frontend should use the current backend as the implementation foundation.

### Homepage / Search / Hotel Detail

- `GET /api/hotels`
- `GET /api/hotels/:id`
- `GET /api/promotions`
- `GET /api/rooms/availability`

### Guest Auth / Account

- `POST /api/auth/login`
- `POST /api/auth/guest/login`
- `POST /api/auth/guest/register`
- `GET /api/auth/me`

### Booking / Reservation

- `POST /api/reservations`
- `GET /api/reservations/:code`
- `POST /api/payments`

### Admin

- `/api/admin/*`

Important rule:

- filters, widgets, and comparisons must only depend on fields that actually exist in backend responses
- the UI must not invent marketplace-style features that backend data cannot truthfully support

## 9. Endpoint Utilization Strategy

The backend exposes far more endpoints than the first UI rebuild needs. The rebuild should not try to surface everything at once. Instead, every endpoint group should be classified clearly so the frontend roadmap uses the backend deliberately rather than partially by accident.

### 9.1 Public V1 Endpoints

These should be wired into the first public rebuild:

- hotels
  - `/api/hotels`
  - `/api/hotels/:id`
- promotions
  - `/api/promotions`
- search and inventory
  - `/api/rooms/availability`
  - `/api/locations`
  - `/api/locations/tree`
- auth
  - `/api/auth/login`
  - `/api/auth/guest/register`
  - `/api/auth/guest/login`
  - `/api/auth/me`
- booking and reservation
  - `/api/reservations`
  - `/api/reservations/:code`
- guest-facing payment
  - `/api/payments`
  - `/api/payments?reservation_id=`
- guest-facing cancellation
  - `/api/reservations/:id/guest-cancel`

### 9.2 Guest Account / Loyalty Endpoints

These belong in account and signed-in guest experiences:

- `/api/auth/me`
- `/api/promotions?guest_id=`
- `/api/reservations/:code`
- `/api/payments?reservation_id=`

These should support:

- profile context
- loyalty display
- member offers
- reservation history or upcoming stays once account UI is added

### 9.3 Admin Portal Endpoints

These should be considered first-class for the admin rebuild, even if they are not used in public v1:

- admin pricing and revenue
  - `/api/admin/rates/:id`
  - `/api/admin/rates/alerts`
  - `/api/admin/reports/revenue`
  - `/api/admin/reports/revenue-by-brand`
  - `/api/admin/availability/:id`
- reservation operations
  - `/api/reservations/:id/checkin`
  - `/api/reservations/:id/checkout`
  - `/api/reservations/:id/hotel-cancel`
  - `/api/reservations/:id/transfer`
- services
  - `/api/services`
  - `/api/services/order`
  - `/api/services/orders`
  - `/api/services/orders/:id/status`
  - `/api/services/orders/:id/pay`
- housekeeping
  - `/api/housekeeping`
  - `/api/housekeeping/:id/assign`
  - `/api/housekeeping/:id/status`
- maintenance
  - `/api/maintenance`
  - `/api/maintenance/:id`
- invoices
  - `/api/invoices`
  - `/api/invoices/:id`
  - `/api/invoices/:id/issue`

### 9.4 Existing But Not Prioritized For First UI Pass

These endpoints exist and should be acknowledged in the roadmap, but they should not distort the first clean rebuild:

- `/api/guests`
- `/api/guests/:id`
- `/api/guests` `POST`

They are useful for admin/data workflows, but the new public UI should not depend on a broad guest list to function.

### 9.5 Rule For Endpoint Coverage

The UI plan should not aim to use all backend endpoints in the first release.

Instead:

- all endpoint groups must be acknowledged
- each endpoint group must be assigned to a product surface
- anything not used in v1 must be intentionally deferred, not silently ignored
- backend breadth should shape the long-term roadmap, not overload the first rebuild

## 10. Deferred Features / Not In V1

These should be explicitly postponed:

- flights
- flight + hotel
- taxi
- attractions
- car rental
- wallet and reward redemption
- advanced smart filters
- huge review ecosystem
- large-scale landmark and neighborhood intelligence
- public invoice workflow
- public service operations
- admin tools inside guest pages

## 11. Acceptance Criteria

`plan_UI.md` is complete if a new implementer can answer all of these without guessing:

- which Booking.com patterns are intentionally reused
- which Booking.com features are excluded
- what the homepage should contain
- what the `/search` page is responsible for
- why hotel detail must always exist before booking
- how anonymous booking works
- how loyalty booking differs
- what belongs in `/reservation`
- what belongs in `/account`
- what belongs only in `/admin`
- which filters are valid in v1
- which endpoint groups belong to public v1, loyalty/account, admin, or deferred use
- which features are deferred

## 12. Default Build Rules

- workflow correctness comes before visual polish
- hotel comparison comes before booking
- room choice happens on hotel detail, not homepage
- booking is checkout-style, not search-style
- admin is fully separate from guest product flow
- backend truth is the limit for frontend complexity
