// ==================== 主应用 ====================
const App = {
  state: {
    user: null,
    isDesktop: null,
    currentPage: 'home',
    modules: [],
    categories: { expense: [], income: [], all: [] },
    leafCategories: { expense: [], income: [] },
    overview: { income: 0, expense: 0, balance: 0, lastMonthExpense: 0, compareRatio: 0 },
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    // 统计维度
    statsDim: 'month',
    statsYear: new Date().getFullYear(),
    statsMonth: new Date().getMonth() + 1,
    statsDay: null
  },

  // ==================== 初始化 ====================
  async init() {
    this.detectDevice();
    window.addEventListener('resize', () => this.detectDevice());
    window.addEventListener('hashchange', () => this.route());

    const token = API.token;
    if (token) {
      try {
        const data = await API.getMe();
        this.state.user = data.user;
        this.renderApp();
        this.route();
      } catch (e) {
        API.clearToken();
        this.renderAuth('login');
      }
    } else {
      this.renderAuth('login');
    }
  },

  detectDevice() {
    const isDesktop = window.innerWidth >= 768;
    // 仅在设备形态真正改变时（如旋转屏幕 / 窗口宽度跨越 768px 阈值）才重渲染。
    // 移动端软键盘弹起会改变 innerHeight 并触发 resize，但 innerWidth 不变；
    // 若此时整页重渲染会重建输入框，导致焦点丢失、软键盘收起，故需此守卫。
    if (isDesktop === this.state.isDesktop) return;
    this.state.isDesktop = isDesktop;
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.style.display = isDesktop ? 'none' : 'flex';
    this.renderApp();
    this.route();
  },

  // ==================== 路由 ====================
  route() {
    if (!this.state.user) return;
    const hash = window.location.hash || '#/home';
    const page = hash.replace('#/', '').split('?')[0];
    this.state.currentPage = page;

    this.renderApp();
    this.highlightNav(page);

    switch (page) {
      case 'home': this.renderHome(); break;
      case 'add': this.renderAdd(); break;
      case 'bills': this.renderBills(); break;
      case 'modules': this.renderModules(); break;
      case 'module-detail': this.renderModuleDetail(); break;
      case 'stats': this.renderStats(); break;
      case 'family': this.renderFamily(); break;
      case 'mine': this.renderMine(); break;
      case 'categories': this.renderCategoryManage(); break;
      default: this.renderHome();
    }
  },

  highlightNav(page) {
    document.querySelectorAll('.nav-item, .desktop-nav-item').forEach(el => {
      const p = el.getAttribute('data-page') || el.dataset.page;
      if (p) el.classList.toggle('active', p === page);
    });
  },

  // ==================== 渲染架构 ====================
  renderApp() {
    const app = document.getElementById('app');
    if (!this.state.user) return;

    if (this.state.isDesktop) {
      app.innerHTML = `
        <div class="desktop-layout">
          <aside class="desktop-sidebar">
            <div class="desktop-sidebar-logo">
              <img src="images/miffy-logo.jpg" alt="米菲" style="width:56px;height:56px;object-fit:contain;border-radius:12px;">
              <div class="desktop-sidebar-title">米菲记账</div>
            </div>
            <nav class="desktop-nav">
              <a href="#/home" class="desktop-nav-item active" data-page="home">
                <span class="dn-icon">🏠</span> 首页
              </a>
              <a href="#/bills" class="desktop-nav-item" data-page="bills">
                <span class="dn-icon">📋</span> 账单
              </a>
              <a href="#/add" class="desktop-nav-item" data-page="add">
                <span class="dn-icon">✏️</span> 记账
              </a>
              <a href="#/modules" class="desktop-nav-item" data-page="modules">
                <span class="dn-icon">📦</span> 资金模块
              </a>
              <a href="#/stats" class="desktop-nav-item" data-page="stats">
                <span class="dn-icon">📊</span> 统计
              </a>
              <a href="#/family" class="desktop-nav-item" data-page="family">
                <span class="dn-icon">👨‍👩‍👧</span> 家庭
              </a>
            </nav>
            <div style="margin-top:auto;font-size:12px;color:var(--text-light);text-align:center;padding:16px;">
              米菲记账 v1.0
            </div>
          </aside>
          <main class="desktop-main">
            ${this.renderPageShell()}
          </main>
        </div>`;
    } else {
      app.innerHTML = this.renderPageShell();
    }
  },

  renderPageShell() {
    return `<div id="page-container"></div>`;
  },

  // ==================== 登录/注册 ====================
  renderAuth(tab = 'login') {
    const app = document.getElementById('app');
    document.getElementById('bottom-nav').style.display = 'none';
    app.innerHTML = `
      <div class="auth-page">
        <div class="auth-header">
          <img src="images/miffy-logo.jpg" alt="米菲" style="width:100px;height:100px;object-fit:contain;border-radius:16px;margin-bottom:8px;">
          <h1 class="auth-title">米菲记账</h1>
          <p class="auth-subtitle">简单的个人账本，可爱的米菲相伴</p>
        </div>
        <div class="auth-card">
          <div class="auth-tabs">
            <button class="auth-tab ${tab === 'login' ? 'active' : ''}" onclick="App.switchAuthTab('login')">登录</button>
            <button class="auth-tab ${tab === 'register' ? 'active' : ''}" onclick="App.switchAuthTab('register')">注册</button>
          </div>
          <form id="auth-form" onsubmit="App.handleAuth(event, '${tab}')">
            <div class="form-group">
              <label class="form-label">用户名</label>
              <input type="text" class="form-input" id="auth-username" placeholder="请输入用户名" required>
            </div>
            <div class="form-group">
              <label class="form-label">密码</label>
              <input type="password" class="form-input" id="auth-password" placeholder="请输入密码" required minlength="6">
            </div>
            ${tab === 'register' ? '<p style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">注册后即可开始记账，数据安全保存在云端</p>' : ''}
            <button type="submit" class="btn btn-primary" id="auth-submit-btn">
              ${tab === 'login' ? '登录' : '注册'}
            </button>
          </form>
        </div>
      </div>`;
  },

  switchAuthTab(tab) { this.renderAuth(tab); },

  async handleAuth(e, type) {
    e.preventDefault();
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('auth-submit-btn');

    if (!username || !password) { this.toast('请填写用户名和密码'); return; }

    btn.disabled = true;
    btn.textContent = '请稍等...';

    try {
      const data = type === 'login' ? await API.login(username, password) : await API.register(username, password);
      API.setToken(data.token);
      this.state.user = data.user;
      this.toast(type === 'login' ? '登录成功 🐰' : '注册成功，欢迎使用米菲记账！🐰');
      this.renderApp();
      window.location.hash = '#/home';
      this.route();
    } catch (err) {
      this.toast(err.message);
      btn.disabled = false;
      btn.textContent = type === 'login' ? '登录' : '注册';
    }
  },

  logout() {
    API.clearToken();
    this.state.user = null;
    this.renderAuth('login');
    document.getElementById('bottom-nav').style.display = 'none';
    window.location.hash = '';
  },

  // ==================== 首页 ====================
  async renderHome() {
    const container = document.getElementById('page-container');
    container.innerHTML = `<div class="page-header"><h1>🏠 米菲记账</h1></div><div class="page-content">${this.loadingHtml()}</div>`;

    try {
      const [overviewData, modulesData, billsData, familyStatus] = await Promise.all([
        API.getStatsOverview(this.state.currentYear, this.state.currentMonth),
        API.getModules(),
        API.getBills({ limit: 5 }),
        // 家庭接口异常不能拖垮首页，故单独兜底为 null
        API.getFamilyStatus().catch(() => null)
      ]);

      this.state.overview = overviewData;
      this.state.modules = modulesData.modules || [];

      const overview = overviewData;
      const modules = this.state.modules;
      const recentBills = billsData.bills || [];

      container.innerHTML = `
        <div class="page-header"><h1>🏠 米菲记账</h1><button class="home-mine-btn" onclick="window.location.hash='#/mine'" aria-label="我的">👤</button></div>
        <div class="page-content">
          <!-- 月度概览 -->
          <div class="stats-row">
            <div class="stat-card income">
              <div class="stat-label">收入</div>
              <div class="stat-value">¥${this.formatNum(overview.otherIncome)}</div>
            </div>
            <div class="stat-card expense">
              <div class="stat-label">已支出金额</div>
              <div class="stat-value">¥${this.formatNum(overview.expense)}</div>
            </div>
            <div class="stat-card balance">
              <div class="stat-label">可支配金额</div>
              <div class="stat-value">¥${this.formatNum(overview.disposable)}</div>
            </div>
          </div>

          ${overview.compareRatio !== 0 ? `
            <div class="mt-8" style="font-size:12px;color:var(--text-secondary);padding:0 4px;">
              较上月 ${overview.compareRatio > 0 ? '<span class="compare-badge up">📈 +' + overview.compareRatio + '%' : '<span class="compare-badge down">📉 ' + overview.compareRatio + '%'}
            </div>` : ''}

          <!-- 快速记账 -->
          <div class="quick-actions mt-16">
            <button class="quick-action-btn expense" onclick="App.goAdd('expense')">
              <span class="qa-icon">📝</span> 记一笔支出
            </button>
            <button class="quick-action-btn income" onclick="App.goAdd('income')">
              <span class="qa-icon">💰</span> 记一笔收入
            </button>
          </div>

          <!-- 家庭入口 -->
          <div class="mt-16">${this.renderFamilyEntry(familyStatus)}</div>

          <!-- 资金模块 -->
          <div class="section-title mt-16">
            资金模块 <a href="#/modules" class="see-all">管理 →</a>
          </div>
          ${modules.length > 0 ? this.sortedModules().map((m, i) => this.renderModuleCard(m, i, false, false)).join('')
            : `<div class="module-card-empty"><div style="font-size:48px;">📦</div><div class="empty-text">还没有资金模块</div><button class="btn btn-outline btn-sm mt-8" onclick="App.goAddModule()">创建资金模块</button></div>`}

          <!-- 最近账单 -->
          <div class="section-title mt-16">
            最近账单 <a href="#/bills" class="see-all">查看全部 →</a>
          </div>
          ${recentBills.length > 0 ? recentBills.map(b => this.renderBillItem(b)).join('')
            : `<div class="empty-state"><div style="font-size:48px;">📝</div><p>还没有账单记录</p></div>`}
        </div>`;
    } catch (err) {
      container.innerHTML = `<div class="page-header"><h1>🏠 米菲记账</h1></div><div class="page-content"><p style="text-align:center;padding:40px;color:var(--text-secondary)">加载失败，请刷新重试</p></div>`;
    }
  },

  // ==================== 资金模块卡片 ====================
  renderModuleCard(m, idx = 0, showDel = true, showPeriod = true) {
    const remaining = m.budget_amount - m.spent_amount;
    const progress = m.budget_amount > 0 ? Math.round((m.spent_amount / m.budget_amount) * 1000) / 10 : 0;
    let fillClass = 'ok';
    if (progress > 80) fillClass = 'danger';
    else if (progress > 60) fillClass = 'warning';

    // 模块图标：支持 emoji: / upload: / 纯emoji 三种格式
    const moduleEmojis = this.moduleIconList();
    let miffyIcon;
    if (m.icon && m.icon.startsWith('upload:')) {
      miffyIcon = `<img src="uploads/${m.icon.replace('upload:','')}" style="width:28px;height:28px;object-fit:contain;border-radius:6px;">`;
    } else if (m.icon && m.icon.startsWith('emoji:')) {
      miffyIcon = `<span style="font-size:28px;">${m.icon.replace('emoji:','')}</span>`;
    } else {
      miffyIcon = `<span style="font-size:28px;">${moduleEmojis[(m.id || 0) % moduleEmojis.length]}</span>`;
    }

    return `
      <div class="module-card" onclick="window.location.hash='#/module-detail?id=${m.id}'">
        <div class="module-card-header">
          <div class="module-card-name"><span class="module-card-icon">${miffyIcon}</span>${this.escapeHtml(m.name)}</div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${showPeriod && m.period_type !== 'none' ? `<span style="font-size:11px;color:var(--primary);background:var(--primary-light);padding:2px 8px;border-radius:10px;">🔄 ${m.period_type === 'weekly' ? '每周重置' : '每月重置'}</span>` : ''}
            ${showDel ? `<button class="module-del-btn" onclick="event.stopPropagation();App.deleteModule(${m.id})" title="删除模块" aria-label="删除模块">🗑️</button>` : ''}
          </div>
        </div>
        <div class="module-card-amounts">
          <span class="used">已用 ¥${this.formatNum(m.spent_amount)}</span>
          <span class="remain">剩余 ¥${this.formatNum(remaining)}</span>
          <span class="budget">预算 ¥${this.formatNum(m.budget_amount)}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${fillClass}" style="width:${Math.min(progress, 100)}%"></div>
        </div>
        <div style="font-size:11px;color:var(--text-light);margin-top:4px;text-align:right;">使用进度 ${progress}%</div>
      </div>`;
  },

  // 资金模块按使用进度从高到低排序（无预算的模块排最后）
  sortedModules() {
    return (this.state.modules || []).slice().sort((a, b) => {
      const pa = a.budget_amount > 0 ? (a.spent_amount / a.budget_amount) : -1;
      const pb = b.budget_amount > 0 ? (b.spent_amount / b.budget_amount) : -1;
      return pb - pa;
    });
  },

  // ==================== 账单项 ====================
  renderBillItem(b) {
    return `
      <div class="bill-item" onclick="App.showBillDetail(${b.id})">
        <div class="bill-icon">${b.category_icon || (b.type === 'income' ? '💰' : '📌')}</div>
        <div class="bill-info">
          <div class="bill-category">${this.escapeHtml(b.category_name || '未知分类')}</div>
          <div class="bill-meta">
            <span>${b.date}</span>
            ${b.fund_module_name ? `<span>📦 ${this.escapeHtml(b.fund_module_name)}</span>` : ''}
          </div>
        </div>
        <div class="bill-amount ${b.type}">
          ${b.type === 'income' ? '+' : '-'}¥${this.formatNum(b.amount)}
        </div>
      </div>`;
  },

  // ==================== 家庭（授权后只读共享） ====================
  async renderFamily() {
    // 进入页面先停掉可能残留的邀请码倒计时，避免定时器泄漏
    if (this.state._codeTimer) { clearInterval(this.state._codeTimer); this.state._codeTimer = null; }

    const container = document.getElementById('page-container');
    container.innerHTML = `<div class="page-header"><h1>👨‍👩‍👧 家庭</h1></div><div class="page-content">${this.loadingHtml()}</div>`;

    try {
      const status = await API.getFamilyStatus();

      if (!status.bound) {
        container.innerHTML = `
          <div class="page-header"><h1>👨‍👩‍👧 家庭</h1></div>
          <div class="page-content">${this.renderFamilyUnbound(status)}</div>`;
        return;
      }

      const y = this.state.currentYear;
      const m = this.state.currentMonth;
      const [overview, billsData] = await Promise.all([
        API.getFamilyOverview(y, m),
        API.getFamilyBills({ year: y, month: m, page: 1, who: 'all' })
      ]);

      this.state.family = { status, who: 'all', page: 1 };

      container.innerHTML = `
        <div class="page-header"><h1>👨‍👩‍👧 家庭</h1></div>
        <div class="page-content">
          ${this.renderFamilyCompare(overview)}
          <div class="section-title mt-16">
            家庭账单
            <span style="float:right;font-size:12px;font-weight:400;">
              <a href="javascript:void(0)" data-family-filter="all" onclick="App.switchFamilyFilter('all')" style="margin-left:10px;color:var(--primary);font-weight:500;text-decoration:none;">全部</a>
              <a href="javascript:void(0)" data-family-filter="me" onclick="App.switchFamilyFilter('me')" style="margin-left:10px;color:var(--text-secondary);text-decoration:none;">我的</a>
              <a href="javascript:void(0)" data-family-filter="partner" onclick="App.switchFamilyFilter('partner')" style="margin-left:10px;color:var(--text-secondary);text-decoration:none;">对方的</a>
            </span>
          </div>
          <div id="family-bills">${this.renderFamilyBillList(billsData)}</div>
          <div class="mt-16" style="text-align:center;">
            <button class="btn btn-outline btn-sm" onclick="App.confirmUnlinkFamily()">解除家庭关系</button>
          </div>
        </div>`;
    } catch (err) {
      container.innerHTML = `<div class="page-header"><h1>👨‍👩‍👧 家庭</h1></div><div class="page-content"><p style="text-align:center;padding:40px;color:var(--text-secondary)">加载失败，请刷新重试</p></div>`;
    }
  },

  renderFamilyUnbound(status) {
    return `
      <div class="empty-state" style="padding:20px 16px;">
        <div style="font-size:48px;">👨‍👩‍👧</div>
        <p>还没有建立家庭关系</p>
        <p style="font-size:12px;color:var(--text-secondary);">建立后双方可互相查看账本（只读，不能修改对方数据）</p>
      </div>

      <div class="section-title mt-16">绑定家庭关系</div>
      <p style="font-size:12px;color:var(--text-secondary);margin:0 0 10px;">生成邀请码后，把 6 位码告诉对方，他在自己手机的家庭页输入即可互相查看账本。</p>
      <button class="btn btn-primary" style="width:100%;" onclick="App.generateFamilyCode()">生成我的邀请码</button>
      <div id="family-code-area" class="mt-8"></div>
      <div class="mt-8" style="display:flex;gap:8px;">
        <input type="text" class="form-input" id="family-code-input" placeholder="输入对方的 6 位邀请码" maxlength="6" inputmode="numeric" style="flex:1;">
        <button class="btn btn-outline" onclick="App.redeemFamilyCode()">绑定</button>
      </div>`;
  },

  renderFamilyCompare(ov) {
    const me = ov.me;
    const pt = ov.partner;
    return `
      <div class="stats-row">
        <div class="stat-card income">
          <div class="stat-label">我 · ${this.escapeHtml(me.username)}</div>
          <div class="stat-value">¥${this.formatNum(me.expense)}</div>
          <div style="font-size:11px;color:var(--text-secondary);">${me.expenseCount} 笔</div>
        </div>
        <div class="stat-card expense">
          <div class="stat-label">${this.escapeHtml(pt.username)}</div>
          <div class="stat-value">¥${this.formatNum(pt.expense)}</div>
          <div style="font-size:11px;color:var(--text-secondary);">${pt.expenseCount} 笔</div>
        </div>
        <div class="stat-card balance">
          <div class="stat-label">两人合计</div>
          <div class="stat-value">¥${this.formatNum(ov.total.expense)}</div>
          <div style="font-size:11px;color:var(--text-secondary);">${ov.year} 年 ${ov.month} 月</div>
        </div>
      </div>`;
  },

  renderFamilyBillList(data) {
    const bills = data.bills || [];
    if (!bills.length) {
      return `<div class="empty-state"><div style="font-size:48px;">📝</div><p>这个月还没有账单</p></div>`;
    }
    return `
      ${bills.map(b => this.renderFamilyBillItem(b)).join('')}
      <div id="family-pagination">${this.renderFamilyPagination(data)}</div>`;
  },

  renderFamilyBillItem(b) {
    const isMe = b.owner === 'me';
    const barColor = isMe ? 'var(--primary)' : '#D85A30';
    const tagBg = isMe ? 'var(--primary-light)' : '#FAECE7';
    const tagColor = isMe ? 'var(--primary)' : '#993C1D';
    return `
      <div class="bill-item" style="border-left:3px solid ${barColor};">
        <div class="bill-icon">${b.category_icon || (b.type === 'income' ? '💰' : '📌')}</div>
        <div class="bill-info">
          <div class="bill-category">
            ${this.escapeHtml(b.category_name || '未知分类')}
            <span style="font-size:11px;padding:1px 6px;border-radius:8px;margin-left:6px;background:${tagBg};color:${tagColor};">
              ${this.escapeHtml(b.owner_name)}
            </span>
          </div>
          <div class="bill-meta">
            <span>${b.date}</span>
            ${b.remark ? `<span>${this.escapeHtml(b.remark)}</span>` : ''}
          </div>
        </div>
        <div class="bill-amount ${b.type}">
          ${b.type === 'income' ? '+' : '-'}¥${this.formatNum(b.amount)}
        </div>
      </div>`;
  },

  renderFamilyPagination(data) {
    const p = data.page || 1;
    const tp = data.totalPages || 1;
    if (tp <= 1) return '';
    return `
      <div style="display:flex;justify-content:center;align-items:center;gap:12px;padding:12px 0;">
        <button class="btn btn-outline btn-sm" ${p <= 1 ? 'disabled' : ''} onclick="App.loadFamilyPage(${p - 1})">上一页</button>
        <span style="font-size:12px;color:var(--text-secondary);">${p} / ${tp}</span>
        <button class="btn btn-outline btn-sm" ${p >= tp ? 'disabled' : ''} onclick="App.loadFamilyPage(${p + 1})">下一页</button>
      </div>`;
  },

  async loadFamilyPage(page) {
    const f = this.state.family;
    if (!f) return;
    try {
      const data = await API.getFamilyBills({
        year: this.state.currentYear,
        month: this.state.currentMonth,
        who: f.who,
        page
      });
      const box = document.getElementById('family-bills');
      if (box) box.innerHTML = this.renderFamilyBillList(data);
    } catch (err) {
      this.toast('加载失败');
    }
  },

  async switchFamilyFilter(who) {
    if (!this.state.family) this.state.family = {};
    this.state.family.who = who;
    try {
      const data = await API.getFamilyBills({
        year: this.state.currentYear,
        month: this.state.currentMonth,
        who,
        page: 1
      });
      const box = document.getElementById('family-bills');
      if (box) box.innerHTML = this.renderFamilyBillList(data);
      document.querySelectorAll('[data-family-filter]').forEach(el => {
        const hit = el.getAttribute('data-family-filter') === who;
        el.style.color = hit ? 'var(--primary)' : 'var(--text-secondary)';
        el.style.fontWeight = hit ? '500' : '400';
      });
    } catch (err) {
      this.toast('加载失败');
    }
  },

  // 生成 6 位邀请码并展示
  async generateFamilyCode() {
    try {
      const res = await API.generateFamilyCode();
      const area = document.getElementById('family-code-area');
      if (area) {
        area.innerHTML = `
          <div style="text-align:center;padding:16px;background:var(--primary-light);border-radius:12px;">
            <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;">把这串码告诉对方，让他到自己手机的家庭页输入</div>
            <div style="font-size:32px;font-weight:500;letter-spacing:8px;color:var(--primary);">${String(res.code)}</div>
            <button class="btn btn-outline btn-sm" style="margin-top:10px;" onclick="App.copyFamilyCode('${String(res.code)}')">📋 复制邀请码</button>
            <div id="family-code-countdown" style="font-size:12px;color:var(--text-secondary);margin-top:8px;"></div>
          </div>`;
      }
      this.startFamilyCodeCountdown(Date.now() + (res.expiresInMinutes || 10) * 60 * 1000);
    } catch (err) {
      this.toast(err.message);
    }
  },

  // 邀请码倒计时（页面切换时由 renderFamily 统一清理）
  startFamilyCodeCountdown(expiresAtMs) {
    if (this.state._codeTimer) clearInterval(this.state._codeTimer);
    const tick = () => {
      const node = document.getElementById('family-code-countdown');
      if (!node) {
        clearInterval(this.state._codeTimer);
        this.state._codeTimer = null;
        return;
      }
      const left = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      if (left <= 0) {
        node.textContent = '已过期，请重新生成';
        clearInterval(this.state._codeTimer);
        this.state._codeTimer = null;
        return;
      }
      const mm = String(Math.floor(left / 60)).padStart(2, '0');
      const ss = String(left % 60).padStart(2, '0');
      node.textContent = mm + ':' + ss + ' 后失效';
    };
    tick();
    this.state._codeTimer = setInterval(tick, 1000);
  },

  // 用对方的邀请码完成绑定
  async redeemFamilyCode() {
    const input = document.getElementById('family-code-input');
    const code = (input && input.value ? input.value : '').trim();
    if (!/^\d{6}$/.test(code)) { this.toast('请输入 6 位数字邀请码'); return; }
    try {
      const res = await API.redeemFamilyCode(code);
      this.toast(res.message || '绑定成功');
      this.renderFamily();
    } catch (err) {
      this.toast(err.message);
    }
  },

  // 复制邀请码（优先用 clipboard API，失败降级到 execCommand）
  copyFamilyCode(code) {
    const done = () => this.toast('邀请码已复制');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(() => this.fallbackCopy(code, done));
    } else {
      this.fallbackCopy(code, done);
    }
  },

  fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
    document.body.removeChild(ta);
    if (cb) cb();
  },

  async confirmUnlinkFamily() {
    if (!confirm('确定解除家庭关系吗？解除后双方将无法再查看对方的账本。')) return;
    try {
      const res = await API.unlinkFamily();
      this.toast(res.message || '已解除家庭关系');
      this.renderFamily();
    } catch (err) {
      this.toast(err.message);
    }
  },

  // 首页的家庭入口卡片
  renderFamilyEntry(status) {
    const bound = status && status.bound;
    const pending = status && status.incoming ? status.incoming.length : 0;
    const desc = bound
      ? `${this.escapeHtml(status.partner.username)} 与你互相可见 · 查看 →`
      : (pending ? `有 ${pending} 个待处理邀请 · 去处理 →` : '邀请对方互相查看账本 →');
    return `
      <div class="module-card" style="cursor:pointer;" onclick="window.location.hash='#/family'">
        <div class="module-card-header">
          <div class="module-card-name"><span class="module-card-icon">👨‍👩‍👧</span>家庭</div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${desc}</div>
      </div>`;
  },

  // ==================== 快速记账 ====================
  goAdd(type) {
    if (this.state.isDesktop) {
      window.location.hash = '#/add?type=' + type;
    } else {
      window.location.hash = '#/add?type=' + type;
    }
  },

  async renderAdd() {
    const container = document.getElementById('page-container');
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const billType = params.get('type') || 'expense';
    const today = new Date().toISOString().split('T')[0];

    container.innerHTML = `<div class="page-header"><div class="page-header-left"><a href="#/home" class="back-btn">←</a></div><h1>记账</h1><div></div></div><div class="page-content">${this.loadingHtml()}</div>`;

    try {
      const [catData, modData] = await Promise.all([
        API.getLeafCategories(),
        API.getModules()
      ]);

      this.state.leafCategories = { expense: [], income: [] };
      (catData.categories || []).forEach(c => {
        this.state.leafCategories[c.type].push(c);
      });
      this.state.modules = modData.modules || [];
      if (!this.state._billForm) {
        this.state._billForm = { type: billType, amount: '', category_id: null, category_name: '请选择分类', fund_module_id: null, fund_module_name: '请选择资金模块', date: today, remark: '' };
      } else {
        this.state._billForm.type = billType;
      }

      const form = this.state._billForm;
      container.innerHTML = this.renderAddForm(form, billType);
    } catch (err) {
      container.innerHTML = `<div class="page-header"><a href="#/home" class="back-btn">←</a><h1>记账</h1></div><div class="page-content"><p style="text-align:center;padding:40px;">加载失败</p></div>`;
    }
  },

  renderAddForm(form, billType) {
    return `
      <div class="page-header">
        <div class="page-header-left">
          <a href="#/home" class="back-btn">←</a>
        </div>
        <h1>记账</h1>
        <div></div>
      </div>
      <div class="page-content add-page">
        <div class="add-type-tabs">
          <button class="add-type-tab ${billType === 'expense' ? 'active' : ''}" onclick="App.switchAddType('expense')">📝 支出</button>
          <button class="add-type-tab ${billType === 'income' ? 'active' : ''}" onclick="App.switchAddType('income')">💰 收入</button>
        </div>

        <div class="add-form-card">
          <div class="amount-input-wrap">
            <span class="amount-symbol">¥</span>
            <input type="number" class="amount-input" id="add-amount" placeholder="0.00" value="${form.amount}" step="0.01" min="0.01" oninput="App.updateFormField('amount', this.value)">
          </div>

          <div class="form-row" onclick="App.showCategoryPicker('${billType}')">
            <span class="form-row-label">分类</span>
            <span class="form-row-value ${form.category_id ? '' : 'placeholder'}">
              ${form.category_id ? this.getCategoryIcon(form.category_id) + ' ' + form.category_name : '请选择分类'}
              <span class="form-row-arrow">›</span>
            </span>
          </div>

          ${billType === 'expense' ? `
          <div class="form-row" onclick="App.showModulePicker()">
            <span class="form-row-label">资金模块</span>
            <span class="form-row-value ${form.fund_module_id ? '' : 'placeholder'}">
              📦 ${form.fund_module_name || '请选择资金模块'}
              <span class="form-row-arrow">›</span>
            </span>
          </div>` : ''}

          <div class="form-row" style="cursor:default;">
            <span class="form-row-label">日期</span>
            <input type="date" class="form-input" style="border:none;text-align:right;padding:0;background:transparent;flex:1;cursor:pointer;color:var(--text-primary);font-size:14px;" value="${form.date}" onchange="App.selectDate(this.value)">
          </div>

          <div class="form-row">
            <span class="form-row-label">备注</span>
            <input type="text" class="form-input" style="flex:1;border:none;text-align:right;padding:0;background:transparent;" placeholder="可选备注" value="${this.escapeHtml(form.remark || '')}" oninput="App.updateFormField('remark', this.value)">
          </div>
        </div>

        <button class="btn btn-primary" onclick="App.submitBill()" id="submit-bill-btn">
          ${billType === 'expense' ? '💸' : '💰'} 保存${billType === 'expense' ? '支出' : '收入'}
        </button>
      </div>`;
  },

  switchAddType(type) {
    this.state._billForm.type = type;
    this.state._billForm.category_id = null;
    this.state._billForm.category_name = '请选择分类';
    this.state._billForm.fund_module_id = null;
    this.state._billForm.fund_module_name = '请选择资金模块';
    // Update URL then force re-render
    window.location.hash = '#/add?type=' + type;
    this.renderAdd();
  },

  updateFormField(field, value) {
    this.state._billForm[field] = value;
  },

  getCategoryIcon(catId) {
    const cats = [...this.state.leafCategories.expense, ...this.state.leafCategories.income];
    const cat = cats.find(c => c.id === catId);
    return cat ? cat.icon : '📌';
  },

  showCategoryPicker(type) {
    const cats = this.state.leafCategories[type] || [];
    let html = `<div class="picker-modal">
      <div class="picker-header">
        <button class="picker-close" onclick="App.closePicker()">取消</button>
        <span class="picker-title">选择${type === 'expense' ? '支出' : '收入'}分类</span>
        <div style="width:40px;"></div>
      </div>
      <div class="picker-body">`;

    const groups = {};
    cats.forEach(c => {
      const gn = c.group_name || '其他';
      if (!groups[gn]) groups[gn] = [];
      groups[gn].push(c);
    });

    for (const [gn, items] of Object.entries(groups)) {
      html += `<div style="padding:8px 16px;font-size:13px;color:var(--text-secondary);">${gn}</div>`;
      items.forEach(c => {
        html += `
          <div class="picker-item ${this.state._billForm.category_id === c.id ? 'selected' : ''}" onclick="App.selectCategory(${c.id}, '${this.escapeHtml(c.name)}')">
            <span class="picker-item-icon">${c.icon}</span>
            <span class="picker-item-name">${this.escapeHtml(c.name)}</span>
            ${this.state._billForm.category_id === c.id ? '<span class="picker-item-check">✓</span>' : ''}
          </div>`;
      });
    }

    html += `<div style="padding:12px 16px;"><a href="#/categories" style="font-size:13px;color:var(--primary)">+ 管理分类</a></div>`;
    html += `</div></div>`;

    document.getElementById('app').insertAdjacentHTML('beforeend', html);
  },

  selectCategory(id, name) {
    this.state._billForm.category_id = id;
    this.state._billForm.category_name = name;
    this.closePicker();
    this.renderAdd();
  },

  showModulePicker() {
    const mods = this.state.modules;
    let html = `<div class="picker-modal">
      <div class="picker-header">
        <button class="picker-close" onclick="App.closePicker()">取消</button>
        <span class="picker-title">选择资金模块</span>
        <div style="width:40px;"></div>
      </div>
      <div class="picker-body">`;

    mods.forEach((m, i) => {
      const remaining = m.budget_amount - m.spent_amount;
      const modEmojis = this.moduleIconList();
      let pickerIconHtml;
      if (m.icon && m.icon.startsWith('upload:')) {
        pickerIconHtml = `<img src="uploads/${m.icon.replace('upload:','')}" style="width:28px;height:28px;object-fit:contain;border-radius:6px;">`;
      } else if (m.icon && m.icon.startsWith('emoji:')) {
        pickerIconHtml = `<span style="font-size:28px;">${m.icon.replace('emoji:','')}</span>`;
      } else {
        pickerIconHtml = `<span style="font-size:28px;">${modEmojis[(m.id || 0) % modEmojis.length]}</span>`;
      }
      html += `
        <div class="picker-item ${this.state._billForm.fund_module_id === m.id ? 'selected' : ''}" onclick="App.selectModule(${m.id}, '${this.escapeHtml(m.name)}')">
          <span class="picker-item-icon">${pickerIconHtml}</span>
          <div style="flex:1">
            <div class="picker-item-name">${this.escapeHtml(m.name)}</div>
            <div style="font-size:12px;color:var(--text-secondary);">剩余 ¥${this.formatNum(remaining)} / ¥${this.formatNum(m.budget_amount)}</div>
          </div>
          ${this.state._billForm.fund_module_id === m.id ? '<span class="picker-item-check">✓</span>' : ''}
        </div>`;
    });

    html += `<div style="padding:12px 16px;"><a href="#/modules" style="font-size:13px;color:var(--primary)">+ 新建资金模块</a></div>`;
    html += `</div></div>`;
    document.getElementById('app').insertAdjacentHTML('beforeend', html);
  },

  selectModule(id, name) {
    this.state._billForm.fund_module_id = id;
    this.state._billForm.fund_module_name = name;
    this.closePicker();
    this.renderAdd();
  },

  showDatePicker() {
    const date = this.state._billForm.date;
    const html = `<div class="picker-modal">
      <div class="picker-header">
        <button class="picker-close" onclick="App.closePicker()">取消</button>
        <span class="picker-title">选择日期</span>
        <div style="width:40px;"></div>
      </div>
      <div class="picker-body" style="padding:16px;">
        <input type="date" id="date-input" class="form-input" value="${date}" onchange="App.selectDate(this.value)">
      </div>
    </div>`;
    document.getElementById('app').insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('date-input')?.focus(), 100);
  },

  selectDate(date) {
    this.state._billForm.date = date;
    // No need to re-render, value is already updated in the input
  },

  closePicker() {
    const pickers = document.querySelectorAll('.picker-modal');
    pickers.forEach(p => p.remove());
  },

  async submitBill() {
    const form = this.state._billForm;
    if (!form.amount || parseFloat(form.amount) <= 0) { this.toast('请输入金额'); return; }
    if (!form.category_id) { this.toast('请选择分类'); return; }
    if (form.type === 'expense' && !form.fund_module_id) { this.toast('请选择资金模块'); return; }

    // 检查余额
    if (form.type === 'expense') {
      const mod = this.state.modules.find(m => m.id === form.fund_module_id);
      if (mod) {
        const remaining = mod.budget_amount - mod.spent_amount;
        if (remaining < parseFloat(form.amount)) {
          this.showLowBalanceConfirm(mod.name, remaining);
          return;
        }
      }
    }

    await this.doSaveBill();
  },

  showLowBalanceConfirm(moduleName, remaining) {
    const html = `
      <div class="modal" id="low-balance-modal" style="display:block;bottom:50%;transform:translate(-50%,50%);border-radius:var(--radius-lg);max-width:360px;">
        <div class="modal-body" style="text-align:center;padding:24px;">
          <div style="font-size:48px;">⚠️</div>
          <h3 style="margin:12px 0;font-size:17px;">余额不足</h3>
          <p style="font-size:14px;color:var(--text-secondary);margin-bottom:8px;">
            「${this.escapeHtml(moduleName)}」模块剩余 ¥${this.formatNum(remaining)}，可能不够用哦
          </p>
          <p style="font-size:13px;color:var(--text-light);">是否仍然继续记账？</p>
          <div style="margin-top:20px;display:flex;flex-direction:column;gap:8px;">
            <button class="btn btn-primary" onclick="App.closeModal();App.doLowBalanceSave()">继续记账</button>
            <button class="btn btn-outline btn-sm" onclick="App.closeModal();App.showModulePicker()">更换资金模块</button>
            <button class="btn btn-ghost btn-sm" onclick="App.closeModal()">取消</button>
          </div>
        </div>
      </div>`;
    this.showModal(html);
  },

  async doLowBalanceSave() { await this.doSaveBill(); },

  async doSaveBill() {
    const form = this.state._billForm;
    const btn = document.getElementById('submit-bill-btn');
    if (btn) { btn.disabled = true; btn.textContent = '保存中...'; }

    try {
      await API.createBill({
        type: form.type,
        amount: parseFloat(form.amount),
        category_id: form.category_id,
        fund_module_id: form.type === 'expense' ? form.fund_module_id : null,
        date: form.date,
        remark: form.remark || ''
      });

      this.showCelebrate(() => { window.location.hash = '#/home'; });
      this.state._billForm = { type: 'expense', amount: '', category_id: null, category_name: '请选择分类', fund_module_id: null, fund_module_name: '请选择资金模块', date: new Date().toISOString().split('T')[0], remark: '' };
    } catch (err) {
      this.toast(err.message);
      if (btn) { btn.disabled = false; btn.textContent = '保存' + (form.type === 'expense' ? '支出' : '收入'); }
    }
  },

  // ==================== 账单列表 ====================
  async renderBills() {
    const container = document.getElementById('page-container');
    container.innerHTML = `<div class="page-header"><h1>📋 账单</h1></div><div class="page-content">${this.loadingHtml()}</div>`;

    try {
      const bills = await API.getBills({ limit: 50 });
      container.innerHTML = `
        <div class="page-header"><h1>📋 账单</h1></div>
        <div class="page-content">
          <div class="bill-filters">
            <div class="filter-row">
              <button class="filter-chip active" data-filter="all" onclick="App.filterBills('all', this)">全部</button>
              <button class="filter-chip" data-filter="expense" onclick="App.filterBills('expense', this)">📝 支出</button>
              <button class="filter-chip" data-filter="income" onclick="App.filterBills('income', this)">💰 收入</button>
            </div>
            <input type="text" class="form-input filter-search" placeholder="🔍 搜索账单（备注/分类）" oninput="App.searchBills(this.value)">
          </div>
          <div id="bills-list">
            ${bills.bills.length > 0 ? bills.bills.map(b => this.renderBillItem(b)).join('') : `<div class="empty-state"><div style="font-size:48px;">📝</div><p>还没有账单记录</p></div>`}
          </div>
          <div id="bills-pagination">
            ${bills.total > 50 ? this.renderPagination(bills.page, Math.ceil(bills.total / 50)) : ''}
          </div>
        </div>`;
      this.state._allBills = bills.bills;
      this.state._billsFilter = 'all';
      this.state._billsSearch = '';
    } catch (err) {
      container.innerHTML = `<div class="page-header"><h1>📋 账单</h1></div><div class="page-content"><p style="text-align:center;padding:40px;">加载失败</p></div>`;
    }
  },

  async filterBills(filter, el) {
    this.state._billsFilter = filter;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');
    await this.loadBills();
  },

  async searchBills(keyword) {
    this.state._billsSearch = keyword;
    await this.loadBills();
  },

  async loadBills(page = 1) {
    const params = { limit: 50, page };
    if (this.state._billsFilter !== 'all') params.type = this.state._billsFilter;
    if (this.state._billsSearch) params.keyword = this.state._billsSearch;

    try {
      const data = await API.getBills(params);
      const listEl = document.getElementById('bills-list');
      if (listEl) {
        listEl.innerHTML = data.bills.length > 0
          ? data.bills.map(b => this.renderBillItem(b)).join('')
          : `<div class="empty-state"><div style="font-size:48px;">📝</div><p>没有找到账单</p></div>`;
      }

      const pagEl = document.getElementById('bills-pagination');
      if (pagEl) {
        pagEl.innerHTML = data.total > 50
          ? this.renderPagination(data.page, Math.ceil(data.total / 50))
          : '';
      }
    } catch (err) {
      this.toast('加载失败');
    }
  },

  async showBillDetail(id) {
    try {
      const data = await API.getBill(id);
      const b = data.bill;
      const html = `
        <div class="modal-header">
          <h3 class="modal-title">账单详情</h3>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <div style="text-align:center;padding:16px;">
            <div style="font-size:40px;">${b.category_icon || '📌'}</div>
            <div style="font-size:32px;font-weight:700;color:${b.type === 'expense' ? 'var(--primary-dark)' : 'var(--accent-green)'};margin:8px 0;">
              ${b.type === 'expense' ? '-' : '+'}¥${this.formatNum(b.amount)}
            </div>
            <div style="font-size:15px;color:var(--text-secondary);">${this.escapeHtml(b.category_name)}</div>
          </div>
          <div class="bill-detail-info">
            <div class="bill-detail-row"><span class="label">类型</span><span class="value">${b.type === 'expense' ? '支出' : '收入'}</span></div>
            <div class="bill-detail-row"><span class="label">分类</span><span class="value">${b.category_icon} ${this.escapeHtml(b.category_name)}</span></div>
            ${b.fund_module_name ? `<div class="bill-detail-row"><span class="label">资金模块</span><span class="value">📦 ${this.escapeHtml(b.fund_module_name)}</span></div>` : ''}
            <div class="bill-detail-row"><span class="label">日期</span><span class="value">${b.date}</span></div>
            <div class="bill-detail-row"><span class="label">备注</span><span class="value">${this.escapeHtml(b.remark || '无')}</span></div>
            <div class="bill-detail-row"><span class="label">记录时间</span><span class="value" style="font-weight:400;font-size:12px;">${b.created_at}</span></div>
          </div>
          <div class="bill-detail-actions">
            <button class="btn btn-outline btn-sm" onclick="App.editBill(${b.id})" style="flex:1">✏️ 修改</button>
            <button class="btn btn-danger btn-sm" onclick="App.confirmDeleteBill(${b.id})" style="flex:1">🗑️ 删除</button>
          </div>
        </div>`;
      this.showModal(html);
    } catch (err) {
      this.toast('加载账单详情失败');
    }
  },

  async confirmDeleteBill(id) {
    if (!confirm('确定要删除这条账单吗？删除后对应资金模块的金额将恢复。')) return;
    try {
      await API.deleteBill(id);
      this.toast('账单已删除');
      closeModal();
      this.route();
    } catch (err) {
      this.toast(err.message);
    }
  },

  loadingHtml() {
    const imgs = [
      '<img src="./images/miffy-cup.png" alt="米菲喝茶">',
      '<img src="./images/miffy-wallet.jpg" alt="米菲拿钱包">',
      '<img src="./images/miffy-logo.jpg" alt="米菲">',
      '<img src="./images/miffy-celebrate.jpg" alt="米菲庆祝">'
    ];
    const texts = [
      '米菲正在帮你翻找小账本，稍等一下下哦 🐰',
      '别着急，小兔子正在认真数钱呢～',
      '马上就好啦，喝口水的功夫 🌸',
      '米菲在记账中，请温柔地等待 💛',
      '数据坐小火车来的路上，马上到～',
      '乖乖等一下，米菲不会让你久等的'
    ];
    const img = imgs[Math.floor(Math.random() * imgs.length)];
    const txt = texts[Math.floor(Math.random() * texts.length)];
    return `
      <div class="miffy-loading">
        <div class="miffy-loading-imgwrap">${img}</div>
        <div class="miffy-loading-text">${txt}</div>
      </div>`;
  },

  async editBill(id) {
    try {
      const data = await API.getBill(id);
      const b = data.bill;
      const [catData, modData] = await Promise.all([API.getLeafCategories(), API.getModules()]);
      this.state.leafCategories = { expense: [], income: [] };
      (catData.categories || []).forEach(c => { this.state.leafCategories[c.type].push(c); });
      this.state.modules = modData.modules || [];
      this.state._editingBillId = id;
      this.state._billForm = {
        type: b.type, amount: String(b.amount), category_id: b.category_id,
        category_name: b.category_name, fund_module_id: b.fund_module_id,
        fund_module_name: b.fund_module_name || '请选择资金模块',
        date: b.date, remark: b.remark || ''
      };

      closeModal();
      const container = document.getElementById('page-container');
      container.innerHTML = `
        <div class="page-header">
          <div class="page-header-left"><a href="#/bills" class="back-btn">←</a></div>
          <h1>修改账单</h1><div></div>
        </div>
        <div class="page-content add-page">
          ${this.renderAddFormContent(b.type)}
          <button class="btn btn-primary" onclick="App.submitEditBill()">💾 保存修改</button>
        </div>`;
    } catch (err) {
      this.toast('加载账单失败');
    }
  },

  renderAddFormContent(type) {
    const form = this.state._billForm;
    return `
      <div class="add-type-tabs">
        <button class="add-type-tab ${type === 'expense' ? 'active' : ''}" onclick="App.switchAddType('expense')">📝 支出</button>
        <button class="add-type-tab ${type === 'income' ? 'active' : ''}" onclick="App.switchAddType('income')">💰 收入</button>
      </div>
      <div class="add-form-card">
        <div class="amount-input-wrap">
          <span class="amount-symbol">¥</span>
          <input type="number" class="amount-input" id="add-amount" value="${form.amount}" step="0.01" min="0.01" oninput="App.updateFormField('amount', this.value)">
        </div>
        <div class="form-row" onclick="App.showCategoryPicker('${type}')">
          <span class="form-row-label">分类</span>
          <span class="form-row-value ${form.category_id ? '' : 'placeholder'}">
            ${form.category_id ? this.getCategoryIcon(form.category_id) + ' ' + form.category_name : '请选择分类'}
            <span class="form-row-arrow">›</span>
          </span>
        </div>
        ${type === 'expense' ? `<div class="form-row" onclick="App.showModulePicker()"><span class="form-row-label">资金模块</span><span class="form-row-value ${form.fund_module_id ? '' : 'placeholder'}">📦 ${form.fund_module_name || '请选择资金模块'}<span class="form-row-arrow">›</span></span></div>` : ''}
        <div class="form-row" style="cursor:default;"><span class="form-row-label">日期</span><input type="date" class="form-input" style="border:none;text-align:right;padding:0;background:transparent;flex:1;cursor:pointer;color:var(--text-primary);font-size:14px;" value="${form.date}" onchange="App.selectDate(this.value)"></div>
        <div class="form-row"><span class="form-row-label">备注</span><input type="text" class="form-input" style="flex:1;border:none;text-align:right;padding:0;background:transparent;" value="${this.escapeHtml(form.remark || '')}" oninput="App.updateFormField('remark', this.value)"></div>
      </div>`;
  },

  async submitEditBill() {
    const form = this.state._billForm;
    if (!form.amount || parseFloat(form.amount) <= 0) { this.toast('请输入金额'); return; }
    if (!form.category_id) { this.toast('请选择分类'); return; }
    if (form.type === 'expense' && !form.fund_module_id) { this.toast('请选择资金模块'); return; }

    try {
      await API.updateBill(this.state._editingBillId, {
        type: form.type,
        amount: parseFloat(form.amount),
        category_id: form.category_id,
        fund_module_id: form.type === 'expense' ? form.fund_module_id : null,
        date: form.date,
        remark: form.remark || ''
      });

      this.toast('账单修改成功，模块金额已重新计算 🐰');
      window.location.hash = '#/bills';
    } catch (err) {
      this.toast(err.message);
    }
  },

  // ==================== 资金模块 ====================
  async renderModules() {
    const container = document.getElementById('page-container');
    container.innerHTML = `<div class="page-header"><h1>📦 资金模块</h1></div><div class="page-content">${this.loadingHtml()}</div>`;

    try {
      const modData = await API.getModules();
      this.state.modules = modData.modules || [];

      const totalBudget = this.state.modules.reduce((s, m) => s + (Number(m.budget_amount) || 0), 0);
      const totalSpent = this.state.modules.reduce((s, m) => s + (Number(m.spent_amount) || 0), 0);
      container.innerHTML = `
        <div class="page-header">
          <h1>📦 资金模块</h1>
        </div>
        <div class="page-content">
          ${this.state.modules.length > 0 ? this.sortedModules().map((m, i) => this.renderModuleCard(m, i)).join('')
            : `<div class="module-card-empty"><div style="font-size:48px;">📦</div><div class="empty-text">还没有资金模块</div><p style="font-size:13px;color:var(--text-secondary);margin-top:8px;">创建模块后，每笔支出会自动扣除对应模块金额</p><button class="btn btn-primary btn-sm mt-8" onclick="App.goAddModule()">创建第一个资金模块</button></div>`}
          ${this.state.modules.length > 0 ? `
          <div class="module-total-bar">
            <div class="module-total-item"><span class="module-total-label">模块总预算</span><span class="module-total-value">¥${this.formatNum(totalBudget)}</span></div>
            <div class="module-total-item"><span class="module-total-label">已用合计</span><span class="module-total-value" style="color:var(--primary)">¥${this.formatNum(totalSpent)}</span></div>
          </div>
          <button class="btn btn-primary btn-block mt-12" onclick="App.goAddModule()">+ 新建资金模块</button>` : ''}
        </div>`;
    } catch (err) {
      container.innerHTML = `<div class="page-header"><h1>📦 资金模块</h1></div><div class="page-content"><p style="text-align:center;padding:40px;">加载失败</p></div>`;
    }
  },

  goAddModule(editId) {
    const mod = editId ? this.state.modules.find(m => m.id === editId) : null;
    const html = `
      <div class="modal-header">
        <h3 class="modal-title">${mod ? '编辑' : '新建'}资金模块</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">模块名称 *</label>
          <input type="text" class="form-input" id="mod-name" value="${this.escapeHtml(mod ? mod.name : '')}" placeholder="如：饭钱、交通费">
        </div>
        <div class="form-group">
          <label class="form-label">模块图标</label>
          <div id="mod-icon-selector" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            ${this.moduleIconList().map((icon, i) => {
              const isSelected = (mod && mod.icon === 'emoji:'+icon) || (!mod && i === 0 && !mod?.icon?.startsWith('data:') && !mod?.icon?.startsWith('upload:'));
              return `<span class="mod-icon-option ${isSelected ? 'selected' : ''}" data-icon="${icon}" onclick="App.selectModuleIcon('emoji:${icon}')" style="cursor:pointer;font-size:28px;padding:4px;border-radius:8px;${isSelected ? 'background:var(--primary-light);' : ''}">${icon}</span>`;
            }).join('')}
            <label class="mod-icon-option" style="cursor:pointer;font-size:28px;padding:4px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:2px dashed var(--text-light);color:var(--text-secondary);" title="上传自定义图片">
              📷
              <input type="file" accept="image/*" onchange="App.uploadModuleIcon(event)" style="display:none;">
            </label>
            ${mod && mod.icon && (mod.icon.startsWith('data:') || mod.icon.startsWith('upload:')) ? `
            <span class="mod-icon-option selected" style="padding:2px;border-radius:8px;background:var(--primary-light);position:relative;" onclick="App.selectModuleIcon('${mod.icon}')">
              <img src="${mod.icon.startsWith('upload:') ? 'uploads/' + mod.icon.replace('upload:','') : mod.icon}" style="width:32px;height:32px;object-fit:contain;border-radius:6px;display:block;">
            </span>` : ''}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">预算金额 *</label>
          <input type="number" class="form-input" id="mod-amount" value="${mod ? mod.budget_amount : ''}" placeholder="0.00" step="0.01">
        </div>
        <div class="form-group">
          <label class="form-label">周期</label>
          <select class="form-input" id="mod-period">
            <option value="monthly" ${mod && mod.period_type === 'monthly' ? 'selected' : ''}>每月</option>
            <option value="weekly" ${mod && mod.period_type === 'weekly' ? 'selected' : ''}>每周</option>
            <option value="none" ${mod && mod.period_type === 'none' ? 'selected' : ''}>不限周期</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <input type="text" class="form-input" id="mod-remark" value="${this.escapeHtml(mod ? mod.remark || '' : '')}" placeholder="可选备注">
        </div>
        <input type="hidden" id="mod-icon" value="${mod && mod.icon ? mod.icon : 'emoji:📦'}">
      </div>
      <div class="modal-footer">
        ${mod ? '<button class="btn btn-danger btn-sm" onclick="App.deleteModule(' + mod.id + ')" style="margin-right:auto;">删除</button>' : ''}
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">取消</button>
        <button class="btn btn-primary btn-sm" onclick="App.saveModule(${mod ? mod.id : 'null'})">保存</button>
      </div>`;
    this.showModal(html);
  },

  // 资金模块可选图标（资金/生活相关，统一在此维护）
  moduleIconList() {
    return ['📦','🎁','📂','🗂️','🏷️','💰','💵','💴','💳','🪙','🏦','💎','📈','📊','💼','💡','🏠','🚗','⛽','✈️','🏖️','🛒','🛍️','👕','☕','🍔','🥗','📱','💻','📚','🎬','💊','🐱','🌺','🎨','🎵','💍','🧸','🎂','🔑','📷','🎮','🏀','👟'];
  },

  selectModuleIcon(icon) {
    document.getElementById('mod-icon').value = icon;
    const spans = document.querySelectorAll('#mod-icon-selector span');
    spans.forEach(s => {
      s.classList.remove('selected');
      s.style.background = '';
      // Check if this span matches the selected icon
      const ic = s.getAttribute('data-icon');
      if (ic && (icon === 'emoji:' + ic)) {
        s.classList.add('selected');
        s.style.background = 'var(--primary-light)';
      }
      // Check for uploaded image span (has img child)
      const img = s.querySelector('img');
      if (img && icon === s.getAttribute('onclick')?.match(/'([^']+)'/)?.[1]) {
        s.classList.add('selected');
        s.style.background = 'var(--primary-light)';
      }
    });
  },

  async uploadModuleIcon(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.toast('请选择图片文件'); return; }
    if (file.size > 5 * 1024 * 1024) { this.toast('图片不能超过 5MB'); return; }

    try {
      const formData = new FormData();
      formData.append('icon', file);
      const res = await fetch('/api/upload-icon', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '上传失败');

      // Add uploaded image preview to selector
      const selector = document.getElementById('mod-icon-selector');
      const previewSpan = document.createElement('span');
      previewSpan.className = 'mod-icon-option selected';
      previewSpan.style.cssText = 'padding:2px;border-radius:8px;background:var(--primary-light);position:relative;cursor:pointer;';
      previewSpan.setAttribute('onclick', `App.selectModuleIcon('upload:${data.filename}')`);
      previewSpan.innerHTML = `<img src="${data.url}" style="width:32px;height:32px;object-fit:contain;border-radius:6px;display:block;">`;
      
      // Remove selection from others
      selector.querySelectorAll('span').forEach(s => { s.classList.remove('selected'); s.style.background = ''; });
      selector.appendChild(previewSpan);

      document.getElementById('mod-icon').value = 'upload:' + data.filename;
      this.toast('图标已上传');
    } catch (err) {
      this.toast(err.message || '上传失败');
    }
    // Reset input so same file can be re-selected
    event.target.value = '';
  },

  async saveModule(editId) {
    const name = document.getElementById('mod-name').value.trim();
    const amount = parseFloat(document.getElementById('mod-amount').value);
    const icon = document.getElementById('mod-icon').value;
    const period = document.getElementById('mod-period').value;
    const remark = document.getElementById('mod-remark').value.trim();

    if (!name) { this.toast('请输入模块名称'); return; }
    if (!amount || amount <= 0) { this.toast('请输入有效的预算金额'); return; }

    try {
      if (editId) {
        await API.updateModule(editId, { name, icon, budget_amount: amount, period_type: period, remark });
        this.toast('模块修改成功 🐰');
      } else {
        await API.createModule({ name, icon, budget_amount: amount, period_type: period, remark });
        this.toast('资金模块创建成功！🐰');
      }
      closeModal();
      this.renderModules();
    } catch (err) {
      this.toast(err.message);
    }
  },

  async deleteModule(id) {
    if (!confirm('确定要删除这个资金模块吗？删除后相关数据将一并清除。')) return;
    try {
      await API.deleteModule(id);
      this.toast('模块已删除 🐰');
      closeModal();
      if (window.location.hash.startsWith('#/module-detail')) {
        window.location.hash = '#/modules';
      } else {
        this.renderModules();
      }
    } catch (err) {
      this.toast(err.message);
    }
  },

  async renderModuleDetail() {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const id = parseInt(params.get('id'));
    if (!id) { window.location.hash = '#/modules'; return; }

    const container = document.getElementById('page-container');
    container.innerHTML = `<div class="page-header"><div class="page-header-left"><a href="#/modules" class="back-btn">←</a></div><h1>模块详情</h1><div></div></div><div class="page-content">${this.loadingHtml()}</div>`;

    try {
      const [modData, billsData] = await Promise.all([
        API.getModule(id),
        API.getBills({ fund_module_id: id, limit: 30 })
      ]);

      const m = modData.module;
      const remaining = m.remaining_amount;
      const progress = m.progress;

      container.innerHTML = `
        <div class="page-header">
          <div class="page-header-left"><a href="#/modules" class="back-btn">←</a></div>
          <h1>模块详情</h1>
          <button class="btn btn-outline btn-xs" onclick="App.goAddModule(${m.id})">编辑</button>
          <button class="btn btn-danger btn-xs" onclick="App.deleteModule(${m.id})">删除</button>
        </div>
        <div class="page-content">
          <div class="card" style="text-align:center;padding:24px;">
            <div style="width:96px;height:96px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;">${(() => {
              if (m.icon && m.icon.startsWith('upload:')) return `<img src="uploads/${m.icon.replace('upload:','')}" style="width:80px;height:80px;object-fit:contain;border-radius:12px;">`;
              if (m.icon && m.icon.startsWith('emoji:')) return m.icon.replace('emoji:','');
              return '📦';
            })()}</div>
            <h2 style="font-size:20px;margin:8px 0;">${this.escapeHtml(m.name)}</h2>
            <div style="font-size:14px;color:var(--text-secondary);">${m.period_type === 'weekly' ? '每周' : m.period_type === 'monthly' ? '每月' : '不限周期'}</div>
          </div>

          <div class="stats-row mt-12">
            <div class="stat-card"><div class="stat-label">预算</div><div class="stat-value" style="color:var(--text)">¥${this.formatNum(m.budget_amount)}</div></div>
            <div class="stat-card expense"><div class="stat-label">已用</div><div class="stat-value">¥${this.formatNum(m.spent_amount)}</div></div>
            <div class="stat-card balance"><div class="stat-label">剩余</div><div class="stat-value">¥${this.formatNum(remaining)}</div></div>
          </div>

          <div class="card mt-12">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:13px;color:var(--text-secondary);">使用进度</span>
              <span style="font-size:13px;font-weight:600;">${progress}%</span>
            </div>
            <div class="progress-bar" style="height:10px;">
              <div class="progress-fill ${progress > 80 ? 'danger' : progress > 60 ? 'warning' : 'ok'}" style="width:${Math.min(progress, 100)}%"></div>
            </div>
          </div>

          <div class="section-title mt-16">相关账单 (${billsData.bills.length}条)</div>
          ${billsData.bills.length > 0 ? billsData.bills.map(b => this.renderBillItem(b)).join('')
            : `<div class="empty-state" style="padding:24px;"><p>暂无相关账单</p></div>`}
        </div>`;
    } catch (err) {
      container.innerHTML = `<div class="page-header"><a href="#/modules" class="back-btn">←</a></div><div class="page-content"><p style="text-align:center;padding:40px;">加载失败</p></div>`;
    }
  },

  // ==================== 统计页面（年/月/日三维） ====================
  async renderStats() {
    const container = document.getElementById('page-container');
    const dim = this.state.statsDim;
    const y = this.state.statsYear;
    const m = this.state.statsMonth;
    container.innerHTML = `<div class="page-header"><div class="page-header-left"><a href="#/home" class="back-btn">←</a></div><h1>📊 统计</h1><div></div></div>
      <div class="page-content">${this.loadingHtml()}</div>`;
    try {
      if (dim === 'year') await this._renderStatsYear(container, y);
      else if (dim === 'month') await this._renderStatsMonth(container, y, m);
      else await this._renderStatsDay(container, y, m);
    } catch (err) {
      console.error(err);
      container.innerHTML = `<div class="page-header"><div class="page-header-left"><a href="#/home" class="back-btn">←</a></div><h1>📊 统计</h1></div>
        <div class="page-content"><p style="text-align:center;padding:40px;">加载失败，请刷新重试</p></div>`;
    }
  },
  switchStatsDim(dim) { this.state.statsDim = dim; this.renderStats(); },
  changeStatsYear(diff) { this.state.statsYear += diff; this.renderStats(); },
  changeStatsMonth(diff) {
    let m = this.state.statsMonth + diff, y = this.state.statsYear;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    this.state.statsMonth = m; this.state.statsYear = y; this.renderStats();
  },
  pickStatsDay(dateStr) { this.state.statsDay = dateStr; this.renderStats(); },

  // ---- 年度视图渲染 ----
  async _renderStatsYear(container, year) {
    var data;
    try { data = await API.getYearlyStats(year); } catch(e) {
      container.innerHTML = '<div class="page-header"><div class="page-header-left"><a href="#/home" class="back-btn">←</a></div><h1>📊 统计</h1></div>'
        + '<div class="page-content"><p style="text-align:center;padding:40px;color:var(--danger);">年度数据加载失败：' + (e.message || '网络错误') + '</p></div>';
      return;
    }
    if (!data || !data.monthlyData) {
      container.innerHTML = '<div class="page-header"><div class="page-header-left"><a href="#/home" class="back-btn">←</a></div><h1>📊 统计</h1></div>'
        + '<div class="page-content"><p style="text-align:center;padding:40px;color:var(--text-light);">暂无年度数据</p></div>';
      return;
    }

    var self = this;
    var chartHtml = '';
    try { chartHtml = self.buildYearBarChart(data.monthlyData, year); } catch(chartErr) { console.error('buildYearBarChart:', chartErr); chartHtml = '<p style="text-align:center;color:var(--text-light);padding:16px;">图表生成失败</p>'; }

    var topExpHtml = '';
    if (data.topCategories && data.topCategories.length > 0) {
      topExpHtml = '<div class="rank-list">';
      data.topCategories.forEach(function(c, i) {
        var bg = i < 3 ? (i === 0 ? 'var(--primary)' : i === 1 ? '#FFC36B' : '#7FC8A9') : 'var(--bg-secondary)';
        var fg = i < 3 ? '#fff' : 'var(--text-secondary)';
        topExpHtml += '<div class="rank-item" onclick="App.showCategoryBills(' + c.id + ',\'' + self.escapeHtml(c.name) + '\')">'
          + '<span class="rank-index" style="background:' + bg + ';color:' + fg + '">' + (i+1) + '</span>'
          + '<span class="rank-name">' + self.escapeHtml(c.name) + '</span>'
          + '<span class="rank-amount">¥' + self.formatNum(c.total || 0) + '</span>'
          + '<span class="rank-pct">' + (c.percent || 0) + '%</span></div>';
      });
      topExpHtml += '</div>';
    } else {
      topExpHtml = '<p style="text-align:center;color:var(--text-light);padding:16px;">暂无支出记录</p>';
    }

    var topIncHtml = '';
    if (data.topIncomeCategories && data.topIncomeCategories.length > 0) {
      topIncHtml = '<div class="rank-list">';
      data.topIncomeCategories.forEach(function(c, i) {
        var bg = i < 3 ? 'var(--accent-green)' : 'var(--bg-secondary)';
        var fg = i < 3 ? '#fff' : 'var(--text-secondary)';
        topIncHtml += '<div class="rank-item">'
          + '<span class="rank-index" style="background:' + bg + ';color:' + fg + '">' + (i+1) + '</span>'
          + '<span class="rank-name">' + self.escapeHtml(c.name) + '</span>'
          + '<span class="rank-amount" style="color:var(--accent-green)">¥' + self.formatNum(c.total || 0) + '</span>'
          + '<span class="rank-pct">' + (c.percent || 0) + '%</span></div>';
      });
      topIncHtml += '</div>';
    } else {
      topIncHtml = '<p style="text-align:center;color:var(--text-light);padding:16px;">暂无收入记录</p>';
    }

    container.innerHTML =
      '<div class="page-header stats-header">'
        + '<div class="page-header-left"><a href="#/home" class="back-btn">←</a></div>'
        + '<h1>📊 统计</h1>'
        + '<div style="display:flex;align-items:center;gap:8px;">'
          + '<button class="btn btn-ghost btn-sm" onclick="App.changeStatsYear(-1)">◀</button>'
          + '<span style="font-size:15px;font-weight:700;">' + year + ' 年度</span>'
          + '<button class="btn btn-ghost btn-sm" onclick="App.changeStatsYear(1)">▶</button>'
        + '</div>'
      + '</div>'
      + '<div class="stats-dim-tabs">'
        + '<button class="filter-chip ' + (self.state.statsDim==='year'?'active':'') + '" onclick="App.switchStatsDim(\'year\')">📅 年度</button>'
        + '<button class="filter-chip ' + (self.state.statsDim==='month'?'active':'') + '" onclick="App.switchStatsDim(\'month\')">📆 月度</button>'
        + '<button class="filter-chip ' + (self.state.statsDim==='day'?'active':'') + '" onclick="App.switchStatsDim(\'day\')">📌 日度</button>'
      + '</div>'
      + '<div class="page-content">'
        + '<div class="stats-row stats-page">'
          + '<div class="stat-card income"><div class="stat-label">全年收入</div><div class="stat-value">¥' + self.formatNum(data.totalIncome || 0) + '</div></div>'
          + '<div class="stat-card expense"><div class="stat-label">全年支出</div><div class="stat-value">¥' + self.formatNum(data.totalExpense || 0) + '</div></div>'
          + '<div class="stat-card balance"><div class="stat-label">全年结余</div><div class="stat-value">' + ((data.balance||0)>=0?'':'-') + '¥' + self.formatNum(Math.abs(data.balance||0)) + '</div></div>'
          + '<div class="stat-card" style="background:var(--bg-card);border-radius:12px;padding:12px;"><div class="stat-label">记账笔数</div><div class="stat-value" style="font-size:18px;">' + (data.totalCount || 0) + ' 笔</div></div>'
        + '</div>'
        + '<div class="chart-section"><div class="chart-title">月度收支趋势</div>' + chartHtml + '</div>'
        + '<div class="chart-section"><div class="chart-title">收支趋势（折线）</div>' + self.buildYearLineChart(data.monthlyData) + '</div>'
        + '<div class="chart-section"><div class="chart-title">年度支出 TOP 分类</div>' + topExpHtml + '</div>'
        + '<div class="chart-section"><div class="chart-title">年度收入 TOP 分类</div>' + topIncHtml + '</div>'
      + '</div>';
  },

  // ---- 月度视图渲染（增强版） ----
  async _renderStatsMonth(container, year, month) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const [overview, daily, catExp, catInc, modStats, prevOverview] = await Promise.all([
      API.getStatsOverview(year, month), API.getDailyStats(year, month),
      API.getCategoryExpenseStats(year, month), API.getCategoryIncomeStats(year, month),
      API.getModuleStats(year, month),
      API.getStatsOverview(prevYear, prevMonth)
    ]);

    const selfCmp = this;
    const cmpRow = function(label, curV, prevV, goodWhenUp) {
      const diff = (curV || 0) - (prevV || 0);
      const eq = diff === 0;
      const up = diff > 0;
      const pct = (prevV && prevV !== 0) ? Math.round(Math.abs(diff) / Math.abs(prevV) * 100) : (diff !== 0 ? 100 : 0);
      const good = eq ? true : (up === goodWhenUp);
      const cls = eq ? 'flat' : (good ? 'good' : 'bad');
      const arrow = eq ? '—' : (up ? '▲' : '▼');
      return '<div class="mc-row">'
        + '<span class="mc-label">' + label + '</span>'
        + '<span class="mc-cur">¥' + selfCmp.formatNum(curV || 0) + '</span>'
        + '<span class="mc-prev">上月 ¥' + selfCmp.formatNum(prevV || 0) + '</span>'
        + '<span class="mc-delta ' + cls + '">' + arrow + (eq ? '' : ' ' + Math.abs(pct) + '%') + '</span>'
        + '</div>';
    };
    const monthCompareHtml = '<div class="chart-section month-compare">'
      + '<div class="chart-title">📊 月度对比（' + prevYear + '年' + prevMonth + '月 → ' + year + '年' + month + '月）</div>'
      + cmpRow('收入', overview.income, prevOverview && prevOverview.income, true)
      + cmpRow('支出', overview.expense, prevOverview && prevOverview.expense, false)
      + cmpRow('结余', overview.balance, prevOverview && prevOverview.balance, true)
      + '</div>';

    container.innerHTML = `
      <div class="page-header stats-header">
        <div class="page-header-left"><a href="#/home" class="back-btn">←</a></div>
        <h1>📊 统计</h1>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="btn btn-ghost btn-sm" onclick="App.changeStatsMonth(-1)">◀</button>
          <span style="font-size:14px;font-weight:600;">${year}年${month}月</span>
          <button class="btn btn-ghost btn-sm" onclick="App.changeStatsMonth(1)">▶</button>
        </div>
      </div>
      <div class="stats-dim-tabs">
        <button class="filter-chip ${this.state.statsDim==='year'?'active':''}" onclick="App.switchStatsDim('year')">📅 年度</button>
        <button class="filter-chip ${this.state.statsDim==='month'?'active':''}" onclick="App.switchStatsDim('month')">📆 月度</button>
        <button class="filter-chip ${this.state.statsDim==='day'?'active':''}" onclick="App.switchStatsDim('day')">📌 日度</button>
      </div>
      <div class="page-content">
        ${monthCompareHtml}
        <div class="stats-row stats-page">
          <div class="stat-card income"><div class="stat-label">收入</div><div class="stat-value">¥${this.formatNum(overview.income)}</div></div>
          <div class="stat-card expense"><div class="stat-label">支出</div><div class="stat-value">¥${this.formatNum(overview.expense)}</div></div>
          <div class="stat-card balance"><div class="stat-label">结余</div><div class="stat-value">¥${this.formatNum(overview.balance)}</div></div>
        </div>
        ${overview.compareRatio !== 0 ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">较上月 ${overview.compareRatio > 0 ? '<span class=\"compare-badge up\">📈 +' + overview.compareRatio + '%' : '<span class=\"compare-badge down\">📉 ' + overview.compareRatio + '%'}` : ''}
        <div class="stats-charts-grid">
        <div class="chart-section"><div class="chart-title">每日收支趋势</div>${this.buildDualLineChart(daily.dailyData, daily.dailyIncome || [], year, month)}</div>
        <div class="chart-section">
          <div class="chart-title">支出分类占比</div>
          ${catExp.categoryData.length > 0 ? `${(() => { const segs = catExp.categoryData.slice(0,9).map((c,i) => ({label:c.name,value:c.total,color:this.chartColor(i)})); if(catExp.categoryData.length>9){const o=catExp.categoryData.slice(9).reduce((s,c)=>s+c.total,0);segs.push({label:'其他',value:o,color:this.chartColor(9)});} return this.buildDonutChart(segs,'¥'+this.formatNum(catExp.totalExpense)); })()}
            <div class="pie-legend">${catExp.categoryData.slice(0,10).map(c=>`<div class="pie-legend-item" onclick="App.showCategoryBills(${c.id},'${this.escapeHtml(c.name)}')"><span class="pie-legend-dot" style="background:${this.getPieColor(catExp.categoryData.indexOf(c))}"></span><span class="pie-legend-name">${c.icon} ${this.escapeHtml(c.name)}</span><span class="pie-legend-amount">¥${this.formatNum(c.total)}</span><span class="pie-legend-percent">${c.percent}%</span></div>`).join('')}</div>`
          : '<p style="text-align:center;color:var(--text-light);padding:16px;">本月暂无支出</p>'}
        </div>
        <div class="chart-section">
          <div class="chart-title">收入分类占比</div>
          ${catInc.categoryData.length > 0 ? `${(() => { const segs = catInc.categoryData.slice(0,9).map((c,i) => ({label:c.name,value:c.total,color:this.chartColor(i)})); if(catInc.categoryData.length>9){const o=catInc.categoryData.slice(9).reduce((s,c)=>s+c.total,0);segs.push({label:'其他',value:o,color:this.chartColor(9)});} return this.buildDonutChart(segs,'¥'+this.formatNum(catInc.totalIncome)); })()}
            <div class="pie-legend">${catInc.categoryData.slice(0,10).map(c=>`<div class="pie-legend-item"><span class="pie-legend-dot" style="background:${this.getPieColor(catInc.categoryData.indexOf(c))}"></span><span class="pie-legend-name">${c.icon} ${this.escapeHtml(c.name)}</span><span class="pie-legend-amount">¥${this.formatNum(c.total)}</span><span class="pie-legend-percent">${c.percent}%</span></div>`).join('')}</div>`
          : '<p style="text-align:center;color:var(--text-light);padding:16px;">本月暂无收入</p>'}
        </div>
        <div class="chart-section">
          <div class="chart-title">资金模块使用情况</div>
          ${modStats.moduleData.length ? modStats.moduleData.map(m => { const me=this.moduleIconList(); let ih; if(m.icon&&m.icon.startsWith('upload:')) ih=`<img src=\"uploads/${m.icon.replace('upload:')}\" style=\"width:20px;height:20px;object-fit:contain;border-radius:4px;\">`; else if(m.icon&&m.icon.startsWith('emoji:')) ih=`<span style=\"font-size:20px;\">${m.icon.replace('emoji:','')}</span>`; else ih=`<span style=\"font-size:20px;\">${me[(m.id||0)%me.length]}</span>`; const cl=m.progress>80?'danger':m.progress>60?'warning':'ok'; const rem=m.budget_amount-m.total_spent; return `<div class=\"module-ring-row\"><div class=\"module-ring\">${this.buildRingChart(m.progress,cl)}</div><div class=\"module-ring-info\"><div class=\"module-ring-name\">${ih} ${this.escapeHtml(m.name)}</div><div class=\"module-ring-amount\">¥${this.formatNum(m.total_spent)} / ¥${this.formatNum(m.budget_amount)}</div><div class=\"module-ring-remaining ${rem<0?'danger':'ok'}\">${rem<0?'已超支 ¥'+this.formatNum(-rem):'剩余 ¥'+this.formatNum(rem)}</div></div></div>`; }).join('') : '<p style="text-align:center;color:var(--text-light);">暂无资金模块</p>'}
        </div>
        </div>
      </div>`;
  },

  // ---- 日度视图渲染 ----
  async _renderStatsDay(container, year, month) {
    const day = this.state.statsDay || new Date().toISOString().split('T')[0];
    const [billsRes, dailyAll] = await Promise.all([API.getBills({limit:200}), API.getDailyStats(year, month)]);
    const dayBills = (billsRes.bills||[]).filter(b=>b.date===day);
    const expB = dayBills.filter(b=>b.type==='expense'), incB = dayBills.filter(b=>b.type==='income');
    const dExp = expB.reduce((s,b)=>s+b.amount,0), dInc = incB.reduce((s,b)=>s+b.amount,0);
    const datesWithBills = new Set([...(dailyAll.dailyData||[]).map(d=>d.date), ...(dailyAll.dailyIncome||[]).map(d=>d.date)]);
    const endDay = new Date(year,month,0).getDate();

    // Build calendar days separately to avoid nested template literal issues
    let calendarHtml = '';
    for (let i = 1; i <= endDay; i++) {
      const ds = year + '-' + String(month).padStart(2,'0') + '-' + String(i).padStart(2,'0');
      const hb = datesWithBills.has(ds);
      const isToday = ds === day;
      const isF = new Date(ds) > new Date();
      const cls = 'day-dot' + (isToday ? ' day-active' : '') + (hb ? ' day-has-bill' : '') + (isF ? ' day-future' : '');
      const dis = isF ? ' disabled' : '';
      calendarHtml += '<button class="' + cls + '" onclick="App.pickStatsDay(\'' + ds + '\')"' + dis + ' title="' + ds + '">' + i + '</button>';
    }

    // Build expense list
    let expListHtml = '';
    if (expB.length > 0) {
      expListHtml = '<div class="chart-section"><div class="chart-title">📝 支出明细 (' + expB.length + ')</div><div class="day-bill-list">';
      expB.forEach(function(b) {
        var icon = b.category_icon || '📝';
        var remark = App.escapeHtml(b.remark || b.category_name || '无备注');
        var catName = b.category_name || '';
        var modName = b.fund_module_name ? ' · 📦' + b.fund_module_name : '';
        expListHtml += '<div class="bill-item" style="background:var(--bg-secondary);margin-bottom:6px;"><div class="bill-icon">' + icon + '</div><div class="bill-info"><div style="font-size:14px;">' + remark + '</div><div class="bill-meta">' + catName + modName + '</div></div><div class="bill-item expense">-¥' + App.formatNum(b.amount) + '</div></div>';
      });
      expListHtml += '<div style="text-align:right;padding:4px;font-weight:600;font-size:14px;color:var(--primary);">合计 ¥' + App.formatNum(dExp) + '</div></div></div>';
    }

    // Build income list
    let incListHtml = '';
    if (incB.length > 0) {
      incListHtml = '<div class="chart-section"><div class="chart-title">💰 收入明细 (' + incB.length + ')</div><div class="day-bill-list">';
      incB.forEach(function(b) {
        var icon = b.category_icon || '💰';
        var remark = App.escapeHtml(b.remark || b.category_name || '无备注');
        var catName = b.category_name || '';
        incListHtml += '<div class="bill-item" style="background:var(--bg-secondary);margin-bottom:6px;"><div class="bill-icon">' + icon + '</div><div class="bill-info"><div style="font-size:14px;">' + remark + '</div><div class="bill-meta">' + catName + '</div></div><div class="bill-amount" style="color:var(--accent-green)">+¥' + App.formatNum(b.amount) + '</div></div>';
      });
      incListHtml += '<div style="text-align:right;padding:4px;font-weight:600;font-size:14px;color:var(--accent-green);">合计 ¥' + App.formatNum(dInc) + '</div></div></div>';
    }

    var emptyTip = dayBills.length === 0 ? '<p style="text-align:center;color:var(--text-light);padding:32px;">当天暂无记账记录</p>' : '';

    container.innerHTML =
      '<div class="page-header stats-header">'
        + '<div class="page-header-left"><a href="#/home" class="back-btn">←</a></div>'
        + '<h1>📊 统计</h1>'
        + '<div style="display:flex;align-items:center;gap:6px;">'
          + '<input type="date" class="form-input stats-date-picker" value="' + day + '" min="' + year + '-' + String(month).padStart(2,'0') + '-01" max="' + year + '-' + String(month).padStart(2,'0') + '-' + endDay + '" onchange="App.pickStatsDay(this.value)" style="font-size:13px;padding:4px 8px;width:auto;">'
        + '</div>'
      + '</div>'
      + '<div class="stats-dim-tabs">'
        + '<button class="filter-chip ' + (this.state.statsDim==='year'?'active':'') + '" onclick="App.switchStatsDim(\'year\')">📅 年度</button>'
        + '<button class="filter-chip ' + (this.state.statsDim==='month'?'active':'') + '" onclick="App.switchStatsDim(\'month\')">📆 月度</button>'
        + '<button class="filter-chip ' + (this.state.statsDim==='day'?'active':'') + '" onclick="App.switchStatsDim(\'day\')">📌 日度</button>'
      + '</div>'
      + '<div class="page-content">'
        + '<div class="stats-row stats-page">'
          + '<div class="stat-card income"><div class="stat-label">当日收入</div><div class="stat-value">¥' + this.formatNum(dInc) + '</div><div style="font-size:11px;color:var(--text-light);margin-top:2px;">' + incB.length + ' 笔</div></div>'
          + '<div class="stat-card expense"><div class="stat-label">当日支出</div><div class="stat-value">¥' + this.formatNum(dExp) + '</div><div style="font-size:11px;color:var(--text-light);margin-top:2px;">' + expB.length + ' 笔</div></div>'
          + '<div class="stat-card balance"><div class="stat-label">当日结余</div><div class="stat-value">' + (dInc-dExp>=0?'':'-') + '¥' + this.formatNum(Math.abs(dInc-dExp)) + '</div></div>'
        + '</div>'
        + '<div class="chart-section">'
          + '<div class="chart-title">' + year + '年' + month + '月 记账日历</div>'
          + '<div class="day-calendar">' + calendarHtml + '</div>'
          + '<div style="display:flex;gap:12px;font-size:11px;color:var(--text-light);margin-top:6px;"><span>● 有记账</span><span>○ 无记录</span><span style="background:var(--primary);color:#fff;padding:0 4px;border-radius:3px;">选中</span></div>'
        + '</div>'
        + expListHtml
        + incListHtml
        + emptyTip
      + '</div>';
  },

  async showCategoryBills(catId, catName) {
    try {
      const data = await API.getBillsByCategory(catId);
      let html = `<div class="modal-header"><h3 class="modal-title">${catName} 账单明细</h3><button class="modal-close" onclick="closeModal()">✕</button></div>`;
      html += `<div class="modal-body">`;
      if (data.bills.length > 0) {
        html += data.bills.map(b => `
          <div class="bill-item" style="background:var(--bg-secondary);margin-bottom:6px;cursor:default;">
            <div class="bill-icon">${b.category_icon}</div>
            <div class="bill-info">
              <div style="font-size:14px;">${b.date}</div>
              <div class="bill-meta">${this.escapeHtml(b.remark || '无备注')}</div>
            </div>
            <div class="bill-amount expense">-¥${this.formatNum(b.amount)}</div>
          </div>`).join('');
        html += `<div style="text-align:right;padding:8px;font-weight:600;">合计：¥${this.formatNum(data.bills.reduce((s,b)=>s+b.amount,0))}</div>`;
      } else {
        html += `<p style="text-align:center;padding:24px;color:var(--text-secondary);">暂无记录</p>`;
      }
      html += `</div>`;
      this.showModal(html);
    } catch (err) {
      this.toast('加载失败');
    }
  },

  chartColor(i) {
    const p = ['#FF9FB5', '#FFC36B', '#7FC8A9', '#6FB1E8', '#C9A7EB', '#FF8A80', '#80DEEA', '#F6A5C0', '#A5D6A7', '#FFCC80', '#B0BEC5', '#F8BBD0'];
    return p[i % p.length];
  },

  getPieColor(index) {
    return this.chartColor(index);
  },

  // 折线图（每日支出趋势）
  buildLineChart(dailyData, year, month) {
    if (!dailyData || dailyData.length === 0) {
      return '<div style="text-align:center;color:var(--text-light);padding:24px;">本月暂无支出记录</div>';
    }
    const endDay = new Date(year, month, 0).getDate();
    const map = {};
    dailyData.forEach(d => { map[parseInt(d.date.split('-')[2], 10)] = d.total; });
    const vals = [];
    for (let day = 1; day <= endDay; day++) vals.push(map[day] || 0);
    const n = vals.length;
    const W = 360, H = 160, padL = 12, padR = 12, padT = 20, padB = 22;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxV = Math.max(...vals, 1);
    const xAt = i => (n === 1 ? padL + plotW / 2 : padL + i * (plotW / (n - 1)));
    const yAt = v => padT + (1 - v / maxV) * plotH;
    const linePath = 'M ' + vals.map((v, i) => `${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(' L ');
    const areaPath = `M ${xAt(0).toFixed(1)} ${(padT + plotH).toFixed(1)} ` +
      vals.map((v, i) => `L ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(' ') +
      ` L ${xAt(n - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;
    const dots = vals.map((v, i) =>
      `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="2.6" fill="#fff" stroke="var(--primary)" stroke-width="2"></circle>`
    ).join('');
    const showDays = [...new Set([1, Math.round(n / 2), n])];
    const labels = showDays.map(d =>
      `<text x="${xAt(d - 1).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--text-light)">${d}</text>`
    ).join('');
    const ymax = `<text x="${padL}" y="${padT - 7}" font-size="10" fill="var(--text-light)">¥${this.formatNum(maxV)}</text>`;
    return `<svg class="line-chart-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${ymax}
      <path d="${areaPath}" fill="var(--primary)" opacity="0.12"></path>
      <path d="${linePath}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></path>
      ${dots}
      ${labels}
    </svg>`;
  },

  // 环形图（分类占比）
  buildDonutChart(segments, centerText) {
    const size = 180, cx = 90, cy = 90, r = 64, sw = 26;
    const C = 2 * Math.PI * r;
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    let offset = 0;
    let arcs = '';
    segments.forEach(seg => {
      const len = (seg.value / total) * C;
      arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
      offset += len;
    });
    return `<div class="donut-wrap"><svg class="donut-svg" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${sw}"></circle>
      ${arcs}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="13" fill="var(--text-secondary)">总支出</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="15" font-weight="700" fill="var(--text)">${centerText}</text>
    </svg></div>`;
  },

  // 进度环（资金模块预算）
  buildRingChart(percent, colorClass) {
    const size = 64, c = 32, r = 26, sw = 7;
    const C = 2 * Math.PI * r;
    const p = Math.min(Math.max(percent, 0), 100) / 100;
    const len = p * C;
    const color = colorClass === 'danger' ? 'var(--danger)' : colorClass === 'warning' ? 'var(--warning)' : 'var(--accent-green)';
    return `<svg class="ring-svg" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${sw}"></circle>
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"
        stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" transform="rotate(-90 ${c} ${c})"></circle>
      <text x="${c}" y="${c + 4}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text)">${Math.round(percent)}%</text>
    </svg>`;
  },

  // 年度收支柱状图（分组柱：收入+支出）
  buildYearBarChart(monthlyData, year) {
    if (!monthlyData || monthlyData.length === 0) return '<p style="text-align:center;color:var(--text-light);padding:24px;">暂无数据</p>';
    var W = 700, H = 220, padL = 30, padR = 12, padT = 20, padB = 30;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var maxV = Math.max.apply(null, monthlyData.map(function(d){return Math.max(d.income||0, d.expense||0);}));
    if (maxV < 1) maxV = 1;
    var barW = Math.max(8, Math.min(20, (plotW / 12) * 0.55));
    var gap = (plotW - barW * 2 * 12) / 13;
    var self = this;
    var yAt = function(v) { return padT + (1 - v / maxV) * plotH; };
    var bars = '', labels = '', gridLines = '';
    for (var i = 0; i < 12; i++) {
      var d = monthlyData[i] || {};
      var incH = ((d.income || 0) / maxV) * plotH;
      var expH = ((d.expense || 0) / maxV) * plotH;
      var bx = padL + gap + i * (barW * 2 + gap);
      bars += '<rect x="' + bx + '" y="' + (padT + plotH - incH) + '" width="' + barW + '" height="' + incH + '" fill="var(--accent-green)" rx="2" opacity="0.85"></rect>';
      bars += '<rect x="' + (bx + barW) + '" y="' + (padT + plotH - expH) + '" width="' + barW + '" height="' + expH + '" fill="var(--primary)" rx="2" opacity="0.85"></rect>';
      if (i % 3 === 0) labels += '<text x="' + (bx + barW) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="var(--text-light)">' + (i+1) + '月</text>';
    }
    // Y轴网格线
    [0.25, 0.5, 0.75, 1].forEach(function(tick) {
      var yv = yAt(tick * maxV);
      gridLines += '<line x1="' + padL + '" y1="' + yv + '" x2="' + (W - padR) + '" y2="' + yv + '" stroke="var(--border)" stroke-width="0.5" opacity="0.5"></line>';
      gridLines += '<text x="' + (padL - 4) + '" y="' + (yv + 3) + '" text-anchor="end" font-size="9" fill="var(--text-light)">¥' + self.formatNum(tick * maxV) + '</text>';
    });
    return '<svg class="line-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">'
      + gridLines
      + bars
      + labels
      + '<g transform="translate(' + (W/2) + ', ' + (H-14) + ')"><rect x="-28" y="-10" width="56" height="16" rx="3" fill="var(--accent-green)" opacity="0.15"></rect><text x="0" y="2" text-anchor="middle" font-size="9" fill="var(--accent-green)">■ 收入</text></g>'
      + '<g transform="translate(' + (W/2+60) + ', ' + (H-14) + ')"><rect x="-28" y="-10" width="56" height="16" rx="3" fill="var(--primary)" opacity="0.15"></rect><text x="0" y="2" text-anchor="middle" font-size="9" fill="var(--primary)">■ 支出</text></g>'
      + '</svg>';
  },

  // 年度收支趋势折线图（12个月 收入+支出双折线）
  buildYearLineChart(monthlyData) {
    if (!monthlyData || monthlyData.length === 0) return '<p style="text-align:center;color:var(--text-light);padding:24px;">暂无数据</p>';
    var months = 12;
    var incVals = [], expVals = [];
    for (var i = 0; i < months; i++) { var d = monthlyData[i] || {}; incVals.push(d.income || 0); expVals.push(d.expense || 0); }
    var W = 700, H = 200, padL = 30, padR = 12, padT = 18, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var maxV = Math.max.apply(null, incVals.concat(expVals).concat([1]));
    var xAt = function(i) { return padL + i * (plotW / (months - 1)); };
    var yAt = function(v) { return padT + (1 - v / maxV) * plotH; };
    var mkPath = function(vals) {
      var pts = [];
      for (var pi = 0; pi < vals.length; pi++) pts.push(xAt(pi).toFixed(1) + ' ' + yAt(vals[pi]).toFixed(1));
      return 'M ' + pts.join(' L ');
    };
    var mkArea = function(vals, color) {
      var p = 'M ' + xAt(0).toFixed(1) + ' ' + (padT + plotH).toFixed(1) + ' ';
      for (var ai = 0; ai < vals.length; ai++) p += 'L ' + xAt(ai).toFixed(1) + ' ' + yAt(vals[ai]).toFixed(1) + ' ';
      p += 'L ' + xAt(months - 1).toFixed(1) + ' ' + (padT + plotH).toFixed(1) + ' Z';
      return '<path d="' + p + '" fill="' + color + '" opacity="0.1"></path>';
    };
    var dots = function(vals, color) {
      var html = '';
      for (var di = 0; di < vals.length; di++) html += '<circle cx="' + xAt(di).toFixed(1) + '" cy="' + yAt(vals[di]).toFixed(1) + '" r="2" fill="#fff" stroke="' + color + '" stroke-width="1.5"></circle>';
      return html;
    };
    var labelHtml = '';
    [1, 3, 5, 7, 9, 11, 12].forEach(function(mn) {
      labelHtml += '<text x="' + xAt(mn - 1).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="9" fill="var(--text-light)">' + mn + '月</text>';
    });
    return '<svg class="line-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">'
      + mkArea(expVals, 'var(--primary)')
      + mkArea(incVals, 'var(--accent-green)')
      + '<path d="' + mkPath(expVals) + '" fill="none" stroke="var(--primary)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"></path>'
      + '<path d="' + mkPath(incVals) + '" fill="none" stroke="var(--accent-green)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"></path>'
      + dots(expVals, 'var(--primary)')
      + dots(incVals, 'var(--accent-green)')
      + labelHtml
      + '<g transform="translate(' + (W - 70) + ', 8)"><rect x="-30" y="-8" width="60" height="14" rx="3" fill="var(--primary)" opacity="0.12"></rect><text x="0" y="3" text-anchor="middle" font-size="9" fill="var(--primary)">— 支出</text></g>'
      + '<g transform="translate(' + (W - 70) + ', 22)"><rect x="-30" y="-8" width="60" height="14" rx="3" fill="var(--accent-green)" opacity="0.12"></rect><text x="0" y="3" text-anchor="middle" font-size="9" fill="var(--accent-green)">— 收入</text></g>'
      + '</svg>';
  },

  // 每日收支双线图
  buildDualLineChart(dailyExpense, dailyIncome, year, month) {
    var endDay = new Date(year, month, 0).getDate();
    var expMap = {}, incMap = {};
    (dailyExpense||[]).forEach(function(d) { expMap[parseInt(d.date.split('-')[2],10)] = d.total; });
    (dailyIncome||[]).forEach(function(d) { incMap[parseInt(d.date.split('-')[2],10)] = d.total; });
    var expVals = [], incVals = [];
    for (var d = 1; d <= endDay; d++) { expVals.push(expMap[d] || 0); incVals.push(incMap[d] || 0); }
    var n = endDay;
    var W = 700, H = 200, padL = 30, padR = 12, padT = 18, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var maxV = Math.max.apply(null, expVals.concat(incVals).concat([1]));
    var xAt = function(i) { return n === 1 ? padL + plotW/2 : padL + i * (plotW/(n-1)); };
    var yAt = function(v) { return padT + (1 - v/maxV) * plotH; };
    var mkPath = function(vals) {
      var pts = [];
      for (var pi = 0; pi < vals.length; pi++) {
        pts.push(xAt(pi).toFixed(1) + ' ' + yAt(vals[pi]).toFixed(1));
      }
      return 'M ' + pts.join(' L ');
    };
    var mkArea = function(vals, color) {
      var p = 'M ' + xAt(0).toFixed(1) + ' ' + (padT+plotH).toFixed(1) + ' ';
      for (var ai = 0; ai < vals.length; ai++) {
        p += 'L ' + xAt(ai).toFixed(1) + ' ' + yAt(vals[ai]).toFixed(1) + ' ';
      }
      p += 'L ' + xAt(n-1).toFixed(1) + ' ' + (padT+plotH).toFixed(1) + ' Z';
      return '<path d="' + p + '" fill="' + color + '" opacity="0.1"></path>';
    };
    var dots = function(vals, color) {
      var html = '';
      for (var di = 0; di < vals.length; di++) {
        html += '<circle cx="' + xAt(di).toFixed(1) + '" cy="' + yAt(vals[di]).toFixed(1) + '" r="2" fill="#fff" stroke="' + color + '" stroke-width="1.5"></circle>';
      }
      return html;
    };
    var showDays = [1];
    if (Math.ceil(n/2) !== 1 && Math.ceil(n/2) !== n) showDays.push(Math.ceil(n/2));
    if (n !== 1) showDays.push(n);
    showDays = [...new Set(showDays)];
    var labelHtml = '';
    showDays.forEach(function(sd) {
      labelHtml += '<text x="' + xAt(sd-1).toFixed(1) + '" y="' + (H-6) + '" text-anchor="middle" font-size="9" fill="var(--text-light)">' + sd + '</text>';
    });
    return '<svg class="line-chart-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">'
      + mkArea(expVals, 'var(--primary)')
      + mkArea(incVals, 'var(--accent-green)')
      + '<path d="' + mkPath(expVals) + '" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>'
      + '<path d="' + mkPath(incVals) + '" fill="none" stroke="var(--accent-green)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>'
      + dots(expVals, 'var(--primary)')
      + dots(incVals, 'var(--accent-green)')
      + labelHtml
      + '<g transform="translate(' + (W-70) + ', 8)"><rect x="-30" y="-8" width="60" height="14" rx="3" fill="var(--primary)" opacity="0.12"></rect><text x="0" y="3" text-anchor="middle" font-size="9" fill="var(--primary)">— 支出</text></g>'
      + '<g transform="translate(' + (W-70) + ', 22)"><rect x="-30" y="-8" width="60" height="14" rx="3" fill="var(--accent-green)" opacity="0.12"></rect><text x="0" y="3" text-anchor="middle" font-size="9" fill="var(--accent-green)">— 收入</text></g>'
      + '</svg>';
  },

  getTheme() { try { return localStorage.getItem('miffy-theme') || 'pink'; } catch (e) { return 'pink'; } },

  setTheme(theme) {
    try {
      if (theme === 'pink') {
        localStorage.removeItem('miffy-theme');
        document.documentElement.removeAttribute('data-theme');
      } else {
        localStorage.setItem('miffy-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
      }
    } catch (e) {}
    this.renderMine();
  },

  // ==================== 我的页面 ====================
  renderMine() {
    const container = document.getElementById('page-container');
    const avatarUrl = this.state.user.avatar ? `uploads/${this.state.user.avatar}` : 'images/miffy-logo.jpg';
    container.innerHTML = `
      <div class="page-header"><div class="page-header-left"><a href="#/home" class="back-btn">←</a></div><h1>👤 我的</h1><div></div></div>
      <div class="page-content">
        <div class="card" style="text-align:center;padding:24px;position:relative;overflow:hidden;">
          <div class="avatar-wrapper" onclick="document.getElementById('avatar-upload-input').click()">
            <img src="${avatarUrl}" alt="头像" id="user-avatar-img" style="width:100px;height:100px;object-fit:cover;border-radius:16px;margin-bottom:8px;">
            <div class="avatar-edit-hint">📷 点击更换</div>
          </div>
          <input type="file" id="avatar-upload-input" accept="image/*" style="display:none;" onchange="App.handleAvatarUpload(this)">
          <h2 style="font-size:18px;margin-top:8px;">${this.escapeHtml(this.state.user.username)}</h2>
          <p style="font-size:13px;color:var(--text-secondary);">米菲记账用户</p>
        </div>

        <div class="card mt-12" style="padding:16px;">
          <div style="font-size:14px;font-weight:600;margin-bottom:14px;">🎨 主题颜色</div>
          <div class="theme-swatches">
            ${[
              { key: 'pink', color: '#FF9FB5', name: '粉' },
              { key: 'orange', color: '#FF8A3D', name: '橙' },
              { key: 'blue', color: '#6FB1E8', name: '蓝' },
              { key: 'yellow', color: '#F5B73D', name: '黄' },
              { key: 'green', color: '#5FB87E', name: '绿' }
            ].map(t => `<div class="theme-swatch ${this.getTheme() === t.key ? 'active' : ''}" style="background:${t.color}" title="${t.name}" onclick="App.setTheme('${t.key}')"></div>`).join('')}
          </div>
        </div>

        <div class="card mt-12" style="padding:16px;">
          <div style="font-size:14px;font-weight:600;margin-bottom:12px;">📤 导出我的数据</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="App.exportData('json')">📄 JSON</button>
            <button class="btn btn-outline btn-sm" onclick="App.exportData('csv')">📊 CSV</button>
            <button class="btn btn-outline btn-sm" onclick="App.exportData('excel')">📈 Excel</button>
          </div>
          <p style="font-size:12px;color:var(--text-light);margin-top:10px;line-height:1.5;">将账单、资金模块、分类导出到本机，方便备份或迁移。导出内容仅包含你自己的数据。</p>
        </div>

        <div class="settings-list mt-12">
          <div class="settings-item" onclick="window.location.hash='#/categories'">
            <div class="settings-item-left"><span class="settings-item-icon">🏷️</span><span class="settings-item-label">收支分类管理</span></div>
            <span class="settings-item-arrow">›</span>
          </div>
          <div class="settings-item" onclick="App.showChangePassword()">
            <div class="settings-item-left"><span class="settings-item-icon">🔒</span><span class="settings-item-label">修改密码</span></div>
            <span class="settings-item-arrow">›</span>
          </div>
          <div class="settings-item" style="cursor:default;">
            <div class="settings-item-left"><span class="settings-item-icon">ℹ️</span><span class="settings-item-label">版本</span></div>
            <span style="font-size:13px;color:var(--text-light);">v1.0.0</span>
          </div>
        </div>

        <button class="btn btn-danger btn-sm mt-16" style="width:100%;" onclick="App.confirmLogout()">退出登录</button>
      </div>`;
  },

  async handleAvatarUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { this.toast('图片不能超过5MB'); return; }

    try {
      const data = await API.uploadAvatar(file);
      // 更新本地状态
      this.state.user.avatar = data.filename;
      // 更新图片
      const img = document.getElementById('user-avatar-img');
      if (img) img.src = data.url + '?t=' + Date.now();
      this.toast('头像更新成功');
    } catch (err) {
      this.toast(err.message);
    }
    // 清空 input 以便重复选择同一文件
    input.value = '';
  },

  confirmLogout() {
    if (confirm('确定要退出登录吗？')) { this.logout(); }
  },

  showChangePassword() {
    const html = `
      <div class="modal-header"><h3 class="modal-title">修改密码</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">原密码</label><input type="password" class="form-input" id="old-pwd" placeholder="输入原密码"></div>
        <div class="form-group"><label class="form-label">新密码</label><input type="password" class="form-input" id="new-pwd" placeholder="至少6位"></div>
        <button class="btn btn-primary" onclick="App.doChangePassword()">确认修改</button>
      </div>`;
    this.showModal(html);
  },

  async doChangePassword() {
    const oldPwd = document.getElementById('old-pwd').value;
    const newPwd = document.getElementById('new-pwd').value;
    if (!oldPwd || !newPwd) { this.toast('请填写完整'); return; }
    if (newPwd.length < 6) { this.toast('新密码至少6位'); return; }

    try {
      await API.changePassword(oldPwd, newPwd);
      this.toast('密码修改成功');
      closeModal();
    } catch (err) {
      this.toast(err.message);
    }
  },

  // ==================== 分类管理 ====================
  async renderCategoryManage() {
    const container = document.getElementById('page-container');
    container.innerHTML = `<div class="page-header"><div class="page-header-left"><a href="#/mine" class="back-btn">←</a></div><h1>分类管理</h1><div></div></div><div class="page-content">${this.loadingHtml()}</div>`;

    try {
      const [expData, incData] = await Promise.all([
        API.getCategories('expense'),
        API.getCategories('income')
      ]);

      const allCategories = [...(expData.categories || []), ...(incData.categories || [])];
      this.state.categories.all = allCategories;

      container.innerHTML = `
        <div class="page-header">
          <div class="page-header-left"><a href="#/mine" class="back-btn">←</a></div>
          <h1>分类管理</h1>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-primary btn-xs" onclick="App.showAddGroup()">+ 分组</button>
            <button class="btn btn-outline btn-xs" onclick="App.showAddCategory()">+ 子分类</button>
          </div>
        </div>
        <div class="page-content">
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">📝 支出分类</div>
          ${this.renderCategoryGroups(expData.categories, expData.hidden)}
          <div style="font-size:13px;color:var(--text-secondary);margin:16px 0 8px;">💰 收入分类</div>
          ${this.renderCategoryGroups(incData.categories, incData.hidden)}
          <p style="font-size:12px;color:var(--text-light);text-align:center;margin-top:24px;">点击 ✏️ 可编辑名称和图标</p>
        </div>`;
      document.getElementById('page-container').setAttribute('data-page', 'categories');
    } catch (err) {
      container.innerHTML = `<div class="page-header"><a href="#/mine" class="back-btn">←</a></div><div class="page-content"><p style="text-align:center;padding:40px;">加载失败</p></div>`;
    }
  },

  renderCategoryGroups(categories, hidden) {
    let html = '';
    categories.forEach(group => {
      html += `<div class="category-group">
        <div class="category-group-title">
          <span>${group.icon} ${this.escapeHtml(group.name)}</span>
          <div class="cat-actions">
            <span class="cat-edit-btn" onclick="event.stopPropagation();App.showAddSubCategory(${group.id}, '${this.escapeHtml(group.name)}', '${group.type}')">➕</span>
            <span class="cat-edit-btn" onclick="event.stopPropagation();App.showEditGroup(${group.id}, '${this.escapeHtml(group.name)}', '${group.icon}')">✏️</span>
          </div>
        </div>
        <div>`;
      (group.children || []).forEach(c => {
        html += `<span class="category-chip">${c.icon} ${this.escapeHtml(c.name)}<span class="cat-chip-edit" onclick="event.stopPropagation();App.showEditCategory(${c.id}, '${this.escapeHtml(c.name)}', '${c.icon}', ${group.id})">✏️</span></span>`;
      });
      html += `</div></div>`;
    });
    return html;
  },

  async toggleCategoryHidden(id, current) {
    try {
      await API.updateCategory(id, { is_hidden: current ? 0 : 1 });
      this.toast(current ? '分类已显示' : '分类已隐藏');
      this.renderCategoryManage();
    } catch (err) {
      this.toast(err.message);
    }
  },

  showAddCategory() {
    const html = `
      <div class="modal-header"><h3 class="modal-title">新增分类</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">分类名称</label><input type="text" class="form-input" id="new-cat-name" placeholder="如：水果"></div>
        <div class="form-group"><label class="form-label">分类类型</label>
          <select class="form-input" id="new-cat-type">
            <option value="expense">支出</option><option value="income">收入</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">所属分组</label>
          <select class="form-input" id="new-cat-parent">
            <option value="">独立分组</option>
            ${this.state.categories.all.filter(c => !c.parent_id).map(g =>
              `<option value="${g.id}">${g.icon} ${this.escapeHtml(g.name)} (${g.type === 'expense' ? '支出' : '收入'})</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">图标</label>
          <div id="new-cat-icon-picker" style="display:flex;gap:6px;flex-wrap:wrap;">
            ${['🍎','🍞','🍰','🍜','🍕','🎂','🍺','🚌','⛵','🏖️','🎨','🎵','📱','💊','🐱','🌺','📦','💡','🎒','🧸'].map(icon =>
              `<span style="font-size:24px;cursor:pointer;padding:4px;border-radius:6px;" data-emo="${icon}" onclick="App.pickCatIcon(this)">${icon}</span>`
            ).join('')}
          </div>
          <input type="hidden" id="new-cat-icon" value="📌">
        </div>
        <button class="btn btn-primary" onclick="App.doAddCategory()">确认添加</button>
      </div>`;
    this.showModal(html);
  },

  pickCatIcon(el) {
    document.getElementById('new-cat-icon').value = el.getAttribute('data-emo');
    document.querySelectorAll('#new-cat-icon-picker span').forEach(s => s.style.background = '');
    el.style.background = 'var(--primary-light)';
  },

  async doAddCategory() {
    const name = document.getElementById('new-cat-name').value.trim();
    const type = document.getElementById('new-cat-type').value;
    const parentId = document.getElementById('new-cat-parent').value;
    const icon = document.getElementById('new-cat-icon').value;

    if (!name) { this.toast('请输入分类名称'); return; }

    try {
      await API.createCategory({ name, type, parent_id: parentId ? parseInt(parentId) : null, icon });
      this.toast('分类添加成功');
      closeModal();
      this.renderCategoryManage();
    } catch (err) {
      this.toast(err.message);
    }
  },

  // ---- 新增分组 ----
  showAddGroup() {
    const html = `
      <div class="modal-header"><h3 class="modal-title">新增分组</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">分组名称</label><input type="text" class="form-input" id="new-grp-name" placeholder="如：餐饮类"></div>
        <div class="form-group"><label class="form-label">分类类型</label>
          <select class="form-input" id="new-grp-type">
            <option value="expense">支出</option><option value="income">收入</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">图标</label>
          <div id="new-grp-icon-picker" style="display:flex;gap:6px;flex-wrap:wrap;">
            ${['🍽️','🚗','🏠','🧹','🎮','💊','📚','👗','💼','✈️','🎁','🐾','🌿','🔧','📱','🎯','🏥','🎓','🍪'].map(emo =>
              `<span style="font-size:24px;cursor:pointer;padding:4px;border-radius:6px;" data-emo="${emo}" onclick="App.pickGrpIcon(this)">${emo}</span>`
            ).join('')}
          </div>
          <input type="hidden" id="new-grp-icon" value="📂">
        </div>
        <button class="btn btn-primary" onclick="App.doAddGroup()">确认添加</button>
      </div>`;
    this.showModal(html);
  },

  pickGrpIcon(el) {
    document.getElementById('new-grp-icon').value = el.getAttribute('data-emo');
    document.querySelectorAll('#new-grp-icon-picker span').forEach(s => s.style.background = '');
    el.style.background = 'var(--primary-light)';
  },

  async doAddGroup() {
    const name = document.getElementById('new-grp-name').value.trim();
    const type = document.getElementById('new-grp-type').value;
    const icon = document.getElementById('new-grp-icon').value;

    if (!name) { this.toast('请输入分组名称'); return; }

    try {
      await API.createCategory({ name, type, icon, parent_id: null });
      this.toast('分组添加成功');
      closeModal();
      this.renderCategoryManage();
    } catch (err) {
      this.toast(err.message);
    }
  },

  // ---- 新增子分类（指定分组）----
  showAddSubCategory(groupId, groupName, groupType) {
    const html = `
      <div class="modal-header"><h3 class="modal-title">新增子分类</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">所属分组</label>
          <input type="text" class="form-input" value="${this.escapeHtml(groupName)}" disabled style="background:var(--bg-secondary);"></div>
        <div class="form-group"><label class="form-label">子分类名称</label><input type="text" class="form-input" id="new-sub-name" placeholder="如：早餐"></div>
        <div class="form-group"><label class="form-label">图标</label>
          <div id="new-sub-icon-picker" style="display:flex;gap:6px;flex-wrap:wrap;">
            ${['🍎','🍞','🍰','🍜','🍕','🎂','🍺','🚌','⛵','🏖️','🎨','🎵','📱','💊','🐱','🌺','📦','💡','🎒','🧸','☕','🍔','🥗','🛒','💻','📚','🎬','✈️','🏠','👕'].map(emo =>
              `<span style="font-size:24px;cursor:pointer;padding:4px;border-radius:6px;" data-emo="${emo}" onclick="App.pickSubIcon(this)">${emo}</span>`
            ).join('')}
          </div>
          <input type="hidden" id="new-sub-icon" value="📌">
        </div>
        <input type="hidden" id="new-sub-parent" value="${groupId}">
        <input type="hidden" id="new-sub-type" value="${groupType || 'expense'}">
        <button class="btn btn-primary" onclick="App.doAddSubCategory()">确认添加</button>
      </div>`;
    this.showModal(html);
  },

  pickSubIcon(el) {
    document.getElementById('new-sub-icon').value = el.getAttribute('data-emo');
    document.querySelectorAll('#new-sub-icon-picker span').forEach(s => s.style.background = '');
    el.style.background = 'var(--primary-light)';
  },

  async doAddSubCategory() {
    const name = document.getElementById('new-sub-name').value.trim();
    const icon = document.getElementById('new-sub-icon').value;
    const parentId = parseInt(document.getElementById('new-sub-parent').value);
    const type = document.getElementById('new-sub-type').value;

    if (!name) { this.toast('请输入子分类名称'); return; }

    try {
      await API.createCategory({ name, icon, parent_id: parentId, type });
      this.toast('子分类添加成功');
      closeModal();
      this.renderCategoryManage();
    } catch (err) {
      this.toast(err.message);
    }
  },

  // ---- 编辑子分类 ----
  showEditCategory(id, name, icon, groupId) {
    const html = `
      <div class="modal-header"><h3 class="modal-title">编辑分类</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">分类名称</label><input type="text" class="form-input" id="edit-cat-name" value="${this.escapeHtml(name)}"></div>
        <div class="form-group"><label class="form-label">图标</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${['🍎','🍞','🍰','🍜','🍕','🎂','🍺','🚌','⛵','🏖️','🎨','🎵','📱','💊','🐱','🌺','📦','💡','🎒','🧸','☕','🍔','🥗','🛒','💻','📚','🎬','✈️','🏠','👕'].map(emo =>
              `<span style="font-size:24px;cursor:pointer;padding:4px;border-radius:6px;${emo === icon ? 'background:var(--primary-light);' : ''}" onclick="App.selectCatIcon('${emo}')">${emo}</span>`
            ).join('')}
          </div>
          <input type="hidden" id="edit-cat-icon" value="${icon}">
        </div>
        <div class="form-group">
          <label class="form-label checkbox-label">
            <input type="checkbox" id="edit-cat-hidden"> 隐藏此分类（记账时不再显示）
          </label>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-primary" onclick="App.doEditCategory(${id})">保存</button>
          <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="App.confirmDeleteCategory(${id})">删除</button>
        </div>
      </div>`;
    this.showModal(html);
  },

  selectCatIcon(icon) {
    document.getElementById('edit-cat-icon').value = icon;
    const container = document.querySelector('.modal-body .form-group:nth-child(2) > div');
    if (container) {
      container.querySelectorAll('span').forEach(s => {
        s.style.background = s.textContent === icon ? 'var(--primary-light)' : '';
      });
    }
  },

  async doEditCategory(id) {
    const name = document.getElementById('edit-cat-name').value.trim();
    const icon = document.getElementById('edit-cat-icon').value;
    const isHidden = document.getElementById('edit-cat-hidden')?.checked ? 1 : 0;

    if (!name) { this.toast('请输入分类名称'); return; }

    try {
      await API.updateCategory(id, { name, icon, is_hidden: isHidden });
      this.toast('分类已更新');
      closeModal();
      this.renderCategoryManage();
    } catch (err) {
      this.toast(err.message);
    }
  },

  // ---- 编辑分组 ----
  showEditGroup(id, name, icon) {
    const html = `
      <div class="modal-header"><h3 class="modal-title">编辑分组</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">分组名称</label><input type="text" class="form-input" id="edit-grp-name" value="${this.escapeHtml(name)}"></div>
        <div class="form-group"><label class="form-label">图标</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${['🍽️','🚗','🏠','🧹','🎮','💊','📚','👗','💼','✈️','🎁','🐾','🌿','🔧','📱','🎯','🏥','🎓','🍪'].map(emo =>
              `<span style="font-size:24px;cursor:pointer;padding:4px;border-radius:6px;${emo === icon ? 'background:var(--primary-light);' : ''}" onclick="App.selectGrpIcon('${emo}')">${emo}</span>`
            ).join('')}
          </div>
          <input type="hidden" id="edit-grp-icon" value="${icon}">
        </div>
        <button class="btn btn-primary" onclick="App.doEditGroup(${id})">保存</button>
      </div>`;
    this.showModal(html);
  },

  selectGrpIcon(icon) {
    document.getElementById('edit-grp-icon').value = icon;
    const container = document.querySelector('.modal-body .form-group:nth-child(2) > div');
    if (container) {
      container.querySelectorAll('span').forEach(s => {
        s.style.background = s.textContent === icon ? 'var(--primary-light)' : '';
      });
    }
  },

  async doEditGroup(id) {
    const name = document.getElementById('edit-grp-name').value.trim();
    const icon = document.getElementById('edit-grp-icon').value;

    if (!name) { this.toast('请输入分组名称'); return; }

    try {
      await API.updateCategory(id, { name, icon });
      this.toast('分组已更新');
      closeModal();
      this.renderCategoryManage();
    } catch (err) {
      this.toast(err.message);
    }
  },

  // ---- 删除分类确认 ----
  confirmDeleteCategory(id) {
    const html = `
      <div class="modal-header"><h3 class="modal-title">删除分类</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <p>确定要删除这个分类吗？</p>
        <p style="font-size:13px;color:var(--text-secondary);">如果有账单记录则无法删除，建议改为隐藏。</p>
        <div style="display:flex;gap:8px;margin-top:16px;">
          <button class="btn btn-danger btn-sm" onclick="App.doDeleteCategory(${id})">确认删除</button>
          <button class="btn btn-outline btn-sm" onclick="closeModal()">取消</button>
        </div>
      </div>`;
    this.showModal(html);
  },

  async doDeleteCategory(id) {
    try {
      await API.deleteCategory(id);
      this.toast('分类已删除');
      closeModal();
      this.renderCategoryManage();
    } catch (err) {
      this.toast(err.message);
    }
  },

  // ==================== 工具函数 ====================
  formatNum(n) {
    if (n === undefined || n === null) return '0.00';
    return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  toast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.display = 'block';
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'fadeInDown 0.3s';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.style.display = 'none'; }, duration);
  },

  // ==================== 数据导出 ====================
  async exportData(format) {
    try {
      this.toast('正在准备导出...');
      const [billsRes, modulesRes, expCat, incCat] = await Promise.all([
        API.getBills({ limit: 100000 }),
        API.getModules(),
        API.getCategories('expense'),
        API.getCategories('income')
      ]);
      const bills = billsRes.bills || [];
      const modules = (modulesRes.modules || []).map(m => ({
        id: m.id, name: m.name, icon: m.icon, budget_amount: m.budget_amount,
        spent_amount: m.spent_amount, remaining: m.remaining_amount,
        period_type: m.period_type, remark: m.remark || ''
      }));
      const categories = [...(expCat.categories || []), ...(incCat.categories || [])].map(c => ({
        id: c.id, name: c.name, type: c.type, icon: c.icon, parent_id: c.parent_id
      }));
      const payload = {
        app: 'miffy-account',
        export_time: new Date().toISOString(),
        user: { username: this.state.user.username },
        summary: {
          bill_count: bills.length,
          module_count: modules.length,
          category_count: categories.length
        },
        bills, modules, categories
      };

      const stamp = new Date().toISOString().slice(0, 10);
      if (format === 'json') {
        this.downloadFile(`miffy-export-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
      } else if (format === 'csv') {
        const headers = ['日期', '类型', '金额', '分类', '资金模块', '备注'];
        const keys = ['date', 'type', 'amount', 'category', 'module', 'remark'];
        const rows = bills.map(b => ({
          date: b.date,
          type: b.type === 'expense' ? '支出' : '收入',
          amount: b.amount,
          category: b.category_name || '',
          module: b.fund_module_name || '',
          remark: b.remark || ''
        }));
        this.downloadFile(`miffy-export-${stamp}.csv`, '﻿' + this.toCSV(rows, keys, headers), 'text/csv;charset=utf-8');
      } else if (format === 'excel') {
        const headers = ['日期', '类型', '金额', '分类', '资金模块', '备注'];
        const rows = bills.map(b => ([
          b.date,
          b.type === 'expense' ? '支出' : '收入',
          b.amount,
          b.category_name || '',
          b.fund_module_name || '',
          b.remark || ''
        ]));
        this.downloadFile(`miffy-export-${stamp}.xls`, this.toExcel(rows, headers), 'application/vnd.ms-excel;charset=utf-8');
      }
      this.toast('导出成功 📥');
    } catch (err) {
      this.toast(err.message || '导出失败');
    }
  },

  downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  toCSV(rows, keys, headers) {
    const esc = v => {
      const s = v == null ? '' : String(v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.join(',')];
    rows.forEach(r => lines.push(keys.map(k => esc(r[k])).join(',')));
    return lines.join('\r\n');
  },

  toExcel(rows, headers) {
    const esc = s => {
      s = s == null ? '' : String(s);
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"></head><body>';
    html += '<table border="1" cellspacing="0" cellpadding="4">';
    html += '<tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';
    rows.forEach(r => { html += '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>'; });
    html += '</table></body></html>';
    return html;
  },

  // 记账成功庆祝画面：米菲图片 + 气球/彩带/星星，约 1 秒后淡出
  showCelebrate(onDone) {
    const colors = ['#e74c3c','#f39c12','#f1c40f','#2ecc71','#3498db','#9b59b6','#e91e63','#00bcd4'];
    const overlay = document.createElement('div');
    overlay.className = 'celebrate-overlay';
    overlay.innerHTML = `
      <div class="glow-ring"></div>
      <div class="confetti-container" id="celebrate-particles"></div>
      <div class="miffy-img-wrap"><img class="miffy-img" src="images/miffy-celebrate.jpg" alt="米菲庆祝"></div>
      <div class="success-badge"><span class="check-icon">✓</span> 记账成功</div>
      <div class="sub-text">米菲为你开心 🎈</div>`;
    document.body.appendChild(overlay);

    const container = overlay.querySelector('#celebrate-particles');
    // 彩色纸屑
    for (let i = 0; i < 28; i++) {
      const el = document.createElement('div');
      el.className = 'confetti';
      el.style.left = Math.random() * 100 + '%';
      el.style.bottom = (10 + Math.random() * 30) + '%';
      el.style.background = colors[i % colors.length];
      el.style.animationDelay = (Math.random() * 0.6) + 's';
      el.style.animationDuration = (0.7 + Math.random() * 0.6) + 's';
      container.appendChild(el);
    }
    // 星星
    const starPos = [[10,15],[85,12],[92,55],[5,60],[78,75],[15,80],[50,8],[88,32],[8,38]];
    starPos.forEach((p, i) => {
      const s = document.createElement('div');
      s.className = 'star';
      s.textContent = '✦';
      s.style.left = p[0] + '%';
      s.style.top = p[1] + '%';
      s.style.color = colors[i % colors.length];
      s.style.animationDelay = (i * 0.12) + 's';
      s.style.fontSize = (18 + Math.random() * 14) + 'px';
      container.appendChild(s);
    });
    // 气球
    const bPos = [[8,25],[88,22],[82,68],[12,72],[48,5]];
    bPos.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'balloon';
      el.textContent = '🎈';
      el.style.left = p[0] + '%';
      el.style.top = p[1] + '%';
      el.style.animationDelay = (i * 0.25) + 's';
      container.appendChild(el);
    });
    // 爱心
    for (let i = 0; i < 6; i++) {
      const h = document.createElement('div');
      h.className = 'heart';
      h.textContent = '❤';
      h.style.left = (20 + Math.random() * 60) + '%';
      h.style.top = (20 + Math.random() * 50) + '%';
      h.style.animationDelay = (i * 0.3) + 's';
      h.style.fontSize = (14 + Math.random() * 12) + 'px';
      container.appendChild(h);
    }

    // 2 秒后淡出并移除
    setTimeout(() => {
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.remove();
        if (typeof onDone === 'function') onDone();
      }, 400);
    }, 2000);
  },

  showModal(html) {
    const overlay = document.getElementById('overlay');
    const container = document.getElementById('modal-container');
    overlay.style.display = 'block';
    container.innerHTML = html;
    container.style.display = 'block';
  },

  closeModal() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('modal-container').style.display = 'none';
    document.getElementById('modal-container').innerHTML = '';
  },

  renderPagination(page, total) {
    return `<div class="pagination">
      <button class="pagination-btn" ${page <= 1 ? 'disabled' : ''} onclick="App.loadBills(${page - 1})">上一页</button>
      <span class="pagination-info">${page} / ${total}</span>
      <button class="pagination-btn" ${page >= total ? 'disabled' : ''} onclick="App.loadBills(${page + 1})">下一页</button>
    </div>`;
  }
};

// ==================== 全局函数 ====================
function closeModal() { App.closeModal(); }

// ==================== 启动 ====================
document.addEventListener('DOMContentLoaded', () => App.init());
