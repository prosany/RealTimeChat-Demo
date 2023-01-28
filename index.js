const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const mongoose = require("mongoose");
const DeviceDetector = require("node-device-detector");
require("dotenv").config({});

let url =
  process.env.NODE_ENV !== "development"
    ? `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_URL}`
    : process.env.DB_URL_DEMO;
// connect to MongoDB
mongoose.connect(url, {
  useNewUrlParser: true,
});

// define message schema
const messageSchema = new mongoose.Schema({
  content: String,
  date: { type: Date, default: Date.now },
  device: { type: Object },
});

// create message model
const Message = mongoose.model("Message", messageSchema);

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/messages", async (req, res) => {
  try {
    const messages = await Message.find().sort({ date: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/delete-all", async (req, res) => {
  try {
    const deleted = await Message.deleteMany({});
    if (deleted.deletedCount > 0) {
      res.status(200);
      return res.json({ message: deleted.deletedCount + " messages deleted." });
    }
    return res.json({ message: deleted.deletedCount + " messages deleted." });
  } catch (error) {
    res.json({ message: "Delete failed" });
  }
});

// socket connection
io.on("connection", (socket) => {
  console.log("user connected");

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  io.on("connection", (socket) => {
    socket.on("start typing", () => {
      socket.broadcast.emit("start typing");
    });

    socket.on("stop typing", () => {
      socket.broadcast.emit("stop typing");
    });
  });

  socket.on("chat message", async (msg) => {
    try {
      const deviceDetector = new DeviceDetector();
      const device = deviceDetector.detect(
        socket.request.headers["user-agent"]
      );
      // save message to database
      const message = new Message({ content: msg, device: { ...device } });
      await message.save();
      // get all messages from the database
      const messages = await Message.find({});
      // emit the messages to all connected clients
      io.emit("chat messages", messages);
    } catch (err) {
      console.log(err);
    }
  });
});

server.listen(3000, () => {
  console.log("listening on *:3000");
});
