const express = require('express');
const controller = require('../controllers/assistantController');
const router = express.Router();
router.post('/chat', controller.chat);
router.post('/generate-pattern', controller.generatePattern);
router.post('/diagnose', controller.upload.single('image'), controller.diagnose);
module.exports = router;
