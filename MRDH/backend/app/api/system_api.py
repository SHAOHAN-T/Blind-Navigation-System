"""
System Management API
"""
import os
from flask import Blueprint, request, jsonify, current_app

# psutil is optional, skip system resource monitoring if not installed
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False
from datetime import datetime, timedelta
from app.services.file_manager import FileManager

system_bp = Blueprint('system_api', __name__)

def create_response(code=200, message="success", data=None, error=None):
    """Create unified response format"""
    response = {
        "code": code,
        "message": message,
        "timestamp": datetime.now().isoformat()
    }
    
    if data is not None:
        response["data"] = data
    if error is not None:
        response["error"] = error
    
    return jsonify(response), code

def get_directory_size(path):
    """Calculate directory size"""
    total_size = 0
    try:
        for dirpath, dirnames, filenames in os.walk(path):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                try:
                    total_size += os.path.getsize(filepath)
                except (OSError, IOError):
                    continue
    except (OSError, IOError):
        pass
    return total_size

def format_size(size_bytes):
    """Format file size"""
    if size_bytes == 0:
        return "0B"
    
    size_names = ["B", "KB", "MB", "GB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    
    return f"{size_bytes:.1f}{size_names[i]}"

@system_bp.route('/status', methods=['GET'])
def get_system_status():
    """Get the system running status"""
    try:
        # System information
        start_time = getattr(current_app, 'start_time', datetime.now())
        uptime_seconds = (datetime.now() - start_time).total_seconds()
        
        # File manager
        file_manager = FileManager(current_app.config['DATA_DIR'])
        maps_index = file_manager.get_maps_index()
        today_logs = file_manager.get_navigation_logs()
        
        # Voice service (local templates)
        cache_info = {
            'total_files': 57,  # 42 page voices + 15 navigation templates
            'cache_type': 'Local Templates'
        }
        
        # Disk usage
        data_dir_size = get_directory_size(current_app.config['DATA_DIR'])
        audio_dir_size = get_directory_size(current_app.config['AUDIO_DIR'])
        
        # System resource usage
        memory_info = None
        disk_info = None
        cpu_percent = 0
        
        if HAS_PSUTIL:
            try:
                memory_info = psutil.virtual_memory()
                # Windows use C盘路径
                disk_path = 'C:\\' if os.name == 'nt' else '/'
                disk_info = psutil.disk_usage(disk_path)
                cpu_percent = psutil.cpu_percent(interval=1)
            except Exception as e:
                print(f"Failed to get the system resource information: {e}")
                memory_info = None
                disk_info = None
                cpu_percent = 0
        
        status_data = {
            "status": "healthy",
            "version": "1.0.0",
            "uptime_seconds": int(uptime_seconds),
            "uptime_formatted": f"{int(uptime_seconds // 3600)} hours {int((uptime_seconds % 3600) // 60)} minutes",
            "maps_count": len(maps_index.get('maps', [])),
            "navigation_requests_today": len(today_logs),
            "voice_files_cached": cache_info.get('total_files', 0),
            "disk_usage": {
                "data_dir_size": format_size(data_dir_size),
                "audio_dir_size": format_size(audio_dir_size),
                "total_app_size": format_size(data_dir_size + audio_dir_size)
            }
        }
        
        # Add system resource information (if available)
        if memory_info and disk_info:
            status_data["system_resources"] = {
                "cpu_percent": cpu_percent,
                "memory_total": format_size(memory_info.total),
                "memory_used": format_size(memory_info.used),
                "memory_percent": memory_info.percent,
                "disk_total": format_size(disk_info.total),
                "disk_used": format_size(disk_info.used),
                "disk_free": format_size(disk_info.free),
                "disk_percent": (disk_info.used / disk_info.total) * 100
            }
        
        return create_response(data=status_data)
    
    except Exception as e:
        return create_response(500, "Failed to get system status", error=str(e))

@system_bp.route('/cache', methods=['DELETE'])
def clear_system_cache():
    """Clear the system cache"""
    try:
        cache_type = request.args.get('type', 'all')  # audio, path, all
        
        cleaned_files = 0
        freed_space = 0
        
        # Audio cache (local templates, no need to clear)
        if cache_type in ['audio', 'all']:
            # Local templates are static, no cache to clear
            pass
        
        # Clear navigation logs (retain 7 days)
        if cache_type in ['path', 'all']:
            file_manager = FileManager(current_app.config['DATA_DIR'])
            deleted_logs = file_manager.cleanup_old_logs(days=7)
            cleaned_files += deleted_logs
        
        result = {
            "cleaned_files": cleaned_files,
            "freed_space": format_size(freed_space),
            "freed_space_bytes": freed_space
        }
        
        return create_response(200, "Cache cleared successfully", data=result)
    
    except Exception as e:
        return create_response(500, "Failed to clear the cache", error=str(e))

@system_bp.route('/config', methods=['GET'])
def get_system_config():
    """Get the system configuration"""
    try:
        config_data = {
            "max_map_width": current_app.config.get('MAX_MAP_WIDTH', 100),
            "max_map_height": current_app.config.get('MAX_MAP_HEIGHT', 100),
            "max_path_length": current_app.config.get('MAX_PATH_LENGTH', 1000),
            "audio_format": current_app.config.get('AUDIO_FORMAT', 'mp3'),
            "audio_cache_size": current_app.config.get('AUDIO_CACHE_SIZE', 100),
            "tts_language": current_app.config.get('TTS_LANGUAGE', 'en'),
            "tts_speed": current_app.config.get('TTS_SPEED', 1.0),
            "debug_mode": current_app.config.get('DEBUG', False)
        }
        
        return create_response(data=config_data)
    
    except Exception as e:
        return create_response(500, "Failed to get the system configuration", error=str(e))

@system_bp.route('/health', methods=['GET'])
def health_check():
    """Health check"""
    try:
        # Check if each service is normal
        health_status = {
            "overall": "healthy",
            "services": {}
        }
        
        # Check the file manager
        try:
            file_manager = FileManager(current_app.config['DATA_DIR'])
            file_manager.get_maps_index()
            health_status["services"]["file_manager"] = "healthy"
        except Exception as e:
            health_status["services"]["file_manager"] = f"error: {str(e)}"
            health_status["overall"] = "unhealthy"
        
        # 检查语音服务（本地模板）
        health_status["services"]["voice_service"] = "local templates"
        
        # 检查数据目录
        data_dir = current_app.config['DATA_DIR']
        if os.path.exists(data_dir) and os.access(data_dir, os.R_OK | os.W_OK):
            health_status["services"]["data_storage"] = "healthy"
        else:
            health_status["services"]["data_storage"] = "error: data directory not accessible"
            health_status["overall"] = "unhealthy"
        
        response_code = 200 if health_status["overall"] == "healthy" else 503
        return create_response(response_code, "Health check completed", data=health_status)
    
    except Exception as e:
        return create_response(500, "Health check failed", error=str(e))

@system_bp.route('/logs', methods=['GET'])
def get_system_logs():
    """Get system logs"""
    try:
        log_type = request.args.get('type', 'navigation')  # navigation, error, all
        date = request.args.get('date')  # YYYY-MM-DD
        limit = int(request.args.get('limit', 100))
        
        logs_data = []
        
        if log_type in ['navigation', 'all']:
            file_manager = FileManager(current_app.config['DATA_DIR'])
            nav_logs = file_manager.get_navigation_logs(date)
            
            for log in nav_logs[-limit:]:  # The latest records
                logs_data.append({
                    "type": "navigation",
                    "timestamp": log.get('timestamp'),
                    "message": f"Navigation request: map {log.get('map_id')} -> {log.get('target_room', 'Unknown target')}",
                    "data": log
                })
        
        return create_response(data={
            "logs": logs_data,
            "total_count": len(logs_data),
            "log_type": log_type,
            "date": date or "today"
        })
    
    except Exception as e:
        return create_response(500, "Failed to get system logs", error=str(e))

@system_bp.route('/backup', methods=['POST'])
def create_backup():
    """Create data backup"""
    try:
        import shutil
        import zipfile
        from datetime import datetime
        
        backup_name = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        backup_path = os.path.join(current_app.config['DATA_DIR'], backup_name)
        
        with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Backup map data
            maps_dir = os.path.join(current_app.config['DATA_DIR'], 'maps')
            if os.path.exists(maps_dir):
                for root, dirs, files in os.walk(maps_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, current_app.config['DATA_DIR'])
                        zipf.write(file_path, arcname)
        
        backup_size = os.path.getsize(backup_path)
        
        return create_response(200, "Backup created successfully", data={
            "backup_file": backup_name,
            "backup_size": format_size(backup_size),
            "backup_path": backup_path
        })
    
    except Exception as e:
        return create_response(500, "Failed to create backup", error=str(e))
