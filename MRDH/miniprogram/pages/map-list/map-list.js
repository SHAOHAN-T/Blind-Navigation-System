// Map list page logic
const app = getApp()
const { 
  announcePageEnter, 
  announceAction, 
  announceButton,
  playDynamicVoice 
} = require('../../utils/voiceAnnouncement.js')

Page({
  data: {
    maps: [],
    loading: true,
    refreshing: false,
    searchKeyword: '',
    filteredMaps: [],
    showSearch: false
  },

  onLoad: function (options) {
    console.log('Map list page loaded')
    this.loadMaps()
  },

  onShow: function () {
    // 🔊 Voice announcement: page enter
    announcePageEnter('Map List', 'Browse available maps and start navigation')
    
    // Refresh data when page shows
    this.loadMaps()
  },

  onPullDownRefresh: function () {
    console.log('Pull down to refresh map list')
    this.refreshMaps()
  },

  onReachBottom: function () {
    console.log('Reached bottom, load more')
    // If pagination is available, can implement here
  },

  // Load map list
  loadMaps: function() {
    this.setData({ loading: true })

    app.getMaps((maps) => {
      this.setData({
        maps: maps,
        filteredMaps: maps,
        loading: false
      })
    })
  },

  // Refresh map list
  refreshMaps: function() {
    this.setData({ refreshing: true })
    
    app.getMaps((maps) => {
      this.setData({
        maps: maps,
        filteredMaps: this.filterMaps(maps, this.data.searchKeyword),
        refreshing: false
      })
      
      wx.stopPullDownRefresh()
      wx.showToast({
        title: 'Refresh successful',
        icon: 'success'
      })
    })
  },

  // Search functionality
  onSearchInput: function(e) {
    const keyword = e.detail.value
    this.setData({
      searchKeyword: keyword,
      filteredMaps: this.filterMaps(this.data.maps, keyword)
    })
  },

  // Filter maps
  filterMaps: function(maps, keyword) {
    if (!keyword.trim()) {
      return maps
    }
    
    return maps.filter(map => 
      map.name.toLowerCase().includes(keyword.toLowerCase()) ||
      (map.id && map.id.toString().includes(keyword))
    )
  },

  // Toggle search box display
  onToggleSearch: function() {
    this.setData({
      showSearch: !this.data.showSearch,
      searchKeyword: '',
      filteredMaps: this.data.maps
    })
  },

  // Clear search
  onClearSearch: function() {
    this.setData({
      searchKeyword: '',
      filteredMaps: this.data.maps
    })
  },

  // Click map item
  onMapTap: function(e) {
    const { mapId, mapName } = e.currentTarget.dataset
    
    if (!mapId) {
      wx.showToast({
        title: 'Map Information Error',
        icon: 'none'
      })
      return
    }

    // Save to recently used
    this.saveRecentMap({
      id: mapId,
      name: mapName
    })

    // Navigate to navigation page
    wx.navigateTo({
      url: `/pages/navigation/navigation?mapId=${mapId}&mapName=${encodeURIComponent(mapName)}`
    })
  },

  // View map details
  onMapDetail: function(e) {
    const { mapId, mapName } = e.currentTarget.dataset
    
    wx.showLoading({
      title: 'Loading map details...'
    })

    app.getMapDetail(mapId, (mapData) => {
      wx.hideLoading()
      
      // Show map details popup
      this.showMapDetail(mapData)
    })
  },

  // Show map details
  showMapDetail: function(mapData) {
    const roomList = mapData.rooms.map(room => room.name).join(', ') || 'No rooms available'
    
    // 🔊 Voice announcement: Map details information
    const roomCount = mapData.rooms.length
    const roomNames = mapData.rooms.map(room => room.name).join(', ')
    
    let voiceContent = `Map ${mapData.name} details: `
    voiceContent += `Size ${mapData.width} by ${mapData.height}, `
    voiceContent += `${roomCount} room${roomCount !== 1 ? 's' : ''}`
    
    if (roomCount > 0) {
      voiceContent += `. Rooms include: ${roomNames}`
    } else {
      voiceContent += `. No rooms available`
    }
    
    // Play voice announcement
    playDynamicVoice(voiceContent)
    
    wx.showModal({
      title: mapData.name,
      content: `Map Size: ${mapData.width} × ${mapData.height}\nRoom Count: ${mapData.rooms.length}\nRooms: ${roomList}\nCreated: ${mapData.created_at ? new Date(mapData.created_at).toLocaleDateString() : 'Unknown'}`,
      showCancel: false,
      confirmText: 'OK'
    })
  },

  // Quick navigation to room
  onQuickNavigation: function(e) {
    const { mapId, mapName } = e.currentTarget.dataset
    console.log('🚀 Quick navigation clicked:', { mapId, mapName })
    console.log('📱 Event object:', e)
    console.log('🎯 Dataset:', e.currentTarget.dataset)
    
    if (!mapId) {
      console.error('❌ mapId is empty, cannot navigate')
      wx.showToast({
        title: 'mapId is empty',
        icon: 'none'
      })
      return
    }
    
    // 🔊 Voice announcement: Button click
    announceButton('Quick Navigation', `Starting navigation to map: ${mapName}`)
    
    // Since navigation page is a tabBar page, cannot use navigateTo to pass parameters
    // Need to use global data to pass parameters
    const app = getApp()
    app.globalData.quickNavigationParams = {
      mapId: parseInt(mapId),
      mapName: mapName,
      timestamp: Date.now()
    }
    
    console.log('🔗 Set global navigation parameters:', app.globalData.quickNavigationParams)
    
    // Navigate to navigation tabBar page
    wx.switchTab({
      url: '/pages/navigation/navigation',
      success: (res) => {
        console.log('✅ Navigation successful:', res)
      },
      fail: (err) => {
        console.error('❌ Navigation failed:', err)
        wx.showToast({
          title: 'Navigation Failed',
          icon: 'none'
        })
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
    } catch (e) {
      console.error('Failed to save recent maps:', e)
    }
  },

  // Map sorting
  onSortMaps: function() {
    const sortOptions = ['Sort by Name', 'Sort by Creation Time', 'Sort by Room Count']
    
    wx.showActionSheet({
      itemList: sortOptions,
      success: (res) => {
        this.sortMaps(res.tapIndex)
      }
    })
  },

  // Sort maps
  sortMaps: function(sortType) {
    let sortedMaps = [...this.data.filteredMaps]
    
    switch (sortType) {
      case 0: // Sort by name
        sortedMaps.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 1: // Sort by creation time
        sortedMaps.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        break
      case 2: // Sort by room count
        sortedMaps.sort((a, b) => (b.room_count || 0) - (a.room_count || 0))
        break
    }
    
    this.setData({
      filteredMaps: sortedMaps
    })
    
    wx.showToast({
      title: 'Sorting Complete',
      icon: 'success'
    })
  },

  // Get map status text
  getMapStatusText: function(map) {
    if (map.room_count === 0) {
      return 'No rooms'
    } else if (map.room_count < 5) {
      return 'Few rooms'
    } else {
      return 'Rich in rooms'
    }
  },

  // Format time
  formatTime: function(timeString) {
    if (!timeString) return 'Unknown time'
    
    const date = new Date(timeString)
    const now = new Date()
    const diff = now - date
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (days > 0) {
      return `${days} days ago`
    } else if (hours > 0) {
      return `${hours} hours ago`
    } else if (minutes > 0) {
      return `${minutes} minutes ago`
    } else {
      return 'Just now'
    }
  }
})
