USE LuxeReserve;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT '';
PRINT '========================================';
PRINT '  Seed demo operational data';
PRINT '========================================';
GO

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @today DATE = CAST(GETDATE() AS DATE);
    DECLARE @opsStart DATE = DATEADD(DAY, -7, @today);
    DECLARE @opsEnd DATE = DATEADD(DAY, 30, @today);
    DECLARE @cursorDate DATE = @opsStart;

    -- Ensure current operational availability exists around today for demo actions.
    WHILE @cursorDate <= @opsEnd
    BEGIN
        INSERT INTO RoomAvailability (hotel_id, room_id, stay_date, availability_status, sellable_flag, inventory_note)
        SELECT r.hotel_id, r.room_id, @cursorDate, 'OPEN', 1, N'[DEMO] operational seed window'
        FROM Room r
        WHERE NOT EXISTS (
            SELECT 1
            FROM RoomAvailability ra
            WHERE ra.room_id = r.room_id
              AND ra.stay_date = @cursorDate
        );

        SET @cursorDate = DATEADD(DAY, 1, @cursorDate);
    END;

    DECLARE @demoReservations TABLE (reservation_id BIGINT PRIMARY KEY);

    INSERT INTO @demoReservations (reservation_id)
    SELECT reservation_id
    FROM Reservation
    WHERE reservation_code LIKE 'RES-DEMO-%';

    DELETE i
    FROM Invoice i
    JOIN @demoReservations d ON d.reservation_id = i.reservation_id;

    DELETE p
    FROM Payment p
    JOIN @demoReservations d ON d.reservation_id = p.reservation_id;

    DELETE rs
    FROM ReservationService rs
    JOIN @demoReservations d ON d.reservation_id = rs.reservation_id;

    DELETE sr
    FROM StayRecord sr
    JOIN ReservationRoom rr ON rr.reservation_room_id = sr.reservation_room_id
    JOIN @demoReservations d ON d.reservation_id = rr.reservation_id;

    DELETE rg
    FROM ReservationGuest rg
    JOIN @demoReservations d ON d.reservation_id = rg.reservation_id;

    DELETE rsh
    FROM ReservationStatusHistory rsh
    JOIN @demoReservations d ON d.reservation_id = rsh.reservation_id;

    DELETE rr
    FROM ReservationRoom rr
    JOIN @demoReservations d ON d.reservation_id = rr.reservation_id;

    DELETE r
    FROM Reservation r
    JOIN @demoReservations d ON d.reservation_id = r.reservation_id;

    DELETE FROM HousekeepingTask
    WHERE note LIKE N'[[]DEMO[]]%';

    DELETE FROM MaintenanceTicket
    WHERE issue_description LIKE N'[[]DEMO[]]%'
       OR resolution_note LIKE N'[[]DEMO[]]%';

    -- Reset demo rooms before applying the final seeded state.
    UPDATE Room
    SET room_status = 'AVAILABLE',
        housekeeping_status = 'CLEAN',
        maintenance_status = 'NORMAL',
        updated_at = GETDATE()
    WHERE room_id IN (1, 2, 3, 4, 6, 7, 9);

    UPDATE RoomAvailability
    SET availability_status = 'OPEN',
        sellable_flag = 1,
        inventory_note = NULL,
        updated_at = GETDATE()
    WHERE room_id IN (1, 2, 3, 4, 6)
      AND stay_date BETWEEN @opsStart AND @opsEnd;

    -- Demo reservations spanning core front desk states.
    INSERT INTO Reservation (
        reservation_code, hotel_id, guest_id, booking_channel_id, booking_source,
        reservation_status, booking_datetime, checkin_date, checkout_date, nights,
        adult_count, child_count, room_count, currency_code,
        subtotal_amount, tax_amount, service_charge_amount, discount_amount, grand_total_amount,
        deposit_required_flag, deposit_amount, guarantee_type,
        special_request_text, arrival_time_estimate, purpose_of_stay,
        created_by_user_id, created_at, updated_at
    ) VALUES
    (
        'RES-DEMO-ARRIVAL-001', 1, 1, 1, 'DIRECT_WEB',
        'CONFIRMED', DATEADD(DAY, -3, GETDATE()), @today, DATEADD(DAY, 2, @today), 2,
        2, 0, 1, 'VND',
        9000000, 900000, 0, 0, 9900000,
        1, 2000000, 'DEPOSIT',
        N'[DEMO] VIP arrival today - early luggage drop requested', '14:30', 'LEISURE',
        1, DATEADD(DAY, -3, GETDATE()), DATEADD(DAY, -3, GETDATE())
    ),
    (
        'RES-DEMO-INHOUSE-001', 1, 1, 2, 'WALK_IN',
        'CHECKED_IN', DATEADD(DAY, -10, GETDATE()), DATEADD(DAY, -2, @today), @today, 2,
        1, 0, 1, 'VND',
        24000000, 2400000, 0, 0, 34900000,
        1, 10000000, 'DEPOSIT',
        N'[DEMO] In-house guest with spa and transfer incidentals', '15:00', 'BUSINESS',
        2, DATEADD(DAY, -10, GETDATE()), DATEADD(HOUR, -6, GETDATE())
    ),
    (
        'RES-DEMO-COMPLETED-001', 1, 1, 1, 'DIRECT_WEB',
        'CHECKED_OUT', DATEADD(DAY, -12, GETDATE()), DATEADD(DAY, -7, @today), DATEADD(DAY, -5, @today), 2,
        2, 0, 1, 'VND',
        9000000, 900000, 0, 0, 17900000,
        1, 5000000, 'DEPOSIT',
        N'[DEMO] Completed stay for invoice and payment history', '15:30', 'LEISURE',
        1, DATEADD(DAY, -12, GETDATE()), DATEADD(DAY, -5, GETDATE())
    ),
    (
        'RES-DEMO-CANCELLED-001', 1, 1, 2, 'CALL_CENTER',
        'CANCELLED', DATEADD(DAY, -1, GETDATE()), DATEADD(DAY, 5, @today), DATEADD(DAY, 6, @today), 1,
        1, 0, 1, 'VND',
        4500000, 450000, 0, 0, 4950000,
        0, 0, 'NONE',
        N'[DEMO] Cancelled booking retained for timeline and audit screens', '17:00', 'OTHER',
        2, DATEADD(DAY, -1, GETDATE()), DATEADD(HOUR, -12, GETDATE())
    );

    DECLARE @resArrival BIGINT = (SELECT reservation_id FROM Reservation WHERE reservation_code = 'RES-DEMO-ARRIVAL-001');
    DECLARE @resInHouse BIGINT = (SELECT reservation_id FROM Reservation WHERE reservation_code = 'RES-DEMO-INHOUSE-001');
    DECLARE @resCompleted BIGINT = (SELECT reservation_id FROM Reservation WHERE reservation_code = 'RES-DEMO-COMPLETED-001');
    DECLARE @resCancelled BIGINT = (SELECT reservation_id FROM Reservation WHERE reservation_code = 'RES-DEMO-CANCELLED-001');

    INSERT INTO ReservationRoom (
        reservation_id, room_id, room_type_id, rate_plan_id, assigned_room_number_snapshot,
        stay_start_date, stay_end_date, adult_count, child_count,
        nightly_rate_snapshot, room_subtotal, tax_amount, discount_amount, final_amount,
        assignment_status, occupancy_status, created_at, updated_at
    ) VALUES
    (
        @resArrival, 1, 1, 1, '1501',
        @today, DATEADD(DAY, 2, @today), 2, 0,
        4500000, 9000000, 900000, 0, 9900000,
        'ASSIGNED', 'RESERVED', DATEADD(DAY, -3, GETDATE()), DATEADD(DAY, -3, GETDATE())
    ),
    (
        @resInHouse, 4, 2, 1, '2001',
        DATEADD(DAY, -2, @today), @today, 1, 0,
        12000000, 24000000, 2400000, 0, 26400000,
        'ASSIGNED', 'IN_HOUSE', DATEADD(DAY, -10, GETDATE()), DATEADD(HOUR, -6, GETDATE())
    ),
    (
        @resCompleted, 2, 1, 1, '1502',
        DATEADD(DAY, -7, @today), DATEADD(DAY, -5, @today), 2, 0,
        4500000, 9000000, 900000, 0, 9900000,
        'ASSIGNED', 'COMPLETED', DATEADD(DAY, -12, GETDATE()), DATEADD(DAY, -5, GETDATE())
    ),
    (
        @resCancelled, 3, 1, 2, '1601',
        DATEADD(DAY, 5, @today), DATEADD(DAY, 6, @today), 1, 0,
        4500000, 4500000, 450000, 0, 4950000,
        'ASSIGNED', 'CANCELLED', DATEADD(DAY, -1, GETDATE()), DATEADD(HOUR, -12, GETDATE())
    );

    INSERT INTO ReservationGuest (
        reservation_id, guest_id, full_name, is_primary_guest, age_category,
        nationality_country_code, document_type, document_no, special_note
    ) VALUES
    (@resArrival, 1, N'Dinh Quoc Cuong', 1, 'ADULT', 'VN', 'PASSPORT', 'P1234567', N'[DEMO] Primary guest'),
    (@resArrival, NULL, N'Ha My Cuong', 0, 'CHILD', 'VN', NULL, NULL, N'[DEMO] Child guest for breakfast planning'),
    (@resInHouse, 1, N'Dinh Quoc Cuong', 1, 'ADULT', 'VN', 'PASSPORT', 'P1234567', N'[DEMO] Primary guest'),
    (@resCompleted, 1, N'Dinh Quoc Cuong', 1, 'ADULT', 'VN', 'PASSPORT', 'P1234567', N'[DEMO] Primary guest');

    DECLARE @rrInHouse BIGINT = (
        SELECT rr.reservation_room_id
        FROM ReservationRoom rr
        WHERE rr.reservation_id = @resInHouse
    );
    DECLARE @rrCompleted BIGINT = (
        SELECT rr.reservation_room_id
        FROM ReservationRoom rr
        WHERE rr.reservation_id = @resCompleted
    );

    INSERT INTO StayRecord (
        reservation_room_id, actual_checkin_at, actual_checkout_at,
        frontdesk_agent_id, stay_status, deposit_hold_amount, incident_note,
        created_at, updated_at
    ) VALUES
    (
        @rrInHouse, DATEADD(DAY, -2, DATEADD(HOUR, 15, CAST(@today AS DATETIME))), NULL,
        2, 'IN_HOUSE', 3000000, N'[DEMO] Guest currently in house',
        DATEADD(DAY, -2, GETDATE()), DATEADD(HOUR, -6, GETDATE())
    ),
    (
        @rrCompleted,
        DATEADD(DAY, -7, DATEADD(HOUR, 15, CAST(@today AS DATETIME))),
        DATEADD(DAY, -5, DATEADD(HOUR, 11, CAST(@today AS DATETIME))),
        2, 'COMPLETED', 2000000, N'[DEMO] Late checkout approved by front desk',
        DATEADD(DAY, -7, GETDATE()), DATEADD(DAY, -5, GETDATE())
    );

    DECLARE @svcSpa BIGINT = (
        SELECT service_id FROM ServiceCatalog WHERE hotel_id = 1 AND service_code = 'SPA001'
    );
    DECLARE @svcTransfer BIGINT = (
        SELECT service_id FROM ServiceCatalog WHERE hotel_id = 1 AND service_code = 'TRN001'
    );
    DECLARE @svcDining BIGINT = (
        SELECT service_id FROM ServiceCatalog WHERE hotel_id = 1 AND service_code = 'DIN001'
    );

    INSERT INTO ReservationService (
        reservation_id, reservation_room_id, service_id, scheduled_at,
        quantity, unit_price, discount_amount, final_amount, service_status,
        special_instruction, created_at, updated_at
    ) VALUES
    (
        @resInHouse, @rrInHouse, @svcSpa, DATEADD(HOUR, 16, CAST(@today AS DATETIME)),
        1, 3500000, 0, 3500000, 'REQUESTED',
        N'[DEMO] Request spa slot before departure', DATEADD(HOUR, -4, GETDATE()), DATEADD(HOUR, -4, GETDATE())
    ),
    (
        @resInHouse, @rrInHouse, @svcTransfer, DATEADD(HOUR, 18, CAST(@today AS DATETIME)),
        1, 5000000, 0, 5000000, 'DELIVERED',
        N'[DEMO] Airport transfer completed for departure run', DATEADD(HOUR, -10, GETDATE()), DATEADD(HOUR, -2, GETDATE())
    ),
    (
        @resCompleted, @rrCompleted, @svcDining, DATEADD(DAY, -6, DATEADD(HOUR, 19, CAST(@today AS DATETIME))),
        1, 8000000, 0, 8000000, 'DELIVERED',
        N'[DEMO] Celebration private dining order', DATEADD(DAY, -6, GETDATE()), DATEADD(DAY, -6, GETDATE())
    );

    DECLARE @transferOrderId BIGINT = (
        SELECT rs.reservation_service_id
        FROM ReservationService rs
        WHERE rs.reservation_id = @resInHouse
          AND rs.service_id = @svcTransfer
    );

    INSERT INTO Payment (
        reservation_id, payment_reference, payment_type, payment_method, payment_status,
        gateway_transaction_id, amount, currency_code, exchange_rate, paid_at,
        failure_reason, created_at, updated_at
    ) VALUES
    (
        @resArrival, 'PAY-DEMO-DEP-ARR-001', 'DEPOSIT', 'CREDIT_CARD', 'CAPTURED',
        'GTW-DEMO-ARR-001', 2000000, 'VND', NULL, DATEADD(DAY, -3, GETDATE()),
        NULL, DATEADD(DAY, -3, GETDATE()), DATEADD(DAY, -3, GETDATE())
    ),
    (
        @resInHouse, 'PAY-DEMO-DEP-INH-001', 'DEPOSIT', 'BANK_TRANSFER', 'CAPTURED',
        'GTW-DEMO-INH-001', 10000000, 'VND', NULL, DATEADD(DAY, -2, GETDATE()),
        NULL, DATEADD(DAY, -2, GETDATE()), DATEADD(DAY, -2, GETDATE())
    ),
    (
        @resCompleted, 'PAY-DEMO-DEP-COMP-001', 'DEPOSIT', 'CREDIT_CARD', 'CAPTURED',
        'GTW-DEMO-COMP-DEP', 5000000, 'VND', NULL, DATEADD(DAY, -8, GETDATE()),
        NULL, DATEADD(DAY, -8, GETDATE()), DATEADD(DAY, -8, GETDATE())
    ),
    (
        @resCompleted, 'PAY-DEMO-FULL-COMP-001', 'FULL_PAYMENT', 'BANK_TRANSFER', 'CAPTURED',
        'GTW-DEMO-COMP-FULL', 12900000, 'VND', NULL, DATEADD(DAY, -5, GETDATE()),
        NULL, DATEADD(DAY, -5, GETDATE()), DATEADD(DAY, -5, GETDATE())
    ),
    (
        @resInHouse, 'INCIDENTAL-ORDER-' + CAST(@transferOrderId AS VARCHAR(20)), 'INCIDENTAL_HOLD', 'CASH', 'CAPTURED',
        NULL, 5000000, 'VND', NULL, DATEADD(HOUR, -1, GETDATE()),
        NULL, DATEADD(HOUR, -1, GETDATE()), DATEADD(HOUR, -1, GETDATE())
    );

    INSERT INTO Invoice (
        reservation_id, invoice_no, invoice_type, issued_at,
        billing_name, billing_tax_no, billing_address,
        subtotal_amount, tax_amount, service_charge_amount, total_amount,
        currency_code, status, created_at
    ) VALUES
    (
        @resArrival, 'INV-DEMO-ARRIVAL-001-P', 'PROFORMA', DATEADD(DAY, -2, GETDATE()),
        N'Dinh Quoc Cuong', 'DEMO-TAX-001', N'28 Dong Khoi Street, Ben Nghe Ward, Ho Chi Minh City',
        9900000, 900000, 0, 9900000, 'VND', 'ISSUED', DATEADD(DAY, -2, GETDATE())
    ),
    (
        @resInHouse, 'INV-DEMO-INHOUSE-001-F', 'FINAL', DATEADD(HOUR, -2, GETDATE()),
        N'Dinh Quoc Cuong', 'DEMO-TAX-002', N'28 Dong Khoi Street, Ben Nghe Ward, Ho Chi Minh City',
        34900000, 2400000, 0, 34900000, 'VND', 'DRAFT', DATEADD(HOUR, -2, GETDATE())
    ),
    (
        @resCompleted, 'INV-DEMO-COMPLETED-001-F', 'FINAL', DATEADD(DAY, -5, GETDATE()),
        N'Dinh Quoc Cuong', 'DEMO-TAX-003', N'28 Dong Khoi Street, Ben Nghe Ward, Ho Chi Minh City',
        17900000, 900000, 0, 17900000, 'VND', 'PAID', DATEADD(DAY, -5, GETDATE())
    );

    INSERT INTO ReservationStatusHistory (
        reservation_id, old_status, new_status, changed_by, change_reason, changed_at
    ) VALUES
    (@resArrival, NULL, 'PENDING', 1, N'[DEMO] Reservation created from direct website', DATEADD(DAY, -3, GETDATE())),
    (@resArrival, 'PENDING', 'CONFIRMED', 1, N'[DEMO] Deposit verified for arrival board sample', DATEADD(DAY, -2, GETDATE())),

    (@resInHouse, NULL, 'PENDING', 2, N'[DEMO] Walk-in reservation created at front desk', DATEADD(DAY, -10, GETDATE())),
    (@resInHouse, 'PENDING', 'CONFIRMED', 2, N'[DEMO] Deposit collected at front desk', DATEADD(DAY, -2, DATEADD(HOUR, 9, CAST(@today AS DATETIME)))),
    (@resInHouse, 'CONFIRMED', 'CHECKED_IN', 2, N'[DEMO] Guest checked in successfully', DATEADD(DAY, -2, DATEADD(HOUR, 15, CAST(@today AS DATETIME)))),

    (@resCompleted, NULL, 'PENDING', 1, N'[DEMO] Reservation created from direct website', DATEADD(DAY, -12, GETDATE())),
    (@resCompleted, 'PENDING', 'CONFIRMED', 1, N'[DEMO] Booking confirmed after deposit', DATEADD(DAY, -9, GETDATE())),
    (@resCompleted, 'CONFIRMED', 'CHECKED_IN', 2, N'[DEMO] Guest arrived for stay', DATEADD(DAY, -7, DATEADD(HOUR, 15, CAST(@today AS DATETIME)))),
    (@resCompleted, 'CHECKED_IN', 'CHECKED_OUT', 2, N'[DEMO] Final folio settled at check-out', DATEADD(DAY, -5, DATEADD(HOUR, 11, CAST(@today AS DATETIME)))),

    (@resCancelled, NULL, 'PENDING', 2, N'[DEMO] Reservation created through call center', DATEADD(DAY, -1, GETDATE())),
    (@resCancelled, 'PENDING', 'CONFIRMED', 2, N'[DEMO] Reservation confirmed by agent', DATEADD(HOUR, -20, GETDATE())),
    (@resCancelled, 'CONFIRMED', 'CANCELLED', 2, N'[DEMO] Hotel cancelled due inventory maintenance block', DATEADD(HOUR, -12, GETDATE()));

    INSERT INTO HousekeepingTask (
        hotel_id, room_id, task_type, task_status, priority_level, assigned_staff_id,
        scheduled_for, started_at, completed_at, note, created_at, updated_at
    ) VALUES
    (
        1, 2, 'CLEANING', 'VERIFIED', 'HIGH', 2,
        DATEADD(DAY, -5, DATEADD(HOUR, 12, CAST(@today AS DATETIME))),
        DATEADD(DAY, -5, DATEADD(HOUR, 12, CAST(@today AS DATETIME))),
        DATEADD(DAY, -5, DATEADD(HOUR, 13, CAST(@today AS DATETIME))),
        N'[DEMO] Post-checkout turnover completed and verified', DATEADD(DAY, -5, GETDATE()), DATEADD(DAY, -5, GETDATE())
    ),
    (
        1, 4, 'TURN_DOWN', 'DONE', 'MEDIUM', 2,
        DATEADD(HOUR, 18, CAST(@today AS DATETIME)),
        DATEADD(HOUR, 18, CAST(@today AS DATETIME)),
        DATEADD(HOUR, 18, DATEADD(MINUTE, 30, CAST(@today AS DATETIME))),
        N'[DEMO] Evening turndown completed for in-house suite guest', DATEADD(HOUR, -3, GETDATE()), DATEADD(HOUR, -2, GETDATE())
    ),
    (
        1, 1, 'INSPECTION', 'ASSIGNED', 'HIGH', 2,
        DATEADD(HOUR, 13, CAST(@today AS DATETIME)),
        NULL, NULL,
        N'[DEMO] Pre-arrival inspection queued for today''s VIP arrival', DATEADD(HOUR, -2, GETDATE()), DATEADD(HOUR, -2, GETDATE())
    ),
    (
        2, 7, 'DEEP_CLEAN', 'OPEN', 'CRITICAL', NULL,
        DATEADD(DAY, 1, DATEADD(HOUR, 10, CAST(@today AS DATETIME))),
        NULL, NULL,
        N'[DEMO] Deep clean requested after repeated guest complaint', DATEADD(HOUR, -1, GETDATE()), DATEADD(HOUR, -1, GETDATE())
    );

    INSERT INTO MaintenanceTicket (
        hotel_id, room_id, reported_by, issue_category, issue_description, severity_level,
        status, reported_at, assigned_to, resolved_at, resolution_note, created_at, updated_at
    ) VALUES
    (
        1, 6, 2, 'ELECTRICAL', N'[DEMO] Presidential suite control panel trips the breaker intermittently',
        'HIGH', 'IN_PROGRESS', DATEADD(HOUR, -18, GETDATE()), 2, NULL, NULL,
        DATEADD(HOUR, -18, GETDATE()), DATEADD(HOUR, -1, GETDATE())
    ),
    (
        1, 3, 1, 'PLUMBING', N'[DEMO] Bathroom sink drains slowly but room remains sellable',
        'MEDIUM', 'OPEN', DATEADD(HOUR, -6, GETDATE()), NULL, NULL, NULL,
        DATEADD(HOUR, -6, GETDATE()), DATEADD(HOUR, -6, GETDATE())
    ),
    (
        2, 9, 1, 'HVAC', N'[DEMO] Suite thermostat calibration completed successfully',
        'LOW', 'RESOLVED', DATEADD(DAY, -2, GETDATE()), 2, DATEADD(DAY, -1, GETDATE()),
        N'[DEMO] Sensor recalibrated and room returned to service',
        DATEADD(DAY, -2, GETDATE()), DATEADD(DAY, -1, GETDATE())
    );

    -- Final room state aligned with demo operations above.
    UPDATE Room
    SET room_status = 'RESERVED',
        housekeeping_status = 'INSPECTED',
        maintenance_status = 'NORMAL',
        updated_at = GETDATE()
    WHERE room_id = 1;

    UPDATE Room
    SET room_status = 'AVAILABLE',
        housekeeping_status = 'INSPECTED',
        maintenance_status = 'NORMAL',
        updated_at = GETDATE()
    WHERE room_id = 2;

    UPDATE Room
    SET room_status = 'AVAILABLE',
        housekeeping_status = 'CLEAN',
        maintenance_status = 'NORMAL',
        updated_at = GETDATE()
    WHERE room_id = 3;

    UPDATE Room
    SET room_status = 'OCCUPIED',
        housekeeping_status = 'CLEAN',
        maintenance_status = 'NORMAL',
        updated_at = GETDATE()
    WHERE room_id = 4;

    UPDATE Room
    SET room_status = 'OOO',
        housekeeping_status = 'DIRTY',
        maintenance_status = 'UNDER_REPAIR',
        updated_at = GETDATE()
    WHERE room_id = 6;

    UPDATE Room
    SET room_status = 'CLEANING',
        housekeeping_status = 'DIRTY',
        maintenance_status = 'NORMAL',
        updated_at = GETDATE()
    WHERE room_id = 7;

    UPDATE Room
    SET room_status = 'AVAILABLE',
        housekeeping_status = 'CLEAN',
        maintenance_status = 'NORMAL',
        updated_at = GETDATE()
    WHERE room_id = 9;

    -- Availability state for active demo inventory.
    UPDATE RoomAvailability
    SET availability_status = 'BOOKED',
        sellable_flag = 0,
        inventory_note = N'[DEMO] Upcoming confirmed reservation',
        updated_at = GETDATE()
    WHERE room_id = 1
      AND stay_date >= @today
      AND stay_date < DATEADD(DAY, 2, @today);

    UPDATE RoomAvailability
    SET availability_status = 'BOOKED',
        sellable_flag = 0,
        inventory_note = N'[DEMO] In-house reservation window',
        updated_at = GETDATE()
    WHERE room_id = 4
      AND stay_date >= DATEADD(DAY, -2, @today)
      AND stay_date < @today;

    UPDATE RoomAvailability
    SET availability_status = 'BOOKED',
        sellable_flag = 0,
        inventory_note = N'[DEMO] Completed stay history',
        updated_at = GETDATE()
    WHERE room_id = 2
      AND stay_date >= DATEADD(DAY, -7, @today)
      AND stay_date < DATEADD(DAY, -5, @today);

    UPDATE RoomAvailability
    SET availability_status = 'BLOCKED',
        sellable_flag = 0,
        inventory_note = N'[DEMO] Room blocked for active maintenance',
        updated_at = GETDATE()
    WHERE room_id = 6
      AND stay_date >= @today
      AND stay_date < DATEADD(DAY, 4, @today);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

PRINT 'Demo operational data seeded successfully.';
PRINT '  - 4 reservations across confirmed, checked-in, checked-out, cancelled';
PRINT '  - 3 invoices, 5 payments, 3 service orders';
PRINT '  - 4 housekeeping tasks, 3 maintenance tickets';
GO
