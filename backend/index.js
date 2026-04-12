require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./db");
const { connectRedis, redisClient } = require("./redis");
const productRoutes = require("./routes/products");
const { shmDel, shmDelAll } = require("./shm");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

app.use("/api/products", productRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running" });
});

const startServer = async () => {
  await connectDB();
  await connectRedis();

  const subscriber = redisClient.duplicate();
  await subscriber.connect();
  await subscriber.subscribe("cache:invalidation", (message) => {
    try {
      const { action, key } = JSON.parse(message);
      if (action === "invalidate-all") {
        shmDelAll();
        console.log("[coherency] Cleared all shm cache entries");
      } else if (action === "invalidate" && key) {
        shmDel(key);
        console.log(`[coherency] Cleared shm entry: ${key}`);
      }
    } catch {}
  });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();
