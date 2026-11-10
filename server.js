'use strict';

// Oddiy statik server (lokal sinov uchun). Hamma ish brauzerda bajariladi.
const path = require('node:path');
const express = require('express');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' https://fonts.googleapis.com",
        "font-src https://fonts.gstatic.com",
        "img-src 'self' data:",
        "connect-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'"
      ].join('; ')
    });
    next();
  });
  app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    setHeaders(res, file) {
      if (file.endsWith('.html')) res.set('Cache-Control', 'no-cache');
    }
  }));
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => console.log(`Server ishga tushdi: http://localhost:${port}`));
}

module.exports = { createApp };
