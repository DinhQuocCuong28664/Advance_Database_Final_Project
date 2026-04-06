/**
 * LuxeReserve — Housekeeping Routes
 * Manage housekeeping tasks: assign, track, complete
 * Activates: HousekeepingTask (assigned_staff_id, scheduled_for, started_at, completed_at, note)
 *            Room (housekeeping_status)
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');

// ═══════════════════════════════════════════════
// GET /api/housekeeping?hotel_id=1&status=OPEN
// List housekeeping tasks with filters
// ═══════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const pool = getSqlPool();
    const { hotel_id, status, priority } = req.query;

    if (!hotel_id) {
      return res.status(400).json({ success: false, error: 'hotel_id is required' });
    }

    const request = pool.request().input('hotelId', sql.BigInt, parseInt(hotel_id));
    let filters = 'WHERE hk.hotel_id = @hotelId';

    if (status) {
      filters += ' AND hk.task_status = @status';
      request.input('status', sql.VarChar(15), status);
    }
    if (priority) {
      filters += ' AND hk.priority_level = @priority';
      request.input('priority', sql.VarChar(10), priority);
    }

    const result = await request.query(`
      SELECT hk.hk_task_id, hk.hotel_id, hk.room_id,
             r.room_number, r.floor_number, r.housekeeping_status AS current_room_hk_status,
             rt.room_type_name,
             hk.task_type, hk.task_status, hk.priority_level,
             hk.assigned_staff_id, su.full_name AS assigned_staff_name,
             hk.scheduled_for, hk.started_at, hk.completed_at, hk.note,
             hk.created_at,
             -- Time tracking
             CASE WHEN hk.started_at IS NOT NULL AND hk.completed_at IS NOT NULL
                  THEN DATEDIFF(MINUTE, hk.started_at, hk.completed_at) END AS duration_minutes
      FROM HousekeepingTask hk
      JOIN Room r ON hk.room_id = r.room_id
      JOIN RoomType rt ON r.room_type_id = rt.room_type_id
      LEFT JOIN SystemUser su ON hk.assigned_staff_id = su.user_id
      ${filters}
      ORDER BY
        CASE hk.priority_level WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        hk.created_at DESC
    `);

    // Summary stats
    const stats = await pool.request().input('hotelId', sql.BigInt, parseInt(hotel_id)).query(`
      SELECT task_status, COUNT(*) AS cnt
      FROM HousekeepingTask WHERE hotel_id = @hotelId
      GROUP BY task_status
    `);

    res.json({
      success: true,
      count: result.recordset.length,
      summary: stats.recordset.reduce((acc, r) => { acc[r.task_status] = r.cnt; return acc; }, {}),
      data: result.recordset
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════
// POST /api/housekeeping
// Create housekeeping task manually
// ═══════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const { hotel_id, room_id, task_type, priority_level, note, scheduled_for, assigned_staff_id } = req.body;

    if (!hotel_id || !room_id || !task_type) {
      return res.status(400).json({ success: false, error: 'hotel_id, room_id, task_type required' });
    }

    const pool = getSqlPool();
    const result = await pool.request()
      .input('hotelId', sql.BigInt, hotel_id)
      .input('roomId', sql.BigInt, room_id)
      .input('type', sql.VarChar(15), task_type)
      .input('priority', sql.VarChar(10), priority_level || 'MEDIUM')
      .input('note', sql.NVarChar(255), note || null)
      .input('scheduled', sql.DateTime, scheduled_for ? new Date(scheduled_for) : null)
      .input('staffId', sql.BigInt, assigned_staff_id || null)
      .query(`
        INSERT INTO HousekeepingTask (hotel_id, room_id, task_type, task_status, priority_level, note, scheduled_for, assigned_staff_id)
        OUTPUT INSERTED.*
        VALUES (@hotelId, @roomId, @type, CASE WHEN @staffId IS NOT NULL THEN 'ASSIGNED' ELSE 'OPEN' END, @priority, @note, @scheduled, @staffId)
      `);

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════
// PUT /api/housekeeping/:id/assign
// Assign staff to task
// ═══════════════════════════════════════════════
router.put('/:id/assign', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { staff_id, scheduled_for } = req.body;

    if (isNaN(taskId) || !staff_id) {
      return res.status(400).json({ success: false, error: 'Valid task ID and staff_id required' });
    }

    const pool = getSqlPool();
    const result = await pool.request()
      .input('taskId', sql.BigInt, taskId)
      .input('staffId', sql.BigInt, staff_id)
      .input('scheduled', sql.DateTime, scheduled_for ? new Date(scheduled_for) : null)
      .query(`
        UPDATE HousekeepingTask
        SET assigned_staff_id = @staffId,
            task_status = 'ASSIGNED',
            scheduled_for = ISNULL(@scheduled, scheduled_for),
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE hk_task_id = @taskId AND task_status IN ('OPEN', 'ASSIGNED')
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Task not found or already in progress/completed' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════
// PUT /api/housekeeping/:id/status
// Update task status with Room sync
// ASSIGNED → IN_PROGRESS → DONE → VERIFIED
// ═══════════════════════════════════════════════
router.put('/:id/status', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { status, note } = req.body;

    if (isNaN(taskId)) {
      return res.status(400).json({ success: false, error: 'Invalid task ID' });
    }

    const validFlow = {
      'IN_PROGRESS': ['ASSIGNED'],
      'DONE':        ['IN_PROGRESS'],
      'VERIFIED':    ['DONE']
    };

    if (!status || !validFlow[status]) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Allowed transitions: ASSIGNED→IN_PROGRESS→DONE→VERIFIED`
      });
    }

    const pool = getSqlPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // STEP 1: Update task with status flow validation
      const req1 = new sql.Request(transaction);
      const allowedFrom = validFlow[status];
      const updateResult = await req1
        .input('taskId', sql.BigInt, taskId)
        .input('status', sql.VarChar(15), status)
        .input('note', sql.NVarChar(255), note || null)
        .query(`
          UPDATE HousekeepingTask
          SET task_status = @status,
              started_at = CASE WHEN @status = 'IN_PROGRESS' AND started_at IS NULL THEN GETDATE() ELSE started_at END,
              completed_at = CASE WHEN @status IN ('DONE', 'VERIFIED') AND completed_at IS NULL THEN GETDATE() ELSE completed_at END,
              note = ISNULL(@note, note),
              updated_at = GETDATE()
          OUTPUT INSERTED.*, DELETED.task_status AS old_status
          WHERE hk_task_id = @taskId
            AND task_status IN (${allowedFrom.map((_, i) => `'${allowedFrom[i]}'`).join(',')})
        `);

      if (updateResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          error: `Status transition failed. Current status must be one of: ${allowedFrom.join(', ')}`
        });
      }

      const task = updateResult.recordset[0];

      // STEP 2: Sync Room.housekeeping_status
      const hkStatusMap = {
        'IN_PROGRESS': 'IN_PROGRESS',
        'DONE':        'CLEAN',
        'VERIFIED':    'INSPECTED'
      };

      const req2 = new sql.Request(transaction);
      await req2
        .input('roomId', sql.BigInt, task.room_id)
        .input('hkStatus', sql.VarChar(15), hkStatusMap[status])
        .query(`
          UPDATE Room
          SET housekeeping_status = @hkStatus, updated_at = GETDATE()
          WHERE room_id = @roomId
        `);

      await transaction.commit();

      res.json({
        success: true,
        message: `Task ${status}. Room housekeeping_status → ${hkStatusMap[status]}`,
        data: task
      });
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
