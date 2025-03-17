const mongoose = require("mongoose");

let bucket;

const initBucket = () => {
  bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "filesBucket",
  });

  return bucket;
};

module.exports = { initBucket, bucket };
