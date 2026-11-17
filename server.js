require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

const BASE_URL = (process.env.AI_BASE_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.AI_API_KEY;
const MODEL = process.env.AI_MODEL;

async function askAI(messages) {
  if (!BASE_URL || !API_KEY || !MODEL) {
    throw new Error("AI provider is not configured.");
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`AI provider returned ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

app.post("/api/chat", async (req, res) => {
  try {
    const { subject, grade, messages } = req.body;

    if (!["Maths", "English Grammar"].includes(subject)) {
      return res.status(400).json({ error: "Invalid subject." });
    }

    if (!Array.isArray(messages) || messages.length === 0 ||
        messages.length > 30) {
      return res.status(400).json({ error: "Invalid conversation." });
    }

    const safeMessages = messages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 5000)
    }));

    const systemPrompt = `
You are a friendly, patient ${subject} teacher at Examly AI.
You teach Class ${grade} students.

Explain concepts in simple, age-appropriate language.
Use examples, short explanations and step-by-step teaching.
Ask the student small questions to check understanding.
Never give all the answers without explaining.
Encourage independent thinking.
Keep the lesson focused on ${subject}.
Do not start the 30-question test during the learning period.
When the student asks for a topic, teach its meaning, basics,
examples, methods and useful facts.
Be encouraging and respectful.
`;

    const reply = await askAI([
      { role: "system", content: systemPrompt },
      ...safeMessages
    ]);

    res.json({ reply });
  } catch (error) {
    console.error(error.message);
    res.status(503).json({
      error: "The AI teacher is unavailable. Check your API settings."
    });
  }
});

app.post("/api/test", async (req, res) => {
  try {
    const { subject, grade, conversation } = req.body;

    if (!["Maths", "English Grammar"].includes(subject)) {
      return res.status(400).json({ error: "Invalid subject." });
    }

    const prompt = `
Create exactly 30 multiple-choice questions for a Class ${grade} student.
Subject: ${subject}.

Base the questions on this learning conversation:
${String(conversation || "").slice(0, 12000)}

Rules:
- Exactly 30 questions.
- Exactly 3 options per question.
- Exactly one correct answer.
- Age-appropriate difficulty.
- Cover the topics actually studied.
- Return ONLY valid JSON in this format:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C"],
      "answer": 0,
      "explanation": "Short explanation"
    }
  ]
}
The answer must be 0, 1 or 2.
`;

    const output = await askAI([
      { role: "system", content: "You are an educational examination creator. Return valid JSON only." },
      { role: "user", content: prompt }
    ]);

    const cleaned = output
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");

    const result = JSON.parse(cleaned);

    if (!Array.isArray(result.questions) ||
        result.questions.length !== 30 ||
        result.questions.some(q =>
          typeof q.question !== "string" ||
          !Array.isArray(q.options) ||
          q.options.length !== 3 ||
          !Number.isInteger(q.answer) ||
          q.answer < 0 || q.answer > 2
        )) {
      throw new Error("AI returned an invalid examination.");
    }

    res.json(result);
  } catch (error) {
    console.error(error.message);
    res.status(503).json({
      error: "Could not prepare the examination. Please check your AI settings."
    });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Examly AI running at http://localhost:3000");
});
