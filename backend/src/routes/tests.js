const express = require('express');
const router = express.Router();

router.get('/ping', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  const axios = require('axios');
  const start = Date.now();
  try {
    const r = await axios.get(url, { timeout: 5000, validateStatus: () => true });
    res.json({ reachable: true, status: r.status, duration: Date.now() - start });
  } catch (e) {
    res.json({ reachable: false, error: e.message, duration: Date.now() - start });
  }
});

module.exports = router;
