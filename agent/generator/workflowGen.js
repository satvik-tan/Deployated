// agent/generator/workflowGen.js

import fs from 'fs';
import path from 'path';
import { generateWorkflowFromGemini } from '../../integrations/gemini.js';

// Default templates for different frameworks
const defaultTemplates = {
  nextjs: `name: Deploy Next.js App

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./
          vercel-args: '--prod'`,
  
  node: `name: Deploy Node.js App

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        
      - name: Deploy to Render
        env:
          RENDER_API_KEY: \${{ secrets.RENDER_API_KEY }}
        run: |
          curl -X POST "https://api.render.com/v1/services/\${{ secrets.RENDER_SERVICE_ID }}/deploys" \
          -H "accept: application/json" \
          -H "authorization: Bearer \${{ secrets.RENDER_API_KEY }}"`,
  
  flask: `name: Deploy Flask App

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
          cache: 'pip'
          
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          
      - name: Deploy to Render
        env:
          RENDER_API_KEY: \${{ secrets.RENDER_API_KEY }}
        run: |
          curl -X POST "https://api.render.com/v1/services/\${{ secrets.RENDER_SERVICE_ID }}/deploys" \
          -H "accept: application/json" \
          -H "authorization: Bearer \${{ secrets.RENDER_API_KEY }}"`,
  
  springboot: `name: Deploy Spring Boot App

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up JDK
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: 'maven'
          
      - name: Build with Maven
        run: mvn -B package --file pom.xml
        
      - name: Deploy to Render
        env:
          RENDER_API_KEY: \${{ secrets.RENDER_API_KEY }}
        run: |
          curl -X POST "https://api.render.com/v1/services/\${{ secrets.RENDER_SERVICE_ID }}/deploys" \
          -H "accept: application/json" \
          -H "authorization: Bearer \${{ secrets.RENDER_API_KEY }}"`
};

// Docker templates for different frameworks
const dockerTemplates = {
  nextjs: `name: Build and Push Docker Image

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: \${{ secrets.DOCKER_USERNAME }}
          password: \${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: \${{ secrets.DOCKER_USERNAME }}/\${{ github.event.repository.name }}:latest`,
  
  node: `name: Build and Push Docker Image

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: \${{ secrets.DOCKER_USERNAME }}
          password: \${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: \${{ secrets.DOCKER_USERNAME }}/\${{ github.event.repository.name }}:latest`,
  
  flask: `name: Build and Push Docker Image

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: \${{ secrets.DOCKER_USERNAME }}
          password: \${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: \${{ secrets.DOCKER_USERNAME }}/\${{ github.event.repository.name }}:latest`,
  
  springboot: `name: Build and Push Docker Image

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: \${{ secrets.DOCKER_USERNAME }}
          password: \${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: \${{ secrets.DOCKER_USERNAME }}/\${{ github.event.repository.name }}:latest`
};

export async function generateWorkflow(repoPath, techStack, options = {}) {
  try {
    const files = {};

    // Collect relevant files (like package.json, etc.)
    if (techStack === 'node' && fs.existsSync(path.join(repoPath, 'package.json'))) {
      files['package.json'] = fs.readFileSync(path.join(repoPath, 'package.json'), 'utf-8');
    } else if (techStack === 'flask' && fs.existsSync(path.join(repoPath, 'requirements.txt'))) {
      files['requirements.txt'] = fs.readFileSync(path.join(repoPath, 'requirements.txt'), 'utf-8');
    } else if (techStack === 'springboot' && fs.existsSync(path.join(repoPath, 'pom.xml'))) {
      files['pom.xml'] = fs.readFileSync(path.join(repoPath, 'pom.xml'), 'utf-8');
    }

    // Send prompt to Gemini
    let generatedWorkflow = null;
    try {
      generatedWorkflow = await generateWorkflowFromGemini(techStack, files);
    } catch (err) {
      console.log('⚠️ Gemini API failed. Falling back to template.');
    }

    // Use generated workflow or fallback to template
    let finalWorkflow = generatedWorkflow;
    
    if (!finalWorkflow) {
      if (options.docker) {
        finalWorkflow = dockerTemplates[techStack] || dockerTemplates['node'];
      } else if (options.cloud === 'vercel') {
        finalWorkflow = defaultTemplates['nextjs'];
      } else if (options.cloud === 'render') {
        finalWorkflow = defaultTemplates[techStack] || defaultTemplates['node'];
      } else {
        finalWorkflow = defaultTemplates[techStack] || defaultTemplates['node'];
      }
    }
    
    // Create workflow directory
    const workflowDir = path.join(repoPath, '.github', 'workflows');
    fs.mkdirSync(workflowDir, { recursive: true });

    // Write workflow file
    fs.writeFileSync(path.join(workflowDir, 'deploy.yml'), finalWorkflow);

    console.log(`✅ Workflow saved for ${techStack}`);
    return finalWorkflow;
  } catch (err) {
    console.error('❌ Error generating workflow:', err);
    throw err;
  }
}
