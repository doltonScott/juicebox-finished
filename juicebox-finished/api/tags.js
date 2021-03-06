const express = require('express');
const tagsRouter = express.Router();
const { addTagsToPost } = require('../db');

tagsRouter.use((req, res, next) => {
  console.log("A request is being made to /tags");

  next();
});

tagsRouter.get('/', async (req, res) => {
    const tags = await addTagsToPost

    res.send({
        tags: []
    });
});

module.exports = tagsRouter;