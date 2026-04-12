const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const CacheMeta = require("../models/CacheMeta");
const { redisClient } = require("../redis");
const { shmGet, shmSet, shmDel, shmDelAll } = require("../shm");

const STRATEGIES = {
  aggressive: { redisTTL: 1800, shmTTL: 300 },
  balanced: { redisTTL: 600, shmTTL: 60 },
  relaxed: { redisTTL: 120, shmTTL: 30 },
};
const strategy = STRATEGIES[process.env.CACHE_STRATEGY] || STRATEGIES.balanced;
const COHERENCY_CHANNEL = "cache:invalidation";

async function trackCacheMeta(cacheKey, { hit }) {
  try {
    const update = hit
      ? { $inc: { hitCount: 1 }, $set: { lastAccessed: new Date() } }
      : { $inc: { missCount: 1 }, $set: { lastAccessed: new Date() } };
    await CacheMeta.findOneAndUpdate(
      { cacheKey },
      {
        ...update,
        $setOnInsert: {
          ttl: strategy.redisTTL,
          invalidationRules: ["on-update"],
          isActive: true,
          dataType: cacheKey.startsWith("product:")
            ? "product"
            : "product-list",
        },
      },
      { upsert: true },
    );
  } catch {}
}

async function refreshInBackground(cacheKey, fetchFn) {
  try {
    const fresh = await fetchFn();
    if (!fresh) return;
    const serialized = JSON.stringify(fresh);
    await redisClient.setEx(cacheKey, strategy.redisTTL, serialized);
    shmSet(cacheKey, serialized, strategy.shmTTL);
    await CacheMeta.findOneAndUpdate(
      { cacheKey },
      { $set: { lastRefreshed: new Date() } },
    );
  } catch {}
}

async function maybeRefreshAsync(cacheKey, fetchFn) {
  try {
    const ttl = await redisClient.ttl(cacheKey);
    if (ttl > 0 && ttl < strategy.redisTTL * 0.2) {
      setImmediate(() => refreshInBackground(cacheKey, fetchFn));
    }
  } catch {}
}

router.get("/", async (req, res) => {
  const cacheKey = "prod";
  try {
    const shmData = shmGet(cacheKey);
    if (shmData) {
      await trackCacheMeta(cacheKey, { hit: true });
      maybeRefreshAsync(cacheKey, () => Product.find({}).lean());
      return res
        .status(200)
        .json({ products: JSON.parse(shmData), isCached: true, source: "shm" });
    }
    const redisData = await redisClient.get(cacheKey);
    if (redisData) {
      shmSet(cacheKey, redisData, strategy.shmTTL);
      await trackCacheMeta(cacheKey, { hit: true });
      maybeRefreshAsync(cacheKey, () => Product.find({}).lean());
      return res
        .status(200)
        .json({
          products: JSON.parse(redisData),
          isCached: true,
          source: "redis",
        });
    }
    const data = await Product.find({}).lean();
    const serialized = JSON.stringify(data);
    await redisClient.setEx(cacheKey, strategy.redisTTL, serialized);
    shmSet(cacheKey, serialized, strategy.shmTTL);
    await trackCacheMeta(cacheKey, { hit: false });
    return res
      .status(200)
      .json({ products: data, isCached: false, source: "db" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const cacheKey = `product:${id}`;
  try {
    const shmData = shmGet(cacheKey);
    if (shmData) {
      await trackCacheMeta(cacheKey, { hit: true });
      maybeRefreshAsync(cacheKey, () => Product.findById(id).lean());
      return res
        .status(200)
        .json({ product: JSON.parse(shmData), isCached: true, source: "shm" });
    }

    const redisData = await redisClient.get(cacheKey);
    if (redisData) {
      shmSet(cacheKey, redisData, strategy.shmTTL);
      await trackCacheMeta(cacheKey, { hit: true });
      maybeRefreshAsync(cacheKey, () => Product.findById(id).lean());
      return res
        .status(200)
        .json({
          product: JSON.parse(redisData),
          isCached: true,
          source: "redis",
        });
    }

    const data = await Product.findById(id).lean();
    if (!data) return res.status(404).json({ message: "Product not found" });

    const serialized = JSON.stringify(data);
    await redisClient.setEx(cacheKey, strategy.redisTTL, serialized);
    shmSet(cacheKey, serialized, strategy.shmTTL);
    await trackCacheMeta(cacheKey, { hit: false });
    return res
      .status(200)
      .json({ product: data, isCached: false, source: "db" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.delete("/cache/all", async (req, res) => {
  try {
    await redisClient.del("prod");
    shmDelAll();
    await redisClient.publish(
      COHERENCY_CHANNEL,
      JSON.stringify({ action: "invalidate-all" }),
    );
    await CacheMeta.updateMany({}, { $set: { isActive: false } });
    res.json({ message: "All product cache cleared" });
  } catch (err) {
    res.status(500).json({ message: "Error clearing cache" });
  }
});

router.delete("/:id/cache", async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `product:${id}`;
    await redisClient.del(cacheKey);
    shmDel(cacheKey);
    await redisClient.publish(
      COHERENCY_CHANNEL,
      JSON.stringify({ action: "invalidate", key: cacheKey }),
    );
    await CacheMeta.findOneAndUpdate(
      { cacheKey },
      { $set: { isActive: false } },
    );
    res.json({ message: "Product cache cleared" });
  } catch (err) {
    res.status(500).json({ message: "Error clearing cache" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, price, description, category, imageUrl, inStock } = req.body;
    const product = new Product({ name, price, description, category, imageUrl, inStock });
    await product.save();

    await redisClient.del("prod");
    shmDel("prod");
    await redisClient.publish(COHERENCY_CHANNEL, JSON.stringify({ action: "invalidate", key: "prod" }));
    await CacheMeta.findOneAndUpdate({ cacheKey: "prod" }, { $set: { isActive: false } });

    res.status(201).json({ message: "Product added", product });
  } catch (err) {
    res.status(500).json({ message: "Error adding product" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Product not found" });

    const cacheKey = `product:${id}`;
    await redisClient.del("prod");
    await redisClient.del(cacheKey);
    shmDel("prod");
    shmDel(cacheKey);
    await redisClient.publish(COHERENCY_CHANNEL, JSON.stringify({ action: "invalidate-all" }));
    await CacheMeta.updateMany(
      { cacheKey: { $in: ["prod", cacheKey] } },
      { $set: { isActive: false } }
    );

    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting product" });
  }
});

module.exports = router;
