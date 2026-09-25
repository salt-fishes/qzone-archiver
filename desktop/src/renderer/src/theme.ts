/**
 * Naive UI 主题定制（v5.2「时光档案」深度适配，§5）
 * 规则：令牌全部来自 plans/v5.2-design.md §2——primary=墨、强调=朱砂、圆角 2px、
 * 字体族对齐衬线链；状态色映射 成功=苔 · 警示=金 · 错误=朱砂 · 信息=靛。
 * 不逐页写死颜色；深色仅桌面端（夜墨令牌组）。
 */
import type { GlobalThemeOverrides } from 'naive-ui';

/** 时光档案色板（§2.1） */
const PALETTE = {
  paper: '#F6F1E7',
  paperRaised: '#FDF9EF',
  ink: '#211D17',
  inkMuted: '#8A8172',
  line: '#D8CFBC',
  vermilion: '#B5432A',
  indigo: '#3D5A80',
  moss: '#6B7F5C',
  gold: '#C9A227',
  /* 深色（仅桌面端） */
  night: '#17140F',
  nightRaised: '#201C15',
  nightInk: '#E9E2D3',
  goldBright: '#E3B34C',
} as const;

const SERIF =
  "'Noto Serif SC', 'Songti SC', 'STSong', 'SimSun', Georgia, serif";
const MONO = "'JetBrains Mono', Consolas, 'SF Mono', monospace";

const shared: GlobalThemeOverrides = {
  common: {
    /* primary=墨（§5）；hover 加深 8%，pressed 再深 */
    primaryColor: PALETTE.ink,
    primaryColorHover: '#14100B',
    primaryColorPressed: '#0C0906',
    primaryColorSuppl: '#4A4335',
    /* 状态色映射 */
    errorColor: PALETTE.vermilion,
    errorColorHover: '#96381F',
    errorColorPressed: '#7E2F19',
    errorColorSuppl: '#D97B62',
    warningColor: PALETTE.gold,
    warningColorHover: '#A8861F',
    warningColorPressed: '#8E711A',
    warningColorSuppl: '#E0BE5C',
    successColor: PALETTE.moss,
    successColorHover: '#57694A',
    successColorPressed: '#48583D',
    successColorSuppl: '#8FA383',
    infoColor: PALETTE.indigo,
    infoColorHover: '#324C6B',
    infoColorPressed: '#293F59',
    infoColorSuppl: '#6F8BAA',
    /* 印刷品没有圆角（§2.3） */
    borderRadius: '2px',
    borderRadiusSmall: '2px',
    /* 字体族对齐衬线链；等宽场景用 --mono-font */
    fontFamily: SERIF,
    fontFamilyMono: MONO,
    /* 静止元素无阴影（§2.3） */
    boxShadow1: 'none',
    boxShadow2: '0 2px 8px rgba(33, 29, 23, 0.12)',
    boxShadow3: '0 2px 8px rgba(33, 29, 23, 0.12)',
  },
  Card: { borderRadius: '2px' },
  Dialog: { borderRadius: '2px' },
  Modal: { borderRadius: '2px' },
  Button: { fontWeight: '600' },
};

export const lightThemeOverrides: GlobalThemeOverrides = {
  ...shared,
  common: {
    ...shared.common,
    bodyColor: PALETTE.paper,
    cardColor: PALETTE.paperRaised,
    modalColor: PALETTE.paperRaised,
    popoverColor: PALETTE.paperRaised,
    tableColor: PALETTE.paperRaised,
    inputColor: PALETTE.paperRaised,
    dividerColor: PALETTE.line,
    borderColor: PALETTE.line,
    textColorBase: PALETTE.ink,
    textColor1: PALETTE.ink,
    textColor2: PALETTE.ink,
    textColor3: PALETTE.inkMuted,
  },
};

export const darkThemeOverrides: GlobalThemeOverrides = {
  ...shared,
  common: {
    ...shared.common,
    /* 深色下 primary 反转为「夜墨墨色」（浅暖）：
       浅色体系的 primary=墨 #211D17 是「暗上暗」，按钮/激活态在夜墨底上不可读（v5.3 装机实测）。
       Naive darkTheme 主按钮文字取 baseColor，显式配墨字保证浅底墨字高对比 */
    primaryColor: PALETTE.nightInk,
    primaryColorHover: '#F5EFE2',
    primaryColorPressed: '#D8D0BE',
    primaryColorSuppl: '#FFFFFF',
    baseColor: PALETTE.ink,
    bodyColor: PALETTE.night,
    cardColor: PALETTE.nightRaised,
    modalColor: PALETTE.nightRaised,
    popoverColor: PALETTE.nightRaised,
    tableColor: PALETTE.nightRaised,
    inputColor: PALETTE.nightRaised,
    dividerColor: '#3D372C',
    borderColor: '#3D372C',
    textColorBase: PALETTE.nightInk,
    textColor1: PALETTE.nightInk,
    textColor2: PALETTE.nightInk,
    /* 深色下次级文字提亮：#8A8172 在夜墨底上对比仅 ~3.5:1（小字不达标），
       #A69D8C ≈ 6.9:1（浅色端维持 --ink-muted 不变） */
    textColor3: '#A69D8C',
    /* 深色下金提亮（§2.1） */
    warningColor: PALETTE.goldBright,
    warningColorHover: '#EDC36A',
    warningColorPressed: '#D8AF52',
    warningColorSuppl: '#F0D08A',
  },
};
