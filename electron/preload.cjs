const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("centralDesktop", {
  platform: process.platform,
  isDesktop: true,
});
