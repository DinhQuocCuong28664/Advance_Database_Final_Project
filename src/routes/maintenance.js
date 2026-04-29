/**
 * LuxeReserve - Maintenance Routes
 * Manage maintenance tickets: create, assign, resolve
 * Activates: MaintenanceTicket (14 cols), Room.maintenance_status
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');

// 
// GET /api/v1/maintenance?hotel_id=1&status=OPEN
// List maintenance tickets
// 
router.get('/', async (req, res) => {
  try {
    const pool = getSqlPool();
    const { hotel_id, room_id, status, severity } = req.query;

    if (!hotel_id) {
      return res.status(400).json({ success: false, message: 'hotel_id is required' });
    }

    const request = pool.request().input('hotelId', sql.BigInt, parseInt(hotel_id));
    let filters = 'WHERE mt.hotel_id = @hotelId';

    if (room_id) {
      filters += ' AND mt.room_id = @roomId';
      request.input('roomId', sql.BigInt, parseInt(room_id));
    }
    if (status) {
      filters += ' AND mt.status = @status';
      request.input('status', sql.VarChar(15), status);
    }
    if (severity) {
      filters += ' AND mt.severity_level = @severity';
      request.input('severity', sql.VarChar(10), severity);
    }

    const result = await request.query(`
      SELECT mt.maintenance_ticket_id, mt.hotel_id,
             mt.room_id, r.room_number, r.floor_number, r.maintenance_status AS current_room_maint_status,
             mt.issue_category, mt.issue_description, mt.severity_level, mt.status,
             mt.reported_at, mt.reported_by, reporter.full_name AS reporter_name,
             mt.assigned_to, assignee.full_name AS assignee_name,
             mt.resolved_at, mt.resolution_note,
             -- Duration tracking
             CASE WHEN mt.resolved_at IS NOT NULL
                  THEN DATEDIFF(HOUR, mt.reported_at, mt.resolved_at) END AS resolution_hours
      FROM MaintenanceTicket mt
      LEFT JOIN Room r ON mt.room_id = r.room_id
      LEFT JOIN SystemUser reporter ON mt.reported_by = reporter.user_id
      LEFT JOIN SystemUser assignee ON mt.assigned_to = assignee.user_id
      ${filters}
      ORDER BY
        CASE mt.severity_level WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        mt.reported_at DESC
    `);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 
// POST /api/v1/maintenance
// Create maintenance ticket  auto-update Room.maintenance_status
// 
router.post('/', async (req, res) => {
  try {
    const { hotel_id, room_id, reported_by, issue_category, issue_description, severity_level } = req.body;

    if (!hotel_id || !issue_category || !issue_description) {
      return res.status(400).json({
        success: false,
        error: 'hotel_id, issue_category, issue_description required'
      });
    }

    const pool = getSqlPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // STEP 1: Create ticket
      const req1 = new sql.Request(transaction);
      const result = await req1
        .input('hotelId', sql.BigInt, hotel_id)
        .input('roomId', sql.BigInt, room_id || null)
        .input('reporter', sql.BigInt, reported_by || null)
        .input('category', sql.VarChar(50), issue_category)
        .input('desc', sql.NVarChar(sql.MAX), issue_description)
        .input('severity', sql.VarChar(10), severity_level || 'MEDIUM')
        .query(`
          INSERT INTO MaintenanceTicket
            (hotel_id, room_id, reported_by, issue_category, issue_description, severity_level, status)
          OUTPUT INSERTED.*
          VALUES (@hotelId, @roomId, @reporter, @category, @desc, @severity, 'OPEN')
        `);

      // STEP 2: If room-linked and severity HIGH/CRITICAL  mark room UNDER_REPAIR
      if (room_id && ['HIGH', 'CRITICAL'].includes(severity_level || 'MEDIUM')) {
        const req2 = new sql.Request(transaction);
        await req2.input('roomId', sql.BigInt, room_id).query(`
          UPDATE Room
          SET maintenance_status = 'UNDER_REPAIR', updated_at = GETDATE()
          WHERE room_id = @roomId AND maintenance_status = 'NORMAL'
        `);
      }

      await transaction.commit();

      res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 
// PUT /api/v1/maintenance/:id
// Update ticket: assign, resolve, close
// 
router.put('/:id', async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { status, assigned_to, resolution_note } = req.body;

    if (isNaN(ticketId)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    }
    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required' });
    }

    const pool = getSqlPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // STEP 1: Get current ticket
      const req0 = new sql.Request(transaction);
      const ticketCheck = await req0.input('id', sql.BigInt, ticketId).query(`
        SELECT * FROM MaintenanceTicket WHERE maintenance_ticket_id = @id
      `);

      if (ticketCheck.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Ticket not found' });
      }

      const ticket = ticketCheck.recordset[0];

      // STEP 2: Update ticket
      const req1 = new sql.Request(transaction);
      const result = await req1
        .input('id', sql.BigInt, ticketId)
        .input('status', sql.VarChar(15), status)
        .input('assignee', sql.BigInt, assigned_to || ticket.assigned_to || null)
        .input('resolution', sql.NVarChar(sql.MAX), resolution_note || null)
        .query(`
          UPDATE MaintenanceTicket
          SET status = @status,
              assigned_to = @assignee,
              resolved_at = CASE WHEN @status IN ('RESOLVED', 'CLOSED') AND resolved_at IS NULL THEN GETDATE() ELSE resolved_at END,
              resolution_note = ISNULL(@resolution, resolution_note),
              updated_at = GETDATE()
          OUTPUT INSERTED.*
          WHERE maintenance_ticket_id = @id
        `);

      // STEP 3: If RESOLVED/CLOSED and room is linked  reset Room.maintenance_status to NORMAL
      if (['RESOLVED', 'CLOSED'].includes(status) && ticket.room_id) {
        // Check if there are other OPEN/IN_PROGRESS tickets for this room
        const req2 = new sql.Request(transaction);
        const otherTickets = await req2.input('roomId', sql.BigInt, ticket.room_id)
          .input('id', sql.BigInt, ticketId)
          .query(`
            SELECT COUNT(*) AS cnt FROM MaintenanceTicket
            WHERE room_id = @roomId AND maintenance_ticket_id <> @id
              AND status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS')
          `);

        if (otherTickets.recordset[0].cnt === 0) {
          const req3 = new sql.Request(transaction);
          await req3.input('roomId', sql.BigInt, ticket.room_id).query(`
            UPDATE Room
            SET maintenance_status = 'NORMAL', updated_at = GETDATE()
            WHERE room_id = @roomId
          `);
        }
      }

      await transaction.commit();

      res.json({ success: true, data: result.recordset[0] });
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
