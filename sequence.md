# LuxeReserve — Sequence Diagrams

> **Engine:** SQL Server 2022 Express (T-SQL)
> **Key Business Flows:** Check-in, Check-out, Cancellation, Room Transfer, Reservation, Cleanup

---

## 1. Check-In Flow (`sp_CheckIn`)

```mermaid
sequenceDiagram
    participant Guest
    participant FrontDesk as Front Desk Agent
    participant sp_CheckIn as sp_CheckIn
    participant Reservation as Reservation Table
    participant ReservationRoom as ReservationRoom Table
    participant Room as Room Table
    participant StayRecord as StayRecord Table
    participant StatusHist as ReservationStatusHistory

    FrontDesk->>sp_CheckIn: EXEC sp_CheckIn(@reservation_id, @agent_id)
    activate sp_CheckIn

    sp_CheckIn->>sp_CheckIn: BEGIN TRANSACTION (XACT_ABORT ON)

    %% Step 1
    sp_CheckIn->>Reservation: UPDATE status = 'CHECKED_IN'<br/>WHERE status = 'CONFIRMED'
    Reservation-->>sp_CheckIn: @@ROWCOUNT = 1

    alt RowCount = 0
        sp_CheckIn->>sp_CheckIn: ROLLBACK + RAISERROR('Not CONFIRMED')
        sp_CheckIn-->>FrontDesk: Error: reservation not found or not CONFIRMED
    end

    %% Step 2
    sp_CheckIn->>ReservationRoom: UPDATE occupancy_status = 'IN_HOUSE'
    ReservationRoom-->>sp_CheckIn: Updated

    %% Step 3
    sp_CheckIn->>Room: UPDATE room_status = 'OCCUPIED'<br/>WHERE room_id IN (assigned rooms)
    Room-->>sp_CheckIn: Updated

    %% Step 4
    sp_CheckIn->>StayRecord: INSERT (reservation_room_id,<br/>actual_checkin_at = NOW(),<br/>stay_status = 'IN_HOUSE')
    StayRecord-->>sp_CheckIn: Inserted

    %% Step 5
    sp_CheckIn->>StatusHist: INSERT (old='CONFIRMED',<br/>new='CHECKED_IN',<br/>reason='Guest checked in')
    StatusHist-->>sp_CheckIn: Inserted

    sp_CheckIn->>sp_CheckIn: COMMIT TRANSACTION

    deactivate sp_CheckIn
    sp_CheckIn-->>FrontDesk: Return reservation details + room assignment
    FrontDesk-->>Guest: Room key issued
```

---

## 2. Check-Out Flow (`sp_CheckOut`)

```mermaid
sequenceDiagram
    participant Guest
    participant FrontDesk as Front Desk Agent
    participant sp_CheckOut as sp_CheckOut
    participant Reservation as Reservation Table
    participant ReservationRoom as ReservationRoom Table
    participant Room as Room Table
    participant StayRecord as StayRecord Table
    participant Housekeeping as HousekeepingTask Table
    participant ResvService as ReservationService Table
    participant StatusHist as ReservationStatusHistory
    participant vw_Total as vw_ReservationTotal

    FrontDesk->>sp_CheckOut: EXEC sp_CheckOut(@reservation_id, @agent_id)
    activate sp_CheckOut

    sp_CheckOut->>sp_CheckOut: BEGIN TRANSACTION (XACT_ABORT ON)

    %% Step 1
    sp_CheckOut->>Reservation: UPDATE status = 'CHECKED_OUT'<br/>WHERE status = 'CHECKED_IN'
    Reservation-->>sp_CheckOut: @@ROWCOUNT = 1

    alt RowCount = 0
        sp_CheckOut->>sp_CheckOut: ROLLBACK + RAISERROR
        sp_CheckOut-->>FrontDesk: Error
    end

    %% Step 2
    sp_CheckOut->>ReservationRoom: UPDATE occupancy_status = 'COMPLETED'
    ReservationRoom-->>sp_CheckOut: Updated

    %% Step 3
    sp_CheckOut->>Room: UPDATE room_status = 'AVAILABLE',<br/>housekeeping_status = 'DIRTY'
    Room-->>sp_CheckOut: Updated

    %% Step 4
    sp_CheckOut->>StayRecord: UPDATE actual_checkout_at = NOW(),<br/>stay_status = 'COMPLETED'
    StayRecord-->>sp_CheckOut: Updated

    %% Step 5
    sp_CheckOut->>Housekeeping: INSERT (task_type='CLEANING',<br/>priority='HIGH')
    Housekeeping-->>sp_CheckOut: Task created

    %% Step 6
    sp_CheckOut->>ResvService: UPDATE service_status = 'CANCELLED'<br/>WHERE status = 'REQUESTED'
    ResvService-->>sp_CheckOut: Cancelled

    %% Step 7
    sp_CheckOut->>StatusHist: INSERT (old='CHECKED_IN',<br/>new='CHECKED_OUT')
    StatusHist-->>sp_CheckOut: Inserted

    sp_CheckOut->>sp_CheckOut: COMMIT TRANSACTION

    %% Return financial summary
    sp_CheckOut->>vw_Total: SELECT grand_total, total_paid, balance_due
    vw_Total-->>sp_CheckOut: Financial summary

    deactivate sp_CheckOut
    sp_CheckOut-->>FrontDesk: Return reservation + financial summary
    FrontDesk-->>Guest: Final bill presented
```

---

## 3. Guest Cancellation (`sp_GuestCancel`)

```mermaid
sequenceDiagram
    participant Guest
    participant System as System
    participant sp_Cancel as sp_GuestCancel
    participant Reservation as Reservation Table
    participant RoomAvail as RoomAvailability Table
    participant Room as Room Table
    participant ResvRoom as ReservationRoom Table
    participant StatusHist as ReservationStatusHistory
    participant Payment as Payment Table

    Guest->>System: Request cancellation
    System->>sp_Cancel: EXEC sp_GuestCancel(@reservation_id, @reason)
    activate sp_Cancel

    %% Validation
    sp_Cancel->>Reservation: SELECT reservation_status
    Reservation-->>sp_Cancel: 'CONFIRMED'

    alt Status is NULL
        sp_Cancel-->>System: RAISERROR('Reservation not found')
    else Status <> 'CONFIRMED'
        sp_Cancel-->>System: RAISERROR('Cannot cancel: status is X')
    end

    sp_Cancel->>sp_Cancel: BEGIN TRANSACTION

    %% Step 1
    sp_Cancel->>Reservation: UPDATE status = 'CANCELLED'
    Reservation-->>sp_Cancel: Updated

    %% Step 2
    sp_Cancel->>RoomAvail: UPDATE availability_status = 'OPEN',<br/>sellable_flag = 1<br/>WHERE stay_date IN [checkin, checkout)
    RoomAvail-->>sp_Cancel: Released

    %% Step 3
    sp_Cancel->>Room: UPDATE room_status = 'AVAILABLE'
    Room-->>sp_Cancel: Updated

    %% Step 4
    sp_Cancel->>ResvRoom: UPDATE occupancy_status = 'CANCELLED'
    ResvRoom-->>sp_Cancel: Updated

    %% Step 5
    sp_Cancel->>StatusHist: INSERT (old='CONFIRMED',<br/>new='CANCELLED', reason)
    StatusHist-->>sp_Cancel: Inserted

    sp_Cancel->>sp_Cancel: COMMIT TRANSACTION

    %% Return result
    sp_Cancel->>Payment: SELECT SUM(deposit) AS deposit_forfeited
    Payment-->>sp_Cancel: Forfeited amount

    deactivate sp_Cancel
    sp_Cancel-->>System: Return cancelled status + forfeited deposit
    System-->>Guest: Cancellation confirmed (deposit forfeited)
```

---

## 4. Hotel Cancellation with Refund (`sp_HotelCancel`)

```mermaid
sequenceDiagram
    participant Agent as Hotel Agent
    participant sp_HCancel as sp_HotelCancel
    participant Reservation as Reservation Table
    participant Payment as Payment Table
    participant RoomAvail as RoomAvailability Table
    participant Room as Room Table
    participant ResvRoom as ReservationRoom Table
    participant StatusHist as ReservationStatusHistory

    Agent->>sp_HCancel: EXEC sp_HotelCancel(@reservation_id, @agent_id, @reason)
    activate sp_HCancel

    %% Validation
    sp_HCancel->>Reservation: SELECT reservation_status, reservation_code
    Reservation-->>sp_HCancel: Status + Code

    alt Status in (CANCELLED, CHECKED_OUT, NO_SHOW)
        sp_HCancel-->>Agent: RAISERROR('Cannot cancel')
    end

    %% Calculate refund
    sp_HCancel->>Payment: SELECT SUM(amount) WHERE status='CAPTURED'<br/>AND type <> 'REFUND'
    Payment-->>sp_HCancel: @refund_amount

    sp_HCancel->>sp_HCancel: BEGIN TRANSACTION

    %% Step 1
    sp_HCancel->>Reservation: UPDATE status = 'CANCELLED'
    Reservation-->>sp_HCancel: Updated

    %% Step 2
    sp_HCancel->>RoomAvail: UPDATE availability_status = 'OPEN',<br/>sellable_flag = 1
    RoomAvail-->>sp_HCancel: Released

    %% Step 3
    sp_HCancel->>Room: UPDATE room_status = 'AVAILABLE'
    Room-->>sp_HCancel: Updated

    %% Step 4
    sp_HCancel->>ResvRoom: UPDATE occupancy_status = 'CANCELLED'
    ResvRoom-->>sp_HCancel: Updated

    %% Step 5 (conditional refund)
    alt @refund_amount > 0
        sp_HCancel->>Payment: INSERT REFUND payment record<br/>(payment_type='REFUND',<br/>amount=@refund_amount)
        Payment-->>sp_HCancel: Refund recorded
    end

    %% Step 6
    sp_HCancel->>StatusHist: INSERT (old_status, new='CANCELLED',<br/>changed_by=@agent_id,<br/>reason='HOTEL CANCEL: ...')
    StatusHist-->>sp_HCancel: Inserted

    sp_HCancel->>sp_HCancel: COMMIT TRANSACTION

    deactivate sp_HCancel
    sp_HCancel-->>Agent: Return cancellation + refund_amount
```

---

## 5. Room Transfer with Pessimistic Locking (`sp_TransferRoom`)

```mermaid
sequenceDiagram
    participant Agent as Hotel Agent
    participant sp_Transfer as sp_TransferRoom
    participant RoomAvail as RoomAvailability Table
    participant ResvRoom as ReservationRoom Table
    participant Room as Room Table
    participant StatusHist as ReservationStatusHistory
    participant LockLog as InventoryLockLog

    Agent->>sp_Transfer: EXEC sp_TransferRoom(@resv_id, @old_room, @new_room,<br/>@checkin, @checkout, @reason, @agent_id)
    activate sp_Transfer

    sp_Transfer->>sp_Transfer: BEGIN TRANSACTION

    %% PHASE 1: Release OLD room (loop over nights)
    loop For each night in [checkin, checkout)
        sp_Transfer->>RoomAvail: SELECT WITH (UPDLOCK, HOLDLOCK)<br/>WHERE room_id = @old_room
        RoomAvail-->>sp_Transfer: Lock acquired

        alt Row not found
            sp_Transfer->>LockLog: INSERT FAILED
            sp_Transfer->>sp_Transfer: ROLLBACK
            sp_Transfer-->>Agent: Error: OLD_NOT_FOUND
        end

        sp_Transfer->>RoomAvail: UPDATE status = 'OPEN',<br/>sellable_flag = 1,<br/>version_no++
        RoomAvail-->>sp_Transfer: Released

        sp_Transfer->>LockLog: INSERT RELEASED
        LockLog-->>sp_Transfer: Logged
    end

    %% PHASE 2: Lock & book NEW room (loop over nights)
    loop For each night in [checkin, checkout)
        sp_Transfer->>RoomAvail: SELECT WITH (UPDLOCK, HOLDLOCK)<br/>WHERE room_id = @new_room
        RoomAvail-->>sp_Transfer: Lock acquired

        alt Status <> 'OPEN' or not found
            sp_Transfer->>LockLog: INSERT FAILED
            sp_Transfer->>sp_Transfer: ROLLBACK (atomic - old room changes also undone)
            sp_Transfer-->>Agent: Error: NEW_NOT_AVAILABLE
        end

        sp_Transfer->>RoomAvail: UPDATE status = 'BOOKED',<br/>sellable_flag = 0,<br/>version_no++
        RoomAvail-->>sp_Transfer: Booked

        sp_Transfer->>LockLog: INSERT SUCCESS
        LockLog-->>sp_Transfer: Logged
    end

    %% PHASE 3
    sp_Transfer->>ResvRoom: UPDATE room_id = @new_room_id
    ResvRoom-->>sp_Transfer: Updated

    %% PHASE 4
    sp_Transfer->>Room: UPDATE old_room: status='AVAILABLE'<br/>(or 'UNDER_REPAIR' if maintenance)
    sp_Transfer->>Room: UPDATE new_room: status='OCCUPIED'/'RESERVED'

    %% PHASE 5
    sp_Transfer->>StatusHist: INSERT room transfer log
    StatusHist-->>sp_Transfer: Logged

    sp_Transfer->>sp_Transfer: COMMIT TRANSACTION

    deactivate sp_Transfer
    sp_Transfer-->>Agent: SUCCESS: Room transferred
```

---

## 6. Room Reservation with Pessimistic Locking (`sp_ReserveRoom`)

```mermaid
sequenceDiagram
    participant App as Node.js App
    participant sp_Reserve as sp_ReserveRoom
    participant RoomAvail as RoomAvailability Table
    participant LockLog as InventoryLockLog

    App->>sp_Reserve: EXEC sp_ReserveRoom(@room_id, @stay_date,<br/>@reservation_code, @session_id,<br/>@result_status OUTPUT, @result_message OUTPUT)
    activate sp_Reserve

    sp_Reserve->>sp_Reserve: Check @@TRANCOUNT<br/>IF 0: BEGIN TRANSACTION<br/>ELSE: SAVE TRANSACTION @SavePointName

    %% STEP 1: Pessimistic Lock
    sp_Reserve->>RoomAvail: SELECT availability_status<br/>WITH (UPDLOCK, HOLDLOCK)<br/>WHERE room_id = @room_id AND stay_date = @stay_date
    RoomAvail-->>sp_Reserve: @current_status

    alt @current_status IS NULL
        sp_Reserve->>LockLog: INSERT FAILED (not found)
        sp_Reserve->>sp_Reserve: ROLLBACK
        sp_Reserve-->>App: result_status=1, 'NOT_FOUND'
    end

    %% STEP 2: Check availability
    alt @current_status <> 'OPEN'
        sp_Reserve->>LockLog: INSERT FAILED (not available)
        sp_Reserve->>sp_Reserve: ROLLBACK (savepoint)
        sp_Reserve-->>App: result_status=2, 'REJECTED'
    end

    %% STEP 3: Reserve
    sp_Reserve->>RoomAvail: UPDATE status = 'BOOKED',<br/>sellable_flag = 0,<br/>version_no++
    RoomAvail-->>sp_Reserve: Reserved

    %% STEP 4: Log
    sp_Reserve->>LockLog: INSERT SUCCESS
    LockLog-->>sp_Reserve: Logged

    sp_Reserve->>sp_Reserve: IF @@TRANCOUNT=1: COMMIT

    deactivate sp_Reserve
    sp_Reserve-->>App: result_status=0, 'SUCCESS'
```

---

## 7. Abandoned Reservation Cleanup (`sp_CleanupAbandonedReservations`)

```mermaid
sequenceDiagram
    participant Scheduler as Scheduled Job
    participant sp_Cleanup as sp_CleanupAbandonedReservations
    participant sp_Cancel as sp_CancelAbandonedReservation
    participant Reservation as Reservation Table
    participant Payment as Payment Table
    participant #Abandoned as Temp Table #Abandoned
    participant Cursor as Cursor

    Scheduler->>sp_Cleanup: EXEC sp_CleanupAbandonedReservations(@window_minutes = 30)
    activate sp_Cleanup

    %% Collect abandoned reservations
    sp_Cleanup->>Reservation: SELECT WHERE status='CONFIRMED'<br/>AND created_at < NOW - 30min<br/>AND no captured payment
    Reservation-->>sp_Cleanup: Abandoned reservations
    sp_Cleanup->>#Abandoned: INSERT INTO temp table

    %% Cursor loop
    sp_Cleanup->>Cursor: DECLARE CURSOR FOR SELECT reservation_code
    activate Cursor

    loop For each abandoned reservation
        Cursor-->>sp_Cleanup: Next @code
        sp_Cleanup->>sp_Cancel: EXEC sp_CancelAbandonedReservation(@code, @reason)
        activate sp_Cancel

        sp_Cancel->>Reservation: UPDATE status = 'CANCELLED'
        sp_Cancel->>RoomAvail: UPDATE status = 'OPEN', sellable_flag = 1
        sp_Cancel->>ResvRoom: UPDATE occupancy_status = 'CANCELLED'
        sp_Cancel->>StatusHist: INSERT status change log

        deactivate sp_Cancel
    end

    deactivate Cursor

    sp_Cleanup-->>Scheduler: Return list of cancelled reservation_ids + codes

    deactivate sp_Cleanup
```

---

## 8. Trigger: Auto-Status-History (`trg_Reservation_StatusHistory`)

```mermaid
sequenceDiagram
    participant App as Application
    participant Reservation as Reservation Table
    participant Trigger as trg_Reservation_StatusHistory
    participant StatusHist as ReservationStatusHistory Table

    App->>Reservation: UPDATE reservation_status = 'CHECKED_IN'
    activate Reservation

    Reservation->>Trigger: AFTER UPDATE fires
    activate Trigger

    Trigger->>Trigger: IF NOT UPDATE(reservation_status) → RETURN

    Trigger->>StatusHist: INSERT (old_status, new_status,<br/>auto-generated reason)
    StatusHist-->>Trigger: Inserted

    deactivate Trigger
    deactivate Reservation

    App-->>App: UPDATE completed (trigger ran silently)
```

---

## 9. Trigger: Price Integrity Guard (`trg_RoomRate_PriceIntegrityGuard`)

```mermaid
sequenceDiagram
    participant App as Application
    participant RoomRate as RoomRate Table
    participant Trigger as trg_RoomRate_PriceIntegrityGuard
    participant RateLog as RateChangeLog Table

    App->>RoomRate: UPDATE final_rate (e.g., 200 → 500 = +150%)
    activate RoomRate

    RoomRate->>Trigger: AFTER UPDATE fires
    activate Trigger

    Trigger->>Trigger: IF NOT UPDATE(final_rate) → RETURN

    Trigger->>RateLog: INSERT (old_rate=200, new_rate=500,<br/>change=300, change_pct=150%,<br/>severity='CRITICAL', status='OPEN')
    RateLog-->>Trigger: Audit logged

    deactivate Trigger
    deactivate RoomRate

    App-->>App: UPDATE succeeded (trigger logged warning)
```

---

## 10. Trigger: Payment Audit Log (`trg_Payment_AuditLog`)

```mermaid
sequenceDiagram
    participant App as Application
    participant Payment as Payment Table
    participant Trigger as trg_Payment_AuditLog
    participant AuditLog as AuditLog Table

    App->>Payment: INSERT new payment
    activate Payment

    Payment->>Trigger: AFTER INSERT fires
    activate Trigger

    Trigger->>Trigger: No deleted rows → INSERT case

    Trigger->>AuditLog: INSERT (entity='Payment',<br/>action='INSERT',<br/>new_value_json with payment details)
    AuditLog-->>Trigger: Logged

    deactivate Trigger
    deactivate Payment

    Note over App,AuditLog: On UPDATE with status change →<br/>logs 'STATUS_CHANGE' with old/new values
```

---

## Legend

| Symbol | Meaning |
|--------|---------|
| `->>` | Synchronous call |
| `-->>` | Return/response |
| `activate` | Start lifeline |
| `deactivate` | End lifeline |
| `alt` | Conditional branch |
| `loop` | Iteration |
| `Note over` | Annotation |

---

*Generated from `database/sql/05_create_procedures.sql`, `database/sql/23_advanced_stored_procedures.sql`, `database/sql/24_audit_triggers.sql`, and `database/sql/04_create_triggers.sql`.*
