// Zentraler Loading-Service fuer Renderer-Operationen.
(function registerLoadingService() {
  function withMinVisibleTime(start, minVisibleMs) {
    const elapsed = Date.now() - start;
    if (elapsed >= minVisibleMs) return Promise.resolve();
    return new Promise((resolve) =>
      setTimeout(resolve, minVisibleMs - elapsed),
    );
  }

  function wrapElectronAPIWithLoader(app) {
    if (!window.electronAPI || window.__pmLoadingWrapped) return;
    const original = window.electronAPI;
    const wrapped = {};

    Object.keys(original).forEach((key) => {
      const value = original[key];
      if (typeof value !== "function") {
        wrapped[key] = value;
        return;
      }

      wrapped[key] = async (...args) => {
        if (app.loadingCount === 0) {
          app.loadingStartedAt = Date.now();
        }
        app.loadingCount += 1;
        app.isLoading = true;
        try {
          return await value(...args);
        } finally {
          app.loadingCount = Math.max(0, app.loadingCount - 1);
          if (app.loadingCount === 0) {
            await withMinVisibleTime(app.loadingStartedAt || Date.now(), 250);
            app.isLoading = false;
          } else {
            app.isLoading = true;
          }
        }
      };
    });

    window.electronAPI = wrapped;
    window.__pmLoadingWrapped = true;
  }

  function beginLoading(app) {
    if (app.loadingCount === 0) {
      app.loadingStartedAt = Date.now();
    }
    app.loadingCount += 1;
    app.isLoading = true;
    return app.loadingStartedAt;
  }

  async function endLoading(app, startedAt = null) {
    app.loadingCount = Math.max(0, app.loadingCount - 1);
    if (app.loadingCount > 0) {
      app.isLoading = true;
      return;
    }

    const start = startedAt || app.loadingStartedAt || Date.now();
    await withMinVisibleTime(start, 250);
    app.isLoading = false;
  }

  window.pmLoadingService = {
    wrapElectronAPIWithLoader,
    beginLoading,
    endLoading,
  };
})();
