const ANALYTICS_EXCLUSION_KEY = 'xph_ignore_analytics';

export const isAnalyticsExcluded = () => {
  try {
    return window.localStorage.getItem(ANALYTICS_EXCLUSION_KEY) === '1';
  } catch {
    return false;
  }
};

export const setAnalyticsExcluded = (excluded: boolean) => {
  try {
    if (excluded) window.localStorage.setItem(ANALYTICS_EXCLUSION_KEY, '1');
    else window.localStorage.removeItem(ANALYTICS_EXCLUSION_KEY);
  } catch {
    // Browsers with blocked storage simply keep the default analytics behavior.
  }
};
