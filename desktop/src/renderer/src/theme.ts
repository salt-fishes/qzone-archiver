/**
 * Naive UI 主题定制（C 端化改版 v4.6）
 * 品牌色自原「陶土棕 #9a5336」提亮衍生的暖陶色系，保留辨识度的同时适配现代浅/深色。
 */
import type { GlobalThemeOverrides } from 'naive-ui';

const BRAND = {
  primary: '#B45F3D',
  primaryHover: '#C86F4B',
  primaryPressed: '#994F31',
  primarySuppl: '#E5A17E',
};

const shared: GlobalThemeOverrides = {
  common: {
    primaryColor: BRAND.primary,
    primaryColorHover: BRAND.primaryHover,
    primaryColorPressed: BRAND.primaryPressed,
    primaryColorSuppl: BRAND.primarySuppl,
    borderRadius: '10px',
    borderRadiusSmall: '6px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
  },
  Card: {
    borderRadius: '14px',
  },
  Dialog: {
    borderRadius: '14px',
  },
  Modal: {
    borderRadius: '14px',
  },
};

export const lightThemeOverrides: GlobalThemeOverrides = {
  ...shared,
  common: {
    ...shared.common,
    bodyColor: '#F6F4F1',
    cardColor: '#FFFFFF',
  },
};

export const darkThemeOverrides: GlobalThemeOverrides = {
  ...shared,
  common: {
    ...shared.common,
    bodyColor: '#101014',
    cardColor: '#1B1B20',
  },
};
