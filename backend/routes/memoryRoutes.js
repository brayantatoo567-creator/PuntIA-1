const express = require('express');
const controller = require('../controllers/memoryController');
const router = express.Router();
router.get('/memory/:userId', controller.getMemory);
router.post('/memory', controller.saveMemory);
router.delete('/memory/:userId', controller.deleteMemory);
module.exports = router;
