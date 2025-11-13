// Mini program main application file
App({
  globalData: {
    // API server address configuration
    // 🔧 Real device debugging: use development machine's LAN IP address
    apiBaseUrl: 'http://192.168.0.100:5000/api',
    
    // 🔧 Local development: use localhost (development tools only)
    // For real device testing, replace localhost with your computer's IP address
    // Current WiFi IP: 10.100.10.182
    // apiBaseUrl: 'http://127.0.0.1:5000/api',  // Updated for real device testing
    
    // 💡 Tip: IP address needs to be updated for different network environments
    // View current IP: enter ipconfig (Windows) or ifconfig (Mac/Linux) in command line
    
    // User information
    userInfo: null,
    
    // Current map information
    currentMap: null,
    
    // Quick navigation parameters
    quickNavigationParams: null,
    
    // Current position (simulated)
    currentPosition: { x: 0, y: 0 },
    
    // Navigation state
    navigationActive: false,
    currentPath: null,
    currentInstructions: [],
    
    // Voice settings
    voiceSettings: {
      enabled: true,
      speed: 1.0,
      volume: 0.8,
      autoPlay: true
    }
  },

  onLaunch: function () {
    console.log('Navigation mini program launched')
    
    // Check for updates
    this.checkForUpdate()
    
    // Initialize voice settings
    this.initVoiceSettings()
    
    // 🔊 Initialize page voice announcement service
    this.initPageVoiceAnnouncement()
    
    // Get system information
    this.getSystemInfo()
  },

  onShow: function () {
    console.log('Mini program displayed')
  },

  onHide: function () {
    console.log('Mini program hidden')
  },

  onError: function (msg) {
    console.error('Mini program error:', msg)
  },

  // Check for mini program update
  checkForUpdate: function() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager()
      
      updateManager.onCheckForUpdate(function (res) {
        if (res.hasUpdate) {
          console.log('New version found')
        }
      })

      updateManager.onUpdateReady(function () {
        wx.showModal({
          title: 'Update提示',
          content: 'New version is ready, whether to restart the application?',
          success: function (res) {
            if (res.confirm) {
              updateManager.applyUpdate()
            }
          }
        })
      })

      updateManager.onUpdateFailed(function () {
        wx.showToast({
          title: 'Update failed',
          icon: 'none'
        })
      })
    }
  },

  // Initialize voice settings
  initVoiceSettings: function() {
    try {
      const settings = wx.getStorageSync('voiceSettings')
      if (settings) {
        this.globalData.voiceSettings = { ...this.globalData.voiceSettings, ...settings }
      }
    } catch (e) {
      console.error('Read voice settings failed:', e)
    }
  },

  // 🔊 Initialize local voice service (using templates)
  initPageVoiceAnnouncement: function() {
    console.log('🔊 Initialize local voice service...')
    
    try {
      // Import local voice service
      const { getLocalVoiceService } = require('./utils/localVoiceService.js')
      
      // Get service instance
      const localVoice = getLocalVoiceService()
      
      // Initialize local voice service (loads manifests)
      localVoice.initialize().then(() => {
        console.log('✅ Local voice service initialization completed')
        
        // Save service instance to global data
        this.globalData.localVoiceService = localVoice
        
        // Also keep voiceAnnouncementService for backward compatibility
        const voiceAnnouncementModule = require('./utils/voiceAnnouncement.js')
        this.globalData.voiceAnnouncementService = voiceAnnouncementModule.getVoiceAnnouncementService()
        
      }).catch((error) => {
        console.error('❌ Local voice service initialization failed:', error)
      })
      
    } catch (error) {
      console.error('❌ Unable to load local voice service:', error)
    }
  },

  // Save voice settings
  saveVoiceSettings: function() {
    try {
      wx.setStorageSync('voiceSettings', this.globalData.voiceSettings)
    } catch (e) {
      console.error('Save voice settings failed:', e)
    }
  },

  // Get system information
  getSystemInfo: function() {
    wx.getSystemInfo({
      success: (res) => {
        this.globalData.systemInfo = res
        console.log('System information:', res)
      },
      fail: (err) => {
        console.error('Get system information failed:', err)
      }
    })
  },

  // API request encapsulation
  request: function(options) {
    const { url, method = 'GET', data = {}, success, fail, complete, timeout } = options
    
    // Show loading prompt
    if (options.showLoading !== false) {
      wx.showLoading({
        title: 'Requesting...',
        mask: true
      })
    }

    wx.request({
      url: this.globalData.apiBaseUrl + url,
      method: method,
      data: data,
      timeout: timeout || 30000,  // Default 30 seconds timeout, can be overridden
      header: {
        'Content-Type': 'application/json'
      },
      success: (res) => {
        console.log('API request successful:', url, res.data)
        
        // Compatible with different API response formats
        if (res.statusCode === 200) {
          if (res.data && res.data.code === 200) {
            // Standard format: {code: 200, data: {...}}
            success && success(res.data.data, res.data)
          } else if (res.data && !res.data.hasOwnProperty('code')) {
            // Directly return data format
            success && success(res.data, {code: 200, data: res.data})
          } else {
            const errorMsg = res.data?.message || 'Request failed'
            console.error('API business error:', errorMsg)
            
            wx.showToast({
              title: errorMsg,
              icon: 'none',
              duration: 2000
            })
            
            fail && fail(new Error(errorMsg))
          }
        } else {
          console.error('HTTP request failed:', res.statusCode)
          fail && fail(new Error(`HTTP ${res.statusCode}`))
        }
      },
      fail: (err) => {
        console.error('API request failed:', url, err)
        
        // Network error handling
        let errorMsg = 'Network connection failed'
        if (err.errMsg) {
          if (err.errMsg.includes('timeout')) {
            errorMsg = 'Request timeout, please check the network'
          } else if (err.errMsg.includes('fail')) {
            errorMsg = 'Unable to connect to the server, please check the network settings'
          }
        }
        
        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 3000
        })
        
        fail && fail(err)
      },
      complete: () => {
        if (options.showLoading !== false) {
          wx.hideLoading()
        }
        complete && complete()
      }
    })
  },

  // Get map list
  getMaps: function(callback) {
    this.request({
      url: '/maps',
      success: (data) => {
        callback && callback(data)
      },
      fail: (err) => {
        console.error('Get map list failed:', err)
      }
    })
  },

  // Get map detail
  getMapDetail: function(mapId, callback) {
    console.log('🔗 Request map detail API:', mapId)
    this.request({
      url: `/maps/${mapId}`,
      success: (data) => {
        console.log('✅ Map detail API successful response:', data)
        console.log('📋 API response analysis:', {
          hasData: !!data,
          hasRooms: !!(data && data.rooms),
          roomsCount: data && data.rooms ? data.rooms.length : 0,
          mapType: data ? data.map_type : 'unknown',
          mapName: data ? data.name : 'unknown'
        })
        this.globalData.currentMap = data
        callback && callback(data)
      },
      fail: (err) => {
        console.error('❌ Get map detail failed:', err)
        console.log('🔍 Failure details:', { mapId, error: err })
        callback && callback(null)
      }
    })
  },

  // Calculate path
  calculatePath: function(options, callback) {
    const url = options.is_3d ? '/navigation/path/3d' : '/navigation/path';
    console.log('Path calculation API:', url, options);
    
    // 🌐 Add language parameter
    const requestData = {
      ...options,
        language: 'en'  // Use English
    };
    
    this.request({
      url: url,
      method: 'POST',
      data: requestData,
      success: (data) => {
        this.globalData.currentPath = data.path
        this.globalData.currentInstructions = data.instructions
        callback && callback(data)
      },
      fail: (err) => {
        console.error('Path calculation failed:', err)
        callback && callback(null)
      }
    })
  },

  // Calculate the path to the room
  calculatePathToRoom: function(mapId, roomId, callback, is3D = false, startFloor = 1) {
    const url = is3D ? '/navigation/path/3d/room' : '/navigation/path/room';
    const data = {
      map_id: mapId,
      room_id: roomId,
      language: 'en'  // 🌐 Use English language parameter
    };
    
    if (is3D) {
      data.start_floor = startFloor;
    }
    
    console.log('🚀 Room path calculation API call details:');
    console.log('   - URL:', url);
    console.log('   - is3D parameter:', is3D, '(type:', typeof is3D, ')');
    console.log('   - startFloor:', startFloor);
    console.log('   - request data:', data);
    
    this.request({
      url: url,
      method: 'POST',
      data: data,
      success: (data) => {
        console.log('✅ Path calculation API successful response:', data)
        console.log('📊 API response analysis:', {
          hasPath: !!(data && data.path),
          hasInstructions: !!(data && data.instructions),
          pathLength: data && data.path ? data.path.length : 0,
          instructionsCount: data && data.instructions ? data.instructions.length : 0,
          target_room: data && data.target_room ? data.target_room : null
        })
        
        this.globalData.currentPath = data.path
        this.globalData.currentInstructions = data.instructions
        
        console.log('🔄 Call page callback function')
        callback && callback(data)
      },
      fail: (err) => {
        console.error('❌ Path calculation API failed:', err)
        console.log('📋 Failure details:', {
          error: err,
          url: url,
          data: data
        })
        callback && callback(null)
      }
    })
  },

  // Voice test using local templates (for testing purposes)
  testVoice: function(callback) {
    console.log('🎤 Testing local voice templates...')
    const { getLocalVoiceService } = require('./utils/localVoiceService.js')
    const localVoice = getLocalVoiceService()
    
    // Play a test navigation template
    localVoice.playPageVoice('action_success_en', 'urgent')
    
    setTimeout(() => {
      callback && callback(true)
    }, 500)
  },

  // Play voice
  playVoice: function(audioUrl, callback) {
    if (!this.globalData.voiceSettings.enabled) {
      console.log('Voice playback is disabled')
      callback && callback()
      return null
    }

    const innerAudioContext = wx.createInnerAudioContext()
    
    innerAudioContext.src = this.globalData.apiBaseUrl.replace('/api', '') + audioUrl
    innerAudioContext.volume = this.globalData.voiceSettings.volume
    
    innerAudioContext.onPlay(() => {
      console.log('Voice playback started:', audioUrl)
    })
    
    innerAudioContext.onEnded(() => {
      console.log('Voice playback ended')
      // Automatically destroy audio context
      innerAudioContext.destroy()
      callback && callback()
    })
    
    innerAudioContext.onError((err) => {
      console.error('Voice playback failed:', err)
      // When an error occurs, also destroy the audio context
      innerAudioContext.destroy()
      wx.showToast({
        title: 'Voice playback failed',
        icon: 'none'
      })
      callback && callback(err)
    })

    innerAudioContext.onStop(() => {
      console.log('Voice playback stopped')
      // When manually stopping, destroy the audio context
      innerAudioContext.destroy()
    })
    
    try {
      innerAudioContext.play()
      console.log('Start playing audio:', audioUrl)
    } catch (error) {
      console.error('Play audio failed:', error)
      innerAudioContext.destroy()
      callback && callback(error)
      return null
    }
    
    return innerAudioContext
  },

  // Stop navigation
  stopNavigation: function() {
    this.globalData.navigationActive = false
    this.globalData.currentPath = null
    this.globalData.currentInstructions = []
  },

  // Tool function: show error
  showError: function(message, title = 'Error') {
    wx.showModal({
      title: title,
      content: message,
      showCancel: false,
      confirmText: 'Confirm'
    })
  },

  // Tool function: show success message
  showSuccess: function(message) {
    wx.showToast({
      title: message,
      icon: 'success',
      duration: 2000
    })
  },

  // Tool function: confirm dialog
  confirm: function(message, callback) {
    wx.showModal({
      title: 'Confirm',
      content: message,
      success: (res) => {
        callback && callback(res.confirm)
      }
    })
  }
})
