"""
3D Pathfinding Service - supports cross-floor navigation
"""
import heapq
from typing import List, Tuple, Dict, Optional
from app.models.map_3d import Map3D, VerticalConnection

class Position3D:
    """3D position"""
    def __init__(self, x: int, y: int, floor: int):
        self.x = x
        self.y = y
        self.floor = floor
    
    def __eq__(self, other):
        return self.x == other.x and self.y == other.y and self.floor == other.floor
    
    def __hash__(self):
        return hash((self.x, self.y, self.floor))
    
    def to_tuple(self):
        return (self.x, self.y, self.floor)
    
    def __repr__(self):
        return f"Pos({self.x}, {self.y}, F{self.floor})"

class PathNode:
    """Path node"""
    def __init__(self, position: Position3D, g_cost: float = 0, h_cost: float = 0, 
                 parent: Optional['PathNode'] = None, action: str = "move"):
        self.position = position
        self.g_cost = g_cost  # Actual cost from start to current node
        self.h_cost = h_cost  # Heuristic cost from current node to endpoint
        self.f_cost = g_cost + h_cost  # Total cost
        self.parent = parent
        self.action = action  # move, stair_up, stair_down, elevator_up, elevator_down
        self.connection_info = None  # Vertical connection information
    
    def __lt__(self, other):
        return self.f_cost < other.f_cost

class Pathfinding3D:
    """3D pathfinder"""
    
    def __init__(self, map_3d: Map3D):
        self.map_3d = map_3d
        # Cost weights for different actions
        self.move_cost = 1.0
        self.stair_cost_per_step = 1.5  # Cost per stair step
        self.elevator_cost_per_floor = 10.0  # Elevator cost per floor
        self.floor_change_penalty = 20.0  # Additional penalty for floor changes
    
    def heuristic_3d(self, pos1: Position3D, pos2: Position3D) -> float:
        """
        Optimized 3D heuristic function
        参考: https://blog.csdn.net/vertex_mfx/article/details/113480476
        Use Euclidean distance + floor change cost
        """
        import math
        
        # Horizontal distance (Euclidean distance is more accurate)
        dx = pos2.x - pos1.x
        dy = pos2.y - pos1.y
        horizontal_distance = math.sqrt(dx*dx + dy*dy)
        
        # Floor difference
        floor_difference = abs(pos1.floor - pos2.floor)
        
        # 🔧 Optimization: Consider actual vertical connections for floor change cost
        if floor_difference > 0:
            # Estimate the cost of switching floors (including reaching the stairs + going upstairs + leaving the stairs)
            vertical_cost = floor_difference * self.floor_change_penalty
        else:
            vertical_cost = 0
        
        return horizontal_distance + vertical_cost
    
    def find_path(self, start: Position3D, end: Position3D) -> Tuple[List[PathNode], float]:
        """
        Find 3D path (API compatible method)
        Return: (path node list, total cost)
        """
        path_nodes, instructions = self.find_path_3d(start, end)
        if not path_nodes:
            return None
        
        # path_nodes is already a PathNode list, return directly
        # Calculate total cost
        total_cost = sum(node.g_cost for node in path_nodes)
        
        return path_nodes, total_cost

    def find_path_3d(self, start: Position3D, end: Position3D) -> Tuple[List[PathNode], List[Dict]]:
        """
        Find 3D path
        Return: (path node list, detailed instruction list)
        """
        if start == end:
            start_node = PathNode(start, 0, 0, action="arrived")
            return [start_node], [{"action": "arrived", "position": start.to_tuple()}]
        
        open_set = []
        closed_set = set()
        
        start_node = PathNode(start, 0, self.heuristic_3d(start, end))
        heapq.heappush(open_set, start_node)
        
        node_map = {start: start_node}
        
        step_count = 0
        max_steps = 10000  # Prevent infinite loop
        
        while open_set and step_count < max_steps:
            current_node = heapq.heappop(open_set)
            current_pos = current_node.position
            step_count += 1
            
            if current_pos in closed_set:
                continue
            
            closed_set.add(current_pos)
            
            if current_pos == end:
                # Find path, reconstruct path
                
                # 🎯 Based on the article's path reconstruction and debugging
                path_nodes = []
                node = current_node
                while node:
                    path_nodes.append(node)
                    node = node.parent
                path_nodes.reverse()
                
                return path_nodes, []
            
            # Explore neighbors
            neighbors = self._get_neighbors_with_cost(current_pos)
            
            for neighbor_pos, move_cost, action, connection_info in neighbors:
                if neighbor_pos in closed_set:
                    continue
                
                new_g_cost = current_node.g_cost + move_cost
                new_h_cost = self.heuristic_3d(neighbor_pos, end)
                
                if neighbor_pos not in node_map or new_g_cost < node_map[neighbor_pos].g_cost:
                    neighbor_node = PathNode(
                        neighbor_pos, new_g_cost, new_h_cost, 
                        current_node, action
                    )
                    neighbor_node.connection_info = connection_info
                    
                    node_map[neighbor_pos] = neighbor_node
                    heapq.heappush(open_set, neighbor_node)
        
        # Path search failed, output debug information
        print(f"❌ A* search failed: total steps {step_count}, open list size {len(open_set)}")
        print(f"   Start: ({start.x}, {start.y}, {start.floor} floor)")  
        print(f"   End: ({end.x}, {end.y}, {end.floor} floor)")
        print(f"   Visited nodes: {len(closed_set)}")
        
        # Check neighbors of start and end points
        start_neighbors = self._get_neighbors_with_cost(start)
        end_neighbors = self._get_neighbors_with_cost(end)
        print(f"   Start neighbors: {len(start_neighbors)}")
        print(f"   End neighbors: {len(end_neighbors)}")
        
        return [], []  # No path found
    
    def _get_neighbors_with_cost(self, pos: Position3D) -> List[Tuple[Position3D, float, str, Dict]]:
        """Get neighbors with cost"""
        neighbors = []
        
        # Same floor movement
        directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]  # 上右下左
        for dx, dy in directions:
            nx, ny = pos.x + dx, pos.y + dy
            if self.map_3d.is_walkable_3d(nx, ny, pos.floor):
                neighbor_pos = Position3D(nx, ny, pos.floor)
                neighbors.append((neighbor_pos, self.move_cost, "move", {}))
        
        # Vertical movement
        vertical_neighbors = self._get_vertical_neighbors(pos)
        neighbors.extend(vertical_neighbors)
        
        return neighbors
    
    def _get_vertical_neighbors(self, pos: Position3D) -> List[Tuple[Position3D, float, str, Dict]]:
        """
        Get vertical neighbors (based on 3D A* algorithm optimization)
        参考: https://blog.csdn.net/vertex_mfx/article/details/113480476
        """
        neighbors = []
        
        for vc in self.map_3d.vertical_connections:
            connection_info = {
                "connection_id": vc.id,
                "connection_type": vc.type,
                "steps": vc.steps,
                "duration": vc.duration
            }
            
            # 🔧 Clear bidirectional connection logic
            neighbor_pos = None
            target_floor = None
            
            # Check if it is at the start of the connection
            if (vc.start_floor == pos.floor and 
                vc.start_pos["x"] == pos.x and 
                vc.start_pos["y"] == pos.y):
                # Can go to the end
                if self.map_3d.is_walkable_3d(vc.end_pos["x"], vc.end_pos["y"], vc.end_floor):
                    neighbor_pos = Position3D(vc.end_pos["x"], vc.end_pos["y"], vc.end_floor)
                    target_floor = vc.end_floor
            
            # Check if it is at the end of the connection  
            elif (vc.end_floor == pos.floor and 
                  vc.end_pos["x"] == pos.x and 
                  vc.end_pos["y"] == pos.y):
                # Can go to the start
                if self.map_3d.is_walkable_3d(vc.start_pos["x"], vc.start_pos["y"], vc.start_floor):
                    neighbor_pos = Position3D(vc.start_pos["x"], vc.start_pos["y"], vc.start_floor)
                    target_floor = vc.start_floor
            
            # If a valid connection is found
            if neighbor_pos and target_floor:
                cost = self._calculate_vertical_cost(vc)
                # 🎯 Key fix: Determine direction based on actual floor changes
                current_floor = pos.floor
                actual_direction = "up" if target_floor > current_floor else "down"
                action = f"{vc.type}_{actual_direction}"
                neighbors.append((neighbor_pos, cost, action, connection_info))
                print(f"🏢 Vertical connection: {current_floor} floor → {target_floor} floor, direction={actual_direction}, action={action}")
        
        return neighbors
    
    def _calculate_vertical_cost(self, vc: VerticalConnection) -> float:
        """Calculate the cost of vertical movement"""
        base_cost = self.floor_change_penalty
        
        if vc.type == "stair":
            return base_cost + vc.steps * self.stair_cost_per_step
        elif vc.type == "elevator":
            floors = abs(vc.end_floor - vc.start_floor)
            return base_cost + floors * self.elevator_cost_per_floor
        elif vc.type == "escalator":
            return base_cost + vc.duration * 0.5  # Escalator is relatively easy
        else:
            return base_cost + vc.duration
    
    def _reconstruct_path(self, end_node: PathNode) -> Tuple[List[Position3D], List[Dict]]:
        """Reconstruct path and generate detailed instructions"""
        path = []
        instructions = []
        
        current = end_node
        while current:
            path.append(current.position)
            current = current.parent
        
        path.reverse()
        
        # Generate detailed instructions
        instructions = self._generate_instructions(path, end_node)
        
        return path, instructions
    
    def _generate_instructions(self, path: List[Position3D], end_node: PathNode) -> List[Dict]:
        """Generate navigation instructions"""
        if len(path) < 2:
            return [{"action": "arrived", "text": "Arrived at the destination"}]
        
        instructions = []
        
        # Backtrack from the end node to get action information
        actions = []
        current = end_node
        while current and current.parent:
            actions.append({
                "action": current.action,
                "position": current.position.to_tuple(),
                "connection_info": current.connection_info
            })
            current = current.parent
        actions.reverse()
        
        # Generate voice instructions
        for i, action_info in enumerate(actions):
            pos = Position3D(*action_info["position"])
            action = action_info["action"]
            
            if action == "move":
                # Ordinary movement instructions
                if i == 0:
                    instructions.append({
                        "action": "start",
                        "text": f"Start navigation, located at {pos.floor} floor",
                        "position": pos.to_tuple()
                    })
                elif i == len(actions) - 1:
                    instructions.append({
                        "action": "arrive",
                        "text": "Arrived at the destination",
                        "position": pos.to_tuple()
                    })
                else:
                    # Fix: pass Position3D object instead of PathNode object
                    direction = self._get_direction(path[i-1].position, path[i].position)
                    instructions.append({
                        "action": "move", 
                        "text": f"Move {direction} direction",
                        "position": pos.to_tuple()
                    })
            
            elif "stair" in action:
                # Stair instructions
                conn_info = action_info["connection_info"]
                direction = "up" if "up" in action else "down"
                floor_target = pos.floor
                steps = conn_info.get("steps", 0)
                
                instructions.extend([
                    {
                        "action": "stair_prepare",
                        "text": f"There is a stair ahead, prepare to {direction} to {floor_target} floor",
                        "position": pos.to_tuple(),
                        "connection_info": conn_info
                    },
                    {
                        "action": "stair_progress",
                        "text": f"Moving {direction}, total {steps} steps, please be careful",
                        "position": pos.to_tuple()
                    },
                    {
                        "action": "stair_complete",
                        "text": f"Stair ends, arrived at {floor_target} floor",
                        "position": pos.to_tuple()
                    }
                ])
            
            elif "elevator" in action:
                # Elevator instructions
                conn_info = action_info["connection_info"]
                floor_target = pos.floor
                
                instructions.extend([
                    {
                        "action": "elevator_wait",
                        "text": "Arrived at the elevator, waiting for the elevator",
                        "position": pos.to_tuple(),
                        "connection_info": conn_info
                    },
                    {
                        "action": "elevator_ride",
                        "text": f"Take the elevator to {floor_target} floor",
                        "position": pos.to_tuple()
                    },
                    {
                        "action": "elevator_exit",
                        "text": f"Elevator arrived at {floor_target} floor, please exit the elevator",
                        "position": pos.to_tuple()
                    }
                ])
        
        return instructions
    
    def _get_direction(self, pos1: Position3D, pos2: Position3D) -> str:
        """Get moving direction"""
        dx = pos2.x - pos1.x
        dy = pos2.y - pos1.y
        
        if dx == 1:
            return "right"
        elif dx == -1:
            return "left"
        elif dy == 1:
            return "down"
        elif dy == -1:
            return "up"
        else:
            return "front"
    
    def _get_turn_instruction(self, from_dir: str, to_dir: str) -> str:
        """根据方向变化生成转向指令"""
        # 转向映射表（基于地图坐标系）
        # right(东), down(南), left(西), up(北)
        turn_map = {
            # 从right(东)转向
            ("right", "down"): "Turn right",    # 东→南：右转
            ("right", "up"): "Turn left",       # 东→北：左转
            ("right", "left"): "Turn around",   # 东→西：掉头
            
            # 从down(南)转向
            ("down", "left"): "Turn right",     # 南→西：右转
            ("down", "right"): "Turn left",     # 南→东：左转
            ("down", "up"): "Turn around",      # 南→北：掉头
            
            # 从left(西)转向
            ("left", "up"): "Turn right",       # 西→北：右转
            ("left", "down"): "Turn left",      # 西→南：左转
            ("left", "right"): "Turn around",   # 西→东：掉头
            
            # 从up(北)转向
            ("up", "right"): "Turn right",      # 北→东：右转
            ("up", "left"): "Turn left",        # 北→西：左转
            ("up", "down"): "Turn around",      # 北→南：掉头
        }
        
        return turn_map.get((from_dir, to_dir), "Continue")
    
    def find_shortest_route(self, start_room_id: str, end_room_id: str) -> Tuple[List[Position3D], List[Dict]]:
        """
        Find the shortest path according to the room ID
        """
        start_room = self.map_3d.find_room_by_id_3d(start_room_id)
        end_room = self.map_3d.find_room_by_id_3d(end_room_id)
        
        if not start_room or not end_room:
            return [], []
        
        start_pos = Position3D(start_room["x"], start_room["y"], start_room["floor"])
        end_pos = Position3D(end_room["x"], end_room["y"], end_room["floor"])
        
        return self.find_path_3d(start_pos, end_pos)
    
    def find_route_from_entrance(self, target_room_id: str) -> Tuple[List[Position3D], List[Dict]]:
        """Find the path from the entrance to the specified room"""
        # Use the main entrance or the first floor entrance
        entrance = self.map_3d.entrance
        if "floor" not in entrance:
            entrance["floor"] = 1
        
        start_pos = Position3D(entrance["x"], entrance["y"], entrance["floor"])
        
        target_room = self.map_3d.find_room_by_id_3d(target_room_id)
        if not target_room:
            return [], []
        
        end_pos = Position3D(target_room["x"], target_room["y"], target_room["floor"])
        
        return self.find_path_3d(start_pos, end_pos)
    
    def generate_voice_instructions(self, path: List[PathNode], target_room_name: str = None) -> List[str]:
        """
        Generate optimized voice navigation instructions (merge consecutive same direction movements)
        """
        if not path:
            return []
        
        if len(path) == 1:
            return ["You have reached your destination"]
        
        instructions = ["Start navigation. Please follow the guidance"]
        i = 1
        
        # 🔧 Detailed path analysis based on the article's思路
        
        # Analyze floor changes in the path (add exception handling)
        floor_changes = []
        try:
            for i_node in range(1, len(path)):
                prev_node = path[i_node-1]
                curr_node = path[i_node]
                
                # Ensure the node has position attribute
                if hasattr(prev_node, 'position') and hasattr(curr_node, 'position'):
                    prev_floor = prev_node.position.floor
                    curr_floor = curr_node.position.floor
                    if prev_floor != curr_floor:
                        direction = "上" if curr_floor > prev_floor else "下"
                        floor_changes.append(f"{direction}楼({prev_floor}→{curr_floor})")
                else:
                    print(f"⚠️ Node {i_node} missing position attribute")
        except Exception as e:
            print(f"⚠️ Floor change analysis error: {e}")
        
        if floor_changes:
            print(f"🏢 Detected floor changes: {', '.join(floor_changes)}")
        else:
            print(f"🏢 Single layer path, no floor changes")
        
        i = 1
        prev_direction = None  # 记录上一次的方向
        
        try:
            while i < len(path):
                node = path[i]
                action = getattr(node, 'action', 'move')  # Safe to get action
                
                print(f"🔄 Process node {i}: action={action}")
                
                if action == "move":
                    # Merge consecutive same direction movements
                    direction = self._get_direction(path[i-1].position, node.position)
                    consecutive_steps = 1
                    
                    # Calculate the number of consecutive same direction steps
                    j = i + 1
                    while j < len(path) and getattr(path[j], 'action', 'move') == "move":
                        next_direction = self._get_direction(path[j-1].position, path[j].position)
                        if next_direction == direction:
                            consecutive_steps += 1
                            j += 1
                        else:
                            break
                    
                    # 生成包含步数的指令
                    print(f"📍 3D导航: 从节点{i}到{j}, 方向={direction}, 连续步数={consecutive_steps}")
                    
                    # 检测方向变化，添加转向指令
                    if prev_direction and prev_direction != direction:
                        turn_inst = self._get_turn_instruction(prev_direction, direction)
                        if turn_inst:
                            instructions.append(turn_inst)
                            print(f"   🔄 转向: {turn_inst}")
                    
                    # 然后生成带步数的前进指令
                    if consecutive_steps == 1:
                        inst = "Walk 1 step forward"
                    else:
                        inst = f"Walk {consecutive_steps} steps forward"
                    
                    instructions.append(inst)
                    print(f"   ➡️  前进: {inst}")
                    
                    prev_direction = direction  # 更新方向
                    i = j  # 跳过已处理的步数
                
                elif action.startswith("stair"):
                    if "up" in action:
                        instructions.append("Go upstairs. Please hold the handrail")
                    else:
                        instructions.append("Go downstairs. Please be careful")
                    i += 1
                    
                elif action.startswith("elevator"):
                    if "up" in action:
                        instructions.append("Take the elevator up")
                    else:
                        instructions.append("Take the elevator down")
                    i += 1
                    
                else:
                    i += 1
                
        except Exception as e:
            print(f"❌ Voice instruction generation error: {e}")
            print(f"   错误位置: 节点{i}")
            # Return basic instructions to ensure not completely failed
            instructions.extend(["Error", "Please manually navigate"])
        
        # Add arrival instructions
        try:
            if target_room_name:
                instructions.append("You have reached your destination")
            else:
                instructions.append("You have reached your destination")
                
                
        except Exception as e:
            print(f"❌ Arrival instruction generation error: {e}")
        
        return instructions
    
    def generate_detailed_instructions(self, path: List[PathNode], target_room_name: str = None) -> List[Dict]:
        """
        Generate detailed navigation instructions
        """
        if not path:
            return []
        
        instructions = []
        
        for i, node in enumerate(path):
            if i == 0:
                instructions.append({
                    "step": i + 1,
                    "action": "start",
                    "description": "Start navigation",
                    "position": {
                        "x": node.position.x,
                        "y": node.position.y,
                        "floor": node.position.floor
                    }
                })
                continue
            
            prev_node = path[i-1]
            action = node.action
            
            instruction = {
                "step": i + 1,
                "action": action,
                "position": {
                    "x": node.position.x,
                    "y": node.position.y,
                    "floor": node.position.floor
                }
            }
            
            if action == "move":
                direction = self._get_direction(prev_node.position, node.position)
                instruction["description"] = f"Move {direction} direction to ({node.position.x}, {node.position.y})"
            elif action.startswith("stair"):
                if "up" in action:
                    instruction["description"] = f"Move to stair {node.position.floor} floor"
                else:
                    instruction["description"] = f"Move to stair {node.position.floor} floor"
                if hasattr(node, 'connection_info') and node.connection_info:
                    instruction["connection_info"] = node.connection_info
            elif action.startswith("elevator"):
                if "up" in action:
                    instruction["description"] = f"Move to elevator {node.position.floor} floor"
                else:
                    instruction["description"] = f"Move to elevator {node.position.floor} floor"
                if hasattr(node, 'connection_info') and node.connection_info:
                    instruction["connection_info"] = node.connection_info
            else:
                instruction["description"] = f"Move to ({node.position.x}, {node.position.y}, {node.position.floor} floor)"
            
            instructions.append(instruction)
        
        # Add arrival instructions
        final_node = path[-1]
        instructions.append({
            "step": len(path) + 1,
            "action": "arrive",
            "description": f"Arrived at the destination{target_room_name if target_room_name else ''}",
            "position": {
                "x": final_node.position.x,
                "y": final_node.position.y,
                "floor": final_node.position.floor
            }
        })
        
        return instructions
    
    def estimate_time(self, path: List[PathNode]) -> float:
        """
        Estimate the time required for the path (seconds)
        """
        if not path:
            return 0
        
        total_time = 0
        
        for i, node in enumerate(path):
            if i == 0:
                continue
            
            action = node.action
            
            if action == "move":
                total_time += 3  # Each step 3 seconds
            elif action.startswith("stair"):
                total_time += 30  # Stair 30 seconds
            elif action.startswith("elevator"):
                total_time += 45  # Elevator 45 seconds
            else:
                total_time += 3  # Default 3 seconds
        
        return total_time
