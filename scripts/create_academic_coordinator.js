const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const username = process.argv[2];
const plainPassword = process.argv[3];

if (!username || !plainPassword) {
  console.error('Usage: node scripts/create_academic_coordinator.js <username> <password>');
  process.exit(1);
}

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'anvisivu07',
  database: 'secure_exam',
});

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function ensureRoleAllowed() {
  const rows = await query(
    "SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='role'"
  );

  if (!rows.length) {
    throw new Error("Could not find users.role column");
  }

  const { COLUMN_TYPE: columnType, IS_NULLABLE: isNullable, COLUMN_DEFAULT: columnDefault } = rows[0];

  // If it's an enum, add academic_coordinator if missing.
  if (typeof columnType === 'string' && columnType.toLowerCase().startsWith('enum(')) {
    const values = [];
    const re = /'([^']*)'/g;
    let m;
    while ((m = re.exec(columnType)) !== null) values.push(m[1]);

    if (!values.includes('academic_coordinator')) {
      values.push('academic_coordinator');

      const enumSql = values.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
      const nullSql = isNullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultSql = columnDefault == null ? '' : ` DEFAULT '${String(columnDefault).replace(/'/g, "''")}'`;

      await query(`ALTER TABLE users MODIFY COLUMN role ENUM(${enumSql}) ${nullSql}${defaultSql}`);
      console.log('Updated users.role enum to include academic_coordinator');
    }
  }
}

async function createCoordinatorUser() {
  const existing = await query('SELECT id FROM users WHERE username=?', [username]);
  if (existing.length) {
    throw new Error(`User already exists: ${username}`);
  }

  const hash = await bcrypt.hash(plainPassword, 10);
  await query(
    'INSERT INTO users (username, password, role, status, needs_password_setup) VALUES (?, ?, ?, ?, 0)',
    [username, hash, 'academic_coordinator', 'active']
  );
  console.log(`Created academic coordinator user: ${username}`);
}

(async () => {
  try {
    await ensureRoleAllowed();
    await createCoordinatorUser();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    db.end();
  }
})();
