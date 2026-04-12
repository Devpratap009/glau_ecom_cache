const mongoose = require('mongoose')

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true  
    },
    price: {
      type: Number,
      required: true  
    },
    description: {
      type: String,
      required: true
    },
    category: {
      type: String,
      default: 'general'
    },
    imageUrl: {
      type: String,
      default: ''
    },
    inStock: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
)

module.exports = mongoose.model('Product', productSchema)