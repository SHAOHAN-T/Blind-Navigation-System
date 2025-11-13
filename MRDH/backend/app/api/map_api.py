"""
Map Management API
"""
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
from app.models.map import MapModel
from app.services.file_manager import FileManager
from app.services.pathfinding import BFSPathfinder

map_bp = Blueprint('map_api', __name__)

def get_file_manager():
    """Get file manager instance"""
    return FileManager(current_app.config['DATA_DIR'])

def determine_map_type(map_data):
    """
    🔧 Function to explicitly determine map type
    
    Determination rules:
    1. Has is_3d=True flag → 3D map
    2. Has floors and more than 1 floor → 3D map  
    3. Has vertical_connections → 3D map
    4. Rooms or entrance have floor field → 3D map
    5. Other cases → 2D map
    """
    # Explicit 3D flag
    is_3d_flag = map_data.get('is_3d')
    if is_3d_flag is True:
        return '3D'
    
    # Check floor data
    floors = map_data.get('floors', {})
    if floors and len(floors) > 1:
        return '3D'
    
    # Check vertical connections
    vertical_connections = map_data.get('vertical_connections', [])
    if vertical_connections and len(vertical_connections) > 0:
        return '3D'
    
    # Check if rooms have floor information
    rooms = map_data.get('rooms', [])
    for room in rooms:
        if 'floor' in room:
            return '3D'
    
    # Check if entrance has floor information
    entrance = map_data.get('entrance', {})
    if 'floor' in entrance:
        return '3D'
    
    # Default to 2D map
    return '2D'

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

@map_bp.route('', methods=['GET'])
def get_maps():
    """Get map list"""
    try:
        file_manager = get_file_manager()
        index = file_manager.get_maps_index()
        
        # Format response data
        maps_list = []
        for map_info in index.get('maps', []):
            # 🔧 Get complete map data to determine type
            full_map_data = file_manager.get_map_data(map_info["id"])
            map_type = determine_map_type(full_map_data) if full_map_data else '2D'
            
            maps_list.append({
                "id": map_info["id"],
                "name": map_info["name"],
                "width": map_info["width"],
                "height": map_info["height"],
                "room_count": len(full_map_data.get("rooms", [])) if full_map_data else 0,
                "map_type": map_type,  # 🔧 Add map type
                "created_at": map_info["created_at"],
                "updated_at": map_info["updated_at"]
            })
        
        return create_response(data=maps_list)
    
    except Exception as e:
        return create_response(500, "Failed to get map list", error=str(e))

@map_bp.route('/<int:map_id>', methods=['GET'])
def get_map(map_id):
    """Get map details"""
    try:
        file_manager = get_file_manager()
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return create_response(404, "Map does not exist")
        
        # 🔧 Explicitly determine and mark map type
        map_type = determine_map_type(map_data)
        map_data['map_type'] = map_type  # Add explicit map type identifier
        
        print(f"📍 Map {map_id} type detection: {map_type}")
        
        return create_response(data=map_data)
    
    except Exception as e:
        return create_response(500, "Failed to get map details", error=str(e))

@map_bp.route('', methods=['POST'])
def create_map():
    """Create new map"""
    try:
        data = request.get_json()
        
        if not data:
            return create_response(400, "Request data is empty")
        
        # Validate required fields
        required_fields = ['name', 'width', 'height', 'grid', 'entrance']
        for field in required_fields:
            if field not in data:
                return create_response(400, f"Missing required field: {field}")
        
        # Create a map model
        map_model = MapModel.from_dict(data)
        
        # Verify map data
        is_valid, errors = map_model.validate()
        if not is_valid:
            return create_response(400, "地图数据验证失败", error=errors)
        
        # Save the map
        file_manager = get_file_manager()
        map_id = file_manager.create_map(map_model.to_dict())
        
        if map_id:
            return create_response(200, "Map created successfully", data={
                "id": map_id,
                "name": map_model.name,
                "created_at": map_model.created_at
            })
        else:
            return create_response(500, "地图保存失败")
    
    except Exception as e:
        return create_response(500, "Failed to create map", error=str(e))

@map_bp.route('/<int:map_id>', methods=['PUT'])
def update_map(map_id):
    """Update the map"""
    try:
        data = request.get_json()
        
        if not data:
            return create_response(400, "Request data is empty")
        
        file_manager = get_file_manager()
        
        # Check if the map exists
        existing_map = file_manager.get_map_data(map_id)
        if not existing_map:
            return create_response(404, "Map does not exist")
        
        # Update map data
        data['id'] = map_id
        data['created_at'] = existing_map['created_at']  # Keep the creation time
        
        map_model = MapModel.from_dict(data)
        
        # Verify map data
        is_valid, errors = map_model.validate()
        if not is_valid:
            return create_response(400, "Map data verification failed", error=errors)
        
        # Save updates
        if file_manager.update_map(map_id, map_model.to_dict()):
            return create_response(200, "The map has been updated successfully.", data={
                "id": map_id,
                "updated_at": map_model.updated_at
            })
        else:
            return create_response(500, "Map update failed")
    
    except Exception as e:
        return create_response(500, "Failed to update the map", error=str(e))

@map_bp.route('/<int:map_id>', methods=['DELETE'])
def delete_map(map_id):
    """Delete the map"""
    try:
        file_manager = get_file_manager()
        
        # Check if the map exists
        existing_map = file_manager.get_map_data(map_id)
        if not existing_map:
            return create_response(404, "Map does not exist")
        
        # Delete the map
        if file_manager.delete_map(map_id):
            return create_response(200, "The map has been deleted successfully.")
        else:
            return create_response(500, "Failed to delete the map")
    
    except Exception as e:
        return create_response(500, "Failed to delete the map", error=str(e))

@map_bp.route('/<int:map_id>/validate', methods=['POST'])
def validate_map(map_id):
    """Verify map connectivity"""
    try:
        file_manager = get_file_manager()
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return create_response(404, "Map does not exist")
        
        map_model = MapModel.from_dict(map_data)
        
        # Verify basic map data
        is_valid, validation_errors = map_model.validate()
        
        # Check connectivity
        pathfinder = BFSPathfinder(map_model)
        connectivity = pathfinder.check_connectivity()
        
        issues = []
        if validation_errors:
            issues.extend(validation_errors)
        
        if connectivity["unreachable_rooms"]:
            issues.append(f"The following rooms cannot be reached from the entrance.: {', '.join(connectivity['unreachable_rooms'])}")
        
        result = {
            "valid": is_valid and len(connectivity["unreachable_rooms"]) == 0,
            "reachable_rooms": connectivity["reachable_rooms"],
            "unreachable_rooms": connectivity["unreachable_rooms"],
            "connectivity_ratio": connectivity["connectivity_ratio"],
            "total_rooms": connectivity["total_rooms"],
            "issues": issues
        }
        
        return create_response(data=result)
    
    except Exception as e:
        return create_response(500, "Map verification failed", error=str(e))

@map_bp.route('/<int:map_id>/rooms', methods=['POST'])
def add_room(map_id):
    """Add a room"""
    try:
        data = request.get_json()
        
        if not data:
            return create_response(400, "Request data is empty")
        
        required_fields = ['id', 'name', 'x', 'y']
        for field in required_fields:
            if field not in data:
                return create_response(400, f"Missing required field: {field}")
        
        file_manager = get_file_manager()
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return create_response(404, "Map does not exist")
        
        map_model = MapModel.from_dict(map_data)
        
        # Add a room
        if map_model.add_room(data['id'], data['name'], data['x'], data['y']):
            # Save updates
            if file_manager.update_map(map_id, map_model.to_dict()):
                return create_response(200, "The room has been added successfully.")
            else:
                return create_response(500, "Save failed")
        else:
            return create_response(400, "Failed to add the room. The location is unavailable or the room ID already exists.")
    
    except Exception as e:
        return create_response(500, "Failed to add the room", error=str(e))

@map_bp.route('/<int:map_id>/rooms/<room_id>', methods=['DELETE'])
def remove_room(map_id, room_id):
    """Delete the room"""
    try:
        file_manager = get_file_manager()
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return create_response(404, "Map does not exist")
        
        map_model = MapModel.from_dict(map_data)
        
        # Delete the room
        if map_model.remove_room(room_id):
            # Save updates
            if file_manager.update_map(map_id, map_model.to_dict()):
                return create_response(200, "The room has been deleted successfully.")
            else:
                return create_response(500, "Save failed")
        else:
            return create_response(404, "The room does not exist")
    
    except Exception as e:
        return create_response(500, "Failed to delete the room", error=str(e))

@map_bp.route('/<int:map_id>/entrance', methods=['PUT'])
def update_entrance(map_id):
    """Update the entrance location"""
    try:
        data = request.get_json()
        
        if not data or 'x' not in data or 'y' not in data:
            return create_response(400, "Missing coordinate information")
        
        file_manager = get_file_manager()
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return create_response(404, "Map does not exist")
        
        map_model = MapModel.from_dict(map_data)
        
        # Update Entry
        if map_model.set_entrance(data['x'], data['y']):
            # Save updates
            if file_manager.update_map(map_id, map_model.to_dict()):
                return create_response(200, "The entrance location has been updated successfully.")
            else:
                return create_response(500, "Save failed")
        else:
            return create_response(400, "The entrance location is unavailable")
    
    except Exception as e:
        return create_response(500, "Failed to update the entry", error=str(e))
