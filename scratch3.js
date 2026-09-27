const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testModel(modelName) {
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Say hello");
        console.log(`Success ${modelName}:`, result.response.text().trim());
    } catch(err) {
        console.error(`Error ${modelName}:`, err.status || err.message);
    }
}

async function runAll() {
    await testModel("gemini-3.1-flash-lite");
    await testModel("gemini-3.5-flash-lite");
    await testModel("gemini-flash-lite-latest");
}
runAll();
