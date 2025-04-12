#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const detectFramework = require("../agent/detector/detect.js");

const repoPath = process.argv[2];

if(!repoPath){
    console.error("Please provide a repository path.");
    process.exit(1);
}

const absPath = path.resolve(repoPath);
const framework = detectFramework(absPath);
console.log(`Detected framework: ${framework}`);