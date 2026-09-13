(function () {
  "use strict";

  var config = window.STRUCTURED_WRITING_CONFIG || {};
  var repository = config.repository || "guishiru/structured-writing";
  var assetName = config.releaseAssetName || "structured-writing.plugin";
  var apiBase = "https://api.github.com/repos/" + repository;
  var downloadButton = document.getElementById("download-button");
  var releaseLink = document.getElementById("release-link");
  var releaseNote = document.getElementById("release-note");
  var statsNote = document.getElementById("stats-note");
  var query = new URLSearchParams(window.location.search);
  var ownerModeKey = "structured-writing-owner-mode";
  var ownerModeParam = config.ownerModeQueryParam || "owner";

  function isOwnerMode() {
    try {
      return window.localStorage.getItem(ownerModeKey) === "1";
    } catch (error) {
      return false;
    }
  }

  function applyOwnerModeFromUrl() {
    var requestedMode = query.get(ownerModeParam);
    if (requestedMode !== "1" && requestedMode !== "0") return;

    try {
      if (requestedMode === "1") {
        window.localStorage.setItem(ownerModeKey, "1");
      } else {
        window.localStorage.removeItem(ownerModeKey);
      }
    } catch (error) {
      // The page still works when storage is unavailable.
    }

    var cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete(ownerModeParam);
    window.history.replaceState({}, document.title, cleanUrl);
  }

  function getSessionId() {
    var key = "structured-writing-session";
    try {
      var existing = window.sessionStorage.getItem(key);
      if (existing) return existing;
      var created = window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.sessionStorage.setItem(key, created);
      return created;
    } catch (error) {
      return "";
    }
  }

  function track(eventName, extra) {
    if (!config.analyticsEndpoint || isOwnerMode()) return;

    var payload = Object.assign({
      event: eventName,
      resource_id: assetName,
      session_id: getSessionId(),
      referrer: document.referrer || "",
      page: window.location.pathname,
      utm_source: query.get("utm_source") || "",
      utm_medium: query.get("utm_medium") || "",
      utm_campaign: query.get("utm_campaign") || ""
    }, extra || {});

    var body = JSON.stringify(payload);
    try {
      var sent = navigator.sendBeacon(
        config.analyticsEndpoint,
        new Blob([body], { type: "text/plain;charset=UTF-8" })
      );
      if (sent) return;
    } catch (error) {
      // Fall through to fetch for browsers without sendBeacon support.
    }

    window.fetch(config.analyticsEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true,
      mode: "cors"
    }).catch(function () {});
  }

  function setDownloadUrl(url) {
    if (!downloadButton) return;
    downloadButton.href = isOwnerMode() ? url : (config.downloadEndpoint || url);
  }

  function loadRelease() {
    return window.fetch(apiBase + "/releases/latest", {
      headers: { Accept: "application/vnd.github+json" }
    })
      .then(function (response) {
        if (!response.ok) throw new Error("GitHub API returned " + response.status);
        return response.json();
      })
      .then(function (release) {
        var asset = (release.assets || []).find(function (item) {
          return item.name === assetName;
        });
        var fallbackUrl = "https://github.com/" + repository +
          "/releases/latest/download/" + assetName;
        setDownloadUrl((asset && asset.browser_download_url) || fallbackUrl);
        releaseLink.href = release.html_url;
        releaseNote.textContent = "最新版本 " + release.tag_name +
          (asset ? " · 已有 " + asset.download_count + " 次 Release 下载" : " · 等待发布插件资产");
      })
      .catch(function () {
        setDownloadUrl("https://github.com/" + repository +
          "/releases/latest/download/" + assetName);
        releaseNote.textContent = "最新版本信息暂时无法读取，可直接下载或查看 GitHub Release。";
      });
  }

  applyOwnerModeFromUrl();
  track("page_view");
  if (isOwnerMode()) {
    statsNote.textContent = "所有者模式 · 本浏览器的访问和下载不会记录";
  } else if (!config.analyticsEndpoint) {
    statsNote.textContent = "开源项目 · 页面统计未启用";
  } else {
    statsNote.textContent = "开源项目 · 仅记录匿名页面和下载事件";
  }

  if (downloadButton) {
    downloadButton.addEventListener("click", function () {
      if (!config.downloadEndpoint) {
        track("download_click", { version: releaseNote.textContent });
      }
    });
  }

  if (releaseLink) {
    releaseLink.addEventListener("click", function () {
      track("github_click");
    });
  }

  loadRelease();
})();
