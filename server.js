const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors"); // Add this line
require("dotenv").config();
const {
  getMovieEmbeddings,
  combineEmbeddings,
  extractTitles,
  cosineSimilarity,
} = require("./utils");
const admin = require("firebase-admin");
const Personality = require("./models/Personality");

// Initialize Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
  console.log("Firebase Admin SDK initialized successfully");
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors()); // Add this line to enable CORS for all routes
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};

// Routes
app.get("/", (req, res) => {
  res.send("Hello from the backend!");
});

app.post("/api/data", verifyToken, async (req, res) => {
  try {
    const incomingData = req.body;
    const titles = incomingData.titles;
    const serviceType = incomingData.serviceType; // Assuming this is sent from the frontend
    const displayName = incomingData?.displayName;

    if (!serviceType) {
      return res.status(400).json({ message: "Service type is required" });
    }

    // Get embeddings for the titles
    const embeddings = await getMovieEmbeddings(titles);
    const combinedEmbedding = combineEmbeddings(embeddings);

    // Find or create personality data
    let personalityData = await Personality.findOne({ token: req.user.uid });
    if (personalityData) {
      if (personalityData.bothServicesObtained) {
        return res
          .status(200)
          .json({ message: "Personality data already complete" });
      }

      if (personalityData.serviceType === serviceType) {
        // Update existing embeddings for the same service type
        personalityData.embeddings = combinedEmbedding;
      } else {
        // Combine embeddings for different service type
        const oldCombinedEmbedding = personalityData.embeddings;
        const newCombinedEmbedding = combineEmbeddings([
          oldCombinedEmbedding,
          combinedEmbedding,
        ]);
        personalityData.embeddings = newCombinedEmbedding;
        personalityData.bothServicesObtained = true;
      }
    } else {
      // Create new personality data
      personalityData = new Personality({
        token: req.user.uid,
        email: req.user.email,
        embeddings: combinedEmbedding,
        serviceType: serviceType,
        displayName: displayName || "",
      });
    }

    await personalityData.save();

    console.log("Personality data saved");
    res.status(201).json({ message: "Personality data saved successfully" });
  } catch (error) {
    console.error("Error processing or saving data:", error);
    res.status(400).json({ message: error.message });
  }
});

// New endpoint to get top K similar users for user with uid
app.get("/api/similar-users/:uid/:k", async (req, res) => {
  try {
    const uid = req.params.uid;
    const k = parseInt(req.params.k);

    // Validate K
    if (isNaN(k) || k <= 0) {
      return res
        .status(400)
        .json({ message: "Invalid K value. Must be a positive integer." });
    }

    // Get the current user's personality data
    const currentUser = await Personality.findOne({ token: uid });
    if (
      !currentUser ||
      !currentUser.embeddings ||
      currentUser.embeddings.length === 0
    ) {
      return res
        .status(404)
        .json({ message: "User personality data not found or incomplete." });
    }

    // Get all other users' personality data
    const allUsers = await Personality.find({ token: { $ne: uid } });
    if (allUsers.length === 0) {
      return res
        .status(404)
        .json({ message: "No other users found for comparison." });
    }

    // Calculate similarities
    const similarities = allUsers.map((user) => ({
      userId: user.token,
      email: user.email,
      displayName: user?.displayName ?? "",
      similarity: cosineSimilarity(currentUser.embeddings, user.embeddings),
    }));

    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Get top K or all available users if K is larger
    const topKSimilar = similarities.slice(0, Math.min(k, similarities.length));

    // Add a message if K was larger than the number of available users
    const responseMessage =
      k > similarities.length
        ? `Requested ${k} similar users, but only ${similarities.length} are available.`
        : `Top ${k} similar users found.`;

    res.status(200).json({
      message: responseMessage,
      users: topKSimilar,
    });
  } catch (error) {
    console.error("Error finding similar users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// endpoint to get similarilty between two users
app.get("/api/similarity/:uid1/:uid2", async (req, res) => {
  try {
    const uid1 = req.params.uid1;
    const uid2 = req.params.uid2;
    const user1 = await Personality.findOne({ token: uid1 });
    const user2 = await Personality.findOne({ token: uid2 });
    if (!user1) {
      return res.status(404).json({
        message: `${
          user1?.displayName ?? "Your friend's"
        } personality data not found or incomplete.`,
      });
    }

    if (!user2) {
      return res.status(404).json({
        message: `${
          user2?.displayName ?? "Your"
        } personality data not found or incomplete.`,
      });
    }

    if (!user1.embeddings) {
      return res.status(404).json({
        message: `${
          user1?.displayName ?? "Your friend's"
        } personality data not found or incomplete.`,
      });
    }

    if (!user2.embeddings) {
      return res.status(404).json({
        message: `${
          user2?.displayName ?? "Your"
        } personality data not found or incomplete.`,
      });
    }

    const similarity = cosineSimilarity(user1.embeddings, user2.embeddings);
    console.log("Similarity between users:", similarity);
    res.status(200).json({ similarity });
  } catch (error) {
    console.error("Error finding similarity between users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


