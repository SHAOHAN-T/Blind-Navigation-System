// Home page logic
const app = getApp()
const { 
  announcePageEnter, 
  announceAction, 
  announceButton,
  announceError,
  announceSuccess 
} = require('../../utils/voiceAnnouncement.js')

Page({
  data: {
    // Page data
    maps: [],           // Map list
    recentMaps: [],     // Recently used maps
    systemStatus: null, // System status
    loading: true,      // Loading status
    
  },

  onLoad: function (options) {
    console.log('Home page loading')
    this.initPage()
  },

  onShow: function () {
    console.log('Home page showing')
    // 🔊 Voice announcement: Page entry
    announcePageEnter('Home', 'Welcome to the navigation system, browse maps and start navigation')
    this.refreshData()
  },

  onReady: function () {
    console.log('Home page rendering complete')
  },

  onHide: function () {
    console.log('Home page hidden')
  },

  onUnload: function () {
    console.log('Home page unloaded')
  },

  // Pull down to refresh
  onPullDownRefresh: function () {
    console.log('Pull down refresh')
    this.refreshData(() => {
      wx.stopPullDownRefresh()
    })
  },

  // Initialize page
  initPage: function() {
    // Set navigation bar title
    wx.setNavigationBarTitle({
      title: 'Navigation System for the Blind'
    })

    // Load data
    this.loadData()
  },

  // Load data
  loadData: function() {
    this.setData({ loading: true })

    // Load multiple data in parallel
    Promise.all([
      this.loadMaps(),
      this.loadSystemStatus(),
      this.loadRecentMaps()
    ]).then(() => {
      this.setData({ loading: false })
    }).catch((err) => {
      console.error('Data loading failed:', err)
      this.setData({ loading: false })
      wx.showToast({
        title: 'Data Loading Failed',
        icon: 'none'
      })
    })
  },

  // Refresh data
  refreshData: function(callback) {
    this.loadData()
    setTimeout(() => {
      callback && callback()
    }, 1000)
  },

  // Load map list
  loadMaps: function() {
    return new Promise((resolve, reject) => {
      app.getMaps((maps) => {
        // Only show first 3 maps as quick access
        this.setData({
          maps: maps.slice(0, 3)
        })
        resolve(maps)
      })
    })
  },

  // Load system status
  loadSystemStatus: function() {
    return new Promise((resolve, reject) => {
      app.request({
        url: '/system/status',
        success: (data) => {
          this.setData({
            systemStatus: data
          })
          resolve(data)
        },
        fail: (err) => {
          console.error('Failed to get system status:', err)
          resolve(null)
        }
      })
    })
  },

  // Load recently used maps
  loadRecentMaps: function() {
    return new Promise((resolve) => {
      try {
        const recent = wx.getStorageSync('recentMaps') || []
        this.setData({
          recentMaps: recent.slice(0, 2) // Show most recent 2
        })
        resolve(recent)
      } catch (e) {
        console.error('Failed to read recent maps:', e)
        resolve([])
      }
    })
  },

  // Save recently used maps
  saveRecentMap: function(mapInfo) {
    try {
      let recent = wx.getStorageSync('recentMaps') || []
      
      // Remove existing same map
      recent = recent.filter(item => item.id !== mapInfo.id)
      
      // Add to the beginning
      recent.unshift({
        id: mapInfo.id,
        name: mapInfo.name,
        lastUsed: new Date().toISOString()
      })
      
      // Keep only the most recent 5
      recent = recent.slice(0, 5)
      
      wx.setStorageSync('recentMaps', recent)
      this.setData({
        recentMaps: recent.slice(0, 2)
      })
    } catch (e) {
      console.error('Failed to save recent maps:', e)
    }
  },

  // Click map card
  onMapTap: function(e) {
    const mapId = e.currentTarget.dataset.mapId
    const mapName = e.currentTarget.dataset.mapName
    
    // 🔊 Voice announcement: Map selection
    announceAction('Map Selection', `Selected map: ${mapName}`)
    
    if (!mapId) {
      const errorMsg = 'Invalid map ID'
      announceError(errorMsg)
      wx.showToast({
        title: 'Invalid Map ID',
        icon: 'none'
      })
      return
    }

    // Save to recently used
    this.saveRecentMap({
      id: mapId,
      name: mapName
    })

    // 🔊 Voice announcement: Navigation start
    announceAction('Start Navigation', `Navigating to map: ${mapName}`)

    // Navigate to navigation page
    wx.navigateTo({
      url: `/pages/navigation/navigation?mapId=${mapId}&mapName=${encodeURIComponent(mapName)}`
    })
  },

  // View all maps
  onViewAllMaps: function() {
    // 🔊 Voice announcement: Skip button click, page enter will handle it
    // announceButton('View All Maps', 'Opening map list page')
    
    wx.switchTab({
      url: '/pages/map-list/map-list'
    })
  },

  // Voice test (using local templates)
  onVoiceTest: function() {
    // 🔊 Voice announcement: Button click
    announceButton('Voice Test', 'Testing voice functionality')
    
    wx.showLoading({
      title: 'Testing voice...'
    })

    app.testVoice((success) => {
      wx.hideLoading()
      
      if (success) {
        // 🔊 Voice announcement: Test successful
        announceSuccess('Voice test completed successfully')
        
        wx.showToast({
          title: 'Voice Test Complete',
          icon: 'success'
        })
      } else {
        // 🔊 Voice announcement: Test failed
        announceError('Voice test failed, please try again')
        
        wx.showToast({
          title: 'Voice Test Failed',
          icon: 'none'
        })
      }
    })
  },

  // Navigate to settings page
  onGoToSettings: function() {
    // 🔊 Voice announcement: Button click
    announceButton('Settings', 'Opening settings page')
    
    wx.switchTab({
      url: '/pages/settings/settings'
    })
  },

  // View help
  onShowHelp: function() {
    wx.showModal({
      title: 'User Guide',
      content: '1. Select a map to start navigation\n2. Set voice parameters\n3. Follow voice guidance to reach destination\n\nFor device testing, please configure server address in settings.',
      showCancel: false,
      confirmText: 'Got it'
    })
  },

  // Show system information
  onShowSystemInfo: function() {
    const status = this.data.systemStatus
    if (!status) {
      wx.showToast({
        title: 'Loading System Info',
        icon: 'none'
      })
      return
    }

    const info = `System Version: ${status.version}\nUptime: ${status.uptime_formatted}\nMaps Count: ${status.maps_count}\nToday's Navigation: ${status.navigation_requests_today} times`
    
    wx.showModal({
      title: 'System Information',
      content: info,
      showCancel: false,
      confirmText: 'OK'
    })
  }
})
