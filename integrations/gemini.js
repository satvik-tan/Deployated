// integrations/gemini.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function generateWorkflowFromGemini(techStack, files) {
  const prompt = buildPrompt(techStack, files);

  try {
    const response = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + GEMINI_API_KEY,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );

    const generatedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

    return generatedText;
  } catch (err) {
    console.error('⚠️ Gemini API failed. Falling back to template.');
    return null;
  }
}

function buildPrompt(techStack, files) {
  return `
You are an AI DevOps agent. Generate a GitHub Actions workflow for a ${techStack} app that builds and deploys to Vercel or Render.

Project files:
${Object.entries(files).map(([name, content]) => `--- ${name} ---\n${content}`).join('\n\n')}

Return ONLY the raw YAML content of the .github/workflows/deploy.yml file.
`;
}
