import { computeCowryScore } from "./reputation";

export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  JWT_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  APP_ORIGIN: string;
}

type User = {
  id: string;
  username: string;
  display_name: string;
  island: string | null;
  created_at: number;
};

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extra,
    },
  });
}

function cors(origin: string) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-allow-credentials": "true",
  };
}

function uid() {
  return crypto.randomUUID();
}

function now() {
  return Date.now();
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string) {
  return sha256Hex(`isle-thrift-pwd:${password}`);
}

async function signToken(payload: Record<string, unknown>, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const h = enc(header);
  const p = enc(payload);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${h}.${p}`));
  const s = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${h}.${p}.${s}`;
}

async function verifyToken(token: string, secret: string): Promise<Record<string, any> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const sigBytes = Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return null;
  const payload = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}

function parseCookies(request: Request) {
  const h = request.headers.get("cookie") || "";
  return Object.fromEntries(h.split(";").map((x) => x.trim()).filter(Boolean).map((c) => {
    const i = c.indexOf("=");
    return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
  }));
}

async function requireUser(request: Request, env: Env): Promise<User | null> {
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const cookies = parseCookies(request);
  const token = bearer || cookies.session || null;
  if (!token) return null;
  const payload = await verifyToken(token, env.JWT_SECRET);
  if (!payload?.sub || typeof payload.sub !== "string") return null;
  const user = await env.DB.prepare("SELECT id, username, display_name, island, created_at FROM users WHERE id = ?").bind(payload.sub).first<User>();
  return user ?? null;
}

async function recalcReputation(env: Env, userId: string) {
  const row = await env.DB.prepare(`
    SELECT
      COALESCE(AVG(rating), 0) AS avg_rating,
      COUNT(*) AS review_count
    FROM reviews WHERE reviewee_id = ?
  `).bind(userId).first<{ avg_rating: number; review_count: number }>();

  const response = await env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN sender_id = ? THEN 1 ELSE 0 END),0) AS sent,
      COUNT(*) AS total
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE c.buyer_id = ? OR c.seller_id = ?
  `).bind(userId, userId, userId).first<{ sent: number; total: number }>();

  const user = await env.DB.prepare("SELECT created_at FROM users WHERE id = ?").bind(userId).first<{ created_at: number }>();
  const ageDays = user ? Math.max(0, (Date.now() - user.created_at) / (1000 * 60 * 60 * 24)) : 0;
  const responseRate = response && response.total > 0 ? response.sent / response.total : 0;

  const { score, tier } = computeCowryScore({
    avgRating: Number(row?.avg_rating || 0),
    reviewCount: Number(row?.review_count || 0),
    responseRate01: responseRate,
    accountAgeDays: ageDays,
  });

  await env.DB.prepare(`
    INSERT INTO user_reputation (user_id, avg_rating, review_count, cowry_score, cowry_tier, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      avg_rating = excluded.avg_rating,
      review_count = excluded.review_count,
      cowry_score = excluded.cowry_score,
      cowry_tier = excluded.cowry_tier,
      updated_at = excluded.updated_at
  `).bind(userId, Number(row?.avg_rating || 0), Number(row?.review_count || 0), score, tier, now()).run();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.APP_ORIGIN || "*";
    const c = cors(origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: c });

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/health") return json({ ok: true }, 200, c);

      if (path === "/auth/register" && request.method === "POST") {
        const body = await request.json<any>();
        if (!body?.username || !body?.password || !body?.displayName) return json({ error: "Missing fields" }, 400, c);
        const id = uid();
        const pw = await hashPassword(body.password);
        const ts = now();
        await env.DB.prepare("INSERT INTO users (id, username, password_hash, display_name, island, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(id, body.username.toLowerCase().trim(), pw, body.displayName.trim(), body.island ?? null, ts).run();
        await env.DB.prepare("INSERT INTO user_reputation (user_id, updated_at) VALUES (?, ?)").bind(id, ts).run();
        return json({ ok: true }, 201, c);
      }

      if (path === "/auth/login" && request.method === "POST") {
        const body = await request.json<any>();
        const user = await env.DB.prepare("SELECT id, password_hash FROM users WHERE username = ?")
          .bind(String(body?.username || "").toLowerCase().trim()).first<{ id: string; password_hash: string }>();
        if (!user) return json({ error: "Invalid credentials" }, 401, c);
        const h = await hashPassword(String(body?.password || ""));
        if (h !== user.password_hash) return json({ error: "Invalid credentials" }, 401, c);

        const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14;
        const token = await signToken({ sub: user.id, exp, iss: env.JWT_ISSUER, aud: env.JWT_AUDIENCE }, env.JWT_SECRET);
        const tokenHash = await sha256Hex(token);
        await env.DB.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
          .bind(uid(), user.id, tokenHash, exp * 1000, now()).run();

        return new Response(JSON.stringify({ token }), {
          status: 200,
          headers: {
            ...c,
            "content-type": "application/json",
            "set-cookie": `session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 14}`,
          },
        });
      }

      if (path === "/me" && request.method === "GET") {
        const user = await requireUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401, c);
        const rep = await env.DB.prepare("SELECT avg_rating, review_count, cowry_score, cowry_tier FROM user_reputation WHERE user_id = ?").bind(user.id).first();
        return json({ user, reputation: rep }, 200, c);
      }

      if (path === "/listings" && request.method === "GET") {
        const q = url.searchParams.get("q") || "";
        const category = url.searchParams.get("category") || "";
        const island = url.searchParams.get("island") || "";
        const rows = await env.DB.prepare(`
          SELECT l.*, u.display_name AS seller_name, ur.avg_rating, ur.review_count, ur.cowry_score, ur.cowry_tier
          FROM listings l
          JOIN users u ON u.id = l.seller_id
          LEFT JOIN user_reputation ur ON ur.user_id = u.id
          WHERE (? = '' OR l.title LIKE '%' || ? || '%')
            AND (? = '' OR l.category = ?)
            AND (? = '' OR l.island = ?)
          ORDER BY l.bumped_at DESC
          LIMIT 100
        `).bind(q, q, category, category, island, island).all();
        return json({ items: rows.results || [] }, 200, c);
      }

      if (path === "/listings" && request.method === "POST") {
        const user = await requireUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401, c);
        const b = await request.json<any>();
        const id = uid();
        const ts = now();
        await env.DB.prepare(`INSERT INTO listings
          (id, seller_id, title, description, price_mvr, category, island, contact, sold, bumped_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`)
          .bind(id, user.id, b.title, b.description, Number(b.priceMvr), b.category, b.island, b.contact, ts, ts, ts).run();

        const photos = Array.isArray(b.photos) ? b.photos.slice(0, 4) : [];
        for (let i = 0; i < photos.length; i++) {
          await env.DB.prepare("INSERT INTO listing_photos (id, listing_id, r2_key, sort_order, created_at) VALUES (?, ?, ?, ?, ?)")
            .bind(uid(), id, photos[i], i, ts).run();
        }

        return json({ id }, 201, c);
      }

      if (path.match(/^\/listings\/[^/]+\/bump$/) && request.method === "POST") {
        const user = await requireUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401, c);
        const id = path.split("/")[2];
        await env.DB.prepare("UPDATE listings SET bumped_at = ?, updated_at = ? WHERE id = ? AND seller_id = ?")
          .bind(now(), now(), id, user.id).run();
        return json({ ok: true }, 200, c);
      }

      if (path === "/conversations/open" && request.method === "POST") {
        const user = await requireUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401, c);
        const b = await request.json<any>();
        const listing = await env.DB.prepare("SELECT id, seller_id FROM listings WHERE id = ?").bind(b.listingId).first<{ id: string; seller_id: string }>();
        if (!listing) return json({ error: "Listing not found" }, 404, c);
        const buyerId = user.id;
        const sellerId = listing.seller_id;
        const existing = await env.DB.prepare("SELECT id FROM conversations WHERE listing_id = ? AND buyer_id = ? AND seller_id = ?")
          .bind(listing.id, buyerId, sellerId).first<{ id: string }>();
        if (existing) return json({ id: existing.id }, 200, c);
        const id = uid();
        await env.DB.prepare("INSERT INTO conversations (id, listing_id, buyer_id, seller_id, created_at) VALUES (?, ?, ?, ?, ?)")
          .bind(id, listing.id, buyerId, sellerId, now()).run();
        return json({ id }, 201, c);
      }

      if (path.match(/^\/conversations\/[^/]+\/messages$/) && request.method === "GET") {
        const user = await requireUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401, c);
        const conversationId = path.split("/")[2];
        const after = Number(url.searchParams.get("after") || 0);
        const convo = await env.DB.prepare("SELECT buyer_id, seller_id FROM conversations WHERE id = ?").bind(conversationId).first<{ buyer_id: string; seller_id: string }>();
        if (!convo || (convo.buyer_id !== user.id && convo.seller_id !== user.id)) return json({ error: "Forbidden" }, 403, c);
        const rows = await env.DB.prepare(`
          SELECT m.id, m.sender_id, u.display_name AS sender_name, m.body, m.created_at
          FROM messages m
          JOIN users u ON u.id = m.sender_id
          WHERE m.conversation_id = ? AND m.created_at > ?
          ORDER BY m.created_at ASC
          LIMIT 200
        `).bind(conversationId, after).all();
        return json({ items: rows.results || [] }, 200, c);
      }

      if (path.match(/^\/conversations\/[^/]+\/messages$/) && request.method === "POST") {
        const user = await requireUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401, c);
        const conversationId = path.split("/")[2];
        const b = await request.json<any>();
        const body = String(b?.body || "").trim();
        if (!body) return json({ error: "Message body required" }, 400, c);
        const convo = await env.DB.prepare("SELECT buyer_id, seller_id FROM conversations WHERE id = ?").bind(conversationId).first<{ buyer_id: string; seller_id: string }>();
        if (!convo || (convo.buyer_id !== user.id && convo.seller_id !== user.id)) return json({ error: "Forbidden" }, 403, c);
        const id = uid();
        await env.DB.prepare("INSERT INTO messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
          .bind(id, conversationId, user.id, body, now()).run();
        return json({ id }, 201, c);
      }

      if (path.match(/^\/transactions\/[^/]+\/complete$/) && request.method === "POST") {
        const user = await requireUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401, c);
        const listingId = path.split("/")[2];
        const b = await request.json<any>();
        const buyerId = String(b?.buyerId || "");
        const listing = await env.DB.prepare("SELECT seller_id FROM listings WHERE id = ?").bind(listingId).first<{ seller_id: string }>();
        if (!listing) return json({ error: "Listing not found" }, 404, c);
        if (user.id !== listing.seller_id && user.id !== buyerId) return json({ error: "Forbidden" }, 403, c);

        const existing = await env.DB.prepare("SELECT * FROM transactions WHERE listing_id = ? AND buyer_id = ? AND seller_id = ?")
          .bind(listingId, buyerId, listing.seller_id).first<any>();

        if (!existing) {
          await env.DB.prepare(`INSERT INTO transactions
            (id, listing_id, buyer_id, seller_id, status, buyer_confirmed, seller_confirmed, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'initiated', ?, ?, ?, ?)`)
            .bind(uid(), listingId, buyerId, listing.seller_id, user.id === buyerId ? 1 : 0, user.id === listing.seller_id ? 1 : 0, now(), now()).run();
        } else {
          await env.DB.prepare(`UPDATE transactions SET
            buyer_confirmed = CASE WHEN ? = buyer_id THEN 1 ELSE buyer_confirmed END,
            seller_confirmed = CASE WHEN ? = seller_id THEN 1 ELSE seller_confirmed END,
            updated_at = ?
            WHERE id = ?`)
            .bind(user.id, user.id, now(), existing.id).run();
        }

        const finalTx = await env.DB.prepare("SELECT * FROM transactions WHERE listing_id = ? AND buyer_id = ? AND seller_id = ?")
          .bind(listingId, buyerId, listing.seller_id).first<any>();

        if (finalTx && finalTx.buyer_confirmed === 1 && finalTx.seller_confirmed === 1) {
          await env.DB.prepare("UPDATE transactions SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?")
            .bind(now(), now(), finalTx.id).run();
          await env.DB.prepare("UPDATE listings SET sold = 1, updated_at = ? WHERE id = ?").bind(now(), listingId).run();
        }

        return json({ ok: true }, 200, c);
      }

      if (path === "/reviews" && request.method === "POST") {
        const user = await requireUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401, c);
        const b = await request.json<any>();
        const listingId = String(b?.listingId || "");
        const revieweeId = String(b?.revieweeId || "");
        const rating = Number(b?.rating || 0);
        const comment = String(b?.comment || "").slice(0, 1000);
        if (!listingId || !revieweeId || rating < 1 || rating > 5) return json({ error: "Invalid review payload" }, 400, c);

        const tx = await env.DB.prepare("SELECT * FROM transactions WHERE listing_id = ? AND status = 'completed'").bind(listingId).first<any>();
        if (!tx) return json({ error: "Review allowed only after completed transaction" }, 403, c);

        const allowed =
          (user.id === tx.buyer_id && revieweeId === tx.seller_id) ||
          (user.id === tx.seller_id && revieweeId === tx.buyer_id);
        if (!allowed) return json({ error: "Forbidden" }, 403, c);

        const id = uid();
        const ts = now();
        await env.DB.prepare(`INSERT INTO reviews
          (id, listing_id, reviewer_id, reviewee_id, rating, comment, is_buyer_to_seller, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(id, listingId, user.id, revieweeId, rating, comment, user.id === tx.buyer_id ? 1 : 0, ts, ts).run();

        await recalcReputation(env, revieweeId);
        return json({ id }, 201, c);
      }

      if (path.match(/^\/users\/[^/]+\/reputation$/) && request.method === "GET") {
        const userId = path.split("/")[2];
        const rep = await env.DB.prepare("SELECT * FROM user_reputation WHERE user_id = ?").bind(userId).first();
        return json({ reputation: rep ?? null }, 200, c);
      }

      if (path.match(/^\/users\/[^/]+\/reviews$/) && request.method === "GET") {
        const userId = path.split("/")[2];
        const rows = await env.DB.prepare(`
          SELECT r.id, r.rating, r.comment, r.created_at, u.display_name AS reviewer_name
          FROM reviews r
          JOIN users u ON u.id = r.reviewer_id
          WHERE r.reviewee_id = ?
          ORDER BY r.created_at DESC
          LIMIT 100
        `).bind(userId).all();
        return json({ items: rows.results || [] }, 200, c);
      }

      if (path.match(/^\/reviews\/[^/]+\/report$/) && request.method === "POST") {
        const user = await requireUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401, c);
        const reviewId = path.split("/")[2];
        const b = await request.json<any>();
        await env.DB.prepare("INSERT INTO reports (id, reporter_id, target_type, target_id, reason, created_at) VALUES (?, ?, 'review', ?, ?, ?)")
          .bind(uid(), user.id, reviewId, String(b?.reason || "No reason provided"), now()).run();
        return json({ ok: true }, 201, c);
      }

      if (path === "/uploads" && request.method === "POST") {
        const user = await requireUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401, c);
        const contentType = request.headers.get("content-type") || "application/octet-stream";
        const key = `uploads/${user.id}/${uid()}.bin`;
        await env.PHOTOS.put(key, request.body, { httpMetadata: { contentType } });
        return json({ key, url: `/images/${encodeURIComponent(key)}` }, 201, c);
      }

      if (path.startsWith("/images/") && request.method === "GET") {
        const key = decodeURIComponent(path.replace("/images/", ""));
        const obj = await env.PHOTOS.get(key);
        if (!obj) return new Response("Not found", { status: 404, headers: c });
        const headers = new Headers(c);
        obj.writeHttpMetadata(headers);
        headers.set("cache-control", "public, max-age=31536000, immutable");
        return new Response(obj.body, { status: 200, headers });
      }

      return json({ error: "Not found" }, 404, c);
    } catch (e: any) {
      return json({ error: e?.message || "Internal server error" }, 500, c);
    }
  },
};
