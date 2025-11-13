// Settings page logic
const app = getApp()

Page({
  data: {
    // Voice settings
    voiceSettings: {
      enabled: true,
      speed: 1.0,
      volume: 0.8,
      autoPlay: true
    },
    
    // Display data
    volumeDisplay: 80,
    speedDisplay: 100,
    
    // System settings
    systemSettings: {
      debugMode: false,
      autoConnect: true,
      dataCache: true
    },
    
    // Server settings
    serverSettings: {
      apiBaseUrl: 'http://localhost:5000/api',
      customUrl: '',
      useCustomUrl: false
    },
    
    // System information
    systemInfo: null,
    appInfo: {
      version: '1.0.0',
      buildTime: '2025-09-12',
      developer: 'Navigation System Development Team'
    },
    
    // UI state
    showServerConfig: false,
    testing: false
  },

  onLoad: function (options) {
    console.log('Settings page loaded')
    this.loadSettings()
    this.getSystemInfo()
  },

  onShow: function () {
    // Sync global settings
    this.syncGlobalSettings()
  },

  // Load settings
  loadSettings: function() {
    try {
      // Load voice settings
      const voiceSettings = wx.getStorageSync('voiceSettings')
      if (voiceSettings) {
        this.setData({
          voiceSettings: { ...this.data.voiceSettings, ...voiceSettings }
        })
      }
      
      // Load system settings
      const systemSettings = wx.getStorageSync('systemSettings')
      if (systemSettings) {
        this.setData({
          systemSettings: { ...this.data.systemSettings, ...systemSettings }
        })
      }
      
      // Load server settings
      const serverSettings = wx.getStorageSync('serverSettings')
      if (serverSettings) {
        this.setData({
          serverSettings: { ...this.data.serverSettings, ...serverSettings }
        })
        
        // If custom URL exists and is enabled, update global configuration
        if (serverSettings.useCustomUrl && serverSettings.customUrl) {
          app.globalData.apiBaseUrl = serverSettings.customUrl
        }
      }
      
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  },

  // Sync global settings
  syncGlobalSettings: function() {
    const globalVoice = app.globalData.voiceSettings
    this.setData({
      voiceSettings: globalVoice
    })
  },

  // Get system information
  getSystemInfo: function() {
    wx.getSystemInfo({
      success: (res) => {
        this.setData({
          systemInfo: res
        })
      },
      fail: (err) => {
        console.error('Failed to get system information:', err)
      }
    })
  },

  // Voice switch toggle
  onVoiceEnabledChange: function(e) {
    const enabled = e.detail.value
    this.updateVoiceSetting('enabled', enabled)
    
    wx.showToast({
      title: enabled ? 'Voice enabled' : 'Voice disabled',
      icon: 'success'
    })
  },

  // Auto play toggle
  onAutoPlayChange: function(e) {
    const autoPlay = e.detail.value
    this.updateVoiceSetting('autoPlay', autoPlay)
  },

  // Voice speed adjustment
  onSpeedChange: function(e) {
    const speed = parseFloat(e.detail.value)
    this.updateVoiceSetting('speed', speed)
    
    this.setData({
      'voiceSettings.speed': speed
    })
  },

  // Volume adjustment
  onVolumeChange: function(e) {
    const volume = parseFloat(e.detail.value)
    this.updateVoiceSetting('volume', volume)
    
    this.setData({
      'voiceSettings.volume': volume,
      volumeDisplay: Math.round(volume * 100)
    })
  },

  // Update voice settings
  updateVoiceSetting: function(key, value) {
    const voiceSettings = { ...this.data.voiceSettings }
    voiceSettings[key] = value
    
    this.setData({ voiceSettings })
    
    // Save to local storage
    try {
      wx.setStorageSync('voiceSettings', voiceSettings)
      
      // Update global settings
      app.globalData.voiceSettings = voiceSettings
      app.saveVoiceSettings()
    } catch (e) {
      console.error('Failed to save voice settings:', e)
    }
  },

  // Voice test (using local templates)
  onVoiceTest: function() {
    this.setData({ testing: true })
    
    app.testVoice((success) => {
      this.setData({ testing: false })
      
      if (success) {
        wx.showToast({
          title: 'Test completed',
          icon: 'success'
        })
      } else {
        wx.showToast({
          title: 'Test failed',
          icon: 'none'
        })
      }
    })
  },

  // Debug mode toggle
  onDebugModeChange: function(e) {
    const debugMode = e.detail.value
    this.updateSystemSetting('debugMode', debugMode)
  },

  // Auto connect toggle
  onAutoConnectChange: function(e) {
    const autoConnect = e.detail.value
    this.updateSystemSetting('autoConnect', autoConnect)
  },

  // Data cache toggle
  onDataCacheChange: function(e) {
    const dataCache = e.detail.value
    this.updateSystemSetting('dataCache', dataCache)
  },

  // Update system settings
  updateSystemSetting: function(key, value) {
    const systemSettings = { ...this.data.systemSettings }
    systemSettings[key] = value
    
    this.setData({ systemSettings })
    
    // Save to local storage
    try {
      wx.setStorageSync('systemSettings', systemSettings)
    } catch (e) {
      console.error('Failed to save system settings:', e)
    }
  },

  // Show server configuration
  onShowServerConfig: function() {
    this.setData({
      showServerConfig: true,
      'serverSettings.customUrl': this.data.serverSettings.customUrl || this.data.serverSettings.apiBaseUrl
    })
  },

  // Hide server configuration
  onHideServerConfig: function() {
    this.setData({
      showServerConfig: false
    })
  },

  // Custom URL input
  onCustomUrlInput: function(e) {
    this.setData({
      'serverSettings.customUrl': e.detail.value
    })
  },

  // Use custom URL toggle
  onUseCustomUrlChange: function(e) {
    const useCustomUrl = e.detail.value
    this.setData({
      'serverSettings.useCustomUrl': useCustomUrl
    })
  },

  // Save server settings
  onSaveServerSettings: function() {
    const { serverSettings } = this.data
    
    // Validate URL format
    if (serverSettings.useCustomUrl && serverSettings.customUrl) {
      if (!this.isValidUrl(serverSettings.customUrl)) {
        wx.showToast({
          title: 'Incorrect URL format',
          icon: 'none'
        })
        return
      }
    }
    
    try {
      wx.setStorageSync('serverSettings', serverSettings)
      
      // Update global API address
      if (serverSettings.useCustomUrl && serverSettings.customUrl) {
        app.globalData.apiBaseUrl = serverSettings.customUrl
      } else {
        app.globalData.apiBaseUrl = 'http://localhost:5000/api'
      }
      
      this.setData({
        showServerConfig: false
      })
      
      wx.showToast({
        title: 'Settings saved',
        icon: 'success'
      })
    } catch (e) {
      console.error('Failed to save server settings:', e)
      wx.showToast({
        title: 'Save failed',
        icon: 'none'
      })
    }
  },

  // Validate URL format
  isValidUrl: function(url) {
    try {
      new URL(url)
      return url.startsWith('http://') || url.startsWith('https://')
    } catch (e) {
      return false
    }
  },

  // Connection test
  onTestConnection: function() {
    this.setData({ testing: true })
    
    app.request({
      url: '/system/status',
      success: (data) => {
        this.setData({ testing: false })
        wx.showModal({
          title: 'Connection test successful',
          content: `Server version: ${data.version}\nSystem status: ${data.status}\nMap count: ${data.maps_count}`,
          showCancel: false
        })
      },
      fail: (err) => {
        this.setData({ testing: false })
        wx.showModal({
          title: 'Connection test failed',
          content: 'Unable to connect to server, please check network settings and server address',
          showCancel: false
        })
      }
    })
  },

  // Get local IP (for real device debugging tips)
  onGetLocalIP: function() {
    wx.showModal({
      title: 'Real Device Debug Configuration',
      content: '1. Ensure phone and computer are on the same WiFi network\n2. Check computer IP address (cmd -> ipconfig)\n3. Replace localhost with computer IP\nExample: http://192.168.1.100:5000/api',
      showCancel: false,
      confirmText: 'I understand'
    })
  },

  // Clear cache
  onClearCache: function() {
    wx.showModal({
      title: 'Clear Cache',
      content: 'This will clear all local cache data, including recently used map records. Are you sure you want to continue?',
      success: (res) => {
        if (res.confirm) {
          this.clearAllCache()
        }
      }
    })
  },

  // Clear all cache
  clearAllCache: function() {
    try {
      const keysToKeep = ['voiceSettings', 'systemSettings', 'serverSettings']
      const { keys } = wx.getStorageInfoSync()
      
      keys.forEach(key => {
        if (!keysToKeep.includes(key)) {
          wx.removeStorageSync(key)
        }
      })
      
      wx.showToast({
        title: 'Cache cleared',
        icon: 'success'
      })
    } catch (e) {
      console.error('Failed to clear cache:', e)
      wx.showToast({
        title: 'Clear failed',
        icon: 'none'
      })
    }
  },

  // Restore default settings
  onResetSettings: function() {
    wx.showModal({
      title: 'Restore Default Settings',
      content: 'This will restore all settings to default values. Are you sure you want to continue?',
      success: (res) => {
        if (res.confirm) {
          this.resetToDefaults()
        }
      }
    })
  },

  // Reset to default settings
  resetToDefaults: function() {
    try {
      // Reset voice settings
      const defaultVoice = {
        enabled: true,
        speed: 1.0,
        volume: 0.8,
        autoPlay: true
      }
      
      // Reset system settings
      const defaultSystem = {
        debugMode: false,
        autoConnect: true,
        dataCache: true
      }
      
      // Reset server settings
      const defaultServer = {
        apiBaseUrl: 'http://localhost:5000/api',
        customUrl: '',
        useCustomUrl: false
      }
      
      this.setData({
        voiceSettings: defaultVoice,
        systemSettings: defaultSystem,
        serverSettings: defaultServer
      })
      
      // Save to storage
      wx.setStorageSync('voiceSettings', defaultVoice)
      wx.setStorageSync('systemSettings', defaultSystem)
      wx.setStorageSync('serverSettings', defaultServer)
      
      // Update global settings
      app.globalData.voiceSettings = defaultVoice
      app.globalData.apiBaseUrl = defaultServer.apiBaseUrl
      
      wx.showToast({
        title: 'Default settings restored',
        icon: 'success'
      })
    } catch (e) {
      console.error('Failed to reset settings:', e)
      wx.showToast({
        title: 'Reset failed',
        icon: 'none'
      })
    }
  },

  // About application
  onAbout: function() {
    const content = `Navigation System for the Visually Impaired v${this.data.appInfo.version}\n\nIndoor navigation application designed specifically for visually impaired users\n\nDevelopment Team: ${this.data.appInfo.developer}\nBuild Time: ${this.data.appInfo.buildTime}\n\nThank you for using our application!`
    
    wx.showModal({
      title: 'About Application',
      content: content,
      showCancel: false,
      confirmText: 'OK'
    })
  }
})
