require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { getDb } = require("./config/db");
const booksRouter = require("./routes/books");
const borrowsRouter = require("./routes/borrows");

const app = express();

const allowed = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: (origin, cb) =>
      !origin || allowed.includes(origin) ? cb(null, true) : cb(null, false),
  })
);
app.use(express.json());

app.get("/", (_req, res) => res.json({ name: "BookNook API", status: "running" }));

// Quick check that MongoDB is connected
app.get("/health", async (_req, res) => {
  try {
    await getDb();
    res.json({ database: "connected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ database: "not connected" });
  }
});

app.use("/books", booksRouter);
app.use("/borrows", borrowsRouter);

app.use((_req, res) => res.status(404).json({ message: "Route not found." }));
// Handles bad JSON bodies and any error that was not caught in a route
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in the request body." });
  }
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server." });
});
module.exports = app;