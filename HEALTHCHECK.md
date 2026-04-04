# Docker Health Check Script

Create a simple health check script to monitor the application:

```javascript
// healthcheck.js
const http = require('http');

const options = {
  host: 'localhost',
  port: 5000,
  path: '/api/health',
  timeout: 2000
};

const request = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0); // Healthy
  } else {
    process.exit(1); // Unhealthy
  }
});

request.on('error', () => {
  process.exit(1); // Unhealthy
});

request.end();
```

This script will be used by Docker to check if the application is healthy.
