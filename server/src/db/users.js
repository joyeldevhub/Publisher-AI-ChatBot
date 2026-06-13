const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'users.json');

function readAll() {
  try {
    if (!fs.existsSync(DB_PATH)) return [];
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeAll(list) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(list, null, 2));
}

function findByEmail(email) {
  return readAll().find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

function findById(id) {
  return readAll().find((u) => u.id === id) || null;
}

async function createUser(email, password) {
  if (findByEmail(email)) {
    return { error: 'User already exists' };
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const users = readAll();
  const user = {
    id: require('uuid').v4(),
    email: email.toLowerCase(),
    password: hashedPassword,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeAll(users);
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

async function verifyPassword(email, password) {
  const user = findByEmail(email);
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password);
  return valid ? user : null;
}

module.exports = { findByEmail, findById, createUser, verifyPassword };
