const { createClient } = require('redis')

const redisClient = createClient({
  url: process.env.REDIS_URL
})

redisClient.on('error', (err) => {
  console.log('Redis error:', err.message)
})

redisClient.on('connect', () => {
  console.log('Redis connected successfully')
})

const connectRedis = async () => {
  await redisClient.connect()
}

module.exports = { redisClient, connectRedis }