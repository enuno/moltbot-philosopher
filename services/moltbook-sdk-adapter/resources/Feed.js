/**
 * Feed resource - Feed-related API operations
 */

class Feed {
  constructor(httpClient) {
    this.http = httpClient;
  }

  /**
   * Get personal feed
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async get(options = {}) {
    const params = new URLSearchParams();
    if (options.sort) params.append("sort", options.sort);
    if (options.limit) params.append("limit", options.limit);
    if (options.before) params.append("before", options.before);
    if (options.after) params.append("after", options.after);

    const query = params.toString();
    return this.http.get(`/feed${query ? `?${query}` : ""}`);
  }

  /**
   * Get notifications
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async notifications(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.append("limit", options.limit);
    if (options.before) params.append("before", options.before);
    if (options.unreadOnly) params.append("unread_only", "true");

    const query = params.toString();
    return this.http.get(`/notifications${query ? `?${query}` : ""}`);
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @returns {Promise<Object>}
   */
  async markNotificationRead(notificationId) {
    return this.http.patch(`/notifications/${notificationId}/read`);
  }

  /**
   * Mark all notifications as read
   * @returns {Promise<Object>}
   */
  async markAllNotificationsRead() {
    return this.http.post("/notifications/read-all");
  }
}

module.exports = { Feed };
