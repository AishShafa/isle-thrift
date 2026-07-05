-- 0001_init.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  island TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_mvr INTEGER NOT NULL,
  category TEXT NOT NULL,
  island TEXT NOT NULL,
  contact TEXT NOT NULL,
  sold INTEGER NOT NULL DEFAULT 0,
  bumped_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(seller_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_listings_bumped_at ON listings(bumped_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_island ON listings(island);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id);

CREATE TABLE IF NOT EXISTS listing_photos (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_listing_photos_listing ON listing_photos(listing_id, sort_order);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, listing_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_favorites_listing ON favorites(listing_id);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(listing_id, buyer_id, seller_id),
  FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY(buyer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(seller_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_conversations_listing ON conversations(listing_id);
CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller ON conversations(seller_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('initiated','completed','cancelled')),
  buyer_confirmed INTEGER NOT NULL DEFAULT 0,
  seller_confirmed INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(listing_id, buyer_id, seller_id),
  FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY(buyer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(seller_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_transactions_listing ON transactions(listing_id);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  reviewee_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT,
  is_buyer_to_seller INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(listing_id, reviewer_id, reviewee_id),
  FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  FOREIGN KEY(reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(reviewee_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_reputation (
  user_id TEXT PRIMARY KEY,
  avg_rating REAL NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  cowry_score INTEGER NOT NULL DEFAULT 0,
  cowry_tier TEXT NOT NULL DEFAULT 'New Trader',
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('listing','user','review')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
