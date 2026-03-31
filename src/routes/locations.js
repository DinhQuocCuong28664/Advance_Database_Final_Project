/**
 * LuxeReserve — Location Routes
 * Recursive CTE — Hierarchy query
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');

// GET /api/locations/tree?root=Châu+Á (or root_id=1)
router.get('/tree', async (req, res) => {
  try {
    const pool = getSqlPool();
    const { root, root_id } = req.query;

    let whereClause = '';
    const request = pool.request();

    if (root_id) {
      whereClause = 'WHERE location_id = @rootId';
      request.input('rootId', sql.BigInt, parseInt(root_id));
    } else if (root) {
      whereClause = 'WHERE location_name = @rootName';
      request.input('rootName', sql.NVarChar(150), root);
    } else {
      whereClause = 'WHERE parent_location_id IS NULL';
    }

    const result = await request.query(`
      WITH LocationTree AS (
        -- Anchor: root node(s)
        SELECT
          location_id, parent_location_id, location_code,
          location_name, location_type, level, iso_code,
          0 AS depth
        FROM Location
        ${whereClause}

        UNION ALL

        -- Recursive: child nodes
        SELECT
          child.location_id, child.parent_location_id, child.location_code,
          child.location_name, child.location_type, child.level, child.iso_code,
          parent.depth + 1 AS depth
        FROM Location child
        INNER JOIN LocationTree parent ON child.parent_location_id = parent.location_id
      )
      SELECT
        location_id, parent_location_id, location_code,
        location_name, location_type, level AS schema_level,
        depth AS tree_depth, iso_code,
        REPLICATE('  ', depth) + location_name AS hierarchy_display
      FROM LocationTree
      ORDER BY level, location_name
    `);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/locations — Flat list
router.get('/', async (req, res) => {
  try {
    const pool = getSqlPool();
    const result = await pool.request().query(`
      SELECT * FROM Location ORDER BY level, location_name
    `);
    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
