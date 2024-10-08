const mongoose = require("mongoose");

const PersonalitySchema = new mongoose.Schema(
  {
    token: String,
    email: { type: String, default: "" },
    embeddings: [Number],
    serviceType: String,
    bothServicesObtained: { type: Boolean, default: false },
    displayName: { type: String, default: "" },
    verificationSubmitted: {
      type: Object,
      default: {
        prime: false,
        netflix: false,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Personality", PersonalitySchema);
