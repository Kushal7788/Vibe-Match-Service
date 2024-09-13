const mongoose = require('mongoose');

const PersonalitySchema = new mongoose.Schema({
  token: String,
  email: String,
  embeddings: [Number],
  serviceType: String,
  bothServicesObtained: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Personality', PersonalitySchema);