import re

with open('backend/routes/cmoRoutes.js', 'r') as f:
    code = f.read()

# Fix the GET route
old_get = """// GET /api/cmo/action-plan - Recupera o último plano gerado
router.get('/action-plan', async (req, res) => {
    try {
        const db = require('../models');
        const setting = await db.SystemSetting.findOne({ where: { key: 'cmo_ai_action_plan' } });
        res.json({ success: true, html: setting ? setting.value : null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Erro ao buscar plano' });
    }
});"""

new_get = """// GET /api/cmo/action-plan - Recupera o último plano gerado
router.get('/action-plan', async (req, res) => {
    try {
        const db = require('../models');
        const setting = await db.SystemSetting.findOne();
        res.json({ success: true, html: setting ? setting.cmo_ai_action_plan : null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Erro ao buscar plano' });
    }
});"""

code = code.replace(old_get, new_get)

# Fix the POST route saving
old_save = """        const db = require('../models');
        await db.SystemSetting.upsert({ key: 'cmo_ai_action_plan', value: analysis });"""

new_save = """        const db = require('../models');
        let setting = await db.SystemSetting.findOne();
        if (setting) {
            await setting.update({ cmo_ai_action_plan: analysis });
        } else {
            await db.SystemSetting.create({ cmo_ai_action_plan: analysis });
        }"""

code = code.replace(old_save, new_save)

with open('backend/routes/cmoRoutes.js', 'w') as f:
    f.write(code)

