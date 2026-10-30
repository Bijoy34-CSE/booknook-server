const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();
const BORROW_DAYS = 7;

const isValidId = (id) => ObjectId.isValid(id) && String(new ObjectId(id)) === id;

// POST /borrows  { bookId }
router.post("/", verifyToken, async (req, res) => {
  const bookId = String(req.body.bookId || "");
  if (!isValidId(bookId)) {
    return res.status(400).json({ message: "That book link is not valid." });
  }

  try {
    const db = await getDb();
    const books = db.collection("books");
    const borrows = db.collection("borrows");
    const _id = new ObjectId(bookId);

    const book = await books.findOne({ _id });
    if (!book) return res.status(404).json({ message: "Book not found." });

    // No double borrow
    const already = await borrows.findOne({ bookId, userEmail: req.user.email });
    if (already) {
      return res.status(409).json({ message: "You have already borrowed this book." });
    }

    // Take one copy only if one is left (atomic, so two users cannot take the last one)
    const taken = await books.findOneAndUpdate(
      { _id, copies: { $gt: 0 } },
      { $inc: { copies: -1 } }
    );
    if (!taken) {
      return res.status(400).json({ message: "Sorry, this book is not available right now." });
    }

    const borrowDate = new Date();
    const returnDate = new Date(borrowDate.getTime() + BORROW_DAYS * 24 * 60 * 60 * 1000);
    const doc = {
      bookId,
      bookTitle: book.title,
      bookImage: book.image,
      userName: req.user.name,
      userEmail: req.user.email,
      borrowDate,
      returnDate,
    };

    try {
      const result = await borrows.insertOne(doc);
      res.status(201).json({ ...doc, _id: result.insertedId });
    } catch (err) {
      // Unique index hit (double click / race): give the copy back
      await books.updateOne({ _id }, { $inc: { copies: 1 } });
      if (err.code === 11000) {
        return res.status(409).json({ message: "You have already borrowed this book." });
      }
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not borrow the book." });
  }
});

// GET /borrows  (borrows of the logged in user)
router.get("/", verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    const list = await db
      .collection("borrows")
      .find({ userEmail: req.user.email })
      .sort({ borrowDate: -1 })
      .toArray();
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load your borrows." });
  }
});

// DELETE /borrows/:id  (return a book)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "That borrow record is not valid." });
    }
    const db = await getDb();
    const _id = new ObjectId(req.params.id);
    const borrow = await db.collection("borrows").findOne({ _id });
    if (!borrow) return res.status(404).json({ message: "Borrow record not found." });
    if (borrow.userEmail !== req.user.email) {
      return res.status(403).json({ message: "This is not your borrow." });
    }

    await db.collection("borrows").deleteOne({ _id });
    if (isValidId(borrow.bookId)) {
      await db
        .collection("books")
        .updateOne({ _id: new ObjectId(borrow.bookId) }, { $inc: { copies: 1 } });
    }
    res.json({ message: "Book returned.", returnedId: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not return the book." });
  }
});

module.exports = router;