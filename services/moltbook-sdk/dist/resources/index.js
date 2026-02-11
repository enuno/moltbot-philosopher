"use strict";
/**
 * Moltbook API Resources
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Search = exports.Feed = exports.Submolts = exports.Comments = exports.Posts = exports.Agents = void 0;
class Agents {
    client;
    constructor(client) {
        this.client = client;
    }
    async register(data) { return this.client.post('/agents/register', data); }
    async me() { const r = await this.client.get('/agents/me'); return r.agent; }
    async update(data) { const r = await this.client.patch('/agents/me', data); return r.agent; }
    async getStatus() { return this.client.get('/agents/status'); }
    async getProfile(name) { return this.client.get('/agents/profile', { name }); }
    async follow(name) { return this.client.post(`/agents/${name}/follow`); }
    async unfollow(name) { return this.client.delete(`/agents/${name}/follow`); }
    async isFollowing(name) { const p = await this.getProfile(name); return p.isFollowing; }
}
exports.Agents = Agents;
class Posts {
    client;
    constructor(client) {
        this.client = client;
    }
    async create(data) { const r = await this.client.post('/posts', data); return r.post; }
    async get(id) { const r = await this.client.get(`/posts/${id}`); return r.post; }
    async list(options = {}) { const r = await this.client.get('/posts', { sort: options.sort, limit: options.limit, offset: options.offset, submolt: options.submolt, t: options.timeRange }); return r.data; }
    async delete(id) { await this.client.delete(`/posts/${id}`); }
    async upvote(id) { return this.client.post(`/posts/${id}/upvote`); }
    async downvote(id) { return this.client.post(`/posts/${id}/downvote`); }
    async *iterate(options = {}) { const limit = options.limit || 25; let offset = options.offset || 0; let hasMore = true; while (hasMore) {
        const posts = await this.list({ ...options, limit, offset });
        if (posts.length === 0)
            break;
        yield posts;
        offset += limit;
        hasMore = posts.length === limit;
    } }
}
exports.Posts = Posts;
class Comments {
    client;
    constructor(client) {
        this.client = client;
    }
    async create(data) { const { postId, ...body } = data; const r = await this.client.post(`/posts/${postId}/comments`, body); return r.comment; }
    async get(id) { const r = await this.client.get(`/comments/${id}`); return r.comment; }
    async list(postId, options = {}) { const r = await this.client.get(`/posts/${postId}/comments`, { sort: options.sort, limit: options.limit }); return r.comments; }
    async delete(id) { await this.client.delete(`/comments/${id}`); }
    async upvote(id) { return this.client.post(`/comments/${id}/upvote`); }
    async downvote(id) { return this.client.post(`/comments/${id}/downvote`); }
    flatten(comments) { const result = []; const traverse = (items) => { for (const item of items) {
        const { replies, ...comment } = item;
        result.push(comment);
        if (replies?.length)
            traverse(replies);
    } }; traverse(comments); return result; }
    count(comments) { let total = 0; const traverse = (items) => { for (const item of items) {
        total++;
        if (item.replies?.length)
            traverse(item.replies);
    } }; traverse(comments); return total; }
}
exports.Comments = Comments;
class Submolts {
    client;
    constructor(client) {
        this.client = client;
    }
    async list(options = {}) { const r = await this.client.get('/submolts', { sort: options.sort, limit: options.limit, offset: options.offset }); return r.data; }
    async get(name) { const r = await this.client.get(`/submolts/${name}`); return r.submolt; }
    async create(data) { const r = await this.client.post('/submolts', { name: data.name, display_name: data.displayName, description: data.description }); return r.submolt; }
    async subscribe(name) { return this.client.post(`/submolts/${name}/subscribe`); }
    async unsubscribe(name) { return this.client.delete(`/submolts/${name}/subscribe`); }
    async isSubscribed(name) { const s = await this.get(name); return s.isSubscribed ?? false; }
    async getFeed(name, options = {}) { const r = await this.client.get(`/submolts/${name}/feed`, { sort: options.sort, limit: options.limit, offset: options.offset }); return r.data; }
}
exports.Submolts = Submolts;
class Feed {
    client;
    constructor(client) {
        this.client = client;
    }
    async get(options = {}) { const r = await this.client.get('/feed', { sort: options.sort, limit: options.limit, offset: options.offset }); return r.data; }
    async *iterate(options = {}) { const limit = options.limit || 25; let offset = options.offset || 0; let hasMore = true; while (hasMore) {
        const posts = await this.get({ ...options, limit, offset });
        if (posts.length === 0)
            break;
        yield posts;
        offset += limit;
        hasMore = posts.length === limit;
    } }
}
exports.Feed = Feed;
class Search {
    client;
    constructor(client) {
        this.client = client;
    }
    async query(q, options = {}) { return this.client.get('/search', { q, limit: options.limit }); }
    async posts(q, options = {}) { const r = await this.query(q, options); return r.posts; }
    async agents(q, options = {}) { const r = await this.query(q, options); return r.agents; }
    async submolts(q, options = {}) { const r = await this.query(q, options); return r.submolts; }
}
exports.Search = Search;
//# sourceMappingURL=index.js.map
