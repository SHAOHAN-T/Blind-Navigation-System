"""
3D Map API Routes
"""
from flask import Blueprint, request, jsonify, current_app
from app.services.file_manager import FileManager
from app.models.map_3d import Map3D
from app.services.pathfinding_3d import Pathfinding3D, Position3D
import traceback

map_3d_bp = Blueprint('map_3d', __name__, url_prefix='/api/maps/3d')

@map_3d_bp.route('', methods=['POST'])
def create_3d_map():
    """Create a new 3D map"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'code': 400,
                'message': 'Request data is empty'
            }), 400
        
        # Create 3D map object
        map_3d = Map3D(
            name=data.get('name', 'New 3D Map'),
            width=data.get('width', 20),
            height=data.get('height', 15)
        )
        
        # Add floors if floor data exists
        if 'floors' in data:
            for floor_id, floor_data in data['floors'].items():
                floor = map_3d.add_floor(
                    int(floor_id),
                    floor_data.get('name', f'Floor {floor_id}'),
                    floor_data.get('height', 3.5)
                )
                
                # Set floor grid
                if 'grid' in floor_data:
                    floor.grid = floor_data['grid']
                
                # Add rooms
                if 'rooms' in floor_data:
                    for room_data in floor_data['rooms']:
                        floor.add_room(
                            room_data.get('id', ''),
                            room_data.get('name', ''),
                            room_data.get('x', 0),
                            room_data.get('y', 0)
                        )
                
                # Set entrance
                if 'entrance' in floor_data and floor_data['entrance']:
                    floor.entrance = floor_data['entrance']
        
        # Add vertical connections
        if 'vertical_connections' in data:
            for conn_data in data['vertical_connections']:
                map_3d.add_vertical_connection(
                    conn_data.get('type', 'stair'),
                    conn_data.get('start_floor', 1),
                    conn_data.get('end_floor', 2),
                    conn_data.get('start_pos', {'x': 0, 'y': 0}),
                    conn_data.get('end_pos', {'x': 0, 'y': 0})
                )
        
        # Save map
        file_manager = FileManager(current_app.config['DATA_DIR'])
        map_3d_data = map_3d.to_dict()
        map_id = file_manager.create_map(map_3d_data)
        
        if map_id:
            return jsonify({
                'code': 200,
                'message': '3D map created successfully',
                'data': {
                    'id': map_id,
                    'name': map_3d.name,
                    'is_3d': True
                }
            })
        else:
            return jsonify({
                'code': 500,
                'message': '3D map save failed'
            }), 500
    
    except Exception as e:
        print(f"Failed to create 3D map: {e}")
        return jsonify({
            'code': 500,
            'message': f'Failed to create 3D map: {str(e)}'
        }), 500

@map_3d_bp.route('/convert/<int:map_id>', methods=['POST'])
def convert_to_3d(map_id):
    """Convert 2D map to 3D map"""
    try:
        file_manager = FileManager(current_app.config['DATA_DIR'])
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return jsonify({
                'code': 404,
                'message': 'Map does not exist'
            }), 404
        
        # 如果已经是3D地图，直接返回
        if map_data.get('is_3d', False):
            return jsonify({
                'code': 200,
                'message': 'Map is already in 3D format',
                'data': map_data
            })
        
        # Convert to 3D map
        try:
            map_3d = Map3D.from_dict(map_data)
            
            # Migrate existing rooms to first floor
            for room in map_data.get('rooms', []):
                if 'floor' not in room:
                    room['floor'] = 1
            
            # Save 3D map
            map_3d_data = map_3d.to_dict()
            success = file_manager.update_map(map_id, map_3d_data)
            
            if not success:
                return jsonify({
                    'code': 500,
                    'message': '3D map save failed'
                }), 500
                
        except Exception as e:
            print(f"3D map conversion error: {e}")
            return jsonify({
                'code': 500,
                'message': f'3D conversion failed: {str(e)}'
            }), 500
        
        return jsonify({
            'code': 200,
            'message': 'Converted to 3D map successfully',
            'data': map_3d_data
        })
    
    except Exception as e:
        print(f"Failed to convert 3D map: {e}")
        return jsonify({
            'code': 500,
            'message': f'Conversion failed: {str(e)}'
        }), 500

@map_3d_bp.route('/<int:map_id>/floors', methods=['POST'])
def add_floor(map_id):
    """Add floor"""
    try:
        data = request.get_json()
        floor_id = data.get('floor_id')
        name = data.get('name')
        height = data.get('height', 3.5)
        
        if not floor_id or not name:
            return jsonify({
                'code': 400,
                'message': 'Floor ID and name cannot be empty'
            })
        
        file_manager = FileManager(current_app.config['DATA_DIR'])
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return jsonify({
                'code': 404,
                'message': 'Map does not exist'
            }), 404
        
        map_3d = Map3D.from_dict(map_data)
        
        # Check if floor already exists
        if int(floor_id) in map_3d.floors:
            return jsonify({
                'code': 400,
                'message': 'Floor already exists'
            })
        
        # 添加楼层
        floor = map_3d.add_floor(int(floor_id), name, height)
        
        # Save map
        map_3d_data = map_3d.to_dict()
        file_manager.update_map(map_id, map_3d_data)
        
        return jsonify({
            'code': 200,
            'message': 'Floor added successfully',
            'data': floor.to_dict()
        })
    
    except Exception as e:
        print(f"Failed to add floor: {e}")
        return jsonify({
            'code': 500,
            'message': f'Failed to add floor: {str(e)}'
        }), 500

@map_3d_bp.route('/<int:map_id>/rooms/3d', methods=['POST'])
def add_room_3d(map_id):
    """Add 3D room"""
    try:
        data = request.get_json()
        room_id = data.get('room_id')
        name = data.get('name')
        x = data.get('x')
        y = data.get('y')
        floor = data.get('floor', 1)
        
        if not all([room_id, name, x is not None, y is not None]):
            return jsonify({
                'code': 400,
                'message': 'Incomplete room information'
            })
        
        file_manager = FileManager(current_app.config['DATA_DIR'])
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return jsonify({
                'code': 404,
                'message': 'Map does not exist'
            }), 404
        
        map_3d = Map3D.from_dict(map_data)
        
        # Add room
        success = map_3d.add_room_3d(room_id, name, int(x), int(y), int(floor))
        
        if not success:
            return jsonify({
                'code': 400,
                'message': 'Failed to add room, invalid position or room ID already exists'
            })
        
        # Save map
        map_3d_data = map_3d.to_dict()
        file_manager.update_map(map_id, map_3d_data)
        
        return jsonify({
            'code': 200,
            'message': 'Room added successfully',
            'data': {
                'room_id': room_id,
                'name': name,
                'x': x,
                'y': y,
                'floor': floor
            }
        })
    
    except Exception as e:
        print(f"Failed to add 3D room: {e}")
        return jsonify({
            'code': 500,
            'message': f'Failed to add room: {str(e)}'
        }), 500

@map_3d_bp.route('/<int:map_id>/connections', methods=['POST'])
def add_vertical_connection(map_id):
    """Add vertical connection (stairs, elevators, etc.)"""
    try:
        data = request.get_json()
        connection_type = data.get('type', 'stair')  # stair, elevator, escalator
        start_floor = data.get('start_floor')
        end_floor = data.get('end_floor')
        start_pos = data.get('start_pos', {})
        end_pos = data.get('end_pos', {})
        properties = data.get('properties', {})
        
        if not all([start_floor, end_floor, start_pos, end_pos]):
            return jsonify({
                'code': 400,
                'message': 'Incomplete connection information'
            })
        
        file_manager = FileManager(current_app.config['DATA_DIR'])
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return jsonify({
                'code': 404,
                'message': 'Map does not exist'
            }), 404
        
        map_3d = Map3D.from_dict(map_data)
        

        connection = map_3d.add_vertical_connection(
            connection_type,
            int(start_floor),
            int(end_floor),
            start_pos,
            end_pos,
            **properties
        )
        
        # Save map
        map_3d_data = map_3d.to_dict()
        file_manager.update_map(map_id, map_3d_data)
        
        return jsonify({
            'code': 200,
            'message': 'Vertical connection added successfully',
            'data': connection.to_dict()
        })
    
    except Exception as e:
        print(f"Failed to add vertical connection: {e}")
        return jsonify({
            'code': 500,
            'message': f'Failed to add connection: {str(e)}'
        }), 500

@map_3d_bp.route('/<int:map_id>/navigation/3d', methods=['POST'])
def navigate_3d(map_id):
    """3D navigation path calculation"""
    try:
        data = request.get_json()
        start_room_id = data.get('start_room_id')
        end_room_id = data.get('end_room_id')
        
        
        start_pos = data.get('start_position')  # {x, y, floor}
        end_pos = data.get('end_position')     # {x, y, floor}
        
        file_manager = FileManager(current_app.config['DATA_DIR'])
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return jsonify({
                'code': 404,
                'message': 'Map does not exist'
            }), 404
        
        map_3d = Map3D.from_dict(map_data)
        pathfinder = Pathfinding3D(map_3d)
        
        if start_room_id and end_room_id:
            
            path, instructions = pathfinder.find_shortest_route(start_room_id, end_room_id)
        elif start_pos and end_pos:
            
            start_position = Position3D(start_pos['x'], start_pos['y'], start_pos['floor'])
            end_position = Position3D(end_pos['x'], end_pos['y'], end_pos['floor'])
            path, instructions = pathfinder.find_path_3d(start_position, end_position)
        elif end_room_id:
            
            path, instructions = pathfinder.find_route_from_entrance(end_room_id)
        else:
            return jsonify({
                'code': 400,
                'message': 'Incomplete navigation parameters'
            })
        
        if not path:
            return jsonify({
                'code': 404,
                'message': 'Cannot find path'
            })
        
        # Convert path format
        path_coords = [pos.to_tuple() for pos in path]
        
        # Analyze path statistics
        total_distance = len(path)
        floors_visited = list(set(pos.floor for pos in path))
        vertical_changes = sum(1 for i in range(1, len(path)) if path[i].floor != path[i-1].floor)
        
        return jsonify({
            'code': 200,
            'message': 'Path calculation successful',
            'data': {
                'path': path_coords,
                'instructions': instructions,
                'statistics': {
                    'total_steps': total_distance,
                    'floors_visited': floors_visited,
                    'vertical_changes': vertical_changes,
                    'estimated_time': len(instructions) * 3  
                }
            }
        })
    
    except Exception as e:
        print(f"3D navigation calculation failed: {e}")
        traceback.print_exc()
        return jsonify({
            'code': 500,
            'message': f'Navigation calculation failed: {str(e)}'
        }), 500

@map_3d_bp.route('/<int:map_id>/floors/<int:floor_id>', methods=['GET'])
def get_floor_info(map_id, floor_id):
    """Get floor information"""
    try:
        file_manager = FileManager(current_app.config['DATA_DIR'])
        map_data = file_manager.get_map_data(map_id)
        
        if not map_data:
            return jsonify({
                'code': 404,
                'message': 'Map does not exist'
            }), 404
        
        map_3d = Map3D.from_dict(map_data)
        
        if floor_id not in map_3d.floors:
            return jsonify({
                'code': 404,
                'message': 'Floor does not exist'
            }), 404
        
        floor = map_3d.floors[floor_id]
        floor_info = floor.to_dict()
        
        # Add vertical connection info for floor
        connections = map_3d.get_vertical_connections_from_floor(floor_id)
        floor_info['vertical_connections'] = [conn.to_dict() for conn in connections]
        
        return jsonify({
            'code': 200,
            'message': 'Floor information retrieved successfully',
            'data': floor_info
        })
    
    except Exception as e:
        print(f"Failed to get floor information: {e}")
        return jsonify({
            'code': 500,
            'message': f'Failed to get floor information: {str(e)}'
        }), 500
