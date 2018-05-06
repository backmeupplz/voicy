/**
 * @module models/voice
 * @license MIT
 */

/** Dependencies */
const mongoose = require('mongoose');

/** Schema */
const Schema = mongoose.Schema;
const voiceSchema = new Schema({
  url: {
    type: String,
    required: true,
  },
  text: {
    type: String,
  },
  language: {
  	type: String,
  },
  engine: {
    type: String,
    required: true,
    default: 'google',
    enum: ['wit', 'google', 'yandex'],
  },
  duration: {
    type: Number,
    required: true,
  },
}, { timestamps: true });

/** Exports */
module.exports = mongoose.model('voice', voiceSchema);
