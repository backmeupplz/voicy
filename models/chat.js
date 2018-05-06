/**
 * @module models/chat
 * @license MIT
 */

/** Dependencies */
const mongoose = require('mongoose');

/** Schema */
const Schema = mongoose.Schema;
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
  seconds: {
    type: Number,
    required: true,
    default: 60,
  },
  voices: [{
    type: Schema.ObjectId,
    ref: 'voice',
    required: true,
    default: [],
  }],
  productHuntDiscountApplied: {
    type: Boolean,
    required: true,
    default: false,
  },
  productHuntSecondsBought: {
    type: Number,
    required: true,
    default: 0,
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
    default: false,
  },
}, { timestamps: true });

/** Exports */
module.exports = mongoose.model('chat', chatSchema);
