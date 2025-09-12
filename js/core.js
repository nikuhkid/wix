// core.js
// Utility functions and data handling
(function(projLib){
  'use strict';

  // Validate if string is URL
  projLib.isValidUrl = function(str){
    try {
      const u = new URL(str.startsWith('http') ? str : 'https://' + str);
      return u.hostname.includes('.') || u.hostname === 'localhost';
    } catch { return false; }
  };

  // Escape unsafe text
  projLib.sanitizeText = function(txt){
    const t = document.createElement('div');
    t.textContent = txt;
    return t.innerHTML;
  };

  // Fetch with timeout
  projLib.fetchWithTimeout = function(url, opts, timeoutMs=15000){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, {...opts, signal: controller.signal})
      .finally(()=>clearTimeout(timer));
  };

  // Fetch with retry
  projLib.fetchWithRetry = function(url, opts={}, retries=2, timeoutMs=15000){
    return projLib.fetchWithTimeout(url, opts, timeoutMs)
      .catch(err=>{
        if(retries>0) return projLib.fetchWithRetry(url, opts, retries-1, timeoutMs);
        throw err;
      });
  };

  // Load hub data (JSON)
  projLib.loadHubData = function(path){
    return projLib.fetchWithRetry(path)
      .then(resp=>resp.json())
      .catch(()=>({categories:[]}));
  };

})(window.ProjLib=window.ProjLib||{});
