
import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'mayankaneja837';
const REPO = 'Deployated';
const BRANCH = 'main';
const REMOTE_PATH = '.github/workflows/ci-cd.yml';
const COMMIT_MESSAGE = 'Add CI/CD workflow';

function saveWorkflowToFile(workflowYAML, filename = 'ci-cd.yml') {
  fs.writeFileSync(filename, workflowYAML, 'utf8');
  console.log('✅ Workflow file saved locally.');
}

function encodeFileToBase64(filePath) {
  const content = fs.readFileSync(filePath);
  return content.toString('base64');
}

async function getExistingFileSha() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${REMOTE_PATH}`;
  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
      },
    });
    return res.data.sha;
  } catch (err) {
    return null;
  }
}

async function pushWorkflowFile() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${REMOTE_PATH}`;
  const content = encodeFileToBase64('ci-cd.yml');
  const sha = await getExistingFileSha();

  const data = {
    message: COMMIT_MESSAGE,
    content,
    branch: BRANCH,
  };

  if (sha) data.sha = sha;

  try {
    const res = await axios.put(url, data, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
      },
    });

    if ([200, 201].includes(res.status)) {
      console.log('🚀 Workflow pushed to GitHub!');
    } else {
      console.log('⚠️ Unexpected response:', res.status, res.data);
    }
  } catch (err) {
    console.error('❌ Error pushing workflow:', err.response?.data || err.message);
  }
}


export async function generateAndPushWorkflow(workflowYAML) {
  saveWorkflowToFile(workflowYAML);
  await pushWorkflowFile();
}
