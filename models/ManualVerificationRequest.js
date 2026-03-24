const mongoose = require("mongoose");

const manualVerificationRequestSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true
    },
    txId: {
      type: String,
      default: null,
      trim: true
    },
    amount: {
      type: Number,
      default: 50
    },
    note: {
      type: String,
      default: "",
      trim: true
    },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ManualVerificationRequest", manualVerificationRequestSchema);
