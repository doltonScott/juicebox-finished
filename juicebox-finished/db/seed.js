const {
  client,
  getAllUsers,
  createUser,
  updateUser,
  createPost,
  updatePost,
  getAllPosts,
  getUserById,
  createTags,
  addTagsToPost,
  getPostsByTagName,
} = require("./index");

async function testDB() {
  try {
    const users = await getAllUsers();
    console.log({ users });

    const updateUserResult = await updateUser(users[0].id, {
      name: "Newname Sogood",
      location: "Lesterville, KY",
    });
    console.log({ updateUserResult });

    const posts = await getAllPosts();
    console.log(JSON.stringify({ getAllPosts: posts }, null, 2));

    const updatePostResult = await updatePost(posts[0].id, {
      title: "New Title",
      content: "Updated Content",
    });
    console.log({ updatePostResult });

    const albert = await getUserById(1);
    console.log(JSON.stringify({ albert, albertPosts: albert.posts }, null, 2));

    const updatePostTagsResult = await updatePost(posts[1].id, {
      tags: ["#youcandoanything", "#redfish", "#bluefish"],
    });
    console.log(JSON.stringify({ updatePostTagsResult }, null, 2));

    const postsWithHappy = await getPostsByTagName("#canmandoeverything");
    console.log(JSON.stringify({ postsWithHappy }, null, 2));
  } catch (err) {
    console.error(err);
  }
}

async function dropTables() {
  try {
    await client.query(`
      drop table if exists post_tags;
      drop table if exists tags;
      drop table if exists posts;
      drop table if exists users;
    `);

    console.log("finished dropping tables!");
  } catch (err) {
    throw err;
  }
}

async function createTables() {
  try {
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        active BOOLEAN DEFAULT true
        );

      CREATE TABLE posts (
        id SERIAL PRIMARY KEY,
        "authorId" INTEGER REFERENCES users(id) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        active BOOLEAN DEFAULT true
      );

      CREATE TABLE tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      );

      CREATE TABLE post_tags (
        "postId" INTEGER REFERENCES posts(id),
        "tagId" INTEGER REFERENCES tags(id),
        UNIQUE("postId", "tagId")
      );
    `);

    // through tables allow us to capture relations that are many to many
    // each thing can point to multiple instances of another thing
    // and no thing exclusively belongs to any other thing (in the through table)

    // one to many relationships involve several (or zero) records
    // pointing to one unique instance in another table
    // in this case, every user can have multiple (or zero) posts
    // BUT, every post belongs to exactly ONE user

    console.log("finished seeding tables!");
  } catch (err) {
    throw err;
  }
}

async function createInitialUsers() {
  try {
    await createUser({
      username: "albert",
      password: "bertie99",
      name: "albert",
      location: "washington",
    });
    await createUser({
      username: "sandra",
      password: "2sandy4me",
      name: "sandra",
      location: "maine",
    });
    await createUser({
      username: "glamgal",
      password: "soglam",
      name: "glamgal",
      location: "oklahoma",
    });
  } catch (err) {
    throw err;
  }
}

async function createInitialPosts() {
  try {
    const [albert, sandra, glamgal] = await getAllUsers();

    console.log({ albert });

    await createPost({
      authorId: albert.id,
      title: "First Post",
      content: "This is my first post, I hope you love my post!",
      tags: ["#happy", "#youcandoanything"],
    });
    await createPost({
      authorId: albert.id,
      title: "Second Post",
      content: "This is my second post, I hope you really love this one!",
      tags: ["#happy", "#youcandoanything"],
    });
    await createPost({
      authorId: sandra.id,
      title: "First Post",
      content: "This is my first post, I hope you love my post!",
      tags: ["#happy", "#worst-day-ever"],
    });
    await createPost({
      authorId: glamgal.id,
      title: "First Post",
      content: "This is my first post, I hope you love my post!",
      tags: ["#happy", "#youcandoanything", "#canmandoeverything"],
    });
  } catch (err) {
    throw err;
  }
}

/* this function has been replaced by direct tag application in createPost above */
// async function createInitialTags() {
//   try {
//     const [happy, sad, inspo, catman] = await createTags([
//       "#happy",
//       "#worst-day-ever",
//       "#youcandoanything",
//       "#catmandoeverything",
//     ]);

//     const [post1, post2, post3] = await getAllPosts();

//     await addTagsToPost(post1.id, [happy, inspo]);
//     await addTagsToPost(post2.id, [sad, inspo]);
//     await addTagsToPost(post3.id, [happy, catman, inspo]);
//   } catch (err) {
//     throw err;
//   }
// }

async function rebuildDB() {
  try {
    client.connect();

    await dropTables();
    await createTables();
    await createInitialUsers();
    await createInitialPosts();
    /* this fn call has been deprecated in favor of creating tags inside createInitialPosts() */
    // await createInitialTags();
  } catch (err) {
    console.error(err);
  }
}

rebuildDB()
  .then(testDB)
  .catch(console.error)
  .finally(() => client.end());
