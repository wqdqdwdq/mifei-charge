// ==================== 米菲主题 SVG 插图 ====================
// 严格按 Dick Bruna 原作风格：粗黑轮廓 + 椭圆头(横径≥纵径) + 长竖耳(从头顶侧面伸出) +
// 小圆点眼 + X形嘴 + 白色身体 + 衣服可换色
// viewBox 完整包含耳朵到脚，1:1 真实身体比例（高>宽，自然瘦长）
const Miffy = {
  outline: '#2A2A2A',
  colors: {
    orange: '#FF7B3E',   // 经典橙（米菲原版衣服色）
    pink:   '#FF8FA8',
    blue:   '#5BA3DB',
    yellow: '#FFCB47',
    green:  '#9BC78A',
    purple: '#B8A4D9',
  },

  // ============ 内部几何参数（viewBox: 0 -5 100 170）============
  // 注意：所有 y 坐标都比之前的版本 +5（避开 viewBox 负数，保持坐标系相对简洁）
  // 耳朵: y=8, height=32, 顶 y=8（包含在 viewBox 0 起）
  // 头部: cx=50, cy=72, rx=30, ry=28 (范围 44-100)
  // 眼睛: cx=40/60, cy=72, r=2.5
  // X嘴: (44,84)<->(56,92) 和 (56,84)<->(44,92)
  // 身体: cx=50, cy=130, rx=22, ry=18 (范围 112-148)
  // 脚: cx=40/60, cy=155, ry=4
  // viewBox y 范围: -5 到 165 = 170 总高度单位
  _headPath() {
    return `
      <rect x="37" y="8" width="9" height="32" rx="4.5" fill="white" stroke="${this.outline}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="54" y="8" width="9" height="32" rx="4.5" fill="white" stroke="${this.outline}" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="50" cy="72" rx="30" ry="28" fill="white" stroke="${this.outline}" stroke-width="3"/>
      <circle cx="40" cy="72" r="2.5" fill="${this.outline}"/>
      <circle cx="60" cy="72" r="2.5" fill="${this.outline}"/>
      <line x1="44" y1="84" x2="56" y2="92" stroke="${this.outline}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="56" y1="84" x2="44" y2="92" stroke="${this.outline}" stroke-width="2.5" stroke-linecap="round"/>
    `;
  },

  _bodyPath(color) {
    return `
      <ellipse cx="50" cy="130" rx="22" ry="18" fill="${color}" stroke="${this.outline}" stroke-width="3"/>
      <ellipse cx="40" cy="155" rx="6" ry="4" fill="white" stroke="${this.outline}" stroke-width="2.5"/>
      <ellipse cx="60" cy="155" rx="6" ry="4" fill="white" stroke="${this.outline}" stroke-width="2.5"/>
    `;
  },

  // ============ 通用 SVG 生成器 ============
  // size: 米菲整体目标高度（含耳朵到脚）
  // 返回的 SVG 保持 100:170 的原始比例（高>宽）
  _svg(size, html) {
    const h = Math.round(size);
    const w = Math.round(size * 100 / 170);
    return `<svg viewBox="0 -5 100 170" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0;">${html}</svg>`;
  },

  // 仅头部米菲（含一点领口/衣服，size 表示整体高度）
  headOnly(size = 80, color = 'orange', withBody = false) {
    const inner = this._headPath() + (withBody ? this._bodyPath(this.colors[color] || this.colors.orange) : '');
    return this._svg(size, inner);
  },

  // 完整米菲全身（用于头像和场景）
  full(size = 80, color = 'orange') {
    const inner = this._headPath() + this._bodyPath(this.colors[color] || this.colors.orange);
    return this._svg(size, inner);
  },

  // ============ 站点大 Logo（米菲抱账本）============
  logo: `<svg viewBox="0 -10 140 175" width="120" height="150" xmlns="http://www.w3.org/2000/svg">
    <rect x="50" y="0" width="10" height="38" rx="5" fill="white" stroke="#2A2A2A" stroke-width="3.5" stroke-linejoin="round"/>
    <rect x="80" y="0" width="10" height="38" rx="5" fill="white" stroke="#2A2A2A" stroke-width="3.5" stroke-linejoin="round"/>
    <ellipse cx="70" cy="78" rx="36" ry="32" fill="white" stroke="#2A2A2A" stroke-width="3.5"/>
    <circle cx="56" cy="76" r="3" fill="#2A2A2A"/>
    <circle cx="84" cy="76" r="3" fill="#2A2A2A"/>
    <line x1="62" y1="90" x2="78" y2="102" stroke="#2A2A2A" stroke-width="3" stroke-linecap="round"/>
    <line x1="78" y1="90" x2="62" y2="102" stroke="#2A2A2A" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="70" cy="145" rx="32" ry="22" fill="#FF7B3E" stroke="#2A2A2A" stroke-width="3.5"/>
    <ellipse cx="42" cy="145" rx="9" ry="14" fill="white" stroke="#2A2A2A" stroke-width="3"/>
    <ellipse cx="98" cy="145" rx="9" ry="14" fill="white" stroke="#2A2A2A" stroke-width="3"/>
    <rect x="46" y="128" width="48" height="36" rx="3" fill="white" stroke="#2A2A2A" stroke-width="2.5"/>
    <line x1="50" y1="136" x2="90" y2="136" stroke="#CCC" stroke-width="1.5"/>
    <line x1="50" y1="144" x2="90" y2="144" stroke="#CCC" stroke-width="1.5"/>
    <line x1="50" y1="152" x2="80" y2="152" stroke="#CCC" stroke-width="1.5"/>
  </svg>`,

  // ============ 场景插图 ============
  // 记账成功（米菲 + 绿色对勾）
  success: `<svg viewBox="0 -5 140 170" width="105" height="128" xmlns="http://www.w3.org/2000/svg">
    <rect x="37" y="8" width="9" height="32" rx="4.5" fill="white" stroke="#2A2A2A" stroke-width="3"/>
    <rect x="54" y="8" width="9" height="32" rx="4.5" fill="white" stroke="#2A2A2A" stroke-width="3"/>
    <ellipse cx="50" cy="70" rx="30" ry="28" fill="white" stroke="#2A2A2A" stroke-width="3"/>
    <circle cx="40" cy="70" r="2.5" fill="#2A2A2A"/>
    <circle cx="60" cy="70" r="2.5" fill="#2A2A2A"/>
    <line x1="44" y1="82" x2="56" y2="90" stroke="#2A2A2A" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="56" y1="82" x2="44" y2="90" stroke="#2A2A2A" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="50" cy="128" rx="22" ry="18" fill="#FF7B3E" stroke="#2A2A2A" stroke-width="3"/>
    <ellipse cx="40" cy="153" rx="6" ry="4" fill="white" stroke="#2A2A2A" stroke-width="2.5"/>
    <ellipse cx="60" cy="153" rx="6" ry="4" fill="white" stroke="#2A2A2A" stroke-width="2.5"/>
    <circle cx="115" cy="78" r="18" fill="#7BC95C" stroke="#2A2A2A" stroke-width="3"/>
    <polyline points="107,78 112,84 123,72" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // 余额不足（米菲 + 空碗，担心表情）
  lowBalance: `<svg viewBox="0 -5 110 180" width="92" height="151" xmlns="http://www.w3.org/2000/svg">
    <rect x="37" y="8" width="9" height="32" rx="4.5" fill="white" stroke="#2A2A2A" stroke-width="3"/>
    <rect x="54" y="8" width="9" height="32" rx="4.5" fill="white" stroke="#2A2A2A" stroke-width="3"/>
    <ellipse cx="50" cy="70" rx="30" ry="28" fill="white" stroke="#2A2A2A" stroke-width="3"/>
    <line x1="36" y1="66" x2="44" y2="68" stroke="#2A2A2A" stroke-width="2" stroke-linecap="round"/>
    <line x1="64" y1="66" x2="56" y2="68" stroke="#2A2A2A" stroke-width="2" stroke-linecap="round"/>
    <circle cx="40" cy="72" r="2.5" fill="#2A2A2A"/>
    <circle cx="60" cy="72" r="2.5" fill="#2A2A2A"/>
    <line x1="44" y1="84" x2="56" y2="92" stroke="#2A2A2A" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="56" y1="84" x2="44" y2="92" stroke="#2A2A2A" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="50" cy="128" rx="22" ry="18" fill="#FFCB47" stroke="#2A2A2A" stroke-width="3"/>
    <ellipse cx="40" cy="153" rx="6" ry="4" fill="white" stroke="#2A2A2A" stroke-width="2.5"/>
    <ellipse cx="60" cy="153" rx="6" ry="4" fill="white" stroke="#2A2A2A" stroke-width="2.5"/>
    <ellipse cx="50" cy="170" rx="22" ry="6" fill="white" stroke="#2A2A2A" stroke-width="2.5"/>
    <path d="M 28 170 Q 50 182 72 170" fill="white" stroke="#2A2A2A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // 没有账单（米菲 + 问号 + 文件纸）
  noBills: `<svg viewBox="0 -5 160 170" width="130" height="138" xmlns="http://www.w3.org/2000/svg">
    <rect x="37" y="8" width="9" height="32" rx="4.5" fill="white" stroke="#2A2A2A" stroke-width="3"/>
    <rect x="54" y="8" width="9" height="32" rx="4.5" fill="white" stroke="#2A2A2A" stroke-width="3"/>
    <ellipse cx="50" cy="70" rx="30" ry="28" fill="white" stroke="#2A2A2A" stroke-width="3"/>
    <circle cx="40" cy="72" r="2.5" fill="#2A2A2A"/>
    <circle cx="60" cy="72" r="2.5" fill="#2A2A2A"/>
    <line x1="44" y1="84" x2="56" y2="92" stroke="#2A2A2A" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="56" y1="84" x2="44" y2="92" stroke="#2A2A2A" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="50" cy="128" rx="22" ry="18" fill="#FF8FA8" stroke="#2A2A2A" stroke-width="3"/>
    <ellipse cx="40" cy="153" rx="6" ry="4" fill="white" stroke="#2A2A2A" stroke-width="2.5"/>
    <ellipse cx="60" cy="153" rx="6" ry="4" fill="white" stroke="#2A2A2A" stroke-width="2.5"/>
    <text x="100" y="50" font-family="sans-serif" font-size="32" font-weight="bold" fill="#FF8FA8" stroke="#2A2A2A" stroke-width="1.2">?</text>
    <rect x="105" y="100" width="44" height="38" rx="3" fill="white" stroke="#2A2A2A" stroke-width="2.5"/>
    <line x1="111" y1="110" x2="143" y2="110" stroke="#DDD" stroke-width="1.5"/>
    <line x1="111" y1="117" x2="143" y2="117" stroke="#DDD" stroke-width="1.5"/>
    <line x1="111" y1="124" x2="135" y2="124" stroke="#DDD" stroke-width="1.5"/>
    <line x1="111" y1="131" x2="143" y2="131" stroke="#DDD" stroke-width="1.5"/>
  </svg>`,

  // 小米菲（仅头部 + 衣服，80px 高），竖长比例，耳朵完整
  smallMiffy: `<svg viewBox="0 -5 100 130" width="50" height="65" xmlns="http://www.w3.org/2000/svg">
    <rect x="37" y="8" width="9" height="32" rx="4.5" fill="white" stroke="#2A2A2A" stroke-width="3"/>
    <rect x="54" y="8" width="9" height="32" rx="4.5" fill="white" stroke="#2A2A2A" stroke-width="3"/>
    <ellipse cx="50" cy="72" rx="30" ry="28" fill="white" stroke="#2A2A2A" stroke-width="3"/>
    <circle cx="40" cy="72" r="2.5" fill="#2A2A2A"/>
    <circle cx="60" cy="72" r="2.5" fill="#2A2A2A"/>
    <line x1="44" y1="84" x2="56" y2="92" stroke="#2A2A2A" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="56" y1="84" x2="44" y2="92" stroke="#2A2A2A" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="50" cy="108" rx="20" ry="6" fill="#FF7B3E" stroke="#2A2A2A" stroke-width="2.5"/>
  </svg>`,

  // 极小米菲（仅头部轮廓，inline 用）
  tinyMiffy: `<svg viewBox="0 -5 100 110" width="28" height="31" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;">
    <rect x="40" y="8" width="7" height="28" rx="3.5" fill="white" stroke="#2A2A2A" stroke-width="2.5"/>
    <rect x="53" y="8" width="7" height="28" rx="3.5" fill="white" stroke="#2A2A2A" stroke-width="2.5"/>
    <ellipse cx="50" cy="64" rx="24" ry="22" fill="white" stroke="#2A2A2A" stroke-width="2.5"/>
    <circle cx="42" cy="64" r="2" fill="#2A2A2A"/>
    <circle cx="58" cy="64" r="2" fill="#2A2A2A"/>
    <line x1="45" y1="74" x2="55" y2="80" stroke="#2A2A2A" stroke-width="2" stroke-linecap="round"/>
    <line x1="55" y1="74" x2="45" y2="80" stroke="#2A2A2A" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  // ============ 模块图标（按索引返回不同颜色米菲）============
  getModuleIcon(index = 0) {
    const colors = ['orange', 'pink', 'blue', 'yellow', 'green'];
    return this.full(50, colors[index % colors.length]);
  },

  // 米菲背景装饰（线框）
  miffyBg: `<svg viewBox="0 -5 100 130" width="55" height="72" xmlns="http://www.w3.org/2000/svg" opacity="0.06">
    <rect x="40" y="8" width="7" height="28" rx="3.5" fill="none" stroke="#FF7B3E" stroke-width="2.5"/>
    <rect x="53" y="8" width="7" height="28" rx="3.5" fill="none" stroke="#FF7B3E" stroke-width="2.5"/>
    <ellipse cx="50" cy="64" rx="24" ry="22" fill="none" stroke="#FF7B3E" stroke-width="2.5"/>
    <circle cx="42" cy="64" r="1.5" fill="#FF7B3E"/>
    <circle cx="58" cy="64" r="1.5" fill="#FF7B3E"/>
    <line x1="45" y1="74" x2="55" y2="80" stroke="#FF7B3E" stroke-width="2" stroke-linecap="round"/>
    <line x1="55" y1="74" x2="45" y2="80" stroke="#FF7B3E" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="50" cy="106" rx="18" ry="14" fill="none" stroke="#FF7B3E" stroke-width="2.5"/>
  </svg>`
};
