// Dependencies
const mongoose = require('mongoose')

// Schema
const Schema = mongoose.Schema
const chatSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    engine: {
      type: String,
      required: true,
      enum: ['wit', 'google'],
      default: 'wit',
    },
    googleLanguage: {
      type: String,
      required: true,
      default: 'en-US',
    },
    witLanguage: {
      type: String,
      required: true,
      default: 'English',
    },
    adminLocked: {
      type: Boolean,
      required: true,
      default: false,
    },
    silent: {
      type: Boolean,
      required: true,
      default: false,
    },
    filesBanned: {
      type: Boolean,
      required: true,
      default: true,
    },
    googleSetupMessageId: Number,
    googleKey: String,
    language: String, // added just as a virtual variable
  },
  { timestamps: true }
)

// Exports
module.exports = mongoose.model('chat', chatSchema)
