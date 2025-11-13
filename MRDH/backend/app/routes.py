"""
Main page routes - administration backend pages
"""
from flask import Blueprint, render_template, current_app
from app.services.file_manager import FileManager
from datetime import datetime

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    """Administration backend homepage"""
    try:
        # Get system status information
        file_manager = FileManager(current_app.config['DATA_DIR'])
        
        # Map statistics
        maps_index = file_manager.get_maps_index()
        maps_count = len(maps_index.get('maps', []))
        
        # Today's navigation statistics
        today_logs = file_manager.get_navigation_logs()
        navigation_count = len(today_logs)
        
        # Voice cache statistics (local templates)
        cached_files = 57  # 42 page voices + 15 navigation templates
        
        # Calculate uptime
        start_time = getattr(current_app, 'start_time', datetime.now())
        uptime_seconds = (datetime.now() - start_time).total_seconds()
        uptime_str = f"{int(uptime_seconds // 3600)} hours {int((uptime_seconds % 3600) // 60)} minutes"
        
        stats = {
            'maps_count': maps_count,
            'navigation_count': navigation_count,
            'cached_files': cached_files,
            'uptime': uptime_str
        }
        
        return render_template('index.html', stats=stats)
    
    except Exception as e:
        print(f"Homepage loading error: {e}")
        # If template doesn't exist, return simple JSON response
        return {
            'status': 'ok', 
            'message': 'Navigation System Backend Service is Running',
            'stats': {},
            'error': str(e)
        }

@main_bp.route('/maps')
def map_list():
    """Map list page"""
    try:
        file_manager = FileManager(current_app.config['DATA_DIR'])
        maps_index = file_manager.get_maps_index()
        maps_basic = maps_index.get('maps', [])
        
        # Get complete map data (including entrance and room information)
        maps = []
        for map_basic in maps_basic:
            map_id = map_basic['id']
            map_data = file_manager.get_map_data(map_id)
            if map_data:
                # Merge basic information and detailed information
                map_full = {
                    'id': map_id,
                    'name': map_data.get('name', map_basic.get('name', f'Map{map_id}')),
                    'width': map_data.get('width', map_basic.get('width', 0)),
                    'height': map_data.get('height', map_basic.get('height', 0)),
                    'entrance': map_data.get('entrance', {}),
                    'rooms': map_data.get('rooms', []),
                    'created_at': map_basic.get('created_at', ''),
                    'updated_at': map_basic.get('updated_at', '')
                }
                maps.append(map_full)
            else:
                # If detailed data doesn't exist, use basic information
                maps.append({
                    **map_basic,
                    'entrance': {},
                    'rooms': []
                })
        
        return render_template('map_list.html', maps=maps)
    
    except Exception as e:
        print(f"Map list loading error: {e}")
        return render_template('map_list.html', maps=[], error=str(e))

@main_bp.route('/maps/<int:map_id>')
def map_detail(map_id):
    """Map detail page"""
    try:
        file_manager = FileManager(current_app.config['DATA_DIR'])
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return {'status': 'error', 'message': '地图不存在', 'code': 404}
        
        return render_template('map_detail.html', map_data=map_data)
    
    except Exception as e:
        print(f"Map detail loading error: {e}")
        return {'status': 'error', 'message': str(e), 'code': 500}

@main_bp.route('/editor')
def map_editor():
    """Map editor page"""
    try:
        return render_template('map_editor.html')
    except:
        return {'status': 'ok', 'message': 'Map editor API endpoint', 'editor_url': '/editor'}

@main_bp.route('/editor/3d')
def map_editor_3d():
    """3D map editor page"""
    try:
        return render_template('map_editor_3d.html')
    except Exception as e:
        print(f"3D editor template loading failed: {e}")
        return f"3D map editor template loading failed: {str(e)}", 500

@main_bp.route('/editor/<int:map_id>')
def edit_map(map_id):
    """Edit specified map"""
    try:
        file_manager = FileManager(current_app.config['DATA_DIR'])
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return {'status': 'error', 'message': 'Map does not exist', 'code': 404}
        
        return render_template('map_editor.html', map_data=map_data)
    
    except Exception as e:
        print(f"Map editor loading error: {e}")
        return {'status': 'error', 'message': str(e), 'code': 500}


@main_bp.route('/voice')
def voice_management():
    """Voice management page - Local templates"""
    try:
        # Local voice templates info
        cache_info = {
            'total_files': 57,
            'page_voices': 42,
            'navigation_templates': 15,
            'total_size': 5 * 1024 * 1024,  # ~5MB
            'cache_type': 'Local Templates'
        }
        available_voices = [
            {'name': 'Microsoft Zira (English)', 'language': 'en-US'}
        ]
        
        return render_template('voice_management.html', 
                             cache_info=cache_info,
                             available_voices=available_voices)
    
    except Exception as e:
        print(f"Voice management page loading error: {e}")
        return render_template('voice_management.html', 
                             cache_info={}, available_voices=[], error=str(e))

@main_bp.route('/system')
def system_status():
    """System status page"""
    try:
        # Here you can add system monitoring information
        return render_template('system_status.html')
    
    except Exception as e:
        print(f"System status page loading error: {e}")
        return render_template('system_status.html', error=str(e))
