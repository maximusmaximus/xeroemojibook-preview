export default { testDir: "tests", testMatch: /.*\.spec\.js/, use: { baseURL: "http://127.0.0.1:8788", channel: "chrome" },
  webServer: { command: "npx wrangler dev --port 8788 --ip 127.0.0.1 ", url: "http://127.0.0.1:8788", reuseExistingServer: true, timeout: 90000 } };
