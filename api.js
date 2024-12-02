const http = require("http");
const sqlite3 = require("sqlite3").verbose();
const { parse } = require("url");
const { StringDecoder } = require("string_decoder");

// Database setup
const DATABASE = "database.db";
const db = new sqlite3.Database(DATABASE);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);
});

// Utility to send JSON responses
const sendResponse = (res, statusCode, data) => {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

// Server logic
const server = http.createServer((req, res) => {
  const { pathname, query } = parse(req.url, true);
  const decoder = new StringDecoder("utf-8");
  let buffer = "";

  req.on("data", (chunk) => {
    buffer += decoder.write(chunk);
  });

  req.on("end", () => {
    buffer += decoder.end();

    if (req.method === "GET" && pathname === "/items") {
      // Get all items
      db.all("SELECT * FROM items", [], (err, rows) => {
        if (err) {
          sendResponse(res, 500, { error: "Database error" });
        } else {
          sendResponse(res, 200, rows);
        }
      });
    } else if (req.method === "GET" && /^\/items\/\d+$/.test(pathname)) {
      // Get a specific item
      const id = parseInt(pathname.split("/")[2], 10);
      db.get("SELECT * FROM items WHERE id = ?", [id], (err, row) => {
        if (err) {
          sendResponse(res, 500, { error: "Database error" });
        } else if (!row) {
          sendResponse(res, 404, { error: "Item not found" });
        } else {
          sendResponse(res, 200, row);
        }
      });
    } else if (req.method === "POST" && pathname === "/items") {
      // Create an item
      const { name } = JSON.parse(buffer);
      if (!name) {
        sendResponse(res, 400, { error: "Name is required" });
        return;
      }

      db.run("INSERT INTO items (name) VALUES (?)", [name], function (err) {
        if (err) {
          sendResponse(res, 500, { error: "Database error" });
        } else {
          sendResponse(res, 201, { id: this.lastID, name });
        }
      });
    } else if (req.method === "PUT" && /^\/items\/\d+$/.test(pathname)) {
      // Update an item
      const id = parseInt(pathname.split("/")[2], 10);
      const { name } = JSON.parse(buffer);
      if (!name) {
        sendResponse(res, 400, { error: "Name is required" });
        return;
      }

      db.run("UPDATE items SET name = ? WHERE id = ?", [name, id], function (err) {
        if (err) {
          sendResponse(res, 500, { error: "Database error" });
        } else if (this.changes === 0) {
          sendResponse(res, 404, { error: "Item not found" });
        } else {
          sendResponse(res, 200, { id, name });
        }
      });
    } else if (req.method === "DELETE" && /^\/items\/\d+$/.test(pathname)) {
      // Delete an item
      const id = parseInt(pathname.split("/")[2], 10);
      db.run("DELETE FROM items WHERE id = ?", [id], function (err) {
        if (err) {
          sendResponse(res, 500, { error: "Database error" });
        } else if (this.changes === 0) {
          sendResponse(res, 404, { error: "Item not found" });
        } else {
          sendResponse(res, 200, { message: "Item deleted" });
        }
      });
    } else {
      // Not Found
      sendResponse(res, 404, { error: "Route not found" });
    }
  });
});

// Start the server
const PORT = 8000;
server.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
