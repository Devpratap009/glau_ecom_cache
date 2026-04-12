const mongoose = require('mongoose')

const cacheMetaSchema = new mongoose.Schema(
  {
    cacheKey: {
      type: String,
      required: true,
      unique: true
    },
    ttl: {
      type: Number,
      default: 3600
    },
    lastAccessed: {
      type: Date,
      default: Date.now
    },
    lastRefreshed: {
      type: Date,
      default: Date.now
    },
    hitCount: {
      type: Number,
      default: 0      
    },
    missCount: {
      type: Number,
      default: 0      
    },
    isActive: {
      type: Boolean,
      default: true   
    },
    invalidationRules: {
      type: [String], 
      default: ['on-update']
    },
    dataType: {
      type: String,   
      default: 'general'
    }
  },
  {
    timestamps: true
  }
)

module.exports = mongoose.model('CacheMeta', cacheMetaSchema)