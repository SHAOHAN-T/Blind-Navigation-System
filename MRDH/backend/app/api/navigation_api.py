"""
Navigation Path API
"""
import uuid
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
from app.models.map import MapModel
from app.models.map_3d import Map3D
from app.services.file_manager import FileManager
from app.services.pathfinding import BFSPathfinder, NavigationInstructions
from app.services.pathfinding_3d import Pathfinding3D, Position3D

navigation_bp = Blueprint('navigation_api', __name__)

def get_file_manager():
    """Get file manager instance"""
    return FileManager(current_app.config['DATA_DIR'])

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

@navigation_bp.route('/path', methods=['POST'])
def calculate_path():
    """Calculate path"""
    try:
        data = request.get_json()
        
        if not data:
            return create_response(400, "Request data is empty")
        
        # Validate required fields
        required_fields = ['map_id', 'start', 'end']
        for field in required_fields:
            if field not in data:
                return create_response(400, f"Missing required field: {field}")
        
        map_id = data['map_id']
        start = (data['start']['x'], data['start']['y'])
        end = (data['end']['x'], data['end']['y'])
        algorithm = data.get('algorithm', 'bfs')
        
        # Get map data
        file_manager = get_file_manager()
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return create_response(404, "Map does not exist")
        
        map_model = MapModel.from_dict(map_data)
        
        # Validate start and end points
        if not map_model.is_walkable(start[0], start[1]):
            return create_response(400, "Start point is not walkable")
        
        if not map_model.is_walkable(end[0], end[1]):
            return create_response(400, "End point is not walkable")
        
        # Path planning
        pathfinder = BFSPathfinder(map_model)
        path = pathfinder.find_path(start, end)
        
        if not path:
            return create_response(404, "Cannot find path")
        
        # Generate navigation instructions
        instruction_generator = NavigationInstructions()
        instructions = instruction_generator.generate_instructions(path)
        detailed_instructions = instruction_generator.generate_detailed_instructions(path)
        
        # Estimate time
        estimated_time_seconds = pathfinder.estimate_time(path)
        estimated_time_str = f"{int(estimated_time_seconds // 60)} min {int(estimated_time_seconds % 60)} sec"
        
        # Generate path ID
        path_id = f"path_{uuid.uuid4().hex[:8]}"
        
        # Record navigation log
        log_data = {
            "map_id": map_id,
            "start": {"x": start[0], "y": start[1]},
            "end": {"x": end[0], "y": end[1]},
            "path_data": [{"x": x, "y": y} for x, y in path],
            "instructions": instructions,
            "total_steps": len(path),
            "estimated_time": estimated_time_seconds,
            "algorithm": algorithm
        }
        file_manager.log_navigation(log_data)
        
        result = {
            "path_id": path_id,
            "path": [{"x": x, "y": y} for x, y in path],
            "instructions": instructions,
            "detailed_instructions": detailed_instructions,
            "total_steps": len(path),
            "estimated_time": estimated_time_str,
            "estimated_time_seconds": estimated_time_seconds
        }
        
        return create_response(200, "Path calculation successful", data=result)
    
    except ValueError as e:
        return create_response(400, str(e))
    except Exception as e:
        return create_response(500, "Path calculation failed", error=str(e))

@navigation_bp.route('/path/room', methods=['POST'])
def calculate_path_to_room():
    """Calculate path to room"""
    try:
        data = request.get_json()
        
        if not data:
            return create_response(400, "Request data is empty")
        
        required_fields = ['map_id', 'room_id']
        for field in required_fields:
            if field not in data:
                return create_response(400, f"Missing required field: {field}")
        
        map_id = data['map_id']
        room_id = data['room_id']
        
        # Get map data
        file_manager = get_file_manager()
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return create_response(404, "Map does not exist")
        
        map_model = MapModel.from_dict(map_data)
        
        # Find room
        room = map_model.find_room_by_id(room_id)
        if not room:
            return create_response(404, f"Room {room_id} does not exist")
        
        # Path planning
        pathfinder = BFSPathfinder(map_model)
        path = pathfinder.find_path_to_room(room_id)
        
        if not path:
            return create_response(404, f"Cannot find path to room {room['name']}")
        
        # Generate navigation instructions
        instruction_generator = NavigationInstructions()
        instructions = instruction_generator.generate_instructions(path, room['name'])
        detailed_instructions = instruction_generator.generate_detailed_instructions(path, room['name'])
        
        # Estimate time
        estimated_time_seconds = pathfinder.estimate_time(path)
        estimated_time_str = f"{int(estimated_time_seconds // 60)} min {int(estimated_time_seconds % 60)} sec"
        
        # Generate path ID
        path_id = f"path_{uuid.uuid4().hex[:8]}"
        
        # Record navigation log
        start = (map_model.entrance["x"], map_model.entrance["y"])
        end = (room["x"], room["y"])
        log_data = {
            "map_id": map_id,
            "start": {"x": start[0], "y": start[1]},
            "end": {"x": end[0], "y": end[1]},
            "target_room": room_id,
            "path_data": [{"x": x, "y": y} for x, y in path],
            "instructions": instructions,
            "total_steps": len(path),
            "estimated_time": estimated_time_seconds
        }
        file_manager.log_navigation(log_data)
        
        result = {
            "path_id": path_id,
            "path": [{"x": x, "y": y} for x, y in path],
            "instructions": instructions,
            "detailed_instructions": detailed_instructions,
            "target_room": room,
            "total_steps": len(path),
            "estimated_time": estimated_time_str,
            "estimated_time_seconds": estimated_time_seconds
        }
        
        return create_response(200, "Path calculation successful", data=result)
    
    except Exception as e:
        return create_response(500, "Path calculation failed", error=str(e))

@navigation_bp.route('/instructions/<path_id>', methods=['GET'])
def get_instructions(path_id):
    """Get detailed instructions for path"""
    try:
        # Simplified processing here, actual projects can consider caching path data
        return create_response(400, "Path ID has expired, please recalculate path")
    
    except Exception as e:
        return create_response(500, "Failed to get instructions", error=str(e))

@navigation_bp.route('/logs', methods=['GET'])
def get_navigation_logs():
    """Get navigation logs"""
    try:
        date = request.args.get('date')  # YYYY-MM-DD format
        
        file_manager = get_file_manager()
        logs = file_manager.get_navigation_logs(date)
        
        return create_response(data={
            "date": date or datetime.now().strftime('%Y-%m-%d'),
            "logs": logs,
            "total_count": len(logs)
        })
    
    except Exception as e:
        return create_response(500, "Failed to get navigation logs", error=str(e))

@navigation_bp.route('/stats', methods=['GET'])
def get_navigation_stats():
    """Get navigation statistics"""
    try:
        file_manager = get_file_manager()
        today_logs = file_manager.get_navigation_logs()
        
        # Count today's navigation times
        total_navigations = len(today_logs)
        
        # Count most popular target rooms
        room_stats = {}
        for log in today_logs:
            target_room = log.get('target_room')
            if target_room:
                room_stats[target_room] = room_stats.get(target_room, 0) + 1
        
        popular_rooms = sorted(room_stats.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Average navigation time
        total_time = sum(log.get('estimated_time', 0) for log in today_logs)
        avg_time = total_time / total_navigations if total_navigations > 0 else 0
        
        stats = {
            "today_navigations": total_navigations,
            "popular_rooms": [{"room_id": room, "count": count} for room, count in popular_rooms],
            "average_time_seconds": round(avg_time, 1),
            "average_time_str": f"{int(avg_time // 60)} min {int(avg_time % 60)} sec"
        }
        
        return create_response(data=stats)
    
    except Exception as e:
        return create_response(500, "Failed to get statistics", error=str(e))

# ========== 3D Navigation Interface ==========

@navigation_bp.route('/path/3d', methods=['POST'])
def calculate_3d_path():
    """Calculate 3D path (supports cross-floor navigation)"""
    try:
        data = request.get_json()
        
        if not data:
            return create_response(400, "Request data is empty")
        
        # Validate required fields
        required_fields = ['map_id', 'start', 'end']
        for field in required_fields:
            if field not in data:
                return create_response(400, f"Missing required field: {field}")
        
        map_id = data['map_id']
        start_data = data['start']
        end_data = data['end']
        language = data.get('language', 'zh')  # Add language parameter support
        
        # Parse 3D coordinates
        start_pos = Position3D(
            start_data['x'], 
            start_data['y'], 
            start_data.get('floor', 1)
        )
        end_pos = Position3D(
            end_data['x'], 
            end_data['y'], 
            end_data.get('floor', 1)
        )
        
        # Get map data
        file_manager = get_file_manager()
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return create_response(404, "Map does not exist")
        
        # Check if it's a 3D map
        if not map_data.get('is_3d', False):
            return create_response(400, "Current map is not a 3D map, please use 2D path planning interface")
        
        # Create 3D map model
        map_3d = Map3D.from_dict(map_data)
        
        # Validate start and end points
        if not map_3d.is_walkable_3d(start_pos.x, start_pos.y, start_pos.floor):
            return create_response(400, f"Start point is not walkable: Floor {start_pos.floor} at ({start_pos.x}, {start_pos.y})")
        
        if not map_3d.is_walkable_3d(end_pos.x, end_pos.y, end_pos.floor):
            return create_response(400, f"End point is not walkable: Floor {end_pos.floor} at ({end_pos.x}, {end_pos.y})")
        
        # 3D path planning
        pathfinder_3d = Pathfinding3D(map_3d)
        path_result = pathfinder_3d.find_path(start_pos, end_pos)
        
        if not path_result:
            return create_response(404, "Cannot find 3D path")
        
        path, total_cost = path_result
        
        # Generate 3D navigation instructions (add exception handling)
        try:
            instructions = pathfinder_3d.generate_voice_instructions(path)
        except Exception as e:
            instructions = ["Start navigation", "Please navigate manually according to the map", "Reach destination"]
        
        # Instructions are already in English (no conversion needed)
        display_instructions = instructions
        
        try:
            detailed_instructions = pathfinder_3d.generate_detailed_instructions(path)
        except Exception as e:
            detailed_instructions = []
        
        # Estimate time
        estimated_time_seconds = pathfinder_3d.estimate_time(path)
        estimated_time_str = f"{int(estimated_time_seconds // 60)} min {int(estimated_time_seconds % 60)} sec"
        
        # Generate path ID
        path_id = f"path3d_{uuid.uuid4().hex[:8]}"
        
        # Convert path format
        path_data = []
        for node in path:
            path_data.append({
                "x": node.position.x,
                "y": node.position.y,
                "floor": node.position.floor,
                "action": node.action,
                "connection_info": node.connection_info
            })
        
        # Record 3D navigation log
        log_data = {
            "map_id": map_id,
            "start": {"x": start_pos.x, "y": start_pos.y, "floor": start_pos.floor},
            "end": {"x": end_pos.x, "y": end_pos.y, "floor": end_pos.floor},
            "path_data": path_data,
            "instructions": instructions,
            "total_steps": len(path),
            "total_cost": total_cost,
            "estimated_time": estimated_time_seconds,
            "algorithm": "3d_astar",
            "is_3d": True
        }
        file_manager.log_navigation(log_data)
        
        # Add debug information
        has_stairs = any('stair' in node.action for node in path)
        
        result = {
            "path_id": path_id,
            "path": path_data,
            "instructions": display_instructions,  # 🌐 Use processed instructions (supports English)
            "detailed_instructions": detailed_instructions,
            "total_steps": len(path),
            "total_cost": total_cost,
            "estimated_time": estimated_time_str,
            "estimated_time_seconds": estimated_time_seconds,
            "is_3d": True,
            "language": language,  # 🌐 Add language information
            "api_endpoint": "/navigation/path/3d",
            "debug_info": {
                "has_stairs": has_stairs,
                "path_length": len(path),
                "instructions_count": len(display_instructions),
                "original_instructions_count": len(instructions)
            }
        }
        
        return create_response(200, "3DPath calculation successful", data=result)
    
    except ValueError as e:
        return create_response(400, str(e))
    except Exception as e:
        return create_response(500, "3D path calculation failed", error=str(e))

@navigation_bp.route('/path/3d/room', methods=['POST'])
def calculate_3d_path_to_room():
    """Calculate 3D path to room"""
    try:
        data = request.get_json()
        
        if not data:
            return create_response(400, "Request data is empty")
        
        required_fields = ['map_id', 'room_id']
        for field in required_fields:
            if field not in data:
                return create_response(400, f"Missing required field: {field}")
        
        map_id = data['map_id']
        room_id = data['room_id']
        start_floor = data.get('start_floor', 1)
        language = data.get('language', 'zh')  # Add language parameter support
        
        # Get map data
        file_manager = get_file_manager()
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return create_response(404, "Map does not exist")
        
        # Check if it's a 3D map
        if not map_data.get('is_3d', False):
            return create_response(400, "Current map is not a 3D map, please use 2D path planning interface")
        
        # Create 3D map model
        map_3d = Map3D.from_dict(map_data)
        
        # Find room (search all floors)
        target_room = None
        target_floor = None
        
        for floor_id, floor in map_3d.floors.items():
            room = floor.find_room_by_id(room_id)
            if room:
                target_room = room
                target_floor = floor_id
                break
        
        if not target_room:
            return create_response(404, f"Room {room_id} does not exist")
        
        # Get starting point (use entrance of specified floor, if none use first floor entrance)
        start_floor_obj = map_3d.floors.get(start_floor)
        if not start_floor_obj or not start_floor_obj.entrance:
            # If specified floor has no entrance, use first floor entrance
            start_floor_obj = map_3d.floors.get(1)
            start_floor = 1
        
        if not start_floor_obj or not start_floor_obj.entrance:
            return create_response(400, "Cannot find valid starting entrance")
        
        start_pos = Position3D(
            start_floor_obj.entrance['x'],
            start_floor_obj.entrance['y'],
            start_floor
        )
        
        end_pos = Position3D(
            target_room['x'],
            target_room['y'],
            target_floor
        )
        
        # 3D path planning
        pathfinder_3d = Pathfinding3D(map_3d)
        path_result = pathfinder_3d.find_path(start_pos, end_pos)
        
        if not path_result:
            return create_response(404, f"无法找到到达房间 {target_room['name']} 的3D路径")
        
        path, total_cost = path_result
        
        # Generate 3D navigation instructions (add exception handling)
        try:
            instructions = pathfinder_3d.generate_voice_instructions(path, target_room['name'])
        except Exception as e:
            instructions = ["开始导航", f"请根据地图手动导航到{target_room['name']}", f"到达目的地：{target_room['name']}"]
        
        # Instructions are already in English (no conversion needed)
        display_instructions = instructions
        
        try:
            detailed_instructions = pathfinder_3d.generate_detailed_instructions(path, target_room['name'])
        except Exception as e:
            detailed_instructions = []
        
        # Estimate time
        estimated_time_seconds = pathfinder_3d.estimate_time(path)
        estimated_time_str = f"{int(estimated_time_seconds // 60)} min {int(estimated_time_seconds % 60)} sec"
        
        # Generate path ID
        path_id = f"path3d_{uuid.uuid4().hex[:8]}"
        
        # Convert path format
        path_data = []
        for node in path:
            path_data.append({
                "x": node.position.x,
                "y": node.position.y,
                "floor": node.position.floor,
                "action": node.action,
                "connection_info": node.connection_info
            })
        
        # Record 3D navigation log
        log_data = {
            "map_id": map_id,
            "start": {"x": start_pos.x, "y": start_pos.y, "floor": start_pos.floor},
            "end": {"x": end_pos.x, "y": end_pos.y, "floor": end_pos.floor},
            "target_room": room_id,
            "path_data": path_data,
            "instructions": instructions,
            "total_steps": len(path),
            "total_cost": total_cost,
            "estimated_time": estimated_time_seconds,
            "is_3d": True
        }
        file_manager.log_navigation(log_data)
        
        # Add debug information
        has_stairs = any('stair' in node.action for node in path)
        
        result = {
            "path_id": path_id,
            "path": path_data,
            "instructions": display_instructions,  # 🌐 Use processed instructions (supports English)
            "detailed_instructions": detailed_instructions,
            "target_room": target_room,
            "total_steps": len(path),
            "total_cost": total_cost,
            "estimated_time": estimated_time_str,
            "estimated_time_seconds": estimated_time_seconds,
            "is_3d": True,
            "language": language,  # 🌐 Add language information
            "api_endpoint": "/navigation/path/3d/room",
            "debug_info": {
                "has_stairs": has_stairs,
                "path_length": len(path),
                "instructions_count": len(display_instructions),
                "original_instructions_count": len(instructions),
                "target_room_floor": target_room.get('floor', 1)
            }
        }
        
        return create_response(200, "3DPath calculation successful", data=result)
    
    except Exception as e:
        return create_response(500, "3D path calculation failed", error=str(e))
