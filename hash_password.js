const bcrypt = require('bcrypt');

const password = "teacher123"; // replace with your plain password
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
  if(err) throw err;
  console.log("Hashed password:", hash);
});
