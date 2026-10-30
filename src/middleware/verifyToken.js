const jwt = require("jsonwebtoken");

// Reads "Authorization: Bearer <token>", verifies it and puts the user on req.user
function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Please login to continue." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.email) throw new Error("bad payload");
    req.user = { email: payload.email, name: payload.name || "Reader" };
    next();
  } catch {
    return res
      .status(401)
      .json({ message: "Your session has expired. Please login again." });
  }
}

module.exports = verifyToken;