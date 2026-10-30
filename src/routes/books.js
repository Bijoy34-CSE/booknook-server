const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();
const CATEGORIES = ["Fiction", "Science", "History", "Kids", "Others"];

const isValidId = (id) => ObjectId.isValid(id) && String(new ObjectId(id)) === id;

function cleanBookBody(body) {
  const title = String(body.title || "").trim();
  const author = String(body.author || "").trim();
  const category = String(body.category || "").trim();
  const image = String(body.image || "").trim();
  const description = String(body.description || "").trim();
  const totalCopies = Number(body.totalCopies);

  if (!title || !author || !image || !description) {
    return { error: "Title, author, image and description are required." };
  }
  if (!CATEGORIES.includes(category)) {
    return { error: "Please choose a valid category." };
  }
  if (!Number.isInteger(totalCopies) || totalCopies < 1 || totalCopies > 1000) {
    return { error: "Total copies must be a whole number from 1 to 1000." };
  }
  return { data: { title, author, category, image, description, totalCopies } };
}

// GET /books  (public)
// ?limit=6  ?mine=true (needs token)  ?category=Fiction  ?search=text
router.get(
  "/",
  (req, res, next) => (req.query.mine === "true" ? verifyToken(req, res, next) : next()),
  async (req, res) => {
    try {
      const db = await getDb();
      const filter = {};
      if (req.query.mine === "true") filter["addedBy.email"] = req.user.email;
      if (req.query.category && CATEGORIES.includes(req.query.category)) {
        filter.category = req.query.category;
      }
      if (req.query.search) {
        const safe = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [
          { title: { $regex: safe, $options: "i" } },
          { author: { $regex: safe, $options: "i" } },
        ];
      }

      let cursor = db.collection("books").find(filter).sort({ createdAt: -1 });
      const limit = parseInt(req.query.limit, 10);
      if (limit > 0) cursor = cursor.limit(Math.min(limit, 100));

      res.json(await cursor.toArray());
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Could not load books right now." });
    }
  }
);

// GET /books/:id  (needs token)
router.get("/:id", verifyToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "That book link is not valid." });
    }
    const db = await getDb();
    const book = await db.collection("books").findOne({ _id: new ObjectId(req.params.id) });
    if (!book) return res.status(404).json({ message: "Book not found." });
    res.json(book);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load this book." });
  }
});

// POST /books  (needs token)
router.post("/", verifyToken, async (req, res) => {
  try {
    const { data, error } = cleanBookBody(req.body);
    if (error) return res.status(400).json({ message: error });

    const db = await getDb();
    const doc = {
      ...data,
      copies: data.totalCopies,
      addedBy: { name: req.user.name, email: req.user.email },
      createdAt: new Date(),
    };
    const result = await db.collection("books").insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not add the book." });
  }
});

// PATCH /books/:id  (needs token, owner only)
router.patch("/:id", verifyToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "That book link is not valid." });
    }
    const { data, error } = cleanBookBody(req.body);
    if (error) return res.status(400).json({ message: error });

    const db = await getDb();
    const _id = new ObjectId(req.params.id);
    const book = await db.collection("books").findOne({ _id });
    if (!book) return res.status(404).json({ message: "Book not found." });
    if (book.addedBy.email !== req.user.email) {
      return res.status(403).json({ message: "You can only edit your own books." });
    }

    const borrowed = book.totalCopies - book.copies;
    if (data.totalCopies < borrowed) {
      return res.status(400).json({
        message: `${borrowed} copies are borrowed right now, so total copies cannot be less than ${borrowed}.`,
      });
    }

    const update = { ...data, copies: data.totalCopies - borrowed };
    await db.collection("books").updateOne({ _id }, { $set: update });
    res.json({ ...book, ...update });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not update the book." });
  }
});

// DELETE /books/:id  (needs token, owner only)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "That book link is not valid." });
    }
    const db = await getDb();
    const _id = new ObjectId(req.params.id);
    const book = await db.collection("books").findOne({ _id });
    if (!book) return res.status(404).json({ message: "Book not found." });
    if (book.addedBy.email !== req.user.email) {
      return res.status(403).json({ message: "You can only delete your own books." });
    }

    await db.collection("books").deleteOne({ _id });
    await db.collection("borrows").deleteMany({ bookId: req.params.id });
    res.json({ message: "Book deleted.", deletedId: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not delete the book." });
  }
});

module.exports = router;