const mongoose = require("mongoose");

const PersonalitySchema = new mongoose.Schema(
  {
    token: String,
    email: { type: String, default: null },
    embeddings: [Number],
    serviceType: String,
    bothServicesObtained: { type: Boolean, default: false },
    displayName: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Personality", PersonalitySchema);
