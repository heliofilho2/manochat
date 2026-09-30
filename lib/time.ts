/**
 * Wall-clock time behind a function, so server components that need "now"
 * don't call Date.now() inline (react-hooks/purity flags that in render).
 */
export const nowMs = () => Date.now();
