#!/usr/bin/env node

const MAX_RETRIES = 60;
const RETRY_INTERVAL = 1000;
const BACKEND_URL = "http://localhost:8000/api/v1/utils/health-check/";

async function waitForBackend() {
  console.log("Waiting for backend to be ready...");

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await fetch(BACKEND_URL);
      if (response.ok) {
        console.log("Backend is ready!");
        process.exit(0);
      }
    } catch {
      // Backend not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));

    if ((i + 1) % 10 === 0) {
      console.log(`Still waiting... (${i + 1}s)`);
    }
  }

  console.error("Backend failed to start within timeout");
  process.exit(1);
}

waitForBackend();
