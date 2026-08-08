import mongoose from "mongoose";

mongoose.connect("mongodb://127.0.0.1:27017/truck_business").then(async () => {
  const doc = await mongoose.connection.db.collection("vehicles").findOne({"documents.0": {$exists: true}});
  console.log(JSON.stringify(doc?.documents, null, 2));
  process.exit(0);
});
