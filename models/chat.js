// Dependencies
const mongoose = require('mongoose')

// Schema
const Schema = mongoose.Schema
const chatSchema = new Schema({
  id: {
    type: String,
    required: true,
  },
  engine: {
    type: String,
    required: true,
    enum: ['wit', 'google', 'yandex'],
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
  yandexLanguage: {
    type: String,
    required: true,
    default: 'en-US',
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
  language: String, // added justas a virtual variable
}, { timestamps: true })

// Exports
module.exports = mongoose.model('chat', chatSchema)
