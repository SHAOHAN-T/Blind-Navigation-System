"""
File Management Service - handles JSON file read/write and management
"""
import json
import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from threading import Lock

# Cross-platform file lock handling
try:
    import fcntl
    HAS_FCNTL = True
except ImportError:
    HAS_FCNTL = False

try:
    import fasteners
    HAS_FASTENERS = True
except ImportError:
    HAS_FASTENERS = False

class FileManager:
    """File manager for handling JSON data file read/write"""
    
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.maps_dir = os.path.join(data_dir, 'maps')
        self.logs_dir = os.path.join(data_dir, 'logs')
        self._locks = {}  # File lock dictionary
        
        # Ensure directories exist
        os.makedirs(self.maps_dir, exist_ok=True)
        os.makedirs(self.logs_dir, exist_ok=True)
        
        # Initialize map index file
        self._init_maps_index()
    
    def _get_file_lock(self, file_path: str):
        """Get file lock"""
        if file_path not in self._locks:
            if HAS_FASTENERS:
                self._locks[file_path] = fasteners.InterProcessLock(f"{file_path}.lock")
            else:
                # Simple thread lock as a fallback
                self._locks[file_path] = Lock()
        return self._locks[file_path]
    
    def _init_maps_index(self):
        """Initialize map index file"""
        index_file = os.path.join(self.maps_dir, 'index.json')
        if not os.path.exists(index_file):
            index_data = {
                "maps": [],
                "next_id": 1
            }
            self._write_json_file(index_file, index_data)
    
    def _read_json_file(self, file_path: str) -> Optional[Dict]:
        """Safe read JSON file"""
        if not os.path.exists(file_path):
            return None
        
        lock = self._get_file_lock(file_path)
        try:
            with lock:
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"Read file error {file_path}: {e}")
            return None
    
    def _write_json_file(self, file_path: str, data: Dict) -> bool:
        """Safe write JSON file"""
        lock = self._get_file_lock(file_path)
        try:
            with lock:
                # Write to temporary file, then rename, ensure atomicity
                temp_file = f"{file_path}.tmp"
                with open(temp_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                
                # Rename temporary file
                if os.path.exists(file_path):
                    os.replace(temp_file, file_path)
                else:
                    os.rename(temp_file, file_path)
                return True
        except IOError as e:
            print(f"Write file error {file_path}: {e}")
            return False
    
    def get_maps_index(self) -> Dict:
        """Get map index"""
        index_file = os.path.join(self.maps_dir, 'index.json')
        return self._read_json_file(index_file) or {"maps": [], "next_id": 1}
    
    def update_maps_index(self, index_data: Dict) -> bool:
        """Update map index"""
        index_file = os.path.join(self.maps_dir, 'index.json')
        return self._write_json_file(index_file, index_data)
    
    def get_map_data(self, map_id: int) -> Optional[Dict]:
        """Get map data"""
        map_file = os.path.join(self.maps_dir, f'map_{map_id}.json')
        return self._read_json_file(map_file)
    
    def save_map_data(self, map_data: Dict) -> bool:
        """Save map data"""
        map_id = map_data.get('id')
        if not map_id:
            return False
        
        map_file = os.path.join(self.maps_dir, f'map_{map_id}.json')
        return self._write_json_file(map_file, map_data)
    
    def delete_map_data(self, map_id: int) -> bool:
        """Delete map data"""
        map_file = os.path.join(self.maps_dir, f'map_{map_id}.json')
        try:
            if os.path.exists(map_file):
                os.remove(map_file)
            return True
        except OSError as e:
            print(f"Delete map file error {map_file}: {e}")
            return False
    
    def create_map(self, map_data: Dict) -> Optional[int]:
        """Create new map"""
        # Get index
        index = self.get_maps_index()
        map_id = index['next_id']
        
        # Set map ID
        map_data['id'] = map_id
        map_data['created_at'] = datetime.now().isoformat()
        map_data['updated_at'] = map_data['created_at']
        
        # Save map data
        if not self.save_map_data(map_data):
            return None
        
        # Update index
        index['maps'].append({
            "id": map_id,
            "name": map_data['name'],
            "width": map_data['width'],
            "height": map_data['height'],
            "file_path": f"maps/map_{map_id}.json",
            "created_at": map_data['created_at'],
            "updated_at": map_data['updated_at']
        })
        index['next_id'] = map_id + 1
        
        if self.update_maps_index(index):
            return map_id
        return None
    
    def update_map(self, map_id: int, map_data: Dict) -> bool:
        """Update map"""
        # Update timestamp
        map_data['updated_at'] = datetime.now().isoformat()
        
        # Save map data
        if not self.save_map_data(map_data):
            return False
        
        # Update index information
        index = self.get_maps_index()
        for map_info in index['maps']:
            if map_info['id'] == map_id:
                map_info['name'] = map_data['name']
                map_info['width'] = map_data['width']
                map_info['height'] = map_data['height']
                map_info['updated_at'] = map_data['updated_at']
                break
        
        return self.update_maps_index(index)
    
    def delete_map(self, map_id: int) -> bool:
        """Delete map"""
        # Delete map file
        if not self.delete_map_data(map_id):
            return False
        
        # Remove from index
        index = self.get_maps_index()
        index['maps'] = [m for m in index['maps'] if m['id'] != map_id]
        
        return self.update_maps_index(index)
    
    def log_navigation(self, log_data: Dict) -> bool:
        """Log navigation"""
        today = datetime.now().strftime('%Y-%m-%d')
        log_file = os.path.join(self.logs_dir, f'navigation_{today}.json')
        
        # Read today's logs
        logs = self._read_json_file(log_file) or {"date": today, "logs": []}
        
        # Add new log
        log_entry = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            **log_data
        }
        logs['logs'].append(log_entry)
        
        return self._write_json_file(log_file, logs)
    
    def get_navigation_logs(self, date: str = None) -> List[Dict]:
        """Get navigation logs"""
        if not date:
            date = datetime.now().strftime('%Y-%m-%d')
        
        log_file = os.path.join(self.logs_dir, f'navigation_{date}.json')
        logs = self._read_json_file(log_file)
        
        return logs['logs'] if logs else []
    
    def cleanup_old_logs(self, days: int = 30) -> int:
        """Clean up old log files"""
        import glob
        from datetime import timedelta
        
        cutoff_date = datetime.now() - timedelta(days=days)
        pattern = os.path.join(self.logs_dir, 'navigation_*.json')
        deleted_count = 0
        
        for log_file in glob.glob(pattern):
            try:
                # Extract date from filename
                filename = os.path.basename(log_file)
                date_str = filename.replace('navigation_', '').replace('.json', '')
                file_date = datetime.strptime(date_str, '%Y-%m-%d')
                
                if file_date < cutoff_date:
                    os.remove(log_file)
                    deleted_count += 1
            except (ValueError, OSError):
                continue
        
        return deleted_count
