const express = require('express');
const router = express.Router();
const dreController = require('../controllers/dreController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.use(protect);
router.use(admin);

router.get('/', dreController.getDre);
router.post('/expenses', dreController.createExpense);
router.post('/expenses/copy-previous', dreController.copyPreviousFixedExpenses);
router.put('/expenses/:id', dreController.updateExpense);
router.delete('/expenses/:id', dreController.deleteExpense);
router.post('/sync-ads', dreController.syncAdsSpend);
router.post('/fiscal-config', dreController.saveFiscalConfig);
router.get('/export/csv', dreController.exportCsv);
router.get('/export/excel', dreController.exportExcel);

module.exports = router;
