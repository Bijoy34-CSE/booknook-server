const app = require("./src/app");

// Vercel runs this file as a serverless function, so we only listen locally
if (!process.env.VERCEL) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`BookNook API running on port ${port}`));
}

module.exports = app;