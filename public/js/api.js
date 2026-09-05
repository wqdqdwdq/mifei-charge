// ==================== API 客户端 ====================
const API = {
  baseURL: '/mifei-charge/api',
  token: localStorage.getItem('miffy_token') || '',

  setToken(token) {
    this.token = token;
    localStorage.setItem('miffy_token', token);
  },

  clearToken() {
    this.token = '';
    localStorage.removeItem('miffy_token');
  },

  async request(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (this.token) opts.headers['Authorization'] = `Bearer ${this.token}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.baseURL}${path}`, opts);
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        this.clearToken();
        App.logout();
      }
      throw new Error(data.error || '请求失败');
    }
    return data;
  },

  // Auth
  register(username, password) { return this.request('POST', '/auth/register', { username, password }); },
  login(username, password) { return this.request('POST', '/auth/login', { username, password }); },
  getMe() { return this.request('GET', '/auth/me'); },
  changePassword(oldPassword, newPassword) { return this.request('PUT', '/auth/password', { oldPassword, newPassword }); },
  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await fetch(`${this.baseURL}/auth/avatar`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '上传失败');
    return data;
  },

  // Bills
  getBills(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request('GET', `/bills?${qs}`);
  },
  getBill(id) { return this.request('GET', `/bills/${id}`); },
  createBill(data) { return this.request('POST', '/bills', data); },
  updateBill(id, data) { return this.request('PUT', `/bills/${id}`, data); },
  deleteBill(id) { return this.request('DELETE', `/bills/${id}`); },
  getBillsByCategory(categoryId) { return this.request('GET', `/bills/by-category/${categoryId}`); },

  // Categories
  getCategories(type) {
    const qs = type ? `?type=${type}` : '';
    return this.request('GET', `/categories${qs}`);
  },
  getLeafCategories(type) {
    const qs = type ? `?type=${type}` : '';
    return this.request('GET', `/categories/leaves${qs}`);
  },
  createCategory(data) { return this.request('POST', '/categories', data); },
  updateCategory(id, data) { return this.request('PUT', `/categories/${id}`, data); },
  deleteCategory(id) { return this.request('DELETE', `/categories/${id}`); },

  // Modules
  getModules() { return this.request('GET', '/modules'); },
  getModule(id) { return this.request('GET', `/modules/${id}`); },
  createModule(data) { return this.request('POST', '/modules', data); },
  updateModule(id, data) { return this.request('PUT', `/modules/${id}`, data); },
  deleteModule(id) { return this.request('DELETE', `/modules/${id}`); },

  // Stats
  getStatsOverview(year, month) { return this.request('GET', `/stats/overview?year=${year}&month=${month}`); },
  getDailyStats(year, month) { return this.request('GET', `/stats/daily?year=${year}&month=${month}`); },
  getCategoryExpenseStats(year, month) { return this.request('GET', `/stats/category-expense?year=${year}&month=${month}`); },
  getCategoryIncomeStats(year, month) { return this.request('GET', `/stats/category-income?year=${year}&month=${month}`); },
  getModuleStats(year, month) { return this.request('GET', `/stats/modules?year=${year}&month=${month}`); },
  getYearlyStats(year) { return this.request('GET', `/stats/yearly?year=${year}`); },

  // Family（家庭共享 · 只读）
  getFamilyStatus() { return this.request('GET', '/family/status'); },
  unlinkFamily() { return this.request('DELETE', '/family/unlink'); },
  getFamilyOverview(year, month) { return this.request('GET', `/family/overview?year=${year}&month=${month}`); },
  getFamilyBills(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request('GET', `/family/bills?${qs}`);
  },
  generateFamilyCode() { return this.request('POST', '/family/generate-code'); },
  redeemFamilyCode(code) { return this.request('POST', '/family/redeem-code', { code }); },
};
