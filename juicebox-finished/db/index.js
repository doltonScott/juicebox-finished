const { Client } = require("pg");
const { rows } = require("pg/lib/defaults");
const client = new Client(process.env.DATABASE_URL || `postgres://localhost:5432/juicebox-dev`);

module.exports = {
  client,
  getAllUsers,
  createUser,
  updateUser,
  createPost,
  updatePost,
  getAllPosts,
  getPostsByUser,
  getUserById,
  createTags,
  addTagsToPost,
  getPostsByTagName,
  getUserByUsername
};

///////////
/* USERS */
///////////

async function getAllUsers() {
  const { rows } = await client.query(`
    select id, username, name, location from users;
  `);

  return rows;
}

async function createUser({ username, password, name, location }) {
  try {
    const {
      rows: [user],
    } = await client.query(
      `
      insert into users (username, password, name, location)
      values ($1, $2, $3, $4)
      on conflict (username) do nothing
      returning *;
    `,
      [username, password, name, location]
    );

    return user;
  } catch (err) {
    throw err;
  }
}

async function updateUser(id, fields = {}) {
  // key = ownerId, postgres will lowercase this by default
  // so we want to wrap it in quotes so that we don't lose the field!
  // ex, "username"=$1
  // ['"username"=$1', ...] -> we need to join these so that we have string to stick in our SQL query!
  const setString = Object.keys(fields)
    .map((key, idx) => `"${key}"=$${idx + 1}`)
    .join(", ");

  if (setString.length === 0) {
    return;
  }

  try {
    const {
      rows: [user],
    } = await client.query(
      `
      update users
      set ${setString}
      where id=${id}
      returning *;
    `,
      Object.values(fields) // this expression returns an array, so we're good :)
    );

    return user;
  } catch (err) {
    throw err;
  }
}

async function getUserById(userId) {
  // first get the user (NOTE: Remember the query returns
  // (1) an object that contains
  // (2) a `rows` array that (in this case) will contain
  // (3) one object, which is our user.
  const {
    rows: [user],
  } = await client.query(`
    select id, name, username, location from users
    where id=${userId};
  `);

  // if it doesn't exist (if there are no `rows` or `rows.length`), return null
  if (!user || (user && !user.id)) {
    return;
  }

  // if it does:
  // delete the 'password' key from the returned object
  // get their posts (use getPostsByUser)
  const posts = await getPostsByUser(user.id);

  // then add the posts to the user object with key 'posts'
  user.posts = posts;

  // return the user object
  return user;
}

async function getUserByUsername(username) {
  try {
    const { rows: [user] } = await client.query(`
      SELECT *
      FROM users
      WHERE username=$1;
    `, [username]);

    return user;
  } catch (error) {
    throw error;
  }
}

///////////
/* POSTS */
///////////

async function createPost({ authorId, title, content, tags = [] }) {
  try {
    const { rows: [ post ] } = await client.query(`
      INSERT INTO posts("authorId", title, content) 
      VALUES($1, $2, $3)
      RETURNING *;
    `, [authorId, title, content]);

    const tagList = await createTags(tags);

    return await addTagsToPost(post.id, tagList);
  } catch (error) {
    throw error;
  }
}

async function updatePost(postId, fields = {}) {
  const { tags } = fields;
  delete fields.tags;

  const setString = Object.keys(fields)
    .map((key, idx) => `"${key}"=$${idx + 1}`)
    .join(", ");

  try {
    if (setString.length > 0) {
      await client.query(
        `
      update posts
      set ${setString}
      where id=${postId}
      returning *;
    `,
        Object.values(fields) // this expression returns an array, so we're good :)
      );
    }

    if (tags === undefined) {
      return await getPostById(postId);
    }

    // if we had tags of #happy, #sad
    // we might want to remove #sad
    // so we can send in fields.tags = ['#happy'] ONLY
    // and #sad will be removed!
    const tagList = await createTags(tags);

    const tagListIdString = tagList.map((tag) => `${tag.id}`).join(", ");

    await client.query(
      `
      delete from post_tags
      where "tagId"
      not in (${tagListIdString})
      and "postId"=$1;
    `,
      [postId]
    );

    await addTagsToPost(postId, tagList);

    return await getPostById(postId);
  } catch (err) {
    throw err;
  }
}

async function getAllPosts() {
  try {
    const { rows: postIds } = await client.query(`
      select id from posts;
    `);

    const posts = await Promise.all(postIds.map(({ id }) => getPostById(id)));

    return posts;
  } catch (err) {
    throw err;
  }
}

async function getPostsByUser(userId) {
  try {
    const { rows: postIds } = await client.query(`
      select id from posts
      where posts."authorId"=${userId};
    `);
    // postIds = [ { id: 1 }, { id: 2 }, ... ]

    const posts = await Promise.all(postIds.map(({ id }) => getPostById(id)));

    return posts;
  } catch (err) {
    throw err;
  }
}

async function getPostById(postId) {
  try {
    const { rows: [ post ]  } = await client.query(`
      SELECT *
      FROM posts
      WHERE id=$1;
    `, [postId]);

    // THIS IS NEW
    if (!post) {
      throw {
        name: "PostNotFoundError",
        message: "Could not find a post with that postId"
      };
    }
    // NEWNESS ENDS HERE

    const { rows: tags } = await client.query(`
      SELECT tags.*
      FROM tags
      JOIN post_tags ON tags.id=post_tags."tagId"
      WHERE post_tags."postId"=$1;
    `, [postId])

    const { rows: [author] } = await client.query(`
      SELECT id, username, name, location
      FROM users
      WHERE id=$1;
    `, [post.authorId])

    post.tags = tags;
    post.author = author;

    delete post.authorId;

    return post;
  } catch (error) {
    throw error;
  }
}

async function getPostsByTagName(tagName) {
  try {
    const { rows: postIds } = await client.query(
      `
      select posts.id from posts
      join post_tags on posts.id=post_tags."postId"
      join tags on tags.id=post_tags."tagId"
      where tags.name=$1
    `,
      [tagName]
    );

    console.log({ postIdsInsideGetPostsByTagName: postIds });

    return await Promise.all(postIds.map((post) => getPostById(post.id)));
  } catch (err) {
    throw err;
  }
}

//////////
/* TAGS */
//////////

// tagList: ['#tagOne', '#tagTwo', ...]
async function createTags(tagList) {
  if (tagList.length === 0) {
    return;
  }

  //    <--> this is the join that will create our comma-separated tuples
  // ($1), ($2), ($3)
  const insertValues = tagList.map((_, idx) => `$${idx + 1}`).join("), (");

  const selectValues = tagList.map((_, idx) => `$${idx + 1}`).join(", ");

  try {
    // insert the tags, doing nothing on conflict
    // returning nothing, we'll query after
    await client.query(
      `
      insert into tags(name)
      values (${insertValues})
      on conflict (name) do nothing
      returning *;
    `,
      tagList
    );

    // select all tags where the name is in our taglist
    // return the rows from the query
    const { rows } = await client.query(
      `
      select * from tags
      where tags.name in (${selectValues});
    `,
      tagList
    );

    return rows;
  } catch (err) {
    throw err;
  }
}

////////////////////////////
/* POST_TAG THROUGH TABLE */
////////////////////////////

async function createPostTag(postId, tagId) {
  try {
    await client.query(
      `
      insert into post_tags("postId", "tagId")
      values ($1, $2)
      on conflict ("postId", "tagId") do nothing;
    `,
      [postId, tagId] // we need an array literal here because our postId, tagId are both strings
    );
  } catch (err) {
    throw err;
  }
}

async function addTagsToPost(postId, tagList) {
  try {
    // this promise will need to be resolved
    const createPostTagPromises = tagList.map((tag) =>
      createPostTag(postId, tag.id)
    );

    // in order to resolve a LIST or ARRAY of promises, we use Promise.all()
    await Promise.all(createPostTagPromises);

    return await getPostById(postId);
  } catch (err) {
    throw err;
  }
}

