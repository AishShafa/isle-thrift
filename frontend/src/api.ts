export type AuthPayload = {
  username: string;
  password: string;
  displayName?: string;
  island?: string;
};

export type ListingInput = {
  title: string;
  description: string;
  priceMvr: number;
  category: string;
  island: string;
  contact: string;
  photos: string[];
};

export class ApiClient {
  private base: string;
  private token: string | null = null;

  constructor(base: string) {
    this.base = base.replace(/\/$/, "");
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers || {});
    headers.set("content-type", "application/json");
    if (this.token) headers.set("authorization", `Bearer ${this.token}`);
    const res = await fetch(`${this.base}${path}`, { ...init, headers, credentials: "include" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "Request failed");
    }
    return res.json();
  }

  register(payload: AuthPayload) {
    return this.request("/auth/register", { method: "POST", body: JSON.stringify(payload) });
  }

  async login(payload: AuthPayload) {
    const out = await this.request("/auth/login", { method: "POST", body: JSON.stringify(payload) });
    if (out.token) this.setToken(out.token);
    return out;
  }

  me() {
    return this.request("/me");
  }

  getListings(params: { q?: string; category?: string; island?: string } = {}) {
    const q = new URLSearchParams();
    if (params.q) q.set("q", params.q);
    if (params.category) q.set("category", params.category);
    if (params.island) q.set("island", params.island);
    return this.request(`/listings?${q.toString()}`);
  }

  createListing(payload: ListingInput) {
    return this.request("/listings", { method: "POST", body: JSON.stringify(payload) });
  }

  bumpListing(id: string) {
    return this.request(`/listings/${id}/bump`, { method: "POST" });
  }

  openConversation(listingId: string) {
    return this.request("/conversations/open", { method: "POST", body: JSON.stringify({ listingId }) });
  }

  getMessages(conversationId: string, after = 0) {
    return this.request(`/conversations/${conversationId}/messages?after=${after}`);
  }

  sendMessage(conversationId: string, body: string) {
    return this.request(`/conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify({ body }) });
  }

  completeTransaction(listingId: string, buyerId: string) {
    return this.request(`/transactions/${listingId}/complete`, { method: "POST", body: JSON.stringify({ buyerId }) });
  }

  createReview(payload: { listingId: string; revieweeId: string; rating: number; comment: string }) {
    return this.request(`/reviews`, { method: "POST", body: JSON.stringify(payload) });
  }

  getUserReputation(userId: string) {
    return this.request(`/users/${userId}/reputation`);
  }

  getUserReviews(userId: string) {
    return this.request(`/users/${userId}/reviews`);
  }

  async uploadPhoto(file: Blob) {
    const res = await fetch(`${this.base}/uploads`, {
      method: "POST",
      headers: this.token ? { authorization: `Bearer ${this.token}` } : {},
      body: file,
      credentials: "include",
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  }
}
