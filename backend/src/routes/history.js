const express = require('express');
const router = express.Router();
const { getHistory } = require('../utils/history');

router.get('/', (req, res) => res.json(getHistory()));

module.exports = router;
